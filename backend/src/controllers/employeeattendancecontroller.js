const db = require("../config/db");

const tableColumnsCache = {};

const getTableColumns = async (tableName) => {
  if (tableColumnsCache[tableName]) return tableColumnsCache[tableName];

  const [columns] = await db.query(`SHOW COLUMNS FROM ${tableName}`);
  const columnNames = columns.map((column) => column.Field);

  tableColumnsCache[tableName] = columnNames;
  return columnNames;
};

const hasColumn = (columns, columnName) => {
  return columns.includes(columnName);
};

const formatDate = (dateValue) => {
  if (!dateValue) return null;

  const value = String(dateValue);

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getDayName = (dateString) => {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("en-US", { weekday: "long" });
};

const isSunday = (dateString) => {
  return getDayName(dateString) === "Sunday";
};

const addOneDay = (dateString) => {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return formatDate(date);
};

const normalizeStatus = (status) => {
  const value = String(status || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (["present", "p"].includes(value)) return "present";
  if (["absent", "a"].includes(value)) return "absent";
  if (["late", "l"].includes(value)) return "late";
  if (["leave", "on_leave"].includes(value)) return "leave";
  if (["half_day", "halfday"].includes(value)) return "half_day";

  return value || "absent";
};

const formatTime = (timeValue) => {
  if (!timeValue) return "-";

  const value = String(timeValue);

  if (value.includes("T")) {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date.toTimeString().slice(0, 8);
    }
  }

  return value.slice(0, 8);
};

const calculateMinutesFromTimes = (checkIn, checkOut) => {
  if (!checkIn || !checkOut || checkIn === "-" || checkOut === "-") return 0;

  const inParts = String(checkIn).split(":").map(Number);
  const outParts = String(checkOut).split(":").map(Number);

  if (inParts.length < 2 || outParts.length < 2) return 0;
  if (Number.isNaN(inParts[0]) || Number.isNaN(outParts[0])) return 0;

  const inMinutes = inParts[0] * 60 + inParts[1];
  const outMinutes = outParts[0] * 60 + outParts[1];

  if (outMinutes <= inMinutes) return 0;

  return outMinutes - inMinutes;
};

const formatWorkingHours = (totalMinutes) => {
  const minutes = Number(totalMinutes || 0);

  if (!minutes || minutes <= 0) return "-";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0 && remainingMinutes > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${remainingMinutes}m`;
};

const buildAttendanceWithGeneratedAbsents = (attendanceRows, employeeId) => {
  if (!attendanceRows.length) return [];

  const existingByDate = new Map();

  attendanceRows.forEach((row) => {
    const attendanceDate = formatDate(row.attendance_date);
    existingByDate.set(attendanceDate, {
      ...row,
      attendance_date: attendanceDate,
    });
  });

  const sortedDates = [...existingByDate.keys()].filter(Boolean).sort();

  if (!sortedDates.length) return [];

  const startDate = sortedDates[0];
  const endDate = sortedDates[sortedDates.length - 1];

  const finalAttendance = [];
  let currentDate = startDate;

  while (currentDate <= endDate) {
    if (!isSunday(currentDate)) {
      const existingRow = existingByDate.get(currentDate);

      if (existingRow) {
        const checkIn = formatTime(existingRow.check_in_time);
        const checkOut = formatTime(existingRow.check_out_time);

        const totalMinutes =
          Number(existingRow.total_minutes || 0) ||
          calculateMinutesFromTimes(checkIn, checkOut);

        finalAttendance.push({
          attendance_id: existingRow.attendance_id,
          employee_id: existingRow.employee_id,
          attendance_date: currentDate,
          day_name: getDayName(currentDate),
          check_in_time: checkIn,
          check_out_time: checkOut,
          total_minutes: totalMinutes,
          working_hours: formatWorkingHours(totalMinutes),
          status: normalizeStatus(existingRow.status),
          remarks: existingRow.remarks || "-",
          is_generated_absent: false,
        });
      } else {
        finalAttendance.push({
          attendance_id: null,
          employee_id: employeeId,
          attendance_date: currentDate,
          day_name: getDayName(currentDate),
          check_in_time: "-",
          check_out_time: "-",
          total_minutes: 0,
          working_hours: "-",
          status: "absent",
          remarks: "Absent",
          is_generated_absent: true,
        });
      }
    }

    currentDate = addOneDay(currentDate);
  }

  return finalAttendance.sort((a, b) =>
    String(b.attendance_date).localeCompare(String(a.attendance_date))
  );
};

const getSummary = (attendanceRows) => {
  const totalRecords = attendanceRows.length;

  const present = attendanceRows.filter(
    (row) => normalizeStatus(row.status) === "present"
  ).length;

  const absent = attendanceRows.filter(
    (row) => normalizeStatus(row.status) === "absent"
  ).length;

  const late = attendanceRows.filter(
    (row) => normalizeStatus(row.status) === "late"
  ).length;

  const leave = attendanceRows.filter(
    (row) => normalizeStatus(row.status) === "leave"
  ).length;

  const attendancePercentage =
    totalRecords > 0 ? Math.round(((present + late) / totalRecords) * 100) : 0;

  return {
    total_records: totalRecords,
    present,
    absent,
    late,
    leave,
    attendance_percentage: attendancePercentage,
  };
};

const getEmployeeAttendance = async (req, res) => {
  try {
    const employeeId = req.user.user_id;

    const userColumns = await getTableColumns("users");

    const selectEmployeeCode = hasColumn(userColumns, "employee_code")
      ? "u.employee_code"
      : "u.user_id AS employee_code";

    const selectDesignation = hasColumn(userColumns, "designation")
      ? "u.designation"
      : "NULL AS designation";

    const [profileRows] = await db.query(
      `
      SELECT
        u.user_id,
        u.full_name,
        u.email,
        ${selectEmployeeCode},
        ${selectDesignation},
        r.role_name,
        d.department_name
      FROM users u
      LEFT JOIN roles r ON r.role_id = u.role_id
      LEFT JOIN departments d ON d.department_id = u.department_id
      WHERE u.user_id = ?
      LIMIT 1
      `,
      [employeeId]
    );

    const profile = profileRows[0] || {
      user_id: employeeId,
      full_name: req.user.full_name || "-",
      email: req.user.email || "-",
      employee_code: req.user.employee_code || "-",
      designation: req.user.designation || "-",
      role_name: req.user.role_name || "employee",
      department_name: req.user.department_name || "-",
    };

    const [attendanceRows] = await db.query(
      `
      SELECT
        attendance_id,
        employee_id,
        DATE_FORMAT(attendance_date, '%Y-%m-%d') AS attendance_date,
        check_in_time,
        check_out_time,
        total_minutes,
        status,
        remarks,
        created_at,
        updated_at
      FROM attendance
      WHERE employee_id = ?
      ORDER BY attendance_date DESC
      `,
      [employeeId]
    );

    const attendance = buildAttendanceWithGeneratedAbsents(
      attendanceRows,
      employeeId
    );

    const summary = getSummary(attendance);

    return res.json({
      success: true,
      profile,
      summary,
      attendance,
      data: {
        profile,
        summary,
        attendance,
      },
    });
  } catch (error) {
    console.error("Employee attendance fetch error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch employee attendance.",
      error: error.message,
    });
  }
};

module.exports = {
  getEmployeeAttendance,
};
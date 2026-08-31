const db = require("../config/db");
const {
  sendMail,
} = require("../utils/emailservice");

const HR_FIELD_VISIT_EMAIL =
  "rathika.haleangadi@valencianutrition.com";
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

/* =========================================================
   EMPLOYEE - GET FIELD VISITS
========================================================= */

const getEmployeeFieldVisits = async (req, res) => {
  try {
    const employeeId = Number(req.user?.user_id);

    if (!employeeId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const [visits] = await db.query(
      `
      SELECT
        fv.visit_id,
        fv.employee_id,
        fv.visit_type,

        DATE_FORMAT(
          fv.visit_date,
          '%Y-%m-%d'
        ) AS visit_date,

        TIME_FORMAT(
          fv.start_time,
          '%H:%i'
        ) AS start_time,

        TIME_FORMAT(
          fv.end_time,
          '%H:%i'
        ) AS end_time,

        fv.location,
        fv.comment,
        fv.status,

        fv.reviewed_by,

        reviewer.full_name
          AS reviewed_by_name,

        DATE_FORMAT(
          fv.reviewed_at,
          '%Y-%m-%d %H:%i:%s'
        ) AS reviewed_at,

        fv.review_remark,

        fv.created_at,
        fv.updated_at

      FROM employee_field_visits fv

      LEFT JOIN users reviewer
        ON reviewer.user_id =
           fv.reviewed_by

      WHERE
        fv.employee_id = ?

      ORDER BY
        fv.visit_date DESC,
        fv.start_time DESC,
        fv.visit_id DESC
      `,
      [employeeId]
    );

    const summary = {
      total: visits.length,

      approved: visits.filter(
        (visit) =>
          String(visit.status).toLowerCase() ===
          "approved"
      ).length,

      pending: visits.filter(
        (visit) =>
          String(visit.status).toLowerCase() ===
          "pending"
      ).length,

      rejected: visits.filter(
        (visit) =>
          String(visit.status).toLowerCase() ===
          "rejected"
      ).length,
    };

    return res.json({
      success: true,
      summary,
      visits,
    });
  } catch (error) {
    console.error(
      "Get employee field visits error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch field visits.",
      error: error.message,
      sqlMessage:
        error.sqlMessage || null,
    });
  }
};

/* =========================================================
   EMPLOYEE - CREATE FIELD VISIT
   EMAIL:
   - RESPECTIVE DEPARTMENT ADMIN(S)
   - HR
   - NO SUPERADMIN EMAIL
========================================================= */

const createEmployeeFieldVisit = async (
  req,
  res
) => {
  try {
    const employeeId =
      Number(req.user?.user_id);

    if (!employeeId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const visitType =
      String(
        req.body?.visit_type ||
          "Sales Visit"
      ).trim() || "Sales Visit";

    const visitDate =
      String(
        req.body?.visit_date || ""
      ).trim();

    const startTime =
      String(
        req.body?.start_time || ""
      ).trim();

    const endTime =
      String(
        req.body?.end_time || ""
      ).trim();

    const location =
      String(
        req.body?.location || ""
      ).trim();

    const comment =
      String(
        req.body?.comment || ""
      ).trim();

    /* =========================
       VALIDATION
    ========================= */

    if (!visitDate) {
      return res.status(400).json({
        success: false,
        message:
          "Visit date is required.",
      });
    }

    if (
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Start time and end time are required.",
      });
    }

    if (
      endTime <= startTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          "End time must be later than start time.",
      });
    }

    if (!location) {
      return res.status(400).json({
        success: false,
        message:
          "Location is required.",
      });
    }

    if (!comment) {
      return res.status(400).json({
        success: false,
        message:
          "Comment / reason is required.",
      });
    }

    /* =========================
       GET EMPLOYEE DETAILS
    ========================= */

    const [employeeRows] =
      await db.query(
        `
        SELECT
          u.user_id,
          u.employee_code,
          u.full_name,
          u.email,
          u.designation,
          u.department_id,
          d.department_name

        FROM users u

        LEFT JOIN departments d
          ON d.department_id =
             u.department_id

        WHERE
          u.user_id = ?

        LIMIT 1
        `,
        [employeeId]
      );

    if (!employeeRows.length) {
      return res.status(404).json({
        success: false,
        message:
          "Employee account not found.",
      });
    }

    const employee =
      employeeRows[0];

    /* =========================
       SAVE FIELD VISIT
    ========================= */

    const [result] =
      await db.query(
        `
        INSERT INTO employee_field_visits (
          employee_id,
          visit_type,
          visit_date,
          start_time,
          end_time,
          location,
          comment,
          status
        )

        VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          'pending'
        )
        `,
        [
          employeeId,
          visitType,
          visitDate,
          startTime,
          endTime,
          location,
          comment,
        ]
      );

    /* =========================
       GET SAVED VISIT
    ========================= */

    const [visitRows] =
      await db.query(
        `
        SELECT
          visit_id,
          employee_id,
          visit_type,

          DATE_FORMAT(
            visit_date,
            '%Y-%m-%d'
          ) AS visit_date,

          TIME_FORMAT(
            start_time,
            '%H:%i'
          ) AS start_time,

          TIME_FORMAT(
            end_time,
            '%H:%i'
          ) AS end_time,

          location,
          comment,
          status,
          reviewed_by,
          reviewed_at,
          review_remark,
          created_at,
          updated_at

        FROM employee_field_visits

        WHERE visit_id = ?

        LIMIT 1
        `,
        [result.insertId]
      );

    /* =========================
       GET ALL ADMINS FROM
       EMPLOYEE'S DEPARTMENT
    ========================= */

    const [adminRows] =
      await db.query(
        `
        SELECT DISTINCT
          u.user_id,
          u.full_name,
          u.email

        FROM users u

        INNER JOIN roles r
          ON r.role_id =
             u.role_id

        WHERE
          u.department_id = ?

          AND LOWER(
            r.role_name
          ) = 'admin'

          AND LOWER(
            COALESCE(
              u.status,
              'active'
            )
          ) != 'deleted'

          AND u.email IS NOT NULL

          AND TRIM(
            u.email
          ) != ''

        ORDER BY
          u.full_name ASC
        `,
        [
          employee.department_id,
        ]
      );

    const adminEmails = [
      ...new Set(
        adminRows
          .map((admin) =>
            String(
              admin.email || ""
            )
              .trim()
              .toLowerCase()
          )
          .filter(Boolean)
      ),
    ];

    /* =========================
       EMAIL ADMIN(S) + HR
       NO SUPERADMIN
    ========================= */

    let emailResult = {
      sent: false,
      skipped: false,
    };

    try {
      const hrEmail =
        HR_FIELD_VISIT_EMAIL
          .trim()
          .toLowerCase();

      /*
       If Rathika later becomes
       an Admin, prevent duplicate
       email.
      */

      const hrAlreadyAdmin =
        adminEmails.includes(
          hrEmail
        );

      let toEmails =
        adminEmails;

      let ccEmails = [];

      /*
       If department has Admin(s):
       TO = Admin(s)
       CC = HR

       If no Admin found:
       TO = HR
      */

      if (
        adminEmails.length > 0
      ) {
        if (!hrAlreadyAdmin) {
          ccEmails = [
            HR_FIELD_VISIT_EMAIL,
          ];
        }
      } else {
        toEmails = [
          HR_FIELD_VISIT_EMAIL,
        ];
      }

      const subject =
        `Field Visit Submitted - ${employee.full_name}`;

      const text = `
A new Field Visit has been submitted through Valencia RMS.

Employee: ${employee.full_name || "-"}
Employee Code: ${employee.employee_code || "-"}
Department: ${employee.department_name || "-"}
Designation: ${employee.designation || "-"}

Visit Type: ${visitType}
Date: ${visitDate}
Time: ${startTime} - ${endTime}
Location: ${location}

Reason:
${comment}

Status: Pending

This Field Visit requires review by the respective Department Admin.

Regards,
Valencia RMS
`;

      const html = `
        <div style="
          font-family: Arial, sans-serif;
          color: #111827;
          line-height: 1.6;
        ">

          <h2 style="
            color: #ff5733;
            margin-bottom: 6px;
          ">
            Field Visit Submitted
          </h2>

          <p>
            A new Field Visit has been
            submitted through Valencia RMS.
          </p>

          <table style="
            width: 100%;
            max-width: 650px;
            border-collapse: collapse;
          ">

            <tr>
              <td style="
                padding: 9px;
                border: 1px solid #ddd;
              ">
                <strong>Employee</strong>
              </td>

              <td style="
                padding: 9px;
                border: 1px solid #ddd;
              ">
                ${employee.full_name || "-"}
              </td>
            </tr>

            <tr>
              <td style="
                padding: 9px;
                border: 1px solid #ddd;
              ">
                <strong>
                  Employee Code
                </strong>
              </td>

              <td style="
                padding: 9px;
                border: 1px solid #ddd;
              ">
                ${
                  employee.employee_code ||
                  "-"
                }
              </td>
            </tr>

            <tr>
              <td style="
                padding: 9px;
                border: 1px solid #ddd;
              ">
                <strong>
                  Department
                </strong>
              </td>

              <td style="
                padding: 9px;
                border: 1px solid #ddd;
              ">
                ${
                  employee.department_name ||
                  "-"
                }
              </td>
            </tr>

            <tr>
              <td style="
                padding: 9px;
                border: 1px solid #ddd;
              ">
                <strong>
                  Visit Type
                </strong>
              </td>

              <td style="
                padding: 9px;
                border: 1px solid #ddd;
              ">
                ${visitType}
              </td>
            </tr>

            <tr>
              <td style="
                padding: 9px;
                border: 1px solid #ddd;
              ">
                <strong>Date</strong>
              </td>

              <td style="
                padding: 9px;
                border: 1px solid #ddd;
              ">
                ${visitDate}
              </td>
            </tr>

            <tr>
              <td style="
                padding: 9px;
                border: 1px solid #ddd;
              ">
                <strong>Time</strong>
              </td>

              <td style="
                padding: 9px;
                border: 1px solid #ddd;
              ">
                ${startTime}
                -
                ${endTime}
              </td>
            </tr>

            <tr>
              <td style="
                padding: 9px;
                border: 1px solid #ddd;
              ">
                <strong>
                  Location
                </strong>
              </td>

              <td style="
                padding: 9px;
                border: 1px solid #ddd;
              ">
                ${location}
              </td>
            </tr>

            <tr>
              <td style="
                padding: 9px;
                border: 1px solid #ddd;
              ">
                <strong>
                  Comment / Reason
                </strong>
              </td>

              <td style="
                padding: 9px;
                border: 1px solid #ddd;
              ">
                ${comment}
              </td>
            </tr>

            <tr>
              <td style="
                padding: 9px;
                border: 1px solid #ddd;
              ">
                <strong>Status</strong>
              </td>

              <td style="
                padding: 9px;
                border: 1px solid #ddd;
              ">
                Pending
              </td>
            </tr>

          </table>

          <p style="
            margin-top: 20px;
          ">
            This Field Visit is pending
            review by the respective
            Department Admin.
          </p>

          <p>
            Regards,<br />
            Valencia RMS
          </p>

        </div>
      `;

      const mailResponse =
        await sendMail({
          to:
            toEmails.join(", "),

          cc:
            ccEmails.length
              ? ccEmails
              : undefined,

          subject,
          text,
          html,

          replyTo:
            employee.email ||
            undefined,
        });

      emailResult = {
        sent:
          !mailResponse?.skipped,

        skipped:
          Boolean(
            mailResponse?.skipped
          ),

        admin_emails:
          adminEmails,

        hr_email:
          HR_FIELD_VISIT_EMAIL,

        messageId:
          mailResponse?.messageId ||
          null,
      };
    } catch (
      emailError
    ) {
      console.error(
        "Field Visit email failed:",
        emailError
      );

      /*
       Visit must remain saved even
       when email fails.
      */

      emailResult = {
        sent: false,
        skipped: false,
        error:
          emailError.message,
      };
    }

    return res
      .status(201)
      .json({
        success: true,

        message:
          "Field visit submitted successfully.",

        visit:
          visitRows[0] ||
          null,

        email:
          emailResult,
      });
  } catch (error) {
    console.error(
      "Create employee field visit error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to submit field visit.",

      error:
        error.message,

      sqlMessage:
        error.sqlMessage ||
        null,
    });
  }
};


module.exports = {
  getEmployeeAttendance,
  getEmployeeFieldVisits,
  createEmployeeFieldVisit,
};
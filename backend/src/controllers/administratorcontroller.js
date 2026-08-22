const bcrypt = require("bcryptjs");
const { parse } = require("csv-parse/sync");
const XLSX = require("xlsx");
const db = require("../config/db");

const DEFAULT_USER_PASSWORD = "Valencia@123";

const PROJECT_STATUSES = [
  "not_started",
  "ongoing",
  "under_review",
  "completed",
  "on_hold",
  "cancelled",
];

const TASK_STATUSES = ["not_started", "in_progress", "completed", "blocked"];

const PRIORITIES = ["low", "medium", "high", "urgent"];

const DEFAULT_DEPARTMENTS = [
  "IT",
  "Sales",
  "Creatives",
  "Finance",
  "Nutracare",
  "POS",
  "Corporate Office",
  "General",
];

const cleanText = (value) => {
  return String(value || "").trim();
};

const normalizeText = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
};

const normalizeEmail = (value) => {
  return String(value || "").trim().toLowerCase();
};

const normalizeKey = (value) => {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
};

const getValue = (row, possibleKeys) => {
  for (const key of possibleKeys) {
    if (
      row[key] !== undefined &&
      row[key] !== null &&
      String(row[key]).trim() !== ""
    ) {
      return String(row[key]).trim();
    }
  }

  const normalizedRow = {};

  Object.keys(row).forEach((key) => {
    normalizedRow[normalizeKey(key)] = row[key];
  });

  for (const key of possibleKeys) {
    const normalizedKey = normalizeKey(key);

    if (
      normalizedRow[normalizedKey] !== undefined &&
      normalizedRow[normalizedKey] !== null &&
      String(normalizedRow[normalizedKey]).trim() !== ""
    ) {
      return String(normalizedRow[normalizedKey]).trim();
    }
  }

  return "";
};

const parseUploadedFileRows = (file) => {
  const fileName = String(file.originalname || "").toLowerCase();

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    const workbook = XLSX.read(file.buffer, {
      type: "buffer",
      cellDates: false,
    });

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    });

    let headerRowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      const rowText = rows[i]
        .map((cell) => String(cell || "").toLowerCase().trim())
        .join(" | ");

      const isUserFileHeader =
        rowText.includes("employee id") &&
        rowText.includes("first name") &&
        rowText.includes("department") &&
        rowText.includes("position code");

      const isAttendanceFileHeader =
        rowText.includes("employee id") &&
        rowText.includes("first name") &&
        rowText.includes("date") &&
        rowText.includes("first punch");

      if (isUserFileHeader || isAttendanceFileHeader) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error(
        "Could not find a valid header row. Please import the Employee file or First & Last Report file."
      );
    }

    const headers = rows[headerRowIndex].map((header) =>
      String(header || "").trim()
    );

    const dataRows = rows.slice(headerRowIndex + 1);

    return dataRows
      .filter((row) => row.some((cell) => String(cell || "").trim() !== ""))
      .map((row) => {
        const obj = {};

        headers.forEach((header, index) => {
          if (header) {
            obj[header] = row[index] ?? "";
          }
        });

        return obj;
      });
  }

  return parse(file.buffer.toString("utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });
};

const escapeCsvValue = (value) => {
  const cleanValue = value === null || value === undefined ? "" : String(value);

  if (
    cleanValue.includes(",") ||
    cleanValue.includes('"') ||
    cleanValue.includes("\n")
  ) {
    return `"${cleanValue.replace(/"/g, '""')}"`;
  }

  return cleanValue;
};

const normalizeDateForMySQL = (value) => {
  if (!value || String(value).trim() === "") return null;

  const cleanValue = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanValue)) {
    return cleanValue;
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(cleanValue)) {
    const [day, month, year] = cleanValue.split("-");
    return `${year}-${month}-${day}`;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanValue)) {
    const [day, month, year] = cleanValue.split("/");
    return `${year}-${month}-${day}`;
  }

  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(cleanValue)) {
    const [day, month, year] = cleanValue.split("-");
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanValue)) {
    const [day, month, year] = cleanValue.split("/");
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`;
  }

  const date = new Date(cleanValue);

  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const normalizeTimeForMySQL = (value) => {
  if (!value || String(value).trim() === "") return null;

  const cleanValue = String(value).trim();

  if (/^\d{2}:\d{2}:\d{2}$/.test(cleanValue)) return cleanValue;

  if (/^\d{1,2}:\d{2}$/.test(cleanValue)) {
    const [hours, minutes] = cleanValue.split(":");
    return `${String(hours).padStart(2, "0")}:${minutes}:00`;
  }

  if (/^\d{1,2}:\d{2}:\d{2}$/.test(cleanValue)) {
    const [hours, minutes, seconds] = cleanValue.split(":");
    return `${String(hours).padStart(2, "0")}:${minutes}:${seconds}`;
  }

  return null;
};

const parseDurationToMinutes = (value) => {
  if (!value || String(value).trim() === "") return 0;

  const cleanValue = String(value).trim();

  if (/^\d{1,2}:\d{2}$/.test(cleanValue)) {
    const [hours, minutes] = cleanValue.split(":").map(Number);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;

    return hours * 60 + minutes;
  }

  if (/^\d{1,2}:\d{2}:\d{2}$/.test(cleanValue)) {
    const [hours, minutes] = cleanValue.split(":").map(Number);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;

    return hours * 60 + minutes;
  }

  const number = Number(cleanValue);

  return Number.isNaN(number) ? 0 : number;
};

const calculateTotalMinutes = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;

  const [inHour, inMinute] = checkIn.split(":").map(Number);
  const [outHour, outMinute] = checkOut.split(":").map(Number);

  if (
    Number.isNaN(inHour) ||
    Number.isNaN(inMinute) ||
    Number.isNaN(outHour) ||
    Number.isNaN(outMinute)
  ) {
    return 0;
  }

  const inMinutes = inHour * 60 + inMinute;
  const outMinutes = outHour * 60 + outMinute;

  return Math.max(outMinutes - inMinutes, 0);
};

const normalizeAttendanceStatus = (value) => {
  const cleanValue = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (!cleanValue) return "present";

  const mapped = {
    p: "present",
    present: "present",
    full_day: "present",
    fullday: "present",
    full: "present",
    a: "absent",
    absent: "absent",
    half_day: "half_day",
    halfday: "half_day",
    hd: "half_day",
    leave: "leave",
    l: "leave",
    holiday: "holiday",
    h: "holiday",
    late: "present",
  };

  return mapped[cleanValue] || "present";
};

const normalizeProjectStatus = (value) => {
  const cleanValue = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  const mapped = {
    todo: "not_started",
    to_do: "not_started",
    pending: "not_started",
    not_started: "not_started",
    started: "ongoing",
    progress: "ongoing",
    in_progress: "ongoing",
    ongoing: "ongoing",
    review: "under_review",
    under_review: "under_review",
    done: "completed",
    complete: "completed",
    completed: "completed",
    hold: "on_hold",
    on_hold: "on_hold",
    cancelled: "cancelled",
    canceled: "cancelled",
  };

  const finalStatus = mapped[cleanValue] || cleanValue;

  return PROJECT_STATUSES.includes(finalStatus) ? finalStatus : "not_started";
};

const normalizeTaskStatus = (value) => {
  const cleanValue = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  const mapped = {
    todo: "not_started",
    to_do: "not_started",
    pending: "not_started",
    not_started: "not_started",
    started: "in_progress",
    progress: "in_progress",
    ongoing: "in_progress",
    in_progress: "in_progress",
    done: "completed",
    complete: "completed",
    completed: "completed",
    blocked: "blocked",
  };

  const finalStatus = mapped[cleanValue] || cleanValue;

  return TASK_STATUSES.includes(finalStatus) ? finalStatus : "not_started";
};

const normalizePriority = (value) => {
  const cleanValue = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  return PRIORITIES.includes(cleanValue) ? cleanValue : "medium";
};

const normalizeProgress = (value) => {
  const number = Number(String(value || "0").replace("%", "").trim());

  if (Number.isNaN(number)) return 0;
  if (number < 0) return 0;
  if (number > 100) return 100;

  return Math.round(number);
};

const getOrCreateDepartmentId = async (departmentName) => {
  const cleanDepartmentName = cleanText(departmentName) || "General";

  const [existingRows] = await db.query(
    `
    SELECT department_id
    FROM departments
    WHERE LOWER(TRIM(department_name)) = LOWER(TRIM(?))
    LIMIT 1
    `,
    [cleanDepartmentName]
  );

  if (existingRows.length) return existingRows[0].department_id;

  const [insertResult] = await db.query(
    `
    INSERT INTO departments (department_name, description)
    VALUES (?, ?)
    `,
    [cleanDepartmentName, `${cleanDepartmentName} Department`]
  );

  return insertResult.insertId;
};

const getRoleIdByName = async (roleName) => {
  const cleanRoleName = String(roleName || "employee").trim().toLowerCase();

  const [rows] = await db.query(
    `
    SELECT role_id
    FROM roles
    WHERE role_name = ?
    LIMIT 1
    `,
    [cleanRoleName]
  );

  if (rows.length) return rows[0].role_id;

  const [employeeRows] = await db.query(
    `
    SELECT role_id
    FROM roles
    WHERE role_name = 'employee'
    LIMIT 1
    `
  );

  return employeeRows[0]?.role_id || 1;
};

const generateEmployeeCode = async (connectionOrDb = db) => {
  const [rows] = await connectionOrDb.query(
    `
    SELECT employee_code
    FROM users
    WHERE employee_code REGEXP '^EMP-[0-9]+$'
    ORDER BY CAST(SUBSTRING(employee_code, 5) AS UNSIGNED) DESC
    LIMIT 1
    `
  );

  let nextNumber = 1;

  if (rows.length && rows[0].employee_code) {
    const lastNumber = Number(
      String(rows[0].employee_code).replace("EMP-", "")
    );

    nextNumber = Number.isNaN(lastNumber) ? 1 : lastNumber + 1;
  }

  while (true) {
    const employeeCode = `EMP-${String(nextNumber).padStart(3, "0")}`;

    const [existingRows] = await connectionOrDb.query(
      `
      SELECT user_id
      FROM users
      WHERE employee_code = ?
      LIMIT 1
      `,
      [employeeCode]
    );

    if (!existingRows.length) {
      return employeeCode;
    }

    nextNumber += 1;
  }
};

const findUserByEmployeeCodeEmailOrName = async ({
  employeeCode,
  email,
  fullName,
}) => {
  const cleanEmployeeCode = cleanText(employeeCode);
  const cleanEmail = normalizeEmail(email);
  const cleanFullName = cleanText(fullName);

  if (cleanEmployeeCode) {
    const [codeRows] = await db.query(
      `
      SELECT user_id, full_name, email, employee_code
      FROM users
      WHERE TRIM(employee_code) = TRIM(?)
      AND status != 'deleted'
      LIMIT 1
      `,
      [cleanEmployeeCode]
    );

    if (codeRows.length) return codeRows[0];
  }

  if (cleanEmail) {
    const [emailRows] = await db.query(
      `
      SELECT user_id, full_name, email, employee_code
      FROM users
      WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))
      AND status != 'deleted'
      LIMIT 1
      `,
      [cleanEmail]
    );

    if (emailRows.length) return emailRows[0];
  }

  if (cleanFullName) {
    const [nameRows] = await db.query(
      `
      SELECT user_id, full_name, email, employee_code
      FROM users
      WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(?))
      AND status != 'deleted'
      ORDER BY user_id ASC
      LIMIT 1
      `,
      [cleanFullName]
    );

    if (nameRows.length) return nameRows[0];
  }

  return null;
};

const calculateProjectProgressFromTasks = async (projectId) => {
  const [taskRows] = await db.query(
    `
    SELECT
      task_id,
      parent_task_id,
      task_type,
      status,
      COALESCE(progress, 0) AS progress,
      COALESCE(is_checked, 0) AS is_checked
    FROM tasks
    WHERE project_id = ?
    `,
    [projectId]
  );

  if (!taskRows.length) {
    return {
      progress: 0,
      total_subtasks: 0,
      completed_subtasks: 0,
      computed_status: "not_started",
    };
  }

  const subtaskRows = taskRows.filter((task) => {
    return (
      task.task_type === "subtask" ||
      (task.parent_task_id !== null && Number(task.parent_task_id) !== 0)
    );
  });

  const calculationRows = subtaskRows.length > 0 ? subtaskRows : taskRows;

  const totalSubtasks = calculationRows.length;

  const completedSubtasks = calculationRows.filter((task) => {
    return (
      Number(task.is_checked) === 1 ||
      task.status === "completed" ||
      Number(task.progress) === 100
    );
  }).length;

  const progress =
    totalSubtasks > 0
      ? Math.round((completedSubtasks / totalSubtasks) * 100)
      : 0;

  let computedStatus = "not_started";

  if (totalSubtasks > 0) {
    if (completedSubtasks === 0) {
      computedStatus = "not_started";
    } else if (completedSubtasks < totalSubtasks) {
      computedStatus = "ongoing";
    } else {
      computedStatus = "under_review";
    }
  }

  return {
    progress,
    total_subtasks: totalSubtasks,
    completed_subtasks: completedSubtasks,
    computed_status: computedStatus,
  };
};

const getProjectSubtasks = async (projectIds) => {
  if (!projectIds.length) return [];

  const [rows] = await db.query(
    `
    SELECT
      task_id,
      project_id,
      parent_task_id,
      task_title,
      task_description,
      status,
      COALESCE(progress, 0) AS progress,
      COALESCE(is_checked, 0) AS is_checked,
      DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
      DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date
    FROM tasks
    WHERE project_id IN (?)
    AND (
      task_type = 'subtask'
      OR parent_task_id IS NOT NULL
    )
    ORDER BY start_date ASC, due_date ASC, created_at ASC
    `,
    [projectIds]
  );

  return rows;
};

const attachProgressToProjects = async (projects) => {
  const projectIds = projects.map((project) => project.project_id);
  const subtasks = await getProjectSubtasks(projectIds);

  const finalProjects = [];

  for (const project of projects) {
    const projectSubtasks = subtasks.filter(
      (subtask) => Number(subtask.project_id) === Number(project.project_id)
    );

    const totalSubtasks = projectSubtasks.length;

    const completedSubtasks = projectSubtasks.filter((subtask) => {
      return (
        Number(subtask.is_checked) === 1 ||
        subtask.status === "completed" ||
        Number(subtask.progress) === 100
      );
    }).length;

    let calculatedProgress = Number(project.overall_progress || 0);
    let calculatedStatus = project.status;

    if (totalSubtasks > 0) {
      calculatedProgress = Math.round((completedSubtasks / totalSubtasks) * 100);

      if (!["completed", "on_hold", "cancelled"].includes(project.status)) {
        if (completedSubtasks === 0) {
          calculatedStatus = "not_started";
        } else if (completedSubtasks < totalSubtasks) {
          calculatedStatus = "ongoing";
        } else {
          calculatedStatus = "under_review";
        }
      }

      await db.query(
        `
        UPDATE projects
        SET
          overall_progress = ?,
          status =
            CASE
              WHEN status IN ('completed', 'on_hold', 'cancelled') THEN status
              ELSE ?
            END
        WHERE project_id = ?
        `,
        [calculatedProgress, calculatedStatus, project.project_id]
      );
    }

    finalProjects.push({
      ...project,
      status: calculatedStatus,
      overall_progress: calculatedProgress,
      progress: calculatedProgress,
      computed_progress: calculatedProgress,
      total_subtasks: totalSubtasks,
      completed_subtasks: completedSubtasks,
      subtasks: projectSubtasks,
    });
  }

  return finalProjects;
};

const getAssignedProjectsForUser = async (userId) => {
  const [projects] = await db.query(
    `
    SELECT
      p.project_id,
      p.project_title,
      p.project_description,
      p.priority,
      p.status,
      COALESCE(p.overall_progress, 0) AS overall_progress,
      DATE_FORMAT(p.start_date, '%Y-%m-%d') AS start_date,
      DATE_FORMAT(p.due_date, '%Y-%m-%d') AS due_date,
      DATE_FORMAT(p.created_at, '%d %b %Y') AS created_date,
      d.department_name,
      creator.full_name AS created_by_name,
      creator.email AS created_by_email,
      GROUP_CONCAT(DISTINCT assigned.full_name SEPARATOR ', ') AS assigned_employees,
      GROUP_CONCAT(DISTINCT assigned.email SEPARATOR ', ') AS assigned_emails
    FROM projects p
    LEFT JOIN departments d ON d.department_id = p.department_id
    LEFT JOIN users creator ON creator.user_id = p.created_by_user_id
    LEFT JOIN project_assignments pa ON pa.project_id = p.project_id
    LEFT JOIN users assigned ON assigned.user_id = pa.employee_id
    WHERE
      EXISTS (
        SELECT 1
        FROM project_assignments pa2
        WHERE pa2.project_id = p.project_id
        AND pa2.employee_id = ?
      )
      OR EXISTS (
        SELECT 1
        FROM tasks t
        WHERE t.project_id = p.project_id
        AND t.assigned_to_user_id = ?
      )
    GROUP BY
      p.project_id,
      p.project_title,
      p.project_description,
      p.priority,
      p.status,
      p.overall_progress,
      p.start_date,
      p.due_date,
      p.created_at,
      d.department_name,
      creator.full_name,
      creator.email
    ORDER BY
      CASE
        WHEN p.status = 'not_started' THEN 1
        WHEN p.status = 'ongoing' THEN 2
        WHEN p.status = 'under_review' THEN 3
        WHEN p.status = 'completed' THEN 4
        WHEN p.status = 'on_hold' THEN 5
        ELSE 6
      END,
      p.created_at DESC
    `,
    [userId, userId]
  );

  return attachProgressToProjects(projects);
};

const getAllProjectsWithProgress = async () => {
  const [projects] = await db.query(
    `
    SELECT
      p.project_id,
      p.project_title,
      p.project_description,
      p.priority,
      p.status,
      COALESCE(p.overall_progress, 0) AS overall_progress,
      DATE_FORMAT(p.start_date, '%Y-%m-%d') AS start_date,
      DATE_FORMAT(p.due_date, '%Y-%m-%d') AS due_date,
      DATE_FORMAT(p.created_at, '%d %b %Y') AS created_date,
      d.department_name,
      creator.full_name AS created_by_name,
      creator.email AS created_by_email,
      COUNT(DISTINCT pa.employee_id) AS assigned_employee_count,
      GROUP_CONCAT(DISTINCT assigned.full_name SEPARATOR ', ') AS assigned_employees,
      GROUP_CONCAT(DISTINCT assigned.email SEPARATOR ', ') AS assigned_emails
    FROM projects p
    LEFT JOIN departments d ON d.department_id = p.department_id
    LEFT JOIN users creator ON creator.user_id = p.created_by_user_id
    LEFT JOIN project_assignments pa ON pa.project_id = p.project_id
    LEFT JOIN users assigned ON assigned.user_id = pa.employee_id
    GROUP BY
      p.project_id,
      p.project_title,
      p.project_description,
      p.priority,
      p.status,
      p.overall_progress,
      p.start_date,
      p.due_date,
      p.created_at,
      d.department_name,
      creator.full_name,
      creator.email
    ORDER BY p.created_at DESC
    `
  );

  return attachProgressToProjects(projects);
};

const getAdministratorOverview = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [profileRows] = await db.query(
      `
      SELECT
        u.user_id,
        u.full_name,
        u.email,
        u.employee_code,
        u.phone,
        u.designation,
        u.status,
        r.role_name,
        d.department_name,
        ep.skills
      FROM users u
      JOIN roles r ON r.role_id = u.role_id
      LEFT JOIN departments d ON d.department_id = u.department_id
      LEFT JOIN employee_profiles ep ON ep.user_id = u.user_id
      WHERE u.user_id = ?
      LIMIT 1
      `,
      [userId]
    );

    const profile = profileRows[0] || null;

    const assignedProjects = await getAssignedProjectsForUser(userId);

    const [totalUsersRows] = await db.query(
      `
      SELECT COUNT(*) AS total_users
      FROM users
      WHERE status != 'deleted'
      `
    );

    const [totalProjectsRows] = await db.query(
      `
      SELECT COUNT(*) AS total_projects
      FROM projects
      `
    );

    const [myTasksRows] = await db.query(
      `
      SELECT
        COUNT(*) AS my_tasks,
        SUM(CASE WHEN status = 'not_started' THEN 1 ELSE 0 END) AS todo_tasks,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_tasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_tasks,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked_tasks
      FROM tasks
      WHERE assigned_to_user_id = ?
      AND (parent_task_id IS NULL OR parent_task_id = 0)
      AND (task_type IS NULL OR task_type != 'subtask')
      `,
      [userId]
    );

    const myTaskStats = myTasksRows[0] || {};

    const myProjectStats = {
      total: assignedProjects.length,
      todo: assignedProjects.filter(
        (project) => project.status === "not_started"
      ).length,
      ongoing: assignedProjects.filter((project) => project.status === "ongoing")
        .length,
      under_review: assignedProjects.filter(
        (project) => project.status === "under_review"
      ).length,
      completed: assignedProjects.filter(
        (project) => project.status === "completed"
      ).length,
    };

    const activeProject =
      assignedProjects.find(
        (project) =>
          project.status !== "completed" && project.status !== "cancelled"
      ) || null;

    const [recentTasks] = await db.query(
      `
      SELECT
        t.task_id,
        t.task_title,
        t.task_description,
        t.status,
        t.priority,
        COALESCE(t.progress, 0) AS progress,
        DATE_FORMAT(t.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date,
        p.project_title
      FROM tasks t
      LEFT JOIN projects p ON p.project_id = t.project_id
      WHERE t.assigned_to_user_id = ?
      AND (t.parent_task_id IS NULL OR t.parent_task_id = 0)
      AND (t.task_type IS NULL OR t.task_type != 'subtask')
      ORDER BY t.created_at DESC
      LIMIT 5
      `,
      [userId]
    );

    const getWeekRange = (baseDate) => {
      const date = new Date(baseDate);
      date.setHours(0, 0, 0, 0);

      const currentDay = date.getDay();
      const mondayDiff = currentDay === 0 ? -6 : 1 - currentDay;

      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() + mondayDiff);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      return {
        weekStart,
        weekEnd,
        weekStartDate: normalizeDateForMySQL(weekStart),
        weekEndDate: normalizeDateForMySQL(weekEnd),
      };
    };

    let weekRange = getWeekRange(new Date());

    let [weeklyAttendanceRows] = await db.query(
      `
      SELECT
        DATE_FORMAT(attendance_date, '%Y-%m-%d') AS attendance_date,
        status,
        check_in_time,
        check_out_time,
        total_minutes,
        remarks
      FROM attendance
      WHERE employee_id = ?
      AND attendance_date BETWEEN ? AND ?
      ORDER BY attendance_date ASC
      `,
      [userId, weekRange.weekStartDate, weekRange.weekEndDate]
    );

    let weeklyAttendanceSource = "current_week";

    if (weeklyAttendanceRows.length === 0) {
      const [latestAttendanceRows] = await db.query(
        `
        SELECT DATE_FORMAT(MAX(attendance_date), '%Y-%m-%d') AS latest_attendance_date
        FROM attendance
        WHERE employee_id = ?
        `,
        [userId]
      );

      const latestAttendanceDate =
        latestAttendanceRows[0]?.latest_attendance_date;

      if (latestAttendanceDate) {
        weekRange = getWeekRange(`${latestAttendanceDate}T00:00:00`);

        const [latestWeekRows] = await db.query(
          `
          SELECT
            DATE_FORMAT(attendance_date, '%Y-%m-%d') AS attendance_date,
            status,
            check_in_time,
            check_out_time,
            total_minutes,
            remarks
          FROM attendance
          WHERE employee_id = ?
          AND attendance_date BETWEEN ? AND ?
          ORDER BY attendance_date ASC
          `,
          [userId, weekRange.weekStartDate, weekRange.weekEndDate]
        );

        weeklyAttendanceRows = latestWeekRows;
        weeklyAttendanceSource = "latest_available_week";
      }
    }

    const weeklyAttendanceMap = {};

    weeklyAttendanceRows.forEach((row) => {
      weeklyAttendanceMap[row.attendance_date] = row;
    });

    const weeklyAttendance = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekRange.weekStart);
      date.setDate(weekRange.weekStart.getDate() + i);

      const dateKey = normalizeDateForMySQL(date);
      const attendanceRecord = weeklyAttendanceMap[dateKey];

      weeklyAttendance.push({
        date: dateKey,
        day_name: date.toLocaleDateString("en-US", { weekday: "short" }),
        display_date: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        status: attendanceRecord?.status || "not_marked",
        check_in_time: attendanceRecord?.check_in_time || null,
        check_out_time: attendanceRecord?.check_out_time || null,
        total_minutes: attendanceRecord?.total_minutes || 0,
        remarks: attendanceRecord?.remarks || null,
      });
    }

    const [activityLogs] = await db.query(
      `
      SELECT
        al.log_id,
        al.action_type,
        al.entity_type,
        al.entity_id,
        al.description,
        DATE_FORMAT(al.created_at, '%d %b %Y %h:%i %p') AS created_date,
        u.full_name AS user_name
      FROM activity_logs al
      LEFT JOIN users u ON u.user_id = al.user_id
      ORDER BY al.created_at DESC
      LIMIT 8
      `
    );

    const [projectSplitRows] = await db.query(
      `
      SELECT status, COUNT(*) AS count
      FROM projects
      GROUP BY status
      `
    );

    return res.json({
      success: true,
      profile,
      stats: {
        total_users: totalUsersRows[0].total_users || 0,
        total_projects: totalProjectsRows[0].total_projects || 0,
        my_projects: assignedProjects.length,
        my_tasks: myTaskStats.my_tasks || 0,
      },
      my_project_stats: myProjectStats,
      my_task_stats: {
        total: myTaskStats.my_tasks || 0,
        todo: myTaskStats.todo_tasks || 0,
        in_progress: myTaskStats.in_progress_tasks || 0,
        completed: myTaskStats.completed_tasks || 0,
        blocked: myTaskStats.blocked_tasks || 0,
      },
      active_project: activeProject,
      assigned_projects: assignedProjects,
      recent_projects: assignedProjects.slice(0, 5),
      recent_tasks: recentTasks,
      task_overview: [
        { name: "Total", value: myTaskStats.my_tasks || 0 },
        { name: "Progress", value: myTaskStats.in_progress_tasks || 0 },
        { name: "Completed", value: myTaskStats.completed_tasks || 0 },
      ],
      project_split: projectSplitRows,
      weekly_attendance: weeklyAttendance,
      weekly_attendance_source: weeklyAttendanceSource,
      weekly_attendance_range: {
        start_date: weekRange.weekStartDate,
        end_date: weekRange.weekEndDate,
      },
      activity_logs: activityLogs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load administrator overview.",
      error: error.message,
    });
  }
};

const getAdministratorMyProjects = async (req, res) => {
  try {
    const projects = await getAssignedProjectsForUser(req.user.user_id);

    return res.json({
      success: true,
      projects,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch administrator assigned projects.",
      error: error.message,
    });
  }
};

const getAdministratorAllProjects = async (req, res) => {
  try {
    const projects = await getAllProjectsWithProgress();

    return res.json({
      success: true,
      projects,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch all projects.",
      error: error.message,
    });
  }
};

const exportAdministratorProjectsCsv = async (req, res) => {
  try {
    const projects = await getAllProjectsWithProgress();

    const headers = [
      "project_title",
      "project_description",
      "priority",
      "status",
      "start_date",
      "due_date",
      "overall_progress",
      "department_name",
      "created_by_email",
      "assigned_employees",
      "assigned_emails",
    ];

    const rows = projects.map((project) => [
      project.project_title,
      project.project_description,
      project.priority,
      project.status,
      project.start_date,
      project.due_date,
      project.overall_progress,
      project.department_name,
      project.created_by_email,
      project.assigned_employees,
      project.assigned_emails,
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map(escapeCsvValue).join(",")),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=valencia-rms-projects.csv"
    );

    return res.send(csv);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to export projects.",
      error: error.message,
    });
  }
};

const importAdministratorProjectsCsv = async (req, res) => {
  const connection = await db.getConnection();

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "CSV/Excel file is required.",
      });
    }

    const rows = parseUploadedFileRows(req.file);

    let importedRows = 0;
    let skippedRows = 0;

    await connection.beginTransaction();

    for (const row of rows) {
      const projectTitle = getValue(row, [
        "project_title",
        "Project Title",
        "title",
        "Title",
      ]);

      if (!projectTitle) {
        skippedRows += 1;
        continue;
      }

      const projectDescription = getValue(row, [
        "project_description",
        "Project Description",
        "description",
        "Description",
      ]);

      const departmentName =
        getValue(row, ["department_name", "Department", "department"]) ||
        "General";

      const startDate = normalizeDateForMySQL(
        getValue(row, ["start_date", "Start Date", "start"])
      );

      const dueDate = normalizeDateForMySQL(
        getValue(row, ["due_date", "Due Date", "end_date", "End Date", "end"])
      );

      const priority = normalizePriority(getValue(row, ["priority", "Priority"]));

      const status = normalizeProjectStatus(getValue(row, ["status", "Status"]));

      const progress = normalizeProgress(
        getValue(row, [
          "overall_progress",
          "progress",
          "Progress",
          "employee_progress",
        ])
      );

      const assignedEmployeeEmail = getValue(row, [
        "assigned_employee_email",
        "Assigned Employee Email",
        "assigned_to_email",
        "employee_email",
      ]);

      const assignedEmployeeName = getValue(row, [
        "assigned_employee_name",
        "Assigned Employee Name",
        "employee_name",
        "assigned_to_name",
      ]);

      const departmentId = await getOrCreateDepartmentId(departmentName);

      const [projectResult] = await connection.query(
        `
        INSERT INTO projects (
          department_id,
          created_by_user_id,
          project_title,
          project_description,
          priority,
          status,
          start_date,
          due_date,
          overall_progress
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          departmentId,
          req.user.user_id,
          projectTitle,
          projectDescription || null,
          priority,
          status,
          startDate,
          dueDate,
          progress,
        ]
      );

      const projectId = projectResult.insertId;

      const assignedEmployee = await findUserByEmployeeCodeEmailOrName({
        employeeCode: "",
        email: assignedEmployeeEmail,
        fullName: assignedEmployeeName,
      });

      if (assignedEmployee) {
        await connection.query(
          `
          INSERT IGNORE INTO project_assignments (
            project_id,
            employee_id,
            assigned_by_user_id,
            employee_progress
          )
          VALUES (?, ?, ?, ?)
          `,
          [projectId, assignedEmployee.user_id, req.user.user_id, progress]
        );
      }

      importedRows += 1;
    }

    await connection.commit();

    return res.json({
      success: true,
      message: "Projects imported successfully.",
      importedRows,
      skippedRows,
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      success: false,
      message: "Failed to import projects.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

const getAdministratorMyTasks = async (req, res) => {
  try {
    const [tasks] = await db.query(
      `
      SELECT
        t.task_id,
        t.project_id,
        t.task_title,
        t.task_description,
        t.task_type,
        t.priority,
        t.status,
        COALESCE(t.progress, 0) AS progress,
        DATE_FORMAT(t.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date,
        DATE_FORMAT(t.completed_at, '%Y-%m-%d') AS completed_at,
        DATE_FORMAT(t.created_at, '%d %b %Y') AS created_date,
        p.project_title,
        p.division,
        p.status AS project_status,
        assigned.full_name AS assigned_to_name,
        assigned.email AS assigned_to_email,
        creator.full_name AS created_by_name,
        creator.email AS created_by_email
      FROM tasks t
      LEFT JOIN projects p ON p.project_id = t.project_id
      LEFT JOIN users assigned ON assigned.user_id = t.assigned_to_user_id
      LEFT JOIN users creator ON creator.user_id = t.created_by_user_id
      WHERE t.assigned_to_user_id = ?
      AND (t.parent_task_id IS NULL OR t.parent_task_id = 0)
      AND (t.task_type IS NULL OR t.task_type != 'subtask')
      ORDER BY t.created_at DESC
      `,
      [req.user.user_id]
    );

    return res.json({
      success: true,
      tasks,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch my tasks.",
      error: error.message,
    });
  }
};

const getAdministratorAllTasks = async (req, res) => {
  try {
    const [tasks] = await db.query(
      `
      SELECT
        t.task_id,
        t.project_id,
        t.task_title,
        t.task_description,
        t.task_type,
        t.priority,
        t.status,
        COALESCE(t.progress, 0) AS progress,
        DATE_FORMAT(t.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date,
        DATE_FORMAT(t.completed_at, '%Y-%m-%d') AS completed_at,
        DATE_FORMAT(t.created_at, '%d %b %Y') AS created_date,
        p.project_title,
        p.division,
        p.status AS project_status,
        assigned.full_name AS assigned_to_name,
        assigned.email AS assigned_to_email,
        creator.full_name AS created_by_name,
        creator.email AS created_by_email
      FROM tasks t
      LEFT JOIN projects p ON p.project_id = t.project_id
      LEFT JOIN users assigned ON assigned.user_id = t.assigned_to_user_id
      LEFT JOIN users creator ON creator.user_id = t.created_by_user_id
      WHERE (t.parent_task_id IS NULL OR t.parent_task_id = 0)
      AND (t.task_type IS NULL OR t.task_type != 'subtask')
      ORDER BY t.created_at DESC
      `
    );

    return res.json({
      success: true,
      tasks,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch all tasks.",
      error: error.message,
    });
  }
};

const exportAdministratorTasksCsv = async (req, res) => {
  try {
    const [tasks] = await db.query(
      `
      SELECT
        t.task_title,
        t.task_description,
        t.priority,
        t.status,
        t.progress,
        DATE_FORMAT(t.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date,
        p.project_title,
        assigned.email AS assigned_to_email,
        creator.email AS created_by_email
      FROM tasks t
      LEFT JOIN projects p ON p.project_id = t.project_id
      LEFT JOIN users assigned ON assigned.user_id = t.assigned_to_user_id
      LEFT JOIN users creator ON creator.user_id = t.created_by_user_id
      WHERE (t.parent_task_id IS NULL OR t.parent_task_id = 0)
      AND (t.task_type IS NULL OR t.task_type != 'subtask')
      ORDER BY t.created_at DESC
      `
    );

    const headers = [
      "task_title",
      "task_description",
      "priority",
      "status",
      "progress",
      "start_date",
      "due_date",
      "project_title",
      "assigned_to_email",
      "created_by_email",
    ];

    const rows = tasks.map((task) =>
      headers.map((header) => escapeCsvValue(task[header]))
    );

    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join(
      "\n"
    );

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=valencia-rms-tasks.csv"
    );

    return res.send(csv);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to export tasks.",
      error: error.message,
    });
  }
};

const importAdministratorTasksCsv = async (req, res) => {
  const connection = await db.getConnection();

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "CSV/Excel file is required.",
      });
    }

    const rows = parseUploadedFileRows(req.file);

    let importedRows = 0;
    let skippedRows = 0;

    await connection.beginTransaction();

    for (const row of rows) {
      const taskTitle = getValue(row, ["task_title", "Task Title", "title"]);

      const projectTitle = getValue(row, [
        "project_title",
        "Project Title",
        "project",
      ]);

      const assignedEmail = getValue(row, [
        "assigned_to_email",
        "assigned_employee_email",
        "employee_email",
      ]);

      const assignedName = getValue(row, [
        "assigned_to_name",
        "assigned_employee_name",
        "employee_name",
      ]);

      if (!taskTitle || !projectTitle) {
        skippedRows += 1;
        continue;
      }

      const [projectRows] = await connection.query(
        `
        SELECT project_id
        FROM projects
        WHERE LOWER(project_title) = LOWER(?)
        ORDER BY project_id DESC
        LIMIT 1
        `,
        [projectTitle]
      );

      if (!projectRows.length) {
        skippedRows += 1;
        continue;
      }

      const assignedUser = await findUserByEmployeeCodeEmailOrName({
        employeeCode: "",
        email: assignedEmail,
        fullName: assignedName,
      });

      await connection.query(
        `
        INSERT INTO tasks (
          project_id,
          created_by_user_id,
          assigned_to_user_id,
          task_title,
          task_description,
          task_type,
          priority,
          status,
          progress,
          start_date,
          due_date
        )
        VALUES (?, ?, ?, ?, ?, 'main', ?, ?, ?, ?, ?)
        `,
        [
          projectRows[0].project_id,
          req.user.user_id,
          assignedUser?.user_id || req.user.user_id,
          taskTitle,
          getValue(row, ["task_description", "Task Description", "description"]) ||
            null,
          normalizePriority(getValue(row, ["priority", "Priority"])),
          normalizeTaskStatus(getValue(row, ["status", "Status"])),
          normalizeProgress(getValue(row, ["progress", "Progress"])),
          normalizeDateForMySQL(getValue(row, ["start_date", "Start Date"])),
          normalizeDateForMySQL(getValue(row, ["due_date", "Due Date"])),
        ]
      );

      importedRows += 1;
    }

    await connection.commit();

    return res.json({
      success: true,
      message: "Tasks imported successfully.",
      importedRows,
      skippedRows,
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      success: false,
      message: "Failed to import tasks.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

const getAdministratorReports = async (req, res) => {
  try {
    const {
      from_date = "",
      to_date = "",
      department_id = "",
      user_id = "",
      project_id = "",
      project_status = "",
      task_status = "",
    } = req.query;

    const cleanFromDate = normalizeDateForMySQL(from_date);
    const cleanToDate = normalizeDateForMySQL(to_date);

    const projectWhere = ["1 = 1"];
    const projectParams = [];

    if (cleanFromDate) {
      projectWhere.push("DATE(COALESCE(p.start_date, p.created_at)) >= ?");
      projectParams.push(cleanFromDate);
    }

    if (cleanToDate) {
      projectWhere.push("DATE(COALESCE(p.due_date, p.created_at)) <= ?");
      projectParams.push(cleanToDate);
    }

    if (department_id) {
      projectWhere.push("p.department_id = ?");
      projectParams.push(Number(department_id));
    }

    if (user_id) {
      projectWhere.push(`
        (
          p.created_by_user_id = ?
          OR EXISTS (
            SELECT 1
            FROM project_assignments pa_filter
            WHERE pa_filter.project_id = p.project_id
              AND pa_filter.employee_id = ?
          )
          OR EXISTS (
            SELECT 1
            FROM tasks t_filter
            WHERE t_filter.project_id = p.project_id
              AND t_filter.assigned_to_user_id = ?
          )
        )
      `);

      const selectedUserId = Number(user_id);
      projectParams.push(
        selectedUserId,
        selectedUserId,
        selectedUserId
      );
    }

    if (project_id) {
      projectWhere.push("p.project_id = ?");
      projectParams.push(Number(project_id));
    }

    if (project_status) {
      projectWhere.push("LOWER(p.status) = LOWER(?)");
      projectParams.push(String(project_status));
    }

    const taskWhere = ["1 = 1"];
    const taskParams = [];

    if (cleanFromDate) {
      taskWhere.push("DATE(COALESCE(t.start_date, t.created_at)) >= ?");
      taskParams.push(cleanFromDate);
    }

    if (cleanToDate) {
      taskWhere.push("DATE(COALESCE(t.due_date, t.created_at)) <= ?");
      taskParams.push(cleanToDate);
    }

    if (department_id) {
      taskWhere.push("COALESCE(p.department_id, assigned.department_id) = ?");
      taskParams.push(Number(department_id));
    }

    if (user_id) {
      taskWhere.push(
        "(t.assigned_to_user_id = ? OR t.created_by_user_id = ?)"
      );

      taskParams.push(Number(user_id), Number(user_id));
    }

    if (project_id) {
      taskWhere.push("t.project_id = ?");
      taskParams.push(Number(project_id));
    }

    if (project_status) {
      taskWhere.push("LOWER(p.status) = LOWER(?)");
      taskParams.push(String(project_status));
    }

    if (task_status) {
      taskWhere.push("LOWER(t.status) = LOWER(?)");
      taskParams.push(String(task_status));
    }

    const userWhere = [
      "COALESCE(u.status, 'active') != 'deleted'",
    ];
    const userParams = [];

    if (department_id) {
      userWhere.push("u.department_id = ?");
      userParams.push(Number(department_id));
    }

    if (user_id) {
      userWhere.push("u.user_id = ?");
      userParams.push(Number(user_id));
    }

    const [departmentOptions] = await db.query(`
      SELECT
        department_id,
        department_name
      FROM departments
      ORDER BY department_name ASC
    `);

    const [userOptions] = await db.query(`
      SELECT
        u.user_id,
        u.full_name,
        u.email,
        u.department_id,
        d.department_name,
        r.role_name
      FROM users u
      JOIN roles r
        ON r.role_id = u.role_id
      LEFT JOIN departments d
        ON d.department_id = u.department_id
      WHERE COALESCE(u.status, 'active') != 'deleted'
      ORDER BY u.full_name ASC
    `);

    const [projectOptions] = await db.query(`
      SELECT
        project_id,
        project_title,
        department_id,
        status
      FROM projects
      ORDER BY project_title ASC
    `);

    const [userSummaryRows] = await db.query(
      `
      SELECT
        COUNT(*) AS total_users,
        SUM(CASE WHEN LOWER(r.role_name) = 'employee' THEN 1 ELSE 0 END)
          AS total_employees,
        SUM(CASE WHEN LOWER(r.role_name) = 'admin' THEN 1 ELSE 0 END)
          AS total_admins,
        SUM(CASE WHEN LOWER(r.role_name) = 'administrator' THEN 1 ELSE 0 END)
          AS total_administrators
      FROM users u
      JOIN roles r
        ON r.role_id = u.role_id
      WHERE ${userWhere.join(" AND ")}
      `,
      userParams
    );

    const [projectSummaryRows] = await db.query(
      `
      SELECT
        COUNT(*) AS total_projects,
        SUM(CASE WHEN LOWER(p.status) = 'completed' THEN 1 ELSE 0 END)
          AS completed_projects,
        SUM(CASE WHEN LOWER(p.status) = 'under_review' THEN 1 ELSE 0 END)
          AS under_review_projects,
        SUM(CASE WHEN LOWER(p.status) = 'ongoing' THEN 1 ELSE 0 END)
          AS in_progress_projects,
        SUM(CASE WHEN LOWER(p.status) = 'on_hold' THEN 1 ELSE 0 END)
          AS on_hold_projects,
        SUM(CASE WHEN LOWER(p.status) = 'cancelled' THEN 1 ELSE 0 END)
          AS cancelled_projects,
        SUM(
          CASE
            WHEN p.due_date IS NOT NULL
              AND DATE(p.due_date) < CURDATE()
              AND LOWER(p.status) NOT IN ('completed', 'cancelled')
            THEN 1
            ELSE 0
          END
        ) AS overdue_projects,
        ROUND(AVG(COALESCE(p.overall_progress, 0)))
          AS average_project_progress
      FROM projects p
      WHERE ${projectWhere.join(" AND ")}
      `,
      projectParams
    );

    const [taskSummaryRows] = await db.query(
      `
      SELECT
        COUNT(*) AS total_tasks,
        SUM(CASE WHEN LOWER(t.status) = 'completed' THEN 1 ELSE 0 END)
          AS completed_tasks,
        SUM(CASE WHEN LOWER(t.status) = 'in_progress' THEN 1 ELSE 0 END)
          AS in_progress_tasks,
        SUM(CASE WHEN LOWER(t.status) = 'not_started' THEN 1 ELSE 0 END)
          AS pending_tasks,
        SUM(CASE WHEN LOWER(t.status) = 'blocked' THEN 1 ELSE 0 END)
          AS blocked_tasks,
        SUM(CASE WHEN t.assigned_to_user_id IS NULL THEN 1 ELSE 0 END)
          AS unassigned_tasks,
        SUM(
          CASE
            WHEN t.due_date IS NOT NULL
              AND DATE(t.due_date) < CURDATE()
              AND LOWER(t.status) != 'completed'
            THEN 1
            ELSE 0
          END
        ) AS overdue_tasks,
        ROUND(AVG(COALESCE(t.progress, 0)))
          AS average_task_progress
      FROM tasks t
      LEFT JOIN projects p
        ON p.project_id = t.project_id
      LEFT JOIN users assigned
        ON assigned.user_id = t.assigned_to_user_id
      WHERE ${taskWhere.join(" AND ")}
      `,
      taskParams
    );

    const [projectStatusRows] = await db.query(
      `
      SELECT
        CASE
          WHEN LOWER(p.status) = 'not_started' THEN 'To Do'
          WHEN LOWER(p.status) = 'ongoing' THEN 'In Progress'
          WHEN LOWER(p.status) = 'under_review' THEN 'Under Review'
          WHEN LOWER(p.status) = 'completed' THEN 'Completed'
          WHEN LOWER(p.status) = 'on_hold' THEN 'On Hold'
          WHEN LOWER(p.status) = 'cancelled' THEN 'Cancelled'
          ELSE COALESCE(p.status, 'Unknown')
        END AS name,
        COUNT(*) AS value
      FROM projects p
      WHERE ${projectWhere.join(" AND ")}
      GROUP BY
        CASE
          WHEN LOWER(p.status) = 'not_started' THEN 'To Do'
          WHEN LOWER(p.status) = 'ongoing' THEN 'In Progress'
          WHEN LOWER(p.status) = 'under_review' THEN 'Under Review'
          WHEN LOWER(p.status) = 'completed' THEN 'Completed'
          WHEN LOWER(p.status) = 'on_hold' THEN 'On Hold'
          WHEN LOWER(p.status) = 'cancelled' THEN 'Cancelled'
          ELSE COALESCE(p.status, 'Unknown')
        END
      ORDER BY value DESC
      `,
      projectParams
    );

    const [taskStatusRows] = await db.query(
      `
      SELECT
        CASE
          WHEN LOWER(t.status) = 'not_started' THEN 'To Do'
          WHEN LOWER(t.status) = 'in_progress' THEN 'In Progress'
          WHEN LOWER(t.status) = 'completed' THEN 'Completed'
          WHEN LOWER(t.status) = 'blocked' THEN 'Blocked'
          ELSE COALESCE(t.status, 'Unknown')
        END AS name,
        COUNT(*) AS value
      FROM tasks t
      LEFT JOIN projects p
        ON p.project_id = t.project_id
      LEFT JOIN users assigned
        ON assigned.user_id = t.assigned_to_user_id
      WHERE ${taskWhere.join(" AND ")}
      GROUP BY
        CASE
          WHEN LOWER(t.status) = 'not_started' THEN 'To Do'
          WHEN LOWER(t.status) = 'in_progress' THEN 'In Progress'
          WHEN LOWER(t.status) = 'completed' THEN 'Completed'
          WHEN LOWER(t.status) = 'blocked' THEN 'Blocked'
          ELSE COALESCE(t.status, 'Unknown')
        END
      ORDER BY value DESC
      `,
      taskParams
    );

    const [projectProgressRows] = await db.query(
      `
      SELECT
        p.project_id,
        p.project_title AS name,
        p.status,
        COALESCE(p.overall_progress, 0) AS progress,
        d.department_name,
        DATE_FORMAT(p.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(p.due_date, '%Y-%m-%d') AS due_date,
        COUNT(DISTINCT t.task_id) AS total_tasks
      FROM projects p
      LEFT JOIN departments d
        ON d.department_id = p.department_id
      LEFT JOIN tasks t
        ON t.project_id = p.project_id
      WHERE ${projectWhere.join(" AND ")}
      GROUP BY
        p.project_id,
        p.project_title,
        p.status,
        p.overall_progress,
        d.department_name,
        p.start_date,
        p.due_date
      ORDER BY progress DESC, p.project_title ASC
      `,
      projectParams
    );

    const employeeJoinParams = [
      ...(cleanFromDate ? [cleanFromDate] : []),
      ...(cleanToDate ? [cleanToDate] : []),
      ...(project_id ? [Number(project_id)] : []),
      ...(project_status ? [String(project_status)] : []),
      ...(task_status ? [String(task_status)] : []),
    ];

    const [employeeAnalysisRows] = await db.query(
      `
      SELECT
        u.user_id,
        u.full_name AS name,
        u.email,
        d.department_name,
        r.role_name,
        COUNT(DISTINCT t.task_id) AS total_tasks,
        SUM(CASE WHEN LOWER(t.status) = 'completed' THEN 1 ELSE 0 END)
          AS completed_tasks,
        SUM(CASE WHEN LOWER(t.status) = 'blocked' THEN 1 ELSE 0 END)
          AS blocked_tasks,
        SUM(
          CASE
            WHEN t.due_date IS NOT NULL
              AND DATE(t.due_date) < CURDATE()
              AND LOWER(t.status) != 'completed'
            THEN 1
            ELSE 0
          END
        ) AS overdue_tasks,
        ROUND(AVG(COALESCE(t.progress, 0))) AS average_progress,
        CASE
          WHEN COUNT(DISTINCT t.task_id) = 0 THEN 0
          ELSE ROUND(
            (
              SUM(CASE WHEN LOWER(t.status) = 'completed' THEN 1 ELSE 0 END)
              / COUNT(DISTINCT t.task_id)
            ) * 100
          )
        END AS completion_rate
      FROM users u
      JOIN roles r
        ON r.role_id = u.role_id
      LEFT JOIN departments d
        ON d.department_id = u.department_id
      LEFT JOIN tasks t
        ON t.assigned_to_user_id = u.user_id
        ${cleanFromDate
          ? "AND DATE(COALESCE(t.start_date, t.created_at)) >= ?"
          : ""}
        ${cleanToDate
          ? "AND DATE(COALESCE(t.due_date, t.created_at)) <= ?"
          : ""}
        ${project_id ? "AND t.project_id = ?" : ""}
        ${project_status
          ? "AND EXISTS (SELECT 1 FROM projects p_employee WHERE p_employee.project_id = t.project_id AND LOWER(p_employee.status) = LOWER(?))"
          : ""}
        ${task_status ? "AND LOWER(t.status) = LOWER(?)" : ""}
      WHERE ${userWhere.join(" AND ")}
      GROUP BY
        u.user_id,
        u.full_name,
        u.email,
        d.department_name,
        r.role_name
      ORDER BY
        total_tasks DESC,
        average_progress DESC,
        u.full_name ASC
      `,
      [...employeeJoinParams, ...userParams]
    );

    const departmentParams = [
      ...(cleanFromDate ? [cleanFromDate] : []),
      ...(cleanToDate ? [cleanToDate] : []),
      ...(project_status ? [String(project_status)] : []),
      ...(task_status ? [String(task_status)] : []),
      ...(department_id ? [Number(department_id)] : []),
    ];

    const [departmentAnalysisRows] = await db.query(
      `
      SELECT
        d.department_id,
        d.department_name AS name,
        COUNT(DISTINCT u.user_id) AS total_users,
        COUNT(
          DISTINCT CASE
            WHEN LOWER(r.role_name) = 'employee' THEN u.user_id
          END
        ) AS total_employees,
        COUNT(
          DISTINCT CASE
            WHEN LOWER(r.role_name) = 'admin' THEN u.user_id
          END
        ) AS total_admins,
        COUNT(DISTINCT p.project_id) AS total_projects,
        COUNT(DISTINCT t.task_id) AS total_tasks,
        ROUND(AVG(DISTINCT COALESCE(p.overall_progress, 0)))
          AS average_project_progress,
        ROUND(AVG(COALESCE(t.progress, 0)))
          AS average_task_progress
      FROM departments d
      LEFT JOIN users u
        ON u.department_id = d.department_id
        AND COALESCE(u.status, 'active') != 'deleted'
      LEFT JOIN roles r
        ON r.role_id = u.role_id
      LEFT JOIN projects p
        ON p.department_id = d.department_id
        ${cleanFromDate
          ? "AND DATE(COALESCE(p.start_date, p.created_at)) >= ?"
          : ""}
        ${cleanToDate
          ? "AND DATE(COALESCE(p.due_date, p.created_at)) <= ?"
          : ""}
        ${project_status
          ? "AND LOWER(p.status) = LOWER(?)"
          : ""}
      LEFT JOIN tasks t
        ON t.project_id = p.project_id
        ${task_status
          ? "AND LOWER(t.status) = LOWER(?)"
          : ""}
      WHERE 1 = 1
        ${department_id
          ? "AND d.department_id = ?"
          : ""}
      GROUP BY d.department_id, d.department_name
      ORDER BY total_tasks DESC, total_projects DESC, d.department_name ASC
      `,
      departmentParams
    );

    const usersSummary = userSummaryRows[0] || {};
    const projectsSummary = projectSummaryRows[0] || {};
    const tasksSummary = taskSummaryRows[0] || {};

    const averageProjectProgress = Number(
      projectsSummary.average_project_progress || 0
    );

    const averageTaskProgress = Number(
      tasksSummary.average_task_progress || 0
    );

    const progressParts = [];

    if (Number(projectsSummary.total_projects || 0) > 0) {
      progressParts.push(averageProjectProgress);
    }

    if (Number(tasksSummary.total_tasks || 0) > 0) {
      progressParts.push(averageTaskProgress);
    }

    const overallProgress = progressParts.length
      ? Math.round(
          progressParts.reduce((sum, value) => sum + value, 0) /
            progressParts.length
        )
      : 0;

    return res.json({
      success: true,

      filters: {
        departments: departmentOptions,
        users: userOptions,
        projects: projectOptions,
        project_statuses: PROJECT_STATUSES,
        task_statuses: TASK_STATUSES,
      },

      summary: {
        total_users: Number(usersSummary.total_users || 0),
        total_employees: Number(usersSummary.total_employees || 0),
        total_admins: Number(usersSummary.total_admins || 0),
        total_administrators: Number(
          usersSummary.total_administrators || 0
        ),

        total_projects: Number(projectsSummary.total_projects || 0),
        completed_projects: Number(
          projectsSummary.completed_projects || 0
        ),
        under_review_projects: Number(
          projectsSummary.under_review_projects || 0
        ),
        in_progress_projects: Number(
          projectsSummary.in_progress_projects || 0
        ),
        on_hold_projects: Number(projectsSummary.on_hold_projects || 0),
        cancelled_projects: Number(
          projectsSummary.cancelled_projects || 0
        ),
        overdue_projects: Number(
          projectsSummary.overdue_projects || 0
        ),

        total_tasks: Number(tasksSummary.total_tasks || 0),
        completed_tasks: Number(tasksSummary.completed_tasks || 0),
        in_progress_tasks: Number(tasksSummary.in_progress_tasks || 0),
        pending_tasks: Number(tasksSummary.pending_tasks || 0),
        blocked_tasks: Number(tasksSummary.blocked_tasks || 0),
        unassigned_tasks: Number(tasksSummary.unassigned_tasks || 0),
        overdue_tasks: Number(tasksSummary.overdue_tasks || 0),

        average_project_progress: averageProjectProgress,
        average_task_progress: averageTaskProgress,
        overall_progress: overallProgress,
      },

      project_status: projectStatusRows.map((item) => ({
        name: item.name,
        value: Number(item.value || 0),
      })),

      task_status: taskStatusRows.map((item) => ({
        name: item.name,
        value: Number(item.value || 0),
      })),

      project_progress: projectProgressRows.map((item) => ({
        ...item,
        progress: Number(item.progress || 0),
        total_tasks: Number(item.total_tasks || 0),
      })),

      employee_analysis: employeeAnalysisRows.map((item) => ({
        ...item,
        total_tasks: Number(item.total_tasks || 0),
        completed_tasks: Number(item.completed_tasks || 0),
        blocked_tasks: Number(item.blocked_tasks || 0),
        overdue_tasks: Number(item.overdue_tasks || 0),
        average_progress: Number(item.average_progress || 0),
        completion_rate: Number(item.completion_rate || 0),
      })),

      department_analysis: departmentAnalysisRows.map((item) => ({
        ...item,
        total_users: Number(item.total_users || 0),
        total_employees: Number(item.total_employees || 0),
        total_admins: Number(item.total_admins || 0),
        total_projects: Number(item.total_projects || 0),
        total_tasks: Number(item.total_tasks || 0),
        average_project_progress: Number(
          item.average_project_progress || 0
        ),
        average_task_progress: Number(
          item.average_task_progress || 0
        ),
      })),
    });
  } catch (error) {
    console.error("ADMINISTRATOR REPORTS ERROR:", {
      message: error.message,
      sqlMessage: error.sqlMessage,
      sqlCode: error.code,
      sql: error.sql,
    });

    return res.status(500).json({
      success: false,
      message:
        error.sqlMessage ||
        error.message ||
        "Failed to load administrator reports.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
      sqlCode: error.code || null,
    });
  }
};

const getAdministratorProfile = async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        u.user_id,
        u.employee_code,
        u.full_name,
        u.email,
        u.phone,
        u.designation,
        u.status,
        r.role_name,
        d.department_name,
        ep.skills
      FROM users u
      JOIN roles r ON r.role_id = u.role_id
      LEFT JOIN departments d ON d.department_id = u.department_id
      LEFT JOIN employee_profiles ep ON ep.user_id = u.user_id
      WHERE u.user_id = ?
      LIMIT 1
      `,
      [req.user.user_id]
    );

    return res.json({
      success: true,
      profile: rows[0] || null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load profile.",
      error: error.message,
    });
  }
};

const updateAdministratorSkills = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const skills = req.body.skills || "";

    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `
      SELECT profile_id
      FROM employee_profiles
      WHERE user_id = ?
      LIMIT 1
      `,
      [req.user.user_id]
    );

    if (existingRows.length) {
      await connection.query(
        `
        UPDATE employee_profiles
        SET skills = ?
        WHERE user_id = ?
        `,
        [skills, req.user.user_id]
      );
    } else {
      await connection.query(
        `
        INSERT INTO employee_profiles (user_id, skills)
        VALUES (?, ?)
        `,
        [req.user.user_id, skills]
      );
    }

    await connection.commit();

    return res.json({
      success: true,
      message: "Skills updated successfully.",
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      success: false,
      message: "Failed to update skills.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

const getAdministratorUsersMeta = async (req, res) => {
  try {
    for (const department of DEFAULT_DEPARTMENTS) {
      await getOrCreateDepartmentId(department);
    }

    const [roles] = await db.query(
      `
      SELECT role_id, role_name
      FROM roles
      ORDER BY role_id ASC
      `
    );

    const [departments] = await db.query(
      `
      SELECT department_id, department_name
      FROM departments
      ORDER BY department_name ASC
      `
    );

    return res.json({
      success: true,
      roles,
      departments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user meta.",
      error: error.message,
    });
  }
};

const getAdministratorUsers = async (req, res) => {
  try {
    const [users] = await db.query(
      `
      SELECT
        u.user_id,
        u.employee_code,
        u.full_name,
        u.email,
        u.phone,
        u.designation,
        u.status,
        r.role_name,
        d.department_name,
        ep.skills,
        DATE_FORMAT(u.created_at, '%d %b %Y') AS created_date
      FROM users u
      JOIN roles r ON r.role_id = u.role_id
      LEFT JOIN departments d ON d.department_id = u.department_id
      LEFT JOIN employee_profiles ep ON ep.user_id = u.user_id
      WHERE u.status != 'deleted'
      ORDER BY u.full_name ASC
      `
    );

    return res.json({
      success: true,
      users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users.",
      error: error.message,
    });
  }
};

const createAdministratorUser = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const {
      employee_code,
      full_name,
      email,
      phone,
      designation,
      department_name,
      role_name,
    } = req.body;

    const cleanFullName = cleanText(full_name);
    const cleanEmail = normalizeEmail(email);
    const cleanPhone = cleanText(phone);
    const cleanDesignation = cleanText(designation);
    const cleanDepartmentName = cleanText(department_name) || "General";
    const cleanRoleName = cleanText(role_name) || "employee";
    const requestedEmployeeCode = cleanText(employee_code);

    if (!cleanFullName || !cleanEmail) {
      return res.status(400).json({
        success: false,
        message: "Full name and email are required.",
      });
    }

    await connection.beginTransaction();

    const [emailRows] = await connection.query(
      `
      SELECT user_id
      FROM users
      WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))
      AND status != 'deleted'
      LIMIT 1
      `,
      [cleanEmail]
    );

    if (emailRows.length) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "A user with this email already exists.",
      });
    }

    let finalEmployeeCode = requestedEmployeeCode;

    if (finalEmployeeCode) {
      const [codeRows] = await connection.query(
        `
        SELECT user_id
        FROM users
        WHERE TRIM(employee_code) = TRIM(?)
        AND status != 'deleted'
        LIMIT 1
        `,
        [finalEmployeeCode]
      );

      if (codeRows.length) {
        finalEmployeeCode = await generateEmployeeCode(connection);
      }
    } else {
      finalEmployeeCode = await generateEmployeeCode(connection);
    }

    const departmentId = await getOrCreateDepartmentId(cleanDepartmentName);
    const roleId = await getRoleIdByName(cleanRoleName);
    const passwordHash = await bcrypt.hash(DEFAULT_USER_PASSWORD, 10);

    const [result] = await connection.query(
      `
      INSERT INTO users (
        department_id,
        role_id,
        employee_code,
        full_name,
        email,
        password_hash,
        phone,
        designation,
        status,
        force_password_change
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', false)
      `,
      [
        departmentId,
        roleId,
        finalEmployeeCode,
        cleanFullName,
        cleanEmail,
        passwordHash,
        cleanPhone || null,
        cleanDesignation || null,
      ]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "User created successfully.",
      user_id: result.insertId,
      employee_code: finalEmployeeCode,
      default_password: DEFAULT_USER_PASSWORD,
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      success: false,
      message: "Failed to create user.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  } finally {
    connection.release();
  }
};

const importAdministratorUsersCsv = async (req, res) => {
  const connection = await db.getConnection();

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Excel/CSV file is required.",
      });
    }

    const rows = parseUploadedFileRows(req.file);

    let importedRows = 0;
    let updatedRows = 0;
    let skippedRows = 0;
    let duplicateRows = 0;
    let conflictRows = 0;

    await connection.beginTransaction();

    const passwordHash = await bcrypt.hash(DEFAULT_USER_PASSWORD, 10);

    for (const row of rows) {
      const employeeCode = cleanText(
        getValue(row, [
          "Employee Id",
          "Employee ID",
          "employee_id",
          "employee_code",
          "Employee Code",
        ])
      );

      const fullName = cleanText(
        getValue(row, [
          "First Name",
          "Name",
          "Full Name",
          "full_name",
          "employee_name",
        ])
      );

      const departmentName =
        cleanText(getValue(row, ["Department", "department", "department_name"])) ||
        "General";

      const designation = cleanText(
        getValue(row, [
          "Position Code",
          "Designation",
          "designation",
          "Position",
        ])
      );

      let email = normalizeEmail(
        getValue(row, ["Email", "email", "Email ID", "employee_email"])
      );

      const phone = cleanText(getValue(row, ["Mobile", "mobile", "Phone", "phone"]));

      if (!employeeCode || !fullName) {
        skippedRows += 1;
        continue;
      }

      if (!email) {
        email = `employee.${employeeCode}@valencia.local`.toLowerCase();
      }

      const departmentId = await getOrCreateDepartmentId(departmentName);

      const [emailRows] = await connection.query(
        `
        SELECT 
          u.user_id,
          u.email,
          u.employee_code,
          r.role_name
        FROM users u
        LEFT JOIN roles r
          ON r.role_id = u.role_id
        WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(?))
        LIMIT 1
        `,
        [email]
      );

      const [codeRows] = await connection.query(
        `
        SELECT 
          u.user_id,
          u.email,
          u.employee_code,
          r.role_name
        FROM users u
        LEFT JOIN roles r
          ON r.role_id = u.role_id
        WHERE TRIM(u.employee_code) = TRIM(?)
        LIMIT 1
        `,
        [employeeCode]
      );

      if (
        emailRows.length > 0 &&
        codeRows.length > 0 &&
        Number(emailRows[0].user_id) !== Number(codeRows[0].user_id)
      ) {
        conflictRows += 1;
        continue;
      }

      const existingUser = emailRows[0] || codeRows[0] || null;

      if (existingUser) {
        const currentRoleName = String(existingUser.role_name || "employee")
          .toLowerCase()
          .trim();

        const protectedRoles = ["administrator", "superadmin", "admin"];

        const finalRoleName = protectedRoles.includes(currentRoleName)
          ? currentRoleName
          : "employee";

        const finalRoleId = await getRoleIdByName(finalRoleName);

        await connection.query(
          `
          UPDATE users
          SET
            department_id = ?,
            role_id = ?,
            employee_code = ?,
            full_name = ?,
            email = ?,
            phone = ?,
            designation = ?,
            status = 'active'
          WHERE user_id = ?
          `,
          [
            departmentId,
            finalRoleId,
            employeeCode,
            fullName,
            email,
            phone || null,
            designation || null,
            existingUser.user_id,
          ]
        );

        updatedRows += 1;
        duplicateRows += 1;
      } else {
        const roleId = await getRoleIdByName("employee");

        const [insertResult] = await connection.query(
          `
          INSERT INTO users (
            department_id,
            role_id,
            employee_code,
            full_name,
            email,
            password_hash,
            phone,
            designation,
            status,
            force_password_change
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', false)
          `,
          [
            departmentId,
            roleId,
            employeeCode,
            fullName,
            email,
            passwordHash,
            phone || null,
            designation || null,
          ]
        );

        await connection.query(
          `
          INSERT INTO employee_profiles (user_id)
          VALUES (?)
          `,
          [insertResult.insertId]
        );

        importedRows += 1;
      }
    }

    await connection.commit();

    return res.json({
      success: true,
      message: "Users imported successfully.",
      importedRows,
      updatedRows,
      skippedRows,
      duplicateRows,
      conflictRows,

      inserted_users: importedRows,
      updated_users: updatedRows,
      skipped_rows: skippedRows,
      duplicate_rows: duplicateRows,
      conflict_rows: conflictRows,

      default_password: DEFAULT_USER_PASSWORD,
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      success: false,
      message: "Failed to import users.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  } finally {
    connection.release();
  }
};

const updateAdministratorUserRole = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { role_name } = req.body;

    const roleId = await getRoleIdByName(role_name);

    await db.query(
      `
      UPDATE users
      SET role_id = ?
      WHERE user_id = ?
      `,
      [roleId, userId]
    );

    return res.json({
      success: true,
      message: "User role updated successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update user role.",
      error: error.message,
    });
  }
};

const updateAdministratorUserDetails = async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    const { department_name, designation } = req.body;

    const departmentId = await getOrCreateDepartmentId(
      department_name || "General"
    );

    const [userRows] = await db.query(
      `
      SELECT employee_code
      FROM users
      WHERE user_id = ?
      LIMIT 1
      `,
      [userId]
    );

    let employeeCode = userRows[0]?.employee_code;

    if (!employeeCode) {
      employeeCode = await generateEmployeeCode(db);
    }

    await db.query(
      `
      UPDATE users
      SET
        department_id = ?,
        designation = ?,
        employee_code = ?
      WHERE user_id = ?
      `,
      [departmentId, designation || null, employeeCode, userId]
    );

    return res.json({
      success: true,
      message: "User details updated successfully.",
      employee_code: employeeCode,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update user details.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};

const updateAdministratorUserStatus = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const status = String(req.body.status || "").toLowerCase();

    if (!["active", "blocked"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status.",
      });
    }

    await db.query(
      `
      UPDATE users
      SET status = ?
      WHERE user_id = ?
      `,
      [status, userId]
    );

    return res.json({
      success: true,
      message: `User ${status} successfully.`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update user status.",
      error: error.message,
    });
  }
};

const resetAdministratorUserPassword = async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    const passwordHash = await bcrypt.hash(DEFAULT_USER_PASSWORD, 10);

    await db.query(
      `
      UPDATE users
      SET password_hash = ?, force_password_change = false
      WHERE user_id = ?
      `,
      [passwordHash, userId]
    );

    return res.json({
      success: true,
      message: "Password reset successfully.",
      default_password: DEFAULT_USER_PASSWORD,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to reset password.",
      error: error.message,
    });
  }
};

const deleteAdministratorUser = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const userId = Number(req.params.userId);
    const loggedInUserId = Number(req.user?.user_id);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    if (userId === loggedInUserId) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account.",
      });
    }

    await connection.beginTransaction();

    const [userRows] = await connection.query(
      `
      SELECT 
        user_id,
        full_name,
        email,
        employee_code,
        status
      FROM users
      WHERE user_id = ?
      LIMIT 1
      `,
      [userId]
    );

    if (!userRows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const tableExists = async (tableName) => {
      const [rows] = await connection.query(
        `
        SELECT TABLE_NAME
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        LIMIT 1
        `,
        [tableName]
      );

      return rows.length > 0;
    };

    const columnExists = async (tableName, columnName) => {
      const [rows] = await connection.query(
        `
        SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
        LIMIT 1
        `,
        [tableName, columnName]
      );

      return rows.length > 0;
    };

    const deleteRowsIfColumnExists = async (tableName, columnName) => {
      const exists = await tableExists(tableName);
      if (!exists) return;

      const hasColumn = await columnExists(tableName, columnName);
      if (!hasColumn) return;

      await connection.query(
        `
        DELETE FROM \`${tableName}\`
        WHERE \`${columnName}\` = ?
        `,
        [userId]
      );
    };

    const setNullIfColumnExists = async (tableName, columnName) => {
      const exists = await tableExists(tableName);
      if (!exists) return;

      const hasColumn = await columnExists(tableName, columnName);
      if (!hasColumn) return;

      await connection.query(
        `
        UPDATE \`${tableName}\`
        SET \`${columnName}\` = NULL
        WHERE \`${columnName}\` = ?
        `,
        [userId]
      );
    };

    /*
      1. Delete employee-owned records first.
      These records should disappear completely with the user.
    */

    await deleteRowsIfColumnExists("employee_profiles", "user_id");
    await deleteRowsIfColumnExists("attendance", "employee_id");
    await deleteRowsIfColumnExists("mini_tasks", "employee_id");
    await deleteRowsIfColumnExists("password_reset_tokens", "user_id");

    /*
      2. Delete project assignment records for this user.
    */

    await deleteRowsIfColumnExists("project_assignments", "user_id");
    await deleteRowsIfColumnExists("project_assignments", "employee_id");
    await deleteRowsIfColumnExists("project_assignments", "assigned_to_user_id");
    await deleteRowsIfColumnExists("project_assignments", "assigned_user_id");

    /*
      3. Delete notifications linked to this user.
    */

    await deleteRowsIfColumnExists("notifications", "user_id");
    await deleteRowsIfColumnExists("notifications", "recipient_user_id");
    await deleteRowsIfColumnExists("notifications", "employee_id");

    /*
      4. Delete / clear logs linked to this user.
      If your log tables require user_id, delete those rows.
      If creator columns exist, clear them.
    */

    await deleteRowsIfColumnExists("activity_logs", "user_id");
    await deleteRowsIfColumnExists("activity_logs", "entity_id");
    await setNullIfColumnExists("activity_logs", "created_by_user_id");

    await deleteRowsIfColumnExists("user_management_logs", "user_id");
    await deleteRowsIfColumnExists("user_management_logs", "entity_id");
    await setNullIfColumnExists("user_management_logs", "performed_by_user_id");

    /*
      5. Handle tasks assigned to this user.
      First delete child subtasks of those tasks, then delete the user's main tasks.
    */

    const hasTasksTable = await tableExists("tasks");

    if (hasTasksTable) {
      const hasTaskId = await columnExists("tasks", "task_id");
      const hasParentTaskId = await columnExists("tasks", "parent_task_id");
      const hasAssignedToUserId = await columnExists("tasks", "assigned_to_user_id");
      const hasAssignedTo = await columnExists("tasks", "assigned_to");
      const hasAssigneeId = await columnExists("tasks", "assignee_id");
      const hasUserId = await columnExists("tasks", "user_id");
      const hasCreatedByUserId = await columnExists("tasks", "created_by_user_id");

      const taskAssigneeColumns = [];

      if (hasAssignedToUserId) taskAssigneeColumns.push("assigned_to_user_id");
      if (hasAssignedTo) taskAssigneeColumns.push("assigned_to");
      if (hasAssigneeId) taskAssigneeColumns.push("assignee_id");
      if (hasUserId) taskAssigneeColumns.push("user_id");

      if (hasTaskId && taskAssigneeColumns.length > 0) {
        const assignedWhere = taskAssigneeColumns
          .map((columnName) => `\`${columnName}\` = ?`)
          .join(" OR ");

        const assignedParams = taskAssigneeColumns.map(() => userId);

        if (hasParentTaskId) {
          await connection.query(
            `
            DELETE FROM tasks
            WHERE parent_task_id IN (
              SELECT task_id
              FROM (
                SELECT task_id
                FROM tasks
                WHERE ${assignedWhere}
              ) AS user_tasks
            )
            `,
            assignedParams
          );
        }

        await connection.query(
          `
          DELETE FROM tasks
          WHERE ${assignedWhere}
          `,
          assignedParams
        );
      }

      if (hasCreatedByUserId) {
        await connection.query(
          `
          UPDATE tasks
          SET created_by_user_id = NULL
          WHERE created_by_user_id = ?
          `,
          [userId]
        );
      }
    }

    /*
      6. Handle projects created by this user.
      We do not delete projects created by the user because that can remove
      department history. We clear creator/admin references if those columns exist.
    */

    await setNullIfColumnExists("projects", "created_by_user_id");
    await setNullIfColumnExists("projects", "created_by");
    await setNullIfColumnExists("projects", "created_by_id");
    await setNullIfColumnExists("projects", "admin_id");

    /*
      7. Final safety check:
      Clear any nullable foreign-key references to this user.
      Delete non-nullable references if needed.
    */

    const [foreignKeys] = await connection.query(
      `
      SELECT
        kcu.TABLE_NAME AS table_name,
        kcu.COLUMN_NAME AS column_name,
        c.IS_NULLABLE AS is_nullable
      FROM information_schema.KEY_COLUMN_USAGE kcu
      JOIN information_schema.COLUMNS c
        ON c.TABLE_SCHEMA = kcu.TABLE_SCHEMA
        AND c.TABLE_NAME = kcu.TABLE_NAME
        AND c.COLUMN_NAME = kcu.COLUMN_NAME
      WHERE kcu.TABLE_SCHEMA = DATABASE()
      AND kcu.REFERENCED_TABLE_NAME = 'users'
      AND kcu.REFERENCED_COLUMN_NAME = 'user_id'
      `
    );

    for (const fk of foreignKeys) {
      const tableName = fk.table_name;
      const columnName = fk.column_name;
      const isNullable = String(fk.is_nullable || "").toUpperCase() === "YES";

      if (tableName === "users") continue;

      if (isNullable) {
        await connection.query(
          `
          UPDATE \`${tableName}\`
          SET \`${columnName}\` = NULL
          WHERE \`${columnName}\` = ?
          `,
          [userId]
        );
      } else {
        await connection.query(
          `
          DELETE FROM \`${tableName}\`
          WHERE \`${columnName}\` = ?
          `,
          [userId]
        );
      }
    }

    /*
      8. Hard delete from users table.
    */

    await connection.query(
      `
      DELETE FROM users
      WHERE user_id = ?
      `,
      [userId]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: "User permanently deleted from database.",
      deleted_user_id: userId,
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      success: false,
      message: "Failed to permanently delete user.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  } finally {
    connection.release();
  }
};

const getAdministratorAttendance = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [companyDaysRows] = await db.query(
      `
      SELECT COUNT(DISTINCT attendance_date) AS total_company_days
      FROM attendance
      `
    );

    const totalCompanyDays = Number(companyDaysRows[0]?.total_company_days || 0);

    const [myStatsRows] = await db.query(
      `
      SELECT
        COUNT(a.attendance_id) AS recorded_days,
        SUM(CASE WHEN LOWER(a.status) = 'present' THEN 1 ELSE 0 END) AS present_days,
        SUM(CASE WHEN LOWER(a.status) = 'absent' THEN 1 ELSE 0 END) AS absent_days,
        SUM(CASE WHEN LOWER(a.status) = 'half_day' THEN 1 ELSE 0 END) AS half_day_days,
        SUM(CASE WHEN LOWER(a.status) = 'leave' THEN 1 ELSE 0 END) AS leave_days,
        SUM(CASE WHEN LOWER(a.status) = 'holiday' THEN 1 ELSE 0 END) AS holiday_days
      FROM attendance a
      WHERE a.employee_id = ?
      `,
      [userId]
    );

    const myStats = myStatsRows[0] || {};

    const myRecordedDays = Number(myStats.recorded_days || 0);
    const myPresentDays = Number(myStats.present_days || 0);
    const myHalfDayDays = Number(myStats.half_day_days || 0);
    const myLeaveDays = Number(myStats.leave_days || 0);
    const myHolidayDays = Number(myStats.holiday_days || 0);
    const myExplicitAbsentDays = Number(myStats.absent_days || 0);

    const myMissingDays = Math.max(totalCompanyDays - myRecordedDays, 0);

    const myTotalAbsentDays = myExplicitAbsentDays + myMissingDays;

    const myAttendanceScore = myPresentDays + myHalfDayDays * 0.5;

    const myAttendancePercentage =
      totalCompanyDays > 0
        ? Math.round((myAttendanceScore / totalCompanyDays) * 100)
        : 0;

    const [myRecentAttendance] = await db.query(
      `
      SELECT
        attendance_id,
        DATE_FORMAT(attendance_date, '%d %b %Y') AS attendance_date,
        status,
        check_in_time,
        check_out_time,
        total_minutes,
        remarks
      FROM attendance
      WHERE employee_id = ?
      ORDER BY attendance_date DESC
      LIMIT 15
      `,
      [userId]
    );

    const [overallAttendance] = await db.query(
      `
      SELECT
        u.user_id,
        u.full_name,
        u.email,
        u.employee_code,
        d.department_name,
        u.designation,

        COUNT(a.attendance_id) AS recorded_days,

        SUM(CASE WHEN LOWER(a.status) = 'present' THEN 1 ELSE 0 END) AS present_days,
        SUM(CASE WHEN LOWER(a.status) = 'absent' THEN 1 ELSE 0 END) AS absent_days,
        SUM(CASE WHEN LOWER(a.status) = 'half_day' THEN 1 ELSE 0 END) AS half_day_days,
        SUM(CASE WHEN LOWER(a.status) = 'leave' THEN 1 ELSE 0 END) AS leave_days,
        SUM(CASE WHEN LOWER(a.status) = 'holiday' THEN 1 ELSE 0 END) AS holiday_days

      FROM users u
      LEFT JOIN departments d
        ON d.department_id = u.department_id
      LEFT JOIN attendance a
        ON a.employee_id = u.user_id

      WHERE COALESCE(u.status, 'active') != 'deleted'

      GROUP BY
        u.user_id,
        u.full_name,
        u.email,
        u.employee_code,
        d.department_name,
        u.designation

      ORDER BY u.full_name ASC
      `
    );

    const formattedOverallAttendance = overallAttendance.map((user) => {
      const recordedDays = Number(user.recorded_days || 0);
      const presentDays = Number(user.present_days || 0);
      const halfDayDays = Number(user.half_day_days || 0);
      const leaveDays = Number(user.leave_days || 0);
      const holidayDays = Number(user.holiday_days || 0);
      const explicitAbsentDays = Number(user.absent_days || 0);

      const missingDays = Math.max(totalCompanyDays - recordedDays, 0);

      const totalAbsentDays = explicitAbsentDays + missingDays;

      const attendanceScore = presentDays + halfDayDays * 0.5;

      const attendancePercentage =
        totalCompanyDays > 0
          ? Math.round((attendanceScore / totalCompanyDays) * 100)
          : 0;

      return {
        ...user,

        total_days: totalCompanyDays,
        recorded_days: recordedDays,

        present_days: presentDays,
        absent_days: totalAbsentDays,
        explicit_absent_days: explicitAbsentDays,
        missing_days: missingDays,
        half_day_days: halfDayDays,
        leave_days: leaveDays,
        holiday_days: holidayDays,

        attendance_percentage: attendancePercentage,
      };
    });

    const usersWithAttendance = formattedOverallAttendance.filter(
      (user) => Number(user.recorded_days) > 0
    ).length;

    const usersForAverage = formattedOverallAttendance.filter(
      (user) => Number(user.recorded_days) > 0
    );

    const averageAttendance =
      usersForAverage.length > 0
        ? Math.round(
            usersForAverage.reduce(
              (sum, user) => sum + Number(user.attendance_percentage || 0),
              0
            ) / usersForAverage.length
          )
        : 0;

    return res.json({
      success: true,
      attendance_basis: {
        total_company_attendance_days: totalCompanyDays,
        calculation:
          "attendance percentage = (present days + half day * 0.5) / total company attendance dates",
      },
      my_attendance: {
        percentage: myAttendancePercentage,

        total_days: totalCompanyDays,
        recorded_days: myRecordedDays,

        present_days: myPresentDays,
        absent_days: myTotalAbsentDays,
        explicit_absent_days: myExplicitAbsentDays,
        missing_days: myMissingDays,
        half_day_days: myHalfDayDays,
        leave_days: myLeaveDays,
        holiday_days: myHolidayDays,
      },
      my_recent_attendance: myRecentAttendance,
      overall_summary: {
        total_employees: formattedOverallAttendance.length,
        average_attendance: averageAttendance,
        employees_with_attendance: usersWithAttendance,
        visible_records: formattedOverallAttendance.length,
        total_company_attendance_days: totalCompanyDays,
      },
      overall_attendance: formattedOverallAttendance,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load attendance.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};

const importAdministratorAttendanceCsv = async (req, res) => {
  const connection = await db.getConnection();

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Excel/CSV file is required.",
      });
    }

    const rows = parseUploadedFileRows(req.file);

    let importedRows = 0;
    let updatedRows = 0;
    let skippedRows = 0;
    let unmatchedRows = 0;

    await connection.beginTransaction();

    for (const row of rows) {
      const employeeCode = cleanText(
        getValue(row, [
          "Employee ID",
          "Employee Id",
          "employee_id",
          "employee_code",
          "Employee Code",
        ])
      );

      const fullName = cleanText(
        getValue(row, [
          "First Name",
          "Name",
          "Full Name",
          "full_name",
          "employee_name",
        ])
      );

      const email = normalizeEmail(
        getValue(row, ["Email", "email", "Email ID", "employee_email"])
      );

      const attendanceDate = normalizeDateForMySQL(
        getValue(row, ["Date", "date", "attendance_date", "Attendance Date"])
      );

      if (!employeeCode || !fullName || !attendanceDate) {
        skippedRows += 1;
        continue;
      }

      const user = await findUserByEmployeeCodeEmailOrName({
        employeeCode,
        email,
        fullName,
      });

      if (!user) {
        unmatchedRows += 1;
        continue;
      }

      const checkIn = normalizeTimeForMySQL(
        getValue(row, [
          "First Punch",
          "first_punch",
          "check_in",
          "Check In",
          "check_in_time",
          "Check In Time",
          "in_time",
          "In Time",
        ])
      );

      const checkOut = normalizeTimeForMySQL(
        getValue(row, [
          "Last Punch",
          "last_punch",
          "check_out",
          "Check Out",
          "check_out_time",
          "Check Out Time",
          "out_time",
          "Out Time",
        ])
      );

      const durationMinutes = parseDurationToMinutes(
        getValue(row, [
          "Total Time",
          "total_time",
          "total_minutes",
          "Total Minutes",
          "minutes",
          "Minutes",
        ])
      );

      const totalMinutes =
        durationMinutes || calculateTotalMinutes(checkIn, checkOut) || 0;

      const explicitStatus = getValue(row, [
        "Status",
        "status",
        "attendance_status",
        "Attendance Status",
      ]);

      const status = explicitStatus
        ? normalizeAttendanceStatus(explicitStatus)
        : "present";

      const remarks =
        getValue(row, ["Weekday", "weekday", "Remarks", "remarks"]) || null;

      const [existingRows] = await connection.query(
        `
        SELECT attendance_id
        FROM attendance
        WHERE employee_id = ?
        AND attendance_date = ?
        LIMIT 1
        `,
        [user.user_id, attendanceDate]
      );

      if (existingRows.length) {
        await connection.query(
          `
          UPDATE attendance
          SET
            check_in_time = ?,
            check_out_time = ?,
            total_minutes = ?,
            status = ?,
            remarks = ?
          WHERE attendance_id = ?
          `,
          [
            checkIn,
            checkOut,
            totalMinutes,
            status,
            remarks,
            existingRows[0].attendance_id,
          ]
        );

        updatedRows += 1;
      } else {
        await connection.query(
          `
          INSERT INTO attendance (
            employee_id,
            attendance_date,
            check_in_time,
            check_out_time,
            total_minutes,
            status,
            remarks
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            user.user_id,
            attendanceDate,
            checkIn,
            checkOut,
            totalMinutes,
            status,
            remarks,
          ]
        );

        importedRows += 1;
      }
    }

    await connection.commit();

    return res.json({
      success: true,
      message: "Attendance imported successfully.",

      importedRows,
      updatedRows,
      skippedRows,
      unmatchedRows,

      inserted_rows: importedRows,
      updated_rows: updatedRows,
      skipped_rows: skippedRows,
      missing_users: unmatchedRows,

      note: "Attendance import does not update user department, designation, email, role, or employee code.",
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      success: false,
      message: "Failed to import attendance.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  } finally {
    connection.release();
  }
};

const exportAdministratorAttendanceCsv = async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        u.employee_code,
        u.full_name,
        u.email,
        d.department_name,
        DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendance_date,
        a.status,
        a.check_in_time,
        a.check_out_time,
        a.total_minutes,
        a.remarks
      FROM attendance a
      JOIN users u ON u.user_id = a.employee_id
      LEFT JOIN departments d ON d.department_id = u.department_id
      ORDER BY a.attendance_date DESC, u.full_name ASC
      `
    );

    const headers = [
      "employee_code",
      "full_name",
      "email",
      "department_name",
      "attendance_date",
      "status",
      "check_in_time",
      "check_out_time",
      "total_minutes",
      "remarks",
    ];

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers.map((header) => escapeCsvValue(row[header])).join(",")
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=valencia-rms-attendance.csv"
    );

    return res.send(csv);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to export attendance.",
      error: error.message,
    });
  }
};

module.exports = {
  getAdministratorOverview,

  getAdministratorMyProjects,
  getAdministratorAllProjects,
  exportAdministratorProjectsCsv,
  importAdministratorProjectsCsv,

  getAdministratorMyTasks,
  getAdministratorAllTasks,
  exportAdministratorTasksCsv,
  importAdministratorTasksCsv,

  getAdministratorReports,

  getAdministratorProfile,
  updateAdministratorSkills,

  getAdministratorUsersMeta,
  getAdministratorUsers,
  createAdministratorUser,
  importAdministratorUsersCsv,
  updateAdministratorUserRole,
  updateAdministratorUserDetails,
  updateAdministratorUserStatus,
  resetAdministratorUserPassword,
  deleteAdministratorUser,

  getAdministratorAttendance,
  importAdministratorAttendanceCsv,
  exportAdministratorAttendanceCsv,
};
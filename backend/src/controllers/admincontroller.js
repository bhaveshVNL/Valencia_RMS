const db = require("../config/db");

const {
  sendProjectAssignmentEmails,
} = require("../utils/projectemailnotifications");

const escapeId = (value) => {
  return `\`${String(value).replace(/`/g, "``")}\``;
};

const getTableColumnInfo = async (tableName) => {
  const [columns] = await db.query(`SHOW COLUMNS FROM ${escapeId(tableName)}`);
  return columns;
};

const pickColumn = (columns, possibleNames) => {
  return possibleNames.find((name) => columns.includes(name));
};

const getColumnInfo = (columnInfo, columnName) => {
  return columnInfo.find((col) => col.Field === columnName);
};

const getSafeTodoStatus = (columnInfo, statusColumn) => {
  if (!statusColumn) return undefined;

  const statusInfo = getColumnInfo(columnInfo, statusColumn);

  if (!statusInfo) return "todo";

  const type = String(statusInfo.Type || "").toLowerCase();

  if (!type.startsWith("enum")) {
    return "todo";
  }

  const enumValues = type
    .replace(/^enum\(/, "")
    .replace(/\)$/, "")
    .split(",")
    .map((value) => value.trim().replace(/^'/, "").replace(/'$/, ""));

  const preferredValues = [
    "not_started",
    "todo",
    "to_do",
    "pending",
    "ongoing",
  ];

  const matchedValue = preferredValues.find((value) =>
    enumValues.includes(value)
  );

  if (matchedValue) {
    return matchedValue;
  }

  return enumValues[0] || "todo";
};

const insertIntoTable = async (tableName, data) => {
  const keys = Object.keys(data).filter(
    (key) => data[key] !== undefined && data[key] !== null
  );

  if (keys.length === 0) {
    throw new Error(`No insertable columns found for table ${tableName}`);
  }

  const sql = `
    INSERT INTO ${escapeId(tableName)}
    (${keys.map(escapeId).join(", ")})
    VALUES (${keys.map(() => "?").join(", ")})
  `;

  const values = keys.map((key) => data[key]);
  const [result] = await db.query(sql, values);

  return result;
};

const getLoggedInAdmin = async (req) => {
  const loggedInUserId =
    req.user?.user_id ||
    req.user?.id ||
    req.user?.uid ||
    req.user?.userId;

  if (!loggedInUserId) {
    return {
      error: {
        status: 401,
        message: "Unauthorized. User not found in token.",
      },
    };
  }

  const [adminRows] = await db.query(
    `
    SELECT 
      u.user_id,
      u.employee_code,
      u.full_name,
      u.email,
      u.phone,
      u.designation,
      u.department_id,
      u.role_id,
      r.role_name,
      d.department_name
    FROM users u
    LEFT JOIN roles r 
      ON u.role_id = r.role_id
    LEFT JOIN departments d 
      ON u.department_id = d.department_id
    WHERE u.user_id = ?
    LIMIT 1
    `,
    [loggedInUserId]
  );

  if (!adminRows || adminRows.length === 0) {
    return {
      error: {
        status: 404,
        message: "Logged-in admin user not found.",
      },
    };
  }

  const adminUser = adminRows[0];

  const adminRole = String(adminUser.role_name || "")
    .toLowerCase()
    .trim();

  if (adminRole !== "admin") {
    return {
      error: {
        status: 403,
        message: "Access denied. Admin role required.",
      },
    };
  }

  return {
    adminUser,
  };
};

const getAdminDepartmentUsers = async (req, res) => {
  try {
    const { adminUser, error } = await getLoggedInAdmin(req);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const adminDepartmentId = adminUser.department_id;
    const adminDepartmentName = adminUser.department_name;

    if (!adminDepartmentId) {
      return res.status(400).json({
        message: "Admin department is not assigned.",
      });
    }

    const [users] = await db.query(
      `
      SELECT 
        u.user_id AS id,
        u.user_id,
        u.employee_code,
        u.full_name,
        u.email,
        u.phone,
        u.designation,
        u.department_id,
        u.role_id,
        r.role_name,
        d.department_name
      FROM users u
      LEFT JOIN roles r 
        ON u.role_id = r.role_id
      LEFT JOIN departments d 
        ON u.department_id = d.department_id
      WHERE u.department_id = ?
      ORDER BY u.full_name ASC
      `,
      [adminDepartmentId]
    );

    return res.status(200).json({
      department_id: adminDepartmentId,
      department: adminDepartmentName,
      total: users.length,
      users,
    });
  } catch (error) {
    console.error("Get admin department users error:", error);

    return res.status(500).json({
      message: "Failed to fetch department users.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};

const getAdminAssignableUsers = async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT
        u.user_id,
        u.full_name,
        u.email,
        u.department_id,
        d.department_name
      FROM users u
      LEFT JOIN departments d
        ON d.department_id = u.department_id
      LEFT JOIN roles r
        ON r.role_id = u.role_id
      WHERE LOWER(r.role_name) = 'employee'
      ORDER BY u.full_name ASC
    `);

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("getAdminAssignableUsers error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch assignable employees",
    });
  }
};

const createAdminProject = async (req, res) => {
  try {
    const { adminUser, error } = await getLoggedInAdmin(req);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const {
      project_title,
      project_description,
      main_task,
      assignee_ids,
      start_date,
      due_date,
      end_date,
    } = req.body;

    const cleanProjectTitle = String(project_title || "").trim();

    const cleanMainTask = String(
      main_task || project_description || project_title || ""
    ).trim();

    const cleanProjectDescription = String(
      project_description || main_task || ""
    ).trim();

    const cleanAssigneeIds = Array.isArray(assignee_ids)
      ? [...new Set(assignee_ids.map(Number).filter(Boolean))]
      : [];

    if (!cleanProjectTitle) {
      return res.status(400).json({
        message: "Project title is required.",
      });
    }

    if (!cleanMainTask) {
      return res.status(400).json({
        message: "Main task is required.",
      });
    }

    if (cleanAssigneeIds.length === 0) {
      return res.status(400).json({
        message: "Please select at least one assignee.",
      });
    }

    const projectColumnInfo = await getTableColumnInfo("projects");
    const taskColumnInfo = await getTableColumnInfo("tasks");
    const assignmentColumnInfo = await getTableColumnInfo("project_assignments");

    const projectColumns = projectColumnInfo.map((col) => col.Field);
    const taskColumns = taskColumnInfo.map((col) => col.Field);
    const assignmentColumns = assignmentColumnInfo.map((col) => col.Field);

    const projectTitleColumn = pickColumn(projectColumns, [
      "project_title",
      "title",
      "project_name",
      "name",
    ]);

    if (!projectTitleColumn) {
      return res.status(500).json({
        message: "Could not find project title column in projects table.",
        projectColumns,
      });
    }

    const projectDescriptionColumn = pickColumn(projectColumns, [
      "project_description",
      "description",
      "main_task",
      "details",
    ]);

    const projectStatusColumn = pickColumn(projectColumns, [
      "status",
      "project_status",
    ]);

    const projectCreatedByColumn = pickColumn(projectColumns, [
      "created_by_user_id",
      "created_by",
      "created_by_id",
      "admin_id",
    ]);

    const projectDepartmentColumn = pickColumn(projectColumns, [
      "department_id",
    ]);

    const projectStartDateColumn = pickColumn(projectColumns, [
      "start_date",
      "project_start_date",
    ]);

    const projectDueDateColumn = pickColumn(projectColumns, [
      "due_date",
      "end_date",
      "project_end_date",
      "deadline",
    ]);

    const projectCreatedAtColumn = pickColumn(projectColumns, ["created_at"]);
    const projectUpdatedAtColumn = pickColumn(projectColumns, ["updated_at"]);

    const projectTodoStatus = getSafeTodoStatus(
      projectColumnInfo,
      projectStatusColumn
    );

    const projectData = {};

    projectData[projectTitleColumn] = cleanProjectTitle;

    if (projectDescriptionColumn) {
      projectData[projectDescriptionColumn] = cleanProjectDescription;
    }

    if (projectStatusColumn) {
      projectData[projectStatusColumn] = projectTodoStatus;
    }

    if (projectCreatedByColumn) {
      projectData[projectCreatedByColumn] = adminUser.user_id;
    }

    if (projectDepartmentColumn) {
      projectData[projectDepartmentColumn] = adminUser.department_id;
    }

    if (projectStartDateColumn && start_date) {
      projectData[projectStartDateColumn] = start_date;
    }

    if (projectDueDateColumn && (due_date || end_date)) {
      projectData[projectDueDateColumn] = due_date || end_date;
    }

    if (projectCreatedAtColumn) {
      projectData[projectCreatedAtColumn] = new Date();
    }

    if (projectUpdatedAtColumn) {
      projectData[projectUpdatedAtColumn] = new Date();
    }

    const projectResult = await insertIntoTable("projects", projectData);
    const projectId = projectResult.insertId;

    const taskProjectIdColumn = pickColumn(taskColumns, ["project_id"]);

    const taskTitleColumn = pickColumn(taskColumns, [
      "task_title",
      "title",
      "task_name",
      "name",
    ]);

    const taskDescriptionColumn = pickColumn(taskColumns, [
      "task_description",
      "description",
      "details",
      "main_task",
    ]);

    const taskStatusColumn = pickColumn(taskColumns, [
      "status",
      "task_status",
    ]);

    const taskAssignedToColumn = pickColumn(taskColumns, [
      "assigned_to_user_id",
      "assigned_to",
      "assignee_id",
      "user_id",
    ]);

    const taskCreatedByColumn = pickColumn(taskColumns, [
      "created_by_user_id",
      "created_by",
      "created_by_id",
      "admin_id",
    ]);

    const taskStartDateColumn = pickColumn(taskColumns, [
      "start_date",
      "task_start_date",
    ]);

    const taskDueDateColumn = pickColumn(taskColumns, [
      "due_date",
      "end_date",
      "task_end_date",
      "deadline",
    ]);

    const taskParentTaskColumn = pickColumn(taskColumns, ["parent_task_id"]);
    const taskTypeColumn = pickColumn(taskColumns, ["task_type"]);
    const taskProgressColumn = pickColumn(taskColumns, ["progress"]);
    const taskCheckedColumn = pickColumn(taskColumns, ["is_checked"]);

    const taskCreatedAtColumn = pickColumn(taskColumns, ["created_at"]);
    const taskUpdatedAtColumn = pickColumn(taskColumns, ["updated_at"]);

    if (!taskProjectIdColumn || !taskTitleColumn) {
      return res.status(500).json({
        message: "Could not find required task columns in tasks table.",
        taskColumns,
      });
    }

    const taskTodoStatus = getSafeTodoStatus(taskColumnInfo, taskStatusColumn);

    const createdTaskIds = [];

    for (const assigneeId of cleanAssigneeIds) {
      const taskData = {};

      taskData[taskProjectIdColumn] = projectId;
      taskData[taskTitleColumn] = cleanMainTask;

      if (taskDescriptionColumn) {
        taskData[taskDescriptionColumn] = cleanProjectDescription || cleanMainTask;
      }

      if (taskStatusColumn) {
        taskData[taskStatusColumn] = taskTodoStatus;
      }

      if (taskAssignedToColumn) {
        taskData[taskAssignedToColumn] = assigneeId;
      }

      if (taskCreatedByColumn) {
        taskData[taskCreatedByColumn] = adminUser.user_id;
      }

      if (taskStartDateColumn && start_date) {
        taskData[taskStartDateColumn] = start_date;
      }

      if (taskDueDateColumn && (due_date || end_date)) {
        taskData[taskDueDateColumn] = due_date || end_date;
      }

      if (taskParentTaskColumn) {
        taskData[taskParentTaskColumn] = null;
      }

      if (taskTypeColumn) {
        taskData[taskTypeColumn] = "main";
      }

      if (taskProgressColumn) {
        taskData[taskProgressColumn] = 0;
      }

      if (taskCheckedColumn) {
        taskData[taskCheckedColumn] = 0;
      }

      if (taskCreatedAtColumn) {
        taskData[taskCreatedAtColumn] = new Date();
      }

      if (taskUpdatedAtColumn) {
        taskData[taskUpdatedAtColumn] = new Date();
      }

      const taskResult = await insertIntoTable("tasks", taskData);
      createdTaskIds.push(taskResult.insertId);
    }

    const assignmentProjectIdColumn = pickColumn(assignmentColumns, [
      "project_id",
    ]);

    const assignmentUserIdColumn = pickColumn(assignmentColumns, [
      "user_id",
      "assigned_user_id",
      "assigned_to_user_id",
      "assignee_id",
      "employee_id",
    ]);

    const assignmentAssignedByColumn = pickColumn(assignmentColumns, [
      "assigned_by_user_id",
      "assigned_by",
      "created_by",
      "admin_id",
    ]);

    const assignmentCreatedAtColumn = pickColumn(assignmentColumns, [
      "assigned_at",
      "created_at",
    ]);

    if (assignmentProjectIdColumn && assignmentUserIdColumn) {
      for (const assigneeId of cleanAssigneeIds) {
        const assignmentData = {};

        assignmentData[assignmentProjectIdColumn] = projectId;
        assignmentData[assignmentUserIdColumn] = assigneeId;

        if (assignmentAssignedByColumn) {
          assignmentData[assignmentAssignedByColumn] = adminUser.user_id;
        }

        if (assignmentCreatedAtColumn) {
          assignmentData[assignmentCreatedAtColumn] = new Date();
        }

        await insertIntoTable("project_assignments", assignmentData);
      }
    }

    const emailSummary = await sendProjectAssignmentEmails(projectId, adminUser);

    return res.status(201).json({
      message: "Project assigned successfully.",
      project_id: projectId,
      task_ids: createdTaskIds,
      assignee_ids: cleanAssigneeIds,
      email_summary: emailSummary,
    });
  } catch (error) {
    console.error("Create admin project error:", error);

    return res.status(500).json({
      message: "Failed to create project.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};
const getAdminUserTimeSummary = async (req, res) => {
  try {
    const { adminUser, error } = await getLoggedInAdmin(req);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const employeeId = Number(req.params.userId);

    if (!employeeId) {
      return res.status(400).json({
        message: "Invalid employee.",
      });
    }

    /*
    --------------------------------------------------
    SECURITY:
    Admin can only view employees from own department.
    --------------------------------------------------
    */
    const [employeeRows] = await db.query(
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
        ON d.department_id = u.department_id
      WHERE u.user_id = ?
        AND u.department_id = ?
      LIMIT 1
      `,
      [employeeId, adminUser.department_id]
    );

    if (!employeeRows.length) {
      return res.status(404).json({
        message:
          "Employee not found in your department.",
      });
    }

    const employee = employeeRows[0];

    /*
    --------------------------------------------------
    GET ALL WORK SESSIONS

    Rules applied:
    - Sunday = 0
    - fixed company holiday = 0
    - employee optional holiday = 0
    - before 11 AM ignored
    - after 7:30 PM ignored
    - forgotten open timer capped at 7:30 PM
    --------------------------------------------------
    */
    const [sessionRows] = await db.query(
      `
      SELECT
        tws.session_id,
        tws.task_id,
        tws.employee_id,
        tws.started_at,
        tws.ended_at,
        tws.end_reason,

        t.task_title,
        t.status AS task_status,
        t.project_id,

        p.project_title,

        CASE
          WHEN DAYOFWEEK(tws.started_at) = 1
          THEN 0

          WHEN DATE(tws.started_at) IN (
            '2026-01-26',
            '2026-05-01',
            '2026-08-15',
            '2026-10-02'
          )
          THEN 0

          WHEN EXISTS (
            SELECT 1
            FROM employee_optional_holidays eoh
            WHERE eoh.employee_id = tws.employee_id
              AND eoh.holiday_date = DATE(tws.started_at)
          )
          THEN 0

          ELSE GREATEST(
            0,

            TIMESTAMPDIFF(
              SECOND,

              GREATEST(
                tws.started_at,
                TIMESTAMP(
                  DATE(tws.started_at),
                  '11:00:00'
                )
              ),

              LEAST(
                COALESCE(
                  tws.ended_at,
                  CONVERT_TZ(
                    UTC_TIMESTAMP(),
                    '+00:00',
                    '+05:30'
                  )
                ),

                TIMESTAMP(
                  DATE(tws.started_at),
                  '19:30:00'
                )
              )
            )
          )
        END AS seconds_worked

      FROM task_work_sessions tws

      INNER JOIN tasks t
        ON t.task_id = tws.task_id

      LEFT JOIN projects p
        ON p.project_id = t.project_id

      WHERE tws.employee_id = ?

      ORDER BY
        p.project_title ASC,
        t.task_title ASC,
        tws.started_at DESC
      `,
      [employeeId]
    );

    /*
    --------------------------------------------------
    BUILD:
    Employee
      -> Projects
          -> Tasks
              -> Sessions
    --------------------------------------------------
    */

    let totalSeconds = 0;

    const projectMap = new Map();

    for (const row of sessionRows) {
      const secondsWorked =
        Number(row.seconds_worked || 0);

      totalSeconds += secondsWorked;

      const projectId =
        row.project_id || `no-project-${row.task_id}`;

      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, {
          project_id: row.project_id || null,
          project_title:
            row.project_title || "No Project",
          total_seconds: 0,
          tasks: new Map(),
        });
      }

      const project = projectMap.get(projectId);

      project.total_seconds += secondsWorked;

      if (!project.tasks.has(row.task_id)) {
        project.tasks.set(row.task_id, {
          task_id: row.task_id,
          task_title:
            row.task_title || "Untitled Task",
          status: row.task_status || "",
          total_seconds: 0,
          currently_running: false,
          sessions: [],
        });
      }

      const task = project.tasks.get(row.task_id);

      task.total_seconds += secondsWorked;

      if (!row.ended_at) {
        task.currently_running = true;
      }

      task.sessions.push({
        session_id: row.session_id,
        started_at: row.started_at,
        ended_at: row.ended_at,
        end_reason: row.end_reason,
        seconds_worked: secondsWorked,
        currently_running: !row.ended_at,
      });
    }

    const projects = Array.from(
      projectMap.values()
    ).map((project) => ({
      project_id: project.project_id,
      project_title: project.project_title,
      total_seconds: project.total_seconds,
      tasks: Array.from(project.tasks.values()),
    }));

    return res.status(200).json({
      success: true,

      employee: {
        user_id: employee.user_id,
        employee_code: employee.employee_code,
        full_name: employee.full_name,
        email: employee.email,
        designation: employee.designation,
        department_id: employee.department_id,
        department_name: employee.department_name,
      },

      total_seconds: totalSeconds,

      total_projects: projects.length,

      total_tasks: projects.reduce(
        (sum, project) =>
          sum + project.tasks.length,
        0
      ),

      projects,
    });
  } catch (error) {
    console.error(
      "Get admin user time summary error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to fetch employee time summary.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};
module.exports = {
  getAdminDepartmentUsers,
  getAdminAssignableUsers,
  createAdminProject,
  getAdminUserTimeSummary,
};
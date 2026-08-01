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
    const { error } = await getLoggedInAdmin(req);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
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
      ORDER BY u.full_name ASC
      `
    );

    return res.status(200).json({
      total: users.length,
      users,
    });
  } catch (error) {
    console.error("Get admin assignable users error:", error);

    return res.status(500).json({
      message: "Failed to fetch assignable users.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
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

module.exports = {
  getAdminDepartmentUsers,
  getAdminAssignableUsers,
  createAdminProject,
};
const db = require("../config/db");

const {
  sendProjectAssignmentEmails,
  sendProjectUpdateEmails,
  sendMainTaskAssignmentEmails,
} = require("../utils/projectemailnotifications");

const safeTableName = (tableName) => {
  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`);
  }

  return `\`${tableName}\``;
};

const getColumns = async (tableName, connection = db) => {
  const [columns] = await connection.query(
    `SHOW COLUMNS FROM ${safeTableName(tableName)}`
  );

  return columns.map((column) => ({
    name: column.Field,
    type: column.Type,
  }));
};

const getColumnNames = async (tableName, connection = db) => {
  const columns = await getColumns(tableName, connection);
  return columns.map((column) => column.name);
};

const hasColumn = (columns, columnName) => {
  return columns.includes(columnName);
};

const findColumn = (columns, possibleColumns) => {
  return possibleColumns.find((column) => columns.includes(column));
};

const parseEnumValues = (type = "") => {
  const match = String(type).match(/^enum\((.*)\)$/i);

  if (!match) return [];

  return match[1]
    .split(",")
    .map((value) => value.trim().replace(/^'/, "").replace(/'$/, ""));
};

const getBestEnumValue = async (
  tableName,
  columnName,
  preferredValues,
  fallbackValue,
  connection = db
) => {
  const columns = await getColumns(tableName, connection);
  const column = columns.find((item) => item.name === columnName);

  if (!column) return fallbackValue;

  const enumValues = parseEnumValues(column.type);

  if (!enumValues.length) return fallbackValue;

  const matchedValue = preferredValues.find((value) =>
    enumValues.includes(value)
  );

  return matchedValue || enumValues[0] || fallbackValue;
};

const normalizeIdArray = (value) => {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
    ),
  ];
};

const formatDateOnly = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getLoggedInUserId = (req) => {
  return Number(req.user?.user_id || req.user?.id || req.userId || 0);
};

const getLoggedInDepartmentId = (req) => {
  return Number(req.user?.department_id || req.user?.departmentId || 0);
};

const getProjectAssignmentUserColumn = async (connection = db) => {
  const columns = await getColumnNames("project_assignments", connection);

  const userColumn = findColumn(columns, [
    "assigned_to_user_id",
    "user_id",
    "employee_id",
    "assignee_id",
    "assigned_user_id",
  ]);

  if (!userColumn) {
    throw new Error(
      "No user column found in project_assignments table. Expected assigned_to_user_id, user_id, employee_id, assignee_id, or assigned_user_id."
    );
  }

  return userColumn;
};

const getProjectColumnsMap = async (connection = db) => {
  const columns = await getColumnNames("projects", connection);

  return {
    columns,
    id: "project_id",
    title: findColumn(columns, ["project_title", "title", "project_name"]),
    description: findColumn(columns, [
      "project_description",
      "description",
      "project_details",
    ]),
    startDate: findColumn(columns, ["start_date", "project_start_date"]),
    endDate: findColumn(columns, ["end_date", "due_date", "project_end_date"]),
    status: findColumn(columns, ["status", "project_status"]),
    progress: findColumn(columns, ["overall_progress", "progress"]),
    departmentId: findColumn(columns, ["department_id"]),
    createdBy: findColumn(columns, [
      "created_by_user_id",
      "created_by",
      "admin_id",
      "assigned_by_user_id",
    ]),
    createdAt: findColumn(columns, ["created_at"]),
    updatedAt: findColumn(columns, ["updated_at"]),
  };
};

const getTaskColumnsMap = async (connection = db) => {
  const columns = await getColumnNames("tasks", connection);

  return {
    columns,
    id: "task_id",
    projectId: findColumn(columns, ["project_id"]),
    parentTaskId: findColumn(columns, ["parent_task_id"]),
    title: findColumn(columns, ["task_title", "title", "main_task_title"]),
    description: findColumn(columns, [
      "task_description",
      "description",
      "main_task_description",
    ]),
    assignedTo: findColumn(columns, [
      "assigned_to_user_id",
      "assignee_id",
      "employee_id",
      "user_id",
    ]),
    createdBy: findColumn(columns, ["created_by_user_id", "created_by"]),
    taskType: findColumn(columns, ["task_type"]),
    status: findColumn(columns, ["status", "task_status"]),
    progress: findColumn(columns, ["progress", "task_progress"]),
    startDate: findColumn(columns, ["start_date"]),
    dueDate: findColumn(columns, ["due_date", "end_date"]),
    isChecked: findColumn(columns, ["is_checked"]),
    createdAt: findColumn(columns, ["created_at"]),
    updatedAt: findColumn(columns, ["updated_at"]),
  };
};

const syncProjectAssignments = async (
  connection,
  projectId,
  assigneeIds,
  assignedByUserId
) => {
  const columns = await getColumnNames("project_assignments", connection);
  const assignmentUserColumn = await getProjectAssignmentUserColumn(connection);

  await connection.query(
    `
      DELETE FROM project_assignments
      WHERE project_id = ?
    `,
    [projectId]
  );

  for (const userId of assigneeIds) {
    const insertColumns = ["project_id", assignmentUserColumn];
    const values = [projectId, userId];

    if (hasColumn(columns, "assigned_by_user_id")) {
      insertColumns.push("assigned_by_user_id");
      values.push(assignedByUserId || null);
    }

    if (hasColumn(columns, "created_by_user_id")) {
      insertColumns.push("created_by_user_id");
      values.push(assignedByUserId || null);
    }

    if (hasColumn(columns, "assigned_at")) {
      insertColumns.push("assigned_at");
      values.push(new Date());
    }

    if (hasColumn(columns, "created_at")) {
      insertColumns.push("created_at");
      values.push(new Date());
    }

    if (hasColumn(columns, "updated_at")) {
      insertColumns.push("updated_at");
      values.push(new Date());
    }

    const placeholders = insertColumns.map(() => "?").join(", ");

    await connection.query(
      `
        INSERT INTO project_assignments (${insertColumns.join(", ")})
        VALUES (${placeholders})
      `,
      values
    );
  }
};

const getAssignableUsersForAdminProjects = async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT
        u.user_id,
        u.full_name,
        u.email,
        u.employee_code,
        u.designation,
        u.status,
        d.department_name,
        r.role_name
      FROM users u
      LEFT JOIN departments d ON d.department_id = u.department_id
      LEFT JOIN roles r ON r.role_id = u.role_id
      WHERE LOWER(COALESCE(u.status, 'active')) = 'active'
      ORDER BY d.department_name ASC, u.full_name ASC
    `);

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Get assignable users error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch assignable users.",
      error: error.message,
    });
  }
};

const getAdminProjects = async (req, res) => {
  try {
    const adminUserId = getLoggedInUserId(req);
    const adminDepartmentId = getLoggedInDepartmentId(req);

    const projectMap = await getProjectColumnsMap();
    const taskMap = await getTaskColumnsMap();
    const assignmentUserColumn = await getProjectAssignmentUserColumn();

    const projectSelect = [
      `p.project_id AS project_id`,
      projectMap.title
        ? `p.${projectMap.title} AS project_title`
        : `'Untitled Project' AS project_title`,
      projectMap.description
        ? `p.${projectMap.description} AS project_description`
        : `'' AS project_description`,
      projectMap.startDate
        ? `p.${projectMap.startDate} AS start_date`
        : `NULL AS start_date`,
      projectMap.endDate
        ? `p.${projectMap.endDate} AS end_date`
        : `NULL AS end_date`,
      projectMap.status ? `p.${projectMap.status} AS status` : `'to_do' AS status`,
      projectMap.progress
        ? `p.${projectMap.progress} AS overall_progress`
        : `0 AS overall_progress`,
      projectMap.departmentId
        ? `p.${projectMap.departmentId} AS department_id`
        : `NULL AS department_id`,
      projectMap.createdBy
        ? `p.${projectMap.createdBy} AS created_by_user_id`
        : `NULL AS created_by_user_id`,
      `creator.full_name AS created_by_name`,
      `creator.email AS created_by_email`,
      `d.department_name AS department_name`,
    ];

    const whereParts = [];
    const whereValues = [];

    if (projectMap.departmentId && adminDepartmentId) {
      whereParts.push(`p.${projectMap.departmentId} = ?`);
      whereValues.push(adminDepartmentId);
    }

    if (projectMap.createdBy && adminUserId) {
      whereParts.push(`p.${projectMap.createdBy} = ?`);
      whereValues.push(adminUserId);
    }

    const whereClause = whereParts.length
      ? `WHERE (${whereParts.join(" OR ")})`
      : "";

    const [projectRows] = await db.query(
      `
        SELECT
          ${projectSelect.join(",\n          ")}
        FROM projects p
        LEFT JOIN users creator
          ON ${
            projectMap.createdBy
              ? `creator.user_id = p.${projectMap.createdBy}`
              : "1 = 0"
          }
        LEFT JOIN departments d
          ON ${
            projectMap.departmentId
              ? `d.department_id = p.${projectMap.departmentId}`
              : "1 = 0"
          }
        ${whereClause}
        ORDER BY p.project_id DESC
      `,
      whereValues
    );

    if (!projectRows.length) {
      return res.status(200).json({
        success: true,
        projects: [],
      });
    }

    const projectIds = projectRows.map((project) => project.project_id);

    const [assignmentRows] = await db.query(
      `
        SELECT
          pa.project_id,
          u.user_id,
          u.full_name,
          u.email,
          u.employee_code,
          u.designation,
          u.status,
          d.department_name,
          r.role_name
        FROM project_assignments pa
        INNER JOIN users u ON u.user_id = pa.${assignmentUserColumn}
        LEFT JOIN departments d ON d.department_id = u.department_id
        LEFT JOIN roles r ON r.role_id = u.role_id
        WHERE pa.project_id IN (?)
        ORDER BY u.full_name ASC
      `,
      [projectIds]
    );

    let taskRows = [];

    if (taskMap.projectId) {
      const topLevelWhere = taskMap.parentTaskId
        ? `AND (t.${taskMap.parentTaskId} IS NULL OR t.${taskMap.parentTaskId} = 0)`
        : "";

      const [tasks] = await db.query(
        `
          SELECT
            t.task_id,
            t.${taskMap.projectId} AS project_id,
            ${
              taskMap.title
                ? `t.${taskMap.title} AS task_title`
                : `'Main Task' AS task_title`
            },
            ${
              taskMap.description
                ? `t.${taskMap.description} AS task_description`
                : `'' AS task_description`
            },
            ${
              taskMap.status
                ? `t.${taskMap.status} AS status`
                : `'to_do' AS status`
            },
            ${
              taskMap.progress
                ? `t.${taskMap.progress} AS progress`
                : `0 AS progress`
            },
            ${
              taskMap.assignedTo
                ? `t.${taskMap.assignedTo} AS assigned_to_user_id`
                : `NULL AS assigned_to_user_id`
            },
            ${
              taskMap.createdBy
                ? `t.${taskMap.createdBy} AS created_by_user_id`
                : `NULL AS created_by_user_id`
            },
            ${
              taskMap.startDate
                ? `t.${taskMap.startDate} AS start_date`
                : `NULL AS start_date`
            },
            ${
              taskMap.dueDate
                ? `t.${taskMap.dueDate} AS due_date`
                : `NULL AS due_date`
            },
            au.full_name AS assignee_name,
            au.email AS assignee_email,
            au.employee_code AS assignee_employee_code,
            au.designation AS assignee_designation,
            ad.department_name AS assignee_department_name
          FROM tasks t
          LEFT JOIN users au
            ON ${
              taskMap.assignedTo
                ? `au.user_id = t.${taskMap.assignedTo}`
                : "1 = 0"
            }
          LEFT JOIN departments ad ON ad.department_id = au.department_id
          WHERE t.${taskMap.projectId} IN (?)
          ${topLevelWhere}
          ORDER BY t.task_id DESC
        `,
        [projectIds]
      );

      taskRows = tasks;
    }

    const assignmentMap = new Map();
    assignmentRows.forEach((row) => {
      const projectId = row.project_id;

      if (!assignmentMap.has(projectId)) {
        assignmentMap.set(projectId, []);
      }

      assignmentMap.get(projectId).push({
        user_id: row.user_id,
        full_name: row.full_name,
        email: row.email,
        employee_code: row.employee_code,
        designation: row.designation,
        status: row.status,
        department_name: row.department_name,
        role_name: row.role_name,
      });
    });

    const taskMapByProject = new Map();

    taskRows.forEach((task) => {
      const projectId = task.project_id;

      if (!taskMapByProject.has(projectId)) {
        taskMapByProject.set(projectId, new Map());
      }

      const groupKey = [
        task.project_id,
        task.task_title,
        task.task_description,
        formatDateOnly(task.start_date),
        formatDateOnly(task.due_date),
        task.created_by_user_id || "",
      ].join("::");

      const projectTaskGroups = taskMapByProject.get(projectId);

      if (!projectTaskGroups.has(groupKey)) {
        projectTaskGroups.set(groupKey, {
          task_id: task.task_id,
          task_ids: [task.task_id],
          project_id: task.project_id,
          task_title: task.task_title,
          task_description: task.task_description,
          status: task.status,
          progress: Number(task.progress || 0),
          start_date: formatDateOnly(task.start_date),
          due_date: formatDateOnly(task.due_date),
          completed_subtasks: 0,
          total_subtasks: 0,
          assignees: [],
        });
      } else {
        projectTaskGroups.get(groupKey).task_ids.push(task.task_id);
      }

      if (task.assigned_to_user_id) {
        projectTaskGroups.get(groupKey).assignees.push({
          user_id: task.assigned_to_user_id,
          full_name: task.assignee_name,
          email: task.assignee_email,
          employee_code: task.assignee_employee_code,
          designation: task.assignee_designation,
          department_name: task.assignee_department_name,
        });
      }
    });

    const projects = projectRows.map((project) => {
      const taskGroups = taskMapByProject.get(project.project_id);
      const mainTasks = taskGroups ? [...taskGroups.values()] : [];

      return {
        ...project,
        start_date: formatDateOnly(project.start_date),
        end_date: formatDateOnly(project.end_date),
        overall_progress: Number(project.overall_progress || 0),
        assignees: assignmentMap.get(project.project_id) || [],
        main_tasks: mainTasks,
      };
    });

    return res.status(200).json({
      success: true,
      projects,
    });
  } catch (error) {
    console.error("Get admin projects error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch projects.",
      error: error.message,
    });
  }
};
const createAdminProject = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const adminUserId = getLoggedInUserId(req);
    const adminDepartmentId = getLoggedInDepartmentId(req);

    const adminUser = {
      user_id: adminUserId,
      full_name: req.user?.full_name || req.user?.name || "Admin",
      email: req.user?.email || process.env.SMTP_USER,
    };

const projectTitle =
  req.body.project_title ||
  req.body.title ||
  req.body.project_name;

const projectDescription =
  req.body.project_description ||
  req.body.description ||
  req.body.project_details ||
  "";

const startDate =
  req.body.start_date ||
  req.body.startDate ||
  req.body.project_start_date;

const endDate =
  req.body.end_date ||
  req.body.endDate ||
  req.body.due_date ||
  req.body.dueDate ||
  req.body.project_end_date;;

    const assigneeIds = normalizeIdArray(
      req.body.assignee_ids || req.body.assignees || req.body.project_assignees
    );

    if (!projectTitle || !String(projectTitle).trim()) {
      return res.status(400).json({
        success: false,
        message: "Project title is required.",
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required.",
      });
    }

    if (!assigneeIds.length) {
      return res.status(400).json({
        success: false,
        message: "Select at least one project assignee.",
      });
    }

    await connection.beginTransaction();

    const projectMap = await getProjectColumnsMap(connection);

    const insertColumns = [];
    const values = [];

    if (projectMap.title) {
      insertColumns.push(projectMap.title);
      values.push(String(projectTitle).trim());
    }

    if (projectMap.description) {
      insertColumns.push(projectMap.description);
      values.push(String(projectDescription).trim());
    }

    if (projectMap.startDate) {
      insertColumns.push(projectMap.startDate);
      values.push(startDate);
    }

    if (projectMap.endDate) {
      insertColumns.push(projectMap.endDate);
      values.push(endDate);
    }

    if (projectMap.status) {
      const defaultProjectStatus = await getBestEnumValue(
        "projects",
        projectMap.status,
        ["not_started", "to_do", "pending", "ongoing"],
        "not_started",
        connection
      );

      insertColumns.push(projectMap.status);
      values.push(defaultProjectStatus);
    }

    if (projectMap.progress) {
      insertColumns.push(projectMap.progress);
      values.push(0);
    }

    if (projectMap.createdBy) {
      insertColumns.push(projectMap.createdBy);
      values.push(adminUserId || null);
    }

    if (projectMap.departmentId) {
      insertColumns.push(projectMap.departmentId);
      values.push(adminDepartmentId || null);
    }

    if (projectMap.createdAt) {
      insertColumns.push(projectMap.createdAt);
      values.push(new Date());
    }

    if (projectMap.updatedAt) {
      insertColumns.push(projectMap.updatedAt);
      values.push(new Date());
    }

    const placeholders = insertColumns.map(() => "?").join(", ");

    const [projectResult] = await connection.query(
      `
        INSERT INTO projects (${insertColumns.join(", ")})
        VALUES (${placeholders})
      `,
      values
    );

    const projectId = projectResult.insertId;

    await syncProjectAssignments(
      connection,
      projectId,
      assigneeIds,
      adminUserId
    );

    await connection.commit();

    const emailSummary = await sendProjectAssignmentEmails(projectId, adminUser);

    return res.status(201).json({
      success: true,
      message: "Project created successfully.",
      project_id: projectId,
      assignee_ids: assigneeIds,
      email_summary: emailSummary,
    });
  } catch (error) {
    await connection.rollback();

    console.error("Create admin project error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create project.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

const updateAdminProject = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const adminUserId = getLoggedInUserId(req);
    const projectId = Number(req.params.projectId || req.params.id);

    const adminUser = {
      user_id: adminUserId,
      full_name: req.user?.full_name || req.user?.name || "Admin",
      email: req.user?.email || process.env.SMTP_USER,
    };

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required.",
      });
    }

    const projectTitle = req.body.project_title || req.body.title;
    const projectDescription =
      req.body.project_description || req.body.description || "";
    const startDate = req.body.start_date;
    const endDate = req.body.end_date;

    const assigneeIds = normalizeIdArray(
      req.body.assignee_ids || req.body.assignees || req.body.project_assignees
    );

    if (!projectTitle || !String(projectTitle).trim()) {
      return res.status(400).json({
        success: false,
        message: "Project title is required.",
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required.",
      });
    }

    if (!assigneeIds.length) {
      return res.status(400).json({
        success: false,
        message: "Select at least one project assignee.",
      });
    }

    await connection.beginTransaction();

    const projectMap = await getProjectColumnsMap(connection);

    const [projectRows] = await connection.query(
      `
        SELECT project_id
        FROM projects
        WHERE project_id = ?
        LIMIT 1
      `,
      [projectId]
    );

    if (!projectRows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    const updateParts = [];
    const values = [];

    if (projectMap.title) {
      updateParts.push(`${projectMap.title} = ?`);
      values.push(String(projectTitle).trim());
    }

    if (projectMap.description) {
      updateParts.push(`${projectMap.description} = ?`);
      values.push(String(projectDescription).trim());
    }

    if (projectMap.startDate) {
      updateParts.push(`${projectMap.startDate} = ?`);
      values.push(startDate);
    }

    if (projectMap.endDate) {
      updateParts.push(`${projectMap.endDate} = ?`);
      values.push(endDate);
    }

    if (projectMap.updatedAt) {
      updateParts.push(`${projectMap.updatedAt} = ?`);
      values.push(new Date());
    }

    if (updateParts.length) {
      values.push(projectId);

      await connection.query(
        `
          UPDATE projects
          SET ${updateParts.join(", ")}
          WHERE project_id = ?
        `,
        values
      );
    }

    await syncProjectAssignments(
      connection,
      projectId,
      assigneeIds,
      adminUserId
    );

    await connection.commit();

   const emailSummary = await sendProjectUpdateEmails(projectId, adminUser, {
  projectTitle,
  projectDescription,
  startDate,
  endDate,
  dueDate: endDate,
});
    return res.status(200).json({
      success: true,
      message: "Project updated successfully.",
      project_id: projectId,
      assignee_ids: assigneeIds,
      email_summary: emailSummary,
    });
  } catch (error) {
    await connection.rollback();

    console.error("Update admin project error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update project.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

const deleteAdminProject = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const projectId = Number(req.params.projectId || req.params.id);

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required.",
      });
    }

    await connection.beginTransaction();

    await connection.query(
      `
        DELETE FROM project_assignments
        WHERE project_id = ?
      `,
      [projectId]
    );

    await connection.query(
      `
        DELETE FROM tasks
        WHERE project_id = ?
      `,
      [projectId]
    );

    const [result] = await connection.query(
      `
        DELETE FROM projects
        WHERE project_id = ?
      `,
      [projectId]
    );

    if (!result.affectedRows) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Project deleted successfully.",
    });
  } catch (error) {
    await connection.rollback();

    console.error("Delete admin project error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete project.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

const insertMainTaskRows = async (
  connection,
  projectId,
  taskTitle,
  taskDescription,
  assigneeIds,
  createdByUserId
) => {
  const taskMap = await getTaskColumnsMap(connection);

  if (!taskMap.projectId || !taskMap.title) {
    throw new Error("tasks table must have project_id and task_title/title.");
  }

  const taskStatus = taskMap.status
    ? await getBestEnumValue(
        "tasks",
        taskMap.status,
        ["to_do", "not_started", "pending", "ongoing", "in_progress"],
        "to_do",
        connection
      )
    : null;

  const [projectRows] = await connection.query(
    `
      SELECT *
      FROM projects
      WHERE project_id = ?
      LIMIT 1
    `,
    [projectId]
  );

  const project = projectRows[0] || {};
  const projectMap = await getProjectColumnsMap(connection);

  const projectStartDate = projectMap.startDate
    ? formatDateOnly(project[projectMap.startDate])
    : null;

  const projectEndDate = projectMap.endDate
    ? formatDateOnly(project[projectMap.endDate])
    : null;

  const createdTaskIds = [];

  for (const userId of assigneeIds) {
    const insertColumns = [];
    const values = [];

    insertColumns.push(taskMap.projectId);
    values.push(projectId);

    if (taskMap.parentTaskId) {
      insertColumns.push(taskMap.parentTaskId);
      values.push(null);
    }

    insertColumns.push(taskMap.title);
    values.push(String(taskTitle).trim());

    if (taskMap.description) {
      insertColumns.push(taskMap.description);
      values.push(String(taskDescription || "").trim());
    }

    if (taskMap.assignedTo) {
      insertColumns.push(taskMap.assignedTo);
      values.push(userId);
    }

    if (taskMap.createdBy) {
      insertColumns.push(taskMap.createdBy);
      values.push(createdByUserId || null);
    }

    if (taskMap.taskType) {
      insertColumns.push(taskMap.taskType);
      values.push("main");
    }

    if (taskMap.status) {
      insertColumns.push(taskMap.status);
      values.push(taskStatus);
    }

    if (taskMap.progress) {
      insertColumns.push(taskMap.progress);
      values.push(0);
    }

    if (taskMap.startDate) {
      insertColumns.push(taskMap.startDate);
      values.push(projectStartDate);
    }

    if (taskMap.dueDate) {
      insertColumns.push(taskMap.dueDate);
      values.push(projectEndDate);
    }

    if (taskMap.isChecked) {
      insertColumns.push(taskMap.isChecked);
      values.push(0);
    }

    if (taskMap.createdAt) {
      insertColumns.push(taskMap.createdAt);
      values.push(new Date());
    }

    if (taskMap.updatedAt) {
      insertColumns.push(taskMap.updatedAt);
      values.push(new Date());
    }

    const placeholders = insertColumns.map(() => "?").join(", ");

    const [taskResult] = await connection.query(
      `
        INSERT INTO tasks (${insertColumns.join(", ")})
        VALUES (${placeholders})
      `,
      values
    );

    createdTaskIds.push(taskResult.insertId);
  }

  return createdTaskIds;
};

const createMainTask = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const adminUserId = getLoggedInUserId(req);

    const adminUser = {
      user_id: adminUserId,
      full_name: req.user?.full_name || req.user?.name || "Admin",
      email: req.user?.email || process.env.SMTP_USER,
    };

    const projectId = Number(req.params.projectId || req.body.project_id);
    const taskTitle = req.body.task_title || req.body.title;
    const taskDescription =
      req.body.task_description || req.body.description || "";

    const assigneeIds = normalizeIdArray(
      req.body.assignee_ids ||
        req.body.assignees ||
        req.body.assigned_to_user_ids
    );

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required.",
      });
    }

    if (!taskTitle || !String(taskTitle).trim()) {
      return res.status(400).json({
        success: false,
        message: "Main task title is required.",
      });
    }

    if (!assigneeIds.length) {
      return res.status(400).json({
        success: false,
        message: "Select at least one assignee for the main task.",
      });
    }

    await connection.beginTransaction();

    const createdTaskIds = await insertMainTaskRows(
      connection,
      projectId,
      taskTitle,
      taskDescription,
      assigneeIds,
      adminUserId
    );

    await connection.commit();

    const emailSummary = await sendMainTaskAssignmentEmails(
      projectId,
      createdTaskIds,
      adminUser
    );

    return res.status(201).json({
      success: true,
      message: "Main task added successfully.",
      task_ids: createdTaskIds,
      email_summary: emailSummary,
    });
  } catch (error) {
    await connection.rollback();

    console.error("Create main task error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add main task.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};
const updateMainTask = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const adminUserId = getLoggedInUserId(req);

    const adminUser = {
      user_id: adminUserId,
      full_name: req.user?.full_name || req.user?.name || "Admin",
      email: req.user?.email || process.env.SMTP_USER,
    };

    const taskId = Number(req.params.taskId || req.body.task_id);
    const projectIdFromRequest = Number(
      req.params.projectId || req.body.project_id
    );

    const taskTitle = req.body.task_title || req.body.title;
    const taskDescription =
      req.body.task_description || req.body.description || "";

    const assigneeIds = normalizeIdArray(
      req.body.assignee_ids ||
        req.body.assignees ||
        req.body.assigned_to_user_ids
    );

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: "Task ID is required.",
      });
    }

    if (!taskTitle || !String(taskTitle).trim()) {
      return res.status(400).json({
        success: false,
        message: "Main task title is required.",
      });
    }

    if (!assigneeIds.length) {
      return res.status(400).json({
        success: false,
        message: "Select at least one assignee for the main task.",
      });
    }

    await connection.beginTransaction();

    const taskMap = await getTaskColumnsMap(connection);

    const [existingRows] = await connection.query(
      `
        SELECT *
        FROM tasks
        WHERE task_id = ?
        LIMIT 1
      `,
      [taskId]
    );

    if (!existingRows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Main task not found.",
      });
    }

    const existingTask = existingRows[0];

    const projectId =
      projectIdFromRequest ||
      Number(taskMap.projectId ? existingTask[taskMap.projectId] : 0);

    if (!projectId) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Project ID not found for this task.",
      });
    }

    const existingTitle = taskMap.title ? existingTask[taskMap.title] : "";
    const existingDescription = taskMap.description
      ? existingTask[taskMap.description]
      : "";

    const siblingWhere = [];
    const siblingValues = [];

    if (taskMap.projectId) {
      siblingWhere.push(`${taskMap.projectId} = ?`);
      siblingValues.push(projectId);
    }

    if (taskMap.title) {
      siblingWhere.push(`${taskMap.title} = ?`);
      siblingValues.push(existingTitle);
    }

    if (taskMap.description) {
      siblingWhere.push(`COALESCE(${taskMap.description}, '') = ?`);
      siblingValues.push(existingDescription || "");
    }

    if (taskMap.parentTaskId) {
      siblingWhere.push(
        `(${taskMap.parentTaskId} IS NULL OR ${taskMap.parentTaskId} = 0)`
      );
    }

    if (siblingWhere.length) {
      await connection.query(
        `
          DELETE FROM tasks
          WHERE ${siblingWhere.join(" AND ")}
        `,
        siblingValues
      );
    } else {
      await connection.query(
        `
          DELETE FROM tasks
          WHERE task_id = ?
        `,
        [taskId]
      );
    }

    const createdTaskIds = await insertMainTaskRows(
      connection,
      projectId,
      taskTitle,
      taskDescription,
      assigneeIds,
      adminUserId
    );

    await connection.commit();

    const emailSummary = await sendMainTaskAssignmentEmails(
      projectId,
      createdTaskIds,
      adminUser
    );

    return res.status(200).json({
      success: true,
      message: "Main task updated successfully.",
      task_ids: createdTaskIds,
      email_summary: emailSummary,
    });
  } catch (error) {
    await connection.rollback();

    console.error("Update main task error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update main task.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};
module.exports = {
  getAdminProjects,
  getDepartmentProjects: getAdminProjects,
  getDepartmentProjectsForAdmin: getAdminProjects,
  getProjects: getAdminProjects,
  getAllProjects: getAdminProjects,

  createAdminProject,
  createProject: createAdminProject,
  assignProject: createAdminProject,
  addProject: createAdminProject,

  updateAdminProject,
  updateProject: updateAdminProject,
  updateProjectDetails: updateAdminProject,
  editProject: updateAdminProject,

  deleteAdminProject,
  deleteProject: deleteAdminProject,
  removeProject: deleteAdminProject,

  getAssignableUsersForAdminProjects,
  getAssignableUsers: getAssignableUsersForAdminProjects,
  getAdminProjectUsers: getAssignableUsersForAdminProjects,
  getProjectUsers: getAssignableUsersForAdminProjects,
  getUsersForProjects: getAssignableUsersForAdminProjects,

  createMainTask,
  addMainTask: createMainTask,
  createProjectTask: createMainTask,
  addProjectTask: createMainTask,
  createAdminProjectTask: createMainTask,

  updateMainTask,
  updateProjectTask: updateMainTask,
  updateAdminProjectTask: updateMainTask,
  editMainTask: updateMainTask,
};
const db = require("../config/db");

const escapeId = (value) => {
  return `\`${String(value).replace(/`/g, "``")}\``;
};

const tableExists = async (tableName) => {
  const [rows] = await db.query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
};

const getTableColumnInfo = async (tableName) => {
  const [columns] = await db.query(`SHOW COLUMNS FROM ${escapeId(tableName)}`);
  return columns;
};

const pickColumn = (columns, possibleNames) => {
  return possibleNames.find((name) => columns.includes(name));
};

const formatDateOnly = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const normalizeStatusGroup = (status) => {
  const value = String(status || "").toLowerCase().trim().replace(/\s+/g, "_");

  if (
    value === "todo" ||
    value === "to_do" ||
    value === "pending" ||
    value === "not_started" ||
    value === "not-started"
  ) {
    return "todo";
  }

  if (value === "in_progress" || value === "progress" || value === "ongoing") {
    return "in_progress";
  }

  if (value === "under_review" || value === "review") {
    return "under_review";
  }

  if (value === "done" || value === "completed" || value === "complete") {
    return "done";
  }

  if (value === "rejected" || value === "reject") {
    return "rejected";
  }

  if (value === "on_hold" || value === "hold") {
    return "on_hold";
  }

  return "todo";
};

const getStatusLabel = (status) => {
  const group = normalizeStatusGroup(status);

  if (group === "todo") return "To Do";
  if (group === "in_progress") return "In Progress";
  if (group === "under_review") return "Under Review";
  if (group === "done") return "Done";
  if (group === "rejected") return "Rejected";
  if (group === "on_hold") return "On Hold";

  return "To Do";
};

const getLoggedInAdmin = async (req) => {
  const loggedInUserId =
    req.user?.user_id || req.user?.id || req.user?.userId || req.user?.uid;

  if (!loggedInUserId) {
    return {
      error: {
        status: 401,
        message: "Unauthorized. User not found in token.",
      },
    };
  }

  const [rows] = await db.query(
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
      LEFT JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN departments d ON u.department_id = d.department_id
      WHERE u.user_id = ?
      LIMIT 1
    `,
    [loggedInUserId]
  );

  if (!rows.length) {
    return {
      error: {
        status: 404,
        message: "Logged-in admin not found.",
      },
    };
  }

  const adminUser = rows[0];
  const roleName = String(adminUser.role_name || "").toLowerCase().trim();

  if (roleName !== "admin") {
    return {
      error: {
        status: 403,
        message: "Only admin users can access this page.",
      },
    };
  }

  if (!adminUser.department_id) {
    return {
      error: {
        status: 400,
        message: "Admin department is not assigned.",
      },
    };
  }

  return { adminUser };
};

const ensureProjectSubtasksTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS project_subtasks (
      subtask_id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      task_id INT NULL,
      title VARCHAR(255) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'todo',
      start_date DATE NULL,
      end_date DATE NULL,
      created_by INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_project_subtasks_project_id (project_id),
      INDEX idx_project_subtasks_task_id (task_id),
      INDEX idx_project_subtasks_created_by (created_by)
    )
  `);
};

const getProjectAssignmentUserColumn = async () => {
  const exists = await tableExists("project_assignments");
  if (!exists) return null;

  const assignmentColumnInfo = await getTableColumnInfo("project_assignments");
  const assignmentColumns = assignmentColumnInfo.map((col) => col.Field);

  return pickColumn(assignmentColumns, [
    "assigned_to_user_id",
    "user_id",
    "employee_id",
    "assignee_id",
    "assigned_user_id",
  ]);
};

const dedupeUsers = (users) => {
  const map = new Map();

  users.forEach((user) => {
    const id = user.user_id || user.email;
    if (!id) return;

    if (!map.has(String(id))) {
      map.set(String(id), user);
    }
  });

  return Array.from(map.values());
};

const getDepartmentTasks = async (req, res) => {
  try {
    await ensureProjectSubtasksTable();

    const { adminUser, error } = await getLoggedInAdmin(req);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const taskColumnInfo = await getTableColumnInfo("tasks");
    const taskColumns = taskColumnInfo.map((col) => col.Field);

    const taskIdColumn = pickColumn(taskColumns, ["task_id", "id"]);
    const taskProjectIdColumn = pickColumn(taskColumns, ["project_id"]);
    const taskParentTaskIdColumn = pickColumn(taskColumns, ["parent_task_id"]);
    const taskTypeColumn = pickColumn(taskColumns, ["task_type"]);

    const taskTitleColumn = pickColumn(taskColumns, [
      "task_title",
      "title",
      "task_name",
      "name",
    ]);

    const taskDescriptionColumn = pickColumn(taskColumns, [
      "description",
      "task_description",
      "details",
      "main_task",
    ]);

    const taskStatusColumn = pickColumn(taskColumns, ["status", "task_status"]);

    const taskAssignedToColumn = pickColumn(taskColumns, [
      "assigned_to",
      "assigned_to_user_id",
      "assignee_id",
      "user_id",
    ]);

    const taskStartDateColumn = pickColumn(taskColumns, [
      "start_date",
      "task_start_date",
    ]);

    const taskEndDateColumn = pickColumn(taskColumns, [
      "due_date",
      "end_date",
      "task_end_date",
      "deadline",
    ]);

    const taskCreatedAtColumn = pickColumn(taskColumns, ["created_at"]);
    const taskIsCheckedColumn = pickColumn(taskColumns, ["is_checked"]);

    if (!taskIdColumn || !taskAssignedToColumn) {
      return res.status(500).json({
        message:
          "tasks table must have task_id/id and assigned_to/assigned_to_user_id/assignee_id/user_id column.",
        taskColumns,
      });
    }

    const projectColumnInfo = await getTableColumnInfo("projects");
    const projectColumns = projectColumnInfo.map((col) => col.Field);

    const projectIdColumn = pickColumn(projectColumns, ["project_id", "id"]);

    const projectTitleColumn = pickColumn(projectColumns, [
      "project_title",
      "title",
      "project_name",
      "name",
    ]);

    const projectDescriptionColumn = pickColumn(projectColumns, [
      "description",
      "project_description",
      "main_task",
      "details",
    ]);

    const projectStatusColumn = pickColumn(projectColumns, [
      "status",
      "project_status",
    ]);

    const projectStartDateColumn = pickColumn(projectColumns, [
      "start_date",
      "project_start_date",
    ]);

    const projectEndDateColumn = pickColumn(projectColumns, [
      "due_date",
      "end_date",
      "project_end_date",
      "deadline",
    ]);

    const projectCreatedByColumn = pickColumn(projectColumns, [
      "created_by",
      "created_by_user_id",
      "created_by_id",
      "admin_id",
      "assigned_by_user_id",
    ]);

    const projectDepartmentColumn = pickColumn(projectColumns, ["department_id"]);

    const scopeWhereParts = [`assignee.department_id = ?`];
    const scopeWhereValues = [adminUser.department_id];

    if (projectCreatedByColumn) {
      scopeWhereParts.push(`p.${escapeId(projectCreatedByColumn)} = ?`);
      scopeWhereValues.push(adminUser.user_id);
    }

    if (projectDepartmentColumn) {
      scopeWhereParts.push(`p.${escapeId(projectDepartmentColumn)} = ?`);
      scopeWhereValues.push(adminUser.department_id);
    }

    const mainTaskWhereParts = [`(${scopeWhereParts.join(" OR ")})`];

    if (taskParentTaskIdColumn) {
      mainTaskWhereParts.push(
        `(t.${escapeId(taskParentTaskIdColumn)} IS NULL OR t.${escapeId(
          taskParentTaskIdColumn
        )} = 0)`
      );
    }

    if (taskTypeColumn) {
      mainTaskWhereParts.push(
        `(t.${escapeId(taskTypeColumn)} IS NULL OR LOWER(t.${escapeId(
          taskTypeColumn
        )}) NOT IN ('subtask', 'sub_task'))`
      );
    }

    const [taskRows] = await db.query(
      `
        SELECT
          t.${escapeId(taskIdColumn)} AS task_id,
          ${
            taskProjectIdColumn
              ? `t.${escapeId(taskProjectIdColumn)}`
              : "NULL"
          } AS project_id,
          ${
            taskTitleColumn
              ? `t.${escapeId(taskTitleColumn)}`
              : "'Untitled Task'"
          } AS task_title,
          ${
            taskDescriptionColumn
              ? `t.${escapeId(taskDescriptionColumn)}`
              : "NULL"
          } AS task_description,
          ${
            taskStatusColumn
              ? `t.${escapeId(taskStatusColumn)}`
              : "'todo'"
          } AS task_status,
          ${
            taskStartDateColumn
              ? `t.${escapeId(taskStartDateColumn)}`
              : "NULL"
          } AS task_start_date,
          ${
            taskEndDateColumn
              ? `t.${escapeId(taskEndDateColumn)}`
              : "NULL"
          } AS task_end_date,
          ${
            taskCreatedAtColumn
              ? `t.${escapeId(taskCreatedAtColumn)}`
              : "NULL"
          } AS task_created_at,

          assignee.user_id AS assigned_user_id,
          assignee.employee_code AS assigned_employee_code,
          assignee.full_name AS assigned_name,
          assignee.email AS assigned_email,
          assignee.designation AS assigned_designation,
          assignee.department_id AS assigned_department_id,
          d.department_name AS assigned_department_name,
          r.role_name AS assigned_role_name,

          ${
            projectIdColumn && taskProjectIdColumn
              ? `p.${escapeId(projectIdColumn)}`
              : "NULL"
          } AS linked_project_id,
          ${
            projectTitleColumn && taskProjectIdColumn
              ? `p.${escapeId(projectTitleColumn)}`
              : "NULL"
          } AS project_title,
          ${
            projectDescriptionColumn && taskProjectIdColumn
              ? `p.${escapeId(projectDescriptionColumn)}`
              : "NULL"
          } AS project_description,
          ${
            projectStatusColumn && taskProjectIdColumn
              ? `p.${escapeId(projectStatusColumn)}`
              : "NULL"
          } AS project_status,
          ${
            projectStartDateColumn && taskProjectIdColumn
              ? `p.${escapeId(projectStartDateColumn)}`
              : "NULL"
          } AS project_start_date,
          ${
            projectEndDateColumn && taskProjectIdColumn
              ? `p.${escapeId(projectEndDateColumn)}`
              : "NULL"
          } AS project_end_date,
          creator.full_name AS created_by_name
        FROM tasks t
        INNER JOIN users assignee
          ON t.${escapeId(taskAssignedToColumn)} = assignee.user_id
        LEFT JOIN departments d
          ON assignee.department_id = d.department_id
        LEFT JOIN roles r
          ON assignee.role_id = r.role_id
        LEFT JOIN projects p
          ON ${
            projectIdColumn && taskProjectIdColumn
              ? `t.${escapeId(taskProjectIdColumn)} = p.${escapeId(
                  projectIdColumn
                )}`
              : "1 = 0"
          }
        LEFT JOIN users creator
          ON ${
            projectCreatedByColumn
              ? `p.${escapeId(projectCreatedByColumn)} = creator.user_id`
              : "1 = 0"
          }
        WHERE ${mainTaskWhereParts.join(" AND ")}
        ORDER BY t.${escapeId(taskIdColumn)} DESC
      `,
      scopeWhereValues
    );

    if (!taskRows.length) {
      return res.status(200).json({
        admin: adminUser,
        total: 0,
        statusCounts: {
          todo: 0,
          in_progress: 0,
          under_review: 0,
          done: 0,
          rejected: 0,
          on_hold: 0,
        },
        tasks: [],
      });
    }

    const taskIds = taskRows.map((task) => Number(task.task_id)).filter(Boolean);

    const projectIds = [
      ...new Set(
        taskRows.map((task) => Number(task.project_id)).filter(Boolean)
      ),
    ];

    let subtaskRows = [];

    if (taskIds.length > 0) {
      const [projectSubtasks] = await db.query(
        `
          SELECT
            CONCAT('project_subtask_', ps.subtask_id) AS subtask_key,
            ps.subtask_id,
            ps.project_id,
            ps.task_id,
            ps.title,
            ps.status,
            ps.start_date,
            ps.end_date,
            ps.created_at,
            ps.updated_at,
            creator.user_id AS created_by_user_id,
            creator.full_name AS created_by_name,
            creator.email AS created_by_email
          FROM project_subtasks ps
          LEFT JOIN users creator
            ON creator.user_id = ps.created_by
          WHERE ps.task_id IN (${taskIds.map(() => "?").join(",")})
          ORDER BY ps.subtask_id ASC
        `,
        taskIds
      );

      subtaskRows = projectSubtasks;
    }

    if (taskParentTaskIdColumn && taskIds.length > 0) {
      const childSubtaskWhereParts = [
        `child.${escapeId(taskParentTaskIdColumn)} IN (${taskIds
          .map(() => "?")
          .join(",")})`,
      ];

      const childSubtaskValues = [...taskIds];

      if (taskTypeColumn) {
        childSubtaskWhereParts.push(
          `(child.${escapeId(taskTypeColumn)} IS NULL OR LOWER(child.${escapeId(
            taskTypeColumn
          )}) IN ('subtask', 'sub_task'))`
        );
      }

      const [taskSubtasks] = await db.query(
        `
          SELECT
            CONCAT('task_subtask_', child.${escapeId(taskIdColumn)}) AS subtask_key,
            child.${escapeId(taskIdColumn)} AS subtask_id,
            ${
              taskProjectIdColumn
                ? `child.${escapeId(taskProjectIdColumn)}`
                : "NULL"
            } AS project_id,
            child.${escapeId(taskParentTaskIdColumn)} AS task_id,
            ${
              taskTitleColumn
                ? `child.${escapeId(taskTitleColumn)}`
                : "'Untitled Subtask'"
            } AS title,
            ${
              taskStatusColumn
                ? `child.${escapeId(taskStatusColumn)}`
                : taskIsCheckedColumn
                ? `CASE WHEN child.${escapeId(
                    taskIsCheckedColumn
                  )} = 1 THEN 'done' ELSE 'todo' END`
                : "'todo'"
            } AS status,
            ${
              taskStartDateColumn
                ? `child.${escapeId(taskStartDateColumn)}`
                : "NULL"
            } AS start_date,
            ${
              taskEndDateColumn
                ? `child.${escapeId(taskEndDateColumn)}`
                : "NULL"
            } AS end_date,
            ${
              taskCreatedAtColumn
                ? `child.${escapeId(taskCreatedAtColumn)}`
                : "NULL"
            } AS created_at,
            NULL AS updated_at,
            ${
              taskAssignedToColumn
                ? `child.${escapeId(taskAssignedToColumn)}`
                : "NULL"
            } AS created_by_user_id,
            subtask_user.full_name AS created_by_name,
            subtask_user.email AS created_by_email
          FROM tasks child
          LEFT JOIN users subtask_user
            ON ${
              taskAssignedToColumn
                ? `subtask_user.user_id = child.${escapeId(
                    taskAssignedToColumn
                  )}`
                : "1 = 0"
            }
          WHERE ${childSubtaskWhereParts.join(" AND ")}
          ORDER BY child.${escapeId(taskIdColumn)} ASC
        `,
        childSubtaskValues
      );

      subtaskRows = [...subtaskRows, ...taskSubtasks];
    }

    const projectAssignmentsByProject = new Map();

    const projectAssignmentUserColumn = await getProjectAssignmentUserColumn();

    if (projectIds.length > 0 && projectAssignmentUserColumn) {
      const [assignmentRows] = await db.query(
        `
          SELECT
            pa.project_id,
            u.user_id,
            u.employee_code,
            u.full_name,
            u.email,
            u.designation,
            u.department_id,
            d.department_name,
            r.role_name
          FROM project_assignments pa
          INNER JOIN users u
            ON u.user_id = pa.${escapeId(projectAssignmentUserColumn)}
          LEFT JOIN departments d
            ON u.department_id = d.department_id
          LEFT JOIN roles r
            ON u.role_id = r.role_id
          WHERE pa.project_id IN (${projectIds.map(() => "?").join(",")})
          ORDER BY u.full_name ASC
        `,
        projectIds
      );

      assignmentRows.forEach((row) => {
        const projectId = Number(row.project_id);

        if (!projectAssignmentsByProject.has(projectId)) {
          projectAssignmentsByProject.set(projectId, []);
        }

        projectAssignmentsByProject.get(projectId).push({
          user_id: row.user_id,
          employee_code: row.employee_code,
          full_name: row.full_name,
          email: row.email,
          designation: row.designation,
          department_id: row.department_id,
          department_name: row.department_name,
          role_name: row.role_name,
        });
      });
    }

    taskRows.forEach((task) => {
      const projectId = Number(task.project_id);
      if (!projectId) return;

      if (!projectAssignmentsByProject.has(projectId)) {
        projectAssignmentsByProject.set(projectId, []);
      }

      const current = projectAssignmentsByProject.get(projectId);

      current.push({
        user_id: task.assigned_user_id,
        employee_code: task.assigned_employee_code,
        full_name: task.assigned_name,
        email: task.assigned_email,
        designation: task.assigned_designation,
        department_id: task.assigned_department_id,
        department_name: task.assigned_department_name,
        role_name: task.assigned_role_name,
      });

      projectAssignmentsByProject.set(projectId, dedupeUsers(current));
    });

    let rejectedRows = [];

    const hasProjectRejections = await tableExists("project_rejections");

    if (hasProjectRejections && projectIds.length > 0) {
      const [rows] = await db.query(
        `
          SELECT
            project_id,
            assigned_user_id,
            rejected_at,
            expires_at,
            rejection_reason
          FROM project_rejections
          WHERE active = 1
          AND decision_status = 'pending'
          AND expires_at >= NOW()
          AND project_id IN (${projectIds.map(() => "?").join(",")})
        `,
        projectIds
      );

      rejectedRows = rows;
    }

    const statusCounts = {
      todo: 0,
      in_progress: 0,
      under_review: 0,
      done: 0,
      rejected: 0,
      on_hold: 0,
    };

    const tasks = taskRows.map((task) => {
      const taskSubtasks = subtaskRows.filter(
        (subtask) => Number(subtask.task_id) === Number(task.task_id)
      );

      const totalSubtasks = taskSubtasks.length;

      const completedSubtasks = taskSubtasks.filter(
        (subtask) => normalizeStatusGroup(subtask.status) === "done"
      ).length;

      let statusGroup = normalizeStatusGroup(task.task_status || task.project_status);

      const activeRejection = rejectedRows.find((row) => {
        const sameProject = Number(row.project_id) === Number(task.project_id);

        const sameAssignee =
          !row.assigned_user_id ||
          Number(row.assigned_user_id) === Number(task.assigned_user_id);

        return sameProject && sameAssignee;
      });

      if (activeRejection) {
        statusGroup = "rejected";
      } else if (statusGroup !== "done") {
        if (totalSubtasks === 0) {
          statusGroup = normalizeStatusGroup(task.task_status || "todo");
        } else if (completedSubtasks === 0) {
          statusGroup = "todo";
        } else if (completedSubtasks > 0 && completedSubtasks < totalSubtasks) {
          statusGroup = "in_progress";
        } else if (completedSubtasks === totalSubtasks) {
          statusGroup = "under_review";
        }
      }

      if (statusCounts[statusGroup] !== undefined) {
        statusCounts[statusGroup] += 1;
      }

      const progress =
        totalSubtasks > 0
          ? Math.round((completedSubtasks / totalSubtasks) * 100)
          : 0;

      const projectAssignees =
        projectAssignmentsByProject.get(Number(task.project_id)) || [];

      const projectAssignedNames =
        projectAssignees.map((user) => user.full_name).filter(Boolean).join(", ") ||
        "-";

      const projectAssignedEmails =
        projectAssignees.map((user) => user.email).filter(Boolean).join(", ") ||
        "-";

      return {
        task_id: task.task_id,
        project_id: task.project_id,
        main_task_key: [
          task.project_id || "",
          task.task_title || "",
          task.task_description || "",
        ].join("::"),

        task_title: task.task_title,
        task_description: task.task_description,
        task_status: task.task_status,
        status_group: statusGroup,
        status_label: getStatusLabel(statusGroup),
        task_start_date: formatDateOnly(task.task_start_date),
        task_end_date: formatDateOnly(task.task_end_date),
        task_created_at: task.task_created_at,

        assigned_user_id: task.assigned_user_id,
        assigned_employee_code: task.assigned_employee_code,
        assigned_name: task.assigned_name,
        assigned_email: task.assigned_email,
        assigned_designation: task.assigned_designation,
        assigned_department_id: task.assigned_department_id,
        assigned_department_name: task.assigned_department_name,
        assigned_role_name: task.assigned_role_name,

        project_title: task.project_title,
        project_description: task.project_description,
        project_status: task.project_status,
        project_start_date: formatDateOnly(task.project_start_date),
        project_end_date: formatDateOnly(task.project_end_date),
        created_by_name: task.created_by_name,

        project_assignees: projectAssignees,
        project_assigned_names: projectAssignedNames,
        project_assigned_emails: projectAssignedEmails,
        total_project_assignees: projectAssignees.length,

        total_subtasks: totalSubtasks,
        completed_subtasks: completedSubtasks,
        progress,
        subtasks: taskSubtasks.map((subtask) => ({
          ...subtask,
          start_date: formatDateOnly(subtask.start_date),
          end_date: formatDateOnly(subtask.end_date),
        })),

        is_rejected: Boolean(activeRejection),
        rejection_reason: activeRejection?.rejection_reason || null,
        rejected_at: activeRejection?.rejected_at || null,
        rejection_expires_at: activeRejection?.expires_at || null,
      };
    });

    return res.status(200).json({
      admin: adminUser,
      total: tasks.length,
      statusCounts,
      tasks,
    });
  } catch (error) {
    console.error("Get department tasks error:", error);

    return res.status(500).json({
      message: "Failed to fetch department tasks.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};

module.exports = {
  getDepartmentTasks,
};
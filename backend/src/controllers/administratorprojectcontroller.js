const db = require("../config/db");

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

const normalizeStatusGroup = (status) => {
  const value = String(status || "").toLowerCase().trim();

  if (
    value === "todo" ||
    value === "to_do" ||
    value === "to do" ||
    value === "pending" ||
    value === "not_started" ||
    value === "not started"
  ) {
    return "todo";
  }

  if (
    value === "in_progress" ||
    value === "in progress" ||
    value === "progress"
  ) {
    return "in_progress";
  }

  if (
    value === "under_review" ||
    value === "under review" ||
    value === "review"
  ) {
    return "under_review";
  }

  if (value === "done" || value === "completed" || value === "complete") {
    return "done";
  }

  if (value === "rejected") {
    return "rejected";
  }

  if (value === "on_hold" || value === "on hold" || value === "hold") {
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

const parseEnumValues = (typeValue) => {
  const type = String(typeValue || "");
  const values = [];
  const regex = /'((?:''|[^'])*)'/g;

  let match;
  while ((match = regex.exec(type)) !== null) {
    values.push(match[1].replace(/''/g, "'"));
  }

  return values;
};

const getSafeStatusValue = (columnInfo, statusColumn, targetStatus) => {
  if (!statusColumn) return undefined;

  const statusInfo = columnInfo.find((col) => col.Field === statusColumn);

  const preferredMap = {
    todo: ["todo", "to_do", "to do", "To Do", "pending", "not_started"],
    in_progress: ["in_progress", "in progress", "In Progress", "progress"],
    under_review: ["under_review", "under review", "Under Review", "review"],
    done: ["done", "Done", "completed", "Completed", "complete"],
  };

  const preferredValues = preferredMap[targetStatus] || [targetStatus];

  if (!statusInfo) return preferredValues[0];

  const type = String(statusInfo.Type || "");

  if (!type.toLowerCase().startsWith("enum")) {
    return preferredValues[0];
  }

  const enumValues = parseEnumValues(type);

  for (const preferred of preferredValues) {
    const matched = enumValues.find(
      (value) => value.toLowerCase() === preferred.toLowerCase()
    );

    if (matched) return matched;
  }

  return enumValues[0] || preferredValues[0];
};

const isValidDateString = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
};

const toDateOnly = (value) => {
  if (!value) return "";

  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const compareDateOnly = (leftDate, rightDate) => {
  const left = toDateOnly(leftDate);
  const right = toDateOnly(rightDate);

  if (!left || !right) return 0;

  if (left < right) return -1;
  if (left > right) return 1;

  return 0;
};

const ensureColumn = async (tableName, columnName, columnDefinition) => {
  const columns = await getTableColumnInfo(tableName);
  const exists = columns.some((col) => col.Field === columnName);

  if (!exists) {
    await db.query(
      `ALTER TABLE ${escapeId(tableName)} ADD COLUMN ${escapeId(
        columnName
      )} ${columnDefinition}`
    );
  }
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

  await ensureColumn("project_subtasks", "start_date", "DATE NULL");
  await ensureColumn("project_subtasks", "end_date", "DATE NULL");
};

const ensureProjectRejectionsTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS project_rejections (
      rejection_id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      assigned_user_id INT NULL,
      rejected_by INT NOT NULL,
      rejection_reason TEXT NULL,
      decision_status VARCHAR(40) NOT NULL DEFAULT 'pending',
      decision_by INT NULL,
      decision_at DATETIME NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      rejected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_project_rejections_project_id (project_id),
      INDEX idx_project_rejections_assigned_user_id (assigned_user_id),
      INDEX idx_project_rejections_active (active),
      INDEX idx_project_rejections_decision_status (decision_status),
      INDEX idx_project_rejections_expires_at (expires_at)
    )
  `);

  await ensureColumn("project_rejections", "assigned_user_id", "INT NULL");
};

const ensureProjectHoldsTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS project_holds (
      hold_id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      assigned_user_id INT NULL,
      held_by INT NOT NULL,
      hold_reason TEXT NULL,
      decision_status VARCHAR(40) NOT NULL DEFAULT 'pending',
      decision_by INT NULL,
      decision_at DATETIME NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      held_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_project_holds_project_id (project_id),
      INDEX idx_project_holds_assigned_user_id (assigned_user_id),
      INDEX idx_project_holds_active (active),
      INDEX idx_project_holds_decision_status (decision_status)
    )
  `);

  await ensureColumn("project_holds", "assigned_user_id", "INT NULL");
};

const getLoggedInUser = async (req) => {
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
    LEFT JOIN roles r 
      ON u.role_id = r.role_id
    LEFT JOIN departments d 
      ON u.department_id = d.department_id
    WHERE u.user_id = ?
    LIMIT 1
    `,
    [loggedInUserId]
  );

  if (!rows || rows.length === 0) {
    return {
      error: {
        status: 404,
        message: "Logged-in user not found.",
      },
    };
  }

  return {
    user: rows[0],
  };
};

const getProjectColumns = async () => {
  const projectColumnInfo = await getTableColumnInfo("projects");
  const projectColumns = projectColumnInfo.map((col) => col.Field);

  return {
    projectColumnInfo,
    projectColumns,
    projectIdColumn: pickColumn(projectColumns, ["project_id", "id"]),
    projectTitleColumn: pickColumn(projectColumns, [
      "project_title",
      "title",
      "project_name",
      "name",
    ]),
    projectDescriptionColumn: pickColumn(projectColumns, [
      "description",
      "project_description",
      "main_task",
      "details",
    ]),
    projectStatusColumn: pickColumn(projectColumns, [
      "status",
      "project_status",
    ]),
    projectCreatedByColumn: pickColumn(projectColumns, [
      "created_by",
      "created_by_user_id",
      "created_by_id",
      "admin_id",
    ]),
    projectDepartmentColumn: pickColumn(projectColumns, ["department_id"]),
    projectStartDateColumn: pickColumn(projectColumns, [
      "start_date",
      "project_start_date",
    ]),
    projectEndDateColumn: pickColumn(projectColumns, [
      "due_date",
      "end_date",
      "project_end_date",
      "deadline",
    ]),
    projectCreatedAtColumn: pickColumn(projectColumns, ["created_at"]),
  };
};

const getTaskColumns = async () => {
  const taskColumnInfo = await getTableColumnInfo("tasks");
  const taskColumns = taskColumnInfo.map((col) => col.Field);

  return {
    taskColumnInfo,
    taskColumns,
    taskIdColumn: pickColumn(taskColumns, ["task_id", "id"]),
    taskProjectIdColumn: pickColumn(taskColumns, ["project_id"]),
    taskTitleColumn: pickColumn(taskColumns, [
      "task_title",
      "title",
      "task_name",
      "name",
    ]),
    taskStatusColumn: pickColumn(taskColumns, ["status", "task_status"]),
    taskAssignedToColumn: pickColumn(taskColumns, [
      "assigned_to",
      "assigned_to_user_id",
      "assignee_id",
      "user_id",
    ]),
  };
};

const setProjectAndTaskStatus = async (projectId, statusGroup) => {
  const { projectColumnInfo, projectIdColumn, projectStatusColumn } =
    await getProjectColumns();

  const { taskColumnInfo, taskProjectIdColumn, taskStatusColumn } =
    await getTaskColumns();

  if (projectIdColumn && projectStatusColumn) {
    const safeProjectStatus = getSafeStatusValue(
      projectColumnInfo,
      projectStatusColumn,
      statusGroup
    );

    await db.query(
      `
      UPDATE projects
      SET ${escapeId(projectStatusColumn)} = ?
      WHERE ${escapeId(projectIdColumn)} = ?
      `,
      [safeProjectStatus, projectId]
    );
  }

  if (taskProjectIdColumn && taskStatusColumn) {
    const safeTaskStatus = getSafeStatusValue(
      taskColumnInfo,
      taskStatusColumn,
      statusGroup
    );

    await db.query(
      `
      UPDATE tasks
      SET ${escapeId(taskStatusColumn)} = ?
      WHERE ${escapeId(taskProjectIdColumn)} = ?
      `,
      [safeTaskStatus, projectId]
    );
  }
};

const ensureProjectIsEditable = async (projectId, userId) => {
  const [rejectedRows] = await db.query(
    `
    SELECT rejection_id
    FROM project_rejections
    WHERE project_id = ?
    AND active = 1
    AND decision_status = 'pending'
    AND expires_at >= NOW()
    AND (assigned_user_id = ? OR assigned_user_id IS NULL)
    LIMIT 1
    `,
    [projectId, userId]
  );

  if (rejectedRows.length > 0) {
    return {
      allowed: false,
      message: "This project is rejected. No action is allowed.",
    };
  }

  const [holdRows] = await db.query(
    `
    SELECT hold_id
    FROM project_holds
    WHERE project_id = ?
    AND active = 1
    AND decision_status = 'pending'
    AND (assigned_user_id = ? OR assigned_user_id IS NULL)
    LIMIT 1
    `,
    [projectId, userId]
  );

  if (holdRows.length > 0) {
    return {
      allowed: false,
      message: "This project is on hold. Click Resume to continue.",
    };
  }

  return {
    allowed: true,
    message: "",
  };
};

const recalculateProjectStatusFromSubtasks = async (projectId) => {
  const [rejectedRows] = await db.query(
    `
    SELECT rejection_id
    FROM project_rejections
    WHERE project_id = ?
    AND active = 1
    AND decision_status = 'pending'
    AND expires_at >= NOW()
    LIMIT 1
    `,
    [projectId]
  );

  if (rejectedRows && rejectedRows.length > 0) {
    return "rejected";
  }

  const [holdRows] = await db.query(
    `
    SELECT hold_id
    FROM project_holds
    WHERE project_id = ?
    AND active = 1
    AND decision_status = 'pending'
    LIMIT 1
    `,
    [projectId]
  );

  if (holdRows && holdRows.length > 0) {
    return "on_hold";
  }

  const [subtasks] = await db.query(
    `
    SELECT subtask_id, status
    FROM project_subtasks
    WHERE project_id = ?
    `,
    [projectId]
  );

  if (!subtasks || subtasks.length === 0) {
    await setProjectAndTaskStatus(projectId, "todo");
    return "todo";
  }

  const doneCount = subtasks.filter(
    (subtask) => normalizeStatusGroup(subtask.status) === "done"
  ).length;

  let newStatus = "todo";

  if (doneCount === 0) {
    newStatus = "todo";
  } else if (doneCount > 0 && doneCount < subtasks.length) {
    newStatus = "in_progress";
  } else if (doneCount === subtasks.length) {
    newStatus = "under_review";
  }

  await setProjectAndTaskStatus(projectId, newStatus);

  return newStatus;
};

const getAdministratorProjects = async (req, res) => {
  try {
    await ensureProjectSubtasksTable();
    await ensureProjectRejectionsTable();
    await ensureProjectHoldsTable();

    const { user, error } = await getLoggedInUser(req);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const loggedInUserId = Number(user.user_id);

    const {
      projectColumns,
      projectIdColumn,
      projectTitleColumn,
      projectDescriptionColumn,
      projectStatusColumn,
      projectCreatedByColumn,
      projectDepartmentColumn,
      projectStartDateColumn,
      projectEndDateColumn,
      projectCreatedAtColumn,
    } = await getProjectColumns();

    const {
      taskIdColumn,
      taskProjectIdColumn,
      taskTitleColumn,
      taskStatusColumn,
      taskAssignedToColumn,
    } = await getTaskColumns();

    if (!projectIdColumn || !projectTitleColumn) {
      return res.status(500).json({
        message: "projects table must have project_id and project title column.",
        projectColumns,
      });
    }

    const [projectRows] = await db.query(
      `
      SELECT
        p.${escapeId(projectIdColumn)} AS project_id,
        p.${escapeId(projectTitleColumn)} AS project_title,
        ${
          projectDescriptionColumn
            ? `p.${escapeId(projectDescriptionColumn)}`
            : "NULL"
        } AS description,
        ${
          projectStatusColumn
            ? `p.${escapeId(projectStatusColumn)}`
            : "'todo'"
        } AS status,
        ${
          projectDepartmentColumn
            ? `p.${escapeId(projectDepartmentColumn)}`
            : "NULL"
        } AS department_id,
        ${
          projectCreatedByColumn
            ? `p.${escapeId(projectCreatedByColumn)}`
            : "NULL"
        } AS created_by,
        ${
          projectStartDateColumn
            ? `p.${escapeId(projectStartDateColumn)}`
            : "NULL"
        } AS start_date,
        ${
          projectEndDateColumn
            ? `p.${escapeId(projectEndDateColumn)}`
            : "NULL"
        } AS end_date,
        ${
          projectCreatedAtColumn
            ? `p.${escapeId(projectCreatedAtColumn)}`
            : "NULL"
        } AS created_at,
        d.department_name,
        creator.full_name AS created_by_name,
        creator.email AS created_by_email
      FROM projects p
      LEFT JOIN departments d
        ON ${
          projectDepartmentColumn
            ? `p.${escapeId(projectDepartmentColumn)} = d.department_id`
            : "1 = 0"
        }
      LEFT JOIN users creator
        ON ${
          projectCreatedByColumn
            ? `p.${escapeId(projectCreatedByColumn)} = creator.user_id`
            : "1 = 0"
        }
      ORDER BY p.${escapeId(projectIdColumn)} DESC
      `
    );

    let taskRows = [];

    if (taskProjectIdColumn) {
      const [rows] = await db.query(
        `
        SELECT
          ${taskIdColumn ? `t.${escapeId(taskIdColumn)}` : "NULL"} AS task_id,
          t.${escapeId(taskProjectIdColumn)} AS project_id,
          ${
            taskTitleColumn ? `t.${escapeId(taskTitleColumn)}` : "NULL"
          } AS task_title,
          ${
            taskStatusColumn ? `t.${escapeId(taskStatusColumn)}` : "'todo'"
          } AS status,
          ${
            taskAssignedToColumn
              ? `t.${escapeId(taskAssignedToColumn)}`
              : "NULL"
          } AS assigned_to,
          assignee.full_name AS assigned_to_name,
          assignee.email AS assigned_to_email,
          assignee.employee_code AS assigned_to_employee_code
        FROM tasks t
        LEFT JOIN users assignee
          ON ${
            taskAssignedToColumn
              ? `t.${escapeId(taskAssignedToColumn)} = assignee.user_id`
              : "1 = 0"
          }
        `
      );

      taskRows = rows;
    }

    const [subtaskRows] = await db.query(`
      SELECT
        subtask_id,
        project_id,
        task_id,
        title,
        status,
        start_date,
        end_date,
        created_by,
        created_at,
        updated_at
      FROM project_subtasks
    `);

    const [activeRejectedRows] = await db.query(
      `
      SELECT
        rejection_id,
        project_id,
        assigned_user_id,
        rejected_by,
        rejection_reason,
        decision_status,
        active,
        rejected_at,
        expires_at
      FROM project_rejections
      WHERE active = 1
      AND decision_status = 'pending'
      AND expires_at >= NOW()
      AND (assigned_user_id = ? OR assigned_user_id IS NULL)
      `,
      [loggedInUserId]
    );

    const [activeHeldRows] = await db.query(
      `
      SELECT
        hold_id,
        project_id,
        assigned_user_id,
        held_by,
        hold_reason,
        decision_status,
        active,
        held_at
      FROM project_holds
      WHERE active = 1
      AND decision_status = 'pending'
      AND (assigned_user_id = ? OR assigned_user_id IS NULL)
      `,
      [loggedInUserId]
    );

    const [cancelledRejectedRows] = await db.query(
      `
      SELECT project_id
      FROM project_rejections
      WHERE decision_status = 'cancelled'
      AND decision_by = ?
      `,
      [loggedInUserId]
    );

    const cancelledProjectIdSet = new Set(
      cancelledRejectedRows.map((row) => Number(row.project_id))
    );

    const projects = projectRows.map((project) => {
      const projectId = Number(project.project_id);

      const projectTasks = taskRows.filter(
        (task) => Number(task.project_id) === projectId
      );

      const myTaskIds = projectTasks
        .filter((task) => Number(task.assigned_to) === loggedInUserId)
        .map((task) => Number(task.task_id));

      const assignedUsersMap = new Map();

      projectTasks.forEach((task) => {
        if (task.assigned_to) {
          assignedUsersMap.set(Number(task.assigned_to), {
            user_id: Number(task.assigned_to),
            full_name: task.assigned_to_name,
            email: task.assigned_to_email,
            employee_code: task.assigned_to_employee_code,
          });
        }
      });

      const assignedUsers = Array.from(assignedUsersMap.values());

      const allProjectSubtasks = subtaskRows.filter(
        (subtask) => Number(subtask.project_id) === projectId
      );

      const mySubtasks = allProjectSubtasks.filter((subtask) =>
        myTaskIds.includes(Number(subtask.task_id))
      );

      const totalSubtasks = allProjectSubtasks.length;

      const completedSubtasks = allProjectSubtasks.filter(
        (subtask) => normalizeStatusGroup(subtask.status) === "done"
      ).length;

      const activeRejection = activeRejectedRows.find(
        (row) => Number(row.project_id) === projectId
      );

      const activeHold = activeHeldRows.find(
        (row) => Number(row.project_id) === projectId
      );

      const isRejected = Boolean(activeRejection);
      const isOnHold = Boolean(activeHold);
      const isCancelledByLoggedInUser = cancelledProjectIdSet.has(projectId);

const databaseStatusGroup = normalizeStatusGroup(project.status);

const databaseProjectStatusGroup = normalizeStatusGroup(project.status);

const hasInProgressTask = projectTasks.some(
  (task) => normalizeStatusGroup(task.status) === "in_progress"
);

const hasUnderReviewTask = projectTasks.some(
  (task) => normalizeStatusGroup(task.status) === "under_review"
);

let statusGroup = isRejected
  ? "rejected"
  : isOnHold
  ? "on_hold"
  : hasInProgressTask
  ? "in_progress"
  : databaseProjectStatusGroup;

/*
  Important:
  If project was resumed from On Hold, task status becomes In Progress.
  Even if all subtasks are already done/locked, do not force it back to Under Review.
*/
if (
  !isRejected &&
  !isOnHold &&
  statusGroup !== "done" &&
  statusGroup !== "in_progress"
) {
  if (totalSubtasks === 0) {
    statusGroup = hasUnderReviewTask
      ? "under_review"
      : databaseProjectStatusGroup || "todo";
  } else if (completedSubtasks === 0) {
    statusGroup = hasUnderReviewTask ? "under_review" : "todo";
  } else if (completedSubtasks > 0 && completedSubtasks < totalSubtasks) {
    statusGroup = "in_progress";
  } else if (completedSubtasks === totalSubtasks) {
    statusGroup = "under_review";
  }
}

      const progress =
        totalSubtasks > 0
          ? Math.round((completedSubtasks / totalSubtasks) * 100)
          : 0;

      const isAssignedToLoggedInUser = projectTasks.some(
        (task) => Number(task.assigned_to) === loggedInUserId
      );

      return {
        project_id: projectId,
        project_title: project.project_title,
        description: project.description,
        status: project.status,
        status_group: statusGroup,
        status_label: getStatusLabel(statusGroup),
        department_id: project.department_id,
        department_name: project.department_name,
        created_by: project.created_by,
        created_by_name: project.created_by_name,
        created_by_email: project.created_by_email,
        start_date: project.start_date,
        end_date: project.end_date,
        created_at: project.created_at,
        assigned_users: assignedUsers,
        assigned_names:
          assignedUsers
            .map((assignedUser) => assignedUser.full_name)
            .filter(Boolean)
            .join(", ") || "-",
        subtasks: mySubtasks,
        total_subtasks: totalSubtasks,
        completed_subtasks: completedSubtasks,
        progress,
        is_assigned_to_me: isAssignedToLoggedInUser,

        is_rejected: isRejected,
        is_on_hold: isOnHold,
        is_cancelled_by_me: isCancelledByLoggedInUser,

        rejection_id: activeRejection?.rejection_id || null,
        rejection_reason: activeRejection?.rejection_reason || null,
        rejected_at: activeRejection?.rejected_at || null,
        rejection_expires_at: activeRejection?.expires_at || null,

        hold_id: activeHold?.hold_id || null,
        hold_reason: activeHold?.hold_reason || null,
        held_at: activeHold?.held_at || null,
      };
    });

    const visibleProjects = projects.filter(
      (project) => !project.is_cancelled_by_me
    );

    const rejectedProjects = visibleProjects.filter(
      (project) => project.is_assigned_to_me && project.is_rejected
    );

    const onHoldProjects = visibleProjects.filter(
      (project) => project.is_assigned_to_me && project.is_on_hold
    );

    const myProjects = visibleProjects.filter(
      (project) =>
        project.is_assigned_to_me &&
        !project.is_rejected &&
        !project.is_on_hold
    );

    const allProjects = visibleProjects.filter(
      (project) => !project.is_rejected && !project.is_on_hold
    );

    return res.status(200).json({
      logged_in_user: user,
      myProjects,
      allProjects,
      rejectedProjects,
      onHoldProjects,
    });
  } catch (error) {
    console.error("Get administrator projects error:", error);

    return res.status(500).json({
      message: "Failed to fetch administrator projects.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};

const getProjectSubtasks = async (req, res) => {
  try {
    await ensureProjectSubtasksTable();
    await ensureProjectRejectionsTable();
    await ensureProjectHoldsTable();

    const { user, error } = await getLoggedInUser(req);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const loggedInUserId = Number(user.user_id);
    const projectId = Number(req.params.projectId);

    if (!projectId) {
      return res.status(400).json({
        message: "Project ID is required.",
      });
    }

    const editableCheck = await ensureProjectIsEditable(
      projectId,
      loggedInUserId
    );

    if (!editableCheck.allowed) {
      return res.status(400).json({
        message: editableCheck.message,
      });
    }

    const {
      projectColumns,
      projectIdColumn,
      projectTitleColumn,
      projectDescriptionColumn,
      projectStatusColumn,
      projectDepartmentColumn,
      projectStartDateColumn,
      projectEndDateColumn,
      projectCreatedByColumn,
    } = await getProjectColumns();

    if (!projectIdColumn || !projectTitleColumn) {
      return res.status(500).json({
        message: "projects table must have project_id and project title column.",
        projectColumns,
      });
    }

    const [projectRows] = await db.query(
      `
      SELECT
        p.${escapeId(projectIdColumn)} AS project_id,
        p.${escapeId(projectTitleColumn)} AS project_title,
        ${
          projectDescriptionColumn
            ? `p.${escapeId(projectDescriptionColumn)}`
            : "NULL"
        } AS description,
        ${
          projectStatusColumn
            ? `p.${escapeId(projectStatusColumn)}`
            : "'todo'"
        } AS status,
        ${
          projectDepartmentColumn
            ? `p.${escapeId(projectDepartmentColumn)}`
            : "NULL"
        } AS department_id,
        ${
          projectStartDateColumn
            ? `p.${escapeId(projectStartDateColumn)}`
            : "NULL"
        } AS start_date,
        ${
          projectEndDateColumn
            ? `p.${escapeId(projectEndDateColumn)}`
            : "NULL"
        } AS end_date,
        d.department_name,
        creator.full_name AS created_by_name
      FROM projects p
      LEFT JOIN departments d
        ON ${
          projectDepartmentColumn
            ? `p.${escapeId(projectDepartmentColumn)} = d.department_id`
            : "1 = 0"
        }
      LEFT JOIN users creator
        ON ${
          projectCreatedByColumn
            ? `p.${escapeId(projectCreatedByColumn)} = creator.user_id`
            : "1 = 0"
        }
      WHERE p.${escapeId(projectIdColumn)} = ?
      LIMIT 1
      `,
      [projectId]
    );

    if (!projectRows || projectRows.length === 0) {
      return res.status(404).json({
        message: "Project not found.",
      });
    }

    const {
      taskColumns,
      taskIdColumn,
      taskProjectIdColumn,
      taskAssignedToColumn,
    } = await getTaskColumns();

    if (!taskIdColumn || !taskProjectIdColumn || !taskAssignedToColumn) {
      return res.status(500).json({
        message:
          "tasks table must have task_id, project_id, and assigned_to column.",
        taskColumns,
      });
    }

    const [taskRows] = await db.query(
      `
      SELECT 
        t.${escapeId(taskIdColumn)} AS task_id,
        t.${escapeId(taskProjectIdColumn)} AS project_id,
        t.${escapeId(taskAssignedToColumn)} AS assigned_to
      FROM tasks t
      WHERE t.${escapeId(taskProjectIdColumn)} = ?
      AND t.${escapeId(taskAssignedToColumn)} = ?
      LIMIT 1
      `,
      [projectId, loggedInUserId]
    );

    if (!taskRows || taskRows.length === 0) {
      return res.status(403).json({
        message: "This project is not assigned to you.",
      });
    }

    const assignedTask = taskRows[0];

    const [subtasks] = await db.query(
      `
      SELECT
        subtask_id,
        project_id,
        task_id,
        title,
        status,
        start_date,
        end_date,
        created_by,
        created_at,
        updated_at
      FROM project_subtasks
      WHERE project_id = ?
      AND task_id = ?
      ORDER BY subtask_id ASC
      `,
      [projectId, assignedTask.task_id]
    );

    return res.status(200).json({
      project: projectRows[0],
      task: assignedTask,
      subtasks,
    });
  } catch (error) {
    console.error("Get project subtasks error:", error);

    return res.status(500).json({
      message: "Failed to fetch subtasks.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};

const createProjectSubtask = async (req, res) => {
  try {
    await ensureProjectSubtasksTable();
    await ensureProjectRejectionsTable();
    await ensureProjectHoldsTable();

    const { user, error } = await getLoggedInUser(req);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const loggedInUserId = Number(user.user_id);
    const projectId = Number(req.params.projectId);

    const title = String(req.body?.title || "").trim();
    const subtaskStartDate = String(req.body?.start_date || "").trim();
    const subtaskEndDate = String(req.body?.end_date || "").trim();

    if (!projectId) {
      return res.status(400).json({
        message: "Project ID is required.",
      });
    }

    const editableCheck = await ensureProjectIsEditable(
      projectId,
      loggedInUserId
    );

    if (!editableCheck.allowed) {
      return res.status(400).json({
        message: editableCheck.message,
      });
    }

    if (!title) {
      return res.status(400).json({
        message: "Subtask title is required.",
      });
    }

    if (!subtaskStartDate || !isValidDateString(subtaskStartDate)) {
      return res.status(400).json({
        message: "Valid subtask start date is required.",
      });
    }

    if (!subtaskEndDate || !isValidDateString(subtaskEndDate)) {
      return res.status(400).json({
        message: "Valid subtask end date is required.",
      });
    }

    if (compareDateOnly(subtaskEndDate, subtaskStartDate) < 0) {
      return res.status(400).json({
        message: "Subtask end date cannot be before subtask start date.",
      });
    }

    const {
      projectColumns,
      projectIdColumn,
      projectStartDateColumn,
      projectEndDateColumn,
    } = await getProjectColumns();

    if (!projectIdColumn || !projectStartDateColumn || !projectEndDateColumn) {
      return res.status(500).json({
        message:
          "projects table must have project_id, start_date, and due_date/end_date columns.",
        projectColumns,
      });
    }

    const [projectRows] = await db.query(
      `
      SELECT
        p.${escapeId(projectIdColumn)} AS project_id,
        p.${escapeId(projectStartDateColumn)} AS start_date,
        p.${escapeId(projectEndDateColumn)} AS end_date
      FROM projects p
      WHERE p.${escapeId(projectIdColumn)} = ?
      LIMIT 1
      `,
      [projectId]
    );

    if (!projectRows || projectRows.length === 0) {
      return res.status(404).json({
        message: "Project not found.",
      });
    }

    const project = projectRows[0];

    const projectStartDate = toDateOnly(project.start_date);
    const projectEndDate = toDateOnly(project.end_date);

    if (!projectStartDate || !projectEndDate) {
      return res.status(400).json({
        message:
          "Project start date and end date are required before adding subtasks.",
      });
    }

    if (compareDateOnly(subtaskStartDate, projectStartDate) < 0) {
      return res.status(400).json({
        message: `Subtask start date cannot be before project start date ${projectStartDate}.`,
      });
    }

    if (compareDateOnly(subtaskEndDate, projectEndDate) > 0) {
      return res.status(400).json({
        message: `Subtask end date cannot exceed project end date ${projectEndDate}.`,
      });
    }

    const {
      taskColumns,
      taskIdColumn,
      taskProjectIdColumn,
      taskAssignedToColumn,
    } = await getTaskColumns();

    if (!taskIdColumn || !taskProjectIdColumn || !taskAssignedToColumn) {
      return res.status(500).json({
        message:
          "tasks table must have task_id, project_id, and assigned_to column.",
        taskColumns,
      });
    }

    const [taskRows] = await db.query(
      `
      SELECT 
        t.${escapeId(taskIdColumn)} AS task_id,
        t.${escapeId(taskProjectIdColumn)} AS project_id,
        t.${escapeId(taskAssignedToColumn)} AS assigned_to
      FROM tasks t
      WHERE t.${escapeId(taskProjectIdColumn)} = ?
      AND t.${escapeId(taskAssignedToColumn)} = ?
      LIMIT 1
      `,
      [projectId, loggedInUserId]
    );

    if (!taskRows || taskRows.length === 0) {
      return res.status(403).json({
        message: "This project is not assigned to you.",
      });
    }

    const assignedTask = taskRows[0];

    const [overlappingSubtasks] = await db.query(
      `
      SELECT
        subtask_id,
        title,
        start_date,
        end_date
      FROM project_subtasks
      WHERE project_id = ?
      AND task_id = ?
      AND NOT (
        end_date < ?
        OR start_date > ?
      )
      LIMIT 1
      `,
      [projectId, assignedTask.task_id, subtaskStartDate, subtaskEndDate]
    );

    if (overlappingSubtasks && overlappingSubtasks.length > 0) {
      const existingSubtask = overlappingSubtasks[0];

      return res.status(400).json({
        message: `Date already assigned to subtask "${
          existingSubtask.title
        }" from ${toDateOnly(existingSubtask.start_date)} to ${toDateOnly(
          existingSubtask.end_date
        )}. Please select another date range.`,
      });
    }

    await db.query(
      `
      INSERT INTO project_subtasks
      (project_id, task_id, title, status, start_date, end_date, created_by)
      VALUES (?, ?, ?, 'todo', ?, ?, ?)
      `,
      [
        projectId,
        assignedTask.task_id,
        title,
        subtaskStartDate,
        subtaskEndDate,
        loggedInUserId,
      ]
    );

    await recalculateProjectStatusFromSubtasks(projectId);

    const [subtasks] = await db.query(
      `
      SELECT
        subtask_id,
        project_id,
        task_id,
        title,
        status,
        start_date,
        end_date,
        created_by,
        created_at,
        updated_at
      FROM project_subtasks
      WHERE project_id = ?
      AND task_id = ?
      ORDER BY subtask_id ASC
      `,
      [projectId, assignedTask.task_id]
    );

    return res.status(201).json({
      message: "Subtask added successfully.",
      subtasks,
    });
  } catch (error) {
    console.error("Create project subtask error:", error);

    return res.status(500).json({
      message: "Failed to add subtask.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};

const updateSubtaskStatus = async (req, res) => {
  try {
    await ensureProjectSubtasksTable();
    await ensureProjectRejectionsTable();
    await ensureProjectHoldsTable();

    const { user, error } = await getLoggedInUser(req);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const loggedInUserId = Number(user.user_id);
    const projectId = Number(req.params.projectId);
    const subtaskId = Number(req.params.subtaskId);
    const checked = Boolean(req.body?.checked);

    if (!projectId || !subtaskId) {
      return res.status(400).json({
        message: "Project ID and Subtask ID are required.",
      });
    }

    const editableCheck = await ensureProjectIsEditable(
      projectId,
      loggedInUserId
    );

    if (!editableCheck.allowed) {
      return res.status(400).json({
        message: editableCheck.message,
      });
    }

    const {
      taskColumns,
      taskIdColumn,
      taskProjectIdColumn,
      taskAssignedToColumn,
    } = await getTaskColumns();

    if (!taskIdColumn || !taskProjectIdColumn || !taskAssignedToColumn) {
      return res.status(500).json({
        message:
          "tasks table must have task_id, project_id, and assigned_to column.",
        taskColumns,
      });
    }

    const [taskRows] = await db.query(
      `
      SELECT 
        t.${escapeId(taskIdColumn)} AS task_id
      FROM tasks t
      WHERE t.${escapeId(taskProjectIdColumn)} = ?
      AND t.${escapeId(taskAssignedToColumn)} = ?
      LIMIT 1
      `,
      [projectId, loggedInUserId]
    );

    if (!taskRows || taskRows.length === 0) {
      return res.status(403).json({
        message: "This project is not assigned to you.",
      });
    }

    const assignedTask = taskRows[0];

    const [subtaskRows] = await db.query(
      `
      SELECT 
        subtask_id,
        status
      FROM project_subtasks
      WHERE subtask_id = ?
      AND project_id = ?
      AND task_id = ?
      LIMIT 1
      `,
      [subtaskId, projectId, assignedTask.task_id]
    );

    if (!subtaskRows || subtaskRows.length === 0) {
      return res.status(404).json({
        message: "Subtask not found for this assigned project.",
      });
    }

    const currentSubtask = subtaskRows[0];
    const currentStatusGroup = normalizeStatusGroup(currentSubtask.status);

    if (currentStatusGroup === "done" && checked === false) {
      return res.status(400).json({
        message:
          "Completed subtasks cannot be unchecked. Once a subtask is done, it is locked.",
      });
    }

    if (currentStatusGroup === "done" && checked === true) {
      const [subtasks] = await db.query(
        `
        SELECT
          subtask_id,
          project_id,
          task_id,
          title,
          status,
          start_date,
          end_date,
          created_by,
          created_at,
          updated_at
        FROM project_subtasks
        WHERE project_id = ?
        AND task_id = ?
        ORDER BY subtask_id ASC
        `,
        [projectId, assignedTask.task_id]
      );

      return res.status(200).json({
        message: "Subtask is already completed and locked.",
        project_status: await recalculateProjectStatusFromSubtasks(projectId),
        subtasks,
      });
    }

    await db.query(
      `
      UPDATE project_subtasks
      SET status = ?
      WHERE subtask_id = ?
      `,
      [checked ? "done" : "todo", subtaskId]
    );

    const newProjectStatus = await recalculateProjectStatusFromSubtasks(
      projectId
    );

    const [subtasks] = await db.query(
      `
      SELECT
        subtask_id,
        project_id,
        task_id,
        title,
        status,
        start_date,
        end_date,
        created_by,
        created_at,
        updated_at
      FROM project_subtasks
      WHERE project_id = ?
      AND task_id = ?
      ORDER BY subtask_id ASC
      `,
      [projectId, assignedTask.task_id]
    );

    return res.status(200).json({
      message: checked ? "Subtask marked done and locked." : "Subtask reopened.",
      project_status: newProjectStatus,
      subtasks,
    });
  } catch (error) {
    console.error("Update subtask status error:", error);

    return res.status(500).json({
      message: "Failed to update subtask status.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};

const redoRejectedProject = async (req, res) => {
  return res.status(403).json({
    message: "Rejected projects cannot be redone. No action is allowed.",
  });
};

const cancelRejectedProject = async (req, res) => {
  return res.status(403).json({
    message:
      "Rejected projects cannot be cancelled by assignee. No action is allowed.",
  });
};

const resumeHeldProject = async (req, res) => {
  try {
    await ensureProjectSubtasksTable();
    await ensureProjectRejectionsTable();
    await ensureProjectHoldsTable();

    const { user, error } = await getLoggedInUser(req);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const loggedInUserId = Number(user.user_id);
    const projectId = Number(req.params.projectId);

    if (!projectId) {
      return res.status(400).json({
        message: "Project ID is required.",
      });
    }

    const {
      taskColumns,
      taskIdColumn,
      taskProjectIdColumn,
      taskAssignedToColumn,
    } = await getTaskColumns();

    if (!taskIdColumn || !taskProjectIdColumn || !taskAssignedToColumn) {
      return res.status(500).json({
        message:
          "tasks table must have task_id, project_id, and assigned_to column.",
        taskColumns,
      });
    }

    const [taskRows] = await db.query(
      `
      SELECT 
        t.${escapeId(taskIdColumn)} AS task_id
      FROM tasks t
      WHERE t.${escapeId(taskProjectIdColumn)} = ?
      AND t.${escapeId(taskAssignedToColumn)} = ?
      LIMIT 1
      `,
      [projectId, loggedInUserId]
    );

    if (!taskRows || taskRows.length === 0) {
      return res.status(403).json({
        message: "This project is not assigned to you.",
      });
    }

    const [holdRows] = await db.query(
      `
      SELECT hold_id
      FROM project_holds
      WHERE project_id = ?
      AND active = 1
      AND decision_status = 'pending'
      AND (assigned_user_id = ? OR assigned_user_id IS NULL)
      LIMIT 1
      `,
      [projectId, loggedInUserId]
    );

    if (!holdRows || holdRows.length === 0) {
      return res.status(404).json({
        message: "Active on-hold project not found.",
      });
    }

    await db.query(
      `
      UPDATE project_holds
      SET active = 0,
          decision_status = 'resumed',
          decision_by = ?,
          decision_at = NOW()
      WHERE hold_id = ?
      `,
      [loggedInUserId, holdRows[0].hold_id]
    );

    /*
      Do not reopen checked subtasks.
      Checked subtasks remain locked.
      Project itself moves back to In Progress.
      Employee can now add more subtasks if more work is required.
    */
    await setProjectAndTaskStatus(projectId, "in_progress");

    return res.status(200).json({
      message:
        "Project resumed successfully. It has moved back to In Progress.",
    });
  } catch (error) {
    console.error("Resume held project error:", error);

    return res.status(500).json({
      message: "Failed to resume on-hold project.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};

module.exports = {
  getAdministratorProjects,
  getProjectSubtasks,
  createProjectSubtask,
  updateSubtaskStatus,
  redoRejectedProject,
  cancelRejectedProject,
  resumeHeldProject,
};
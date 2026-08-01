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
        message: "Logged-in admin user not found.",
      },
    };
  }

  const adminUser = rows[0];
  const roleName = String(adminUser.role_name || "").toLowerCase().trim();

  if (roleName !== "admin") {
    return {
      error: {
        status: 403,
        message: "Only admin users can access admin overview.",
      },
    };
  }

  return { adminUser };
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
    taskProjectIdColumn: pickColumn(taskColumns, ["project_id"]),
    taskAssignedToColumn: pickColumn(taskColumns, [
      "assigned_to",
      "assigned_to_user_id",
      "assignee_id",
      "user_id",
    ]),
    taskStatusColumn: pickColumn(taskColumns, ["status", "task_status"]),
  };
};

const getActivityLogs = async () => {
  try {
    const activityColumnInfo = await getTableColumnInfo("activity_logs");
    const activityColumns = activityColumnInfo.map((col) => col.Field);

    const idColumn = pickColumn(activityColumns, [
      "log_id",
      "activity_log_id",
      "activity_id",
      "id",
    ]);

    const userColumn = pickColumn(activityColumns, [
      "user_id",
      "created_by",
      "performed_by",
      "admin_id",
    ]);

    const actionColumn = pickColumn(activityColumns, [
      "action",
      "activity",
      "activity_type",
      "type",
      "event",
    ]);

    const descriptionColumn = pickColumn(activityColumns, [
      "description",
      "details",
      "message",
      "log_message",
    ]);

    const createdAtColumn = pickColumn(activityColumns, [
      "created_at",
      "timestamp",
      "activity_time",
      "date",
    ]);

    const orderColumn = createdAtColumn || idColumn;

    const [logs] = await db.query(
      `
      SELECT
        ${idColumn ? `a.${escapeId(idColumn)}` : "NULL"} AS log_id,
        ${actionColumn ? `a.${escapeId(actionColumn)}` : "'Activity'"} AS action,
        ${
          descriptionColumn
            ? `a.${escapeId(descriptionColumn)}`
            : "NULL"
        } AS description,
        ${
          createdAtColumn
            ? `a.${escapeId(createdAtColumn)}`
            : "NULL"
        } AS created_at,
        ${userColumn ? "actor.full_name" : "NULL"} AS actor_name,
        ${userColumn ? "actor.email" : "NULL"} AS actor_email
      FROM activity_logs a
      ${
        userColumn
          ? `LEFT JOIN users actor ON a.${escapeId(userColumn)} = actor.user_id`
          : ""
      }
      ${orderColumn ? `ORDER BY a.${escapeId(orderColumn)} DESC` : ""}
      LIMIT 10
      `
    );

    return logs.map((log) => ({
      ...log,
      log_type: "normal_activity",
    }));
  } catch (error) {
    console.error("Admin overview activity logs error:", error.message);
    return [];
  }
};

const getReviewNotifications = async (adminUser) => {
  try {
    await ensureProjectSubtasksTable();
    await ensureProjectRejectionsTable();
    await ensureProjectHoldsTable();

    const {
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

    if (!projectIdColumn || !projectTitleColumn || !projectStatusColumn) {
      return [];
    }

    const queryParams = [];
    let whereClause = "";

    if (projectCreatedByColumn) {
      whereClause = `WHERE p.${escapeId(projectCreatedByColumn)} = ?`;
      queryParams.push(adminUser.user_id);
    }

    const [projects] = await db.query(
      `
      SELECT
        p.${escapeId(projectIdColumn)} AS project_id,
        p.${escapeId(projectTitleColumn)} AS project_title,
        ${
          projectDescriptionColumn
            ? `p.${escapeId(projectDescriptionColumn)}`
            : "NULL"
        } AS description,
        p.${escapeId(projectStatusColumn)} AS status,
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
        d.department_name
      FROM projects p
      LEFT JOIN departments d
        ON ${
          projectDepartmentColumn
            ? `p.${escapeId(projectDepartmentColumn)} = d.department_id`
            : "1 = 0"
        }
      ${whereClause}
      ORDER BY p.${escapeId(projectIdColumn)} DESC
      LIMIT 100
      `,
      queryParams
    );

    const underReviewProjects = projects.filter(
      (project) => normalizeStatusGroup(project.status) === "under_review"
    );

    if (underReviewProjects.length === 0) {
      return [];
    }

    const projectIds = underReviewProjects.map((project) => project.project_id);

    const [activeRejectedRows] = await db.query(
      `
      SELECT project_id
      FROM project_rejections
      WHERE active = 1
      AND decision_status = 'pending'
      AND expires_at >= NOW()
      AND project_id IN (${projectIds.map(() => "?").join(",")})
      `,
      projectIds
    );

    const [activeHeldRows] = await db.query(
      `
      SELECT project_id
      FROM project_holds
      WHERE active = 1
      AND decision_status = 'pending'
      AND project_id IN (${projectIds.map(() => "?").join(",")})
      `,
      projectIds
    );

    const blockedProjectSet = new Set([
      ...activeRejectedRows.map((row) => Number(row.project_id)),
      ...activeHeldRows.map((row) => Number(row.project_id)),
    ]);

    const validReviewProjects = underReviewProjects.filter(
      (project) => !blockedProjectSet.has(Number(project.project_id))
    );

    if (validReviewProjects.length === 0) {
      return [];
    }

    const validProjectIds = validReviewProjects.map(
      (project) => project.project_id
    );

    const { taskProjectIdColumn, taskAssignedToColumn } = await getTaskColumns();

    let assigneeRows = [];

    if (taskProjectIdColumn && taskAssignedToColumn) {
      const [rows] = await db.query(
        `
        SELECT
          t.${escapeId(taskProjectIdColumn)} AS project_id,
          u.user_id,
          u.full_name,
          u.email
        FROM tasks t
        LEFT JOIN users u
          ON t.${escapeId(taskAssignedToColumn)} = u.user_id
        WHERE t.${escapeId(taskProjectIdColumn)} IN (${validProjectIds
          .map(() => "?")
          .join(",")})
        `,
        validProjectIds
      );

      assigneeRows = rows;
    }

    const [subtaskRows] = await db.query(
      `
      SELECT
        project_id,
        subtask_id,
        status
      FROM project_subtasks
      WHERE project_id IN (${validProjectIds.map(() => "?").join(",")})
      `,
      validProjectIds
    );

    const notifications = validReviewProjects.map((project) => {
      const assignedNames =
        assigneeRows
          .filter((row) => Number(row.project_id) === Number(project.project_id))
          .map((row) => row.full_name)
          .filter(Boolean)
          .join(", ") || "-";

      const projectSubtasks = subtaskRows.filter(
        (subtask) => Number(subtask.project_id) === Number(project.project_id)
      );

      const totalSubtasks = projectSubtasks.length;

      const completedSubtasks = projectSubtasks.filter(
        (subtask) => normalizeStatusGroup(subtask.status) === "done"
      ).length;

      return {
        log_type: "review_notification",
        log_id: `review-${project.project_id}`,
        project_id: project.project_id,
        project_title: project.project_title,
        description: "Project completed by assignees. Kindly review it.",
        action: "Review Required",
        actor_name: assignedNames,
        actor_email: "",
        assigned_names: assignedNames,
        department_name: project.department_name,
        start_date: project.start_date,
        end_date: project.end_date,
        total_subtasks: totalSubtasks,
        completed_subtasks: completedSubtasks,
        created_at: new Date(),
      };
    });

    return notifications;
  } catch (error) {
    console.error("Admin overview review notification error:", error.message);
    return [];
  }
};

const getOngoingProjects = async (adminUser) => {
  try {
    await ensureProjectSubtasksTable();
    await ensureProjectRejectionsTable();
    await ensureProjectHoldsTable();

    const {
      projectIdColumn,
      projectTitleColumn,
      projectDescriptionColumn,
      projectStatusColumn,
      projectCreatedByColumn,
      projectDepartmentColumn,
      projectStartDateColumn,
      projectEndDateColumn,
    } = await getProjectColumns();

    if (!projectIdColumn || !projectTitleColumn) {
      return {
        projects: [],
        statusCounts: {
          todo: 0,
          in_progress: 0,
          under_review: 0,
          done: 0,
        },
      };
    }

    const queryParams = [];
    let whereClause = "";

    if (projectCreatedByColumn) {
      whereClause = `WHERE p.${escapeId(projectCreatedByColumn)} = ?`;
      queryParams.push(adminUser.user_id);
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
          projectStartDateColumn
            ? `p.${escapeId(projectStartDateColumn)}`
            : "NULL"
        } AS start_date,
        ${
          projectEndDateColumn
            ? `p.${escapeId(projectEndDateColumn)}`
            : "NULL"
        } AS end_date,
        d.department_name
      FROM projects p
      LEFT JOIN departments d
        ON ${
          projectDepartmentColumn
            ? `p.${escapeId(projectDepartmentColumn)} = d.department_id`
            : "1 = 0"
        }
      ${whereClause}
      ORDER BY p.${escapeId(projectIdColumn)} DESC
      LIMIT 100
      `,
      queryParams
    );

    if (!projectRows || projectRows.length === 0) {
      return {
        projects: [],
        statusCounts: {
          todo: 0,
          in_progress: 0,
          under_review: 0,
          done: 0,
        },
      };
    }

    const projectIds = projectRows.map((project) => project.project_id);

    const [activeRejectedRows] = await db.query(
      `
      SELECT project_id
      FROM project_rejections
      WHERE active = 1
      AND decision_status = 'pending'
      AND expires_at >= NOW()
      AND project_id IN (${projectIds.map(() => "?").join(",")})
      `,
      projectIds
    );

    const [activeHeldRows] = await db.query(
      `
      SELECT project_id
      FROM project_holds
      WHERE active = 1
      AND decision_status = 'pending'
      AND project_id IN (${projectIds.map(() => "?").join(",")})
      `,
      projectIds
    );

    const blockedProjectSet = new Set([
      ...activeRejectedRows.map((row) => Number(row.project_id)),
      ...activeHeldRows.map((row) => Number(row.project_id)),
    ]);

    const { taskProjectIdColumn, taskAssignedToColumn } = await getTaskColumns();

    let taskRows = [];

    if (taskProjectIdColumn) {
      const [tasks] = await db.query(
        `
        SELECT
          t.${escapeId(taskProjectIdColumn)} AS project_id,
          ${
            taskAssignedToColumn
              ? `t.${escapeId(taskAssignedToColumn)}`
              : "NULL"
          } AS assigned_to,
          assignee.full_name AS assigned_to_name,
          assignee.email AS assigned_to_email
        FROM tasks t
        LEFT JOIN users assignee
          ON ${
            taskAssignedToColumn
              ? `t.${escapeId(taskAssignedToColumn)} = assignee.user_id`
              : "1 = 0"
          }
        WHERE t.${escapeId(taskProjectIdColumn)} IN (${projectIds
          .map(() => "?")
          .join(",")})
        `,
        projectIds
      );

      taskRows = tasks;
    }

    const [subtaskRows] = await db.query(
      `
      SELECT
        project_id,
        subtask_id,
        status
      FROM project_subtasks
      WHERE project_id IN (${projectIds.map(() => "?").join(",")})
      `,
      projectIds
    );

    const statusCounts = {
      todo: 0,
      in_progress: 0,
      under_review: 0,
      done: 0,
    };

    const projects = projectRows
      .filter((project) => !blockedProjectSet.has(Number(project.project_id)))
      .map((project) => {
        const projectId = Number(project.project_id);

        const projectTasks = taskRows.filter(
          (task) => Number(task.project_id) === projectId
        );

        const projectSubtasks = subtaskRows.filter(
          (subtask) => Number(subtask.project_id) === projectId
        );

        const assignedNames =
          projectTasks
            .map((task) => task.assigned_to_name)
            .filter(Boolean)
            .join(", ") || "-";

        const totalSubtasks = projectSubtasks.length;

        const completedSubtasks = projectSubtasks.filter(
          (subtask) => normalizeStatusGroup(subtask.status) === "done"
        ).length;

        let statusGroup = normalizeStatusGroup(project.status);

        if (statusGroup !== "done") {
          if (totalSubtasks === 0) {
            statusGroup = normalizeStatusGroup(project.status || "todo");
          } else if (completedSubtasks === 0) {
            statusGroup = "todo";
          } else if (
            completedSubtasks > 0 &&
            completedSubtasks < totalSubtasks
          ) {
            statusGroup = "in_progress";
          } else if (completedSubtasks === totalSubtasks) {
            statusGroup = "under_review";
          }
        }

        const progress =
          totalSubtasks > 0
            ? Math.round((completedSubtasks / totalSubtasks) * 100)
            : 0;

        if (statusCounts[statusGroup] !== undefined) {
          statusCounts[statusGroup] += 1;
        }

        return {
          project_id: projectId,
          project_title: project.project_title,
          description: project.description,
          status: project.status,
          status_group: statusGroup,
          status_label: getStatusLabel(statusGroup),
          department_name: project.department_name,
          start_date: project.start_date,
          end_date: project.end_date,
          assigned_names: assignedNames,
          total_subtasks: totalSubtasks,
          completed_subtasks: completedSubtasks,
          progress,
        };
      });

    const ongoingProjects = projects.filter(
      (project) => project.status_group !== "done"
    );

    return {
      projects: ongoingProjects,
      statusCounts,
    };
  } catch (error) {
    console.error("Admin overview ongoing projects error:", error.message);

    return {
      projects: [],
      statusCounts: {
        todo: 0,
        in_progress: 0,
        under_review: 0,
        done: 0,
      },
    };
  }
};

const getAdminAttendance = async (adminUser) => {
  try {
    const attendanceColumnInfo = await getTableColumnInfo("attendance");
    const attendanceColumns = attendanceColumnInfo.map((col) => col.Field);

    const idColumn = pickColumn(attendanceColumns, ["attendance_id", "id"]);

    const userColumn = pickColumn(attendanceColumns, [
      "user_id",
      "employee_id",
      "admin_id",
    ]);

    const dateColumn = pickColumn(attendanceColumns, [
      "attendance_date",
      "date",
      "created_at",
    ]);

    const checkInColumn = pickColumn(attendanceColumns, [
      "check_in",
      "check_in_time",
      "in_time",
      "login_time",
    ]);

    const checkOutColumn = pickColumn(attendanceColumns, [
      "check_out",
      "check_out_time",
      "out_time",
      "logout_time",
    ]);

    const statusColumn = pickColumn(attendanceColumns, [
      "status",
      "attendance_status",
    ]);

    if (!userColumn) {
      return {
        latest: null,
        records: [],
      };
    }

    const orderColumn = dateColumn || idColumn;

    const [records] = await db.query(
      `
      SELECT
        ${idColumn ? escapeId(idColumn) : "NULL"} AS attendance_id,
        ${dateColumn ? escapeId(dateColumn) : "NULL"} AS attendance_date,
        ${checkInColumn ? escapeId(checkInColumn) : "NULL"} AS check_in,
        ${checkOutColumn ? escapeId(checkOutColumn) : "NULL"} AS check_out,
        ${statusColumn ? escapeId(statusColumn) : "'-'"} AS status
      FROM attendance
      WHERE ${escapeId(userColumn)} = ?
      ${orderColumn ? `ORDER BY ${escapeId(orderColumn)} DESC` : ""}
      LIMIT 10
      `,
      [adminUser.user_id]
    );

    return {
      latest: records[0] || null,
      records,
    };
  } catch (error) {
    console.error("Admin overview attendance error:", error.message);

    return {
      latest: null,
      records: [],
    };
  }
};

const getAdminOverviewSummary = async (req, res) => {
  try {
    const { adminUser, error } = await getLoggedInAdmin(req);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const [
      activityLogs,
      reviewNotifications,
      ongoingProjectData,
      attendanceData,
    ] = await Promise.all([
      getActivityLogs(),
      getReviewNotifications(adminUser),
      getOngoingProjects(adminUser),
      getAdminAttendance(adminUser),
    ]);

    return res.status(200).json({
      admin: adminUser,
      activityLogs,
      reviewNotifications,
      ongoingProjects: ongoingProjectData.projects,
      projectStatusCounts: ongoingProjectData.statusCounts,
      attendance: attendanceData.latest,
      attendanceRecords: attendanceData.records,
    });
  } catch (error) {
    console.error("Admin overview summary error:", error);

    return res.status(500).json({
      message: "Failed to load admin overview.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};

const reviewProjectFromOverview = async (req, res) => {
  try {
    await ensureProjectSubtasksTable();
    await ensureProjectRejectionsTable();
    await ensureProjectHoldsTable();

    const { adminUser, error } = await getLoggedInAdmin(req);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const projectId = Number(req.params.projectId);
    const action = String(req.body?.action || "").toLowerCase().trim();

    if (!projectId) {
      return res.status(400).json({
        message: "Project ID is required.",
      });
    }

    if (!["done", "reject", "on_hold"].includes(action)) {
      return res.status(400).json({
        message: "Action must be done, reject, or on_hold.",
      });
    }

    const {
      projectColumnInfo,
      projectColumns,
      projectIdColumn,
      projectStatusColumn,
      projectCreatedByColumn,
    } = await getProjectColumns();

    const {
      taskColumnInfo,
      taskProjectIdColumn,
      taskAssignedToColumn,
      taskStatusColumn,
    } = await getTaskColumns();

    if (!projectIdColumn || !projectStatusColumn) {
      return res.status(500).json({
        message: "projects table must have project_id and status column.",
        projectColumns,
      });
    }

    const projectParams = projectCreatedByColumn
      ? [projectId, adminUser.user_id]
      : [projectId];

    const [projectRows] = await db.query(
      `
      SELECT *
      FROM projects
      WHERE ${escapeId(projectIdColumn)} = ?
      ${
        projectCreatedByColumn
          ? `AND ${escapeId(projectCreatedByColumn)} = ?`
          : ""
      }
      LIMIT 1
      `,
      projectParams
    );

    if (!projectRows || projectRows.length === 0) {
      return res.status(404).json({
        message: "Project not found or you are not allowed to review it.",
      });
    }

    let assignedUserIds = [];

    if (taskProjectIdColumn && taskAssignedToColumn) {
      const [assignedRows] = await db.query(
        `
        SELECT DISTINCT ${escapeId(taskAssignedToColumn)} AS assigned_user_id
        FROM tasks
        WHERE ${escapeId(taskProjectIdColumn)} = ?
        AND ${escapeId(taskAssignedToColumn)} IS NOT NULL
        `,
        [projectId]
      );

      assignedUserIds = assignedRows
        .map((row) => Number(row.assigned_user_id))
        .filter(Boolean);
    }

    if (action === "done") {
      const safeProjectStatus = getSafeStatusValue(
        projectColumnInfo,
        projectStatusColumn,
        "done"
      );

      await db.query(
        `
        UPDATE projects
        SET ${escapeId(projectStatusColumn)} = ?
        WHERE ${escapeId(projectIdColumn)} = ?
        `,
        [safeProjectStatus, projectId]
      );

      if (taskProjectIdColumn && taskStatusColumn) {
        const safeTaskStatus = getSafeStatusValue(
          taskColumnInfo,
          taskStatusColumn,
          "done"
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

      await db.query(
        `
        UPDATE project_subtasks
        SET status = 'done'
        WHERE project_id = ?
        `,
        [projectId]
      );

      await db.query(
        `
        UPDATE project_rejections
        SET active = 0,
            decision_status = 'done',
            decision_by = ?,
            decision_at = NOW()
        WHERE project_id = ?
        AND active = 1
        `,
        [adminUser.user_id, projectId]
      );

      await db.query(
        `
        UPDATE project_holds
        SET active = 0,
            decision_status = 'done',
            decision_by = ?,
            decision_at = NOW()
        WHERE project_id = ?
        AND active = 1
        `,
        [adminUser.user_id, projectId]
      );

      return res.status(200).json({
        message: "Project marked as done.",
      });
    }

    const safeProjectStatus = getSafeStatusValue(
      projectColumnInfo,
      projectStatusColumn,
      "in_progress"
    );

    await db.query(
      `
      UPDATE projects
      SET ${escapeId(projectStatusColumn)} = ?
      WHERE ${escapeId(projectIdColumn)} = ?
      `,
      [safeProjectStatus, projectId]
    );

    if (taskProjectIdColumn && taskStatusColumn) {
      const safeTaskStatus = getSafeStatusValue(
        taskColumnInfo,
        taskStatusColumn,
        "in_progress"
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

    await db.query(
      `
      UPDATE project_rejections
      SET active = 0
      WHERE project_id = ?
      AND active = 1
      `,
      [projectId]
    );

    await db.query(
      `
      UPDATE project_holds
      SET active = 0
      WHERE project_id = ?
      AND active = 1
      `,
      [projectId]
    );

    if (action === "reject") {
      if (assignedUserIds.length === 0) {
        await db.query(
          `
          INSERT INTO project_rejections
          (
            project_id,
            assigned_user_id,
            rejected_by,
            rejection_reason,
            decision_status,
            active,
            rejected_at,
            expires_at
          )
          VALUES (?, NULL, ?, ?, 'pending', 1, NOW(), DATE_ADD(NOW(), INTERVAL 1 MONTH))
          `,
          [
            projectId,
            adminUser.user_id,
            "Project rejected by admin. This project cannot be edited by the assignee.",
          ]
        );
      } else {
        for (const assignedUserId of assignedUserIds) {
          await db.query(
            `
            INSERT INTO project_rejections
            (
              project_id,
              assigned_user_id,
              rejected_by,
              rejection_reason,
              decision_status,
              active,
              rejected_at,
              expires_at
            )
            VALUES (?, ?, ?, ?, 'pending', 1, NOW(), DATE_ADD(NOW(), INTERVAL 1 MONTH))
            `,
            [
              projectId,
              assignedUserId,
              adminUser.user_id,
              "Project rejected by admin. This project cannot be edited by the assignee.",
            ]
          );
        }
      }

      return res.status(200).json({
        message: "Project rejected and moved to Rejected Projects.",
      });
    }

    if (action === "on_hold") {
      if (assignedUserIds.length === 0) {
        await db.query(
          `
          INSERT INTO project_holds
          (
            project_id,
            assigned_user_id,
            held_by,
            hold_reason,
            decision_status,
            active,
            held_at
          )
          VALUES (?, NULL, ?, ?, 'pending', 1, NOW())
          `,
          [
            projectId,
            adminUser.user_id,
            "Project kept on hold by admin. Assignee can resume it.",
          ]
        );
      } else {
        for (const assignedUserId of assignedUserIds) {
          await db.query(
            `
            INSERT INTO project_holds
            (
              project_id,
              assigned_user_id,
              held_by,
              hold_reason,
              decision_status,
              active,
              held_at
            )
            VALUES (?, ?, ?, ?, 'pending', 1, NOW())
            `,
            [
              projectId,
              assignedUserId,
              adminUser.user_id,
              "Project kept on hold by admin. Assignee can resume it.",
            ]
          );
        }
      }

      return res.status(200).json({
        message: "Project moved to Projects On Hold.",
      });
    }
  } catch (error) {
    console.error("Review project from overview error:", error);

    return res.status(500).json({
      message: "Failed to review project.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};

module.exports = {
  getAdminOverviewSummary,
  reviewProjectFromOverview,
};
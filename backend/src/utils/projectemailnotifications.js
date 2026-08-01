const db = require("../config/db");

const {
  sendProjectCreatedEmail,
  sendMainTaskAssignedEmail,
  sendProjectUpdatedEmail,
} = require("./emailservice");

const {
  hasSentEmail,
  logEmailNotification,
} = require("./emailnotificationlog");

const escapeId = (value) => {
  return `\`${String(value).replace(/`/g, "``")}\``;
};

const getTableColumns = async (tableName) => {
  const [columns] = await db.query(`SHOW COLUMNS FROM ${escapeId(tableName)}`);
  return columns.map((column) => column.Field);
};

const pickColumn = (columns, possibleNames) => {
  return possibleNames.find((name) => columns.includes(name));
};

const safeHasSentEmail = async (notificationKey) => {
  try {
    return await hasSentEmail(notificationKey);
  } catch (error) {
    console.warn("Email duplicate check skipped:", error.message);
    return false;
  }
};

const safeLogEmailNotification = async (payload) => {
  try {
    await logEmailNotification(payload);
  } catch (error) {
    console.warn("Email log skipped:", error.message);
  }
};

const getProjectMap = async () => {
  const columns = await getTableColumns("projects");

  return {
    title: pickColumn(columns, ["project_title", "title", "project_name", "name"]),
    description: pickColumn(columns, [
      "project_description",
      "description",
      "project_details",
      "details",
      "main_task",
    ]),
    startDate: pickColumn(columns, ["start_date", "project_start_date"]),
    endDate: pickColumn(columns, [
      "end_date",
      "due_date",
      "project_end_date",
      "deadline",
    ]),
    createdBy: pickColumn(columns, [
      "created_by_user_id",
      "created_by",
      "created_by_id",
      "admin_id",
      "assigned_by_user_id",
    ]),
  };
};

const getTaskMap = async () => {
  const columns = await getTableColumns("tasks");

  return {
    projectId: pickColumn(columns, ["project_id"]),
    parentTaskId: pickColumn(columns, ["parent_task_id"]),
    title: pickColumn(columns, [
      "task_title",
      "title",
      "task_name",
      "name",
      "main_task_title",
    ]),
    assignedTo: pickColumn(columns, [
      "assigned_to_user_id",
      "assigned_to",
      "assignee_id",
      "employee_id",
      "user_id",
    ]),
    startDate: pickColumn(columns, ["start_date", "task_start_date"]),
    dueDate: pickColumn(columns, [
      "due_date",
      "end_date",
      "task_end_date",
      "deadline",
    ]),
  };
};

const getAssignmentMap = async () => {
  const columns = await getTableColumns("project_assignments");

  return {
    projectId: pickColumn(columns, ["project_id"]),
    userId: pickColumn(columns, [
      "assigned_to_user_id",
      "user_id",
      "employee_id",
      "assignee_id",
      "assigned_user_id",
    ]),
  };
};

const getProjectDetails = async (projectId) => {
  const projectMap = await getProjectMap();

  if (!projectMap.title) {
    throw new Error("Project title column not found in projects table.");
  }

  const creatorJoin = projectMap.createdBy
    ? `LEFT JOIN users creator ON creator.user_id = p.${escapeId(projectMap.createdBy)}`
    : "";

  const [rows] = await db.query(
    `
      SELECT
        p.project_id,
        p.${escapeId(projectMap.title)} AS project_title,

        ${
          projectMap.description
            ? `p.${escapeId(projectMap.description)}`
            : "NULL"
        } AS project_description,

        ${
          projectMap.startDate
            ? `DATE_FORMAT(p.${escapeId(projectMap.startDate)}, '%Y-%m-%d')`
            : "NULL"
        } AS start_date,

        ${
          projectMap.endDate
            ? `DATE_FORMAT(p.${escapeId(projectMap.endDate)}, '%Y-%m-%d')`
            : "NULL"
        } AS due_date,

        ${projectMap.createdBy ? "creator.full_name" : "NULL"} AS created_by_name,
        ${projectMap.createdBy ? "creator.email" : "NULL"} AS created_by_email

      FROM projects p
      ${creatorJoin}
      WHERE p.project_id = ?
      LIMIT 1
    `,
    [projectId]
  );

  if (!rows.length) {
    throw new Error(`Project not found for email notification. Project ID: ${projectId}`);
  }

  return rows[0];
};

const getProjectAssignmentAssignees = async (projectId) => {
  try {
    const assignmentMap = await getAssignmentMap();

    if (!assignmentMap.projectId || !assignmentMap.userId) {
      return [];
    }

    const [rows] = await db.query(
      `
        SELECT DISTINCT
          u.user_id,
          u.full_name,
          u.email,
          NULL AS task_id,
          NULL AS task_title,
          NULL AS task_start_date,
          NULL AS task_due_date
        FROM project_assignments pa
        INNER JOIN users u
          ON u.user_id = pa.${escapeId(assignmentMap.userId)}
        WHERE pa.${escapeId(assignmentMap.projectId)} = ?
        AND u.email IS NOT NULL
        AND u.email != ''
        AND LOWER(COALESCE(u.status, 'active')) != 'deleted'
        ORDER BY u.full_name ASC
      `,
      [projectId]
    );

    return rows;
  } catch (error) {
    console.warn("Project assignment assignee lookup skipped:", error.message);
    return [];
  }
};

const getTaskAssigneesByProjectId = async (projectId) => {
  const taskMap = await getTaskMap();

  if (!taskMap.projectId || !taskMap.assignedTo) {
    return [];
  }

  const parentTaskCondition = taskMap.parentTaskId
    ? `AND (t.${escapeId(taskMap.parentTaskId)} IS NULL OR t.${escapeId(
        taskMap.parentTaskId
      )} = 0)`
    : "";

  const [rows] = await db.query(
    `
      SELECT DISTINCT
        t.task_id,
        u.user_id,
        u.full_name,
        u.email,

        ${taskMap.title ? `t.${escapeId(taskMap.title)}` : "NULL"} AS task_title,

        ${
          taskMap.startDate
            ? `DATE_FORMAT(t.${escapeId(taskMap.startDate)}, '%Y-%m-%d')`
            : "NULL"
        } AS task_start_date,

        ${
          taskMap.dueDate
            ? `DATE_FORMAT(t.${escapeId(taskMap.dueDate)}, '%Y-%m-%d')`
            : "NULL"
        } AS task_due_date

      FROM tasks t
      INNER JOIN users u
        ON u.user_id = t.${escapeId(taskMap.assignedTo)}

      WHERE t.${escapeId(taskMap.projectId)} = ?
      ${parentTaskCondition}
      AND u.email IS NOT NULL
      AND u.email != ''
      AND LOWER(COALESCE(u.status, 'active')) != 'deleted'

      ORDER BY u.full_name ASC
    `,
    [projectId]
  );

  return rows;
};

const getTaskAssigneesByTaskIds = async (taskIds = []) => {
  const cleanTaskIds = Array.isArray(taskIds)
    ? taskIds.map(Number).filter(Boolean)
    : [];

  if (!cleanTaskIds.length) return [];

  const taskMap = await getTaskMap();

  if (!taskMap.assignedTo) {
    return [];
  }

  const [rows] = await db.query(
    `
      SELECT DISTINCT
        t.task_id,
        u.user_id,
        u.full_name,
        u.email,

        ${taskMap.title ? `t.${escapeId(taskMap.title)}` : "NULL"} AS task_title,

        ${
          taskMap.startDate
            ? `DATE_FORMAT(t.${escapeId(taskMap.startDate)}, '%Y-%m-%d')`
            : "NULL"
        } AS task_start_date,

        ${
          taskMap.dueDate
            ? `DATE_FORMAT(t.${escapeId(taskMap.dueDate)}, '%Y-%m-%d')`
            : "NULL"
        } AS task_due_date

      FROM tasks t
      INNER JOIN users u
        ON u.user_id = t.${escapeId(taskMap.assignedTo)}

      WHERE t.task_id IN (?)
      AND u.email IS NOT NULL
      AND u.email != ''
      AND LOWER(COALESCE(u.status, 'active')) != 'deleted'

      ORDER BY u.full_name ASC
    `,
    [cleanTaskIds]
  );

  return rows;
};

const mergeAssignees = (...groups) => {
  const map = new Map();

  groups.flat().forEach((assignee) => {
    if (!assignee?.user_id || !assignee?.email) return;

    if (!map.has(assignee.user_id)) {
      map.set(assignee.user_id, {
        user_id: assignee.user_id,
        full_name: assignee.full_name,
        email: assignee.email,
        task_ids: [],
        task_titles: [],
        task_start_date: assignee.task_start_date || null,
        task_due_date: assignee.task_due_date || null,
      });
    }

    const item = map.get(assignee.user_id);

    if (assignee.task_id && !item.task_ids.includes(assignee.task_id)) {
      item.task_ids.push(assignee.task_id);
    }

    if (assignee.task_title && !item.task_titles.includes(assignee.task_title)) {
      item.task_titles.push(assignee.task_title);
    }

    if (!item.task_start_date && assignee.task_start_date) {
      item.task_start_date = assignee.task_start_date;
    }

    if (!item.task_due_date && assignee.task_due_date) {
      item.task_due_date = assignee.task_due_date;
    }
  });

  return Array.from(map.values());
};

const sendEmailToAssignees = async ({
  project,
  assignees,
  adminUser,
  emailType,
  notificationPrefix,
  defaultTaskTitle,
  emailSender,
  alwaysSend = false,
}) => {
  const summary = {
    attempted: true,
    total: assignees.length,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  const adminName =
    adminUser?.full_name || project.created_by_name || "Admin";

  const adminEmail =
    adminUser?.email || project.created_by_email || process.env.SMTP_USER;

  for (const assignee of assignees) {
    const notificationKey = alwaysSend
      ? `${notificationPrefix}:${project.project_id}:${assignee.user_id}:${Date.now()}`
      : `${notificationPrefix}:${project.project_id}:${assignee.user_id}:${
          assignee.task_ids.join("-") || "project"
        }`;

    if (!alwaysSend) {
      const alreadySent = await safeHasSentEmail(notificationKey);

      if (alreadySent) {
        summary.skipped += 1;
        continue;
      }
    }

    try {
    const isProjectUpdateEmail = emailType === "project_updated";

const result = await emailSender({
  to: assignee.email,
  employeeName: assignee.full_name,
  projectTitle: project.project_title,
  projectDescription: project.project_description,
  taskTitle: assignee.task_titles.length
    ? assignee.task_titles.join(", ")
    : defaultTaskTitle,

  /*
    IMPORTANT:
    For project update emails, always show updated project dates.
    Do not use old task dates.
  */
  startDate: isProjectUpdateEmail
    ? project.start_date
    : assignee.task_start_date || project.start_date,

  dueDate: isProjectUpdateEmail
    ? project.due_date
    : assignee.task_due_date || project.due_date,

  adminName,
  adminEmail,
});

      await safeLogEmailNotification({
        notificationKey,
        emailType,
        taskId: assignee.task_ids.length ? assignee.task_ids[0] : null,
        projectId: project.project_id,
        userId: assignee.user_id,
        recipientEmail: assignee.email,
        status: result.skipped ? "skipped" : "sent",
        errorMessage: result.skipped ? result.message : null,
      });

      if (result.skipped) {
        summary.skipped += 1;
      } else {
        summary.sent += 1;
      }

      console.log(
        `${emailType} email sent to ${assignee.email} for project ${project.project_title}`
      );
    } catch (emailError) {
      summary.failed += 1;

      await safeLogEmailNotification({
        notificationKey,
        emailType,
        taskId: assignee.task_ids.length ? assignee.task_ids[0] : null,
        projectId: project.project_id,
        userId: assignee.user_id,
        recipientEmail: assignee.email,
        status: "failed",
        errorMessage: emailError.message,
      });

      console.error(`${emailType} email failed:`, emailError.message);
    }
  }

  return summary;
};

const sendProjectAssignmentEmails = async (projectId, adminUser) => {
  try {
    const project = await getProjectDetails(projectId);

    const projectAssignees = await getProjectAssignmentAssignees(projectId);
    const taskAssignees = await getTaskAssigneesByProjectId(projectId);

    const assignees = mergeAssignees(taskAssignees, projectAssignees);

    if (!assignees.length) {
      console.warn(
        `Project created email skipped: no assignees found for project ${projectId}.`
      );

      return {
        attempted: true,
        total: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
      };
    }

    return sendEmailToAssignees({
      project,
      assignees,
      adminUser,
      emailType: "project_created",
      notificationPrefix: "project_created",
      defaultTaskTitle: "Project created / assigned",
      emailSender: sendProjectCreatedEmail,
      alwaysSend: false,
    });
  } catch (error) {
    console.error("sendProjectAssignmentEmails error:", error.message);

    return {
      attempted: true,
      total: 0,
      sent: 0,
      skipped: 0,
      failed: 1,
      error: error.message,
    };
  }
};

const sendMainTaskAssignmentEmails = async (projectId, taskIds, adminUser) => {
  try {
    const project = await getProjectDetails(projectId);
    const taskAssignees = await getTaskAssigneesByTaskIds(taskIds);
    const assignees = mergeAssignees(taskAssignees);

    if (!assignees.length) {
      console.warn(
        `Main task assigned email skipped: no assignees found for project ${projectId}.`
      );

      return {
        attempted: true,
        total: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
      };
    }

    return sendEmailToAssignees({
      project,
      assignees,
      adminUser,
      emailType: "main_task_assigned",
      notificationPrefix: "main_task_assigned",
      defaultTaskTitle: "Main task assigned",
      emailSender: sendMainTaskAssignedEmail,
      alwaysSend: false,
    });
  } catch (error) {
    console.error("sendMainTaskAssignmentEmails error:", error.message);

    return {
      attempted: true,
      total: 0,
      sent: 0,
      skipped: 0,
      failed: 1,
      error: error.message,
    };
  }
};

const sendProjectUpdateEmails = async (projectId, adminUser, updatedDetails = {}) => {
  try {
    const projectFromDb = await getProjectDetails(projectId);

    const project = {
      ...projectFromDb,
      project_title:
        updatedDetails.projectTitle ||
        updatedDetails.project_title ||
        updatedDetails.title ||
        projectFromDb.project_title,

      project_description:
        updatedDetails.projectDescription ||
        updatedDetails.project_description ||
        updatedDetails.description ||
        projectFromDb.project_description,

      start_date:
        updatedDetails.startDate ||
        updatedDetails.start_date ||
        updatedDetails.project_start_date ||
        projectFromDb.start_date,

      due_date:
        updatedDetails.dueDate ||
        updatedDetails.due_date ||
        updatedDetails.endDate ||
        updatedDetails.end_date ||
        updatedDetails.project_end_date ||
        projectFromDb.due_date,
    };

    const projectAssignees = await getProjectAssignmentAssignees(projectId);
    const taskAssignees = await getTaskAssigneesByProjectId(projectId);

    const assignees = mergeAssignees(taskAssignees, projectAssignees);

    if (!assignees.length) {
      console.warn(
        `Project updated email skipped: no assignees found for project ${projectId}.`
      );

      return {
        attempted: true,
        total: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
      };
    }

    return sendEmailToAssignees({
      project,
      assignees,
      adminUser,
      emailType: "project_updated",
      notificationPrefix: "project_updated",
      defaultTaskTitle: "Project updated",
      emailSender: sendProjectUpdatedEmail,
      alwaysSend: true,
    });
  } catch (error) {
    console.error("sendProjectUpdateEmails error:", error.message);

    return {
      attempted: true,
      total: 0,
      sent: 0,
      skipped: 0,
      failed: 1,
      error: error.message,
    };
  }
};

module.exports = {
  sendProjectAssignmentEmails,
  sendMainTaskAssignmentEmails,
  sendProjectUpdateEmails,
};
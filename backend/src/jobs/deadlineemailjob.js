const cron = require("node-cron");
const db = require("../config/db");

const {
  sendDeadlineReminderEmail,
  sendDeadlineMissedEmail,
} = require("../utils/emailservice");

const {
  hasSentEmail,
  logEmailNotification,
} = require("../utils/emailnotificationlog");

const isIncompleteStatus = `
  LOWER(COALESCE(t.status, 'not_started')) NOT IN ('completed', 'done')
`;

const getDeadlineTasks = async ({ type }) => {
  let dateCondition = "";

  if (type === "reminder") {
    dateCondition = `DATE(t.due_date) = DATE_ADD(CURDATE(), INTERVAL 2 DAY)`;
  }

  if (type === "missed") {
    dateCondition = `DATE(t.due_date) < CURDATE()`;
  }

  const [tasks] = await db.query(
    `
    SELECT
      t.task_id,
      t.project_id,
      t.assigned_to_user_id,
      t.created_by_user_id,
      t.task_title,
      t.status,
      DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date,

      p.project_title,

      employee.full_name AS employee_name,
      employee.email AS employee_email,

      admin.full_name AS admin_name,
      admin.email AS admin_email

    FROM tasks t

    LEFT JOIN projects p
      ON p.project_id = t.project_id

    LEFT JOIN users employee
      ON employee.user_id = t.assigned_to_user_id

    LEFT JOIN users admin
      ON admin.user_id = t.created_by_user_id

    WHERE
      (t.parent_task_id IS NULL OR t.parent_task_id = 0)
      AND t.due_date IS NOT NULL
      AND ${dateCondition}
      AND ${isIncompleteStatus}
      AND employee.email IS NOT NULL
      AND employee.email != ''

    ORDER BY t.due_date ASC
    `
  );

  return tasks;
};

const processDeadlineEmails = async () => {
  console.log("Checking task/project deadline emails...");

  const reminderTasks = await getDeadlineTasks({ type: "reminder" });
  const missedTasks = await getDeadlineTasks({ type: "missed" });

  for (const task of reminderTasks) {
    const notificationKey = `deadline_reminder:${task.task_id}:${task.due_date}`;

    const alreadySent = await hasSentEmail(notificationKey);

    if (alreadySent) continue;

    try {
      const result = await sendDeadlineReminderEmail({
        to: task.employee_email,
        employeeName: task.employee_name,
        taskTitle: task.task_title,
        projectTitle: task.project_title,
        dueDate: task.due_date,
        adminName: task.admin_name,
        adminEmail: task.admin_email,
      });

      await logEmailNotification({
        notificationKey,
        emailType: "deadline_reminder",
        taskId: task.task_id,
        projectId: task.project_id,
        userId: task.assigned_to_user_id,
        recipientEmail: task.employee_email,
        status: result.skipped ? "skipped" : "sent",
        errorMessage: result.skipped ? result.message : null,
      });
    } catch (error) {
      await logEmailNotification({
        notificationKey,
        emailType: "deadline_reminder",
        taskId: task.task_id,
        projectId: task.project_id,
        userId: task.assigned_to_user_id,
        recipientEmail: task.employee_email,
        status: "failed",
        errorMessage: error.message,
      });

      console.error("Deadline reminder email failed:", error.message);
    }
  }

  for (const task of missedTasks) {
    const notificationKey = `deadline_missed:${task.task_id}:${task.due_date}`;

    const alreadySent = await hasSentEmail(notificationKey);

    if (alreadySent) continue;

    try {
      const result = await sendDeadlineMissedEmail({
        to: task.employee_email,
        employeeName: task.employee_name,
        taskTitle: task.task_title,
        projectTitle: task.project_title,
        dueDate: task.due_date,
        adminName: task.admin_name,
        adminEmail: task.admin_email,
      });

      await logEmailNotification({
        notificationKey,
        emailType: "deadline_missed",
        taskId: task.task_id,
        projectId: task.project_id,
        userId: task.assigned_to_user_id,
        recipientEmail: task.employee_email,
        status: result.skipped ? "skipped" : "sent",
        errorMessage: result.skipped ? result.message : null,
      });
    } catch (error) {
      await logEmailNotification({
        notificationKey,
        emailType: "deadline_missed",
        taskId: task.task_id,
        projectId: task.project_id,
        userId: task.assigned_to_user_id,
        recipientEmail: task.employee_email,
        status: "failed",
        errorMessage: error.message,
      });

      console.error("Deadline missed email failed:", error.message);
    }
  }

  console.log(
    `Deadline email check completed. Reminders: ${reminderTasks.length}, Missed: ${missedTasks.length}`
  );
};

const startDeadlineEmailJob = () => {
  cron.schedule("0 9 * * *", async () => {
    try {
      await processDeadlineEmails();
    } catch (error) {
      console.error("Deadline email job error:", error.message);
    }
  });

  console.log("Deadline email cron job scheduled for 9:00 AM daily.");
};

module.exports = {
  startDeadlineEmailJob,
  processDeadlineEmails,
};
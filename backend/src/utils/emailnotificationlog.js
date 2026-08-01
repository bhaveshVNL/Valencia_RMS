const db = require("../config/db");

const hasSentEmail = async (notificationKey) => {
  const [rows] = await db.query(
    `
    SELECT email_log_id
    FROM email_notification_logs
    WHERE notification_key = ?
    AND status = 'sent'
    LIMIT 1
    `,
    [notificationKey]
  );

  return rows.length > 0;
};

const logEmailNotification = async ({
  notificationKey,
  emailType,
  taskId = null,
  projectId = null,
  userId = null,
  recipientEmail,
  status = "sent",
  errorMessage = null,
}) => {
  await db.query(
    `
    INSERT INTO email_notification_logs (
      notification_key,
      email_type,
      task_id,
      project_id,
      user_id,
      recipient_email,
      status,
      error_message
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      status = VALUES(status),
      error_message = VALUES(error_message),
      sent_at = CURRENT_TIMESTAMP
    `,
    [
      notificationKey,
      emailType,
      taskId,
      projectId,
      userId,
      recipientEmail,
      status,
      errorMessage,
    ]
  );
};

module.exports = {
  hasSentEmail,
  logEmailNotification,
};
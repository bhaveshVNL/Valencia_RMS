const nodemailer = require("nodemailer");

const isEmailConfigured = () => {
  return (
    process.env.EMAIL_ENABLED === "true" &&
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
};

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized:
        String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || "false") === "true",
    },
  });
};

const sendMail = async ({
  to,
  cc,
  subject,
  html,
  text,
  replyTo,
}) => {
  if (!isEmailConfigured()) {
    console.warn("Email skipped: SMTP is not configured properly.");
    return {
      skipped: true,
      message: "SMTP not configured.",
    };
  }

  const transporter = createTransporter();

  const fromName = process.env.SMTP_FROM_NAME || "Valencia RMS";

  const safeText =
    text && String(text).trim()
      ? String(text).trim()
      : "Valencia RMS notification";

  const safeHtml =
    html && String(html).trim()
      ? String(html).trim()
      : `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          ${safeText
            .split("\n")
            .filter((line) => line.trim())
            .map((line) => `<p>${line}</p>`)
            .join("")}
        </div>
      `;

 const result = await transporter.sendMail({
  from: `"${fromName}" <${process.env.SMTP_USER}>`,
  to,
  cc: cc || undefined,
  replyTo: replyTo || process.env.SMTP_USER,
  subject,
  text: safeText,
  html: safeHtml,
});
  return {
    skipped: false,
    messageId: result.messageId,
  };
};

const cleanValue = (value) => {
  if (value === undefined || value === null || value === "") return "-";
  return String(value);
};

const escapeHtml = (value) => {
  return cleanValue(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const buildTableRow = (label, value) => {
  return `
    <tr>
      <td style="padding: 10px 12px; border: 1px solid #eeeeee; background:#f8fafc; font-weight:700; width: 170px;">
        ${escapeHtml(label)}
      </td>
      <td style="padding: 10px 12px; border: 1px solid #eeeeee;">
        ${escapeHtml(value)}
      </td>
    </tr>
  `;
};

const buildEmailHtml = ({
  heading,
  greetingName,
  intro,
  projectTitle,
  taskTitle,
  startDate,
  dueDate,
  actionByLabel,
  adminName,
  adminEmail,
  descriptionLabel,
  projectDescription,
  footerLine,
}) => {
  return `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 760px;">
    <h2 style="color:#ff5733; margin: 0 0 18px; font-size: 24px;">
      ${escapeHtml(heading)}
    </h2>

    <p>Hello <strong>${escapeHtml(greetingName || "Employee")}</strong>,</p>

    <p>${escapeHtml(intro)}</p>

    <table style="border-collapse: collapse; width: 100%; max-width: 720px; margin: 18px 0;">
      ${buildTableRow("Project", projectTitle)}
      ${buildTableRow("Task", taskTitle)}
      ${buildTableRow("Start Date", startDate)}
      ${buildTableRow("Due Date", dueDate)}
      ${buildTableRow(
        actionByLabel,
        `${cleanValue(adminName || "Admin")} (${cleanValue(adminEmail)})`
      )}
    </table>

    <p style="margin-top: 18px;"><strong>${escapeHtml(descriptionLabel)}:</strong></p>
    <p>${escapeHtml(projectDescription)}</p>

    <p>${escapeHtml(footerLine)}</p>

    <p style="margin-top: 22px;">
      Regards,<br/>
      Valencia RMS
    </p>
  </div>
  `;
};

const sendProjectCreatedEmail = async ({
  to,
  employeeName,
  projectTitle,
  projectDescription,
  taskTitle,
  startDate,
  dueDate,
  adminName,
  adminEmail,
}) => {
  const subject = `Project Assigned: ${cleanValue(projectTitle)}`;

  const text = `
Hello ${cleanValue(employeeName)},

A new project has been created and assigned to you in Valencia RMS.

Project: ${cleanValue(projectTitle)}
Task: ${cleanValue(taskTitle)}
Start Date: ${cleanValue(startDate)}
Due Date: ${cleanValue(dueDate)}

Assigned By: ${cleanValue(adminName)} (${cleanValue(adminEmail)})

Description:
${cleanValue(projectDescription)}

Please login to Valencia RMS and check your dashboard.

Regards,
Valencia RMS
`;

  const html = buildEmailHtml({
    heading: "Project Created / Assigned",
    greetingName: employeeName,
    intro: "A new project has been created and assigned to you in Valencia RMS.",
    projectTitle,
    taskTitle,
    startDate,
    dueDate,
    actionByLabel: "Assigned By",
    adminName,
    adminEmail,
    descriptionLabel: "Description",
    projectDescription,
    footerLine: "Please login to Valencia RMS and check your dashboard.",
  });

  return sendMail({
    to,
    subject,
    text,
    html,
    replyTo: adminEmail,
  });
};

const sendMainTaskAssignedEmail = async ({
  to,
  employeeName,
  projectTitle,
  projectDescription,
  taskTitle,
  startDate,
  dueDate,
  adminName,
  adminEmail,
}) => {
  const subject = `Main Task Assigned: ${cleanValue(taskTitle)}`;

  const text = `
Hello ${cleanValue(employeeName)},

A new main task has been assigned to you in Valencia RMS.

Project: ${cleanValue(projectTitle)}
Main Task: ${cleanValue(taskTitle)}
Start Date: ${cleanValue(startDate)}
Due Date: ${cleanValue(dueDate)}

Assigned By: ${cleanValue(adminName)} (${cleanValue(adminEmail)})

Project Description:
${cleanValue(projectDescription)}

Please login to Valencia RMS and check your task dashboard.

Regards,
Valencia RMS
`;

  const html = buildEmailHtml({
    heading: "Main Task Assigned",
    greetingName: employeeName,
    intro: "A new main task has been assigned to you in Valencia RMS.",
    projectTitle,
    taskTitle,
    startDate,
    dueDate,
    actionByLabel: "Assigned By",
    adminName,
    adminEmail,
    descriptionLabel: "Project Description",
    projectDescription,
    footerLine: "Please login to Valencia RMS and check your task dashboard.",
  });

  return sendMail({
    to,
    subject,
    text,
    html,
    replyTo: adminEmail,
  });
};

const sendProjectUpdatedEmail = async ({
  to,
  employeeName,
  projectTitle,
  projectDescription,
  taskTitle,
  startDate,
  dueDate,
  adminName,
  adminEmail,
}) => {
  const safeProjectTitle = cleanValue(projectTitle);
  const safeTaskTitle = cleanValue(taskTitle);
  const safeStartDate = cleanValue(startDate);
  const safeDueDate = cleanValue(dueDate);
  const safeAdminName = cleanValue(adminName || "Admin");
  const safeAdminEmail = cleanValue(adminEmail);
  const safeEmployeeName = cleanValue(employeeName || "Employee");
  const safeDescription = cleanValue(projectDescription);

  const subject = `Project Updated: ${safeProjectTitle}`;

  const text = `
Project Updated

Hello ${safeEmployeeName},

A project assigned to you has been updated in Valencia RMS.

Project: ${safeProjectTitle}
Task: ${safeTaskTitle}
Start Date: ${safeStartDate}
Due Date: ${safeDueDate}
Updated By: ${safeAdminName} (${safeAdminEmail})

Updated Description:
${safeDescription}

Please login to Valencia RMS and check your dashboard for the latest changes.

Regards,
Valencia RMS
`;

  const html = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 760px;">
  <h2 style="color:#ff5733; margin: 0 0 18px; font-size: 26px;">
    Project Updated
  </h2>

  <p>Hello <strong>${escapeHtml(safeEmployeeName)}</strong>,</p>

  <p>A project assigned to you has been updated in Valencia RMS.</p>

  <table style="border-collapse: collapse; width: 100%; max-width: 720px; margin: 18px 0;">
    <tr>
      <td style="padding: 10px 12px; border: 1px solid #eeeeee; background:#f8fafc; font-weight:700; width: 170px;">Project</td>
      <td style="padding: 10px 12px; border: 1px solid #eeeeee;">${escapeHtml(safeProjectTitle)}</td>
    </tr>

    <tr>
      <td style="padding: 10px 12px; border: 1px solid #eeeeee; background:#f8fafc; font-weight:700;">Task</td>
      <td style="padding: 10px 12px; border: 1px solid #eeeeee;">${escapeHtml(safeTaskTitle)}</td>
    </tr>

    <tr>
      <td style="padding: 10px 12px; border: 1px solid #eeeeee; background:#f8fafc; font-weight:700;">Start Date</td>
      <td style="padding: 10px 12px; border: 1px solid #eeeeee;">${escapeHtml(safeStartDate)}</td>
    </tr>

    <tr>
      <td style="padding: 10px 12px; border: 1px solid #eeeeee; background:#f8fafc; font-weight:700;">Due Date</td>
      <td style="padding: 10px 12px; border: 1px solid #eeeeee;">${escapeHtml(safeDueDate)}</td>
    </tr>

    <tr>
      <td style="padding: 10px 12px; border: 1px solid #eeeeee; background:#f8fafc; font-weight:700;">Updated By</td>
      <td style="padding: 10px 12px; border: 1px solid #eeeeee;">${escapeHtml(safeAdminName)} (${escapeHtml(safeAdminEmail)})</td>
    </tr>
  </table>

  <p style="margin-top: 18px;"><strong>Updated Description:</strong></p>
  <p>${escapeHtml(safeDescription)}</p>

  <p>Please login to Valencia RMS and check your dashboard for the latest changes.</p>

  <p style="margin-top: 22px;">
    Regards,<br/>
    Valencia RMS
  </p>
</div>
`;

  return sendMail({
    to,
    subject,
    text,
    html,
    replyTo: adminEmail,
  });
};

/*
  Old name kept for compatibility.
  If any old file still calls sendProjectAssignedEmail,
  it will send the correct project created/assigned email.
*/
const sendProjectAssignedEmail = sendProjectCreatedEmail;

const sendDeadlineReminderEmail = async ({
  to,
  employeeName,
  taskTitle,
  projectTitle,
  dueDate,
  adminName,
  adminEmail,
}) => {
  const subject = `Reminder: 2 Days Left for ${cleanValue(taskTitle)}`;

  const text = `
Hello ${cleanValue(employeeName)},

This is a reminder that only 2 days are remaining for your assigned task.

Project: ${cleanValue(projectTitle)}
Task: ${cleanValue(taskTitle)}
Due Date: ${cleanValue(dueDate)}

Assigned By: ${cleanValue(adminName)} (${cleanValue(adminEmail)})

Please complete the task before the deadline.

Regards,
Valencia RMS
`;

  const html = `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
    <h2 style="color:#ff5733;">Deadline Reminder</h2>
    <p>Hello <strong>${escapeHtml(employeeName || "Employee")}</strong>,</p>
    <p>Only <strong>2 days</strong> are remaining for your assigned task.</p>
    <p><strong>Project:</strong> ${escapeHtml(projectTitle)}</p>
    <p><strong>Task:</strong> ${escapeHtml(taskTitle)}</p>
    <p><strong>Due Date:</strong> ${escapeHtml(dueDate)}</p>
    <p><strong>Assigned By:</strong> ${escapeHtml(adminName || "Admin")} (${escapeHtml(adminEmail)})</p>
    <p>Please complete the task before the deadline.</p>
    <p>Regards,<br/>Valencia RMS</p>
  </div>
  `;

  return sendMail({
    to,
    subject,
    text,
    html,
    replyTo: adminEmail,
  });
};

const sendDeadlineMissedEmail = async ({
  to,
  employeeName,
  taskTitle,
  projectTitle,
  dueDate,
  adminName,
  adminEmail,
}) => {
  const subject = `Deadline Missed: ${cleanValue(taskTitle)}`;

  const text = `
Hello ${cleanValue(employeeName)},

The deadline for your assigned task has passed and the task is still incomplete.

Project: ${cleanValue(projectTitle)}
Task: ${cleanValue(taskTitle)}
Due Date: ${cleanValue(dueDate)}

Assigned By: ${cleanValue(adminName)} (${cleanValue(adminEmail)})

Please complete this task as soon as possible.

Regards,
Valencia RMS
`;

  const html = `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
    <h2 style="color:#b42318;">Deadline Missed</h2>
    <p>Hello <strong>${escapeHtml(employeeName || "Employee")}</strong>,</p>
    <p>The deadline for your assigned task has passed and the task is still incomplete.</p>
    <p><strong>Project:</strong> ${escapeHtml(projectTitle)}</p>
    <p><strong>Task:</strong> ${escapeHtml(taskTitle)}</p>
    <p><strong>Due Date:</strong> ${escapeHtml(dueDate)}</p>
    <p><strong>Assigned By:</strong> ${escapeHtml(adminName || "Admin")} (${escapeHtml(adminEmail)})</p>
    <p>Please complete this task as soon as possible.</p>
    <p>Regards,<br/>Valencia RMS</p>
  </div>
  `;

  return sendMail({
    to,
    subject,
    text,
    html,
    replyTo: adminEmail,
  });
};

module.exports = {
  sendMail,
  sendProjectCreatedEmail,
  sendProjectAssignedEmail,
  sendMainTaskAssignedEmail,
  sendProjectUpdatedEmail,
  sendDeadlineReminderEmail,
  sendDeadlineMissedEmail,
};
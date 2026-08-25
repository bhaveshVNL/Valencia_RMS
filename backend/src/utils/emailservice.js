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

const formatMeetingDate = (value) => {
  if (!value) return "-";

  const raw = String(value).slice(0, 10);

  const parts = raw.split("-");

  if (parts.length !== 3) {
    return cleanValue(value);
  }

  const [year, month, day] = parts;

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );

  if (Number.isNaN(date.getTime())) {
    return cleanValue(value);
  }

  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const formatMeetingTime = (value) => {
  if (!value) return "-";

  const [hourString, minuteString] =
    String(value).split(":");

  const hour = Number(hourString);
  const minute = Number(minuteString || 0);

  if (Number.isNaN(hour)) {
    return cleanValue(value);
  }

  const date = new Date();

  date.setHours(
    hour,
    minute,
    0,
    0
  );

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const sendMeetingScheduledEmail = async ({
  to,
  participantName,
  meetingTitle,
  description,
  meetingDate,
  startTime,
  endTime,
  scheduledBy,
  scheduledByEmail,
  participants,
}) => {
  const safeTitle =
    cleanValue(meetingTitle);

  const safeParticipant =
    cleanValue(
      participantName || "Team Member"
    );

  const safeDescription =
    description &&
    String(description).trim()
      ? String(description).trim()
      : "No additional notes provided.";

  const safeScheduledBy =
    cleanValue(
      scheduledBy || "Admin"
    );

  const formattedDate =
    formatMeetingDate(meetingDate);

  const formattedStartTime =
    formatMeetingTime(startTime);

  const formattedEndTime =
    formatMeetingTime(endTime);

  const participantNames =
    Array.isArray(participants)
      ? participants
          .map((item) =>
            typeof item === "string"
              ? item
              : item?.full_name
          )
          .filter(Boolean)
          .join(", ")
      : cleanValue(participants);

  const subject =
    `Meeting Scheduled: ${safeTitle}`;

  const text = `
Hello ${safeParticipant},

A meeting has been scheduled for you in Valencia RMS.

Meeting: ${safeTitle}
Date: ${formattedDate}
Time: ${formattedStartTime} - ${formattedEndTime}
Scheduled By: ${safeScheduledBy}
Participants: ${cleanValue(participantNames)}

Description / Notes:
${safeDescription}

The meeting has also been added to your Valencia RMS calendar.

Regards,
Valencia RMS
`;

  const html = `
  <div
    style="
      margin:0;
      padding:0;
      background:#f6f7f9;
      font-family:Arial, Helvetica, sans-serif;
      color:#111827;
    "
  >
    <div
      style="
        max-width:680px;
        margin:0 auto;
        padding:30px 18px;
      "
    >

      <div
        style="
          background:#ffffff;
          border:1px solid #eeeeee;
          border-radius:12px;
          overflow:hidden;
        "
      >

        <!-- HEADER -->

        <div
          style="
            background:#ff5733;
            padding:24px 28px;
          "
        >
          <div
            style="
              color:#ffffff;
              font-size:13px;
              font-weight:700;
              margin-bottom:6px;
            "
          >
            Valencia RMS
          </div>

          <div
            style="
              color:#ffffff;
              font-size:24px;
              font-weight:800;
              line-height:1.3;
            "
          >
            Meeting Scheduled
          </div>
        </div>


        <!-- CONTENT -->

        <div
          style="
            padding:28px;
          "
        >

          <p
            style="
              margin:0 0 16px;
              font-size:15px;
              line-height:1.6;
            "
          >
            Hello
            <strong>
              ${escapeHtml(safeParticipant)}
            </strong>,
          </p>

          <p
            style="
              margin:0 0 22px;
              font-size:14px;
              line-height:1.7;
              color:#475467;
            "
          >
            A meeting has been scheduled for you
            in Valencia RMS.
          </p>


          <!-- MEETING TITLE -->

          <div
            style="
              margin-bottom:22px;
              padding:17px 18px;
              background:#fff4f1;
              border-left:4px solid #ff5733;
              border-radius:7px;
            "
          >
            <div
              style="
                font-size:11px;
                font-weight:700;
                color:#ff5733;
                text-transform:uppercase;
                letter-spacing:0.5px;
                margin-bottom:5px;
              "
            >
              Meeting
            </div>

            <div
              style="
                font-size:19px;
                font-weight:800;
                color:#182033;
              "
            >
              ${escapeHtml(safeTitle)}
            </div>
          </div>


          <!-- DETAILS -->

          <table
            style="
              border-collapse:collapse;
              width:100%;
              margin:0 0 22px;
            "
          >

            <tr>
              <td
                style="
                  width:150px;
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  background:#f8fafc;
                  font-size:13px;
                  font-weight:700;
                  color:#344054;
                "
              >
                Date
              </td>

              <td
                style="
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  font-size:13px;
                  color:#344054;
                "
              >
                ${escapeHtml(formattedDate)}
              </td>
            </tr>


            <tr>
              <td
                style="
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  background:#f8fafc;
                  font-size:13px;
                  font-weight:700;
                  color:#344054;
                "
              >
                Time
              </td>

              <td
                style="
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  font-size:13px;
                  color:#344054;
                "
              >
                ${escapeHtml(
                  `${formattedStartTime} - ${formattedEndTime}`
                )}
              </td>
            </tr>


            <tr>
              <td
                style="
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  background:#f8fafc;
                  font-size:13px;
                  font-weight:700;
                  color:#344054;
                "
              >
                Scheduled By
              </td>

              <td
                style="
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  font-size:13px;
                  color:#344054;
                "
              >
                ${escapeHtml(safeScheduledBy)}
              </td>
            </tr>


            <tr>
              <td
                style="
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  background:#f8fafc;
                  font-size:13px;
                  font-weight:700;
                  color:#344054;
                "
              >
                Participants
              </td>

              <td
                style="
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  font-size:13px;
                  line-height:1.6;
                  color:#344054;
                "
              >
                ${escapeHtml(
                  participantNames || "-"
                )}
              </td>
            </tr>

          </table>


          <!-- DESCRIPTION -->

          <div
            style="
              margin-bottom:22px;
            "
          >
            <div
              style="
                margin-bottom:7px;
                font-size:13px;
                font-weight:800;
                color:#182033;
              "
            >
              Description / Notes
            </div>

            <div
              style="
                padding:14px 16px;
                background:#f8fafc;
                border-radius:7px;
                font-size:13px;
                line-height:1.7;
                color:#475467;
              "
            >
              ${escapeHtml(
                safeDescription
              )}
            </div>
          </div>


          <p
            style="
              margin:0;
              font-size:13px;
              line-height:1.7;
              color:#667085;
            "
          >
            This meeting has also been added to
            your Valencia RMS calendar.
          </p>


          <p
            style="
              margin:24px 0 0;
              font-size:14px;
              line-height:1.6;
            "
          >
            Regards,<br/>
            <strong>Valencia RMS</strong>
          </p>

        </div>
      </div>


      <!-- FOOTER -->

      <div
        style="
          padding-top:14px;
          text-align:center;
          font-size:11px;
          color:#98a2b3;
        "
      >
        This is an automated notification from
        Valencia RMS.
      </div>

    </div>
  </div>
  `;

  return sendMail({
    to,
    subject,
    text,
    html,
    replyTo:
      scheduledByEmail ||
      process.env.SMTP_USER,
  });
};

const sendMeetingUpdatedEmail = async ({
  to,
  participantName,
  meetingTitle,
  description,
  meetingDate,
  startTime,
  endTime,
  updatedBy,
  updatedByEmail,
  participants,
}) => {
  const safeTitle =
    cleanValue(meetingTitle);

  const safeParticipant =
    cleanValue(
      participantName || "Team Member"
    );

  const safeDescription =
    description &&
    String(description).trim()
      ? String(description).trim()
      : "No additional notes provided.";

  const safeUpdatedBy =
    cleanValue(
      updatedBy || "Admin"
    );

  const formattedDate =
    formatMeetingDate(meetingDate);

  const formattedStartTime =
    formatMeetingTime(startTime);

  const formattedEndTime =
    formatMeetingTime(endTime);

  const participantNames =
    Array.isArray(participants)
      ? participants
          .map((item) =>
            typeof item === "string"
              ? item
              : item?.full_name
          )
          .filter(Boolean)
          .join(", ")
      : cleanValue(participants);

  const subject =
    `Meeting Updated: ${safeTitle}`;

  const text = `
Hello ${safeParticipant},

A meeting scheduled for you has been updated in Valencia RMS.

Meeting: ${safeTitle}
Date: ${formattedDate}
Time: ${formattedStartTime} - ${formattedEndTime}
Updated By: ${safeUpdatedBy}
Participants: ${cleanValue(participantNames)}

Description / Notes:
${safeDescription}

Please check your Valencia RMS calendar for the latest meeting details.

Regards,
Valencia RMS
`;

  const html = `
  <div
    style="
      margin:0;
      padding:0;
      background:#f6f7f9;
      font-family:Arial, Helvetica, sans-serif;
      color:#111827;
    "
  >
    <div
      style="
        max-width:680px;
        margin:0 auto;
        padding:30px 18px;
      "
    >
      <div
        style="
          background:#ffffff;
          border:1px solid #eeeeee;
          border-radius:12px;
          overflow:hidden;
        "
      >

        <div
          style="
            background:#ff5733;
            padding:24px 28px;
          "
        >
          <div
            style="
              color:#ffffff;
              font-size:13px;
              font-weight:700;
              margin-bottom:6px;
            "
          >
            Valencia RMS
          </div>

          <div
            style="
              color:#ffffff;
              font-size:24px;
              font-weight:800;
              line-height:1.3;
            "
          >
            Meeting Updated
          </div>
        </div>

        <div style="padding:28px;">
          <p
            style="
              margin:0 0 16px;
              font-size:15px;
              line-height:1.6;
            "
          >
            Hello
            <strong>
              ${escapeHtml(safeParticipant)}
            </strong>,
          </p>

          <p
            style="
              margin:0 0 22px;
              font-size:14px;
              line-height:1.7;
              color:#475467;
            "
          >
            A meeting scheduled for you has been updated in Valencia RMS.
          </p>

          <div
            style="
              margin-bottom:22px;
              padding:17px 18px;
              background:#fff4f1;
              border-left:4px solid #ff5733;
              border-radius:7px;
            "
          >
            <div
              style="
                font-size:11px;
                font-weight:700;
                color:#ff5733;
                text-transform:uppercase;
                letter-spacing:0.5px;
                margin-bottom:5px;
              "
            >
              Meeting
            </div>

            <div
              style="
                font-size:19px;
                font-weight:800;
                color:#182033;
              "
            >
              ${escapeHtml(safeTitle)}
            </div>
          </div>

          <table
            style="
              border-collapse:collapse;
              width:100%;
              margin:0 0 22px;
            "
          >
            <tr>
              <td
                style="
                  width:150px;
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  background:#f8fafc;
                  font-size:13px;
                  font-weight:700;
                  color:#344054;
                "
              >
                Date
              </td>

              <td
                style="
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  font-size:13px;
                  color:#344054;
                "
              >
                ${escapeHtml(formattedDate)}
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  background:#f8fafc;
                  font-size:13px;
                  font-weight:700;
                  color:#344054;
                "
              >
                Time
              </td>

              <td
                style="
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  font-size:13px;
                  color:#344054;
                "
              >
                ${escapeHtml(
                  `${formattedStartTime} - ${formattedEndTime}`
                )}
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  background:#f8fafc;
                  font-size:13px;
                  font-weight:700;
                  color:#344054;
                "
              >
                Updated By
              </td>

              <td
                style="
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  font-size:13px;
                  color:#344054;
                "
              >
                ${escapeHtml(safeUpdatedBy)}
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  background:#f8fafc;
                  font-size:13px;
                  font-weight:700;
                  color:#344054;
                "
              >
                Participants
              </td>

              <td
                style="
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  font-size:13px;
                  line-height:1.6;
                  color:#344054;
                "
              >
                ${escapeHtml(
                  participantNames || "-"
                )}
              </td>
            </tr>
          </table>

          <div style="margin-bottom:22px;">
            <div
              style="
                margin-bottom:7px;
                font-size:13px;
                font-weight:800;
                color:#182033;
              "
            >
              Description / Notes
            </div>

            <div
              style="
                padding:14px 16px;
                background:#f8fafc;
                border-radius:7px;
                font-size:13px;
                line-height:1.7;
                color:#475467;
              "
            >
              ${escapeHtml(
                safeDescription
              )}
            </div>
          </div>

          <p
            style="
              margin:0;
              font-size:13px;
              line-height:1.7;
              color:#667085;
            "
          >
            Please check your Valencia RMS calendar for the latest meeting details.
          </p>

          <p
            style="
              margin:24px 0 0;
              font-size:14px;
              line-height:1.6;
            "
          >
            Regards,<br/>
            <strong>Valencia RMS</strong>
          </p>
        </div>
      </div>

      <div
        style="
          padding-top:14px;
          text-align:center;
          font-size:11px;
          color:#98a2b3;
        "
      >
        This is an automated notification from Valencia RMS.
      </div>
    </div>
  </div>
  `;

  return sendMail({
    to,
    subject,
    text,
    html,
    replyTo:
      updatedByEmail ||
      process.env.SMTP_USER,
  });
};
const sendMeetingCancelledEmail = async ({
  to,
  participantName,
  meetingTitle,
  description,
  meetingDate,
  startTime,
  endTime,
  cancelledBy,
  cancelledByEmail,
  participants,
}) => {
  const safeTitle =
    cleanValue(meetingTitle);

  const safeParticipant =
    cleanValue(
      participantName || "Team Member"
    );

  const safeDescription =
    description &&
    String(description).trim()
      ? String(description).trim()
      : "No additional notes provided.";

  const safeCancelledBy =
    cleanValue(
      cancelledBy || "Admin"
    );

  const formattedDate =
    formatMeetingDate(meetingDate);

  const formattedStartTime =
    formatMeetingTime(startTime);

  const formattedEndTime =
    formatMeetingTime(endTime);

  const participantNames =
    Array.isArray(participants)
      ? participants
          .map((item) =>
            typeof item === "string"
              ? item
              : item?.full_name
          )
          .filter(Boolean)
          .join(", ")
      : cleanValue(participants);

  const subject =
    `Meeting Cancelled: ${safeTitle}`;

  const text = `
Hello ${safeParticipant},

A meeting scheduled for you has been cancelled in Valencia RMS.

Meeting: ${safeTitle}
Date: ${formattedDate}
Time: ${formattedStartTime} - ${formattedEndTime}
Cancelled By: ${safeCancelledBy}
Participants: ${cleanValue(participantNames)}

Description / Notes:
${safeDescription}

This meeting is no longer active in your Valencia RMS schedule.

Regards,
Valencia RMS
`;

  const html = `
  <div
    style="
      margin:0;
      padding:0;
      background:#f6f7f9;
      font-family:Arial, Helvetica, sans-serif;
      color:#111827;
    "
  >
    <div
      style="
        max-width:680px;
        margin:0 auto;
        padding:30px 18px;
      "
    >
      <div
        style="
          background:#ffffff;
          border:1px solid #eeeeee;
          border-radius:12px;
          overflow:hidden;
        "
      >

        <div
          style="
            background:#ff5733;
            padding:24px 28px;
          "
        >
          <div
            style="
              color:#ffffff;
              font-size:13px;
              font-weight:700;
              margin-bottom:6px;
            "
          >
            Valencia RMS
          </div>

          <div
            style="
              color:#ffffff;
              font-size:24px;
              font-weight:800;
              line-height:1.3;
            "
          >
            Meeting Cancelled
          </div>
        </div>

        <div style="padding:28px;">
          <p
            style="
              margin:0 0 16px;
              font-size:15px;
              line-height:1.6;
            "
          >
            Hello
            <strong>
              ${escapeHtml(safeParticipant)}
            </strong>,
          </p>

          <p
            style="
              margin:0 0 22px;
              font-size:14px;
              line-height:1.7;
              color:#475467;
            "
          >
            A meeting scheduled for you has been cancelled in Valencia RMS.
          </p>

          <div
            style="
              margin-bottom:22px;
              padding:17px 18px;
              background:#fff4f1;
              border-left:4px solid #ff5733;
              border-radius:7px;
            "
          >
            <div
              style="
                font-size:11px;
                font-weight:700;
                color:#ff5733;
                text-transform:uppercase;
                letter-spacing:0.5px;
                margin-bottom:5px;
              "
            >
              Cancelled Meeting
            </div>

            <div
              style="
                font-size:19px;
                font-weight:800;
                color:#182033;
              "
            >
              ${escapeHtml(safeTitle)}
            </div>
          </div>

          <table
            style="
              border-collapse:collapse;
              width:100%;
              margin:0 0 22px;
            "
          >
            <tr>
              <td
                style="
                  width:150px;
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  background:#f8fafc;
                  font-size:13px;
                  font-weight:700;
                  color:#344054;
                "
              >
                Date
              </td>

              <td
                style="
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  font-size:13px;
                  color:#344054;
                "
              >
                ${escapeHtml(formattedDate)}
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  background:#f8fafc;
                  font-size:13px;
                  font-weight:700;
                  color:#344054;
                "
              >
                Time
              </td>

              <td
                style="
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  font-size:13px;
                  color:#344054;
                "
              >
                ${escapeHtml(
                  `${formattedStartTime} - ${formattedEndTime}`
                )}
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  background:#f8fafc;
                  font-size:13px;
                  font-weight:700;
                  color:#344054;
                "
              >
                Cancelled By
              </td>

              <td
                style="
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  font-size:13px;
                  color:#344054;
                "
              >
                ${escapeHtml(safeCancelledBy)}
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  background:#f8fafc;
                  font-size:13px;
                  font-weight:700;
                  color:#344054;
                "
              >
                Participants
              </td>

              <td
                style="
                  padding:12px 14px;
                  border:1px solid #eeeeee;
                  font-size:13px;
                  line-height:1.6;
                  color:#344054;
                "
              >
                ${escapeHtml(
                  participantNames || "-"
                )}
              </td>
            </tr>
          </table>

          <div style="margin-bottom:22px;">
            <div
              style="
                margin-bottom:7px;
                font-size:13px;
                font-weight:800;
                color:#182033;
              "
            >
              Description / Notes
            </div>

            <div
              style="
                padding:14px 16px;
                background:#f8fafc;
                border-radius:7px;
                font-size:13px;
                line-height:1.7;
                color:#475467;
              "
            >
              ${escapeHtml(
                safeDescription
              )}
            </div>
          </div>

          <p
            style="
              margin:0;
              font-size:13px;
              line-height:1.7;
              color:#667085;
            "
          >
            This meeting is no longer active in your Valencia RMS schedule.
          </p>

          <p
            style="
              margin:24px 0 0;
              font-size:14px;
              line-height:1.6;
            "
          >
            Regards,<br/>
            <strong>Valencia RMS</strong>
          </p>
        </div>
      </div>

      <div
        style="
          padding-top:14px;
          text-align:center;
          font-size:11px;
          color:#98a2b3;
        "
      >
        This is an automated notification from Valencia RMS.
      </div>
    </div>
  </div>
  `;

  return sendMail({
    to,
    subject,
    text,
    html,
    replyTo:
      cancelledByEmail ||
      process.env.SMTP_USER,
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

  sendMeetingScheduledEmail,
  sendMeetingUpdatedEmail,
  sendMeetingCancelledEmail,
};
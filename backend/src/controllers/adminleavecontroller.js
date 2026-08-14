const db = require("../config/db");
const { sendMail } = require("../emailservice");

const LEAVE_LIMITS = {
  sick: 7,
  casual: 7,
  mandatory: 18,
};

const getLeaveLabel = (type) => {
  if (type === "sick") return "Sick Leave";
  if (type === "casual") return "Casual Leave";
  if (type === "mandatory") return "Privileged Leave";

  return "Leave";
};

const getLoggedInAdmin = async (userId) => {
  const [rows] = await db.query(
    `
    SELECT
      u.user_id,
      u.full_name,
      u.email,
      u.department_id,
      d.department_name,
      r.role_name
    FROM users u

    LEFT JOIN departments d
      ON d.department_id = u.department_id

    LEFT JOIN roles r
      ON r.role_id = u.role_id

    WHERE u.user_id = ?
    LIMIT 1
    `,
    [userId]
  );

  if (!rows.length) {
    return {
      error: {
        status: 404,
        message: "Admin account not found.",
      },
    };
  }

  const admin = rows[0];

  if (
    String(admin.role_name || "")
      .trim()
      .toLowerCase() !== "admin"
  ) {
    return {
      error: {
        status: 403,
        message:
          "Only Admin can review leave applications.",
      },
    };
  }

  if (!admin.department_id) {
    return {
      error: {
        status: 400,
        message:
          "Admin department is not assigned.",
      },
    };
  }

  return { admin };
};

/*
========================================================
GET ADMIN DEPARTMENT LEAVE APPLICATIONS
========================================================
GET /api/admin-leaves
*/
const getAdminLeaveApplications = async (
  req,
  res
) => {
  try {
    const userId = req.user.user_id;

    const { admin, error } =
      await getLoggedInAdmin(userId);

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    const requestedStatus = String(
      req.query.status || "all"
    )
      .trim()
      .toLowerCase();

    const validStatuses = [
      "pending",
      "approved",
      "rejected",
    ];

    const statusFilter =
      validStatuses.includes(requestedStatus)
        ? requestedStatus
        : null;

    const whereParts = [
      "employee.department_id = ?",
    ];

    const values = [
      admin.department_id,
    ];

    if (statusFilter) {
      whereParts.push(
        "la.status = ?"
      );

      values.push(statusFilter);
    }

    const [applications] =
      await db.query(
        `
        SELECT
          la.leave_id,
          la.employee_id,
          la.leave_type,

          DATE_FORMAT(
            la.start_date,
            '%Y-%m-%d'
          ) AS start_date,

          DATE_FORMAT(
            la.end_date,
            '%Y-%m-%d'
          ) AS end_date,

          la.total_days,

          la.duration_type,
          la.half_day_session,

          la.reason,
          la.status,
          la.review_remark,

          DATE_FORMAT(
            la.applied_at,
            '%Y-%m-%d %H:%i:%s'
          ) AS applied_at,

          DATE_FORMAT(
            la.reviewed_at,
            '%Y-%m-%d %H:%i:%s'
          ) AS reviewed_at,

          employee.full_name
            AS employee_name,

          employee.email
            AS employee_email,

          employee.employee_code,
          employee.designation,
          employee.department_id,

          d.department_name,

          reviewer.full_name
            AS reviewed_by_name,

          reviewer.email
            AS reviewed_by_email

        FROM leave_applications la

        INNER JOIN users employee
          ON employee.user_id =
            la.employee_id

        LEFT JOIN departments d
          ON d.department_id =
            employee.department_id

        LEFT JOIN users reviewer
          ON reviewer.user_id =
            la.reviewed_by

        WHERE ${whereParts.join(
          " AND "
        )}

        ORDER BY
          CASE
            WHEN la.status = 'pending'
            THEN 1

            WHEN la.status = 'approved'
            THEN 2

            WHEN la.status = 'rejected'
            THEN 3

            ELSE 4
          END,

          la.applied_at DESC,
          la.leave_id DESC
        `,
        values
      );

    const [summaryRows] =
      await db.query(
        `
        SELECT
          COUNT(*) AS total,

          SUM(
            CASE
              WHEN la.status = 'pending'
              THEN 1
              ELSE 0
            END
          ) AS pending,

          SUM(
            CASE
              WHEN la.status = 'approved'
              THEN 1
              ELSE 0
            END
          ) AS approved,

          SUM(
            CASE
              WHEN la.status = 'rejected'
              THEN 1
              ELSE 0
            END
          ) AS rejected

        FROM leave_applications la

        INNER JOIN users employee
          ON employee.user_id =
            la.employee_id

        WHERE
          employee.department_id = ?
        `,
        [admin.department_id]
      );

    const summary =
      summaryRows[0] || {};

    return res.json({
      success: true,

      admin,

      summary: {
        total: Number(
          summary.total || 0
        ),

        pending: Number(
          summary.pending || 0
        ),

        approved: Number(
          summary.approved || 0
        ),

        rejected: Number(
          summary.rejected || 0
        ),
      },

      applications:
        applications.map(
          (application) => ({
            ...application,

            total_days: Number(
              application.total_days ||
                0
            ),
          })
        ),
    });
  } catch (error) {
    console.error(
      "Get admin leave applications error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to fetch leave applications.",

      error: error.message,

      sqlMessage:
        error.sqlMessage || null,
    });
  }
};

/*
========================================================
APPROVE / REJECT
========================================================
PATCH /api/admin-leaves/:leaveId/status
*/
const reviewLeaveApplication = async (
  req,
  res
) => {
  const connection =
    await db.getConnection();

  try {
    const adminUserId =
      req.user.user_id;

    const leaveId = Number(
      req.params.leaveId
    );

    let status = String(
      req.body.status ||
        req.body.action ||
        ""
    )
      .trim()
      .toLowerCase();

    const reviewRemark = String(
      req.body.review_remark ||
        req.body.remark ||
        ""
    ).trim();

    if (status === "approve") {
      status = "approved";
    }

    if (status === "reject") {
      status = "rejected";
    }

    if (
      ![
        "approved",
        "rejected",
      ].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Status must be approved or rejected.",
      });
    }

    if (
      status === "rejected" &&
      !reviewRemark
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please enter a reason before rejecting the leave application.",
      });
    }

    const { admin, error } =
      await getLoggedInAdmin(
        adminUserId
      );

    if (error) {
      return res.status(
        error.status
      ).json({
        success: false,
        message: error.message,
      });
    }

    await connection.beginTransaction();

    const [leaveRows] =
      await connection.query(
        `
        SELECT
          la.leave_id,
          la.employee_id,
          la.leave_type,
          la.total_days,
          la.reason,
          la.status,

          la.duration_type,
          la.half_day_session,

          DATE_FORMAT(
            la.start_date,
            '%Y-%m-%d'
          ) AS start_date,

          DATE_FORMAT(
            la.end_date,
            '%Y-%m-%d'
          ) AS end_date,

          employee.full_name
            AS employee_name,

          employee.email
            AS employee_email,

          employee.department_id

        FROM leave_applications la

        INNER JOIN users employee
          ON employee.user_id =
            la.employee_id

        WHERE
          la.leave_id = ?

          AND employee.department_id = ?

        LIMIT 1

        FOR UPDATE
        `,
        [
          leaveId,
          admin.department_id,
        ]
      );

    if (!leaveRows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          "Leave application not found.",
      });
    }

    const leave =
      leaveRows[0];

    if (
      String(
        leave.status || ""
      ).toLowerCase() !==
      "pending"
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,

        message:
          `This leave application is already ${leave.status}.`,
      });
    }

    let remainingBalance = null;

    /*
    ================================================
    VALIDATE BALANCE BEFORE APPROVAL
    ================================================
    */
    if (status === "approved") {
      let limit =
        LEAVE_LIMITS[
          leave.leave_type
        ];

      /*
      Privileged Leave:
      1.5 days earned for every month of
      the current year, max 18.
      */
      if (
        leave.leave_type ===
        "mandatory"
      ) {
        const currentMonth =
          new Date().getMonth() + 1;

        limit = Math.min(
          18,
          currentMonth * 1.5
        );
      }

      if (limit !== undefined) {
        const [usedRows] =
          await connection.query(
            `
            SELECT
              COALESCE(
                SUM(total_days),
                0
              ) AS used_days

            FROM leave_applications

            WHERE
              employee_id = ?

              AND leave_type = ?

              AND status = 'approved'

              AND YEAR(start_date) =
                YEAR(?)

              AND leave_id <> ?
            `,
            [
              leave.employee_id,
              leave.leave_type,
              leave.start_date,
              leaveId,
            ]
          );

        const alreadyUsed =
          Number(
            usedRows[0]
              ?.used_days || 0
          );

        const requestedDays =
          Number(
            leave.total_days || 0
          );

        if (
          alreadyUsed +
            requestedDays >
          limit
        ) {
          await connection.rollback();

          return res
            .status(400)
            .json({
              success: false,

              message:
                `Cannot approve. Employee only has ${Math.max(
                  0,
                  limit -
                    alreadyUsed
                )} ${getLeaveLabel(
                  leave.leave_type
                )} day(s) remaining.`,
            });
        }

        remainingBalance =
          limit -
          alreadyUsed -
          requestedDays;
      }
    }

    /*
    ================================================
    SAVE REVIEW
    ================================================
    */
    await connection.query(
      `
      UPDATE leave_applications

      SET
        status = ?,
        review_remark = ?,
        reviewed_by = ?,
        reviewed_at = NOW()

      WHERE leave_id = ?
      `,
      [
        status,
        reviewRemark || null,
        admin.user_id,
        leaveId,
      ]
    );

    await connection.commit();

    /*
    ================================================
    EMAIL EMPLOYEE
    ================================================
    */
    let emailResult = {
      sent: false,
      skipped: true,
    };

    if (leave.employee_email) {
      try {
        const leaveLabel =
          getLeaveLabel(
            leave.leave_type
          );

        const approved =
          status === "approved";

        const subject =
          approved
            ? `${leaveLabel} Application Approved`
            : `${leaveLabel} Application Rejected`;

        const balanceLine =
          approved &&
          remainingBalance !== null
            ? `Remaining ${leaveLabel} Balance: ${remainingBalance} day(s)`
            : "";

        const remarkLine =
          reviewRemark
            ? `Admin Remark: ${reviewRemark}`
            : "";

        const text = `
Hello ${leave.employee_name || "Employee"},

Your ${leaveLabel} application has been ${status}.

From: ${leave.start_date}
To: ${leave.end_date}
Days: ${leave.total_days}
Reason: ${leave.reason || "-"}

Reviewed By: ${admin.full_name || "Admin"}
${remarkLine}
${balanceLine}

Please login to Valencia RMS to view the updated leave status.

Regards,
Valencia RMS
`;

        const html = `
          <div style="
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #111827;
          ">
            <h2 style="
              color: ${
                approved
                  ? "#15803d"
                  : "#dc2626"
              };
            ">
              Leave Application ${
                approved
                  ? "Approved"
                  : "Rejected"
              }
            </h2>

            <p>
              Hello
              <strong>
                ${leave.employee_name || "Employee"}
              </strong>,
            </p>

            <p>
              Your
              <strong>
                ${leaveLabel}
              </strong>
              application has been
              <strong>
                ${status}
              </strong>.
            </p>

            <p>
              <strong>From:</strong>
              ${leave.start_date}
              <br />

              <strong>To:</strong>
              ${leave.end_date}
              <br />

              <strong>Days:</strong>
              ${leave.total_days}
              <br />

              <strong>Reason:</strong>
              ${leave.reason || "-"}
            </p>

            ${
              reviewRemark
                ? `
                  <p>
                    <strong>
                      Admin Remark:
                    </strong>
                    ${reviewRemark}
                  </p>
                `
                : ""
            }

            ${
              balanceLine
                ? `
                  <p>
                    <strong>
                      ${balanceLine}
                    </strong>
                  </p>
                `
                : ""
            }

            <p>
              Reviewed by
              <strong>
                ${admin.full_name || "Admin"}
              </strong>
            </p>

            <p>
              Login to Valencia RMS to view the updated leave status.
            </p>

            <p>
              Regards,<br />
              Valencia RMS
            </p>
          </div>
        `;

        const result =
          await sendMail({
            to:
              leave.employee_email,

            subject,

            text,

            html,

            replyTo:
              admin.email ||
              undefined,
          });

        emailResult = {
          sent:
            !result?.skipped,

          skipped:
            Boolean(
              result?.skipped
            ),
        };
      } catch (emailError) {
        console.error(
          "Leave review email failed:",
          emailError
        );

        emailResult = {
          sent: false,
          skipped: false,
          error:
            emailError.message,
        };
      }
    }

    return res.json({
      success: true,

      message:
        status === "approved"
          ? "Leave approved successfully."
          : "Leave rejected successfully.",

      status,

      leave_id:
        leaveId,

      remaining_balance:
        remainingBalance,

      review_remark:
        reviewRemark,

      email:
        emailResult,
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    console.error(
      "Review leave application error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to review leave application.",

      error:
        error.message,

      sqlMessage:
        error.sqlMessage || null,
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getAdminLeaveApplications,
  reviewLeaveApplication,
};
const db = require("../config/db");
const { sendMail } = require("../utils/emailservice");
const {
  buildLeaveBalances,
} = require("../utils/leavepolicy");

const getLeaveLabel = (type) => {
  if (type === "sick") {
    return "Sick Leave";
  }

  if (type === "casual") {
    return "Casual Leave";
  }

  if (type === "mandatory") {
    return "Privileged Leave";
  }

  if (type === "festival") {
    return "Holiday Leave";
  }

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

  return {
    admin,
  };
};

/*
========================================================
GET ADMIN DEPARTMENT LEAVE APPLICATIONS
========================================================

GET /api/admin-leaves
GET /api/admin-leaves/applications
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
      return res
        .status(error.status)
        .json({
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
      validStatuses.includes(
        requestedStatus
      )
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
        [
          admin.department_id,
        ]
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

    return res
      .status(500)
      .json({
        success: false,

        message:
          "Failed to fetch leave applications.",

        error:
          error.message,

        sqlMessage:
          error.sqlMessage || null,
      });
  }
};

/*
========================================================
APPROVE / REJECT LEAVE
========================================================

PATCH /api/admin-leaves/:leaveId/status
*/
const reviewLeaveApplication = async (
  req,
  res
) => {
  let connection;

  try {
    connection =
      await db.getConnection();

    const adminUserId =
      req.user.user_id;

    const leaveId =
      Number(
        req.params.leaveId
      );

    if (
      !Number.isFinite(
        leaveId
      ) ||
      leaveId <= 0
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Invalid leave application ID.",
        });
    }

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

    if (
      status === "approve"
    ) {
      status = "approved";
    }

    if (
      status === "reject"
    ) {
      status = "rejected";
    }

    if (
      ![
        "approved",
        "rejected",
      ].includes(status)
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "Status must be approved or rejected.",
        });
    }

    if (
      status ===
        "rejected" &&
      !reviewRemark
    ) {
      return res
        .status(400)
        .json({
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
      return res
        .status(
          error.status
        )
        .json({
          success: false,
          message:
            error.message,
        });
    }

    await connection
      .beginTransaction();

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

          AND
          employee.department_id = ?

        LIMIT 1

        FOR UPDATE
        `,
        [
          leaveId,
          admin.department_id,
        ]
      );

    if (
      !leaveRows.length
    ) {
      await connection
        .rollback();

      return res
        .status(404)
        .json({
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
      )
        .trim()
        .toLowerCase() !==
      "pending"
    ) {
      await connection
        .rollback();

      return res
        .status(400)
        .json({
          success: false,

          message:
            `This leave application is already ${leave.status}.`,
        });
    }

    let remainingBalance =
      null;

    /*
    ====================================================
    VALIDATE BALANCE BEFORE APPROVAL
    ====================================================
    */
    if (
  status ===
  "approved"
) {
  const leaveYear =
    Number(
      String(
        leave.start_date
      ).slice(
        0,
        4
      )
    );

  /*
  Exclude the current pending application
  when calculating balance.

  Other pending applications remain reserved.
  */
  const balances =
    await buildLeaveBalances(
      connection,
      leave.employee_id,
      leaveYear,
      {
        excludeLeaveId:
          leaveId,
      }
    );

  const selectedBalance =
    balances[
      leave.leave_type
    ];

  if (!selectedBalance) {
    await connection.rollback();

    return res.status(400).json({
      success: false,
      message:
        "Unable to calculate employee Leave balance.",
    });
  }

  const available =
    Number(
      selectedBalance.available ||
        0
    );

  const requestedDays =
    Number(
      leave.total_days ||
        0
    );

  if (
    requestedDays >
    available
  ) {
    await connection.rollback();

    return res.status(400).json({
      success: false,

      message:
        `Cannot approve. Employee only has ${available} ${getLeaveLabel(
          leave.leave_type
        )} day(s) available.`,
    });
  }

  remainingBalance =
    available -
    requestedDays;
}

    /*
    ====================================================
    UPDATE LEAVE APPLICATION
    ====================================================
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
        reviewRemark ||
          null,
        admin.user_id,
        leaveId,
      ]
    );

    await connection
      .commit();

    /*
    ====================================================
    EMAIL TEMPORARILY DISABLED
    ====================================================

    The previous version required:
    ../emailservice

    That file is currently missing,
    so email sending is disabled
    to prevent the entire backend
    from crashing.
    */
    const emailResult = {
      sent: false,
      skipped: true,
      message:
        "Email service is temporarily disabled.",
    };

    return res.json({
      success: true,

      message:
        status ===
        "approved"
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
    if (connection) {
      try {
        await connection
          .rollback();
      } catch {
        // Ignore rollback error.
      }
    }

    console.error(
      "Review leave application error:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,

        message:
          "Failed to review leave application.",

        error:
          error.message,

        sqlMessage:
          error.sqlMessage ||
          null,
      });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  getAdminLeaveApplications,
  reviewLeaveApplication,
};
const db = require("../config/db");

const {
  sendMail,
} = require("../utils/emailservice");

const LEAVE_LIMITS = {
  sick: 7,
  casual: 7,
  mandatory: 18,
};

const MONTHLY_PRIVILEGED_CREDIT = 1.5;

/*
========================================================
HELPERS
========================================================
*/

const normalizeLeaveType = (value) => {
  const type = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (
    type === "sick" ||
    type === "sick_leave"
  ) {
    return "sick";
  }

  if (
    type === "casual" ||
    type === "casual_leave"
  ) {
    return "casual";
  }

  if (
    type === "mandatory" ||
    type === "mandatory_leave" ||
    type === "privileged" ||
    type === "privileged_leave"
  ) {
    return "mandatory";
  }

  return "";
};

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

  return "Leave";
};

const formatNumber = (value) => {
  const number = Number(value || 0);

  return Number.isInteger(number)
    ? number
    : Number(number.toFixed(1));
};

const calculateInclusiveDays = (
  startDate,
  endDate
) => {
  const startParts = String(startDate)
    .split("-")
    .map(Number);

  const endParts = String(endDate)
    .split("-")
    .map(Number);

  if (
    startParts.length !== 3 ||
    endParts.length !== 3
  ) {
    return 0;
  }

  const start = Date.UTC(
    startParts[0],
    startParts[1] - 1,
    startParts[2]
  );

  const end = Date.UTC(
    endParts[0],
    endParts[1] - 1,
    endParts[2]
  );

  if (
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    end < start
  ) {
    return 0;
  }

  return (
    Math.floor(
      (end - start) /
        (24 * 60 * 60 * 1000)
    ) + 1
  );
};

/*
========================================================
GET ACTUAL COLUMNS FROM leave_applications
========================================================
*/

const getLeaveColumns = async () => {
  const [rows] = await db.query(
    "SHOW COLUMNS FROM leave_applications"
  );

  return new Set(
    rows.map((row) =>
      String(row.Field)
    )
  );
};

/*
========================================================
PRIVILEGED LEAVE EARNED
========================================================
*/

const getPrivilegedEarned = (year) => {
  const now = new Date();

  const currentYear =
    now.getFullYear();

  const currentMonth =
    now.getMonth() + 1;

  if (year < currentYear) {
    return 18;
  }

  if (year > currentYear) {
    return 0;
  }

  return Math.min(
    18,
    currentMonth *
      MONTHLY_PRIVILEGED_CREDIT
  );
};

/*
========================================================
GET USED + PENDING BALANCE
========================================================
*/

const getLeaveUsage = async (
  employeeId,
  year
) => {
  const [rows] = await db.query(
    `
    SELECT
      leave_type,

      COALESCE(
        SUM(
          CASE
            WHEN status = 'approved'
            THEN total_days
            ELSE 0
          END
        ),
        0
      ) AS used_days,

      COALESCE(
        SUM(
          CASE
            WHEN status = 'pending'
            THEN total_days
            ELSE 0
          END
        ),
        0
      ) AS pending_days

    FROM leave_applications

    WHERE employee_id = ?
      AND YEAR(start_date) = ?

    GROUP BY leave_type
    `,
    [
      employeeId,
      year,
    ]
  );

  const usage = {
    sick: {
      used: 0,
      pending: 0,
    },

    casual: {
      used: 0,
      pending: 0,
    },

    mandatory: {
      used: 0,
      pending: 0,
    },
  };

  rows.forEach((row) => {
    const type =
      normalizeLeaveType(
        row.leave_type
      );

    if (!type) {
      return;
    }

    usage[type] = {
      used: Number(
        row.used_days || 0
      ),

      pending: Number(
        row.pending_days || 0
      ),
    };
  });

  return usage;
};

/*
========================================================
BUILD BALANCES
========================================================
*/

const buildLeaveBalances = async (
  employeeId,
  year
) => {
  const usage =
    await getLeaveUsage(
      employeeId,
      year
    );

  const sickUsed =
    Number(
      usage.sick.used || 0
    );

  const sickPending =
    Number(
      usage.sick.pending || 0
    );

  const sickAvailable =
    Math.max(
      0,
      LEAVE_LIMITS.sick -
        sickUsed -
        sickPending
    );

  const casualUsed =
    Number(
      usage.casual.used || 0
    );

  const casualPending =
    Number(
      usage.casual.pending || 0
    );

  const casualAvailable =
    Math.max(
      0,
      LEAVE_LIMITS.casual -
        casualUsed -
        casualPending
    );

  const privilegedEarned =
    getPrivilegedEarned(year);

  const privilegedUsed =
    Number(
      usage.mandatory.used || 0
    );

  const privilegedPending =
    Number(
      usage.mandatory.pending || 0
    );

  const privilegedAvailable =
    Math.max(
      0,
      privilegedEarned -
        privilegedUsed -
        privilegedPending
    );

  return {
    sick: {
      label: "Sick Leave",
      total: 7,
      earned: 7,

      used:
        formatNumber(
          sickUsed
        ),

      pending:
        formatNumber(
          sickPending
        ),

      available:
        formatNumber(
          sickAvailable
        ),

      remaining:
        formatNumber(
          sickAvailable
        ),
    },

    casual: {
      label: "Casual Leave",
      total: 7,
      earned: 7,

      used:
        formatNumber(
          casualUsed
        ),

      pending:
        formatNumber(
          casualPending
        ),

      available:
        formatNumber(
          casualAvailable
        ),

      remaining:
        formatNumber(
          casualAvailable
        ),
    },

    mandatory: {
      label:
        "Privileged Leave",

      monthly_credit: 1.5,

      annual_entitlement: 18,

      earned:
        formatNumber(
          privilegedEarned
        ),

      used:
        formatNumber(
          privilegedUsed
        ),

      pending:
        formatNumber(
          privilegedPending
        ),

      available:
        formatNumber(
          privilegedAvailable
        ),

      remaining:
        formatNumber(
          privilegedAvailable
        ),
    },
  };
};

/*
========================================================
GET EMPLOYEE LEAVE SUMMARY
========================================================
GET /api/employee-leaves/summary
========================================================
*/

const getEmployeeLeaveSummary = async (
  req,
  res
) => {
  try {
    const employeeId =
      req.user.user_id;

    const currentYear =
      new Date().getFullYear();

    const requestedYear =
      Number(req.query.year);

    const year =
      Number.isFinite(
        requestedYear
      ) &&
      requestedYear >= 2000
        ? requestedYear
        : currentYear;

    const balances =
      await buildLeaveBalances(
        employeeId,
        year
      );

    const columns =
      await getLeaveColumns();

    const durationSelect =
      columns.has(
        "duration_type"
      )
        ? "la.duration_type"
        : `
          CASE
            WHEN la.total_days = 0.5
            THEN 'half_day'
            ELSE 'full_day'
          END AS duration_type
        `;

    const halfDaySelect =
      columns.has(
        "half_day_session"
      )
        ? "la.half_day_session"
        : "NULL AS half_day_session";

    const reviewRemarkSelect =
      columns.has(
        "review_remark"
      )
        ? "la.review_remark"
        : "NULL AS review_remark";

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

          ${durationSelect},

          ${halfDaySelect},

          la.reason,
          la.status,

          ${reviewRemarkSelect},

          la.reviewed_by,

          DATE_FORMAT(
            la.reviewed_at,
            '%Y-%m-%d %H:%i:%s'
          ) AS reviewed_at,

          DATE_FORMAT(
            la.applied_at,
            '%Y-%m-%d %H:%i:%s'
          ) AS applied_at,

          reviewer.full_name
            AS reviewed_by_name,

          reviewer.email
            AS reviewed_by_email

        FROM leave_applications la

        LEFT JOIN users reviewer
          ON reviewer.user_id =
            la.reviewed_by

        WHERE
          la.employee_id = ?

          AND YEAR(
            la.start_date
          ) = ?

        ORDER BY
          la.applied_at DESC,
          la.leave_id DESC
        `,
        [
          employeeId,
          year,
        ]
      );

    return res.json({
      success: true,

      year,

      configuration: {
        sick_annual_entitlement:
          7,

        casual_annual_entitlement:
          7,

        privileged_monthly_credit:
          1.5,

        privileged_annual_entitlement:
          18,
      },

      balances,

      applications:
        applications.map(
          (application) => ({
            ...application,

            total_days:
              formatNumber(
                application.total_days
              ),
          })
        ),
    });
  } catch (error) {
    console.error(
      "Get employee leave summary error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to fetch leave information.",

      error:
        error.message,

      sqlMessage:
        error.sqlMessage ||
        null,
    });
  }
};

/*
========================================================
APPLY FOR LEAVE
========================================================
POST /api/employee-leaves/apply
========================================================
*/

const applyEmployeeLeave = async (
  req,
  res
) => {
  try {
    const employeeId =
      req.user.user_id;

    const leaveType =
      normalizeLeaveType(
        req.body.leave_type
      );

    const durationType =
      String(
        req.body.duration_type ||
          "full_day"
      )
        .trim()
        .toLowerCase();

    const halfDaySession =
      String(
        req.body.half_day_session ||
          ""
      )
        .trim()
        .toLowerCase();

    const startDate =
      String(
        req.body.start_date ||
          ""
      ).trim();

    let endDate =
      String(
        req.body.end_date ||
          ""
      ).trim();

    const reason =
      String(
        req.body.reason || ""
      ).trim();

    /*
    ----------------------------------------------------
    BASIC VALIDATION
    ----------------------------------------------------
    */

    if (!leaveType) {
      return res.status(
        400
      ).json({
        success: false,

        message:
          "Please select a valid leave type.",
      });
    }

    if (
      ![
        "full_day",
        "half_day",
      ].includes(
        durationType
      )
    ) {
      return res.status(
        400
      ).json({
        success: false,

        message:
          "Please select Full Day or Half Day.",
      });
    }

    if (!startDate) {
      return res.status(
        400
      ).json({
        success: false,

        message:
          "Please select the leave date.",
      });
    }

    const datePattern =
      /^\d{4}-\d{2}-\d{2}$/;

    if (
      !datePattern.test(
        startDate
      )
    ) {
      return res.status(
        400
      ).json({
        success: false,

        message:
          "Invalid leave date.",
      });
    }

    if (
      durationType ===
      "half_day"
    ) {
      endDate =
        startDate;

      if (
        ![
          "first_half",
          "second_half",
        ].includes(
          halfDaySession
        )
      ) {
        return res.status(
          400
        ).json({
          success: false,

          message:
            "Please select First Half or Second Half.",
        });
      }
    } else {
      if (
        !endDate ||
        !datePattern.test(
          endDate
        )
      ) {
        return res.status(
          400
        ).json({
          success: false,

          message:
            "Please select the end date.",
        });
      }

      if (
        endDate <
        startDate
      ) {
        return res.status(
          400
        ).json({
          success: false,

          message:
            "Leave end date cannot be before start date.",
        });
      }
    }

    if (!reason) {
      return res.status(
        400
      ).json({
        success: false,

        message:
          "Please enter the reason for leave.",
      });
    }

    /*
    ----------------------------------------------------
    CALCULATE LEAVE DAYS
    ----------------------------------------------------
    */

    const totalDays =
      durationType ===
      "half_day"
        ? 0.5
        : calculateInclusiveDays(
            startDate,
            endDate
          );

    if (
      totalDays <= 0
    ) {
      return res.status(
        400
      ).json({
        success: false,

        message:
          "Unable to calculate leave days.",
      });
    }

    const leaveYear =
      Number(
        startDate.slice(
          0,
          4
        )
      );

    /*
    ----------------------------------------------------
    BALANCE VALIDATION
    ----------------------------------------------------
    */

    const balances =
      await buildLeaveBalances(
        employeeId,
        leaveYear
      );

    const selectedBalance =
      balances[leaveType];

    if (
      totalDays >
      Number(
        selectedBalance
          .available || 0
      )
    ) {
      return res.status(
        400
      ).json({
        success: false,

        message:
          `You only have ${selectedBalance.available} ${getLeaveLabel(
            leaveType
          )} day(s) available.`,
      });
    }

    /*
    ----------------------------------------------------
    PREVENT OVERLAPPING LEAVE
    ----------------------------------------------------
    */

    const [overlappingRows] =
      await db.query(
        `
        SELECT
          leave_id

        FROM leave_applications

        WHERE
          employee_id = ?

          AND status IN (
            'pending',
            'approved'
          )

          AND NOT (
            end_date < ?
            OR start_date > ?
          )

        LIMIT 1
        `,
        [
          employeeId,
          startDate,
          endDate,
        ]
      );

    if (
      overlappingRows.length >
      0
    ) {
      return res.status(
        400
      ).json({
        success: false,

        message:
          "You already have a pending or approved leave application for these dates.",
      });
    }

    /*
    ----------------------------------------------------
    CHECK EXISTING DATABASE COLUMNS
    ----------------------------------------------------
    */

    const columns =
      await getLeaveColumns();

    const insertColumns = [
      "employee_id",
      "leave_type",
      "start_date",
      "end_date",
      "total_days",
      "reason",
      "status",
    ];

    const insertValues = [
      employeeId,
      leaveType,
      startDate,
      endDate,
      totalDays,
      reason,
      "pending",
    ];

    if (
      columns.has(
        "duration_type"
      )
    ) {
      insertColumns.push(
        "duration_type"
      );

      insertValues.push(
        durationType
      );
    }

    if (
      columns.has(
        "half_day_session"
      )
    ) {
      insertColumns.push(
        "half_day_session"
      );

      insertValues.push(
        durationType ===
          "half_day"
          ? halfDaySession
          : null
      );
    }

    const placeholders =
      insertColumns
        .map(() => "?")
        .join(", ");

    /*
    ----------------------------------------------------
    SAVE APPLICATION FIRST
    ----------------------------------------------------
    */

    const [result] =
      await db.query(
        `
        INSERT INTO leave_applications (
          ${insertColumns.join(
            ", "
          )}
        )

        VALUES (
          ${placeholders}
        )
        `,
        insertValues
      );

    /*
    ----------------------------------------------------
    GET EMPLOYEE
    ----------------------------------------------------
    */

    const [employeeRows] =
      await db.query(
        `
        SELECT
          u.user_id,
          u.full_name,
          u.email,
          u.department_id,

          d.department_name

        FROM users u

        LEFT JOIN departments d
          ON d.department_id =
            u.department_id

        WHERE
          u.user_id = ?

        LIMIT 1
        `,
        [employeeId]
      );

    const employee =
      employeeRows[0] ||
      {};

    /*
    ----------------------------------------------------
    FIND DEPARTMENT ADMIN
    ----------------------------------------------------
    */

    let admin = {};

    try {
      const [adminRows] =
        await db.query(
          `
          SELECT
            a.user_id,
            a.full_name,
            a.email

          FROM users a

          INNER JOIN roles r
            ON r.role_id =
              a.role_id

          WHERE
            a.department_id = ?

            AND LOWER(
              COALESCE(
                r.role_name,
                ''
              )
            ) = 'admin'

            AND a.status = 'active'

            AND a.email IS NOT NULL

            AND a.email != ''

          ORDER BY
            a.user_id ASC

          LIMIT 1
          `,
          [
            employee.department_id,
          ]
        );

      admin =
        adminRows[0] ||
        {};
    } catch (adminError) {
      console.error(
        "Admin email lookup skipped:",
        adminError.message
      );

      admin = {};
    }

    /*
    ========================================================
    AUTOMATIC LEAVE APPLICATION EMAIL
    ========================================================
    */

    let emailResult = {
      sent: false,
      skipped: true,
    };

    if (admin.email) {
      try {
        const leaveLabel =
          getLeaveLabel(
            leaveType
          );

        const durationLabel =
          durationType ===
          "half_day"
            ? halfDaySession ===
              "first_half"
              ? "Half Day - First Half"
              : "Half Day - Second Half"
            : totalDays === 1
            ? "Full Day"
            : `${totalDays} Full Days`;

        const subject =
          `${leaveLabel} Application - ${
            employee.full_name ||
            "Employee"
          }`;

        const text = `
Dear ${admin.full_name || "Sir/Ma'am"},

A leave application has been submitted through Valencia RMS.

Employee Name: ${employee.full_name || "-"}
Employee Email: ${employee.email || "-"}
Department: ${employee.department_name || "-"}

Leave Type: ${leaveLabel}
From Date: ${startDate}
To Date: ${endDate}
Duration: ${durationLabel}
Leave Days: ${totalDays}

Reason:
${reason}

The leave application is currently Pending and requires your review.

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
              color: #ff5733;
            ">
              Leave Application
            </h2>

            <p>
              Dear
              <strong>
                ${admin.full_name || "Sir/Ma'am"}
              </strong>,
            </p>

            <p>
              A leave application has been submitted
              through Valencia RMS.
            </p>

            <table style="
              border-collapse: collapse;
              width: 100%;
              max-width: 650px;
            ">
              <tr>
                <td style="
                  padding: 8px;
                  border: 1px solid #dddddd;
                ">
                  <strong>Employee</strong>
                </td>

                <td style="
                  padding: 8px;
                  border: 1px solid #dddddd;
                ">
                  ${employee.full_name || "-"}
                </td>
              </tr>

              <tr>
                <td style="
                  padding: 8px;
                  border: 1px solid #dddddd;
                ">
                  <strong>Employee Email</strong>
                </td>

                <td style="
                  padding: 8px;
                  border: 1px solid #dddddd;
                ">
                  ${employee.email || "-"}
                </td>
              </tr>

              <tr>
                <td style="
                  padding: 8px;
                  border: 1px solid #dddddd;
                ">
                  <strong>Department</strong>
                </td>

                <td style="
                  padding: 8px;
                  border: 1px solid #dddddd;
                ">
                  ${employee.department_name || "-"}
                </td>
              </tr>

              <tr>
                <td style="
                  padding: 8px;
                  border: 1px solid #dddddd;
                ">
                  <strong>Leave Type</strong>
                </td>

                <td style="
                  padding: 8px;
                  border: 1px solid #dddddd;
                ">
                  ${leaveLabel}
                </td>
              </tr>

              <tr>
                <td style="
                  padding: 8px;
                  border: 1px solid #dddddd;
                ">
                  <strong>From</strong>
                </td>

                <td style="
                  padding: 8px;
                  border: 1px solid #dddddd;
                ">
                  ${startDate}
                </td>
              </tr>

              <tr>
                <td style="
                  padding: 8px;
                  border: 1px solid #dddddd;
                ">
                  <strong>To</strong>
                </td>

                <td style="
                  padding: 8px;
                  border: 1px solid #dddddd;
                ">
                  ${endDate}
                </td>
              </tr>

              <tr>
                <td style="
                  padding: 8px;
                  border: 1px solid #dddddd;
                ">
                  <strong>Duration</strong>
                </td>

                <td style="
                  padding: 8px;
                  border: 1px solid #dddddd;
                ">
                  ${durationLabel}
                </td>
              </tr>

              <tr>
                <td style="
                  padding: 8px;
                  border: 1px solid #dddddd;
                ">
                  <strong>Leave Days</strong>
                </td>

                <td style="
                  padding: 8px;
                  border: 1px solid #dddddd;
                ">
                  ${totalDays}
                </td>
              </tr>

              <tr>
                <td style="
                  padding: 8px;
                  border: 1px solid #dddddd;
                ">
                  <strong>Reason</strong>
                </td>

                <td style="
                  padding: 8px;
                  border: 1px solid #dddddd;
                ">
                  ${reason}
                </td>
              </tr>
            </table>

            <p>
              This application is currently
              <strong>Pending</strong>
              and requires your review.
            </p>

            <p>
              Regards,<br />
              Valencia RMS
            </p>
          </div>
        `;

        const mailResponse =
          await sendMail({
            to:
              admin.email,

            cc: [
              "manish.turakhia@valencianutrition.com",
              "rathika.haleangadi@valencianutrition.com",
            ],

            subject,

            text,

            html,

            replyTo:
              employee.email ||
              undefined,
          });

        emailResult = {
          sent:
            !mailResponse
              ?.skipped,

          skipped:
            Boolean(
              mailResponse
                ?.skipped
            ),

          messageId:
            mailResponse
              ?.messageId ||
            null,
        };
      } catch (emailError) {
        console.error(
          "Leave application email failed:",
          emailError
        );

        /*
        Important:
        email failure must NOT undo leave submission.
        */
        emailResult = {
          sent: false,
          skipped: false,
          error:
            emailError.message,
        };
      }
    } else {
      console.warn(
        "Leave email skipped: department admin email not found."
      );

      emailResult = {
        sent: false,
        skipped: true,
        error:
          "Department admin email not found.",
      };
    }

    /*
    ========================================================
    RESPONSE
    ========================================================
    */

    return res.status(
      201
    ).json({
      success: true,

      message:
        "Leave application submitted successfully.",

      application: {
        leave_id:
          result.insertId,

        employee_id:
          employeeId,

        employee_name:
          employee.full_name ||
          "",

        employee_email:
          employee.email ||
          "",

        department_id:
          employee.department_id ||
          null,

        department_name:
          employee.department_name ||
          "",

        admin_id:
          admin.user_id ||
          null,

        admin_name:
          admin.full_name ||
          "",

        admin_email:
          admin.email ||
          "",

        leave_type:
          leaveType,

        leave_label:
          getLeaveLabel(
            leaveType
          ),

        start_date:
          startDate,

        end_date:
          endDate,

        duration_type:
          durationType,

        half_day_session:
          durationType ===
          "half_day"
            ? halfDaySession
            : null,

        total_days:
          totalDays,

        reason,

        status:
          "pending",
      },

      email:
        emailResult,
    });
  } catch (error) {
    console.error(
      "Apply employee leave error:",
      error
    );

    return res.status(
      500
    ).json({
      success: false,

      message:
        "Failed to submit leave application.",

      error:
        error.message,

      sqlMessage:
        error.sqlMessage ||
        null,
    });
  }
};

module.exports = {
  getEmployeeLeaveSummary,
  applyEmployeeLeave,
};
const db = require("../config/db");
const { sendMail } = require("../utils/emailservice");

const {
  POLICY_START_DATE,
  MONTHLY_PRIVILEGED_CREDIT,
  getAnnualEntitlements,
  buildLeaveBalances,
} = require("../utils/leavepolicy");


const LEAVE_APPLICATION_RECIPIENTS = [
  "premal.mehta@valencianutrition.com",
  "rathika.haleangadi@valencianutrition.com",
];

/*
========================================================
2026 HOLIDAY CALENDAR
========================================================
*/

const HOLIDAYS_2026 = [
  {
    date: "2026-01-26",
    name: "Republic Day",
    type: "fixed",
  },
  {
    date: "2026-02-15",
    name: "Mahashivratri",
    type: "optional",
  },
  {
    date: "2026-02-19",
    name: "Chhatrapati Shivaji Maharaj Jayanti",
    type: "optional",
  },
  {
    date: "2026-03-03",
    name: "Holi",
    type: "optional",
  },
  {
    date: "2026-03-19",
    name: "Gudhi Padwa",
    type: "optional",
  },
  {
    date: "2026-03-21",
    name: "Ramzan Eid",
    type: "optional",
  },
  {
    date: "2026-03-26",
    name: "Ram Navami",
    type: "optional",
  },
  {
    date: "2026-03-31",
    name: "Mahavir Jayanti",
    type: "optional",
  },
  {
    date: "2026-04-03",
    name: "Good Friday",
    type: "optional",
  },
  {
    date: "2026-04-14",
    name: "Dr. Babasaheb Ambedkar Jayanti",
    type: "optional",
  },
  {
    date: "2026-05-01",
    name: "Maharashtra Day / Buddha Pournima",
    type: "fixed",
  },
  {
    date: "2026-05-28",
    name: "Bakri Eid",
    type: "optional",
  },
  {
    date: "2026-06-26",
    name: "Moharram",
    type: "optional",
  },
  {
    date: "2026-08-15",
    name: "Independence Day / Parsi New Year",
    type: "fixed",
  },
  {
    date: "2026-08-26",
    name: "Eid-e-Milad",
    type: "optional",
  },
  {
    date: "2026-09-14",
    name: "Ganesh Chaturthi",
    type: "optional",
  },
  {
    date: "2026-10-02",
    name: "Gandhi Jayanti",
    type: "fixed",
  },
  {
    date: "2026-10-20",
    name: "Dasara",
    type: "optional",
  },
  {
    date: "2026-11-08",
    name: "Diwali - Laxmi Pujan",
    type: "optional",
  },
  {
    date: "2026-11-10",
    name: "Diwali - Bali Pratipada",
    type: "optional",
  },
  {
    date: "2026-11-24",
    name: "Guru Nanak Jayanti",
    type: "optional",
  },
  {
    date: "2026-12-25",
    name: "Christmas",
    type: "optional",
  },
];

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

  if (
    type === "festival" ||
    type === "festival_leave" ||
    type === "holiday" ||
    type === "holiday_leave"
  ) {
    return "festival";
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

  if (type === "festival") {
    return "Holiday Leave";
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

const getIndiaToday = () => {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const values = {};

  parts.forEach((part) => {
    values[part.type] =
      part.value;
  });

  return `${values.year}-${values.month}-${values.day}`;
};

/*
========================================================
GET ACTUAL DATABASE COLUMNS
========================================================
*/

const getLeaveColumns = async () => {
  const [rows] =
    await db.query(
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
GET EMPLOYEE LEAVE SUMMARY
GET /api/employee-leaves/summary
========================================================
*/

const getEmployeeLeaveSummary =
  async (req, res) => {
    try {
      const employeeId =
        req.user.user_id;

      const currentYear =
        new Date().getFullYear();

      const requestedYear =
        Number(
          req.query.year
        );

      const year =
        Number.isFinite(
          requestedYear
        ) &&
        requestedYear >= 2000
          ? requestedYear
          : currentYear;

      const balances =
  await buildLeaveBalances(
    db,
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
  policy_start_date:
    POLICY_START_DATE,

  sick_entitlement:
    getAnnualEntitlements(
      year
    ).sick,

  casual_entitlement:
    getAnnualEntitlements(
      year
    ).casual,

  privileged_monthly_credit:
    MONTHLY_PRIVILEGED_CREDIT,

  privileged_carry_forward:
    true,

  holiday_entitlement:
    getAnnualEntitlements(
      year
    ).festival,
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

      return res.status(
        500
      ).json({
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
POST /api/employee-leaves/apply
========================================================
*/

const applyEmployeeLeave =
  async (req, res) => {
    try {
      const employeeId =
        req.user.user_id;

      const leaveType =
        normalizeLeaveType(
          req.body.leave_type
        );

      const durationType =
        String(
          req.body
            .duration_type ||
            "full_day"
        )
          .trim()
          .toLowerCase();

      const halfDaySession =
        String(
          req.body
            .half_day_session ||
            ""
        )
          .trim()
          .toLowerCase();

      const startDate =
        String(
          req.body
            .start_date || ""
        ).trim();

      let endDate =
        String(
          req.body
            .end_date || ""
        ).trim();

      const reason =
        String(
          req.body.reason || ""
        ).trim();

      /*
      ------------------------------
      BASIC VALIDATION
      ------------------------------
      */

      if (!leaveType) {
        return res
          .status(400)
          .json({
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
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Please select Full Day or Half Day.",
          });
      }

      if (!startDate) {
        return res
          .status(400)
          .json({
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
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid leave date.",
          });
      }
      if (
  startDate <
  POLICY_START_DATE
) {
  return res
    .status(400)
    .json({
      success: false,

      message:
        "The new Leave policy starts from 01-09-2026.",
    });
}

      /*
      ------------------------------
      HOLIDAY LEAVE
      ------------------------------
      */

      let selectedHoliday =
        null;

      if (
        leaveType ===
        "festival"
      ) {
        selectedHoliday =
          HOLIDAYS_2026.find(
            (holiday) =>
              holiday.date ===
                startDate &&
              holiday.type ===
                "optional"
          );

        if (!selectedHoliday) {
          return res
            .status(400)
            .json({
              success: false,

              message:
                "Please select a valid festival holiday.",
            });
        }

        const today =
          getIndiaToday();

        if (
          startDate <
          today
        ) {
          return res
            .status(400)
            .json({
              success: false,

              message:
                "Past festival holidays cannot be applied for.",
            });
        }

        const holidayDay =
          new Date(
            `${startDate}T00:00:00`
          ).getDay();

        if (
          holidayDay === 0
        ) {
          return res
            .status(400)
            .json({
              success: false,

              message:
                "This festival falls on Sunday, which is already a weekly off.",
            });
        }

        /*
        Holiday Leave is always
        exactly one full day.
        */

        endDate =
          startDate;
      } else if (
        durationType ===
        "half_day"
      ) {
        /*
        ------------------------------
        NORMAL HALF DAY LEAVE
        ------------------------------
        */

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
          return res
            .status(400)
            .json({
              success: false,

              message:
                "Please select First Half or Second Half.",
            });
        }
      } else {
        /*
        ------------------------------
        NORMAL FULL DAY LEAVE
        ------------------------------
        */

        if (
          !endDate ||
          !datePattern.test(
            endDate
          )
        ) {
          return res
            .status(400)
            .json({
              success: false,

              message:
                "Please select the end date.",
            });
        }

        if (
          endDate <
          startDate
        ) {
          return res
            .status(400)
            .json({
              success: false,

              message:
                "Leave end date cannot be before start date.",
            });
        }
      }
            if (
        endDate &&
        startDate.slice(
          0,
          4
        ) !==
          endDate.slice(
            0,
            4
          )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Please submit separate Leave applications for each calendar year.",
          });
      }

      /*
      Reason remains required for
      Sick/Casual/Privileged.

      Holiday Leave automatically
      gets the festival name.
      */

      if (
        !reason &&
        leaveType !==
          "festival"
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Please enter the reason for leave.",
          });
      }

      const finalReason =
        leaveType ===
        "festival"
          ? `Festival: ${
              selectedHoliday
                ?.name ||
              "Holiday Leave"
            }${
              reason
                ? ` - ${reason}`
                : ""
            }`
          : reason;

      /*
      ------------------------------
      CALCULATE DAYS
      ------------------------------
      */

      const totalDays =
        leaveType ===
        "festival"
          ? 1
          : durationType ===
            "half_day"
          ? 0.5
          : calculateInclusiveDays(
              startDate,
              endDate
            );

      if (
        totalDays <= 0
      ) {
        return res
          .status(400)
          .json({
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
      ------------------------------
      BALANCE VALIDATION
      ------------------------------
      */

      const balances =
  await buildLeaveBalances(
    db,
    employeeId,
    leaveYear
  );

      const selectedBalance =
        balances[
          leaveType
        ];

      if (
        !selectedBalance
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Unable to calculate leave balance.",
          });
      }

      if (
        totalDays >
        Number(
          selectedBalance
            .available || 0
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              `You only have ${selectedBalance.available} ${getLeaveLabel(
                leaveType
              )} day(s) available.`,
          });
      }

      /*
      ------------------------------
      PREVENT OVERLAPPING LEAVE
      ------------------------------
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
        return res
          .status(400)
          .json({
            success: false,

            message:
              "You already have a pending or approved leave application for these dates.",
          });
      }

      /*
      ------------------------------
      DATABASE COLUMNS
      ------------------------------
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
        finalReason,
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
          leaveType ===
            "festival"
            ? "full_day"
            : durationType
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
          leaveType !==
            "festival" &&
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
      ------------------------------
      SAVE APPLICATION
      ------------------------------
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
      ------------------------------
      GET EMPLOYEE
      ------------------------------
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
          [
            employeeId,
          ]
        );

      const employee =
        employeeRows[0] ||
        {};

      /*
      ------------------------------
      FIND DEPARTMENT ADMIN
      ------------------------------
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
              employee
                .department_id,
            ]
          );

        admin =
          adminRows[0] ||
          {};
      } catch (
        adminError
      ) {
        console.error(
          "Admin email lookup skipped:",
          adminError.message
        );

        admin = {};
      }

      /*
      ======================================================
      EMAIL ADMIN
      ======================================================
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
            leaveType ===
              "festival"
              ? "Full Day"
              : durationType ===
                "half_day"
              ? halfDaySession ===
                "first_half"
                ? "Half Day - First Half"
                : "Half Day - Second Half"
              : totalDays ===
                1
              ? "Full Day"
              : `${totalDays} Full Days`;

          const subject =
            `${leaveLabel} Application - ${
              employee
                .full_name ||
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
${finalReason}

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
              <h2 style="color:#ff5733;">
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
                    padding:8px;
                    border:1px solid #dddddd;
                  ">
                    <strong>Employee</strong>
                  </td>

                  <td style="
                    padding:8px;
                    border:1px solid #dddddd;
                  ">
                    ${employee.full_name || "-"}
                  </td>
                </tr>

                <tr>
                  <td style="
                    padding:8px;
                    border:1px solid #dddddd;
                  ">
                    <strong>Employee Email</strong>
                  </td>

                  <td style="
                    padding:8px;
                    border:1px solid #dddddd;
                  ">
                    ${employee.email || "-"}
                  </td>
                </tr>

                <tr>
                  <td style="
                    padding:8px;
                    border:1px solid #dddddd;
                  ">
                    <strong>Department</strong>
                  </td>

                  <td style="
                    padding:8px;
                    border:1px solid #dddddd;
                  ">
                    ${employee.department_name || "-"}
                  </td>
                </tr>

                <tr>
                  <td style="
                    padding:8px;
                    border:1px solid #dddddd;
                  ">
                    <strong>Leave Type</strong>
                  </td>

                  <td style="
                    padding:8px;
                    border:1px solid #dddddd;
                  ">
                    ${leaveLabel}
                  </td>
                </tr>

                <tr>
                  <td style="
                    padding:8px;
                    border:1px solid #dddddd;
                  ">
                    <strong>From</strong>
                  </td>

                  <td style="
                    padding:8px;
                    border:1px solid #dddddd;
                  ">
                    ${startDate}
                  </td>
                </tr>

                <tr>
                  <td style="
                    padding:8px;
                    border:1px solid #dddddd;
                  ">
                    <strong>To</strong>
                  </td>

                  <td style="
                    padding:8px;
                    border:1px solid #dddddd;
                  ">
                    ${endDate}
                  </td>
                </tr>

                <tr>
                  <td style="
                    padding:8px;
                    border:1px solid #dddddd;
                  ">
                    <strong>Duration</strong>
                  </td>

                  <td style="
                    padding:8px;
                    border:1px solid #dddddd;
                  ">
                    ${durationLabel}
                  </td>
                </tr>

                <tr>
                  <td style="
                    padding:8px;
                    border:1px solid #dddddd;
                  ">
                    <strong>Leave Days</strong>
                  </td>

                  <td style="
                    padding:8px;
                    border:1px solid #dddddd;
                  ">
                    ${totalDays}
                  </td>
                </tr>

                <tr>
                  <td style="
                    padding:8px;
                    border:1px solid #dddddd;
                  ">
                    <strong>Reason</strong>
                  </td>

                  <td style="
                    padding:8px;
                    border:1px solid #dddddd;
                  ">
                    ${finalReason}
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
      LEAVE_APPLICATION_RECIPIENTS,

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
        } catch (
          emailError
        ) {
          console.error(
            "Leave application email failed:",
            emailError
          );

          /*
          Email failure must
          never cancel leave.
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
      ======================================================
      RESPONSE
      ======================================================
      */

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Leave application submitted successfully.",

          application: {
            leave_id:
              result.insertId,

            employee_id:
              employeeId,

            employee_name:
              employee
                .full_name ||
              "",

            employee_email:
              employee.email ||
              "",

            department_id:
              employee
                .department_id ||
              null,

            department_name:
              employee
                .department_name ||
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
              leaveType ===
                "festival"
                ? "full_day"
                : durationType,

            half_day_session:
              leaveType !==
                "festival" &&
              durationType ===
                "half_day"
                ? halfDaySession
                : null,

            total_days:
              totalDays,

            reason:
              finalReason,

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

      return res
        .status(500)
        .json({
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

/*
========================================================
GET HOLIDAY CALENDAR
GET /api/employee-leaves/holidays
========================================================
*/

const getEmployeeHolidayCalendar =
  async (req, res) => {
    try {
      const employeeId =
        req.user.user_id;

      const [selectedRows] =
        await db.query(
          `
          SELECT
            DATE_FORMAT(
              holiday_date,
              '%Y-%m-%d'
            ) AS holiday_date,

            holiday_name

          FROM employee_optional_holidays

          WHERE
            employee_id = ?

            AND holiday_year = 2026

          ORDER BY
            holiday_date ASC
          `,
          [
            employeeId,
          ]
        );

      const selectedDates =
        new Set(
          selectedRows.map(
            (row) =>
              row.holiday_date
          )
        );

      const holidays =
        HOLIDAYS_2026.map(
          (holiday) => ({
            ...holiday,

            selected:
              selectedDates.has(
                holiday.date
              ),
          })
        );

      return res.json({
        success: true,
        year: 2026,
        max_optional: 4,

        selected_count:
          selectedRows.length,

        holidays,
      });
    } catch (error) {
      console.error(
        "Get employee holiday calendar error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to load holiday calendar.",

          error:
            error.message,
        });
    }
  };

/*
========================================================
SELECT / REMOVE OPTIONAL HOLIDAY
POST /api/employee-leaves/holidays/toggle
========================================================
*/

const toggleEmployeeOptionalHoliday =
  async (req, res) => {
    try {
      const employeeId =
        req.user.user_id;

      const holidayDate =
        String(
          req.body
            .holiday_date ||
            ""
        ).trim();

      const holiday =
        HOLIDAYS_2026.find(
          (item) =>
            item.date ===
            holidayDate
        );

      if (!holiday) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Invalid holiday.",
          });
      }

      if (
        holiday.type ===
        "fixed"
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "This is already a fixed company holiday.",
          });
      }

      const today =
        getIndiaToday();

      if (
        holidayDate <
        today
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Past holidays cannot be selected.",
          });
      }

      /*
      Sunday is already weekly off.
      */

      const holidayDay =
        new Date(
          `${holidayDate}T00:00:00`
        ).getDay();

      if (
        holidayDay === 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "This festival falls on Sunday, which is already a weekly off.",
          });
      }

      const [existingRows] =
        await db.query(
          `
          SELECT
            selection_id

          FROM employee_optional_holidays

          WHERE
            employee_id = ?

            AND holiday_date = ?

          LIMIT 1
          `,
          [
            employeeId,
            holidayDate,
          ]
        );

      /*
      Already selected:
      remove it.
      */

      if (
        existingRows.length >
        0
      ) {
        await db.query(
          `
          DELETE FROM employee_optional_holidays

          WHERE
            employee_id = ?

            AND holiday_date = ?
          `,
          [
            employeeId,
            holidayDate,
          ]
        );

        return res.json({
          success: true,
          selected: false,

          message:
            "Optional holiday removed.",
        });
      }

      const [countRows] =
        await db.query(
          `
          SELECT
            COUNT(*) AS selected_count

          FROM employee_optional_holidays

          WHERE
            employee_id = ?

            AND holiday_year = 2026
          `,
          [
            employeeId,
          ]
        );

      const selectedCount =
        Number(
          countRows[0]
            ?.selected_count ||
            0
        );

      if (
        selectedCount >= 4
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "You have already selected all 4 optional holidays.",
          });
      }

      await db.query(
        `
        INSERT INTO employee_optional_holidays (
          employee_id,
          holiday_date,
          holiday_name,
          holiday_year
        )

        VALUES (
          ?, ?, ?, 2026
        )
        `,
        [
          employeeId,
          holiday.date,
          holiday.name,
        ]
      );

      return res.json({
        success: true,
        selected: true,

        message:
          `${holiday.name} selected as an optional holiday.`,
      });
    } catch (error) {
      console.error(
        "Toggle optional holiday error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to update optional holiday.",

          error:
            error.message,
        });
    }
  };

module.exports = {
  getEmployeeLeaveSummary,
  applyEmployeeLeave,
  getEmployeeHolidayCalendar,
  toggleEmployeeOptionalHoliday,
};
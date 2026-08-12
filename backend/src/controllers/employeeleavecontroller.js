const db = require("../config/db");

const LEAVE_LIMITS = {
  sick: 7,
  casual: 7,
  mandatory: 18,
};

const normalizeLeaveType = (value) => {
  const type = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (type === "sick" || type === "sick_leave") {
    return "sick";
  }

  if (type === "casual" || type === "casual_leave") {
    return "casual";
  }

  if (
    type === "mandatory" ||
    type === "mandatory_leave"
  ) {
    return "mandatory";
  }

  return "";
};

const getYearFromDate = (dateValue) => {
  if (!dateValue) return new Date().getFullYear();

  const year = Number(String(dateValue).slice(0, 4));

  return Number.isFinite(year)
    ? year
    : new Date().getFullYear();
};

const calculateInclusiveDays = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;

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

  const millisecondsPerDay =
    24 * 60 * 60 * 1000;

  return (
    Math.floor(
      (end - start) / millisecondsPerDay
    ) + 1
  );
};

const getUsedLeave = async (
  employeeId,
  year
) => {
  const [rows] = await db.query(
    `
    SELECT
      leave_type,
      COALESCE(SUM(total_days), 0) AS used_days
    FROM leave_applications
    WHERE employee_id = ?
      AND status = 'approved'
      AND YEAR(start_date) = ?
    GROUP BY leave_type
    `,
    [employeeId, year]
  );

  const used = {
    sick: 0,
    casual: 0,
    mandatory: 0,
  };

  rows.forEach((row) => {
    const type = normalizeLeaveType(
      row.leave_type
    );

    if (type) {
      used[type] =
        Number(row.used_days || 0);
    }
  });

  return used;
};

const buildLeaveBalances = (used) => {
  return {
    sick: {
      label: "Sick Leave",
      total: LEAVE_LIMITS.sick,
      used: Number(used.sick || 0),
      remaining: Math.max(
        0,
        LEAVE_LIMITS.sick -
          Number(used.sick || 0)
      ),
    },

    casual: {
      label: "Casual Leave",
      total: LEAVE_LIMITS.casual,
      used: Number(used.casual || 0),
      remaining: Math.max(
        0,
        LEAVE_LIMITS.casual -
          Number(used.casual || 0)
      ),
    },

    mandatory: {
      label: "Mandatory Leave",
      total: LEAVE_LIMITS.mandatory,
      used: Number(used.mandatory || 0),
      remaining: Math.max(
        0,
        LEAVE_LIMITS.mandatory -
          Number(used.mandatory || 0)
      ),
    },
  };
};

/*
=========================================================
GET EMPLOYEE LEAVE SUMMARY
=========================================================
GET /api/employee-leaves/summary
*/
const getEmployeeLeaveSummary = async (
  req,
  res
) => {
  try {
    const employeeId = req.user.user_id;

    const requestedYear = Number(
      req.query.year
    );

    const year =
      Number.isFinite(requestedYear) &&
      requestedYear > 2000
        ? requestedYear
        : new Date().getFullYear();

    const used = await getUsedLeave(
      employeeId,
      year
    );

    const balances =
      buildLeaveBalances(used);

    const [applications] = await db.query(
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
        la.reason,
        la.status,

        la.reviewed_by,

        DATE_FORMAT(
          la.reviewed_at,
          '%Y-%m-%d %H:%i:%s'
        ) AS reviewed_at,

        DATE_FORMAT(
          la.applied_at,
          '%Y-%m-%d %H:%i:%s'
        ) AS applied_at,

        reviewer.full_name AS reviewed_by_name

      FROM leave_applications la

      LEFT JOIN users reviewer
        ON reviewer.user_id =
          la.reviewed_by

      WHERE la.employee_id = ?
        AND YEAR(la.start_date) = ?

      ORDER BY
        la.applied_at DESC,
        la.leave_id DESC
      `,
      [employeeId, year]
    );

    return res.json({
      success: true,

      year,

      limits: {
        sick: 7,
        casual: 7,
        mandatory: 18,
      },

      balances,

      applications: applications.map(
        (application) => ({
          ...application,

          total_days: Number(
            application.total_days || 0
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
      error: error.message,
      sqlMessage:
        error.sqlMessage || null,
    });
  }
};

/*
=========================================================
APPLY FOR LEAVE
=========================================================
POST /api/employee-leaves/apply
*/
const applyEmployeeLeave = async (
  req,
  res
) => {
  try {
    const employeeId = req.user.user_id;

    const leaveType = normalizeLeaveType(
      req.body.leave_type
    );

    const startDate = String(
      req.body.start_date || ""
    ).trim();

    const endDate = String(
      req.body.end_date || ""
    ).trim();

    const reason = String(
      req.body.reason || ""
    ).trim();

    if (!leaveType) {
      return res.status(400).json({
        success: false,
        message:
          "Please select a valid leave type.",
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message:
          "Start date and end date are required.",
      });
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        startDate
      ) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(
        endDate
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid leave date format.",
      });
    }

    if (endDate < startDate) {
      return res.status(400).json({
        success: false,
        message:
          "Leave end date cannot be before start date.",
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message:
          "Please enter a reason for leave.",
      });
    }

    const totalDays =
      calculateInclusiveDays(
        startDate,
        endDate
      );

    if (totalDays <= 0) {
      return res.status(400).json({
        success: false,
        message:
          "Unable to calculate leave days.",
      });
    }

    const leaveYear =
      getYearFromDate(startDate);

    /*
    -----------------------------------------------------
    CHECK CURRENT APPROVED BALANCE
    -----------------------------------------------------
    */
    const used = await getUsedLeave(
      employeeId,
      leaveYear
    );

    const balances =
      buildLeaveBalances(used);

    const selectedBalance =
      balances[leaveType];

    if (
      totalDays >
      selectedBalance.remaining
    ) {
      return res.status(400).json({
        success: false,
        message:
          `You only have ${selectedBalance.remaining} ${selectedBalance.label} day(s) remaining.`,
      });
    }

    /*
    -----------------------------------------------------
    PREVENT OVERLAPPING PENDING / APPROVED LEAVE
    -----------------------------------------------------
    */
    const [overlappingRows] =
      await db.query(
        `
        SELECT
          leave_id,
          leave_type,
          status,
          DATE_FORMAT(
            start_date,
            '%Y-%m-%d'
          ) AS start_date,
          DATE_FORMAT(
            end_date,
            '%Y-%m-%d'
          ) AS end_date

        FROM leave_applications

        WHERE employee_id = ?

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

    if (overlappingRows.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "You already have a pending or approved leave application for these dates.",
      });
    }

    /*
    -----------------------------------------------------
    SAVE APPLICATION
    -----------------------------------------------------
    */
    const [result] = await db.query(
      `
      INSERT INTO leave_applications (
        employee_id,
        leave_type,
        start_date,
        end_date,
        total_days,
        reason,
        status
      )
      VALUES (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        'pending'
      )
      `,
      [
        employeeId,
        leaveType,
        startDate,
        endDate,
        totalDays,
        reason,
      ]
    );

    /*
    -----------------------------------------------------
    GET EMPLOYEE INFORMATION
    -----------------------------------------------------
    */
    const [employeeRows] =
      await db.query(
        `
        SELECT
          user_id,
          full_name,
          email
        FROM users
        WHERE user_id = ?
        LIMIT 1
        `,
        [employeeId]
      );

    const employee =
      employeeRows[0] || {};

    return res.status(201).json({
      success: true,

      message:
        "Leave application submitted successfully.",

      application: {
        leave_id: result.insertId,
        employee_id: employeeId,

        employee_name:
          employee.full_name || "",

        employee_email:
          employee.email || "",

        leave_type: leaveType,

        start_date: startDate,
        end_date: endDate,

        total_days: totalDays,

        reason,

        status: "pending",
      },
    });
  } catch (error) {
    console.error(
      "Apply employee leave error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to submit leave application.",
      error: error.message,
      sqlMessage:
        error.sqlMessage || null,
    });
  }
};

module.exports = {
  getEmployeeLeaveSummary,
  applyEmployeeLeave,
};
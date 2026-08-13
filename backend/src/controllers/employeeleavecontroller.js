const db = require("../config/db");

const LEAVE_LIMITS = {
  sick: 7,
  casual: 7,
};

const PRIVILEGED_MONTHLY_CREDIT = 1.5;
const PRIVILEGED_ANNUAL_ENTITLEMENT = 18;

const normalizeLeaveType = (value) => {
  const type = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (type === "sick" || type === "sick_leave") return "sick";
  if (type === "casual" || type === "casual_leave") return "casual";

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

const getYearFromDate = (value) => {
  const year = Number(String(value || "").slice(0, 4));
  return Number.isFinite(year) ? year : new Date().getFullYear();
};

const calculateInclusiveDays = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    return 0;
  }

  return Math.floor(
    (end - start) / (1000 * 60 * 60 * 24)
  ) + 1;
};

const getTomorrowDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const ensurePrivilegedCredits = async (employeeId, year) => {
  const now = new Date();
  const currentYear = now.getFullYear();

  if (year > currentYear) return;

  const lastMonth =
    year < currentYear
      ? 12
      : now.getMonth() + 1;

  for (let month = 1; month <= lastMonth; month += 1) {
    const creditDate = `${year}-${String(month).padStart(2, "0")}-01`;

    // expiry_date remains only because the existing DB column is NOT NULL.
    // It is NOT used for Privileged Leave calculations anymore.
    const unusedExpiryDate = `${year}-12-31`;

    await db.query(
      `
      INSERT IGNORE INTO employee_leave_credits (
        employee_id,
        leave_type,
        credit_year,
        credit_month,
        credit_date,
        expiry_date,
        credited_days,
        used_days,
        encashable_days,
        status
      )
      VALUES (?, 'mandatory', ?, ?, ?, ?, ?, 0, 0, 'active')
      `,
      [
        employeeId,
        year,
        month,
        creditDate,
        unusedExpiryDate,
        PRIVILEGED_MONTHLY_CREDIT,
      ]
    );
  }
};

const getApprovedLeave = async (employeeId, year) => {
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
    const type = normalizeLeaveType(row.leave_type);

    if (type) {
      used[type] = Number(row.used_days || 0);
    }
  });

  return used;
};

const getPendingLeave = async (employeeId, year) => {
  const [rows] = await db.query(
    `
    SELECT
      leave_type,
      COALESCE(SUM(total_days), 0) AS pending_days
    FROM leave_applications
    WHERE employee_id = ?
      AND status = 'pending'
      AND YEAR(start_date) = ?
    GROUP BY leave_type
    `,
    [employeeId, year]
  );

  const pending = {
    sick: 0,
    casual: 0,
    mandatory: 0,
  };

  rows.forEach((row) => {
    const type = normalizeLeaveType(row.leave_type);

    if (type) {
      pending[type] = Number(row.pending_days || 0);
    }
  });

  return pending;
};

const getPrivilegedEarned = async (employeeId, year) => {
  await ensurePrivilegedCredits(employeeId, year);

  const [rows] = await db.query(
    `
    SELECT
      COALESCE(SUM(credited_days), 0) AS earned
    FROM employee_leave_credits
    WHERE employee_id = ?
      AND credit_year = ?
      AND leave_type = 'mandatory'
    `,
    [employeeId, year]
  );

  return Number(rows[0]?.earned || 0);
};

const buildBalances = async (employeeId, year) => {
  const used = await getApprovedLeave(employeeId, year);
  const pending = await getPendingLeave(employeeId, year);
  const privilegedEarned = await getPrivilegedEarned(employeeId, year);

  const sickAvailable = Math.max(
    0,
    LEAVE_LIMITS.sick - used.sick - pending.sick
  );

  const casualAvailable = Math.max(
    0,
    LEAVE_LIMITS.casual - used.casual - pending.casual
  );

  const privilegedAvailable = Math.max(
    0,
    privilegedEarned - used.mandatory - pending.mandatory
  );

  return {
    sick: {
      label: "Sick Leave",
      total: LEAVE_LIMITS.sick,
      earned: LEAVE_LIMITS.sick,
      used: used.sick,
      pending: pending.sick,
      available: sickAvailable,
      remaining: sickAvailable,
    },

    casual: {
      label: "Casual Leave",
      total: LEAVE_LIMITS.casual,
      earned: LEAVE_LIMITS.casual,
      used: used.casual,
      pending: pending.casual,
      available: casualAvailable,
      remaining: casualAvailable,
    },

    mandatory: {
      label: "Privileged Leave",
      monthly_credit: PRIVILEGED_MONTHLY_CREDIT,
      annual_entitlement: PRIVILEGED_ANNUAL_ENTITLEMENT,
      earned: privilegedEarned,
      used: used.mandatory,
      pending: pending.mandatory,
      available: privilegedAvailable,
      remaining: privilegedAvailable,
    },
  };
};

const getEmployeeLeaveSummary = async (req, res) => {
  try {
    const employeeId = req.user.user_id;
    const requestedYear = Number(req.query.year);

    const year =
      Number.isFinite(requestedYear) && requestedYear > 2000
        ? requestedYear
        : new Date().getFullYear();

    const balances = await buildBalances(employeeId, year);

    const [applications] = await db.query(
      `
      SELECT
        la.leave_id,
        la.employee_id,
        la.leave_type,

        DATE_FORMAT(la.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(la.end_date, '%Y-%m-%d') AS end_date,

        la.total_days,
        la.duration_type,
        la.half_day_session,
        la.reason,
        la.status,
        la.rejection_reason,
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
        ON reviewer.user_id = la.reviewed_by

      WHERE la.employee_id = ?
        AND YEAR(la.start_date) = ?

      ORDER BY la.applied_at DESC, la.leave_id DESC
      `,
      [employeeId, year]
    );

    return res.json({
      success: true,
      year,

      configuration: {
        privileged_monthly_credit: PRIVILEGED_MONTHLY_CREDIT,
        privileged_annual_entitlement: PRIVILEGED_ANNUAL_ENTITLEMENT,
        minimum_notice_days: 1,
      },

      balances,

      applications: applications.map((application) => ({
        ...application,
        total_days: Number(application.total_days || 0),
      })),
    });
  } catch (error) {
    console.error("Get employee leave summary error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch leave information.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};

const applyEmployeeLeave = async (req, res) => {
  try {
    const employeeId = req.user.user_id;

    const leaveType = normalizeLeaveType(req.body.leave_type);
    const startDate = String(req.body.start_date || "").trim();
    let endDate = String(req.body.end_date || "").trim();
    const reason = String(req.body.reason || "").trim();

    const durationType = String(
      req.body.duration_type || "full_day"
    ).toLowerCase();

    let halfDaySession = req.body.half_day_session
      ? String(req.body.half_day_session).toLowerCase()
      : null;

    if (!leaveType) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid leave type.",
      });
    }

    if (!["full_day", "half_day"].includes(durationType)) {
      return res.status(400).json({
        success: false,
        message: "Please select Full Day or Half Day.",
      });
    }

    if (
      !startDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid leave date.",
      });
    }

    /*
    Employee must apply at least one day before.
    Today is not allowed.
    Tomorrow onward is allowed.
    */
    const minimumDate = getTomorrowDate();

    if (startDate < minimumDate) {
      return res.status(400).json({
        success: false,
        message:
          "Leave must be applied for at least 1 day in advance.",
      });
    }

    if (durationType === "half_day") {
      endDate = startDate;

      if (!["first_half", "second_half"].includes(halfDaySession)) {
        return res.status(400).json({
          success: false,
          message: "Please select First Half or Second Half.",
        });
      }
    } else {
      halfDaySession = null;

      if (
        !endDate ||
        !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
      ) {
        return res.status(400).json({
          success: false,
          message: "Please select a valid end date.",
        });
      }

      if (endDate < startDate) {
        return res.status(400).json({
          success: false,
          message: "Leave end date cannot be before start date.",
        });
      }
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Please enter a reason for leave.",
      });
    }

    const totalDays =
      durationType === "half_day"
        ? 0.5
        : calculateInclusiveDays(startDate, endDate);

    if (totalDays <= 0) {
      return res.status(400).json({
        success: false,
        message: "Unable to calculate leave days.",
      });
    }

    const leaveYear = getYearFromDate(startDate);
    const balances = await buildBalances(employeeId, leaveYear);
    const selectedBalance = balances[leaveType];

    if (totalDays > Number(selectedBalance.available || 0)) {
      return res.status(400).json({
        success: false,
        message:
          `You only have ${selectedBalance.available} ` +
          `${selectedBalance.label} day(s) available. ` +
          "Leave cannot be taken in advance.",
      });
    }

    const [overlappingRows] = await db.query(
      `
      SELECT
        leave_id,
        duration_type,
        half_day_session
      FROM leave_applications
      WHERE employee_id = ?
        AND status IN ('pending', 'approved')
        AND NOT (
          end_date < ?
          OR start_date > ?
        )
      `,
      [employeeId, startDate, endDate]
    );

    const hasConflict = overlappingRows.some((existing) => {
      if (
        durationType === "full_day" ||
        existing.duration_type === "full_day"
      ) {
        return true;
      }

      return existing.half_day_session === halfDaySession;
    });

    if (hasConflict) {
      return res.status(400).json({
        success: false,
        message:
          "You already have a pending or approved leave application for this date or session.",
      });
    }

    const [result] = await db.query(
      `
      INSERT INTO leave_applications (
        employee_id,
        leave_type,
        start_date,
        end_date,
        total_days,
        duration_type,
        half_day_session,
        reason,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `,
      [
        employeeId,
        leaveType,
        startDate,
        endDate,
        totalDays,
        durationType,
        halfDaySession,
        reason,
      ]
    );

    const [employeeRows] = await db.query(
      `
      SELECT user_id, full_name, email
      FROM users
      WHERE user_id = ?
      LIMIT 1
      `,
      [employeeId]
    );

    const employee = employeeRows[0] || {};

    return res.status(201).json({
      success: true,
      message: "Leave application submitted successfully.",

      application: {
        leave_id: result.insertId,
        employee_id: employeeId,
        employee_name: employee.full_name || "",
        employee_email: employee.email || "",
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        duration_type: durationType,
        half_day_session: halfDaySession,
        reason,
        status: "pending",
      },
    });
  } catch (error) {
    console.error("Apply employee leave error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit leave application.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};

module.exports = {
  getEmployeeLeaveSummary,
  applyEmployeeLeave,
};
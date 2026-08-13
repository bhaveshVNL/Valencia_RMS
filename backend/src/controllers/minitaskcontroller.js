const db = require("../config/db");

const getLoggedInUser = async (req) => {
  const loggedInUserId =
    req.user?.user_id || req.user?.id || req.user?.userId || req.user?.uid;

  if (!loggedInUserId) {
    return {
      error: {
        status: 401,
        message: "Unauthorized. User not found in token.",
      },
    };
  }

  const [rows] = await db.query(
    `
    SELECT
      u.user_id,
      u.full_name,
      u.email,
      u.employee_code,
      u.department_id,
      u.designation,
      r.role_name,
      d.department_name
    FROM users u
    LEFT JOIN roles r
      ON r.role_id = u.role_id
    LEFT JOIN departments d
      ON d.department_id = u.department_id
    WHERE u.user_id = ?
    LIMIT 1
    `,
    [loggedInUserId]
  );

  if (!rows.length) {
    return {
      error: {
        status: 404,
        message: "Logged-in user not found.",
      },
    };
  }

  return {
    user: rows[0],
  };
};

const timeToMinutes = (timeValue) => {
  const value = String(timeValue || "").trim();

  const parts = value.split(":").map(Number);

  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
    return null;
  }

  const hours = parts[0];
  const minutes = parts[1];

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
};

const createEmployeeMiniTask = async (req, res) => {
  try {
    const { user, error } = await getLoggedInUser(req);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const {
      mini_task_title,
      mini_task_description,
      task_date,
      start_time,
      end_time,
    } = req.body;

    const cleanTitle = String(mini_task_title || "").trim();
    const cleanDescription = String(mini_task_description || "").trim();
    const cleanDate = String(task_date || "").trim();
    const cleanStartTime = String(start_time || "").trim();
    const cleanEndTime = String(end_time || "").trim();

    if (!cleanTitle) {
      return res.status(400).json({
        message: "Mini task title is required.",
      });
    }

    if (!cleanDate) {
      return res.status(400).json({
        message: "Mini task date is required.",
      });
    }

    if (!cleanStartTime) {
      return res.status(400).json({
        message: "Start time is required.",
      });
    }

    if (!cleanEndTime) {
      return res.status(400).json({
        message: "End time is required.",
      });
    }

    const startMinutes = timeToMinutes(cleanStartTime);
    const endMinutes = timeToMinutes(cleanEndTime);

    if (startMinutes === null || endMinutes === null) {
      return res.status(400).json({
        message: "Invalid start time or end time.",
      });
    }

    if (endMinutes <= startMinutes) {
      return res.status(400).json({
        message: "End time must be after start time.",
      });
    }
    
    const now = new Date();

const today = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0"),
].join("-");

if (cleanDate > today) {
  return res.status(400).json({
    message: "Mini tasks cannot be logged for a future date.",
  });
}

if (cleanDate === today) {
  const currentMinutes =
    now.getHours() * 60 + now.getMinutes();

  if (endMinutes > currentMinutes) {
    return res.status(400).json({
      message:
        "Mini task end time cannot be in the future.",
    });
  }
}

    const totalMinutes = endMinutes - startMinutes;

    const [result] = await db.query(
      `
      INSERT INTO mini_tasks (
        employee_id,
        department_id,
        mini_task_title,
        mini_task_description,
        task_date,
        start_time,
        end_time,
        total_minutes,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'logged')
      `,
      [
        user.user_id,
        user.department_id || null,
        cleanTitle,
        cleanDescription || null,
        cleanDate,
        cleanStartTime,
        cleanEndTime,
        totalMinutes,
      ]
    );

    const [rows] = await db.query(
      `
      SELECT
        mt.mini_task_id,
        mt.employee_id,
        mt.department_id,
        mt.mini_task_title,
        mt.mini_task_description,
        DATE_FORMAT(mt.task_date, '%Y-%m-%d') AS task_date,
        TIME_FORMAT(mt.start_time, '%H:%i') AS start_time,
        TIME_FORMAT(mt.end_time, '%H:%i') AS end_time,
        mt.total_minutes,
        mt.status,
        mt.created_at,

        u.full_name AS employee_name,
        u.email AS employee_email,
        u.employee_code,
        u.designation,
        d.department_name
      FROM mini_tasks mt
      LEFT JOIN users u
        ON u.user_id = mt.employee_id
      LEFT JOIN departments d
        ON d.department_id = mt.department_id
      WHERE mt.mini_task_id = ?
      LIMIT 1
      `,
      [result.insertId]
    );

    return res.status(201).json({
      message: "Mini task added successfully.",
      mini_task: rows[0],
    });
  } catch (error) {
    console.error("Create employee mini task error:", error);

    return res.status(500).json({
      message: "Failed to add mini task.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};

const getMyMiniTasks = async (req, res) => {
  try {
    const { user, error } = await getLoggedInUser(req);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const [rows] = await db.query(
      `
      SELECT
        mt.mini_task_id,
        mt.employee_id,
        mt.department_id,
        mt.mini_task_title,
        mt.mini_task_description,
        DATE_FORMAT(mt.task_date, '%Y-%m-%d') AS task_date,
        TIME_FORMAT(mt.start_time, '%H:%i') AS start_time,
        TIME_FORMAT(mt.end_time, '%H:%i') AS end_time,
        mt.total_minutes,
        mt.status,
        mt.created_at,

        u.full_name AS employee_name,
        u.email AS employee_email,
        u.employee_code,
        u.designation,
        d.department_name
      FROM mini_tasks mt
      LEFT JOIN users u
        ON u.user_id = mt.employee_id
      LEFT JOIN departments d
        ON d.department_id = mt.department_id
      WHERE mt.employee_id = ?
      ORDER BY mt.task_date DESC, mt.start_time DESC, mt.mini_task_id DESC
      `,
      [user.user_id]
    );

    return res.status(200).json({
      total: rows.length,
      mini_tasks: rows,
    });
  } catch (error) {
    console.error("Get my mini tasks error:", error);

    return res.status(500).json({
      message: "Failed to fetch mini tasks.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};

const getDepartmentMiniTasks = async (req, res) => {
  try {
    const { user, error } = await getLoggedInUser(req);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    if (!user.department_id) {
      return res.status(400).json({
        message: "Admin department not found.",
      });
    }

    const [rows] = await db.query(
      `
      SELECT
        mt.mini_task_id,
        mt.employee_id,
        mt.department_id,
        mt.mini_task_title,
        mt.mini_task_description,
        DATE_FORMAT(mt.task_date, '%Y-%m-%d') AS task_date,
        TIME_FORMAT(mt.start_time, '%H:%i') AS start_time,
        TIME_FORMAT(mt.end_time, '%H:%i') AS end_time,
        mt.total_minutes,
        mt.status,
        mt.created_at,

        u.full_name AS employee_name,
        u.email AS employee_email,
        u.employee_code,
        u.designation,
        d.department_name
      FROM mini_tasks mt
      LEFT JOIN users u
        ON u.user_id = mt.employee_id
      LEFT JOIN departments d
        ON d.department_id = mt.department_id
      WHERE mt.department_id = ?
      ORDER BY mt.task_date DESC, mt.start_time DESC, mt.mini_task_id DESC
      `,
      [user.department_id]
    );

    return res.status(200).json({
      total: rows.length,
      department_id: user.department_id,
      department_name: user.department_name,
      mini_tasks: rows,
    });
  } catch (error) {
    console.error("Get department mini tasks error:", error);

    return res.status(500).json({
      message: "Failed to fetch department mini tasks.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};

const markMiniTaskReviewed = async (req, res) => {
  try {
    const { user, error } = await getLoggedInUser(req);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const miniTaskId = Number(req.params.miniTaskId);

    if (!miniTaskId) {
      return res.status(400).json({
        message: "Mini task ID is required.",
      });
    }

    const [rows] = await db.query(
      `
      SELECT mini_task_id
      FROM mini_tasks
      WHERE mini_task_id = ?
      AND department_id = ?
      LIMIT 1
      `,
      [miniTaskId, user.department_id]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Mini task not found for your department.",
      });
    }

    await db.query(
      `
      UPDATE mini_tasks
      SET status = 'reviewed'
      WHERE mini_task_id = ?
      `,
      [miniTaskId]
    );

    return res.status(200).json({
      message: "Mini task marked as reviewed.",
    });
  } catch (error) {
    console.error("Mark mini task reviewed error:", error);

    return res.status(500).json({
      message: "Failed to update mini task.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};

module.exports = {
  createEmployeeMiniTask,
  getMyMiniTasks,
  getDepartmentMiniTasks,
  markMiniTaskReviewed,
};
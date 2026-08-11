const db = require("../config/db");

const normalizeStatus = (status) => {
  const value = String(status || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (["todo", "to_do", "pending", "not_started"].includes(value)) return "not_started";
  if (["ongoing", "in_progress", "progress"].includes(value)) return "ongoing";
  if (["under_review", "review"].includes(value)) return "under_review";
  if (["completed", "done", "complete"].includes(value)) return "completed";
  if (["rejected", "reject"].includes(value)) return "rejected";
  if (["on_hold", "hold"].includes(value)) return "on_hold";

  return value || "not_started";
};

const getEmployeeOverview = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [taskSummaryRows] = await db.query(
      `
      SELECT
        COUNT(*) AS total_tasks,
        SUM(
          CASE
            WHEN LOWER(REPLACE(t.status, ' ', '_')) IN ('completed', 'done', 'complete')
              OR t.progress >= 100
            THEN 1
            ELSE 0
          END
        ) AS completed_tasks,
        SUM(
          CASE
            WHEN LOWER(REPLACE(t.status, ' ', '_')) IN ('ongoing', 'in_progress')
              AND t.progress < 100
            THEN 1
            ELSE 0
          END
        ) AS in_progress_tasks,
        SUM(
          CASE
            WHEN LOWER(REPLACE(t.status, ' ', '_')) IN ('not_started', 'todo', 'to_do', 'pending')
              OR t.status IS NULL
            THEN 1
            ELSE 0
          END
        ) AS todo_tasks
      FROM tasks t
      WHERE t.assigned_to_user_id = ?
        AND (t.parent_task_id IS NULL OR t.parent_task_id = 0)
      `,
      [userId]
    );

    const taskSummary = taskSummaryRows[0] || {};

    const [recentTasks] = await db.query(
      `
      SELECT
        t.task_id,
        t.project_id,
        t.task_title,
        t.task_description,
        t.status,
        COALESCE(t.progress, 0) AS progress,
        DATE_FORMAT(t.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date,
        p.project_title,
        p.project_description
      FROM tasks t
      LEFT JOIN projects p ON p.project_id = t.project_id
      WHERE t.assigned_to_user_id = ?
        AND (t.parent_task_id IS NULL OR t.parent_task_id = 0)
      ORDER BY t.task_id DESC
      LIMIT 25
      `,
      [userId]
    );

    const [activityLog] = await db.query(
      `
      SELECT
        st.task_id AS activity_id,
        'Subtask Completed' AS title,
        CONCAT(st.task_title, ' is Done.') AS description,
        DATE_FORMAT(COALESCE(st.updated_at, st.created_at), '%Y-%m-%d %H:%i') AS created_at
      FROM tasks st
      INNER JOIN tasks mt ON mt.task_id = st.parent_task_id
      WHERE mt.assigned_to_user_id = ?
        AND (
          st.is_checked = 1
          OR LOWER(REPLACE(st.status, ' ', '_')) IN ('completed', 'done', 'complete')
        )
      ORDER BY COALESCE(st.updated_at, st.created_at) DESC
      LIMIT 5
      `,
      [userId]
    );

    const [latestAttendanceRows] = await db.query(
      `
      SELECT MAX(attendance_date) AS latest_date
      FROM attendance
      WHERE employee_id = ?
      `,
      [userId]
    );

    const latestDate = latestAttendanceRows[0]?.latest_date;

let weeklyAttendance = [];

if (latestDate) {
  const [attendanceRows] = await db.query(
    `
    SELECT
      attendance_id,
      DATE_FORMAT(attendance_date, '%Y-%m-%d') AS attendance_date,
      DAYNAME(attendance_date) AS day_name,
      status,
      check_in_time,
      check_out_time,
      total_minutes
    FROM attendance
    WHERE employee_id = ?
      AND attendance_date BETWEEN DATE_SUB(?, INTERVAL 10 DAY) AND ?
    ORDER BY attendance_date ASC
    `,
    [userId, latestDate, latestDate]
  );

  const attendanceMap = new Map(
    attendanceRows.map((row) => [row.attendance_date, row])
  );

  const workingDays = [];
  const cursor = new Date(latestDate);

  while (workingDays.length < 6) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    const day = String(cursor.getDate()).padStart(2, "0");
    const dateString = `${year}-${month}-${day}`;

    const dayName = cursor.toLocaleDateString("en-US", {
      weekday: "long",
    });

    if (dayName !== "Sunday") {
      const existingRow = attendanceMap.get(dateString);

      workingDays.push(
        existingRow || {
          attendance_id: null,
          attendance_date: dateString,
          day_name: dayName,
          status: "absent",
          check_in_time: null,
          check_out_time: null,
          total_minutes: 0,
        }
      );
    }

    cursor.setDate(cursor.getDate() - 1);
  }

  weeklyAttendance = workingDays.reverse();
}

    const attendanceTotalDays = weeklyAttendance.length;

    const attendancePresentDays = weeklyAttendance.filter((row) => {
      const status = String(row.status || "").toLowerCase();
      return status === "present";
    }).length;

    const attendancePercentage =
      attendanceTotalDays > 0
        ? Math.round((attendancePresentDays / attendanceTotalDays) * 100)
        : 0;

    const formattedRecentTasks = recentTasks.map((task) => ({
      ...task,
      status: normalizeStatus(task.status),
      progress: Number(task.progress || 0),
    }));

    return res.json({
      success: true,
      data: {
        summary: {
          total_tasks: Number(taskSummary.total_tasks || 0),
          completed_tasks: Number(taskSummary.completed_tasks || 0),
          in_progress_tasks: Number(taskSummary.in_progress_tasks || 0),
          todo_tasks: Number(taskSummary.todo_tasks || 0),
          attendance_percentage: attendancePercentage,
        },
        recent_tasks: formattedRecentTasks,
        activity_log: activityLog,
        weekly_attendance: weeklyAttendance,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load employee overview.",
      error: error.message,
    });
  }
};

module.exports = {
  getEmployeeOverview,
};
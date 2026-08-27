const db = require("../config/db");

/* =========================================================
   STATUS NORMALIZATION
========================================================= */

const normalizeStatus = (status, progress = 0) => {
  const value = String(status || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  const numericProgress = Number(progress || 0);

  if (
    numericProgress >= 100 ||
    ["completed", "done", "complete"].includes(value)
  ) {
    return "completed";
  }

  if (
    ["ongoing", "in_progress", "progress"].includes(value)
  ) {
    return "ongoing";
  }

  if (
    ["under_review", "review"].includes(value)
  ) {
    return "under_review";
  }

  if (
    ["rejected", "reject"].includes(value)
  ) {
    return "rejected";
  }

  if (
    ["on_hold", "hold"].includes(value)
  ) {
    return "on_hold";
  }

  if (
    ["todo", "to_do", "pending", "not_started", ""].includes(value)
  ) {
    return "not_started";
  }

  return value || "not_started";
};

/* =========================================================
   EMPLOYEE OVERVIEW
========================================================= */

const getEmployeeOverview = async (req, res) => {
  try {
    const userId = req.user.user_id;

    /* =====================================================
       1. GET EXACT SAME MAIN TASKS AS EMPLOYEE TASKS PAGE

       IMPORTANT:
       - task_assignments determines employee ownership
       - parent_task_id NULL = main task
       - subtasks are NOT counted as separate tasks
    ===================================================== */

    const [mainTasks] = await db.query(
      `
      SELECT DISTINCT
        mt.task_id,
        mt.project_id,
        mt.parent_task_id,

        mt.task_title,
        mt.task_description,

        mt.status,
        mt.priority,

        COALESCE(mt.progress, 0) AS progress,

        COALESCE(mt.is_checked, 0) AS is_checked,

        DATE_FORMAT(
          mt.start_date,
          '%Y-%m-%d'
        ) AS start_date,

        DATE_FORMAT(
          mt.due_date,
          '%Y-%m-%d'
        ) AS due_date,

        mt.created_at,
        mt.updated_at,

        p.project_title,
        p.project_description

      FROM tasks mt

      INNER JOIN task_assignments ta
        ON ta.task_id = mt.task_id
       AND ta.employee_id = ?

      LEFT JOIN projects p
        ON p.project_id = mt.project_id

      WHERE
        (
          mt.parent_task_id IS NULL
          OR mt.parent_task_id = 0
        )

      ORDER BY
        mt.task_id DESC
      `,
      [userId]
    );

    /* =====================================================
       2. GET SUBTASKS FOR THOSE MAIN TASKS

       This matches Employee Tasks progress calculation.
    ===================================================== */

    let subtasks = [];

    if (mainTasks.length > 0) {
      const mainTaskIds = mainTasks.map(
        (task) => Number(task.task_id)
      );

      const [subtaskRows] = await db.query(
        `
        SELECT
          task_id,
          parent_task_id,
          project_id,

          task_title,
          task_description,

          status,

          COALESCE(progress, 0) AS progress,

          COALESCE(is_checked, 0) AS is_checked,

          DATE_FORMAT(
            start_date,
            '%Y-%m-%d'
          ) AS start_date,

          DATE_FORMAT(
            due_date,
            '%Y-%m-%d'
          ) AS due_date

        FROM tasks

        WHERE
          parent_task_id IN (?)

        ORDER BY
          task_id ASC
        `,
        [mainTaskIds]
      );

      subtasks = subtaskRows;
    }

    /* =====================================================
       3. BUILD EXACT EMPLOYEE TASK DATA

       Same rule as Employee Tasks page:
       - If subtasks exist, progress =
         completed subtasks / total subtasks
       - Otherwise use task.progress
    ===================================================== */

    const formattedTasks = mainTasks.map((task) => {
      const taskSubtasks = subtasks.filter(
        (subtask) =>
          Number(subtask.parent_task_id) ===
          Number(task.task_id)
      );

      const totalSubtasks =
        taskSubtasks.length;

      const completedSubtasks =
        taskSubtasks.filter((subtask) => {
          return (
            Number(subtask.is_checked || 0) === 1 ||
            normalizeStatus(
              subtask.status,
              subtask.progress
            ) === "completed"
          );
        }).length;

      const calculatedProgress =
        totalSubtasks > 0
          ? Math.round(
              (completedSubtasks /
                totalSubtasks) *
                100
            )
          : Number(task.progress || 0);

      const finalProgress =
        Number.isFinite(calculatedProgress)
          ? calculatedProgress
          : 0;

      const finalStatus =
        normalizeStatus(
          task.status,
          finalProgress
        );

      return {
        ...task,

        status: finalStatus,

        progress: finalProgress,

        total_subtasks:
          totalSubtasks,

        completed_subtasks:
          completedSubtasks,

        subtasks: taskSubtasks,
      };
    });

    /* =====================================================
       4. CALCULATE TASK SUMMARY

       THIS IS NOW THE SOURCE OF TRUTH FOR OVERVIEW.
    ===================================================== */

    const totalTasks =
      formattedTasks.length;

    const completedTasks =
      formattedTasks.filter(
        (task) =>
          task.status === "completed"
      ).length;

    const inProgressTasks =
      formattedTasks.filter(
        (task) =>
          task.status === "ongoing"
      ).length;

    const todoTasks =
      formattedTasks.filter(
        (task) =>
          task.status === "not_started"
      ).length;

    /* =====================================================
       5. RECENT TASKS

       Use the SAME formatted task list,
       so Recent Tasks and cards cannot disagree.
    ===================================================== */

    const recentTasks =
      formattedTasks
        .slice(0, 25)
        .map((task) => ({
          task_id: task.task_id,
          project_id: task.project_id,

          task_title: task.task_title,
          task_description:
            task.task_description,

          status: task.status,

          progress:
            Number(task.progress || 0),

          start_date:
            task.start_date,

          due_date:
            task.due_date,

          project_title:
            task.project_title,

          project_description:
            task.project_description,

          total_subtasks:
            task.total_subtasks,

          completed_subtasks:
            task.completed_subtasks,
        }));

    /* =====================================================
       6. ACTIVITY LOG

       Also use task_assignments so activities belong
       to the employee even when assigned through the
       assignment table.
    ===================================================== */

    const [activityLog] = await db.query(
      `
      SELECT
        st.task_id AS activity_id,

        'Subtask Completed' AS title,

        CONCAT(
          st.task_title,
          ' is Done.'
        ) AS description,

        DATE_FORMAT(
          COALESCE(
            st.updated_at,
            st.created_at
          ),
          '%Y-%m-%d %H:%i'
        ) AS created_at

      FROM tasks st

      INNER JOIN tasks mt
        ON mt.task_id =
           st.parent_task_id

      INNER JOIN task_assignments ta
        ON ta.task_id =
           mt.task_id

       AND ta.employee_id = ?

      WHERE
        (
          st.is_checked = 1

          OR LOWER(
            REPLACE(
              st.status,
              ' ',
              '_'
            )
          ) IN (
            'completed',
            'done',
            'complete'
          )
        )

      ORDER BY
        COALESCE(
          st.updated_at,
          st.created_at
        ) DESC

      LIMIT 5
      `,
      [userId]
    );

    /* =====================================================
       7. ATTENDANCE
    ===================================================== */

    const [latestAttendanceRows] =
      await db.query(
        `
        SELECT
          MAX(attendance_date)
            AS latest_date

        FROM attendance

        WHERE employee_id = ?
        `,
        [userId]
      );

    const latestDate =
      latestAttendanceRows[0]
        ?.latest_date;

    let weeklyAttendance = [];

    if (latestDate) {
      const [attendanceRows] =
        await db.query(
          `
          SELECT
            attendance_id,

            DATE_FORMAT(
              attendance_date,
              '%Y-%m-%d'
            ) AS attendance_date,

            DAYNAME(
              attendance_date
            ) AS day_name,

            status,
            check_in_time,
            check_out_time,
            total_minutes

          FROM attendance

          WHERE
            employee_id = ?

            AND attendance_date
              BETWEEN DATE_SUB(
                ?,
                INTERVAL 10 DAY
              )
              AND ?

          ORDER BY
            attendance_date ASC
          `,
          [
            userId,
            latestDate,
            latestDate,
          ]
        );

      const attendanceMap =
        new Map(
          attendanceRows.map(
            (row) => [
              row.attendance_date,
              row,
            ]
          )
        );

      const workingDays = [];

      const cursor =
        new Date(latestDate);

      while (
        workingDays.length < 6
      ) {
        const year =
          cursor.getFullYear();

        const month =
          String(
            cursor.getMonth() + 1
          ).padStart(2, "0");

        const day =
          String(
            cursor.getDate()
          ).padStart(2, "0");

        const dateString =
          `${year}-${month}-${day}`;

        const dayName =
          cursor.toLocaleDateString(
            "en-US",
            {
              weekday: "long",
            }
          );

        if (
          dayName !== "Sunday"
        ) {
          const existingRow =
            attendanceMap.get(
              dateString
            );

          workingDays.push(
            existingRow || {
              attendance_id: null,

              attendance_date:
                dateString,

              day_name:
                dayName,

              status:
                "absent",

              check_in_time:
                null,

              check_out_time:
                null,

              total_minutes: 0,
            }
          );
        }

        cursor.setDate(
          cursor.getDate() - 1
        );
      }

      weeklyAttendance =
        workingDays.reverse();
    }

    const attendanceTotalDays =
      weeklyAttendance.length;

    const attendancePresentDays =
      weeklyAttendance.filter(
        (row) =>
          String(
            row.status || ""
          ).toLowerCase() ===
          "present"
      ).length;

    const attendancePercentage =
      attendanceTotalDays > 0
        ? Math.round(
            (attendancePresentDays /
              attendanceTotalDays) *
              100
          )
        : 0;

    /* =====================================================
       8. FINAL RESPONSE
    ===================================================== */

    return res.json({
      success: true,

      data: {
        summary: {
          total_tasks:
            totalTasks,

          completed_tasks:
            completedTasks,

          in_progress_tasks:
            inProgressTasks,

          todo_tasks:
            todoTasks,

          attendance_percentage:
            attendancePercentage,
        },

        recent_tasks:
          recentTasks,

        activity_log:
          activityLog,

        weekly_attendance:
          weeklyAttendance,
      },
    });
  } catch (error) {
    console.error(
      "Employee overview error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to load employee overview.",

      error:
        error.message,
    });
  }
};

module.exports = {
  getEmployeeOverview,
};
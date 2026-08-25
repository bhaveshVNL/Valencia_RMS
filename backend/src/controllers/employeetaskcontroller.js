const db = require("../config/db");

/*
========================================================
EMPLOYEE TASK WORKING TIME
========================================================
*/

const WORK_START_TIME = "11:00:00";
const WORK_END_TIME = "19:30:00";

const INDIA_NOW_SQL =
  "CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+05:30')";

const FIXED_COMPANY_HOLIDAYS_2026 = new Set([
  "2026-01-26",
  "2026-05-01",
  "2026-08-15",
  "2026-10-02",
]);

/*
========================================================
GENERAL HELPERS
========================================================
*/

const getLoggedInUserId = (req) => {
  return Number(
    req.user?.user_id ||
      req.user?.id ||
      req.userId ||
      0
  );
};

const normalizeStatus = (status) => {
  const value = String(status || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (
    [
      "",
      "todo",
      "to_do",
      "pending",
      "not_started",
    ].includes(value)
  ) {
    return "not_started";
  }

  if (
    [
      "ongoing",
      "in_progress",
      "progress",
    ].includes(value)
  ) {
    return "ongoing";
  }

  if (
    [
      "under_review",
      "review",
      "pending_review",
    ].includes(value)
  ) {
    return "under_review";
  }

  if (
    [
      "completed",
      "done",
      "complete",
    ].includes(value)
  ) {
    return "completed";
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

  return value || "not_started";
};

const isMainTaskLocked = (status) => {
  return [
    "under_review",
    "completed",
    "rejected",
    "on_hold",
  ].includes(normalizeStatus(status));
};

const isProjectLocked = (status) => {
  return [
    "under_review",
    "completed",
    "rejected",
    "on_hold",
  ].includes(normalizeStatus(status));
};

/*
========================================================
INDIA CLOCK / WORK PERMISSION
========================================================
*/

const getIndiaClock = async () => {
  const [rows] = await db.query(
    `
    SELECT
      DATE_FORMAT(
        ${INDIA_NOW_SQL},
        '%Y-%m-%d'
      ) AS india_date,

      DATE_FORMAT(
        ${INDIA_NOW_SQL},
        '%H:%i:%s'
      ) AS india_time,

      DAYOFWEEK(
        ${INDIA_NOW_SQL}
      ) AS day_of_week
    `
  );

  return {
    date: rows[0]?.india_date,
    time: rows[0]?.india_time,
    dayOfWeek: Number(
      rows[0]?.day_of_week || 0
    ),
  };
};

const getEmployeeWorkPermission = async (
  employeeId
) => {
  const clock = await getIndiaClock();

  /*
  Sunday
  */
  if (clock.dayOfWeek === 1) {
    return {
      allowed: false,
      message:
        "Task timer cannot be started on Sunday. Sunday is a weekly holiday.",
    };
  }

  /*
  Fixed company holiday
  */
  if (
    FIXED_COMPANY_HOLIDAYS_2026.has(
      clock.date
    )
  ) {
    return {
      allowed: false,
      message:
        "Task timer cannot be started today because today is a company holiday.",
    };
  }

  /*
  Employee optional holiday
  */
  const [optionalHolidayRows] =
    await db.query(
      `
      SELECT
        selection_id,
        holiday_name

      FROM employee_optional_holidays

      WHERE
        employee_id = ?
        AND holiday_date = ?

      LIMIT 1
      `,
      [
        employeeId,
        clock.date,
      ]
    );

  if (optionalHolidayRows.length) {
    return {
      allowed: false,
      message:
        `Task timer cannot be started today because you selected ${
          optionalHolidayRows[0]
            .holiday_name || "today"
        } as a holiday.`,
    };
  }

  if (
    clock.time < WORK_START_TIME
  ) {
    return {
      allowed: false,
      message:
        "Task timer can only be started from 11:00 AM onwards.",
    };
  }

  if (
    clock.time >= WORK_END_TIME
  ) {
    return {
      allowed: false,
      message:
        "Task timer cannot be started after 7:30 PM.",
    };
  }

  return {
    allowed: true,
    date: clock.date,
    time: clock.time,
  };
};

/*
========================================================
CLOSE EXPIRED EMPLOYEE SESSIONS
========================================================
*/

const closeExpiredOpenSessions = async (
  employeeId
) => {
  /*
  Sessions started on non-working day
  become zero duration.
  */

  await db.query(
    `
    UPDATE task_work_sessions tws

    SET
      tws.ended_at =
        tws.started_at,

      tws.end_reason =
        'paused'

    WHERE
      tws.employee_id = ?

      AND tws.ended_at
          IS NULL

      AND (
        DAYOFWEEK(
          tws.started_at
        ) = 1

        OR DATE(
          tws.started_at
        ) IN (
          '2026-01-26',
          '2026-05-01',
          '2026-08-15',
          '2026-10-02'
        )

        OR EXISTS (
          SELECT 1

          FROM employee_optional_holidays eoh

          WHERE
            eoh.employee_id =
              tws.employee_id

            AND eoh.holiday_date =
              DATE(
                tws.started_at
              )
        )
      )
    `,
    [employeeId]
  );

  /*
  Forgotten previous-day sessions
  close at 7:30 PM.
  */

  await db.query(
    `
    UPDATE task_work_sessions

    SET
      ended_at =
        GREATEST(
          started_at,

          TIMESTAMP(
            DATE(started_at),
            '${WORK_END_TIME}'
          )
        ),

      end_reason =
        'paused'

    WHERE
      employee_id = ?

      AND ended_at
          IS NULL

      AND (
        DATE(started_at) <
          DATE(
            ${INDIA_NOW_SQL}
          )

        OR (
          DATE(started_at) =
            DATE(
              ${INDIA_NOW_SQL}
            )

          AND TIME(
            ${INDIA_NOW_SQL}
          ) >=
            '${WORK_END_TIME}'
        )
      )
    `,
    [employeeId]
  );
};

/*
========================================================
CLOSE ALL RUNNING SESSIONS FOR A SHARED MAIN TASK

Important for multiple employees.

If shared Main Task becomes Under Review,
no employee timer should remain running.
========================================================
*/

const closeOpenSessionsForTask = async (
  connection,
  taskId,
  reason = "submitted_for_review"
) => {
  await connection.query(
    `
    UPDATE task_work_sessions

    SET
      ended_at =
        GREATEST(
          started_at,

          LEAST(
            ${INDIA_NOW_SQL},

            TIMESTAMP(
              DATE(started_at),
              '${WORK_END_TIME}'
            )
          )
        ),

      end_reason = ?

    WHERE
      task_id = ?

      AND ended_at
          IS NULL
    `,
    [
      reason,
      taskId,
    ]
  );
};

/*
========================================================
MAIN TASK ACCESS

Employee ownership is now determined through:

task_assignments

NOT tasks.assigned_to_user_id.

assigned_to_user_id remains legacy/primary employee only.
========================================================
*/

const getAssignedMainTask = async (
  connection,
  taskId,
  employeeId
) => {
  const [rows] =
    await connection.query(
      `
      SELECT
        t.task_id,
        t.project_id,
        t.parent_task_id,

        t.created_by_user_id,
        t.assigned_to_user_id,

        t.task_title,
        t.task_description,
        t.task_type,

        t.status,
        t.priority,

        COALESCE(
          t.progress,
          0
        ) AS progress,

        COALESCE(
          t.is_checked,
          0
        ) AS is_checked,

        DATE_FORMAT(
          t.start_date,
          '%Y-%m-%d'
        ) AS start_date,

        DATE_FORMAT(
          t.due_date,
          '%Y-%m-%d'
        ) AS due_date,

        t.review_status,
        t.reviewed_by_user_id,
        t.reviewed_at,
        t.review_note,
        t.rejection_remark,

        ta.assigned_at,

        p.project_title,
        p.project_description,
        p.status AS project_status,

        DATE_FORMAT(
          p.start_date,
          '%Y-%m-%d'
        ) AS project_start_date,

        DATE_FORMAT(
          p.due_date,
          '%Y-%m-%d'
        ) AS project_due_date,

        creator.full_name
          AS created_by_name,

        creator.email
          AS created_by_email

      FROM tasks t

      INNER JOIN task_assignments ta
        ON ta.task_id =
           t.task_id

      INNER JOIN projects p
        ON p.project_id =
           t.project_id

      LEFT JOIN users creator
        ON creator.user_id =
           t.created_by_user_id

      WHERE
        t.task_id = ?

        AND ta.employee_id = ?

        AND (
          t.parent_task_id IS NULL
          OR t.parent_task_id = 0
        )

      LIMIT 1
      `,
      [
        taskId,
        employeeId,
      ]
    );

  return rows[0] || null;
};

/*
========================================================
MAIN TASK ASSIGNEES
========================================================
*/

const getMainTaskAssignees = async (
  connection,
  taskId
) => {
  const [rows] =
    await connection.query(
      `
      SELECT
        ta.employee_id,
        ta.assigned_at,

        u.full_name,
        u.email,
        u.employee_code,
        u.designation,

        d.department_name

      FROM task_assignments ta

      INNER JOIN users u
        ON u.user_id =
           ta.employee_id

      LEFT JOIN departments d
        ON d.department_id =
           u.department_id

      WHERE
        ta.task_id = ?

      ORDER BY
        u.full_name ASC
      `,
      [taskId]
    );

  return rows;
};

/*
========================================================
SHARED SUBTASKS

No employee filter.

Every employee assigned to parent Main Task
sees the SAME Subtasks.
========================================================
*/

const getSharedSubtasks = async (
  connection,
  mainTaskId
) => {
  const [rows] =
    await connection.query(
      `
      SELECT
        st.task_id,
        st.task_id AS subtask_id,

        st.parent_task_id,
        st.project_id,

        st.created_by_user_id,
        st.assigned_to_user_id,

        st.task_title,
        st.task_description,

        st.status,
        st.priority,

        COALESCE(
          st.progress,
          0
        ) AS progress,

        COALESCE(
          st.is_checked,
          0
        ) AS is_checked,

        DATE_FORMAT(
          st.start_date,
          '%Y-%m-%d'
        ) AS start_date,

        DATE_FORMAT(
          st.due_date,
          '%Y-%m-%d'
        ) AS due_date,

        st.completed_at,
        st.created_at,
        st.updated_at,

        creator.full_name
          AS created_by_name,

        creator.email
          AS created_by_email

      FROM tasks st

      LEFT JOIN users creator
        ON creator.user_id =
           st.created_by_user_id

      WHERE
        st.parent_task_id = ?

      ORDER BY
        st.start_date ASC,
        st.task_id ASC
      `,
      [mainTaskId]
    );

  return rows.map(
    (subtask) => ({
      ...subtask,

      status:
        normalizeStatus(
          subtask.status
        ),

      progress:
        Number(
          subtask.progress ||
            0
        ),

      is_checked:
        Number(
          subtask.is_checked ||
            0
        ),
    })
  );
};

/*
========================================================
RECALCULATE MAIN TASK

Rules:

Some subtasks done
-> progress updates

ALL subtasks done
-> Main Task automatically Under Review

This is the shared Main Task, so every assigned
employee sees the same result.
========================================================
*/

const recalculateMainTask = async (
  connection,
  mainTaskId
) => {
  const [summaryRows] =
    await connection.query(
      `
      SELECT
        COUNT(*) AS total_subtasks,

        SUM(
          CASE
            WHEN
              COALESCE(
                is_checked,
                0
              ) = 1

              OR LOWER(
                REPLACE(
                  COALESCE(
                    status,
                    ''
                  ),
                  ' ',
                  '_'
                )
              ) IN (
                'completed',
                'done',
                'complete'
              )

            THEN 1
            ELSE 0
          END
        ) AS completed_subtasks

      FROM tasks

      WHERE
        parent_task_id = ?
      `,
      [mainTaskId]
    );

  const totalSubtasks =
    Number(
      summaryRows[0]
        ?.total_subtasks || 0
    );

  const completedSubtasks =
    Number(
      summaryRows[0]
        ?.completed_subtasks || 0
    );

  const progress =
    totalSubtasks > 0
      ? Math.round(
          (
            completedSubtasks /
            totalSubtasks
          ) * 100
        )
      : 0;

  const [mainTaskRows] =
    await connection.query(
      `
      SELECT
        task_id,
        project_id,
        status,
        review_status

      FROM tasks

      WHERE
        task_id = ?

      LIMIT 1
      `,
      [mainTaskId]
    );

  if (!mainTaskRows.length) {
    return {
      totalSubtasks,
      completedSubtasks,
      progress,
      status: "not_started",
    };
  }

  const mainTask =
    mainTaskRows[0];

  const currentStatus =
    normalizeStatus(
      mainTask.status
    );

  /*
  Admin-controlled final states remain untouched.
  */

  if (
    [
      "completed",
      "rejected",
      "on_hold",
    ].includes(currentStatus)
  ) {
    await connection.query(
      `
      UPDATE tasks

      SET
        progress = ?,
        updated_at = NOW()

      WHERE
        task_id = ?
      `,
      [
        progress,
        mainTaskId,
      ]
    );

    return {
      totalSubtasks,
      completedSubtasks,
      progress,
      status:
        currentStatus,
      projectId:
        mainTask.project_id,
    };
  }

  let nextStatus =
    currentStatus;

  let nextReviewStatus =
    mainTask.review_status ||
    "none";

 /*
========================================================
SUBTASK COMPLETION

Completing Subtasks only updates progress.

The Main Task remains In Progress until the
employee explicitly clicks Submit Review.

Time tracking therefore remains controlled by:
Start -> Pause -> Resume -> Submit Review.
========================================================
*/

  await connection.query(
    `
    UPDATE tasks

    SET
      status = ?,
      progress = ?,
      review_status = ?,
      updated_at = NOW()

    WHERE
      task_id = ?
    `,
    [
      nextStatus,
      progress,
      nextReviewStatus,
      mainTaskId,
    ]
  );

  /*
  Once task goes Under Review,
  close timers for EVERY assigned employee.
  */

  if (
    nextStatus === "under_review" &&
    currentStatus !== "under_review"
  ) {
    await closeOpenSessionsForTask(
      connection,
      mainTaskId,
      "submitted_for_review"
    );
  }

  return {
    totalSubtasks,
    completedSubtasks,
    progress,
    status:
      nextStatus,
    projectId:
      mainTask.project_id,
  };
};

/*
========================================================
RECALCULATE PROJECT

Project rules:

All Main Tasks untouched
-> Project To Do

Any Main Task starts
-> Project In Progress

Every Main Task Under Review / Completed
-> Project Under Review

Admin final Project states are not overridden.
========================================================
*/

const recalculateProject = async (
  connection,
  projectId
) => {
  const [projectRows] =
    await connection.query(
      `
      SELECT
        project_id,
        status

      FROM projects

      WHERE
        project_id = ?

      LIMIT 1
      `,
      [projectId]
    );

  if (!projectRows.length) {
    return null;
  }

  const currentProjectStatus =
    normalizeStatus(
      projectRows[0].status
    );

  const [mainTasks] =
    await connection.query(
      `
      SELECT
        task_id,
        status,

        COALESCE(
          progress,
          0
        ) AS progress

      FROM tasks

      WHERE
        project_id = ?

        AND (
          parent_task_id IS NULL
          OR parent_task_id = 0
        )
      `,
      [projectId]
    );

  if (!mainTasks.length) {
    await connection.query(
      `
      UPDATE projects

      SET
        overall_progress = 0,
        updated_at = NOW()

      WHERE
        project_id = ?
      `,
      [projectId]
    );

    return {
      status:
        currentProjectStatus,
      progress: 0,
    };
  }

  const overallProgress =
    Math.round(
      mainTasks.reduce(
        (total, task) =>
          total +
          Number(
            task.progress || 0
          ),
        0
      ) / mainTasks.length
    );

  /*
  Do not override final project states.
  */

  if (
    [
      "completed",
      "rejected",
      "on_hold",
    ].includes(
      currentProjectStatus
    )
  ) {
    await connection.query(
      `
      UPDATE projects

      SET
        overall_progress = ?,
        updated_at = NOW()

      WHERE
        project_id = ?
      `,
      [
        overallProgress,
        projectId,
      ]
    );

    return {
      status:
        currentProjectStatus,
      progress:
        overallProgress,
    };
  }

  const statuses =
    mainTasks.map(
      (task) =>
        normalizeStatus(
          task.status
        )
    );

  /*
  Project becomes Under Review only when
  EVERY Main Task is ready.
  */

  const allReadyForReview =
    statuses.every(
      (status) =>
        [
          "under_review",
          "completed",
        ].includes(status)
    );

  const anyStarted =
  statuses.some(
    (status) =>
      status !== "not_started"
  );

  let nextProjectStatus =
    "not_started";

  if (allReadyForReview) {
    nextProjectStatus =
      "under_review";
  } else if (anyStarted) {
    nextProjectStatus =
      "ongoing";
  }

  await connection.query(
    `
    UPDATE projects

    SET
      status = ?,
      overall_progress = ?,
      updated_at = NOW()

    WHERE
      project_id = ?
    `,
    [
      nextProjectStatus,
      overallProgress,
      projectId,
    ]
  );

  return {
    status:
      nextProjectStatus,
    progress:
      overallProgress,
  };
};

/*
========================================================
GET EMPLOYEE MAIN TASKS

IMPORTANT FIX:

OLD CODE:
parent_task_id IS NOT NULL
= fetched Subtasks.

NEW CODE:
parent_task_id IS NULL
+ task_assignments
= actual Admin-created Main Tasks.
========================================================
*/

const getEmployeeTasks = async (
  req,
  res
) => {
  try {
    const userId =
      getLoggedInUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "User not found.",
      });
    }

    await closeExpiredOpenSessions(
      userId
    );

    const [mainTasks] =
      await db.query(
        `
        SELECT DISTINCT
          mt.task_id,
          mt.parent_task_id,
          mt.project_id,

          mt.created_by_user_id,
          mt.assigned_to_user_id,

          mt.task_title,
          mt.task_description,
          mt.task_type,

          mt.status,
          mt.priority,

          COALESCE(
            mt.progress,
            0
          ) AS progress,

          COALESCE(
            mt.is_checked,
            0
          ) AS is_checked,

          DATE_FORMAT(
            mt.start_date,
            '%Y-%m-%d'
          ) AS start_date,

          DATE_FORMAT(
            mt.due_date,
            '%Y-%m-%d'
          ) AS due_date,

          mt.review_status,
          mt.reviewed_by_user_id,
          mt.reviewed_at,
          mt.review_note,
          mt.rejection_remark,

          mt.created_at,
          mt.updated_at,

          ta.assigned_at,

          p.project_title,
          p.project_description,
          p.status
            AS project_status,

          DATE_FORMAT(
            p.start_date,
            '%Y-%m-%d'
          ) AS project_start_date,

          DATE_FORMAT(
            p.due_date,
            '%Y-%m-%d'
          ) AS project_due_date,

          creator.full_name
            AS created_by_name,

          creator.email
            AS created_by_email

        FROM tasks mt

        INNER JOIN task_assignments ta
          ON ta.task_id =
             mt.task_id

        LEFT JOIN projects p
          ON p.project_id =
             mt.project_id

        LEFT JOIN users creator
          ON creator.user_id =
             mt.created_by_user_id

        WHERE
          ta.employee_id = ?

          AND (
            mt.parent_task_id IS NULL
            OR mt.parent_task_id = 0
          )

        ORDER BY
          mt.task_id DESC
        `,
        [userId]
      );

    if (!mainTasks.length) {
      return res.json({
        success: true,
        main_tasks: [],
        tasks: [],
        data: {
          main_tasks: [],
          tasks: [],
        },
      });
    }

    const mainTaskIds =
      mainTasks.map(
        (task) =>
          Number(
            task.task_id
          )
      );

    /*
    Shared Subtasks
    */

    const [subtaskRows] =
      await db.query(
        `
        SELECT
          st.task_id,
          st.parent_task_id,
          st.project_id,

          st.created_by_user_id,
          st.assigned_to_user_id,

          st.task_title,
          st.task_description,

          st.status,
          st.priority,

          COALESCE(
            st.progress,
            0
          ) AS progress,

          COALESCE(
            st.is_checked,
            0
          ) AS is_checked,

          DATE_FORMAT(
            st.start_date,
            '%Y-%m-%d'
          ) AS start_date,

          DATE_FORMAT(
            st.due_date,
            '%Y-%m-%d'
          ) AS due_date,

          st.completed_at,
          st.created_at,
          st.updated_at,

          creator.full_name
            AS created_by_name,

          creator.email
            AS created_by_email

        FROM tasks st

        LEFT JOIN users creator
          ON creator.user_id =
             st.created_by_user_id

        WHERE
          st.parent_task_id IN (?)

        ORDER BY
          st.start_date ASC,
          st.task_id ASC
        `,
        [mainTaskIds]
      );

    /*
    All employees assigned to Main Tasks.
    */

    const [assignmentRows] =
      await db.query(
        `
        SELECT
          ta.task_id,
          ta.employee_id,
          ta.assigned_at,

          u.full_name,
          u.email,
          u.employee_code,
          u.designation

        FROM task_assignments ta

        INNER JOIN users u
          ON u.user_id =
             ta.employee_id

        WHERE
          ta.task_id IN (?)

        ORDER BY
          u.full_name ASC
        `,
        [mainTaskIds]
      );

    /*
    Current employee running sessions.
    */

    const [runningSessions] =
      await db.query(
        `
        SELECT
          task_id

        FROM task_work_sessions

        WHERE
          employee_id = ?

          AND ended_at
              IS NULL
        `,
        [userId]
      );

    const runningTaskIds =
      new Set(
        runningSessions.map(
          (row) =>
            Number(
              row.task_id
            )
        )
      );

    const subtasksByTask =
      new Map();

    for (
      const subtask
      of subtaskRows
    ) {
      const parentTaskId =
        Number(
          subtask.parent_task_id
        );

      if (
        !subtasksByTask.has(
          parentTaskId
        )
      ) {
        subtasksByTask.set(
          parentTaskId,
          []
        );
      }

      subtasksByTask
        .get(parentTaskId)
        .push({
          ...subtask,

          status:
            normalizeStatus(
              subtask.status
            ),

          progress:
            Number(
              subtask.progress ||
                0
            ),

          is_checked:
            Number(
              subtask.is_checked ||
                0
            ),
        });
    }

    const assigneesByTask =
      new Map();

    for (
      const assignment
      of assignmentRows
    ) {
      const taskId =
        Number(
          assignment.task_id
        );

      if (
        !assigneesByTask.has(
          taskId
        )
      ) {
        assigneesByTask.set(
          taskId,
          []
        );
      }

      assigneesByTask
        .get(taskId)
        .push({
          user_id:
            assignment.employee_id,

          employee_id:
            assignment.employee_id,

          full_name:
            assignment.full_name,

          email:
            assignment.email,

          employee_code:
            assignment.employee_code,

          designation:
            assignment.designation,

          assigned_at:
            assignment.assigned_at,
        });
    }

    const formattedTasks =
      mainTasks.map(
        (task) => {
          const taskId =
            Number(
              task.task_id
            );

          const subtasks =
            subtasksByTask.get(
              taskId
            ) || [];

          const assignees =
            assigneesByTask.get(
              taskId
            ) || [];

          const totalSubtasks =
            subtasks.length;

          const completedSubtasks =
            subtasks.filter(
              (subtask) =>
                Number(
                  subtask.is_checked ||
                    0
                ) === 1 ||
                normalizeStatus(
                  subtask.status
                ) ===
                  "completed"
            ).length;

          const calculatedProgress =
            totalSubtasks > 0
              ? Math.round(
                  (
                    completedSubtasks /
                    totalSubtasks
                  ) * 100
                )
              : Number(
                  task.progress || 0
                );

          const status =
            normalizeStatus(
              task.status
            );

          return {
            ...task,

            status,

            progress:
              calculatedProgress,

            total_subtasks:
              totalSubtasks,

            completed_subtasks:
              completedSubtasks,

            subtasks,

            assignees,

            assigned_names:
              assignees
                .map(
                  (employee) =>
                    employee.full_name
                )
                .filter(Boolean)
                .join(", "),

            assigned_emails:
              assignees
                .map(
                  (employee) =>
                    employee.email
                )
                .filter(Boolean)
                .join(", "),

            work_state:
              status === "ongoing"
                ? runningTaskIds.has(
                    taskId
                  )
                  ? "running"
                  : "paused"
                : "stopped",
          };
        }
      );

    return res.json({
      success: true,

      main_tasks:
        formattedTasks,

      tasks:
        formattedTasks,

      data: {
        main_tasks:
          formattedTasks,

        tasks:
          formattedTasks,
      },
    });
  } catch (error) {
    console.error(
      "Get employee tasks error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch assigned Main Tasks.",
      error:
        error.message,
      sqlMessage:
        error.sqlMessage || null,
    });
  }
};

/*
========================================================
GET ONE MAIN TASK DETAILS
========================================================
*/

const getEmployeeTaskDetails = async (
  req,
  res
) => {
  try {
    const userId =
      getLoggedInUserId(req);

    const taskId =
      Number(
        req.params.taskId
      );

    await closeExpiredOpenSessions(
      userId
    );

    const task =
      await getAssignedMainTask(
        db,
        taskId,
        userId
      );

    if (!task) {
      return res.status(404).json({
        success: false,
        message:
          "Main Task not found or is not assigned to you.",
      });
    }

    const subtasks =
      await getSharedSubtasks(
        db,
        taskId
      );

    const assignees =
      await getMainTaskAssignees(
        db,
        taskId
      );

    const [runningRows] =
      await db.query(
        `
        SELECT
          session_id

        FROM task_work_sessions

        WHERE
          task_id = ?

          AND employee_id = ?

          AND ended_at
              IS NULL

        LIMIT 1
        `,
        [
          taskId,
          userId,
        ]
      );

    const totalSubtasks =
      subtasks.length;

    const completedSubtasks =
      subtasks.filter(
        (subtask) =>
          Number(
            subtask.is_checked ||
              0
          ) === 1 ||
          normalizeStatus(
            subtask.status
          ) ===
            "completed"
      ).length;

    const calculatedProgress =
      totalSubtasks > 0
        ? Math.round(
            (
              completedSubtasks /
              totalSubtasks
            ) * 100
          )
        : Number(
            task.progress || 0
          );

    const status =
      normalizeStatus(
        task.status
      );

    const formattedTask = {
      ...task,

      status,

      progress:
        calculatedProgress,

      total_subtasks:
        totalSubtasks,

      completed_subtasks:
        completedSubtasks,

      subtasks,

      assignees,

      assigned_names:
        assignees
          .map(
            (employee) =>
              employee.full_name
          )
          .filter(Boolean)
          .join(", "),

      assigned_emails:
        assignees
          .map(
            (employee) =>
              employee.email
          )
          .filter(Boolean)
          .join(", "),

      work_state:
        status === "ongoing"
          ? runningRows.length
            ? "running"
            : "paused"
          : "stopped",
    };

    return res.json({
      success: true,

      task:
        formattedTask,

      main_task:
        formattedTask,

      data: {
        task:
          formattedTask,

        main_task:
          formattedTask,
      },
    });
  } catch (error) {
    console.error(
      "Get employee task details error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch Main Task details.",
      error:
        error.message,
      sqlMessage:
        error.sqlMessage || null,
    });
  }
};

/*
========================================================
ADD SHARED SUBTASK

Employee cannot create Main Task.

Employee can only create Subtask under
an Admin-created Main Task assigned via task_assignments.
========================================================
*/

const addEmployeeSubtask = async (
  req,
  res
) => {
  const connection =
    await db.getConnection();

  try {
    const userId =
      getLoggedInUserId(req);

    const mainTaskId =
      Number(
        req.params.taskId
      );

    const title =
      String(
        req.body.task_title ||
          req.body.subtask_title ||
          req.body.title ||
          ""
      ).trim();

    const description =
      String(
        req.body.task_description ||
          req.body.subtask_description ||
          req.body.description ||
          ""
      ).trim();

    const startDate =
      req.body.start_date ||
      null;

    const dueDate =
      req.body.due_date ||
      req.body.end_date ||
      null;

    if (!title) {
      return res.status(400).json({
        success: false,
        message:
          "Subtask title is required.",
      });
    }

    if (
      !startDate ||
      !dueDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Subtask start date and deadline are required.",
      });
    }

    if (
      startDate > dueDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Subtask start date cannot be after its deadline.",
      });
    }

    await connection.beginTransaction();

    const mainTask =
      await getAssignedMainTask(
        connection,
        mainTaskId,
        userId
      );

    if (!mainTask) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          "Main Task not found or is not assigned to you.",
      });
    }

    const mainTaskStatus =
      normalizeStatus(
        mainTask.status
      );

    /*
    Under Review / Done / Rejected / On Hold
    = Add Subtask not allowed.
    */

    if (
      isMainTaskLocked(
        mainTaskStatus
      )
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          "Subtasks cannot be added while this Main Task is under review or locked.",
      });
    }

    if (
      isProjectLocked(
        mainTask.project_status
      )
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          "This Project is currently locked.",
      });
    }

    /*
    Subtask dates must stay inside Main Task dates.
    */

    if (
      mainTask.start_date &&
      startDate <
        mainTask.start_date
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          `Subtask start date cannot be before Main Task start date (${mainTask.start_date}).`,
      });
    }

    if (
      mainTask.due_date &&
      dueDate >
        mainTask.due_date
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          `Subtask deadline cannot exceed Main Task deadline (${mainTask.due_date}).`,
      });
    }

    /*
    ONE shared Subtask row.

    parent_task_id = shared Main Task ID.
    */

    const [result] =
      await connection.query(
        `
        INSERT INTO tasks (
          project_id,
          parent_task_id,

          created_by_user_id,
          assigned_to_user_id,

          task_title,
          task_description,

          task_type,
          status,
          priority,

          progress,
          is_checked,

          start_date,
          due_date,

          review_status,

          created_at,
          updated_at
        )
        VALUES (
          ?,
          ?,

          ?,
          ?,

          ?,
          ?,

          'subtask',
          'not_started',
          'medium',

          0,
          0,

          ?,
          ?,

          'none',

          NOW(),
          NOW()
        )
        `,
        [
          mainTask.project_id,
          mainTaskId,

          userId,
          userId,

          title,
          description,

          startDate,
          dueDate,
        ]
      );



    const recalculated =
      await recalculateMainTask(
        connection,
        mainTaskId
      );

    const projectResult =
      await recalculateProject(
        connection,
        mainTask.project_id
      );

    await connection.commit();

    const subtasks =
      await getSharedSubtasks(
        db,
        mainTaskId
      );

    return res.status(201).json({
      success: true,

      message:
        "Subtask added successfully.",

      subtask_id:
        result.insertId,

      main_task_id:
        mainTaskId,

      main_task_status:
        recalculated.status,

      project_status:
        projectResult?.status,

      subtasks,
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    console.error(
      "Add employee Subtask error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to add Subtask.",
      error:
        error.message,
      sqlMessage:
        error.sqlMessage || null,
    });
  } finally {
    connection.release();
  }
};

/*
========================================================
MARK SHARED SUBTASK DONE

Any employee assigned to parent Main Task can do this.

The Subtask may have been created by Employee A,
but Employee B still sees and can complete it.
========================================================
*/

const markEmployeeSubtaskDone = async (
  req,
  res
) => {
  const connection =
    await db.getConnection();

  try {
    const userId =
      getLoggedInUserId(req);

    const subtaskId =
      Number(
        req.params.subtaskId
      );

    await connection.beginTransaction();

    const [rows] =
      await connection.query(
        `
        SELECT
          st.task_id,
          st.parent_task_id,
          st.project_id,
          st.status,
          st.is_checked,

          mt.status
            AS main_task_status,

          p.status
            AS project_status

        FROM tasks st

        INNER JOIN tasks mt
          ON mt.task_id =
             st.parent_task_id

        INNER JOIN task_assignments ta
          ON ta.task_id =
             mt.task_id

        INNER JOIN projects p
          ON p.project_id =
             mt.project_id

        WHERE
          st.task_id = ?

          AND ta.employee_id = ?

        LIMIT 1
        `,
        [
          subtaskId,
          userId,
        ]
      );

    if (!rows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          "Subtask not found or its Main Task is not assigned to you.",
      });
    }

    const subtask =
      rows[0];

    if (
      isMainTaskLocked(
        subtask.main_task_status
      )
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          "Subtasks cannot be changed while the Main Task is under review or locked.",
      });
    }

    if (
      isProjectLocked(
        subtask.project_status
      )
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          "This Project is currently locked.",
      });
    }

    if (
      Number(
        subtask.is_checked ||
          0
      ) === 1 ||
      normalizeStatus(
        subtask.status
      ) === "completed"
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          "This Subtask is already completed.",
      });
    }

    await connection.query(
      `
      UPDATE tasks

      SET
        is_checked = 1,
        status = 'completed',
        progress = 100,
        completed_at = NOW(),
        updated_at = NOW()

      WHERE
        task_id = ?
      `,
      [subtaskId]
    );

    const recalculated =
      await recalculateMainTask(
        connection,
        subtask.parent_task_id
      );

    const projectResult =
      await recalculateProject(
        connection,
        subtask.project_id
      );

    await connection.commit();

    const subtasks =
      await getSharedSubtasks(
        db,
        subtask.parent_task_id
      );

    return res.json({
      success: true,

      message:
        recalculated.status ===
        "under_review"
          ? "All Subtasks are complete. Main Task moved to Under Review."
          : "Subtask marked as Done.",

      main_task_id:
        subtask.parent_task_id,

      main_task_status:
        recalculated.status,

      main_task_progress:
        recalculated.progress,

      project_status:
        projectResult?.status,

      subtasks,
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    console.error(
      "Mark Subtask Done error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update Subtask.",
      error:
        error.message,
      sqlMessage:
        error.sqlMessage || null,
    });
  } finally {
    connection.release();
  }
};

/*
========================================================
START MAIN TASK

Main Task:
To Do -> In Progress
========================================================
*/

const startEmployeeTask = async (
  req,
  res
) => {
  const connection =
    await db.getConnection();

  try {
    const userId =
      getLoggedInUserId(req);

    const taskId =
      Number(
        req.params.taskId
      );

    const task =
      await getAssignedMainTask(
        connection,
        taskId,
        userId
      );

    if (!task) {
      return res.status(404).json({
        success: false,
        message:
          "Main Task not found or is not assigned to you.",
      });
    }

    const status =
      normalizeStatus(
        task.status
      );

    if (
      status !==
      "not_started"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Only To Do tasks can be started.",
      });
    }

    if (
      isProjectLocked(
        task.project_status
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This Project is currently locked.",
      });
    }

    await closeExpiredOpenSessions(
      userId
    );

    const workPermission =
      await getEmployeeWorkPermission(
        userId
      );

    if (
      !workPermission.allowed
    ) {
      return res.status(400).json({
        success: false,
        message:
          workPermission.message,
      });
    }

    /*
    Employee can run only one Main Task at a time.
    */

    const [runningRows] =
      await db.query(
        `
        SELECT
          session_id,
          task_id

        FROM task_work_sessions

        WHERE
          employee_id = ?

          AND ended_at
              IS NULL

        LIMIT 1
        `,
        [userId]
      );

    if (runningRows.length) {
      return res.status(400).json({
        success: false,
        message:
          "Another task is currently running. Pause it before starting this task.",
      });
    }

    await connection.beginTransaction();

    await connection.query(
      `
      INSERT INTO task_work_sessions (
        task_id,
        employee_id,
        started_at
      )
      VALUES (
        ?,
        ?,
        ${INDIA_NOW_SQL}
      )
      `,
      [
        taskId,
        userId,
      ]
    );

    await connection.query(
      `
      UPDATE tasks

      SET
        status = 'ongoing',
        review_status = 'none',
        updated_at = NOW()

      WHERE
        task_id = ?
      `,
      [taskId]
    );

    const projectResult =
      await recalculateProject(
        connection,
        task.project_id
      );

    await connection.commit();

    return res.json({
      success: true,
      message:
        "Task started.",
      work_state:
        "running",
      status:
        "ongoing",
      project_status:
        projectResult?.status,
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    console.error(
      "Start employee task error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to start task.",
      error:
        error.message,
    });
  } finally {
    connection.release();
  }
};

/*
========================================================
PAUSE MAIN TASK
========================================================
*/

const pauseEmployeeTask = async (
  req,
  res
) => {
  try {
    const userId =
      getLoggedInUserId(req);

    const taskId =
      Number(
        req.params.taskId
      );

    const task =
      await getAssignedMainTask(
        db,
        taskId,
        userId
      );

    if (!task) {
      return res.status(404).json({
        success: false,
        message:
          "Main Task not found or is not assigned to you.",
      });
    }

    if (
      normalizeStatus(
        task.status
      ) !== "ongoing"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Only an In Progress task can be paused.",
      });
    }

    await closeExpiredOpenSessions(
      userId
    );

    const [runningRows] =
      await db.query(
        `
        SELECT
          session_id

        FROM task_work_sessions

        WHERE
          task_id = ?

          AND employee_id = ?

          AND ended_at
              IS NULL

        ORDER BY
          session_id DESC

        LIMIT 1
        `,
        [
          taskId,
          userId,
        ]
      );

    if (!runningRows.length) {
      return res.status(400).json({
        success: false,
        message:
          "This task is already paused.",
      });
    }

    await db.query(
      `
      UPDATE task_work_sessions

      SET
        ended_at =
          GREATEST(
            started_at,

            LEAST(
              ${INDIA_NOW_SQL},

              TIMESTAMP(
                DATE(started_at),
                '${WORK_END_TIME}'
              )
            )
          ),

        end_reason =
          'paused'

      WHERE
        session_id = ?
      `,
      [
        runningRows[0]
          .session_id,
      ]
    );

    return res.json({
      success: true,
      message:
        "Task paused.",
      status:
        "ongoing",
      work_state:
        "paused",
    });
  } catch (error) {
    console.error(
      "Pause employee task error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to pause task.",
      error:
        error.message,
    });
  }
};

/*
========================================================
RESUME MAIN TASK
========================================================
*/

const resumeEmployeeTask = async (
  req,
  res
) => {
  try {
    const userId =
      getLoggedInUserId(req);

    const taskId =
      Number(
        req.params.taskId
      );

    const task =
      await getAssignedMainTask(
        db,
        taskId,
        userId
      );

    if (!task) {
      return res.status(404).json({
        success: false,
        message:
          "Main Task not found or is not assigned to you.",
      });
    }

    if (
      normalizeStatus(
        task.status
      ) !== "ongoing"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Only an In Progress task can be resumed.",
      });
    }

    if (
      isProjectLocked(
        task.project_status
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This Project is currently locked.",
      });
    }

    await closeExpiredOpenSessions(
      userId
    );

    const workPermission =
      await getEmployeeWorkPermission(
        userId
      );

    if (
      !workPermission.allowed
    ) {
      return res.status(400).json({
        success: false,
        message:
          workPermission.message,
      });
    }

    const [sameTaskRunning] =
      await db.query(
        `
        SELECT
          session_id

        FROM task_work_sessions

        WHERE
          task_id = ?

          AND employee_id = ?

          AND ended_at
              IS NULL

        LIMIT 1
        `,
        [
          taskId,
          userId,
        ]
      );

    if (
      sameTaskRunning.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This task is already running.",
      });
    }

    const [otherRunning] =
      await db.query(
        `
        SELECT
          session_id,
          task_id

        FROM task_work_sessions

        WHERE
          employee_id = ?

          AND ended_at
              IS NULL

        LIMIT 1
        `,
        [userId]
      );

    if (otherRunning.length) {
      return res.status(400).json({
        success: false,
        message:
          "Another task is currently running. Pause it before resuming this task.",
      });
    }

    await db.query(
      `
      INSERT INTO task_work_sessions (
        task_id,
        employee_id,
        started_at
      )
      VALUES (
        ?,
        ?,
        ${INDIA_NOW_SQL}
      )
      `,
      [
        taskId,
        userId,
      ]
    );

    return res.json({
      success: true,
      message:
        "Task resumed.",
      status:
        "ongoing",
      work_state:
        "running",
    });
  } catch (error) {
    console.error(
      "Resume employee task error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to resume task.",
      error:
        error.message,
    });
  }
};

/*
========================================================
SUBMIT MAIN TASK FOR REVIEW

Still supported for Main Tasks with no Subtasks.

For Main Tasks WITH Subtasks:
finishing all Subtasks automatically moves it
to Under Review.
========================================================
*/

const submitEmployeeTaskForReview = async (
  req,
  res
) => {
  const connection =
    await db.getConnection();

  try {
    const userId =
      getLoggedInUserId(req);

    const taskId =
      Number(
        req.params.taskId
      );

    const task =
      await getAssignedMainTask(
        connection,
        taskId,
        userId
      );

    if (!task) {
      return res.status(404).json({
        success: false,
        message:
          "Main Task not found or is not assigned to you.",
      });
    }

    const status =
      normalizeStatus(
        task.status
      );

    /*
    Already under review = harmless success.
    */

    if (
      status ===
      "under_review"
    ) {
      return res.json({
        success: true,
        message:
          "Task is already Under Review.",
        status:
          "under_review",
        work_state:
          "stopped",
      });
    }

    if (
      status !==
      "ongoing"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Only an In Progress task can be submitted for review.",
      });
    }

    const [summaryRows] =
      await connection.query(
        `
        SELECT
          COUNT(*) AS total_subtasks,

          SUM(
            CASE
              WHEN
                COALESCE(
                  is_checked,
                  0
                ) = 1

                OR LOWER(
                  REPLACE(
                    COALESCE(
                      status,
                      ''
                    ),
                    ' ',
                    '_'
                  )
                ) IN (
                  'completed',
                  'done',
                  'complete'
                )

              THEN 1
              ELSE 0
            END
          ) AS completed_subtasks

        FROM tasks

        WHERE
          parent_task_id = ?
        `,
        [taskId]
      );

    const totalSubtasks =
      Number(
        summaryRows[0]
          ?.total_subtasks || 0
      );

    const completedSubtasks =
      Number(
        summaryRows[0]
          ?.completed_subtasks || 0
      );

    if (
      totalSubtasks > 0 &&
      completedSubtasks <
        totalSubtasks
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Complete all Subtasks before submitting the Main Task for review.",
      });
    }

    await connection.beginTransaction();

    /*
    Shared Main Task -> stop ALL employee sessions.
    */

    await closeOpenSessionsForTask(
      connection,
      taskId,
      "submitted_for_review"
    );

    await connection.query(
      `
      UPDATE tasks

      SET
        status = 'under_review',
        progress = 100,
        review_status = 'pending',
        updated_at = NOW()

      WHERE
        task_id = ?
      `,
      [taskId]
    );

    const projectResult =
      await recalculateProject(
        connection,
        task.project_id
      );

    await connection.commit();

    return res.json({
      success: true,

      message:
        "Task submitted for Admin review.",

      status:
        "under_review",

      work_state:
        "stopped",

      project_status:
        projectResult?.status,
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    console.error(
      "Submit employee task for review error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to submit task for review.",
      error:
        error.message,
      sqlMessage:
        error.sqlMessage || null,
    });
  } finally {
    connection.release();
  }
};

/*
========================================================
EXPORTS
========================================================
*/

module.exports = {
  getEmployeeTasks,
  getEmployeeTaskDetails,

  addEmployeeSubtask,
  markEmployeeSubtaskDone,

  startEmployeeTask,
  pauseEmployeeTask,
  resumeEmployeeTask,

  submitEmployeeTaskForReview,
};
const db = require("../config/db");
/*
========================================================
EMPLOYEE TASK WORKING TIME RULES
========================================================
*/

const WORK_START_TIME = "11:00:00";
const WORK_END_TIME = "19:30:00";

/*
Always use India time for task work sessions.
*/
const INDIA_NOW_SQL =
  "CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+05:30')";

/*
These are the FIXED company holidays already present
in the Employee Holiday Calendar for 2026.
*/
const FIXED_COMPANY_HOLIDAYS_2026 = new Set([
  "2026-01-26", // Republic Day
  "2026-05-01", // Maharashtra Day / Buddha Pournima
  "2026-08-15", // Independence Day / Parsi New Year
  "2026-10-02", // Gandhi Jayanti
]);

/*
Get current India date/time from MySQL.
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
    dayOfWeek: Number(rows[0]?.day_of_week || 0),
  };
};

/*
Check whether employee is allowed to Start / Resume
a task right now.
*/
const getEmployeeWorkPermission = async (employeeId) => {
  const clock = await getIndiaClock();

  /*
  MySQL DAYOFWEEK:
  1 = Sunday
  2 = Monday
  ...
  7 = Saturday
  */
  if (clock.dayOfWeek === 1) {
    return {
      allowed: false,
      message:
        "Task timer cannot be started on Sunday. Sunday is a weekly holiday.",
    };
  }

  /*
  Fixed company holiday.
  */
  if (FIXED_COMPANY_HOLIDAYS_2026.has(clock.date)) {
    return {
      allowed: false,
      message:
        "Task timer cannot be started today because today is a company holiday.",
    };
  }

  /*
  Employee-selected optional holiday.
  */
  const [optionalHolidayRows] = await db.query(
    `
    SELECT
      selection_id,
      holiday_name
    FROM employee_optional_holidays
    WHERE employee_id = ?
      AND holiday_date = ?
    LIMIT 1
    `,
    [employeeId, clock.date]
  );

  if (optionalHolidayRows.length) {
    return {
      allowed: false,
      message: `Task timer cannot be started today because you selected ${
        optionalHolidayRows[0].holiday_name || "today"
      } as a holiday.`,
    };
  }

  /*
  Before office hours.
  */
  if (clock.time < WORK_START_TIME) {
    return {
      allowed: false,
      message:
        "Task timer can only be started from 11:00 AM onwards.",
    };
  }

  /*
  Office closed.
  */
  if (clock.time >= WORK_END_TIME) {
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
CLOSE FORGOTTEN / INVALID OPEN SESSIONS
========================================================

Examples:

Friday 3:27 PM -> employee forgets to Pause
The session becomes:
Friday 3:27 PM -> Friday 7:30 PM

It will NOT continue through:
Saturday night
Sunday
Monday
etc.

A session created on Sunday / fixed holiday /
employee optional holiday becomes zero time.
========================================================
*/
const closeExpiredOpenSessions = async (employeeId) => {
  /*
  First close any session that was incorrectly opened
  on a non-working day.

  We close it at started_at, therefore duration = 0.
  */
  await db.query(
    `
    UPDATE task_work_sessions tws

    SET
      tws.ended_at = tws.started_at,
      tws.end_reason = 'paused'

    WHERE
      tws.employee_id = ?
      AND tws.ended_at IS NULL

      AND (
        DAYOFWEEK(tws.started_at) = 1

        OR DATE(tws.started_at) IN (
          '2026-01-26',
          '2026-05-01',
          '2026-08-15',
          '2026-10-02'
        )

        OR EXISTS (
          SELECT 1
          FROM employee_optional_holidays eoh
          WHERE eoh.employee_id = tws.employee_id
            AND eoh.holiday_date = DATE(tws.started_at)
        )
      )
    `,
    [employeeId]
  );

  /*
  Then close normal forgotten sessions.

  Previous day -> close at that day's 7:30 PM
  Current day after 7:30 PM -> close at 7:30 PM
  */
  await db.query(
    `
    UPDATE task_work_sessions

    SET
      ended_at = GREATEST(
        started_at,
        TIMESTAMP(
          DATE(started_at),
          '${WORK_END_TIME}'
        )
      ),

      end_reason = 'paused'

    WHERE
      employee_id = ?
      AND ended_at IS NULL

      AND (
        DATE(started_at) <
          DATE(${INDIA_NOW_SQL})

        OR (
          DATE(started_at) =
            DATE(${INDIA_NOW_SQL})

          AND TIME(${INDIA_NOW_SQL}) >=
            '${WORK_END_TIME}'
        )
      )
    `,
    [employeeId]
  );
};
const getTaskTableColumns = async () => {
  const [columns] = await db.query("SHOW COLUMNS FROM tasks");
  return columns;
};

const hasColumn = (columns, columnName) => {
  return columns.some((column) => column.Field === columnName);
};

const getTaskTypeValue = async (preferredType) => {
  try {
    const [rows] = await db.query("SHOW COLUMNS FROM tasks LIKE 'task_type'");
    const typeText = rows[0]?.Type || "";

    const enumValues = [...typeText.matchAll(/'([^']+)'/g)].map((match) => match[1]);

    if (enumValues.length === 0) return preferredType;

    const preferredSubtaskValues = [
      "subtask",
      "sub_task",
      "sub-task",
      "child_task",
      "child",
      "task",
    ];

    if (preferredType === "subtask") {
      const matched = preferredSubtaskValues.find((value) =>
        enumValues.includes(value)
      );

      return matched || enumValues[0];
    }

    return enumValues.includes(preferredType) ? preferredType : enumValues[0];
  } catch {
    return preferredType;
  }
};

const normalizeStatus = (status) => {
  const value = String(status || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (["todo", "to_do", "pending", "not_started", ""].includes(value)) {
    return "not_started";
  }

  if (["ongoing", "in_progress", "progress"].includes(value)) {
    return "ongoing";
  }

  if (["under_review", "review"].includes(value)) {
    return "under_review";
  }

  if (["completed", "done", "complete"].includes(value)) {
    return "completed";
  }

  if (["rejected", "reject"].includes(value)) {
    return "rejected";
  }

  if (["on_hold", "hold"].includes(value)) {
    return "on_hold";
  }

  return value || "not_started";
};

const getOwnedTask = async (taskId, userId) => {
  const [rows] = await db.query(
    `
    SELECT
      task_id,
      parent_task_id,
      project_id,
      assigned_to_user_id,
      task_title,
      status,
      COALESCE(progress, 0) AS progress,
      COALESCE(is_checked, 0) AS is_checked
    FROM tasks
    WHERE task_id = ?
      AND assigned_to_user_id = ?
    LIMIT 1
    `,
    [taskId, userId]
  );

  return rows[0] || null;
};

const recalculateMainTask = async (mainTaskId) => {
  const [subtaskRows] = await db.query(
    `
    SELECT
      COUNT(*) AS total_subtasks,
      SUM(
        CASE
          WHEN is_checked = 1
            OR LOWER(REPLACE(status, ' ', '_')) IN ('completed', 'done', 'complete')
          THEN 1
          ELSE 0
        END
      ) AS completed_subtasks
    FROM tasks
    WHERE parent_task_id = ?
    `,
    [mainTaskId]
  );

  const totalSubtasks = Number(subtaskRows[0]?.total_subtasks || 0);
  const completedSubtasks = Number(subtaskRows[0]?.completed_subtasks || 0);

  const progress =
    totalSubtasks > 0
      ? Math.round((completedSubtasks / totalSubtasks) * 100)
      : 0;

  const [taskRows] = await db.query(
    `
    SELECT status, project_id
    FROM tasks
    WHERE task_id = ?
    LIMIT 1
    `,
    [mainTaskId]
  );

  if (!taskRows.length) return;

  const currentStatus = normalizeStatus(taskRows[0].status);

  /*
Task status changes only through explicit actions:
Start -> In Progress
Submit for Review -> Under Review
Admin approval -> Done
*/
  const nextStatus = currentStatus;

  await db.query(
    `
    UPDATE tasks
    SET
      status = ?,
      progress = ?,
      updated_at = NOW()
    WHERE task_id = ?
    `,
    [nextStatus, progress, mainTaskId]
  );

  const projectId = taskRows[0].project_id;

  if (projectId) {
    await recalculateProjectProgress(projectId);
  }
};

const recalculateProjectProgress = async (projectId) => {
  const [mainTaskRows] = await db.query(
    `
    SELECT
      task_id,
      COALESCE(progress, 0) AS progress,
      status
    FROM tasks
    WHERE project_id = ?
      AND (parent_task_id IS NULL OR parent_task_id = 0)
    `,
    [projectId]
  );

  if (!mainTaskRows.length) {
    await db.query(
      `
      UPDATE projects
      SET overall_progress = 0, status = 'not_started', updated_at = NOW()
      WHERE project_id = ?
      `,
      [projectId]
    );
    return;
  }

  const totalProgress = mainTaskRows.reduce(
    (sum, task) => sum + Number(task.progress || 0),
    0
  );

  const overallProgress = Math.round(totalProgress / mainTaskRows.length);

  const completedTasks = mainTaskRows.filter(
    (task) => normalizeStatus(task.status, task.progress) === "completed"
  ).length;

  let projectStatus = "not_started";

  if (completedTasks === mainTaskRows.length) {
    projectStatus = "under_review";
  } else if (overallProgress > 0) {
    projectStatus = "ongoing";
  }

  await db.query(
    `
    UPDATE projects
    SET overall_progress = ?, status = ?, updated_at = NOW()
    WHERE project_id = ?
    `,
    [overallProgress, projectStatus, projectId]
  );
};

const formatMainTasks = (mainTasks, subtasks) => {
  return mainTasks.map((task) => {
    const taskSubtasks = subtasks.filter(
      (subtask) => Number(subtask.parent_task_id) === Number(task.task_id)
    );

    const totalSubtasks = taskSubtasks.length;
    const completedSubtasks = taskSubtasks.filter(
      (subtask) =>
        Number(subtask.is_checked || 0) === 1 ||
        normalizeStatus(subtask.status, subtask.progress) === "completed"
    ).length;

    const calculatedProgress =
      totalSubtasks > 0
        ? Math.round((completedSubtasks / totalSubtasks) * 100)
        : Number(task.progress || 0);

    return {
      ...task,
      status: normalizeStatus(task.status, calculatedProgress),
      progress: calculatedProgress,
      total_subtasks: totalSubtasks,
      completed_subtasks: completedSubtasks,
      subtasks: taskSubtasks.map((subtask) => ({
        ...subtask,
        status: normalizeStatus(subtask.status, subtask.progress),
        is_checked:
          Number(subtask.is_checked || 0) === 1 ||
          normalizeStatus(subtask.status, subtask.progress) === "completed"
            ? 1
            : 0,
      })),
    };
  });
};

const getEmployeeTasks = async (req, res) => {
  try {
    const userId = req.user.user_id;

    /*
    Automatically close any forgotten old timer.
    */
    await closeExpiredOpenSessions(userId);

    const [tasks] = await db.query(
      `
      SELECT
        t.task_id,
        t.parent_task_id,
        t.project_id,
        t.task_title,
        t.task_description,
        t.task_type,
        t.status,
        t.priority,
        COALESCE(t.progress, 0) AS progress,
        COALESCE(t.is_checked, 0) AS is_checked,

        DATE_FORMAT(t.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date,

        p.project_title,
        p.project_description,

        creator.full_name AS created_by_name,
        creator.email AS created_by_email

      FROM tasks t

      LEFT JOIN projects p
        ON p.project_id = t.project_id

      LEFT JOIN users creator
        ON creator.user_id = t.created_by_user_id

      WHERE t.assigned_to_user_id = ?

        /*
        Show the actual tasks created inside projects,
        not the automatic project-shell task.
        */
        AND t.parent_task_id IS NOT NULL
        AND t.parent_task_id <> 0

      ORDER BY
        t.task_id DESC
      `,
      [userId]
    );

    const [runningSessions] = await db.query(
      `
      SELECT task_id
      FROM task_work_sessions
      WHERE employee_id = ?
        AND ended_at IS NULL
      `,
      [userId]
    );

    const runningTaskIds = new Set(
      runningSessions.map((row) => Number(row.task_id))
    );

    const formattedTasks = tasks.map((task) => ({
      ...task,

      status: normalizeStatus(task.status),

      progress:
        Number(task.is_checked || 0) === 1
          ? 100
          : Number(task.progress || 0),

      total_subtasks: 0,
      completed_subtasks: 0,
      subtasks: [],

      work_state:
        normalizeStatus(task.status) === "ongoing"
          ? runningTaskIds.has(Number(task.task_id))
            ? "running"
            : "paused"
          : "stopped",
    }));

    return res.json({
      success: true,
      main_tasks: formattedTasks,
      data: {
        main_tasks: formattedTasks,
      },
    });
  } catch (error) {
    console.error("Get employee tasks error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch assigned tasks.",
      error: error.message,
    });
  }
};

const getEmployeeTaskDetails = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const taskId = Number(req.params.taskId);

    /*
    Automatically close forgotten old timers.
    */
    await closeExpiredOpenSessions(userId);

    const [rows] = await db.query(
      `
      SELECT
        t.task_id,
        t.parent_task_id,
        t.project_id,
        t.task_title,
        t.task_description,
        t.task_type,
        t.status,
        t.priority,
        COALESCE(t.progress, 0) AS progress,
        COALESCE(t.is_checked, 0) AS is_checked,

        DATE_FORMAT(t.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date,

        p.project_title,
        p.project_description,

        creator.full_name AS created_by_name,
        creator.email AS created_by_email

      FROM tasks t

      LEFT JOIN projects p
        ON p.project_id = t.project_id

      LEFT JOIN users creator
        ON creator.user_id = t.created_by_user_id

      WHERE t.task_id = ?
        AND t.assigned_to_user_id = ?

      LIMIT 1
      `,
      [taskId, userId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Task not found.",
      });
    }

    const task = rows[0];

    const [runningRows] = await db.query(
      `
      SELECT session_id
      FROM task_work_sessions
      WHERE task_id = ?
        AND employee_id = ?
        AND ended_at IS NULL
      LIMIT 1
      `,
      [taskId, userId]
    );

    const formattedTask = {
      ...task,

      status: normalizeStatus(task.status),

      progress:
        Number(task.is_checked || 0) === 1
          ? 100
          : Number(task.progress || 0),

      total_subtasks: 0,
      completed_subtasks: 0,
      subtasks: [],

      work_state:
        normalizeStatus(task.status) === "ongoing"
          ? runningRows.length
            ? "running"
            : "paused"
          : "stopped",
    };

    return res.json({
      success: true,
      task: formattedTask,
      data: {
        task: formattedTask,
      },
    });
  } catch (error) {
    console.error("Get employee task details error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch task details.",
      error: error.message,
    });
  }
};

const addEmployeeSubtask = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const mainTaskId = req.params.taskId;

    const title =
      req.body.task_title ||
      req.body.subtask_title ||
      req.body.title ||
      "";

    const description =
      req.body.task_description ||
      req.body.subtask_description ||
      req.body.description ||
      "";

    const startDate = req.body.start_date || null;
    const dueDate = req.body.due_date || req.body.end_date || null;

    // -----------------------------
    // BASIC VALIDATION
    // -----------------------------
    if (!title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Subtask title is required.",
      });
    }

    if (!startDate || !dueDate) {
      return res.status(400).json({
        success: false,
        message: "Subtask start date and end date are required.",
      });
    }

    if (startDate > dueDate) {
      return res.status(400).json({
        success: false,
        message: "Subtask start date cannot be after subtask end date.",
      });
    }

    // -----------------------------
    // GET PARENT MAIN TASK
    // -----------------------------
    const [mainTaskRows] = await db.query(
      `
      SELECT
        task_id,
        project_id,
        assigned_to_user_id,
        status,
        COALESCE(progress, 0) AS progress,
        DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date
      FROM tasks
      WHERE task_id = ?
        AND assigned_to_user_id = ?
        AND (parent_task_id IS NULL OR parent_task_id = 0)
      LIMIT 1
      `,
      [mainTaskId, userId]
    );

    if (!mainTaskRows.length) {
      return res.status(404).json({
        success: false,
        message: "Main task not found.",
      });
    }

    const mainTask = mainTaskRows[0];

    // -----------------------------
    // PREVENT SUBTASKS ON LOCKED TASKS
    // -----------------------------
    const mainTaskStatus = normalizeStatus(
      mainTask.status,
      mainTask.progress
    );

    if (mainTaskStatus === "completed") {
      return res.status(400).json({
        success: false,
        message: "Subtasks cannot be added to a completed task.",
      });
    }

    if (mainTaskStatus === "rejected") {
      return res.status(400).json({
        success: false,
        message: "Subtasks cannot be added to a rejected task.",
      });
    }

    if (mainTaskStatus === "on_hold") {
      return res.status(400).json({
        success: false,
        message: "Subtasks cannot be added while the task is On Hold.",
      });
    }

    // -----------------------------
    // PARENT TASK DATE VALIDATION
    // -----------------------------
    if (
      mainTask.start_date &&
      startDate < mainTask.start_date
    ) {
      return res.status(400).json({
        success: false,
        message: `Subtask start date cannot be before the parent task start date (${mainTask.start_date}).`,
      });
    }

    if (
      mainTask.due_date &&
      dueDate > mainTask.due_date
    ) {
      return res.status(400).json({
        success: false,
        message: `Subtask deadline cannot exceed the parent task deadline (${mainTask.due_date}).`,
      });
    }

    // -----------------------------
    // GET TABLE COLUMNS
    // -----------------------------
    const columns = await getTaskTableColumns();

    const insertData = {
      project_id: mainTask.project_id,
      parent_task_id: mainTaskId,
      assigned_to_user_id: userId,
      task_title: title.trim(),
      task_description: description.trim(),
      status: "not_started",
      progress: 0,
      is_checked: 0,
      start_date: startDate,
      due_date: dueDate,
    };

    if (hasColumn(columns, "created_by_user_id")) {
      insertData.created_by_user_id = userId;
    }

    if (hasColumn(columns, "task_type")) {
      insertData.task_type = await getTaskTypeValue("subtask");
    }

    const validInsertData = Object.entries(insertData).filter(([key]) =>
      hasColumn(columns, key)
    );

    if (!validInsertData.length) {
      return res.status(500).json({
        success: false,
        message: "No valid task columns were found for creating the subtask.",
      });
    }

    const insertColumns = validInsertData.map(([key]) => key);
    const insertValues = validInsertData.map(([, value]) => value);
    const placeholders = insertColumns.map(() => "?").join(", ");

    const [result] = await db.query(
      `
      INSERT INTO tasks (${insertColumns.join(", ")})
      VALUES (${placeholders})
      `,
      insertValues
    );

    // -----------------------------
    // UPDATE MAIN TASK PROGRESS
    // -----------------------------
    await recalculateMainTask(mainTaskId);

    return res.status(201).json({
      success: true,
      message: "Subtask added successfully.",
      subtask_id: result.insertId,
    });
  } catch (error) {
    console.error("Add employee subtask error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add subtask.",
      error: error.message,
    });
  }
};

const markEmployeeSubtaskDone = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const subtaskId = req.params.subtaskId;

    const [subtaskRows] = await db.query(
      `
      SELECT
        st.task_id,
        st.parent_task_id,
        mt.assigned_to_user_id
      FROM tasks st
      INNER JOIN tasks mt ON mt.task_id = st.parent_task_id
      WHERE st.task_id = ?
        AND mt.assigned_to_user_id = ?
      LIMIT 1
      `,
      [subtaskId, userId]
    );

    if (!subtaskRows.length) {
      return res.status(404).json({
        success: false,
        message: "Subtask not found.",
      });
    }

    const mainTaskId = subtaskRows[0].parent_task_id;

    await db.query(
      `
      UPDATE tasks
      SET
        is_checked = 1,
        status = 'completed',
        progress = 100,
        updated_at = NOW()
      WHERE task_id = ?
      `,
      [subtaskId]
    );

    await recalculateMainTask(mainTaskId);

    return res.json({
      success: true,
      message: "Subtask marked as done.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update subtask.",
      error: error.message,
    });
  }
};
const startEmployeeTask = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const taskId = Number(req.params.taskId);

    const task = await getOwnedTask(taskId, userId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found.",
      });
    }

    const status = normalizeStatus(task.status);

    if (status !== "not_started") {
      return res.status(400).json({
        success: false,
        message: "Only To Do tasks can be started.",
      });
    }

    /*
    Close forgotten session from previous day
    before checking for another running task.
    */
    await closeExpiredOpenSessions(userId);

    /*
    Check Sunday, holidays and office timing.
    */
    const workPermission =
      await getEmployeeWorkPermission(userId);

    if (!workPermission.allowed) {
      return res.status(400).json({
        success: false,
        message: workPermission.message,
      });
    }

    /*
    Employee can only run one task at a time.
    */
    const [runningRows] = await db.query(
      `
      SELECT
        session_id,
        task_id
      FROM task_work_sessions
      WHERE employee_id = ?
        AND ended_at IS NULL
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

    /*
    Start timer using India time.
    */
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
      [taskId, userId]
    );

    /*
    Move To Do -> In Progress.
    */
    await db.query(
      `
      UPDATE tasks
      SET
        status = 'ongoing',
        updated_at = NOW()
      WHERE task_id = ?
      `,
      [taskId]
    );

    return res.json({
      success: true,
      message: "Task started.",
      work_state: "running",
      status: "ongoing",
    });
  } catch (error) {
    console.error(
      "Start employee task error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to start task.",
      error: error.message,
    });
  }
};
const pauseEmployeeTask = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const taskId = Number(req.params.taskId);

    const task = await getOwnedTask(taskId, userId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found.",
      });
    }

    if (normalizeStatus(task.status) !== "ongoing") {
      return res.status(400).json({
        success: false,
        message:
          "Only an In Progress task can be paused.",
      });
    }

    /*
    First close a timer automatically if office
    hours/day already ended.
    */
    await closeExpiredOpenSessions(userId);

    const [runningRows] = await db.query(
      `
      SELECT
        session_id
      FROM task_work_sessions
      WHERE task_id = ?
        AND employee_id = ?
        AND ended_at IS NULL
      ORDER BY session_id DESC
      LIMIT 1
      `,
      [taskId, userId]
    );

    if (!runningRows.length) {
      return res.status(400).json({
        success: false,
        message:
          "This task is already paused.",
      });
    }

    /*
    Stop at current time, but never later than 7:30 PM.
    */
    await db.query(
      `
      UPDATE task_work_sessions

      SET
        ended_at = GREATEST(
          started_at,

          LEAST(
            ${INDIA_NOW_SQL},

            TIMESTAMP(
              DATE(started_at),
              '${WORK_END_TIME}'
            )
          )
        ),

        end_reason = 'paused'

      WHERE session_id = ?
      `,
      [runningRows[0].session_id]
    );

    return res.json({
      success: true,
      message: "Task paused.",
      status: "ongoing",
      work_state: "paused",
    });
  } catch (error) {
    console.error(
      "Pause employee task error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to pause task.",
      error: error.message,
    });
  }
};
const resumeEmployeeTask = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const taskId = Number(req.params.taskId);

    const task = await getOwnedTask(taskId, userId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found.",
      });
    }

    if (normalizeStatus(task.status) !== "ongoing") {
      return res.status(400).json({
        success: false,
        message:
          "Only an In Progress task can be resumed.",
      });
    }

    /*
    Close forgotten previous session first.
    */
    await closeExpiredOpenSessions(userId);

    /*
    Resume only on a valid working day
    between 11 AM and 7:30 PM.
    */
    const workPermission =
      await getEmployeeWorkPermission(userId);

    if (!workPermission.allowed) {
      return res.status(400).json({
        success: false,
        message: workPermission.message,
      });
    }

    const [sameTaskRunning] = await db.query(
      `
      SELECT session_id
      FROM task_work_sessions
      WHERE task_id = ?
        AND employee_id = ?
        AND ended_at IS NULL
      LIMIT 1
      `,
      [taskId, userId]
    );

    if (sameTaskRunning.length) {
      return res.status(400).json({
        success: false,
        message:
          "This task is already running.",
      });
    }

    const [otherRunning] = await db.query(
      `
      SELECT
        session_id,
        task_id
      FROM task_work_sessions
      WHERE employee_id = ?
        AND ended_at IS NULL
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

    /*
    Resume = new work session.
    */
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
      [taskId, userId]
    );

    return res.json({
      success: true,
      message: "Task resumed.",
      status: "ongoing",
      work_state: "running",
    });
  } catch (error) {
    console.error(
      "Resume employee task error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to resume task.",
      error: error.message,
    });
  }
};
const submitEmployeeTaskForReview = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const taskId = Number(req.params.taskId);

    const task = await getOwnedTask(taskId, userId)

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found.",
      });
    }

    if (normalizeStatus(task.status) !== "ongoing") {
      return res.status(400).json({
        success: false,
        message:
          "Only an In Progress task can be submitted for review.",
      });
    }

    /*
    Require all subtasks to be completed when subtasks exist.
    */
    const [subtaskSummary] = await db.query(
      `
      SELECT
        COUNT(*) AS total_subtasks,
        SUM(
          CASE
            WHEN is_checked = 1
              OR LOWER(REPLACE(status, ' ', '_'))
                IN ('completed', 'done', 'complete')
            THEN 1
            ELSE 0
          END
        ) AS completed_subtasks
      FROM tasks
      WHERE parent_task_id = ?
      `,
      [taskId]
    );

    const totalSubtasks = Number(
      subtaskSummary[0]?.total_subtasks || 0
    );

    const completedSubtasks = Number(
      subtaskSummary[0]?.completed_subtasks || 0
    );

    if (
      totalSubtasks > 0 &&
      completedSubtasks < totalSubtasks
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Complete all subtasks before submitting the task for review.",
      });
    }

    /*
Close any forgotten/expired work session first.
*/
    await closeExpiredOpenSessions(userId);

    /*
    If currently running, stop the session.
    If paused, there is simply no open session to close.
    */
    const [runningRows] = await db.query(
      `
      SELECT session_id
      FROM task_work_sessions
      WHERE task_id = ?
        AND employee_id = ?
        AND ended_at IS NULL
      ORDER BY session_id DESC
      LIMIT 1
      `,
      [taskId, userId]
    );

    if (runningRows.length) {
     await db.query(
  `
  UPDATE task_work_sessions

  SET
    ended_at = GREATEST(
      started_at,

      LEAST(
        ${INDIA_NOW_SQL},

        TIMESTAMP(
          DATE(started_at),
          '${WORK_END_TIME}'
        )
      )
    ),

    end_reason = 'submitted_for_review'

  WHERE session_id = ?
  `,
  [runningRows[0].session_id]
);
    }

    await db.query(
      `
      UPDATE tasks
      SET
        status = 'under_review',
        progress = 100,
        updated_at = NOW()
      WHERE task_id = ?
      `,
      [taskId]
    );

    if (task.project_id) {
      await recalculateProjectProgress(task.project_id);
    }

    return res.json({
      success: true,
      message: "Task submitted for Admin review.",
      status: "under_review",
      work_state: "stopped",
    });
  } catch (error) {
    console.error("Submit employee task for review error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit task for review.",
      error: error.message,
    });
  }
};
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
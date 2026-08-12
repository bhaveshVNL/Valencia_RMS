const db = require("../config/db");

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

const normalizeStatus = (status, progress = 0) => {
  const value = String(status || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (Number(progress) >= 100) return "completed";
  if (["todo", "to_do", "pending", "not_started", ""].includes(value)) return "not_started";
  if (["ongoing", "in_progress", "progress"].includes(value)) return "ongoing";
  if (["under_review", "review"].includes(value)) return "under_review";
  if (["completed", "done", "complete"].includes(value)) return "completed";
  if (["rejected", "reject"].includes(value)) return "rejected";
  if (["on_hold", "hold"].includes(value)) return "on_hold";

  return value || "not_started";
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

  let progress = 0;
  let status = "not_started";

  if (totalSubtasks > 0) {
    progress = Math.round((completedSubtasks / totalSubtasks) * 100);

    if (completedSubtasks === totalSubtasks) {
      status = "completed";
    } else if (completedSubtasks > 0) {
      status = "ongoing";
    }
  }

  await db.query(
    `
    UPDATE tasks
    SET status = ?, progress = ?, updated_at = NOW()
    WHERE task_id = ?
    `,
    [status, progress, mainTaskId]
  );

  const [mainTaskRows] = await db.query(
    `
    SELECT project_id
    FROM tasks
    WHERE task_id = ?
    LIMIT 1
    `,
    [mainTaskId]
  );

  const projectId = mainTaskRows[0]?.project_id;

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

    const [mainTasks] = await db.query(
      `
      SELECT
        mt.task_id,
        mt.project_id,
        mt.task_title,
        mt.task_description,
        mt.status,
        COALESCE(mt.progress, 0) AS progress,
        DATE_FORMAT(mt.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(mt.due_date, '%Y-%m-%d') AS due_date,
        p.project_title,
        p.project_description,
        creator.full_name AS created_by_name,
        creator.email AS created_by_email
      FROM tasks mt
      LEFT JOIN projects p ON p.project_id = mt.project_id
      LEFT JOIN users creator ON creator.user_id = mt.created_by_user_id
      WHERE mt.assigned_to_user_id = ?
        AND (mt.parent_task_id IS NULL OR mt.parent_task_id = 0)
      ORDER BY mt.task_id DESC
      `,
      [userId]
    );

    if (!mainTasks.length) {
      return res.json({
        success: true,
        main_tasks: [],
        data: {
          main_tasks: [],
        },
      });
    }

    const mainTaskIds = mainTasks.map((task) => task.task_id);

    const [subtasks] = await db.query(
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
        DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date
      FROM tasks
      WHERE parent_task_id IN (?)
      ORDER BY task_id ASC
      `,
      [mainTaskIds]
    );

    const formattedTasks = formatMainTasks(mainTasks, subtasks);

    return res.json({
      success: true,
      main_tasks: formattedTasks,
      data: {
        main_tasks: formattedTasks,
      },
    });
  } catch (error) {
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
    const taskId = req.params.taskId;

    const [mainTaskRows] = await db.query(
      `
      SELECT
        mt.task_id,
        mt.project_id,
        mt.task_title,
        mt.task_description,
        mt.status,
        COALESCE(mt.progress, 0) AS progress,
        DATE_FORMAT(mt.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(mt.due_date, '%Y-%m-%d') AS due_date,
        p.project_title,
        p.project_description,
        creator.full_name AS created_by_name,
        creator.email AS created_by_email
      FROM tasks mt
      LEFT JOIN projects p ON p.project_id = mt.project_id
      LEFT JOIN users creator ON creator.user_id = mt.created_by_user_id
      WHERE mt.task_id = ?
        AND mt.assigned_to_user_id = ?
        AND (mt.parent_task_id IS NULL OR mt.parent_task_id = 0)
      LIMIT 1
      `,
      [taskId, userId]
    );

    if (!mainTaskRows.length) {
      return res.status(404).json({
        success: false,
        message: "Task not found.",
      });
    }

    const [subtasks] = await db.query(
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
        DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date
      FROM tasks
      WHERE parent_task_id = ?
      ORDER BY task_id ASC
      `,
      [taskId]
    );

    const formattedTask = formatMainTasks(mainTaskRows, subtasks)[0];

    return res.json({
      success: true,
      task: formattedTask,
      data: {
        task: formattedTask,
      },
    });
  } catch (error) {
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

module.exports = {
  getEmployeeTasks,
  getEmployeeTaskDetails,
  addEmployeeSubtask,
  markEmployeeSubtaskDone,
};
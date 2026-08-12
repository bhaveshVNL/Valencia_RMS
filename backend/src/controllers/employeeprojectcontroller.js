const db = require("../config/db");

const normalizeStatus = (status) => {
  const value = String(status || "").toLowerCase().trim().replace(/\s+/g, "_");

  if (
    value === "todo" ||
    value === "to_do" ||
    value === "pending" ||
    value === "not_started" ||
    value === "not-started"
  ) {
    return "todo";
  }

  if (value === "in_progress" || value === "ongoing" || value === "progress") {
    return "in_progress";
  }

  if (value === "under_review" || value === "review" || value === "pending_review") {
    return "under_review";
  }

  if (value === "done" || value === "completed" || value === "complete") {
    return "done";
  }

  if (value === "rejected" || value === "reject") {
    return "rejected";
  }

  if (value === "on_hold" || value === "hold") {
    return "on_hold";
  }

  return "todo";
};

const getStatusLabel = (status) => {
  const value = normalizeStatus(status);

  if (value === "todo") return "To Do";
  if (value === "in_progress") return "In Progress";
  if (value === "under_review") return "Under Review";
  if (value === "done") return "Done";
  if (value === "rejected") return "Rejected";
  if (value === "on_hold") return "On Hold";

  return "To Do";
};

const formatDate = (value) => {
  if (!value) return null;
  return String(value).slice(0, 10);
};

const isProjectLocked = (status) => {
  const value = normalizeStatus(status);
  return (
    value === "under_review" ||
    value === "done" ||
    value === "rejected" ||
    value === "on_hold"
  );
};

const safeUpdateTaskStatus = async (connection, taskId, wantedStatus, progress) => {
  const candidatesMap = {
    not_started: ["not_started", "todo"],
    ongoing: ["ongoing", "in_progress"],
    completed: ["completed", "done"],
    rejected: ["rejected"],
    on_hold: ["on_hold", "hold"],
  };

  const candidates = candidatesMap[wantedStatus] || [wantedStatus];
  let lastError = null;

  for (const status of candidates) {
    try {
      await connection.query(
        `
        UPDATE tasks
        SET
          status = ?,
          progress = ?,
          is_checked = CASE
            WHEN ? >= 100 THEN 1
            ELSE COALESCE(is_checked, 0)
          END
        WHERE task_id = ?
        `,
        [status, progress, progress, taskId]
      );

      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

const safeUpdateSubtaskCompleted = async (connection, subtaskId) => {
  const candidates = ["completed", "done"];
  let lastError = null;

  for (const status of candidates) {
    try {
      await connection.query(
        `
        UPDATE tasks
        SET
          status = ?,
          progress = 100,
          is_checked = 1
        WHERE task_id = ?
        `,
        [status, subtaskId]
      );

      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

const safeUpdateProjectStatus = async (connection, projectId, wantedStatus, progress) => {
  const candidatesMap = {
    not_started: ["not_started", "todo"],
    ongoing: ["ongoing", "in_progress"],
    under_review: ["under_review"],
    completed: ["completed", "done"],
    rejected: ["rejected"],
    on_hold: ["on_hold", "hold"],
  };

  const candidates = candidatesMap[wantedStatus] || [wantedStatus];
  let lastError = null;

  for (const status of candidates) {
    try {
      await connection.query(
        `
        UPDATE projects
        SET
          status = ?,
          overall_progress = ?
        WHERE project_id = ?
        `,
        [status, progress, projectId]
      );

      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

const recalculateMainTask = async (connection, mainTaskId) => {
  const [rows] = await connection.query(
    `
    SELECT
      COUNT(*) AS total_subtasks,
      SUM(
        CASE
          WHEN LOWER(COALESCE(status, '')) IN ('completed', 'done', 'complete')
          OR COALESCE(is_checked, 0) = 1
          THEN 1
          ELSE 0
        END
      ) AS completed_subtasks
    FROM tasks
    WHERE parent_task_id = ?
    `,
    [mainTaskId]
  );

  const totalSubtasks = Number(rows[0]?.total_subtasks || 0);
  const completedSubtasks = Number(rows[0]?.completed_subtasks || 0);

  let progress = 0;
  let nextStatus = "not_started";

  if (totalSubtasks > 0) {
    progress = Math.round((completedSubtasks / totalSubtasks) * 100);

    if (completedSubtasks === totalSubtasks) {
      nextStatus = "completed";
    } else {
      nextStatus = "ongoing";
    }
  }

  await safeUpdateTaskStatus(connection, mainTaskId, nextStatus, progress);

  return {
    totalSubtasks,
    completedSubtasks,
    progress,
    status: nextStatus,
  };
};

const recalculateProjectFromMainTasks = async (connection, projectId) => {
  const [projectRows] = await connection.query(
    `
    SELECT status
    FROM projects
    WHERE project_id = ?
    LIMIT 1
    `,
    [projectId]
  );

  const currentProjectStatus = normalizeStatus(projectRows[0]?.status);

  const [assigneeRows] = await connection.query(
    `
    SELECT
      assignee_data.assigned_to_user_id,
      SUM(assignee_data.total_subtasks) AS total_subtasks,
      SUM(assignee_data.completed_subtasks) AS completed_subtasks
    FROM (
      SELECT
        mt.project_id,
        mt.assigned_to_user_id,
        mt.task_id,
        COUNT(st.task_id) AS total_subtasks,
        SUM(
          CASE
            WHEN LOWER(COALESCE(st.status, '')) IN ('completed', 'done', 'complete')
            OR COALESCE(st.is_checked, 0) = 1
            THEN 1
            ELSE 0
          END
        ) AS completed_subtasks
      FROM tasks mt
      LEFT JOIN tasks st
        ON st.parent_task_id = mt.task_id
      WHERE mt.project_id = ?
      AND (mt.parent_task_id IS NULL OR mt.parent_task_id = 0)
      AND mt.assigned_to_user_id IS NOT NULL
      GROUP BY
        mt.project_id,
        mt.assigned_to_user_id,
        mt.task_id
    ) assignee_data
    GROUP BY assignee_data.assigned_to_user_id
    `,
    [projectId]
  );

  const activeAssignees = assigneeRows.filter(
    (row) => Number(row.total_subtasks || 0) > 0
  );

  let projectProgress = 0;
  let nextProjectStatus = "not_started";

  if (activeAssignees.length > 0) {
    const completedActiveAssignees = activeAssignees.filter((row) => {
      const totalSubtasks = Number(row.total_subtasks || 0);
      const completedSubtasks = Number(row.completed_subtasks || 0);

      return totalSubtasks > 0 && completedSubtasks === totalSubtasks;
    }).length;

    projectProgress = Math.round(
      (completedActiveAssignees / activeAssignees.length) * 100
    );

    if (completedActiveAssignees === activeAssignees.length) {
      nextProjectStatus = "under_review";
    } else {
      nextProjectStatus = "ongoing";
    }
  }

  if (
    currentProjectStatus === "done" ||
    currentProjectStatus === "rejected" ||
    currentProjectStatus === "on_hold"
  ) {
    await connection.query(
      `
      UPDATE projects
      SET overall_progress = ?
      WHERE project_id = ?
      `,
      [projectProgress, projectId]
    );

    return {
      status: currentProjectStatus,
      progress: projectProgress,
    };
  }

  await safeUpdateProjectStatus(
    connection,
    projectId,
    nextProjectStatus,
    projectProgress
  );

  return {
    status: nextProjectStatus,
    progress: projectProgress,
  };
};

const getEmployeeProjects = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [projects] = await db.query(
      `
      SELECT
        p.project_id,
        p.project_title,
        p.project_description,
        p.project_description AS description,

        p.status,
        p.status AS project_status,

        COALESCE(p.overall_progress, 0) AS overall_progress,
        COALESCE(p.overall_progress, 0) AS progress,

        DATE_FORMAT(p.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(p.start_date, '%Y-%m-%d') AS project_start_date,

        DATE_FORMAT(p.due_date, '%Y-%m-%d') AS end_date,
        DATE_FORMAT(p.due_date, '%Y-%m-%d') AS due_date,
        DATE_FORMAT(p.due_date, '%Y-%m-%d') AS project_end_date,

        d.department_name,

        creator.full_name AS created_by_name,
        creator.email AS created_by_email,

        t.task_id AS main_task_id,
        t.task_title AS main_task,
        t.task_title,
        t.task_description,
        t.status AS task_status,
        COALESCE(t.progress, 0) AS task_progress,

        (
          SELECT COUNT(*)
          FROM tasks st
          WHERE st.parent_task_id = t.task_id
        ) AS total_subtasks,

        (
          SELECT COUNT(*)
          FROM tasks st
          WHERE st.parent_task_id = t.task_id
          AND (
            LOWER(COALESCE(st.status, '')) IN (
              'completed',
              'done',
              'complete'
            )
            OR COALESCE(st.is_checked, 0) = 1
          )
        ) AS completed_subtasks,

        (
          SELECT GROUP_CONCAT(
            DISTINCT au.full_name
            ORDER BY au.full_name
            SEPARATOR ', '
          )
          FROM project_assignments pa_all
          LEFT JOIN users au
            ON au.user_id = pa_all.employee_id
          WHERE pa_all.project_id = p.project_id
          AND COALESCE(pa_all.assignment_status, 'assigned') <> 'removed'
        ) AS assigned_names,

        (
          SELECT GROUP_CONCAT(
            DISTINCT au.email
            ORDER BY au.email
            SEPARATOR ', '
          )
          FROM project_assignments pa_all
          LEFT JOIN users au
            ON au.user_id = pa_all.employee_id
          WHERE pa_all.project_id = p.project_id
          AND COALESCE(pa_all.assignment_status, 'assigned') <> 'removed'
        ) AS assigned_emails

      FROM projects p

      LEFT JOIN departments d
        ON d.department_id = p.department_id

      LEFT JOIN users creator
        ON creator.user_id = p.created_by_user_id

      LEFT JOIN tasks t
        ON t.task_id = (
          SELECT t1.task_id
          FROM tasks t1
          WHERE t1.project_id = p.project_id
          AND t1.assigned_to_user_id = ?
          AND (
            t1.parent_task_id IS NULL
            OR t1.parent_task_id = 0
          )
          ORDER BY t1.task_id DESC
          LIMIT 1
        )

      WHERE
        EXISTS (
          SELECT 1
          FROM project_assignments pa
          WHERE pa.project_id = p.project_id
          AND pa.employee_id = ?
          AND COALESCE(pa.assignment_status, 'assigned') <> 'removed'
        )

        OR EXISTS (
          SELECT 1
          FROM tasks t2
          WHERE t2.project_id = p.project_id
          AND t2.assigned_to_user_id = ?
          AND (
            t2.parent_task_id IS NULL
            OR t2.parent_task_id = 0
          )
        )

      ORDER BY p.project_id DESC
      `,
      [userId, userId, userId]
    );

    const formattedProjects = projects.map((project) => {
      const statusGroup = normalizeStatus(
        project.project_status || project.status
      );

      return {
        ...project,

        status_group: statusGroup,
        status_label: getStatusLabel(statusGroup),

        main_task:
          project.main_task ||
          project.task_description ||
          project.project_description ||
          "No main task added.",

        description:
          project.task_description ||
          project.project_description ||
          project.main_task ||
          "No main task added.",

        assigned_names: project.assigned_names || "-",
        assigned_emails: project.assigned_emails || "-",

        total_subtasks: Number(project.total_subtasks || 0),
        completed_subtasks: Number(project.completed_subtasks || 0),

        task_progress: Number(project.task_progress || 0),
        progress: Number(project.progress || 0),
        overall_progress: Number(project.overall_progress || 0),
      };
    });

    const rejectedProjects = formattedProjects.filter(
      (project) =>
        normalizeStatus(project.status_group || project.status) ===
        "rejected"
    );

    const onHoldProjects = formattedProjects.filter(
      (project) =>
        normalizeStatus(project.status_group || project.status) ===
        "on_hold"
    );

    const activeProjects = formattedProjects.filter((project) => {
      const status = normalizeStatus(
        project.status_group || project.status
      );

      return status !== "rejected" && status !== "on_hold";
    });

    return res.json({
      success: true,

      projects: activeProjects,
      myProjects: activeProjects,
      my_projects: activeProjects,

      rejectedProjects,
      rejected_projects: rejectedProjects,

      onHoldProjects,
      on_hold_projects: onHoldProjects,
    });
  } catch (error) {
    console.error("Get employee projects error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch employee projects.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};

const getEmployeeProjectSubtasks = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const projectId = Number(req.params.projectId);

    // --------------------------------------------------
    // GET PROJECT IF IT IS ASSIGNED TO THIS EMPLOYEE
    // --------------------------------------------------
    const [projectRows] = await db.query(
      `
      SELECT
        p.project_id,
        p.project_title,
        p.project_description,
        p.project_description AS description,

        p.status,
        p.status AS project_status,

        COALESCE(p.overall_progress, 0) AS overall_progress,
        COALESCE(p.overall_progress, 0) AS progress,

        DATE_FORMAT(p.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(p.start_date, '%Y-%m-%d') AS project_start_date,

        DATE_FORMAT(p.due_date, '%Y-%m-%d') AS end_date,
        DATE_FORMAT(p.due_date, '%Y-%m-%d') AS due_date,
        DATE_FORMAT(p.due_date, '%Y-%m-%d') AS project_end_date,

        d.department_name,

        creator.full_name AS created_by_name,
        creator.email AS created_by_email,

        t.task_id AS main_task_id,
        t.task_title AS main_task,
        t.task_title,
        t.task_description,
        t.status AS task_status,
        COALESCE(t.progress, 0) AS task_progress,

        (
          SELECT COUNT(*)
          FROM tasks st
          WHERE st.parent_task_id = t.task_id
        ) AS total_subtasks,

        (
          SELECT COUNT(*)
          FROM tasks st
          WHERE st.parent_task_id = t.task_id
          AND (
            LOWER(COALESCE(st.status, '')) IN (
              'completed',
              'done',
              'complete'
            )
            OR COALESCE(st.is_checked, 0) = 1
          )
        ) AS completed_subtasks,

        (
          SELECT GROUP_CONCAT(
            DISTINCT au.full_name
            ORDER BY au.full_name
            SEPARATOR ', '
          )
          FROM project_assignments pa_all
          LEFT JOIN users au
            ON au.user_id = pa_all.employee_id
          WHERE pa_all.project_id = p.project_id
        ) AS assigned_names,

        (
          SELECT GROUP_CONCAT(
            DISTINCT au.email
            ORDER BY au.email
            SEPARATOR ', '
          )
          FROM project_assignments pa_all
          LEFT JOIN users au
            ON au.user_id = pa_all.employee_id
          WHERE pa_all.project_id = p.project_id
        ) AS assigned_emails

      FROM projects p

      LEFT JOIN departments d
        ON d.department_id = p.department_id

      LEFT JOIN users creator
        ON creator.user_id = p.created_by_user_id

      LEFT JOIN tasks t
        ON t.task_id = (
          SELECT t1.task_id
          FROM tasks t1
          WHERE t1.project_id = p.project_id
          AND t1.assigned_to_user_id = ?
          AND (
            t1.parent_task_id IS NULL
            OR t1.parent_task_id = 0
          )
          ORDER BY t1.task_id ASC
          LIMIT 1
        )

      WHERE p.project_id = ?

      AND (
        EXISTS (
          SELECT 1
          FROM project_assignments pa
          WHERE pa.project_id = p.project_id
          AND pa.employee_id = ?
        )

        OR EXISTS (
          SELECT 1
          FROM tasks t2
          WHERE t2.project_id = p.project_id
          AND t2.assigned_to_user_id = ?
          AND (
            t2.parent_task_id IS NULL
            OR t2.parent_task_id = 0
          )
        )
      )

      LIMIT 1
      `,
      [userId, projectId, userId, userId]
    );

    if (!projectRows.length) {
      return res.status(404).json({
        success: false,
        message: "This project is not assigned to your account.",
      });
    }

    const project = projectRows[0];

    const statusGroup = normalizeStatus(
      project.project_status || project.status
    );

    // --------------------------------------------------
    // GET SUBTASKS ONLY IF MAIN TASK EXISTS
    // --------------------------------------------------
    let subtasks = [];

    if (project.main_task_id) {
      const [subtaskRows] = await db.query(
        `
        SELECT
          task_id AS subtask_id,
          task_id,
          task_title AS title,
          task_title,
          task_description,
          task_description AS description,
          status,
          COALESCE(progress, 0) AS progress,
          COALESCE(is_checked, 0) AS is_checked,

          DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
          DATE_FORMAT(due_date, '%Y-%m-%d') AS end_date,
          DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date

        FROM tasks

        WHERE parent_task_id = ?

        ORDER BY start_date ASC, task_id ASC
        `,
        [project.main_task_id]
      );

      subtasks = subtaskRows;
    }

    // --------------------------------------------------
    // SEND PROJECT DETAILS
    // --------------------------------------------------
    return res.json({
      success: true,

      project: {
        ...project,

        status_group: statusGroup,
        status_label: getStatusLabel(statusGroup),

        main_task:
          project.main_task ||
          project.project_title ||
          "No main task added.",

        description:
          project.task_description ||
          project.project_description ||
          project.main_task ||
          "No main task added.",

        assigned_names: project.assigned_names || "-",
        assigned_emails: project.assigned_emails || "-",

        total_subtasks: Number(project.total_subtasks || 0),
        completed_subtasks: Number(
          project.completed_subtasks || 0
        ),

        task_progress: Number(project.task_progress || 0),

        progress:
          statusGroup === "rejected"
            ? 0
            : Number(project.progress || 0),

        overall_progress:
          statusGroup === "rejected"
            ? 0
            : Number(project.overall_progress || 0),
      },

      subtasks,
    });
  } catch (error) {
    console.error(
      "Get employee project subtasks error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch project details.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};

const getSubtasksAfterUpdate = async (mainTaskId) => {
  const [subtasks] = await db.query(
    `
    SELECT
      task_id AS subtask_id,
      task_id,
      task_title AS title,
      task_title,
      task_description,
      task_description AS description,
      status,
      progress,
      is_checked,
      DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
      DATE_FORMAT(due_date, '%Y-%m-%d') AS end_date,
      DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date
    FROM tasks
    WHERE parent_task_id = ?
    ORDER BY start_date ASC, task_id ASC
    `,
    [mainTaskId]
  );

  return subtasks;
};

const addEmployeeProjectSubtask = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const userId = req.user.user_id;
    const projectId = Number(req.params.projectId);

    const title = String(req.body.title || "").trim();

    const description = String(
      req.body.description ||
        req.body.task_description ||
        ""
    ).trim();

    const startDate = formatDate(req.body.start_date);
    const endDate = formatDate(req.body.end_date);

    if (!title || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Subtask title, start date and end date are required.",
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: "Subtask start date cannot be after end date.",
      });
    }

    await connection.beginTransaction();

    // --------------------------------------------------
    // 1. CHECK WHETHER PROJECT IS ACTUALLY ASSIGNED
    // --------------------------------------------------
    const [projectRows] = await connection.query(
      `
      SELECT
        p.project_id,
        p.project_title,
        p.project_description,
        p.status AS project_status,
        p.created_by_user_id,

        DATE_FORMAT(p.start_date, '%Y-%m-%d') AS project_start_date,
        DATE_FORMAT(p.due_date, '%Y-%m-%d') AS project_end_date

      FROM projects p

      WHERE p.project_id = ?

      AND (
        EXISTS (
          SELECT 1
          FROM project_assignments pa
          WHERE pa.project_id = p.project_id
          AND pa.employee_id = ?
          AND COALESCE(pa.assignment_status, 'assigned') <> 'removed'
        )

        OR EXISTS (
          SELECT 1
          FROM tasks existing_task
          WHERE existing_task.project_id = p.project_id
          AND existing_task.assigned_to_user_id = ?
          AND (
            existing_task.parent_task_id IS NULL
            OR existing_task.parent_task_id = 0
          )
        )
      )

      LIMIT 1
      `,
      [projectId, userId, userId]
    );

    if (!projectRows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "This project is not assigned to your account.",
      });
    }

    const project = projectRows[0];

    // --------------------------------------------------
    // 2. PROJECT LOCK CHECK
    // --------------------------------------------------
    if (isProjectLocked(project.project_status)) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "This project is locked. Subtasks cannot be added.",
      });
    }

    // --------------------------------------------------
    // 3. DATE CHECKS
    // --------------------------------------------------
    if (
      project.project_start_date &&
      startDate < project.project_start_date
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: `Subtask start date cannot be before project start date ${project.project_start_date}.`,
      });
    }

    if (
      project.project_end_date &&
      endDate > project.project_end_date
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: `Subtask end date cannot exceed project end date ${project.project_end_date}.`,
      });
    }

    // --------------------------------------------------
    // 4. LOOK FOR BHAVESH'S MAIN TASK
    // --------------------------------------------------
    const [existingMainTasks] = await connection.query(
      `
      SELECT
        task_id,
        project_id
      FROM tasks
      WHERE project_id = ?
      AND assigned_to_user_id = ?
      AND (
        parent_task_id IS NULL
        OR parent_task_id = 0
      )
      ORDER BY task_id ASC
      LIMIT 1
      `,
      [projectId, userId]
    );

    let mainTaskId;

    // --------------------------------------------------
    // 5. IF PROJECT WAS ASSIGNED BUT NO MAIN TASK EXISTS,
    //    CREATE ONE FOR THIS EMPLOYEE
    // --------------------------------------------------
    if (!existingMainTasks.length) {
      const [mainTaskResult] = await connection.query(
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
          due_date
        )
        VALUES (
          ?,
          NULL,
          ?,
          ?,
          ?,
          ?,
          'main',
          'not_started',
          'medium',
          0,
          0,
          ?,
          ?
        )
        `,
        [
          projectId,
          project.created_by_user_id || userId,
          userId,
          project.project_title || "Project Task",
          project.project_description || "",
          project.project_start_date,
          project.project_end_date,
        ]
      );

      mainTaskId = mainTaskResult.insertId;
    } else {
      mainTaskId = existingMainTasks[0].task_id;
    }

    // --------------------------------------------------
    // 6. CREATE THE SUBTASK
    // --------------------------------------------------
    await connection.query(
      `
      INSERT INTO tasks (
        project_id,
        parent_task_id,
        assigned_to_user_id,
        created_by_user_id,
        task_title,
        task_description,
        task_type,
        status,
        priority,
        progress,
        is_checked,
        start_date,
        due_date
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
        ?
      )
      `,
      [
        projectId,
        mainTaskId,
        userId,
        userId,
        title,
        description,
        startDate,
        endDate,
      ]
    );

    // --------------------------------------------------
    // 7. UPDATE PROGRESS
    // --------------------------------------------------
    await recalculateMainTask(connection, mainTaskId);

    await recalculateProjectFromMainTasks(
      connection,
      projectId
    );

    await connection.commit();

    const subtasks =
      await getSubtasksAfterUpdate(mainTaskId);

    return res.status(201).json({
      success: true,
      message: "Subtask added successfully.",
      subtasks,
    });
  } catch (error) {
    await connection.rollback();

    console.error(
      "Add employee project subtask error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to add subtask.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  } finally {
    connection.release();
  }
};

const updateEmployeeProjectSubtaskStatus = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const userId = req.user.user_id;
    const projectId = Number(req.params.projectId);
    const subtaskId = Number(req.params.subtaskId);
    const checked = Boolean(req.body.checked);

    await connection.beginTransaction();

    const [subtaskRows] = await connection.query(
      `
      SELECT
        st.task_id,
        st.parent_task_id,
        st.status,
        st.is_checked,
        mt.project_id,
        mt.assigned_to_user_id,
        p.status AS project_status
      FROM tasks st

      INNER JOIN tasks mt
        ON mt.task_id = st.parent_task_id

      INNER JOIN projects p
        ON p.project_id = mt.project_id

      WHERE st.task_id = ?
      AND mt.project_id = ?
      AND mt.assigned_to_user_id = ?

      LIMIT 1
      `,
      [subtaskId, projectId, userId]
    );

    if (!subtaskRows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Subtask not found.",
      });
    }

    const subtask = subtaskRows[0];

    if (isProjectLocked(subtask.project_status)) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "This project is locked. Subtasks cannot be updated.",
      });
    }

    if (
      normalizeStatus(subtask.status) === "done" ||
      Number(subtask.is_checked || 0) === 1
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Completed subtasks are locked and cannot be unchecked.",
      });
    }

    if (!checked) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Subtasks can only be checked as complete.",
      });
    }

    await safeUpdateSubtaskCompleted(connection, subtaskId);

    await recalculateMainTask(connection, subtask.parent_task_id);
    await recalculateProjectFromMainTasks(connection, projectId);

    await connection.commit();

    const subtasks = await getSubtasksAfterUpdate(subtask.parent_task_id);

    return res.json({
      success: true,
      message: "Subtask completed successfully.",
      subtasks,
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      success: false,
      message: "Failed to update subtask.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getEmployeeProjects,
  getEmployeeProjectSubtasks,
  addEmployeeProjectSubtask,
  updateEmployeeProjectSubtaskStatus,
};
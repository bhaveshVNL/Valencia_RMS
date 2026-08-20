const db = require("../config/db");

const getAdminDepartment = async (adminUserId) => {
  const [rows] = await db.query(
    `
    SELECT
      u.user_id,
      u.full_name,
      u.email,
      u.department_id,
      d.department_name
    FROM users u
    LEFT JOIN departments d
      ON d.department_id = u.department_id
    WHERE u.user_id = ?
    LIMIT 1
    `,
    [adminUserId]
  );

  return rows[0] || null;
};

const safeUpdateAllTasksForProject = async (
  connection,
  projectId,
  wantedStatus,
  progress,
  checked
) => {
  const candidatesMap = {
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
          is_checked = ?
        WHERE project_id = ?
        `,
        [status, progress, checked, projectId]
      );

      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

const getReviewProjects = async (req, res) => {
  try {
    const adminUserId = req.user.user_id;
    const admin = await getAdminDepartment(adminUserId);

    if (!admin || !admin.department_id) {
      return res.status(400).json({
        success: false,
        message: "Admin department not found.",
      });
    }

    const [projects] = await db.query(
      `
      SELECT
        p.project_id,
        p.project_title,
        p.project_description,
        p.status,
        p.overall_progress,
        DATE_FORMAT(p.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(p.due_date, '%Y-%m-%d') AS due_date,

        d.department_name,

        creator.full_name AS created_by_name,
        creator.email AS created_by_email,

        progress_data.active_assignees,
        progress_data.completed_active_assignees,

        GROUP_CONCAT(DISTINCT assignee.full_name ORDER BY assignee.full_name SEPARATOR ', ') AS assigned_names,
        GROUP_CONCAT(DISTINCT assignee.email ORDER BY assignee.email SEPARATOR ', ') AS assigned_emails

      FROM projects p

      LEFT JOIN departments d
        ON d.department_id = p.department_id

      LEFT JOIN users creator
        ON creator.user_id = p.created_by_user_id

      LEFT JOIN tasks mt
        ON mt.project_id = p.project_id
        AND (mt.parent_task_id IS NULL OR mt.parent_task_id = 0)

      LEFT JOIN users assignee
        ON assignee.user_id = mt.assigned_to_user_id

      LEFT JOIN (
        SELECT
          project_id,
          COUNT(*) AS active_assignees,
          SUM(
            CASE
              WHEN total_subtasks > 0
              AND completed_subtasks = total_subtasks
              THEN 1
              ELSE 0
            END
          ) AS completed_active_assignees
        FROM (
          SELECT
            mt.project_id,
            mt.assigned_to_user_id,
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
          WHERE (mt.parent_task_id IS NULL OR mt.parent_task_id = 0)
          AND mt.assigned_to_user_id IS NOT NULL
          GROUP BY
            mt.project_id,
            mt.assigned_to_user_id
          HAVING COUNT(st.task_id) > 0
        ) active_data
        GROUP BY project_id
      ) progress_data
        ON progress_data.project_id = p.project_id

      WHERE p.department_id = ?
      AND LOWER(COALESCE(p.status, '')) NOT IN (
        'completed',
        'done',
        'rejected',
        'on_hold',
        'hold',
        'cancelled'
      )
      AND COALESCE(progress_data.active_assignees, 0) > 0
      AND progress_data.completed_active_assignees = progress_data.active_assignees

      GROUP BY
        p.project_id,
        p.project_title,
        p.project_description,
        p.status,
        p.overall_progress,
        p.start_date,
        p.due_date,
        d.department_name,
        creator.full_name,
        creator.email,
        progress_data.active_assignees,
        progress_data.completed_active_assignees

      ORDER BY p.project_id DESC
      `,
      [admin.department_id]
    );

    const projectIds = projects.map((project) => project.project_id);

    let mainTasksByProject = {};

    if (projectIds.length > 0) {
      const placeholders = projectIds.map(() => "?").join(",");

      const [mainTasks] = await db.query(
        `
        SELECT
          mt.task_id,
          mt.project_id,
          mt.task_title,
          mt.task_description,
          mt.status,
          mt.progress,

          assignee.full_name AS assignee_name,
          assignee.email AS assignee_email,

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

        INNER JOIN (
          SELECT
            selected_main_tasks.project_id,
            selected_main_tasks.assigned_to_user_id,
            CAST(
              SUBSTRING_INDEX(
                GROUP_CONCAT(
                  selected_main_tasks.task_id
                  ORDER BY selected_main_tasks.subtask_count DESC, selected_main_tasks.task_id ASC
                ),
                ',',
                1
              ) AS UNSIGNED
            ) AS selected_task_id
          FROM (
            SELECT
              mt_inner.task_id,
              mt_inner.project_id,
              mt_inner.assigned_to_user_id,
              COUNT(st_inner.task_id) AS subtask_count
            FROM tasks mt_inner
            LEFT JOIN tasks st_inner
              ON st_inner.parent_task_id = mt_inner.task_id
            WHERE mt_inner.project_id IN (${placeholders})
            AND (mt_inner.parent_task_id IS NULL OR mt_inner.parent_task_id = 0)
            AND mt_inner.assigned_to_user_id IS NOT NULL
            GROUP BY
              mt_inner.task_id,
              mt_inner.project_id,
              mt_inner.assigned_to_user_id
          ) selected_main_tasks
          GROUP BY
            selected_main_tasks.project_id,
            selected_main_tasks.assigned_to_user_id
        ) unique_tasks
          ON unique_tasks.selected_task_id = mt.task_id

        LEFT JOIN users assignee
          ON assignee.user_id = mt.assigned_to_user_id

        LEFT JOIN tasks st
          ON st.parent_task_id = mt.task_id

        GROUP BY
          mt.task_id,
          mt.project_id,
          mt.task_title,
          mt.task_description,
          mt.status,
          mt.progress,
          assignee.full_name,
          assignee.email

        ORDER BY mt.project_id DESC, assignee.full_name ASC
        `,
        projectIds
      );

      const mainTaskIds = mainTasks.map((task) => task.task_id);
      let subtasksByParent = {};

      if (mainTaskIds.length > 0) {
        const taskPlaceholders = mainTaskIds.map(() => "?").join(",");

        const [subtasks] = await db.query(
          `
          SELECT
            task_id,
            parent_task_id,
            task_title,
            task_description,
            status,
            is_checked,
            DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
            DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date
          FROM tasks
          WHERE parent_task_id IN (${taskPlaceholders})
          ORDER BY start_date ASC, task_id ASC
          `,
          mainTaskIds
        );

        subtasksByParent = subtasks.reduce((acc, subtask) => {
          if (!acc[subtask.parent_task_id]) {
            acc[subtask.parent_task_id] = [];
          }

          acc[subtask.parent_task_id].push(subtask);
          return acc;
        }, {});
      }

      mainTasksByProject = mainTasks.reduce((acc, task) => {
        if (!acc[task.project_id]) {
          acc[task.project_id] = [];
        }

        acc[task.project_id].push({
          ...task,
          progress: Number(task.progress || 0),
          total_subtasks: Number(task.total_subtasks || 0),
          completed_subtasks: Number(task.completed_subtasks || 0),
          subtasks: subtasksByParent[task.task_id] || [],
        });

        return acc;
      }, {});
    }

    const formattedProjects = projects.map((project) => ({
      ...project,
      overall_progress: Number(project.overall_progress || 100),
      active_assignees: Number(project.active_assignees || 0),
      completed_active_assignees: Number(project.completed_active_assignees || 0),
      assigned_names: project.assigned_names || "-",
      assigned_emails: project.assigned_emails || "-",
      main_tasks: mainTasksByProject[project.project_id] || [],
    }));

    return res.json({
      success: true,
      admin,
      review_projects: formattedProjects,
      projects: formattedProjects,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load review projects.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};

const reviewProjectAction = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const adminUserId = req.user.user_id;
    const projectId = Number(req.params.projectId);
    const action = String(req.body.action || "").toLowerCase().trim();
    const remark = String(req.body.remark || "").trim();

    const allowedActions = [
  "done",
  "reject",
  "on_hold",
  "in_progress",
];

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required.",
      });
    }

    if (!allowedActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Use done, reject, on_hold, or in_progress.",
      });
    }

    const admin = await getAdminDepartment(adminUserId);

    if (!admin || !admin.department_id) {
      return res.status(400).json({
        success: false,
        message: "Admin department not found.",
      });
    }

    await connection.beginTransaction();

    const [projectRows] = await connection.query(
      `
      SELECT
        project_id,
        project_title,
        status,
        department_id
      FROM projects
      WHERE project_id = ?
      AND department_id = ?
      LIMIT 1
      `,
      [projectId, admin.department_id]
    );

    if (!projectRows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Project not found for this admin department.",
      });
    }

    const nextStatus =
  action === "done"
    ? "completed"
    : action === "reject"
    ? "rejected"
    : action === "in_progress"
    ? "in_progress"
    : "on_hold";

    await connection.query(
  `
  UPDATE projects
  SET
    status = ?,
    rejection_remark = CASE
      WHEN ? = 'rejected' THEN ?
      ELSE rejection_remark
    END,
    overall_progress = CASE
      WHEN ? = 'completed' THEN 100
      ELSE overall_progress
    END
  WHERE project_id = ?
  `,
  [
    nextStatus,
    nextStatus,
    remark,
    nextStatus,
    projectId,
  ]
);

    if (nextStatus === "completed") {
      await safeUpdateAllTasksForProject(connection, projectId, "completed", 100, 1);
    }

    if (nextStatus === "rejected") {
      await safeUpdateAllTasksForProject(connection, projectId, "rejected", 0, 0);
    }

    if (nextStatus === "on_hold") {
      await safeUpdateAllTasksForProject(connection, projectId, "on_hold", 0, 0);
    }

    if (nextStatus === "in_progress") {
  await safeUpdateAllTasksForProject(connection, projectId, "in_progress", 0, 0);
}

    try {
      await connection.query(
        `
        INSERT INTO activity_logs (
          user_id,
          action_type,
          entity_type,
          entity_id,
          description
        )
        VALUES (?, ?, 'project', ?, ?)
        `,
        [
          adminUserId,
          `project_review_${nextStatus}`,
          projectId,
          `${admin.full_name} marked project ${projectRows[0].project_title} as ${nextStatus}.`,
        ]
      );
    } catch (logError) {
      console.log("Activity log skipped:", logError.sqlMessage || logError.message);
    }

    await connection.commit();

    return res.json({
      success: true,
      message:
        action === "done"
          ? "Project marked as done."
          : action === "reject"
            ? "Project rejected."
            : action === "in_progress"
              ? "Project resumed."
              : "Project put on hold.",
      project_id: projectId,
      status: nextStatus,
      rejection_remark:
        nextStatus === "rejected" ? remark : null,
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      success: false,
      message: "Failed to update project review action.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getReviewProjects,
  reviewProjectAction,
};
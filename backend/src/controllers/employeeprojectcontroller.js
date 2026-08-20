const db = require("../config/db");

/*
========================================================
STATUS HELPERS
========================================================
*/

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
    [
      "rejected",
      "reject",
    ].includes(value)
  ) {
    return "rejected";
  }

  if (
    [
      "on_hold",
      "hold",
    ].includes(value)
  ) {
    return "on_hold";
  }

  if (
    [
      "blocked",
      "block",
    ].includes(value)
  ) {
    return "blocked";
  }

  return value || "not_started";
};

const getStatusLabel = (status) => {
  const value = normalizeStatus(status);

  if (value === "not_started") {
    return "To Do";
  }

  if (value === "ongoing") {
    return "In Progress";
  }

  if (value === "under_review") {
    return "Under Review";
  }

  if (value === "completed") {
    return "Completed";
  }

  if (value === "rejected") {
    return "Rejected";
  }

  if (value === "on_hold") {
    return "On Hold";
  }

  if (value === "blocked") {
    return "Blocked";
  }

  return "To Do";
};

const formatDate = (value) => {
  if (!value) return null;

  return String(value).slice(0, 10);
};

const getLoggedInUserId = (req) => {
  return Number(
    req.user?.user_id ||
      req.user?.id ||
      req.userId ||
      0
  );
};

/*
========================================================
LOCK RULES
========================================================
*/

const isMainTaskLockedForSubtasks = (
  status
) => {
  const value =
    normalizeStatus(status);

  return [
    "under_review",
    "completed",
    "rejected",
    "on_hold",
  ].includes(value);
};

const isProjectLocked = (status) => {
  const value =
    normalizeStatus(status);

  return [
    "completed",
    "rejected",
    "on_hold",
  ].includes(value);
};

/*
========================================================
SHARED MAIN TASK ASSIGNMENT CHECK
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
        t.task_title,
        t.task_description,
        t.status,
        t.progress,

        DATE_FORMAT(
          t.start_date,
          '%Y-%m-%d'
        ) AS start_date,

        DATE_FORMAT(
          t.due_date,
          '%Y-%m-%d'
        ) AS due_date,

        p.project_title,
        p.project_description,

        DATE_FORMAT(
          p.start_date,
          '%Y-%m-%d'
        ) AS project_start_date,

        DATE_FORMAT(
          p.due_date,
          '%Y-%m-%d'
        ) AS project_due_date,

        p.status AS project_status

      FROM tasks t

      INNER JOIN projects p
        ON p.project_id =
           t.project_id

      INNER JOIN task_assignments ta
        ON ta.task_id =
           t.task_id

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
GET SUBTASKS
========================================================
*/

const getSubtasksForMainTask = async (
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

        st.task_title,
        st.task_title AS title,

        st.task_description,
        st.task_description AS description,

        st.status,

        COALESCE(
          st.progress,
          0
        ) AS progress,

        COALESCE(
          st.is_checked,
          0
        ) AS is_checked,

        st.assigned_to_user_id,
        st.created_by_user_id,

        DATE_FORMAT(
          st.start_date,
          '%Y-%m-%d'
        ) AS start_date,

        DATE_FORMAT(
          st.due_date,
          '%Y-%m-%d'
        ) AS due_date,

        DATE_FORMAT(
          st.due_date,
          '%Y-%m-%d'
        ) AS end_date,

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
          subtask.progress || 0
        ),

      is_checked:
        Number(
          subtask.is_checked || 0
        ),
    })
  );
};

/*
========================================================
RECALCULATE MAIN TASK

RULE:

0 subtasks
-> leave progress/status as-is

Some subtasks complete
-> calculate progress

All subtasks complete
-> automatically move Main Task to Under Review

This implements:
"if all subtasks are done then it should be under review"
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

  const [taskRows] =
    await connection.query(
      `
      SELECT
        task_id,
        project_id,
        status

      FROM tasks

      WHERE
        task_id = ?

      LIMIT 1
      `,
      [mainTaskId]
    );

  if (!taskRows.length) {
    return {
      totalSubtasks,
      completedSubtasks,
      progress,
      status: "not_started",
    };
  }

  const currentStatus =
    normalizeStatus(
      taskRows[0].status
    );

  let nextStatus =
    currentStatus;

  /*
  Admin-controlled final states stay unchanged.
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
      WHERE task_id = ?
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
    };
  }

  /*
  All subtasks completed
  -> automatically Under Review.
  */

  if (
    totalSubtasks > 0 &&
    completedSubtasks ===
      totalSubtasks
  ) {
    nextStatus =
      "under_review";
  }

  await connection.query(
    `
    UPDATE tasks

    SET
      status = ?,
      progress = ?,
      updated_at = NOW()

    WHERE task_id = ?
    `,
    [
      nextStatus,
      progress,
      mainTaskId,
    ]
  );

  return {
    totalSubtasks,
    completedSubtasks,
    progress,
    status:
      nextStatus,
  };
};

/*
========================================================
RECALCULATE PROJECT

RULE:

No work started
-> To Do

Any Main Task started
-> In Progress

Every Main Task under review / completed
-> Project Under Review

Completed / Rejected / On Hold project
-> don't automatically override Admin's state
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
    return;
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
      WHERE project_id = ?
      `,
      [projectId]
    );

    return;
  }

  const progressTotal =
    mainTasks.reduce(
      (sum, task) =>
        sum +
        Number(
          task.progress || 0
        ),
      0
    );

  const overallProgress =
    Math.round(
      progressTotal /
        mainTasks.length
    );

  /*
  Do not override final Admin project states.
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
      WHERE project_id = ?
      `,
      [
        overallProgress,
        projectId,
      ]
    );

    return;
  }

  const statuses =
    mainTasks.map(
      (task) =>
        normalizeStatus(
          task.status
        )
    );

  const allAwaitingReview =
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

  if (allAwaitingReview) {
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

    WHERE project_id = ?
    `,
    [
      nextProjectStatus,
      overallProgress,
      projectId,
    ]
  );
};

/*
========================================================
GET EMPLOYEE PROJECTS

IMPORTANT:

A Project can have MULTIPLE Main Tasks for an employee.

Return:

Project
  main_tasks: [...]
========================================================
*/

const getEmployeeProjects = async (
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

    /*
    Projects employee can see either because:
    - employee is in project_assignments
    OR
    - employee has a Main Task through task_assignments

    This protects existing old records too.
    */

    const [projectRows] =
      await db.query(
        `
        SELECT DISTINCT
          p.project_id,
          p.created_by_user_id,
          p.department_id,

          p.project_title,
          p.project_description,

         p.priority,
p.status,
p.rejection_remark,

COALESCE(
  p.overall_progress,
            0
          ) AS overall_progress,

          DATE_FORMAT(
            p.start_date,
            '%Y-%m-%d'
          ) AS start_date,

          DATE_FORMAT(
            p.due_date,
            '%Y-%m-%d'
          ) AS due_date,

          DATE_FORMAT(
            p.due_date,
            '%Y-%m-%d'
          ) AS end_date,

          p.created_at,
          p.updated_at,

          d.department_name,

          creator.full_name
            AS created_by_name,

          creator.email
            AS created_by_email

        FROM projects p

        LEFT JOIN departments d
          ON d.department_id =
             p.department_id

        LEFT JOIN users creator
          ON creator.user_id =
             p.created_by_user_id

        WHERE
          EXISTS (
            SELECT 1

            FROM project_assignments pa

            WHERE
              pa.project_id =
              p.project_id

              AND pa.employee_id = ?

              AND COALESCE(
                pa.assignment_status,
                'assigned'
              ) <> 'removed'
          )

          OR EXISTS (
            SELECT 1

            FROM tasks mt

            INNER JOIN task_assignments ta
              ON ta.task_id =
                 mt.task_id

            WHERE
              mt.project_id =
              p.project_id

              AND ta.employee_id = ?

              AND (
                mt.parent_task_id
                  IS NULL
                OR mt.parent_task_id = 0
              )
          )

        ORDER BY
          p.project_id DESC
        `,
        [
          userId,
          userId,
        ]
      );

    if (!projectRows.length) {
      return res.json({
        success: true,

        projects: [],
        myProjects: [],
        my_projects: [],

        rejectedProjects: [],
        rejected_projects: [],

        onHoldProjects: [],
        on_hold_projects: [],
      });
    }

    const projectIds =
      projectRows.map(
        (project) =>
          Number(
            project.project_id
          )
      );

    /*
    Get every Main Task assigned to this employee.

    NO LIMIT 1.
    */

    const [mainTaskRows] =
      await db.query(
        `
        SELECT DISTINCT
          mt.task_id,
          mt.project_id,
          mt.parent_task_id,

          mt.task_title,
          mt.task_description,

          mt.task_type,
          mt.status,
          mt.priority,

          COALESCE(
            mt.progress,
            0
          ) AS progress,

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

          mt.created_at,
          mt.updated_at,

          (
            SELECT COUNT(*)

            FROM tasks st

            WHERE
              st.parent_task_id =
              mt.task_id
          ) AS total_subtasks,

          (
            SELECT COUNT(*)

            FROM tasks st

            WHERE
              st.parent_task_id =
              mt.task_id

              AND (
                COALESCE(
                  st.is_checked,
                  0
                ) = 1

                OR LOWER(
                  REPLACE(
                    COALESCE(
                      st.status,
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
              )
          ) AS completed_subtasks

        FROM tasks mt

        INNER JOIN task_assignments ta
          ON ta.task_id =
             mt.task_id

        WHERE
          mt.project_id IN (?)

          AND ta.employee_id = ?

          AND (
            mt.parent_task_id IS NULL
            OR mt.parent_task_id = 0
          )

        ORDER BY
          mt.task_id ASC
        `,
        [
          projectIds,
          userId,
        ]
      );

    /*
    Get ALL employees assigned to those Main Tasks.
    This is important for showing shared work.
    */

    const mainTaskIds =
      mainTaskRows.map(
        (task) =>
          Number(
            task.task_id
          )
      );

    let taskAssignmentRows = [];

    if (mainTaskIds.length) {
      const [rows] =
        await db.query(
          `
          SELECT
            ta.task_id,
            ta.employee_id,

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

      taskAssignmentRows =
        rows;
    }

    /*
    Fetch all shared subtasks for those Main Tasks.

    Note:
    No employee filter here.

    If Employee A and Employee B are assigned to the
    SAME Main Task, BOTH need to see the same subtasks.
    */

    let subtaskRows = [];

    if (mainTaskIds.length) {
      const [rows] =
        await db.query(
          `
          SELECT
            st.task_id,
            st.parent_task_id,
            st.project_id,

            st.task_title,
            st.task_description,

            st.status,

            COALESCE(
              st.progress,
              0
            ) AS progress,

            COALESCE(
              st.is_checked,
              0
            ) AS is_checked,

            st.created_by_user_id,

            DATE_FORMAT(
              st.start_date,
              '%Y-%m-%d'
            ) AS start_date,

            DATE_FORMAT(
              st.due_date,
              '%Y-%m-%d'
            ) AS due_date,

            creator.full_name
              AS created_by_name

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

      subtaskRows = rows;
    }

    /*
    Project assignees.
    */

    const [projectAssignments] =
      await db.query(
        `
        SELECT
          pa.project_id,
          pa.employee_id,

          u.full_name,
          u.email

        FROM project_assignments pa

        INNER JOIN users u
          ON u.user_id =
             pa.employee_id

        WHERE
          pa.project_id IN (?)

          AND COALESCE(
            pa.assignment_status,
            'assigned'
          ) <> 'removed'

        ORDER BY
          u.full_name ASC
        `,
        [projectIds]
      );

    /*
    Build task-assignee map.
    */

    const taskAssigneeMap =
      new Map();

    taskAssignmentRows.forEach(
      (row) => {
        const taskId =
          Number(row.task_id);

        if (
          !taskAssigneeMap.has(
            taskId
          )
        ) {
          taskAssigneeMap.set(
            taskId,
            []
          );
        }

        taskAssigneeMap
          .get(taskId)
          .push({
            user_id:
              row.employee_id,

            employee_id:
              row.employee_id,

            full_name:
              row.full_name,

            email:
              row.email,

            employee_code:
              row.employee_code,

            designation:
              row.designation,
          });
      }
    );

    /*
    Build subtask map.
    */

    const subtaskMap =
      new Map();

    subtaskRows.forEach(
      (row) => {
        const mainTaskId =
          Number(
            row.parent_task_id
          );

        if (
          !subtaskMap.has(
            mainTaskId
          )
        ) {
          subtaskMap.set(
            mainTaskId,
            []
          );
        }

        subtaskMap
          .get(mainTaskId)
          .push({
            ...row,

            subtask_id:
              row.task_id,

            title:
              row.task_title,

            description:
              row.task_description,

            status:
              normalizeStatus(
                row.status
              ),

            progress:
              Number(
                row.progress || 0
              ),

            is_checked:
              Number(
                row.is_checked ||
                  0
              ),
          });
      }
    );

    /*
    Main Tasks grouped by Project.
    */

    const mainTaskMap =
      new Map();

    mainTaskRows.forEach(
      (task) => {
        const projectId =
          Number(
            task.project_id
          );

        if (
          !mainTaskMap.has(
            projectId
          )
        ) {
          mainTaskMap.set(
            projectId,
            []
          );
        }

        const taskId =
          Number(
            task.task_id
          );

        const assignees =
          taskAssigneeMap.get(
            taskId
          ) || [];

        const subtasks =
          subtaskMap.get(
            taskId
          ) || [];

        mainTaskMap
          .get(projectId)
          .push({
            ...task,

            main_task_id:
              task.task_id,

            status:
              normalizeStatus(
                task.status
              ),

            status_label:
              getStatusLabel(
                task.status
              ),

            progress:
              Number(
                task.progress || 0
              ),

            total_subtasks:
              Number(
                task.total_subtasks ||
                  0
              ),

            completed_subtasks:
              Number(
                task.completed_subtasks ||
                  0
              ),

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

            subtasks,
          });
      }
    );

    /*
    Project-level employee map.
    */

    const projectAssigneeMap =
      new Map();

    projectAssignments.forEach(
      (row) => {
        const projectId =
          Number(
            row.project_id
          );

        if (
          !projectAssigneeMap.has(
            projectId
          )
        ) {
          projectAssigneeMap.set(
            projectId,
            []
          );
        }

        projectAssigneeMap
          .get(projectId)
          .push({
            user_id:
              row.employee_id,

            employee_id:
              row.employee_id,

            full_name:
              row.full_name,

            email:
              row.email,
          });
      }
    );

    /*
    Final structure.
    */

    const formattedProjects =
      projectRows.map(
        (project) => {
          const projectId =
            Number(
              project.project_id
            );

          const mainTasks =
            mainTaskMap.get(
              projectId
            ) || [];

          const projectAssignees =
            projectAssigneeMap.get(
              projectId
            ) || [];

          const totalSubtasks =
            mainTasks.reduce(
              (sum, task) =>
                sum +
                Number(
                  task.total_subtasks ||
                    0
                ),
              0
            );

          const completedSubtasks =
            mainTasks.reduce(
              (sum, task) =>
                sum +
                Number(
                  task.completed_subtasks ||
                    0
                ),
              0
            );

          return {
            ...project,

            status:
              normalizeStatus(
                project.status
              ),

            project_status:
              normalizeStatus(
                project.status
              ),

            status_group:
              normalizeStatus(
                project.status
              ),

            status_label:
              getStatusLabel(
                project.status
              ),

            progress:
              Number(
                project.overall_progress ||
                  0
              ),

            overall_progress:
              Number(
                project.overall_progress ||
                  0
              ),

            /*
            PROJECT DESCRIPTION ONLY.

            Do not substitute Main Task description here.
            */
            description:
              project.project_description ||
              "",

            assignees:
              projectAssignees,

            assigned_names:
              projectAssignees
                .map(
                  (employee) =>
                    employee.full_name
                )
                .filter(Boolean)
                .join(", ") || "-",

            assigned_emails:
              projectAssignees
                .map(
                  (employee) =>
                    employee.email
                )
                .filter(Boolean)
                .join(", ") || "-",

            main_tasks:
              mainTasks,

            mainTasks,

            total_main_tasks:
              mainTasks.length,

            total_subtasks:
              totalSubtasks,

            completed_subtasks:
              completedSubtasks,
          };
        }
      );

    const rejectedProjects =
      formattedProjects.filter(
        (project) =>
          normalizeStatus(
            project.status
          ) === "rejected"
      );

    const onHoldProjects =
      formattedProjects.filter(
        (project) =>
          normalizeStatus(
            project.status
          ) === "on_hold"
      );

    const activeProjects =
      formattedProjects.filter(
        (project) => {
          const status =
            normalizeStatus(
              project.status
            );

          return (
            status !==
              "rejected" &&
            status !==
              "on_hold"
          );
        }
      );

    return res.json({
      success: true,

      projects:
        activeProjects,

      myProjects:
        activeProjects,

      my_projects:
        activeProjects,

      rejectedProjects,

      rejected_projects:
        rejectedProjects,

      onHoldProjects,

      on_hold_projects:
        onHoldProjects,
    });
  } catch (error) {
    console.error(
      "Get employee projects error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch employee projects.",
      error:
        error.message,
      sqlMessage:
        error.sqlMessage || null,
    });
  }
};

/*
========================================================
GET ONE PROJECT + ALL ASSIGNED MAIN TASKS

Legacy route:
GET /employee-projects/projects/:projectId/subtasks

We keep it working for now.

But instead of pretending Project has one Main Task,
the response now contains main_tasks[].
========================================================
*/

const getEmployeeProjectSubtasks = async (
  req,
  res
) => {
  try {
    const userId =
      getLoggedInUserId(req);

    const projectId =
      Number(
        req.params.projectId
      );

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message:
          "Project ID is required.",
      });
    }

    const [projectRows] =
      await db.query(
        `
        SELECT
          p.project_id,
          p.project_title,
          p.project_description,
p.status,
p.rejection_remark,

COALESCE(
            p.overall_progress,
            0
          ) AS overall_progress,

          DATE_FORMAT(
            p.start_date,
            '%Y-%m-%d'
          ) AS start_date,

          DATE_FORMAT(
            p.due_date,
            '%Y-%m-%d'
          ) AS due_date,

          d.department_name,

          creator.full_name
            AS created_by_name,

          creator.email
            AS created_by_email

        FROM projects p

        LEFT JOIN departments d
          ON d.department_id =
             p.department_id

        LEFT JOIN users creator
          ON creator.user_id =
             p.created_by_user_id

        WHERE
          p.project_id = ?

          AND (
            EXISTS (
              SELECT 1

              FROM project_assignments pa

              WHERE
                pa.project_id =
                p.project_id

                AND pa.employee_id = ?

                AND COALESCE(
                  pa.assignment_status,
                  'assigned'
                ) <> 'removed'
            )

            OR EXISTS (
              SELECT 1

              FROM tasks mt

              INNER JOIN task_assignments ta
                ON ta.task_id =
                   mt.task_id

              WHERE
                mt.project_id =
                p.project_id

                AND ta.employee_id = ?

                AND (
                  mt.parent_task_id
                    IS NULL
                  OR mt.parent_task_id = 0
                )
            )
          )

        LIMIT 1
        `,
        [
          projectId,
          userId,
          userId,
        ]
      );

    if (!projectRows.length) {
      return res.status(404).json({
        success: false,
        message:
          "This project is not assigned to your account.",
      });
    }

    const project =
      projectRows[0];

    /*
    Get ALL Main Tasks assigned to employee.
    */

    const [mainTasks] =
      await db.query(
        `
        SELECT DISTINCT
          mt.task_id,
          mt.project_id,

          mt.task_title,
          mt.task_description,

          mt.status,
          mt.priority,

          COALESCE(
            mt.progress,
            0
          ) AS progress,

          DATE_FORMAT(
            mt.start_date,
            '%Y-%m-%d'
          ) AS start_date,

          DATE_FORMAT(
            mt.due_date,
            '%Y-%m-%d'
          ) AS due_date

        FROM tasks mt

        INNER JOIN task_assignments ta
          ON ta.task_id =
             mt.task_id

        WHERE
          mt.project_id = ?

          AND ta.employee_id = ?

          AND (
            mt.parent_task_id IS NULL
            OR mt.parent_task_id = 0
          )

        ORDER BY
          mt.task_id ASC
        `,
        [
          projectId,
          userId,
        ]
      );

    const formattedMainTasks = [];

    for (
      const mainTask
      of mainTasks
    ) {
      const subtasks =
        await getSubtasksForMainTask(
          db,
          mainTask.task_id
        );

      const [assigneeRows] =
        await db.query(
          `
          SELECT
            ta.employee_id,

            u.full_name,
            u.email

          FROM task_assignments ta

          INNER JOIN users u
            ON u.user_id =
               ta.employee_id

          WHERE
            ta.task_id = ?

          ORDER BY
            u.full_name ASC
          `,
          [mainTask.task_id]
        );

      formattedMainTasks.push({
        ...mainTask,

        main_task_id:
          mainTask.task_id,

        status:
          normalizeStatus(
            mainTask.status
          ),

        status_label:
          getStatusLabel(
            mainTask.status
          ),

        progress:
          Number(
            mainTask.progress ||
              0
          ),

        assignees:
          assigneeRows,

        assigned_names:
          assigneeRows
            .map(
              (employee) =>
                employee.full_name
            )
            .join(", "),

        assigned_emails:
          assigneeRows
            .map(
              (employee) =>
                employee.email
            )
            .join(", "),

        total_subtasks:
          subtasks.length,

        completed_subtasks:
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
          ).length,

        subtasks,
      });
    }

    const allSubtasks =
      formattedMainTasks.flatMap(
        (task) =>
          task.subtasks
      );

    return res.json({
      success: true,

      project: {
        ...project,

        status:
          normalizeStatus(
            project.status
          ),

        project_status:
          normalizeStatus(
            project.status
          ),

        status_group:
          normalizeStatus(
            project.status
          ),

        status_label:
          getStatusLabel(
            project.status
          ),

        /*
        Keep Project description separate.
        */
        description:
          project.project_description ||
          "",

        progress:
          Number(
            project.overall_progress ||
              0
          ),

        overall_progress:
          Number(
            project.overall_progress ||
              0
          ),

        main_tasks:
          formattedMainTasks,

        mainTasks:
          formattedMainTasks,

        total_main_tasks:
          formattedMainTasks.length,

        total_subtasks:
          allSubtasks.length,

        completed_subtasks:
          allSubtasks.filter(
            (subtask) =>
              Number(
                subtask.is_checked ||
                  0
              ) === 1 ||
              normalizeStatus(
                subtask.status
              ) ===
                "completed"
          ).length,
      },

      main_tasks:
        formattedMainTasks,

      /*
      Legacy field kept temporarily.

      If Project has multiple Main Tasks this contains
      every shared Subtask from every assigned Main Task.
      */
      subtasks:
        allSubtasks,
    });
  } catch (error) {
    console.error(
      "Get employee project details error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch project details.",
      error:
        error.message,
      sqlMessage:
        error.sqlMessage || null,
    });
  }
};

/*
========================================================
LEGACY PROJECT-LEVEL ADD SUBTASK

IMPORTANT:

The correct final flow is:

POST /employee-tasks/:taskId/subtasks

because Subtask belongs to a Main Task.

We keep this controller temporarily so current
Employee Projects page does not instantly break.

If employee has multiple Main Tasks under a Project,
frontend MUST send main_task_id.
========================================================
*/

const addEmployeeProjectSubtask = async (
  req,
  res
) => {
  const connection =
    await db.getConnection();

  try {
    const userId =
      getLoggedInUserId(req);

    const projectId =
      Number(
        req.params.projectId
      );

    const requestedMainTaskId =
      Number(
        req.body.main_task_id ||
          req.body.task_id ||
          0
      );

    const title =
      String(
        req.body.title ||
          req.body.task_title ||
          ""
      ).trim();

    const description =
      String(
        req.body.description ||
          req.body.task_description ||
          ""
      ).trim();

    const startDate =
      formatDate(
        req.body.start_date
      );

    const dueDate =
      formatDate(
        req.body.due_date ||
          req.body.end_date
      );

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message:
          "Project ID is required.",
      });
    }

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
      startDate >
      dueDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Subtask start date cannot be after deadline.",
      });
    }

    await connection.beginTransaction();

    /*
    Find every Main Task this employee is assigned
    to inside this Project.
    */

    const [assignedMainTasks] =
      await connection.query(
        `
        SELECT DISTINCT
          mt.task_id

        FROM tasks mt

        INNER JOIN task_assignments ta
          ON ta.task_id =
             mt.task_id

        WHERE
          mt.project_id = ?

          AND ta.employee_id = ?

          AND (
            mt.parent_task_id IS NULL
            OR mt.parent_task_id = 0
          )

        ORDER BY
          mt.task_id ASC
        `,
        [
          projectId,
          userId,
        ]
      );

    if (
      !assignedMainTasks.length
    ) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          "No Main Task has been assigned to you for this Project.",
      });
    }

    let mainTaskId =
      requestedMainTaskId;

    /*
    If only one Main Task exists,
    legacy Employee Projects page can still work.

    If multiple exist, require exact Main Task.
    */

    if (!mainTaskId) {
      if (
        assignedMainTasks.length ===
        1
      ) {
        mainTaskId =
          Number(
            assignedMainTasks[0]
              .task_id
          );
      } else {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message:
            "Select the Main Task before adding a Subtask.",
        });
      }
    }

    const assignedTaskIds =
      new Set(
        assignedMainTasks.map(
          (task) =>
            Number(
              task.task_id
            )
        )
      );

    if (
      !assignedTaskIds.has(
        mainTaskId
      )
    ) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        message:
          "This Main Task is not assigned to you.",
      });
    }

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
          "Main Task not found.",
      });
    }

    const mainTaskStatus =
      normalizeStatus(
        mainTask.status
      );

    if (
      isMainTaskLockedForSubtasks(
        mainTaskStatus
      )
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          `Subtasks cannot be added while the Main Task is ${getStatusLabel(
            mainTaskStatus
          )}.`,
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
          "This Project is locked. Subtasks cannot be added.",
      });
    }

    /*
    Subtask dates must fit inside Main Task dates.
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
    Create shared Subtask.

    Notice:
    parent_task_id = one shared Main Task ID.

    We do NOT create another Main Task.
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
          projectId,
          mainTaskId,
          userId,
          userId,

          title,
          description,

          startDate,
          dueDate,
        ]
      );

    /*
    Requirement:
    Adding a Subtask to a To Do Main Task
    means work has begun.

    To Do -> In Progress.
    */

    

    await recalculateMainTask(
      connection,
      mainTaskId
    );

    await recalculateProject(
      connection,
      projectId
    );

    await connection.commit();

    const subtasks =
      await getSubtasksForMainTask(
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

      subtasks,
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    console.error(
      "Add employee project Subtask error:",
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
MARK SHARED SUBTASK COMPLETE

Any employee assigned to the parent Main Task
may complete the shared Subtask.

This fixes:
same Subtask not visible / usable by second employee.
========================================================
*/

const updateEmployeeProjectSubtaskStatus =
  async (req, res) => {
    const connection =
      await db.getConnection();

    try {
      const userId =
        getLoggedInUserId(req);

      const projectId =
        Number(
          req.params.projectId
        );

      const subtaskId =
        Number(
          req.params.subtaskId
        );

      const checked =
        Boolean(
          req.body.checked ??
            req.body.is_checked
        );

      if (!checked) {
        return res.status(400).json({
          success: false,
          message:
            "Subtasks can only be marked as completed.",
        });
      }

      await connection.beginTransaction();

      /*
      Employee owns ACCESS through task_assignments
      of the parent Main Task.

      Do NOT check mt.assigned_to_user_id anymore.
      */

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

            AND mt.project_id = ?

            AND ta.employee_id = ?

          LIMIT 1
          `,
          [
            subtaskId,
            projectId,
            userId,
          ]
        );

      if (!rows.length) {
        await connection.rollback();

        return res.status(404).json({
          success: false,
          message:
            "Subtask not found or you are not assigned to its Main Task.",
        });
      }

      const subtask =
        rows[0];

      if (
        isMainTaskLockedForSubtasks(
          subtask.main_task_status
        )
      ) {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message:
            `Subtasks cannot be changed while the Main Task is ${getStatusLabel(
              subtask.main_task_status
            )}.`,
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
            "This Project is locked.",
        });
      }

      if (
        Number(
          subtask.is_checked ||
            0
        ) === 1 ||
        normalizeStatus(
          subtask.status
        ) ===
          "completed"
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

      await recalculateProject(
        connection,
        projectId
      );

      await connection.commit();

      const subtasks =
        await getSubtasksForMainTask(
          db,
          subtask.parent_task_id
        );

      return res.json({
        success: true,

        message:
          recalculated.status ===
          "under_review"
            ? "All Subtasks are complete. Main Task moved to Under Review."
            : "Subtask completed successfully.",

        main_task_id:
          subtask.parent_task_id,

        main_task_status:
          recalculated.status,

        main_task_progress:
          recalculated.progress,

        subtasks,
      });
    } catch (error) {
      try {
        await connection.rollback();
      } catch {}

      console.error(
        "Update employee Subtask error:",
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
EXPORTS
========================================================
*/

module.exports = {
  getEmployeeProjects,
  getEmployeeProjectSubtasks,
  addEmployeeProjectSubtask,
  updateEmployeeProjectSubtaskStatus,
};
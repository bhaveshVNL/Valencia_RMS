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

  return value || "not_started";
};

const getStatusGroup = (status) => {
  const value = normalizeStatus(status);

  if (value === "not_started") {
    return "todo";
  }

  if (value === "ongoing") {
    return "in_progress";
  }

  if (value === "under_review") {
    return "under_review";
  }

  if (value === "completed") {
    return "done";
  }

  if (value === "rejected") {
    return "rejected";
  }

  if (value === "on_hold") {
    return "on_hold";
  }

  return "todo";
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
    return "Done";
  }

  if (value === "rejected") {
    return "Rejected";
  }

  if (value === "on_hold") {
    return "On Hold";
  }

  return "To Do";
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
ADMIN DETAILS
========================================================
*/

const getLoggedInAdmin = async (
  connection,
  req
) => {
  const adminId =
    getLoggedInUserId(req);

  if (!adminId) {
    return {
      error: {
        status: 401,
        message:
          "Admin user not found.",
      },
    };
  }

  const [rows] =
    await connection.query(
      `
      SELECT
        u.user_id,
        u.full_name,
        u.email,
        u.department_id,
        u.employee_code,
        u.designation,

        d.department_name,

        r.role_name

      FROM users u

      LEFT JOIN departments d
        ON d.department_id =
           u.department_id

      LEFT JOIN roles r
        ON r.role_id =
           u.role_id

      WHERE
        u.user_id = ?

      LIMIT 1
      `,
      [adminId]
    );

  if (!rows.length) {
    return {
      error: {
        status: 404,
        message:
          "Logged-in admin was not found.",
      },
    };
  }

  const admin =
    rows[0];

  if (
    String(
      admin.role_name || ""
    )
      .toLowerCase()
      .trim() !== "admin"
  ) {
    return {
      error: {
        status: 403,
        message:
          "Only department admins can access department task review.",
      },
    };
  }

  if (!admin.department_id) {
    return {
      error: {
        status: 400,
        message:
          "Admin department is not assigned.",
      },
    };
  }

  return {
    admin,
  };
};

/*
========================================================
PROJECT STATUS RECALCULATION

ALL Main Tasks To Do
=> Project To Do

ANY Main Task started
=> Project In Progress

ALL Main Tasks Under Review / Done
=> Project Under Review
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
        status = 'not_started',
        overall_progress = 0,
        updated_at = NOW()

      WHERE
        project_id = ?
      `,
      [projectId]
    );

    return {
      status:
        "not_started",

      progress: 0,
    };
  }

  const overallProgress =
    Math.round(
      mainTasks.reduce(
        (sum, task) =>
          sum +
          Number(
            task.progress || 0
          ),
        0
      ) / mainTasks.length
    );

  /*
  Final project decisions made by Admin
  stay final.
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

  const allToDo =
    statuses.every(
      (status) =>
        status ===
        "not_started"
    );

  const allReadyForReview =
    statuses.every(
      (status) =>
        [
          "under_review",
          "completed",
        ].includes(status)
    );

  let nextProjectStatus =
    "ongoing";

  if (allToDo) {
    nextProjectStatus =
      "not_started";
  } else if (
    allReadyForReview
  ) {
    nextProjectStatus =
      "under_review";
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
GET ADMIN DEPARTMENT MAIN TASKS
========================================================
*/

const getDepartmentTasks = async (
  req,
  res
) => {
  try {
    const {
      admin,
      error,
    } =
      await getLoggedInAdmin(
        db,
        req
      );

    if (error) {
      return res
        .status(error.status)
        .json({
          success: false,
          message:
            error.message,
        });
    }

    /*
    IMPORTANT:

    We return ONE Main Task row.

    Employees assigned to that shared Main Task
    are loaded separately through task_assignments.
    */

    const [mainTaskRows] =
      await db.query(
        `
        SELECT
          mt.task_id,
          mt.project_id,
          mt.parent_task_id,

          mt.created_by_user_id,
          mt.assigned_to_user_id,

          mt.task_title,
          mt.task_description,
          mt.task_type,

          mt.status
            AS task_status,

          mt.priority,

          COALESCE(
            mt.progress,
            0
          ) AS progress,

          DATE_FORMAT(
            mt.start_date,
            '%Y-%m-%d'
          ) AS task_start_date,

          DATE_FORMAT(
            mt.due_date,
            '%Y-%m-%d'
          ) AS task_end_date,

          mt.review_status,
          mt.reviewed_by_user_id,
          mt.reviewed_at,
          mt.review_note,

          mt.created_at
            AS task_created_at,

          mt.updated_at
            AS task_updated_at,

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
          ) AS project_end_date,

          creator.full_name
            AS created_by_name,

          creator.email
            AS created_by_email

        FROM tasks mt

        INNER JOIN projects p
          ON p.project_id =
             mt.project_id

        LEFT JOIN users creator
          ON creator.user_id =
             mt.created_by_user_id

        WHERE
          p.department_id = ?

          AND (
            mt.parent_task_id IS NULL
            OR mt.parent_task_id = 0
          )

        ORDER BY
          mt.task_id DESC
        `,
        [
          admin.department_id,
        ]
      );

    if (!mainTaskRows.length) {
      return res.json({
        success: true,

        admin,

        total: 0,

        statusCounts: {
          todo: 0,
          in_progress: 0,
          under_review: 0,
          done: 0,
          rejected: 0,
          on_hold: 0,
        },

        tasks: [],
      });
    }

    const taskIds =
      mainTaskRows.map(
        (task) =>
          Number(
            task.task_id
          )
      );

    const projectIds = [
      ...new Set(
        mainTaskRows.map(
          (task) =>
            Number(
              task.project_id
            )
        )
      ),
    ];

    /*
    MAIN TASK ASSIGNEES
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
          u.designation,
          u.department_id,

          d.department_name,

          r.role_name

        FROM task_assignments ta

        INNER JOIN users u
          ON u.user_id =
             ta.employee_id

        LEFT JOIN departments d
          ON d.department_id =
             u.department_id

        LEFT JOIN roles r
          ON r.role_id =
             u.role_id

        WHERE
          ta.task_id IN (?)

        ORDER BY
          ta.task_id,
          u.full_name
        `,
        [taskIds]
      );

    /*
    SHARED SUBTASKS
    */

    const [subtaskRows] =
      await db.query(
        `
        SELECT
          st.task_id,
          st.parent_task_id,
          st.project_id,

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

          st.created_by_user_id,

          creator.full_name
            AS created_by_name

        FROM tasks st

        LEFT JOIN users creator
          ON creator.user_id =
             st.created_by_user_id

        WHERE
          st.parent_task_id IN (?)

        ORDER BY
          st.parent_task_id,
          st.task_id
        `,
        [taskIds]
      );

    /*
    PROJECT ASSIGNEES
    */

    const [projectAssignmentRows] =
      await db.query(
        `
        SELECT
          pa.project_id,
          pa.employee_id,

          u.full_name,
          u.email,
          u.employee_code,
          u.designation,
          u.department_id,

          d.department_name

        FROM project_assignments pa

        INNER JOIN users u
          ON u.user_id =
             pa.employee_id

        LEFT JOIN departments d
          ON d.department_id =
             u.department_id

        WHERE
          pa.project_id IN (?)

          AND COALESCE(
            pa.assignment_status,
            'assigned'
          ) <> 'removed'

        ORDER BY
          pa.project_id,
          u.full_name
        `,
        [projectIds]
      );

    const assigneeMap =
      new Map();

    assignmentRows.forEach(
      (row) => {
        const taskId =
          Number(
            row.task_id
          );

        if (
          !assigneeMap.has(
            taskId
          )
        ) {
          assigneeMap.set(
            taskId,
            []
          );
        }

        assigneeMap
          .get(taskId)
          .push({
            task_id:
              taskId,

            user_id:
              row.employee_id,

            employee_id:
              row.employee_id,

            assigned_user_id:
              row.employee_id,

            full_name:
              row.full_name,

            assigned_name:
              row.full_name,

            email:
              row.email,

            assigned_email:
              row.email,

            employee_code:
              row.employee_code,

            assigned_employee_code:
              row.employee_code,

            designation:
              row.designation,

            assigned_designation:
              row.designation,

            department_id:
              row.department_id,

            assigned_department_id:
              row.department_id,

            department_name:
              row.department_name,

            assigned_department_name:
              row.department_name,

            role_name:
              row.role_name,

            assigned_role_name:
              row.role_name,

            assigned_at:
              row.assigned_at,
          });
      }
    );

    const subtaskMap =
      new Map();

    subtaskRows.forEach(
      (subtask) => {
        const parentTaskId =
          Number(
            subtask.parent_task_id
          );

        if (
          !subtaskMap.has(
            parentTaskId
          )
        ) {
          subtaskMap.set(
            parentTaskId,
            []
          );
        }

        subtaskMap
          .get(parentTaskId)
          .push({
            ...subtask,

            subtask_id:
              subtask.task_id,

            title:
              subtask.task_title,

            description:
              subtask.task_description,

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

            end_date:
              subtask.due_date,
          });
      }
    );

    const projectAssigneeMap =
      new Map();

    projectAssignmentRows.forEach(
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

            employee_code:
              row.employee_code,

            designation:
              row.designation,

            department_id:
              row.department_id,

            department_name:
              row.department_name,
          });
      }
    );

    const statusCounts = {
      todo: 0,
      in_progress: 0,
      under_review: 0,
      done: 0,
      rejected: 0,
      on_hold: 0,
    };

    const tasks =
      mainTaskRows.map(
        (task) => {
          const taskId =
            Number(
              task.task_id
            );

          const projectId =
            Number(
              task.project_id
            );

          const status =
            normalizeStatus(
              task.task_status
            );

          const statusGroup =
            getStatusGroup(
              status
            );

          statusCounts[
            statusGroup
          ] += 1;

          const assignees =
            assigneeMap.get(
              taskId
            ) || [];

          const subtasks =
            subtaskMap.get(
              taskId
            ) || [];

          const projectAssignees =
            projectAssigneeMap.get(
              projectId
            ) || [];

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

          const primaryAssignee =
            assignees[0] || {};

          return {
            ...task,

            main_task_key:
              String(taskId),

            task_status:
              status,

            status,

            status_group:
              statusGroup,

            status_label:
              getStatusLabel(
                status
              ),

            progress:
              Number(
                task.progress ||
                  0
              ),

            total_subtasks:
              subtasks.length,

            completed_subtasks:
              completedSubtasks,

            subtasks,

            /*
            SHARED MAIN TASK ASSIGNEES
            */

            assignees,

            main_task_assignees:
              assignees,

            assigned_names:
              assignees
                .map(
                  (employee) =>
                    employee.full_name
                )
                .filter(Boolean)
                .join(", ") ||
              "-",

            assigned_emails:
              assignees
                .map(
                  (employee) =>
                    employee.email
                )
                .filter(Boolean)
                .join(", ") ||
              "-",

            /*
            Legacy frontend compatibility
            */

            assigned_user_id:
              primaryAssignee.user_id ||
              null,

            assigned_name:
              primaryAssignee.full_name ||
              "-",

            assigned_email:
              primaryAssignee.email ||
              "",

            assigned_employee_code:
              primaryAssignee.employee_code ||
              "",

            assigned_designation:
              primaryAssignee.designation ||
              "",

            assigned_department_id:
              primaryAssignee.department_id ||
              null,

            assigned_department_name:
              primaryAssignee.department_name ||
              "",

            assigned_role_name:
              primaryAssignee.role_name ||
              "",

            /*
            Project assignees
            */

            project_assignees:
              projectAssignees,

            project_assigned_names:
              projectAssignees
                .map(
                  (employee) =>
                    employee.full_name
                )
                .filter(Boolean)
                .join(", ") ||
              "-",

            project_assigned_emails:
              projectAssignees
                .map(
                  (employee) =>
                    employee.email
                )
                .filter(Boolean)
                .join(", ") ||
              "-",

            total_project_assignees:
              projectAssignees.length,

            is_rejected:
              status ===
              "rejected",

            rejection_reason:
              status ===
              "rejected"
                ? task.review_note ||
                  null
                : null,
          };
        }
      );

    return res.json({
      success: true,

      admin,

      total:
        tasks.length,

      statusCounts,

      tasks,
    });
  } catch (error) {
    console.error(
      "Get department tasks error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to fetch department Main Tasks.",

      error:
        error.message,

      sqlMessage:
        error.sqlMessage ||
        null,
    });
  }
};

/*
========================================================
ADMIN MAIN TASK REVIEW

Approve
=> Done

To Do
=> return to Employee To Do

In Progress
=> return to Employee In Progress

On Hold
=> On Hold

Reject
=> Rejected
========================================================
*/

const reviewDepartmentTask = async (
  req,
  res
) => {
  const connection =
    await db.getConnection();

  try {
    const {
      admin,
      error,
    } =
      await getLoggedInAdmin(
        connection,
        req
      );

    if (error) {
      return res
        .status(error.status)
        .json({
          success: false,
          message:
            error.message,
        });
    }

    const rawTaskIds =
      Array.isArray(
        req.body.task_ids
      )
        ? req.body.task_ids
        : [
            req.body.task_id ||
              req.params.taskId,
          ];

    const taskIds = [
      ...new Set(
        rawTaskIds
          .map(Number)
          .filter(Boolean)
      ),
    ];

    if (!taskIds.length) {
      return res.status(400).json({
        success: false,
        message:
          "Main Task ID is required.",
      });
    }

    const rawAction =
      String(
        req.body.action ||
          ""
      )
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "_")
        .replace(/-/g, "_");

    let action;

    if (
      [
        "approve",
        "approved",
        "done",
        "complete",
        "completed",
      ].includes(rawAction)
    ) {
      action =
        "approve";
    } else if (
      [
        "to_do",
        "todo",
        "not_started",
        "send_to_todo",
        "return_to_todo",
      ].includes(rawAction)
    ) {
      action =
        "to_do";
    } else if (
      [
        "in_progress",
        "ongoing",
        "progress",
        "send_to_in_progress",
        "return_to_in_progress",
      ].includes(rawAction)
    ) {
      action =
        "in_progress";
    } else if (
      [
        "on_hold",
        "hold",
      ].includes(rawAction)
    ) {
      action =
        "on_hold";
    } else if (
      [
        "reject",
        "rejected",
      ].includes(rawAction)
    ) {
      action =
        "reject";
    } else {
      return res.status(400).json({
        success: false,
        message:
          "Invalid review action.",
      });
    }

    const remark =
      String(
        req.body.remark ||
          req.body.review_note ||
          ""
      ).trim();

    /*
    Every action except Approve
    requires a remark.
    */

    if (
      action !==
        "approve" &&
      !remark
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please add a remark for this review action.",
      });
    }

    const placeholders =
      taskIds
        .map(() => "?")
        .join(",");

    const [taskRows] =
      await connection.query(
        `
        SELECT
          mt.task_id,
          mt.project_id,
          mt.task_title,
          mt.status,

          p.project_title,
          p.department_id

        FROM tasks mt

        INNER JOIN projects p
          ON p.project_id =
             mt.project_id

        WHERE
          mt.task_id IN (
            ${placeholders}
          )

          AND (
            mt.parent_task_id IS NULL
            OR mt.parent_task_id = 0
          )
        `,
        taskIds
      );

    if (
      taskRows.length !==
      taskIds.length
    ) {
      return res.status(404).json({
        success: false,
        message:
          "One or more Main Tasks were not found.",
      });
    }

    const unauthorizedTask =
      taskRows.find(
        (task) =>
          Number(
            task.department_id
          ) !==
          Number(
            admin.department_id
          )
      );

    if (unauthorizedTask) {
      return res.status(403).json({
        success: false,
        message:
          "You can only review Main Tasks from your own department.",
      });
    }

    /*
    Review actions are allowed only while
    Main Task is Under Review.
    */

    const invalidTask =
      taskRows.find(
        (task) =>
          normalizeStatus(
            task.status
          ) !==
          "under_review"
      );

    if (invalidTask) {
      return res.status(400).json({
        success: false,

        message:
          `"${invalidTask.task_title}" is not currently Under Review.`,
      });
    }

    let nextStatus;
    let nextReviewStatus;

    if (
      action ===
      "approve"
    ) {
      nextStatus =
        "completed";

      nextReviewStatus =
        "approved";
    } else if (
      action ===
      "to_do"
    ) {
      nextStatus =
        "not_started";

      nextReviewStatus =
        "changes_requested";
    } else if (
      action ===
      "in_progress"
    ) {
      nextStatus =
        "ongoing";

      nextReviewStatus =
        "changes_requested";
    } else if (
      action ===
      "on_hold"
    ) {
      nextStatus =
        "on_hold";

      nextReviewStatus =
        "on_hold";
    } else {
      nextStatus =
        "rejected";

      nextReviewStatus =
        "rejected";
    }

    await connection.beginTransaction();

    if (
      action ===
      "approve"
    ) {
      await connection.query(
        `
        UPDATE tasks

        SET
          status = 'completed',
          progress = 100,

          review_status =
            'approved',

          reviewed_by_user_id = ?,
          reviewed_at = NOW(),
          review_note = ?,

          completed_at = NOW(),
          updated_at = NOW()

        WHERE
          task_id IN (
            ${placeholders}
          )
        `,
        [
          admin.user_id,
          remark || null,
          ...taskIds,
        ]
      );
    } else {
      /*
      IMPORTANT:

      Existing completed Subtasks are NOT deleted
      or reset.

      If Admin returns task for rework,
      employee can add additional Subtasks.
      */

      await connection.query(
        `
        UPDATE tasks

        SET
          status = ?,

          review_status = ?,

          reviewed_by_user_id = ?,
          reviewed_at = NOW(),
          review_note = ?,

          completed_at = NULL,
          updated_at = NOW()

        WHERE
          task_id IN (
            ${placeholders}
          )
        `,
        [
          nextStatus,
          nextReviewStatus,
          admin.user_id,
          remark,
          ...taskIds,
        ]
      );
    }

    const projectIds = [
      ...new Set(
        taskRows.map(
          (task) =>
            Number(
              task.project_id
            )
        )
      ),
    ];

    const projectResults =
      [];

    for (
      const projectId
      of projectIds
    ) {
      const result =
        await recalculateProject(
          connection,
          projectId
        );

      projectResults.push({
        project_id:
          projectId,

        status:
          result?.status,

        progress:
          result?.progress,
      });
    }

    await connection.commit();

    const messages = {
      approve:
        "Main Task approved and moved to Done.",

      to_do:
        "Main Task returned to Employee To Do.",

      in_progress:
        "Main Task returned to Employee In Progress.",

      on_hold:
        "Main Task placed On Hold.",

      reject:
        "Main Task rejected.",
    };

    return res.json({
      success: true,

      message:
        messages[action],

      action,

      task_ids:
        taskIds,

      task_status:
        nextStatus,

      review_status:
        nextReviewStatus,

      projects:
        projectResults,
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    console.error(
      "Review department Main Task error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to review Main Task.",

      error:
        error.message,

      sqlMessage:
        error.sqlMessage ||
        null,
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getDepartmentTasks,
  reviewDepartmentTask,
};
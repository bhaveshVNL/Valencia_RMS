const db = require("../config/db");

const {
  sendProjectAssignmentEmails,
  sendProjectUpdateEmails,
  sendMainTaskAssignmentEmails,
} = require("../utils/projectemailnotifications");

/*
========================================================
HELPERS
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

const getLoggedInDepartmentId = (req) => {
  return Number(
    req.user?.department_id ||
      req.user?.departmentId ||
      0
  );
};

const normalizeIdArray = (value) => {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .map((item) => Number(item))
        .filter(
          (item) =>
            Number.isInteger(item) &&
            item > 0
        )
    ),
  ];
};

const formatDateOnly = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
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
      "not_started",
      "pending",
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

/*
========================================================
PROJECT ASSIGNMENTS

Project assignment and Main Task assignment are separate.

project_assignments
= employees who belong to / can see the project

task_assignments
= employees assigned to one specific Main Task
========================================================
*/

const syncProjectAssignments = async (
  connection,
  projectId,
  employeeIds,
  assignedByUserId
) => {
  await connection.query(
    `
    DELETE FROM project_assignments
    WHERE project_id = ?
    `,
    [projectId]
  );

  for (const employeeId of employeeIds) {
    await connection.query(
      `
      INSERT INTO project_assignments (
        project_id,
        employee_id,
        assigned_by_user_id,
        assignment_status,
        employee_progress,
        assigned_at
      )
      VALUES (
        ?,
        ?,
        ?,
        'assigned',
        0,
        NOW()
      )
      `,
      [
        projectId,
        employeeId,
        assignedByUserId || null,
      ]
    );
  }
};

/*
========================================================
MAIN TASK ASSIGNMENTS

IMPORTANT:
One Main Task row only.

Multiple employees are linked through task_assignments.
========================================================
*/

const syncMainTaskAssignments = async (
  connection,
  taskId,
  employeeIds,
  assignedByUserId
) => {
  await connection.query(
    `
    DELETE FROM task_assignments
    WHERE task_id = ?
    `,
    [taskId]
  );

  for (const employeeId of employeeIds) {
    await connection.query(
      `
      INSERT INTO task_assignments (
        task_id,
        employee_id,
        assigned_by_user_id,
        assigned_at
      )
      VALUES (
        ?,
        ?,
        ?,
        NOW()
      )
      `,
      [
        taskId,
        employeeId,
        assignedByUserId || null,
      ]
    );
  }

  /*
  Keep assigned_to_user_id populated for old parts
  of the RMS that may still depend on it.

  It represents the first / primary employee only.

  task_assignments remains the real multi-user source.
  */
  const primaryEmployeeId =
    employeeIds.length > 0
      ? employeeIds[0]
      : null;

  await connection.query(
    `
    UPDATE tasks
    SET assigned_to_user_id = ?
    WHERE task_id = ?
    `,
    [
      primaryEmployeeId,
      taskId,
    ]
  );
};

/*
========================================================
ASSIGNABLE USERS

Admin should see employees from their own department
while creating / editing projects.
========================================================
*/

const getAssignableUsersForAdminProjects = async (
  req,
  res
) => {
  try {
    const values = [];
const departmentCondition = "";
    const [users] = await db.query(
      `
      SELECT
        u.user_id,
        u.full_name,
        u.email,
        u.employee_code,
        u.designation,
        u.status,
        u.department_id,

        d.department_name,

        r.role_id,
        r.role_name

      FROM users u

      LEFT JOIN departments d
        ON d.department_id =
           u.department_id

      LEFT JOIN roles r
        ON r.role_id =
           u.role_id

      WHERE
        LOWER(
          COALESCE(
            u.status,
            'active'
          )
        ) = 'active'

        ${departmentCondition}

        AND LOWER(
  COALESCE(
    r.role_name,
    ''
  )
) IN ('employee', 'administrator', 'admin')

      ORDER BY
        u.full_name ASC
      `,
      values
    );

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error(
      "Get assignable project users error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
  "Failed to fetch assignable employees.",
      error: error.message,
    });
  }
};

/*
========================================================
GET ADMIN PROJECTS
========================================================
*/

const getAdminProjects = async (
  req,
  res
) => {
  try {
    const adminUserId =
      getLoggedInUserId(req);

    const adminDepartmentId =
      getLoggedInDepartmentId(req);

    const whereParts = [];
    const whereValues = [];

    /*
    Department admin should normally see:
    - projects in their department
    - projects created by them

    OR is intentional here because older records
    may not have department_id populated.
    */
    if (
      adminDepartmentId &&
      adminUserId
    ) {
      whereParts.push(
        `
        (
          p.department_id = ?
          OR p.created_by_user_id = ?
        )
        `
      );

      whereValues.push(
        adminDepartmentId,
        adminUserId
      );
    } else if (adminDepartmentId) {
      whereParts.push(
        "p.department_id = ?"
      );

      whereValues.push(
        adminDepartmentId
      );
    } else if (adminUserId) {
      whereParts.push(
        "p.created_by_user_id = ?"
      );

      whereValues.push(
        adminUserId
      );
    }

    const whereClause =
      whereParts.length > 0
        ? `WHERE ${whereParts.join(" AND ")}`
        : "";

    const [projects] = await db.query(
      `
      SELECT
        p.project_id,
        p.created_by_user_id,
        p.department_id,
        p.project_title,
        p.project_description,
        p.priority,
        p.status,
        p.division,

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

        p.completed_at,

        COALESCE(
          p.overall_progress,
          0
        ) AS overall_progress,

        p.created_at,
        p.updated_at,

        creator.full_name
          AS created_by_name,

        creator.email
          AS created_by_email,

        d.department_name

      FROM projects p

      LEFT JOIN users creator
        ON creator.user_id =
           p.created_by_user_id

      LEFT JOIN departments d
        ON d.department_id =
           p.department_id

      ${whereClause}

      ORDER BY
        p.project_id DESC
      `,
      whereValues
    );

    if (!projects.length) {
      return res.status(200).json({
        success: true,
        projects: [],
      });
    }

    const projectIds = projects.map(
      (project) =>
        Number(project.project_id)
    );

    /*
    ----------------------------------------------
    PROJECT ASSIGNEES
    ----------------------------------------------
    */

    const [projectAssignmentRows] =
      await db.query(
        `
        SELECT
          pa.assignment_id,
          pa.project_id,
          pa.employee_id,
          pa.assignment_status,
          pa.employee_progress,
          pa.assigned_at,

          u.full_name,
          u.email,
          u.employee_code,
          u.designation,

          d.department_name,

          r.role_name

        FROM project_assignments pa

        INNER JOIN users u
          ON u.user_id =
             pa.employee_id

        LEFT JOIN departments d
          ON d.department_id =
             u.department_id

        LEFT JOIN roles r
          ON r.role_id =
             u.role_id

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
    ----------------------------------------------
    MAIN TASKS
    ----------------------------------------------
    */

    const [mainTaskRows] =
      await db.query(
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

          t.created_at,
          t.updated_at,

          creator.full_name
            AS created_by_name,

          creator.email
            AS created_by_email,

          (
            SELECT COUNT(*)
            FROM tasks st
            WHERE
              st.parent_task_id =
              t.task_id
          ) AS total_subtasks,

          (
            SELECT COUNT(*)
            FROM tasks st
            WHERE
              st.parent_task_id =
              t.task_id

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

        FROM tasks t

        LEFT JOIN users creator
          ON creator.user_id =
             t.created_by_user_id

        WHERE
          t.project_id IN (?)

          AND (
            t.parent_task_id IS NULL
            OR t.parent_task_id = 0
          )

        ORDER BY
          t.task_id DESC
        `,
        [projectIds]
      );

    /*
    ----------------------------------------------
    MAIN TASK ASSIGNEES
    ----------------------------------------------
    */

    const mainTaskIds =
      mainTaskRows.map(
        (task) =>
          Number(task.task_id)
      );

    let taskAssignmentRows = [];

    if (mainTaskIds.length > 0) {
      const [rows] = await db.query(
        `
        SELECT
          ta.task_assignment_id,
          ta.task_id,
          ta.employee_id,
          ta.assigned_by_user_id,
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
          ta.task_id IN (?)

        ORDER BY
          u.full_name ASC
        `,
        [mainTaskIds]
      );

      taskAssignmentRows = rows;
    }

    /*
    ----------------------------------------------
    BUILD MAPS
    ----------------------------------------------
    */

    const projectAssigneeMap =
      new Map();

    for (
      const assignment
      of projectAssignmentRows
    ) {
      const projectId =
        Number(
          assignment.project_id
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

          department_name:
            assignment.department_name,

          role_name:
            assignment.role_name,

          assignment_status:
            assignment.assignment_status,

          employee_progress:
            Number(
              assignment.employee_progress ||
                0
            ),

          assigned_at:
            assignment.assigned_at,
        });
    }

    const taskAssigneeMap =
      new Map();

    for (
      const assignment
      of taskAssignmentRows
    ) {
      const taskId =
        Number(
          assignment.task_id
        );

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

          department_name:
            assignment.department_name,

          assigned_at:
            assignment.assigned_at,
        });
    }

    const taskMapByProject =
      new Map();

    for (
      const task
      of mainTaskRows
    ) {
      const projectId =
        Number(task.project_id);

      if (
        !taskMapByProject.has(
          projectId
        )
      ) {
        taskMapByProject.set(
          projectId,
          []
        );
      }

      const taskAssignees =
        taskAssigneeMap.get(
          Number(task.task_id)
        ) || [];

      taskMapByProject
        .get(projectId)
        .push({
          ...task,

          start_date:
            formatDateOnly(
              task.start_date
            ),

          due_date:
            formatDateOnly(
              task.due_date
            ),

          status:
            normalizeStatus(
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

          assignees:
            taskAssignees,

          assignee_ids:
            taskAssignees.map(
              (employee) =>
                Number(
                  employee.employee_id
                )
            ),

          assigned_names:
            taskAssignees
              .map(
                (employee) =>
                  employee.full_name
              )
              .filter(Boolean)
              .join(", "),

          assigned_emails:
            taskAssignees
              .map(
                (employee) =>
                  employee.email
              )
              .filter(Boolean)
              .join(", "),
        });
    }

    /*
    ----------------------------------------------
    FINAL PROJECT RESPONSE
    ----------------------------------------------
    */

    const formattedProjects =
      projects.map(
        (project) => {
          const projectId =
            Number(
              project.project_id
            );

          return {
            ...project,

            start_date:
              formatDateOnly(
                project.start_date
              ),

            due_date:
              formatDateOnly(
                project.due_date
              ),

            end_date:
              formatDateOnly(
                project.due_date
              ),

            status:
              normalizeStatus(
                project.status
              ),

            overall_progress:
              Number(
                project.overall_progress ||
                  0
              ),

            assignees:
              projectAssigneeMap.get(
                projectId
              ) || [],

            main_tasks:
              taskMapByProject.get(
                projectId
              ) || [],
          };
        }
      );

    return res.status(200).json({
      success: true,
      projects:
        formattedProjects,
    });
  } catch (error) {
    console.error(
      "Get admin projects error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch projects.",
      error: error.message,
      sqlMessage:
        error.sqlMessage || null,
    });
  }
};

/*
========================================================
CREATE PROJECT
========================================================
*/

const createAdminProject = async (
  req,
  res
) => {
  const connection =
    await db.getConnection();

  try {
    const adminUserId =
      getLoggedInUserId(req);

    const adminDepartmentId =
      getLoggedInDepartmentId(req);

    const adminUser = {
      user_id:
        adminUserId,

      full_name:
        req.user?.full_name ||
        req.user?.name ||
        "Admin",

      email:
        req.user?.email ||
        process.env.SMTP_USER,
    };

    const projectTitle =
      req.body.project_title ||
      req.body.title ||
      req.body.project_name;

    const projectDescription =
      req.body.project_description ||
      req.body.description ||
      req.body.project_details ||
      "";

    const priority =
      req.body.priority ||
      "medium";

    const startDate =
      formatDateOnly(
        req.body.start_date ||
          req.body.startDate ||
          req.body.project_start_date
      );

    const dueDate =
      formatDateOnly(
        req.body.due_date ||
          req.body.end_date ||
          req.body.endDate ||
          req.body.dueDate ||
          req.body.project_end_date
      );

    const assigneeIds =
      normalizeIdArray(
        req.body.assignee_ids ||
          req.body.assignees ||
          req.body.project_assignees
      );

    if (
      !projectTitle ||
      !String(
        projectTitle
      ).trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Project title is required.",
      });
    }

    if (
      !startDate ||
      !dueDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Project start date and deadline are required.",
      });
    }

    if (
      startDate > dueDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Project start date cannot be after project deadline.",
      });
    }

    if (
      !assigneeIds.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Select at least one project employee.",
      });
    }

    /*
    Ensure selected employees belong to Admin's department.
    */

    if (
      adminDepartmentId
    ) {
      const [validEmployees] =
        await connection.query(
          `
          SELECT
            u.user_id

          FROM users u

          LEFT JOIN roles r
            ON r.role_id =
               u.role_id

          WHERE
            u.user_id IN (?)

            AND u.department_id = ?

            AND LOWER(
              COALESCE(
                u.status,
                'active'
              )
            ) = 'active'

            AND LOWER(
  COALESCE(
    r.role_name,
    ''
  )
) NOT IN ('superadmin')
          `,
          [
            assigneeIds,
            adminDepartmentId,
          ]
        );

      const validIds =
        new Set(
          validEmployees.map(
            (employee) =>
              Number(
                employee.user_id
              )
          )
        );

      const invalidIds =
        assigneeIds.filter(
          (id) =>
            !validIds.has(
              Number(id)
            )
        );

      if (
        invalidIds.length
      ) {
        return res.status(400).json({
          success: false,
          message:
            "One or more selected employees do not belong to your department.",
        });
      }
    }

    await connection.beginTransaction();

    const [result] =
      await connection.query(
        `
        INSERT INTO projects (
          created_by_user_id,
          department_id,
          division,
          project_title,
          project_description,
          priority,
          status,
          start_date,
          due_date,
          overall_progress,
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
          'not_started',
          ?,
          ?,
          0,
          NOW(),
          NOW()
        )
        `,
        [
          adminUserId,
          adminDepartmentId,
          req.body.division || null,
          String(projectTitle).trim(),
          String(projectDescription).trim(),
          priority,
          startDate,
          dueDate,
        ]
      );

    const projectId =
      result.insertId;

    await syncProjectAssignments(
      connection,
      projectId,
      assigneeIds,
      adminUserId
    );

    await connection.commit();

    let emailSummary = null;

    try {
      emailSummary =
        await sendProjectAssignmentEmails(
          projectId,
          adminUser
        );
    } catch (emailError) {
      console.error(
        "Project assignment email error:",
        emailError
      );
    }

    return res.status(201).json({
      success: true,
      message:
        "Project created successfully.",
      project_id:
        projectId,
      assignee_ids:
        assigneeIds,
      email_summary:
        emailSummary,
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    console.error(
      "Create admin project error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create project.",
      error: error.message,
      sqlMessage:
        error.sqlMessage || null,
    });
  } finally {
    connection.release();
  }
};

/*
========================================================
UPDATE PROJECT
========================================================
*/

const updateAdminProject = async (
  req,
  res
) => {
  const connection =
    await db.getConnection();

  try {
    const adminUserId =
      getLoggedInUserId(req);

    const projectId =
      Number(
        req.params.projectId ||
          req.params.id
      );

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message:
          "Project ID is required.",
      });
    }

    const adminUser = {
      user_id:
        adminUserId,

      full_name:
        req.user?.full_name ||
        req.user?.name ||
        "Admin",

      email:
        req.user?.email ||
        process.env.SMTP_USER,
    };
    const division =
  req.body.division || null;

    const projectTitle =
      req.body.project_title ||
      req.body.title;

    const projectDescription =
      req.body.project_description ||
      req.body.description ||
      "";

    const priority =
      req.body.priority ||
      "medium";

    const startDate =
      formatDateOnly(
        req.body.start_date ||
          req.body.startDate
      );

    const dueDate =
      formatDateOnly(
        req.body.due_date ||
          req.body.end_date ||
          req.body.endDate ||
          req.body.dueDate
      );

    const assigneeIds =
      normalizeIdArray(
        req.body.assignee_ids ||
          req.body.assignees ||
          req.body.project_assignees
      );

    if (
      !projectTitle ||
      !String(
        projectTitle
      ).trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Project title is required.",
      });
    }

    if (
      !startDate ||
      !dueDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Project start date and deadline are required.",
      });
    }

    if (
      startDate > dueDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Project start date cannot be after project deadline.",
      });
    }

    if (
      !assigneeIds.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Select at least one project employee.",
      });
    }

    await connection.beginTransaction();

    const [existingRows] =
      await connection.query(
        `
        SELECT
          project_id
        FROM projects
        WHERE project_id = ?
        LIMIT 1
        `,
        [projectId]
      );

    if (
      !existingRows.length
    ) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          "Project not found.",
      });
    }

    await connection.query(
      `
      UPDATE projects

      SET
        project_title = ?,
        project_description = ?,
        priority = ?,
        start_date = ?,
        due_date = ?,
        division = ?,
        updated_at = NOW()

      WHERE project_id = ?
      `,
      [
  String(
    projectTitle
  ).trim(),

  String(
    projectDescription
  ).trim(),

  priority,
  startDate,
  dueDate,
  division,
  projectId,
]
    );

    await syncProjectAssignments(
      connection,
      projectId,
      assigneeIds,
      adminUserId
    );

    await connection.commit();

    let emailSummary = null;

    try {
      emailSummary =
        await sendProjectUpdateEmails(
          projectId,
          adminUser,
          {
            projectTitle,
            projectDescription,
            startDate,
            endDate:
              dueDate,
            dueDate,
          }
        );
    } catch (emailError) {
      console.error(
        "Project update email error:",
        emailError
      );
    }

    return res.status(200).json({
      success: true,
      message:
        "Project updated successfully.",
      project_id:
        projectId,
      assignee_ids:
        assigneeIds,
      email_summary:
        emailSummary,
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    console.error(
      "Update admin project error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update project.",
      error: error.message,
      sqlMessage:
        error.sqlMessage || null,
    });
  } finally {
    connection.release();
  }
};

/*
========================================================
DELETE PROJECT

Delete children first so DB deletion actually occurs.

task_assignments is also ON DELETE CASCADE, but it is
removed explicitly for compatibility / clarity.
========================================================
*/

const deleteAdminProject = async (
  req,
  res
) => {
  const connection =
    await db.getConnection();

  try {
    const projectId =
      Number(
        req.params.projectId ||
          req.params.id
      );

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message:
          "Project ID is required.",
      });
    }

    await connection.beginTransaction();

    const [projectRows] =
      await connection.query(
        `
        SELECT
          project_id
        FROM projects
        WHERE project_id = ?
        LIMIT 1
        `,
        [projectId]
      );

    if (
      !projectRows.length
    ) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          "Project not found.",
      });
    }

    /*
    Delete task assignment rows for every
    task belonging to this project.
    */

    await connection.query(
      `
      DELETE ta

      FROM task_assignments ta

      INNER JOIN tasks t
        ON t.task_id =
           ta.task_id

      WHERE
        t.project_id = ?
      `,
      [projectId]
    );

    /*
    Delete subtasks first.
    */

    await connection.query(
      `
      DELETE FROM tasks
      WHERE
        project_id = ?
        AND parent_task_id IS NOT NULL
        AND parent_task_id <> 0
      `,
      [projectId]
    );

    /*
    Delete Main Tasks.
    */

    await connection.query(
      `
      DELETE FROM tasks
      WHERE project_id = ?
      `,
      [projectId]
    );

    /*
    Delete Project assignments.
    */

    await connection.query(
      `
      DELETE FROM project_assignments
      WHERE project_id = ?
      `,
      [projectId]
    );

    /*
    Finally delete Project.
    */

    const [deleteResult] =
      await connection.query(
        `
        DELETE FROM projects
        WHERE project_id = ?
        `,
        [projectId]
      );

    if (
      !deleteResult.affectedRows
    ) {
      throw new Error(
        "Project deletion did not affect any project row."
      );
    }

    await connection.commit();

    return res.status(200).json({
      success: true,
      message:
        "Project deleted successfully.",
      project_id:
        projectId,
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    console.error(
      "Delete admin project error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete project from database.",
      error: error.message,
      sqlMessage:
        error.sqlMessage || null,
    });
  } finally {
    connection.release();
  }
};

/*
========================================================
CREATE MAIN TASK

ONE tasks row
+
multiple task_assignments rows
========================================================
*/

const createMainTask = async (
  req,
  res
) => {
  const connection =
    await db.getConnection();

  try {
    const adminUserId =
      getLoggedInUserId(req);

    const adminUser = {
      user_id:
        adminUserId,

      full_name:
        req.user?.full_name ||
        req.user?.name ||
        "Admin",

      email:
        req.user?.email ||
        process.env.SMTP_USER,
    };

    const projectId =
      Number(
        req.params.projectId ||
          req.body.project_id
      );

    const taskTitle =
      req.body.task_title ||
      req.body.title;

    const taskDescription =
      req.body.task_description ||
      req.body.description ||
      "";

    const priority =
      req.body.priority ||
      "medium";

    const assigneeIds =
      normalizeIdArray(
        req.body.assignee_ids ||
          req.body.assignees ||
          req.body.assigned_to_user_ids
      );

    const requestedStartDate =
      formatDateOnly(
        req.body.start_date ||
          req.body.startDate
      );

    const requestedDueDate =
      formatDateOnly(
        req.body.due_date ||
          req.body.end_date ||
          req.body.endDate ||
          req.body.deadline
      );

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message:
          "Project ID is required.",
      });
    }

    if (
      !taskTitle ||
      !String(
        taskTitle
      ).trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Main Task title is required.",
      });
    }

    if (
      !assigneeIds.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Select at least one employee for the Main Task.",
      });
    }

    await connection.beginTransaction();

    /*
    Get Project dates.
    */

    const [projectRows] =
      await connection.query(
        `
        SELECT
          project_id,
          project_title,

          DATE_FORMAT(
            start_date,
            '%Y-%m-%d'
          ) AS start_date,

          DATE_FORMAT(
            due_date,
            '%Y-%m-%d'
          ) AS due_date

        FROM projects

        WHERE
          project_id = ?

        LIMIT 1
        `,
        [projectId]
      );

    if (
      !projectRows.length
    ) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          "Project not found.",
      });
    }

    const project =
      projectRows[0];

    /*
    Main Task gets its OWN deadline.

    If frontend hasn't yet sent it,
    temporarily fall back to Project dates
    so current UI does not break.

    After Admin frontend is updated,
    Main Task dates will come explicitly.
    */

    const taskStartDate =
      requestedStartDate ||
      project.start_date;

    const taskDueDate =
      requestedDueDate ||
      project.due_date;

    if (
      !taskStartDate ||
      !taskDueDate
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          "Main Task start date and deadline are required.",
      });
    }

    if (
      taskStartDate >
      taskDueDate
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          "Main Task start date cannot be after its deadline.",
      });
    }

    if (
      project.start_date &&
      taskStartDate <
        project.start_date
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          `Main Task start date cannot be before Project start date (${project.start_date}).`,
      });
    }

    if (
      project.due_date &&
      taskDueDate >
        project.due_date
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          `Main Task deadline cannot exceed Project deadline (${project.due_date}).`,
      });
    }

    /*
    Every Main Task employee should also belong
    to this Project.

    If employee is not already there, add them
    to project_assignments automatically.

    This avoids a Main Task being assigned while
    Employee Projects cannot see its Project.
    */

    for (
      const employeeId
      of assigneeIds
    ) {
      await connection.query(
        `
        INSERT INTO project_assignments (
          project_id,
          employee_id,
          assigned_by_user_id,
          assignment_status,
          employee_progress,
          assigned_at
        )

        SELECT
          ?,
          ?,
          ?,
          'assigned',
          0,
          NOW()

        WHERE NOT EXISTS (
          SELECT 1
          FROM project_assignments
          WHERE
            project_id = ?
            AND employee_id = ?
            AND COALESCE(
              assignment_status,
              'assigned'
            ) <> 'removed'
        )
        `,
        [
          projectId,
          employeeId,
          adminUserId || null,
          projectId,
          employeeId,
        ]
      );
    }

    /*
    Create ONE Main Task row.
    */

    const primaryEmployeeId =
      assigneeIds[0];

    const [taskResult] =
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
          NULL,
          ?,
          ?,
          ?,
          ?,
          'main',
          'not_started',
          ?,
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
          adminUserId || null,
          primaryEmployeeId,
          String(
            taskTitle
          ).trim(),

          String(
            taskDescription
          ).trim(),

          priority,
          taskStartDate,
          taskDueDate,
        ]
      );

    const taskId =
      taskResult.insertId;

    /*
    Link all employees to SAME Main Task.
    */

    await syncMainTaskAssignments(
      connection,
      taskId,
      assigneeIds,
      adminUserId
    );

    await connection.commit();

    let emailSummary = null;

    try {
      emailSummary =
        await sendMainTaskAssignmentEmails(
          projectId,
          [taskId],
          adminUser
        );
    } catch (emailError) {
      console.error(
        "Main Task assignment email error:",
        emailError
      );
    }

    return res.status(201).json({
      success: true,

      message:
        "Main Task added successfully.",

      task_id:
        taskId,

      /*
      Keep array too because older Admin frontend
      may expect task_ids.
      */
      task_ids: [
        taskId,
      ],

      assignee_ids:
        assigneeIds,

      start_date:
        taskStartDate,

      due_date:
        taskDueDate,

      email_summary:
        emailSummary,
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    console.error(
      "Create Main Task error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to add Main Task.",
      error: error.message,
      sqlMessage:
        error.sqlMessage || null,
    });
  } finally {
    connection.release();
  }
};

/*
========================================================
UPDATE MAIN TASK

VERY IMPORTANT:

DO NOT delete and recreate Main Task.

Existing Subtasks have:
parent_task_id = this Main Task task_id

Therefore Main Task ID must remain unchanged.
========================================================
*/

const updateMainTask = async (
  req,
  res
) => {
  const connection =
    await db.getConnection();

  try {
    const adminUserId =
      getLoggedInUserId(req);

    const adminUser = {
      user_id:
        adminUserId,

      full_name:
        req.user?.full_name ||
        req.user?.name ||
        "Admin",

      email:
        req.user?.email ||
        process.env.SMTP_USER,
    };

    const taskId =
      Number(
        req.params.taskId ||
          req.body.task_id
      );

    const taskTitle =
      req.body.task_title ||
      req.body.title;

    const taskDescription =
      req.body.task_description ||
      req.body.description ||
      "";

    const priority =
      req.body.priority ||
      "medium";

    const assigneeIds =
      normalizeIdArray(
        req.body.assignee_ids ||
          req.body.assignees ||
          req.body.assigned_to_user_ids
      );

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message:
          "Main Task ID is required.",
      });
    }

    if (
      !taskTitle ||
      !String(
        taskTitle
      ).trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Main Task title is required.",
      });
    }

    if (
      !assigneeIds.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Select at least one employee for the Main Task.",
      });
    }

    await connection.beginTransaction();

    const [taskRows] =
      await connection.query(
        `
        SELECT
          t.task_id,
          t.project_id,
          t.parent_task_id,
          t.status,

          DATE_FORMAT(
            t.start_date,
            '%Y-%m-%d'
          ) AS start_date,

          DATE_FORMAT(
            t.due_date,
            '%Y-%m-%d'
          ) AS due_date,

          DATE_FORMAT(
            p.start_date,
            '%Y-%m-%d'
          ) AS project_start_date,

          DATE_FORMAT(
            p.due_date,
            '%Y-%m-%d'
          ) AS project_due_date

        FROM tasks t

        INNER JOIN projects p
          ON p.project_id =
             t.project_id

        WHERE
          t.task_id = ?

          AND (
            t.parent_task_id IS NULL
            OR t.parent_task_id = 0
          )

        LIMIT 1
        `,
        [taskId]
      );

    if (
      !taskRows.length
    ) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          "Main Task not found.",
      });
    }

    const existingTask =
      taskRows[0];

    const projectId =
      Number(
        existingTask.project_id
      );

    const taskStartDate =
      formatDateOnly(
        req.body.start_date ||
          req.body.startDate
      ) ||
      existingTask.start_date;

    const taskDueDate =
      formatDateOnly(
        req.body.due_date ||
          req.body.end_date ||
          req.body.endDate ||
          req.body.deadline
      ) ||
      existingTask.due_date;

    if (
      !taskStartDate ||
      !taskDueDate
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          "Main Task start date and deadline are required.",
      });
    }

    if (
      taskStartDate >
      taskDueDate
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          "Main Task start date cannot be after its deadline.",
      });
    }

    if (
      existingTask.project_start_date &&
      taskStartDate <
        existingTask.project_start_date
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          `Main Task start date cannot be before Project start date (${existingTask.project_start_date}).`,
      });
    }

    if (
      existingTask.project_due_date &&
      taskDueDate >
        existingTask.project_due_date
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          `Main Task deadline cannot exceed Project deadline (${existingTask.project_due_date}).`,
      });
    }

    /*
    Also prevent shortening a Main Task deadline
    earlier than an existing Subtask deadline.
    */

    const [invalidSubtasks] =
      await connection.query(
        `
        SELECT
          task_id,
          task_title,
          DATE_FORMAT(
            due_date,
            '%Y-%m-%d'
          ) AS due_date

        FROM tasks

        WHERE
          parent_task_id = ?

          AND due_date IS NOT NULL

          AND due_date > ?

        LIMIT 1
        `,
        [
          taskId,
          taskDueDate,
        ]
      );

    if (
      invalidSubtasks.length
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          `Main Task deadline cannot be earlier than existing Subtask "${invalidSubtasks[0].task_title}" deadline (${invalidSubtasks[0].due_date}).`,
      });
    }

    /*
    Update SAME task_id.
    */

    await connection.query(
      `
      UPDATE tasks

      SET
        task_title = ?,
        task_description = ?,
        priority = ?,
        start_date = ?,
        due_date = ?,
        updated_at = NOW()

      WHERE task_id = ?
      `,
      [
        String(
          taskTitle
        ).trim(),

        String(
          taskDescription
        ).trim(),

        priority,
        taskStartDate,
        taskDueDate,
        taskId,
      ]
    );

    /*
    Make sure Main Task employees also have
    Project assignment.
    */

    for (
      const employeeId
      of assigneeIds
    ) {
      await connection.query(
        `
        INSERT INTO project_assignments (
          project_id,
          employee_id,
          assigned_by_user_id,
          assignment_status,
          employee_progress,
          assigned_at
        )

        SELECT
          ?,
          ?,
          ?,
          'assigned',
          0,
          NOW()

        WHERE NOT EXISTS (
          SELECT 1
          FROM project_assignments
          WHERE
            project_id = ?
            AND employee_id = ?
            AND COALESCE(
              assignment_status,
              'assigned'
            ) <> 'removed'
        )
        `,
        [
          projectId,
          employeeId,
          adminUserId || null,
          projectId,
          employeeId,
        ]
      );
    }

    await syncMainTaskAssignments(
      connection,
      taskId,
      assigneeIds,
      adminUserId
    );

    await connection.commit();

    let emailSummary = null;

    try {
      emailSummary =
        await sendMainTaskAssignmentEmails(
          projectId,
          [taskId],
          adminUser
        );
    } catch (emailError) {
      console.error(
        "Main Task update email error:",
        emailError
      );
    }

    return res.status(200).json({
      success: true,

      message:
        "Main Task updated successfully.",

      task_id:
        taskId,

      task_ids: [
        taskId,
      ],

      project_id:
        projectId,

      assignee_ids:
        assigneeIds,

      start_date:
        taskStartDate,

      due_date:
        taskDueDate,

      email_summary:
        emailSummary,
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    console.error(
      "Update Main Task error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update Main Task.",
      error: error.message,
      sqlMessage:
        error.sqlMessage || null,
    });
  } finally {
    connection.release();
  }
};

/*
========================================================
EXPORTS / OLD ALIASES

Keep aliases so current frontend does not suddenly
lose compatibility.
========================================================
*/
const exportAdminProjectsCsv = async (req, res) => {
  try {
    const [projects] = await db.query(
      `
     SELECT
  p.project_title,
  p.project_description,
  p.division,
  p.status,
  p.priority,
  DATE_FORMAT(p.start_date,'%Y-%m-%d') AS start_date,
  DATE_FORMAT(p.due_date,'%Y-%m-%d') AS due_date,
  creator.full_name AS created_by

      FROM projects p

      LEFT JOIN users creator
      ON creator.user_id = p.created_by_user_id

      ORDER BY p.project_id DESC
      `
    );


    const headers = [
      "project_title",
      "project_description",
      "division",
      "status",
      "priority",
      "start_date",
      "due_date",
      "created_by",
    ];


    const csv = [
      headers.join(","),
      ...projects.map(project =>
        headers.map(
          h => `"${String(project[h] || "").replace(/"/g,'""')}"`
        ).join(",")
      )
    ].join("\n");


    res.setHeader(
      "Content-Type",
      "text/csv"
    );

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=admin-projects.csv"
    );

    return res.send(csv);

  } catch(error){

    return res.status(500).json({
      success:false,
      message:"Failed to export projects.",
      error:error.message
    });

  }
};

module.exports = {
  getAdminProjects,
  exportAdminProjectsCsv,

  getDepartmentProjects:
    getAdminProjects,

  getDepartmentProjectsForAdmin:
    getAdminProjects,

  getProjects:
    getAdminProjects,

  getAllProjects:
    getAdminProjects,

  createAdminProject,

  createProject:
    createAdminProject,

  assignProject:
    createAdminProject,

  addProject:
    createAdminProject,

  updateAdminProject,

  updateProject:
    updateAdminProject,

  updateProjectDetails:
    updateAdminProject,

  editProject:
    updateAdminProject,

  deleteAdminProject,

  deleteProject:
    deleteAdminProject,

  removeProject:
    deleteAdminProject,

  getAssignableUsersForAdminProjects,

  getAssignableUsers:
    getAssignableUsersForAdminProjects,

  getAdminProjectUsers:
    getAssignableUsersForAdminProjects,

  getProjectUsers:
    getAssignableUsersForAdminProjects,

  getUsersForProjects:
    getAssignableUsersForAdminProjects,

  createMainTask,

  addMainTask:
    createMainTask,

  createProjectTask:
    createMainTask,

  addProjectTask:
    createMainTask,

  createAdminProjectTask:
    createMainTask,

  updateMainTask,

  updateProjectTask:
    updateMainTask,

  updateAdminProjectTask:
    updateMainTask,

  editMainTask:
    updateMainTask,
};
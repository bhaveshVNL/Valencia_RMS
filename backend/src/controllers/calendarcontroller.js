const db = require("../config/db");
const {
  sendMeetingScheduledEmail,
  sendMeetingUpdatedEmail,
  sendMeetingCancelledEmail,
} = require("../utils/emailservice");
/*
========================================================
HELPERS
========================================================
*/

const getUserId = (req) => {
  return Number(
    req.user?.user_id ||
      req.user?.id ||
      req.user?.userId ||
      req.user?.uid ||
      0
  );
};

const getLoggedInUser = async (req) => {
  const userId = getUserId(req);

  if (!userId) {
    return {
      error: {
        status: 401,
        message: "Unauthorized.",
      },
    };
  }

  const [rows] = await db.query(
    `
    SELECT
      u.user_id,
      u.full_name,
      u.email,
      u.department_id,
      u.designation,
      r.role_name,
      d.department_name

    FROM users u

    LEFT JOIN roles r
      ON r.role_id = u.role_id

    LEFT JOIN departments d
      ON d.department_id = u.department_id

    WHERE u.user_id = ?

    LIMIT 1
    `,
    [userId]
  );

  if (!rows.length) {
    return {
      error: {
        status: 404,
        message: "User not found.",
      },
    };
  }

  return {
    user: rows[0],
  };
};

const calculateMinutes = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;

  const startParts = String(startTime)
    .slice(0, 5)
    .split(":")
    .map(Number);

  const endParts = String(endTime)
    .slice(0, 5)
    .split(":")
    .map(Number);

  if (
    startParts.length !== 2 ||
    endParts.length !== 2
  ) {
    return 0;
  }

  const start =
    startParts[0] * 60 +
    startParts[1];

  const end =
    endParts[0] * 60 +
    endParts[1];

  return Math.max(end - start, 0);
};

/*
========================================================
ADMIN - EMPLOYEES FOR MEETING
========================================================
*/
const getMeetingEmployees = async (req, res) => {
  try {
    const { user, error } =
      await getLoggedInUser(req);

    if (error) {
      return res
        .status(error.status)
        .json({
          success: false,
          message: error.message,
        });
    }

    const roleName =
  String(
    user.role_name || ""
  ).toLowerCase();

if (
  ![
    "admin",
    "employee",
  ].includes(roleName)
) {
  return res.status(403).json({
    success: false,
    message:
      "Calendar meeting access denied.",
  });
}


    const [employees] = await db.query(
      `
      SELECT
        u.user_id,
        u.employee_code,
        u.full_name,
        u.email,
        u.designation,
        u.department_id,

        d.department_name,

        LOWER(r.role_name) AS role_name

      FROM users u

      LEFT JOIN roles r
        ON r.role_id = u.role_id

      LEFT JOIN departments d
        ON d.department_id = u.department_id

      WHERE
        LOWER(
          COALESCE(
            u.status,
            'active'
          )
        ) != 'deleted'

        AND LOWER(
          COALESCE(
            r.role_name,
            ''
          )
        ) IN (
          'employee',
          'administrator'
        )

      ORDER BY

        /*
        Logged-in Admin's department employees FIRST
        */

        CASE
          WHEN
            LOWER(r.role_name) = 'employee'
            AND u.department_id = ?
          THEN 0

          /*
          All remaining company employees SECOND
          */

          WHEN
            LOWER(r.role_name) = 'employee'
          THEN 1

          /*
          Administrator LAST
          */

          WHEN
            LOWER(r.role_name) = 'administrator'
          THEN 2

          ELSE 3
        END,

        d.department_name ASC,
        u.full_name ASC
      `,
      [user.department_id]
    );

    return res.json({
      success: true,
      employees,
    });

  } catch (error) {
    console.error(
      "Get meeting employees error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch employees.",
      error: error.message,
    });
  }
};
/*
========================================================
ADMIN - CREATE MEETING
========================================================
*/

const createMeeting = async (req, res) => {
  const connection =
    await db.getConnection();

  try {
    const { user, error } =
      await getLoggedInUser(req);

    if (error) {
      return res
        .status(error.status)
        .json({
          success: false,
          message: error.message,
        });
    }

    const roleName =
  String(
    user.role_name || ""
  ).toLowerCase();

if (
  ![
    "admin",
    "employee",
  ].includes(roleName)
) {
  return res.status(403).json({
    success: false,
    message:
      "You do not have permission to schedule meetings.",
  });
}


    const {
      title,
      description,
      meeting_date,
      start_time,
      end_time,
      employee_ids,
    } = req.body;

    const cleanTitle =
      String(title || "").trim();

    const cleanDescription =
      String(
        description || ""
      ).trim();

    const employeeIds =
      Array.isArray(employee_ids)
        ? [
            ...new Set(
              employee_ids
                .map(Number)
                .filter(Boolean)
            ),
          ]
        : [];

    if (!cleanTitle) {
      return res.status(400).json({
        success: false,
        message:
          "Meeting title is required.",
      });
    }

    if (
      !meeting_date ||
      !start_time ||
      !end_time
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Meeting date, start time and end time are required.",
      });
    }

    if (end_time <= start_time) {
      return res.status(400).json({
        success: false,
        message:
          "End time must be after start time.",
      });
    }

    if (!employeeIds.length) {
      return res.status(400).json({
        success: false,
        message:
          "Please select at least one employee.",
      });
    }

    const placeholders =
      employeeIds
        .map(() => "?")
        .join(",");

    const [validEmployees] =
      await connection.query(
        `
        SELECT
          u.user_id,
          u.full_name,
          u.email,
          u.department_id,
          LOWER(r.role_name)
            AS role_name

        FROM users u

        LEFT JOIN roles r
          ON r.role_id =
          u.role_id

        WHERE
          u.user_id IN (${placeholders})

      AND LOWER(
  COALESCE(
    r.role_name,
    ''
  )
) IN (
  'employee',
  'administrator'
)

        AND LOWER(
          COALESCE(
            u.status,
            'active'
          )
        ) != 'deleted'
        `,
        [
          ...employeeIds,
          
        ]
      );

    if (
      validEmployees.length !==
      employeeIds.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "One or more selected employees are invalid.",
      });
    }

    await connection.beginTransaction();

    const [meetingResult] =
      await connection.query(
        `
        INSERT INTO meetings (
          title,
          description,
          meeting_date,
          start_time,
          end_time,
          created_by,
          department_id,
          status
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          'scheduled'
        )
        `,
        [
          cleanTitle,
          cleanDescription || null,
          meeting_date,
          start_time,
          end_time,
          user.user_id,
          user.department_id,
        ]
      );

    const meetingId =
      meetingResult.insertId;

    const totalMinutes =
      calculateMinutes(
        start_time,
        end_time
      );

    for (
      const employee of
        validEmployees
    ) {
      await connection.query(
        `
        INSERT INTO meeting_employees (
          meeting_id,
          employee_id
        )
        VALUES (?, ?)
        `,
        [
          meetingId,
          employee.user_id,
        ]
      );

      await connection.query(
        `
        INSERT INTO mini_tasks (
          employee_id,
          department_id,
          meeting_id,
          mini_task_title,
          mini_task_description,
          task_date,
          start_time,
          end_time,
          total_minutes,
          status
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          'logged'
        )
        `,
        [
          employee.user_id,
          user.department_id,
          meetingId,

          `Meeting - ${cleanTitle}`,

          cleanDescription ||
            `Meeting scheduled by ${user.full_name}`,

          meeting_date,
          start_time,
          end_time,
          totalMinutes,
        ]
      );
    }

    await connection.commit();

    /*
    ========================================================
    SEND SCHEDULED EMAILS
    ========================================================
    */

    const participants =
      validEmployees.map(
        (employee) => ({
          user_id:
            employee.user_id,

          full_name:
            employee.full_name,

          email:
            employee.email,
        })
      );

    for (
      const employee of
        validEmployees
    ) {
      const email =
        String(
          employee.email || ""
        ).trim();

      if (!email) {
        continue;
      }

      try {
        await sendMeetingScheduledEmail({
          to: email,

          participantName:
            employee.full_name,

          meetingTitle:
            cleanTitle,

          description:
            cleanDescription,

          meetingDate:
            meeting_date,

          startTime:
            start_time,

          endTime:
            end_time,

          scheduledBy:
            user.full_name,

          scheduledByEmail:
            user.email,

          participants,
        });

        console.log(
          `Meeting email sent to ${email}`
        );

      } catch (emailError) {
        console.error(
          `Meeting email failed for ${email}:`,
          emailError
        );
      }
    }

    return res
      .status(201)
      .json({
        success: true,

        message:
          "Meeting scheduled successfully.",

        meeting_id:
          meetingId,

        employees:
          validEmployees.map(
            (employee) => ({
              user_id:
                employee.user_id,

              full_name:
                employee.full_name,
            })
          ),
      });

  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    console.error(
      "Create meeting error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to schedule meeting.",

      error:
        error.message,

      sqlMessage:
        error.sqlMessage || null,
    });

  } finally {
    try {
      connection.release();
    } catch {}
  }
};

const getAdminCalendar = async (
  req,
  res
) => {
  try {
    const { user, error } =
      await getLoggedInUser(req);

    if (error) {
      return res
        .status(error.status)
        .json({
          success: false,
          message: error.message,
        });
    }

    if (
      String(user.role_name).toLowerCase() !==
      "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Admin access required.",
      });
    }

    /*
    PROJECTS
    */

    const [projects] =
  await db.query(
    `
    SELECT
      p.project_id AS id,

      p.project_title AS title,

      p.project_description AS description,

      p.status,

      DATE_FORMAT(
        p.start_date,
        '%Y-%m-%d'
      ) AS start_date,

      DATE_FORMAT(
        p.due_date,
        '%Y-%m-%d'
      ) AS end_date

    FROM projects p

    WHERE
      p.department_id = ?

    ORDER BY
      p.start_date ASC
    `,
    [
      user.department_id
    ]
  );

    /*
    MAIN TASKS
    */

    const [tasks] =
      await db.query(
        `
        SELECT
          t.task_id AS id,
          t.project_id,
          t.task_title AS title,
          t.task_description AS description,
          t.status,

          DATE_FORMAT(
            t.start_date,
            '%Y-%m-%d'
          ) AS start_date,

          DATE_FORMAT(
            t.due_date,
            '%Y-%m-%d'
          ) AS end_date,

          p.project_title,

          assigned.full_name
            AS employee_name

        FROM tasks t

        LEFT JOIN projects p
          ON p.project_id =
          t.project_id

        LEFT JOIN users assigned
          ON assigned.user_id =
          t.assigned_to_user_id

        WHERE
          COALESCE(
            p.department_id,
            assigned.department_id
          ) = ?

        AND (
          t.parent_task_id IS NULL
          OR t.parent_task_id = 0
        )

        AND (
          t.task_type IS NULL
          OR t.task_type != 'subtask'
        )

        ORDER BY
          t.start_date ASC
        `,
        [user.department_id]
      );

    /*
    MEETINGS
    */

    const [meetings] =
  await db.query(
    `
    SELECT
      m.id AS id,
      m.title,
      m.description,

      DATE_FORMAT(
        m.meeting_date,
        '%Y-%m-%d'
      ) AS meeting_date,

      TIME_FORMAT(
        m.start_time,
        '%H:%i'
      ) AS start_time,

      TIME_FORMAT(
        m.end_time,
        '%H:%i'
      ) AS end_time,

      m.status,

      creator.full_name
        AS created_by_name,

      GROUP_CONCAT(
  DISTINCT employee.full_name
  ORDER BY employee.full_name
  SEPARATOR ', '
) AS employees,

GROUP_CONCAT(
  DISTINCT employee.user_id
  ORDER BY employee.user_id
  SEPARATOR ','
) AS employee_ids

    FROM meetings m

    LEFT JOIN users creator
      ON creator.user_id =
      m.created_by

    LEFT JOIN meeting_employees me
      ON me.meeting_id =
      m.id

    LEFT JOIN users employee
      ON employee.user_id =
      me.employee_id

    WHERE
      m.department_id = ?

    GROUP BY
      m.id

    ORDER BY
      m.meeting_date ASC,
      m.start_time ASC
    `,
    [user.department_id]
  );

  const formattedMeetings =
  meetings.map((meeting) => ({
    ...meeting,

    employee_ids:
      meeting.employee_ids
        ? String(
            meeting.employee_ids
          )
            .split(",")
            .map(Number)
            .filter(Boolean)
        : [],
  }));

    /*
    MINI TASKS
    */

    const [miniTasks] =
      await db.query(
        `
        SELECT
          mt.mini_task_id AS id,
          mt.employee_id,
          mt.meeting_id,

          mt.mini_task_title AS title,

          mt.mini_task_description
            AS description,

          DATE_FORMAT(
            mt.task_date,
            '%Y-%m-%d'
          ) AS task_date,

          TIME_FORMAT(
            mt.start_time,
            '%H:%i'
          ) AS start_time,

          TIME_FORMAT(
            mt.end_time,
            '%H:%i'
          ) AS end_time,

          mt.status,

          employee.full_name
            AS employee_name

        FROM mini_tasks mt

        LEFT JOIN users employee
          ON employee.user_id =
          mt.employee_id

        WHERE
          mt.department_id = ?

        /*
        Meeting-generated Mini Tasks
        are already represented by Meetings
        in the Admin Calendar.

        Therefore do not duplicate them.
        */

        AND mt.meeting_id IS NULL

        ORDER BY
          mt.task_date ASC,
          mt.start_time ASC
        `,
        [user.department_id]
      );

    return res.json({
      success: true,

      projects,
tasks,
meetings: formattedMeetings,
mini_tasks: miniTasks,
    });
  } catch (error) {
    console.error(
      "Get admin calendar error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to load admin calendar.",

      error: error.message,

      sqlMessage:
        error.sqlMessage || null,
    });
  }
};


/*
========================================================
EMPLOYEE CALENDAR
========================================================
*/

const getEmployeeCalendar = async (req, res) => {
  try {
    const { user, error } = await getLoggedInUser(req);

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    const employeeId = Number(user.user_id);

    if (!employeeId) {
      return res.status(401).json({
        success: false,
        message: "Employee ID not found.",
      });
    }

    /*
    ========================================================
    PROJECTS
    ========================================================

    Employee sees a project when the employee is directly
    assigned to that project.

    project_assignments.employee_id is the same assignment
    structure used by the RMS project/task system.
    ========================================================
    */

    const [projects] = await db.query(
  `
  SELECT
    p.project_id AS id,

    p.project_title AS title,

    p.project_description AS description,

    p.status,

    DATE_FORMAT(
      p.start_date,
      '%Y-%m-%d'
    ) AS start_date,

    DATE_FORMAT(
      p.due_date,
      '%Y-%m-%d'
    ) AS end_date

  FROM projects p

  WHERE
    EXISTS (
      SELECT 1

      FROM project_assignments pa

      WHERE
        pa.project_id = p.project_id

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
        ON ta.task_id = mt.task_id

      WHERE
        mt.project_id = p.project_id

        AND ta.employee_id = ?

        AND (
          mt.parent_task_id IS NULL
          OR mt.parent_task_id = 0
        )
    )

  ORDER BY
    p.start_date ASC,
    p.project_id ASC
  `,
  [
    employeeId,
    employeeId,
  ]
);

    /*
    ========================================================
    MAIN TASKS
    ========================================================

    A task can be assigned to an employee in TWO ways:

    1. tasks.assigned_to_user_id
    2. task_assignments.employee_id

    We check both.
    ========================================================
    */

    const [tasks] = await db.query(
      `
      SELECT
        t.task_id AS id,

        t.project_id,

        t.task_title AS title,

        t.task_description AS description,

        t.status,

        DATE_FORMAT(
          t.start_date,
          '%Y-%m-%d'
        ) AS start_date,

        DATE_FORMAT(
          t.due_date,
          '%Y-%m-%d'
        ) AS end_date,

        p.project_title,

        creator.full_name
          AS created_by_name

      FROM tasks t

      LEFT JOIN projects p
        ON p.project_id = t.project_id

      LEFT JOIN users creator
        ON creator.user_id =
           t.created_by_user_id

      WHERE
        (
          t.assigned_to_user_id = ?

          OR EXISTS (
            SELECT 1

            FROM task_assignments ta

            WHERE
              ta.task_id = t.task_id

              AND ta.employee_id = ?
          )
        )

      AND (
        t.parent_task_id IS NULL
        OR t.parent_task_id = 0
      )

      AND (
        t.task_type IS NULL

        OR LOWER(
          t.task_type
        ) NOT IN (
          'subtask',
          'sub_task'
        )
      )

      ORDER BY
        t.start_date ASC,
        t.task_id ASC
      `,
      [
        employeeId,
        employeeId,
      ]
    );

    /*
    ========================================================
    SUBTASKS
    ========================================================

    Subtasks are also returned separately so the calendar
    can show them.

    We include subtasks belonging to the employee's
    assigned main tasks.
    ========================================================
    */

    const [subtasks] = await db.query(
      `
      SELECT
        st.task_id AS id,

        st.project_id,

        st.parent_task_id,

        st.task_title AS title,

        st.task_description AS description,

        st.status,

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
        ) AS end_date,

        p.project_title,

        parent.task_title
          AS parent_task_title

      FROM tasks st

      INNER JOIN tasks parent
        ON parent.task_id =
           st.parent_task_id

      LEFT JOIN projects p
        ON p.project_id =
           st.project_id

      WHERE
        (
          st.assigned_to_user_id = ?

          OR EXISTS (
            SELECT 1

            FROM task_assignments ta

            WHERE
              ta.task_id = st.task_id

              AND ta.employee_id = ?
          )

          OR EXISTS (
            SELECT 1

            FROM task_assignments ta_parent

            WHERE
              ta_parent.task_id =
                st.parent_task_id

              AND ta_parent.employee_id = ?
          )
        )

      ORDER BY
        st.start_date ASC,
        st.task_id ASC
      `,
      [
        employeeId,
        employeeId,
        employeeId,
      ]
    );

    /*
    ========================================================
    MEETINGS
    ========================================================
    */

    const [meetings] = await db.query(
  `
  SELECT
    m.id AS id,

    m.title,

    m.description,

    m.created_by,

    DATE_FORMAT(
      m.meeting_date,
      '%Y-%m-%d'
    ) AS meeting_date,

    TIME_FORMAT(
      m.start_time,
      '%H:%i'
    ) AS start_time,

    TIME_FORMAT(
      m.end_time,
      '%H:%i'
    ) AS end_time,

    m.status,

    creator.full_name
      AS created_by_name,

    GROUP_CONCAT(
      DISTINCT participant.full_name
      ORDER BY participant.full_name
      SEPARATOR ', '
    ) AS participants

  FROM meetings m

  LEFT JOIN meeting_employees mine
    ON mine.meeting_id = m.id

    AND mine.employee_id = ?

  LEFT JOIN users creator
    ON creator.user_id =
       m.created_by

  LEFT JOIN meeting_employees all_me
    ON all_me.meeting_id = m.id

  LEFT JOIN users participant
    ON participant.user_id =
       all_me.employee_id

  WHERE
    (
      mine.employee_id IS NOT NULL

      OR m.created_by = ?
    )

  GROUP BY
    m.id

  ORDER BY
    m.meeting_date ASC,
    m.start_time ASC
  `,
  [
    employeeId,
    employeeId,
  ]
);

    /*
    ========================================================
    EMPLOYEE MINI TASKS
    ========================================================
    */

    const [miniTasks] = await db.query(
      `
      SELECT
        mt.mini_task_id AS id,

        mt.employee_id,

        mt.meeting_id,

        mt.mini_task_title AS title,

        mt.mini_task_description
          AS description,

        DATE_FORMAT(
          mt.task_date,
          '%Y-%m-%d'
        ) AS task_date,

        TIME_FORMAT(
          mt.start_time,
          '%H:%i'
        ) AS start_time,

        TIME_FORMAT(
          mt.end_time,
          '%H:%i'
        ) AS end_time,

        mt.status

      FROM mini_tasks mt

      WHERE
        mt.employee_id = ?

      AND mt.meeting_id IS NULL

      ORDER BY
        mt.task_date ASC,
        mt.start_time ASC
      `,
      [employeeId]
    );

    /*
    ========================================================
    RESPONSE
    ========================================================
    */

    return res.json({
      success: true,

      employee_id: employeeId,

      projects: projects || [],

      tasks: tasks || [],

      subtasks: subtasks || [],

      meetings: meetings || [],

      mini_tasks: miniTasks || [],
    });

  } catch (error) {
    console.error(
      "Get employee calendar error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to load employee calendar.",

      error: error.message,

      sqlMessage:
        error.sqlMessage || null,
    });
  }
};

/*
========================================================
UPDATE MEETING
========================================================
*/

const updateMeeting = async (
  req,
  res
) => {
  const connection =
    await db.getConnection();

  try {
    const { user, error } =
      await getLoggedInUser(req);

    if (error) {
      connection.release();

      return res
        .status(error.status)
        .json({
          success: false,
          message: error.message,
        });
    }

    const meetingId =
      Number(req.params.meetingId);
    

    if (!meetingId) {
      connection.release();

      return res.status(400).json({
        success: false,
        message:
          "Invalid meeting.",
      });
    }

    const {
      title,
      description,
      meeting_date,
      start_time,
      end_time,
      employee_ids,
    } = req.body;

    if (
      !title ||
      !meeting_date ||
      !start_time ||
      !end_time
    ) {
      connection.release();

      return res.status(400).json({
        success: false,
        message:
          "Meeting title, date and time are required.",
      });
    }

    if (end_time <= start_time) {
      connection.release();

      return res.status(400).json({
        success: false,
        message:
          "End time must be after start time.",
      });
    }

    const employeeIds =
      Array.isArray(employee_ids)
        ? [
            ...new Set(
              employee_ids
                .map(Number)
                .filter(Boolean)
            ),
          ]
        : [];

    if (!employeeIds.length) {
      connection.release();

      return res.status(400).json({
        success: false,
        message:
          "Select at least one employee.",
      });
    }

    const [meetingRows] =
      await connection.query(
        `
        SELECT
  id,
  department_id,
  created_by,
  status
FROM meetings
WHERE id = ?

        AND department_id = ?

        LIMIT 1
        `,
        [
          meetingId,
          user.department_id,
        ]
      );

    if (!meetingRows.length) {
      connection.release();

      return res.status(404).json({
        success: false,
        message:
          "Meeting not found.",
      });
    }

    if (
      meetingRows[0].status ===
      "cancelled"
    ) {
      connection.release();

      return res.status(400).json({
        success: false,
        message:
          "Cancelled meeting cannot be edited.",
      });
    }

    const placeholders =
      employeeIds
        .map(() => "?")
        .join(",");

    const [employees] =
  await connection.query(
    `
      SELECT
        u.user_id,
        u.full_name,
        u.email,
        u.department_id,
        LOWER(r.role_name) AS role_name

      FROM users u

      LEFT JOIN roles r
        ON r.role_id = u.role_id

      WHERE
        u.user_id IN (${placeholders})

      AND LOWER(
  COALESCE(
    r.role_name,
    ''
  )
) IN (
  'employee',
  'administrator'
)
      AND LOWER(
        COALESCE(
          u.status,
          'active'
        )
      ) != 'deleted'
    `,
    [
      ...employeeIds,
      
    ]
  );

    if (
      employees.length !==
      employeeIds.length
    ) {
      connection.release();

      return res.status(400).json({
        success: false,
        message:
          "One or more employees are invalid.",
      });
    }

    await connection.beginTransaction();

    await connection.query(
      `
      UPDATE meetings
SET
  title = ?,
  description = ?,
  meeting_date = ?,
  start_time = ?,
  end_time = ?
WHERE id = ?
      `,
      [
        String(title).trim(),
        String(
          description || ""
        ).trim() || null,

        meeting_date,
        start_time,
        end_time,
        meetingId,
      ]
    );

    /*
    Remove old generated Mini Tasks
    and participant links.
    Then recreate them from current selection.
    */

    await connection.query(
      `
      DELETE FROM mini_tasks
      WHERE meeting_id = ?
      `,
      [meetingId]
    );

    await connection.query(
      `
      DELETE FROM meeting_employees
      WHERE meeting_id = ?
      `,
      [meetingId]
    );

    const totalMinutes =
      calculateMinutes(
        start_time,
        end_time
      );

    for (
      const employee of employees
    ) {
      await connection.query(
        `
        INSERT INTO meeting_employees (
          meeting_id,
          employee_id
        )
        VALUES (?, ?)
        `,
        [
          meetingId,
          employee.user_id,
        ]
      );

      await connection.query(
        `
        INSERT INTO mini_tasks (
          employee_id,
          department_id,
          meeting_id,
          mini_task_title,
          mini_task_description,
          task_date,
          start_time,
          end_time,
          total_minutes,
          status
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          'logged'
        )
        `,
        [
          employee.user_id,
          user.department_id,
          meetingId,

          `Meeting - ${String(
            title
          ).trim()}`,

          String(
            description || ""
          ).trim() ||
            `Meeting scheduled by ${user.full_name}`,

          meeting_date,
          start_time,
          end_time,
          totalMinutes,
        ]
      );
    }

  await connection.commit();

/*
========================================================
SEND MEETING UPDATED EMAILS
========================================================
*/

try {
  const participants =
    employees.map(
      (employee) => ({
        user_id:
          employee.user_id,

        full_name:
          employee.full_name,

        email:
          employee.email,
      })
    );

  const emailJobs =
    employees
      .filter(
        (employee) =>
          employee.email &&
          String(
            employee.email
          ).trim()
      )
      .map(
        async (employee) => {
          try {
            await sendMeetingUpdatedEmail({
              to:
                employee.email,

              participantName:
                employee.full_name,

              meetingTitle:
                String(title).trim(),

              description:
                String(
                  description || ""
                ).trim(),

              meetingDate:
                meeting_date,

              startTime:
                start_time,

              endTime:
                end_time,

              updatedBy:
                user.full_name,

              updatedByEmail:
                user.email,

              participants,
            });

            console.log(
              `Meeting update email sent to ${employee.email}`
            );
          } catch (emailError) {
            console.error(
              `Meeting update email failed for ${employee.email}:`,
              emailError
            );
          }
        }
      );

  await Promise.allSettled(
    emailJobs
  );

} catch (emailError) {
  console.error(
    "Meeting update notification email error:",
    emailError
  );
}

return res.json({
  success: true,
  message:
    "Meeting updated successfully.",
});
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    console.error(
      "Update meeting error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update meeting.",
      error: error.message,
    });
  } finally {
    try {
      connection.release();
    } catch {}
  }
};

/*
========================================================
CANCEL MEETING
========================================================
*/

/*
========================================================
CANCEL MEETING
========================================================
*/

const cancelMeeting = async (
  req,
  res
) => {
  const connection =
    await db.getConnection();

  let transactionStarted = false;

  try {
    /*
    --------------------------------------------------------
    LOGGED IN USER
    --------------------------------------------------------
    */

    const { user, error } =
      await getLoggedInUser(req);

    if (error) {
      return res
        .status(error.status)
        .json({
          success: false,
          message: error.message,
        });
    }

    /*
    --------------------------------------------------------
    MEETING ID
    --------------------------------------------------------
    */

    const meetingId =
      Number(req.params.meetingId);

    if (!meetingId) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid meeting.",
      });
    }

    console.log(
      "CANCEL MEETING ENDPOINT HIT:",
      meetingId
    );

    /*
    --------------------------------------------------------
    GET MEETING
    --------------------------------------------------------
    */

    const [rows] =
      await connection.query(
        `
        SELECT
          id,
          title,
          description,

          DATE_FORMAT(
            meeting_date,
            '%Y-%m-%d'
          ) AS meeting_date,

          TIME_FORMAT(
            start_time,
            '%H:%i'
          ) AS start_time,

          TIME_FORMAT(
            end_time,
            '%H:%i'
          ) AS end_time,

          status

        FROM meetings

        WHERE
          id = ?

        AND
          department_id = ?

        LIMIT 1
        `,
        [
          meetingId,
          user.department_id,
        ]
      );

    /*
    --------------------------------------------------------
    MEETING NOT FOUND
    --------------------------------------------------------
    */

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message:
          "Meeting not found.",
      });
    }

    const meeting =
      rows[0];

    /*
    --------------------------------------------------------
    ALREADY CANCELLED
    --------------------------------------------------------
    */

    if (
      String(
        meeting.status || ""
      ).toLowerCase() ===
      "cancelled"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Meeting is already cancelled.",
      });
    }

    /*
    --------------------------------------------------------
    FETCH PARTICIPANTS BEFORE CANCELLING
    --------------------------------------------------------

    Important:
    We fetch participants before changing anything
    because these users must receive the cancellation
    email.
    --------------------------------------------------------
    */

    const [participants] =
      await connection.query(
        `
        SELECT
          u.user_id,
          u.full_name,
          u.email

        FROM meeting_employees me

        INNER JOIN users u
          ON u.user_id =
          me.employee_id

        WHERE
          me.meeting_id = ?

        ORDER BY
          u.full_name ASC
        `,
        [meetingId]
      );

    console.log(
      "CANCEL PARTICIPANTS:",
      participants
    );

    /*
    --------------------------------------------------------
    START TRANSACTION
    --------------------------------------------------------
    */

    await connection.beginTransaction();

    transactionStarted = true;

    /*
    --------------------------------------------------------
    CANCEL MEETING
    --------------------------------------------------------
    */

    await connection.query(
      `
      UPDATE meetings

      SET
        status = 'cancelled'

      WHERE
        id = ?
      `,
      [meetingId]
    );

    /*
    --------------------------------------------------------
    UPDATE GENERATED MINI TASKS

    mini_tasks status currently supports:
      logged
      reviewed

    Therefore we keep the Mini Task record and mark
    cancellation through its title + description.
    --------------------------------------------------------
    */

    await connection.query(
      `
      UPDATE mini_tasks

      SET

        mini_task_title =
          CASE

            WHEN
              mini_task_title
              LIKE 'CANCELLED - %'

            THEN
              mini_task_title

            ELSE
              CONCAT(
                'CANCELLED - ',
                mini_task_title
              )

          END,

        mini_task_description =
          CONCAT(

            COALESCE(
              mini_task_description,
              ''
            ),

            CASE

              WHEN
                COALESCE(
                  mini_task_description,
                  ''
                ) = ''

              THEN
                ''

              ELSE
                '\\n'

            END,

            'This meeting has been cancelled.'
          )

      WHERE
        meeting_id = ?
      `,
      [meetingId]
    );

    /*
    --------------------------------------------------------
    COMMIT DATABASE FIRST
    --------------------------------------------------------
    */

    await connection.commit();

    transactionStarted = false;

    /*
    ========================================================
    SEND MEETING CANCELLED EMAILS
    ========================================================

    Meeting is already safely cancelled in DB.

    Email failures must NOT undo the cancellation.
    ========================================================
    */

    console.log(
      "Cancellation email participants:",
      participants.map(
        (employee) => ({
          name:
            employee.full_name,

          email:
            employee.email,
        })
      )
    );

    /*
    --------------------------------------------------------
    CHECK EMAIL FUNCTION
    --------------------------------------------------------
    */

    if (
      typeof sendMeetingCancelledEmail !==
      "function"
    ) {
      console.error(
        "sendMeetingCancelledEmail is not exported correctly from emailservice.js"
      );

    } else {
      /*
      --------------------------------------------------------
      SEND ONE EMAIL TO EACH PARTICIPANT
      --------------------------------------------------------
      */

      for (
        const employee of
          participants
      ) {
        const email =
          String(
            employee.email || ""
          ).trim();

        /*
        Employee has no email
        */

        if (!email) {
          console.warn(
            `Cancellation email skipped for ${employee.full_name}: no email address.`
          );

          continue;
        }

        try {
          console.log(
            "SENDING CANCELLATION EMAIL TO:",
            email
          );

          const result =
            await sendMeetingCancelledEmail({
              to:
                email,

              participantName:
                employee.full_name,

              meetingTitle:
                meeting.title,

              description:
                meeting.description,

              meetingDate:
                meeting.meeting_date,

              startTime:
                meeting.start_time,

              endTime:
                meeting.end_time,

              cancelledBy:
                user.full_name,

              cancelledByEmail:
                user.email,

              participants,
            });

          console.log(
            `Meeting cancellation email sent to ${email}`,
            result
          );

        } catch (
          emailError
        ) {
          console.error(
            `Meeting cancellation email FAILED for ${email}:`,
            emailError
          );
        }
      }
    }

    /*
    --------------------------------------------------------
    SUCCESS
    --------------------------------------------------------
    */

    return res.json({
      success: true,

      message:
        "Meeting cancelled successfully.",
    });

  } catch (error) {
    /*
    --------------------------------------------------------
    ROLLBACK ONLY IF TRANSACTION IS STILL ACTIVE
    --------------------------------------------------------
    */

    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (
        rollbackError
      ) {
        console.error(
          "Cancel meeting rollback error:",
          rollbackError
        );
      }
    }

    console.error(
      "Cancel meeting error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to cancel meeting.",

      error:
        error.message,

      sqlMessage:
        error.sqlMessage || null,
    });

  } finally {
    /*
    --------------------------------------------------------
    RELEASE CONNECTION ONCE
    --------------------------------------------------------
    */

    try {
      connection.release();
    } catch {}
  }
};
/*
========================================================
UPCOMING MEETINGS
ADMIN + EMPLOYEE
========================================================
*/

const getUpcomingMeetings = async (
  req,
  res
) => {
  try {
    const { user, error } =
      await getLoggedInUser(req);

    if (error) {
      return res
        .status(error.status)
        .json({
          success: false,
          message: error.message,
        });
    }

    const role =
      String(
        user.role_name || ""
      ).toLowerCase();

    let rows = [];

    if (role === "admin") {
      [rows] = await db.query(
        `
        SELECT
          m.id AS id,
          m.title,
          m.description,

          DATE_FORMAT(
            m.meeting_date,
            '%Y-%m-%d'
          ) AS meeting_date,

          TIME_FORMAT(
            m.start_time,
            '%H:%i'
          ) AS start_time,

          TIME_FORMAT(
            m.end_time,
            '%H:%i'
          ) AS end_time,

          m.status,

         GROUP_CONCAT(
  DISTINCT employee.full_name
  ORDER BY employee.full_name
  SEPARATOR ', '
) AS employees,

GROUP_CONCAT(
  DISTINCT employee.user_id
  ORDER BY employee.user_id
  SEPARATOR ','
) AS employee_ids 

        FROM meetings m

        LEFT JOIN meeting_employees me
          ON me.meeting_id = m.id

        LEFT JOIN users employee
          ON employee.user_id =
          me.employee_id

        WHERE
          m.department_id = ?

        AND m.status = 'scheduled'

        AND (
          m.meeting_date > CURDATE()

          OR (
            m.meeting_date = CURDATE()
            AND m.end_time >= CURTIME()
          )
        )

        GROUP BY
          m.id

        ORDER BY
          m.meeting_date ASC,
          m.start_time ASC

        LIMIT 3
        `,
        [user.department_id]
      );

    } else {
      [rows] = await db.query(
        `
        SELECT
          m.id AS id,
          m.title,
          m.description,

          DATE_FORMAT(
            m.meeting_date,
            '%Y-%m-%d'
          ) AS meeting_date,

          TIME_FORMAT(
            m.start_time,
            '%H:%i'
          ) AS start_time,

          TIME_FORMAT(
            m.end_time,
            '%H:%i'
          ) AS end_time,

          m.status,

          creator.full_name
            AS created_by_name

        FROM meetings m

        INNER JOIN meeting_employees me
          ON me.meeting_id = m.id

        LEFT JOIN users creator
          ON creator.user_id =
          m.created_by

        WHERE
          me.employee_id = ?

        AND m.status = 'scheduled'

        AND (
          m.meeting_date > CURDATE()

          OR (
            m.meeting_date = CURDATE()
            AND m.end_time >= CURTIME()
          )
        )

        ORDER BY
          m.meeting_date ASC,
          m.start_time ASC

        LIMIT 3
        `,
        [user.user_id]
      );
    }

    return res.json({
      success: true,
      meetings: rows,
    });

  } catch (error) {
    console.error(
      "Upcoming meetings error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch upcoming meetings.",
      error: error.message,
    });
  }
};

module.exports = {
  getMeetingEmployees,

  createMeeting,
  updateMeeting,
  cancelMeeting,

  getAdminCalendar,
  getEmployeeCalendar,

  getUpcomingMeetings,
};
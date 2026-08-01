const db = require("../config/db");

const mainTaskCondition = `(t.parent_task_id IS NULL OR t.parent_task_id = 0)`;

const normalizeStatus = (status, progress = 0) => {
  const value = String(status || "").toLowerCase();

  if (value === "done") return "completed";
  if (value === "completed") return "completed";
  if (value === "ongoing") return "in_progress";
  if (value === "in_progress") return "in_progress";
  if (value === "under_review") return "under_review";
  if (value === "rejected") return "rejected";
  if (value === "blocked") return "blocked";
  if (value === "on_hold") return "on_hold";
  if (value === "cancelled") return "cancelled";

  if (Number(progress) >= 100) return "completed";
  if (Number(progress) > 0) return "in_progress";

  return "not_started";
};

const combineCsvValues = (...values) => {
  const output = [];

  values.forEach((value) => {
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => {
        if (!output.includes(item)) {
          output.push(item);
        }
      });
  });

  return output.join(", ");
};

const getProjectAssignmentUserColumn = async () => {
  try {
    const [columns] = await db.query("SHOW COLUMNS FROM project_assignments");

    const columnNames = columns.map((column) => column.Field);

    const possibleColumns = [
      "employee_id",
      "assigned_to_user_id",
      "user_id",
      "assigned_user_id",
    ];

    return possibleColumns.find((column) => columnNames.includes(column)) || null;
  } catch (error) {
    return null;
  }
};

const attachSubtasksAndProgress = async (tasks) => {
  if (!tasks.length) return [];

  const taskIds = tasks.map((task) => task.task_id);

  const [subtasks] = await db.query(
    `
    SELECT
      task_id,
      project_id,
      parent_task_id,
      task_title,
      task_description,
      status,
      COALESCE(progress, 0) AS progress,
      COALESCE(is_checked, 0) AS is_checked,
      DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
      DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date
    FROM tasks
    WHERE parent_task_id IN (?)
    ORDER BY created_at ASC, task_id ASC
    `,
    [taskIds]
  );

  return tasks.map((task) => {
    const taskSubtasks = subtasks.filter(
      (subtask) => Number(subtask.parent_task_id) === Number(task.task_id)
    );

    const totalSubtasks = taskSubtasks.length;

    const completedSubtasks = taskSubtasks.filter((subtask) => {
      return (
        Number(subtask.is_checked) === 1 ||
        String(subtask.status).toLowerCase() === "completed" ||
        Number(subtask.progress || 0) >= 100
      );
    }).length;

    let computedProgress = Number(task.progress || 0);
    let computedStatus = normalizeStatus(task.status, computedProgress);

    if (totalSubtasks > 0) {
      computedProgress = Math.round((completedSubtasks / totalSubtasks) * 100);

      computedStatus =
        completedSubtasks === 0
          ? "not_started"
          : completedSubtasks < totalSubtasks
          ? "in_progress"
          : "completed";
    }

    return {
      ...task,
      progress: computedProgress,
      computed_progress: computedProgress,
      status_group: computedStatus,
      total_subtasks: totalSubtasks,
      completed_subtasks: completedSubtasks,
      pending_subtasks: totalSubtasks - completedSubtasks,
      subtasks: taskSubtasks,
    };
  });
};

const getAllMainTasks = async () => {
  const [tasks] = await db.query(
    `
    SELECT
      t.task_id,
      t.project_id,
      t.assigned_to_user_id,
      t.created_by_user_id,
      t.task_title,
      t.task_description,
      t.priority,
      t.status,
      COALESCE(t.progress, 0) AS progress,
      DATE_FORMAT(t.start_date, '%Y-%m-%d') AS start_date,
      DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date,
      DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i') AS created_at,

      p.project_title,
      p.project_description,
      p.status AS project_status,
      COALESCE(p.overall_progress, 0) AS project_progress,
      DATE_FORMAT(p.start_date, '%Y-%m-%d') AS project_start_date,
      DATE_FORMAT(p.due_date, '%Y-%m-%d') AS project_due_date,

      assignee.full_name AS assignee_name,
      assignee.email AS assignee_email,
      assignee.employee_code AS assignee_employee_code,
      assignee.designation AS assignee_designation,

      creator.full_name AS assigned_by_name,
      creator.email AS assigned_by_email,
      creator.designation AS assigned_by_designation,

      d.department_name

    FROM tasks t

    LEFT JOIN projects p
      ON p.project_id = t.project_id

    LEFT JOIN users assignee
      ON assignee.user_id = t.assigned_to_user_id

    LEFT JOIN users creator
      ON creator.user_id = t.created_by_user_id

    LEFT JOIN departments d
      ON d.department_id = assignee.department_id

    WHERE ${mainTaskCondition}

    ORDER BY
      CASE
        WHEN t.status IN ('in_progress', 'ongoing') THEN 1
        WHEN t.status IN ('not_started', 'todo') THEN 2
        WHEN t.status = 'under_review' THEN 3
        WHEN t.status IN ('completed', 'done') THEN 4
        ELSE 5
      END,
      t.due_date ASC,
      t.created_at DESC
    `
  );

  return attachSubtasksAndProgress(tasks);
};

const getAllProjects = async () => {
  const assignmentUserColumn = await getProjectAssignmentUserColumn();

  const assignmentJoin = assignmentUserColumn
    ? `
      LEFT JOIN project_assignments pa
        ON pa.project_id = p.project_id

      LEFT JOIN users assigned_from_project
        ON assigned_from_project.user_id = pa.${assignmentUserColumn}
    `
    : "";

  const assignmentSelect = assignmentUserColumn
    ? `
      GROUP_CONCAT(DISTINCT assigned_from_project.user_id SEPARATOR ', ') AS project_assigned_user_ids,
      GROUP_CONCAT(DISTINCT assigned_from_project.full_name SEPARATOR ', ') AS project_assigned_names,
      GROUP_CONCAT(DISTINCT assigned_from_project.email SEPARATOR ', ') AS project_assigned_emails,
    `
    : `
      NULL AS project_assigned_user_ids,
      NULL AS project_assigned_names,
      NULL AS project_assigned_emails,
    `;

  const [rows] = await db.query(
    `
    SELECT
      p.project_id,
      p.project_title,
      p.project_description,
      p.priority,
      p.status,
      COALESCE(p.overall_progress, 0) AS overall_progress,
      DATE_FORMAT(p.start_date, '%Y-%m-%d') AS start_date,
      DATE_FORMAT(p.due_date, '%Y-%m-%d') AS due_date,
      DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i') AS created_at,

      d.department_name,

      creator.full_name AS created_by_name,
      creator.email AS created_by_email,

      ${assignmentSelect}

      GROUP_CONCAT(DISTINCT task_assignee.user_id SEPARATOR ', ') AS task_assigned_user_ids,
      GROUP_CONCAT(DISTINCT task_assignee.full_name SEPARATOR ', ') AS task_assigned_names,
      GROUP_CONCAT(DISTINCT task_assignee.email SEPARATOR ', ') AS task_assigned_emails,

      COUNT(DISTINCT t.task_id) AS total_tasks,

      COUNT(
        DISTINCT CASE
          WHEN t.status IN ('completed', 'done') THEN t.task_id
        END
      ) AS completed_tasks,

      COUNT(
        DISTINCT CASE
          WHEN t.status IN ('in_progress', 'ongoing') THEN t.task_id
        END
      ) AS in_progress_tasks,

      COUNT(
        DISTINCT CASE
          WHEN t.status IS NULL OR t.status IN ('not_started', 'todo') THEN t.task_id
        END
      ) AS todo_tasks,

      ROUND(AVG(COALESCE(t.progress, 0))) AS task_average_progress

    FROM projects p

    LEFT JOIN departments d
      ON d.department_id = p.department_id

    LEFT JOIN users creator
      ON creator.user_id = p.created_by_user_id

    ${assignmentJoin}

    LEFT JOIN tasks t
      ON t.project_id = p.project_id
      AND (t.parent_task_id IS NULL OR t.parent_task_id = 0)

    LEFT JOIN users task_assignee
      ON task_assignee.user_id = t.assigned_to_user_id

    GROUP BY
      p.project_id,
      p.project_title,
      p.project_description,
      p.priority,
      p.status,
      p.overall_progress,
      p.start_date,
      p.due_date,
      p.created_at,
      d.department_name,
      creator.full_name,
      creator.email

    ORDER BY p.created_at DESC
    `
  );

  return rows.map((project) => {
    const assignedUserIds = combineCsvValues(
      project.project_assigned_user_ids,
      project.task_assigned_user_ids
    );

    const assignedNames = combineCsvValues(
      project.project_assigned_names,
      project.task_assigned_names
    );

    const assignedEmails = combineCsvValues(
      project.project_assigned_emails,
      project.task_assigned_emails
    );

    const taskAverageProgress = Number(project.task_average_progress || 0);

    return {
      ...project,
      assigned_user_ids: assignedUserIds,
      assigned_names: assignedNames,
      assigned_emails: assignedEmails,
      overall_progress:
        Number(project.overall_progress || 0) > 0
          ? Number(project.overall_progress || 0)
          : taskAverageProgress,
    };
  });
};

const getAllUsersBase = async () => {
  const [users] = await db.query(
    `
    SELECT
      u.user_id,
      u.employee_code,
      u.full_name,
      u.email,
      u.phone,
      u.designation,
      u.status,
      DATE_FORMAT(u.created_at, '%Y-%m-%d') AS created_at,
      r.role_name,
      d.department_name,
      ep.skills
    FROM users u

    JOIN roles r
      ON r.role_id = u.role_id

    LEFT JOIN departments d
      ON d.department_id = u.department_id

    LEFT JOIN employee_profiles ep
      ON ep.user_id = u.user_id

    WHERE u.status != 'deleted'
    ORDER BY u.full_name ASC
    `
  );

  return users;
};

const getAttendanceSummaryMap = async () => {
  const [rows] = await db.query(
    `
    SELECT
      employee_id AS user_id,
      COUNT(*) AS total_days,
      SUM(CASE WHEN LOWER(status) = 'present' THEN 1 ELSE 0 END) AS present_days,
      SUM(CASE WHEN LOWER(status) = 'absent' THEN 1 ELSE 0 END) AS absent_days,
      SUM(CASE WHEN LOWER(status) = 'half_day' THEN 1 ELSE 0 END) AS half_day_days,
      SUM(CASE WHEN LOWER(status) = 'leave' THEN 1 ELSE 0 END) AS leave_days,
      SUM(CASE WHEN LOWER(status) = 'holiday' THEN 1 ELSE 0 END) AS holiday_days
    FROM attendance
    GROUP BY employee_id
    `
  );

  const map = new Map();

  rows.forEach((row) => {
    const totalDays = Number(row.total_days || 0);
    const presentDays = Number(row.present_days || 0);

    map.set(Number(row.user_id), {
      total_days: totalDays,
      present_days: presentDays,
      absent_days: Number(row.absent_days || 0),
      half_day_days: Number(row.half_day_days || 0),
      leave_days: Number(row.leave_days || 0),
      holiday_days: Number(row.holiday_days || 0),
      attendance_percentage:
        totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0,
    });
  });

  return map;
};

const buildUserWorkSummary = async () => {
  const users = await getAllUsersBase();
  const tasks = await getAllMainTasks();
  const projects = await getAllProjects();
  const attendanceMap = await getAttendanceSummaryMap();

  const userMap = new Map();

  users.forEach((user) => {
    userMap.set(Number(user.user_id), {
      ...user,
      total_tasks: 0,
      todo_tasks: 0,
      in_progress_tasks: 0,
      under_review_tasks: 0,
      completed_tasks: 0,
      rejected_tasks: 0,
      blocked_tasks: 0,
      average_task_progress: 0,

      total_projects: 0,
      todo_projects: 0,
      ongoing_projects: 0,
      under_review_projects: 0,
      completed_projects: 0,

      created_tasks_count: 0,

      attendance: attendanceMap.get(Number(user.user_id)) || {
        total_days: 0,
        present_days: 0,
        absent_days: 0,
        half_day_days: 0,
        leave_days: 0,
        holiday_days: 0,
        attendance_percentage: 0,
      },
    });
  });

  tasks.forEach((task) => {
    const assigneeId = Number(task.assigned_to_user_id);
    const creatorId = Number(task.created_by_user_id);

    if (userMap.has(assigneeId)) {
      const user = userMap.get(assigneeId);

      user.total_tasks += 1;

      if (task.status_group === "completed") user.completed_tasks += 1;
      else if (task.status_group === "in_progress") user.in_progress_tasks += 1;
      else if (task.status_group === "under_review") user.under_review_tasks += 1;
      else if (task.status_group === "rejected") user.rejected_tasks += 1;
      else if (task.status_group === "blocked") user.blocked_tasks += 1;
      else user.todo_tasks += 1;

      user.average_task_progress += Number(task.progress || 0);
    }

    if (userMap.has(creatorId)) {
      userMap.get(creatorId).created_tasks_count += 1;
    }
  });

  projects.forEach((project) => {
    const assignedIds = String(project.assigned_user_ids || "")
      .split(",")
      .map((id) => Number(String(id).trim()))
      .filter(Boolean);

    assignedIds.forEach((userId) => {
      if (!userMap.has(userId)) return;

      const user = userMap.get(userId);

      user.total_projects += 1;

      if (project.status === "completed") user.completed_projects += 1;
      else if (project.status === "under_review") user.under_review_projects += 1;
      else if (project.status === "ongoing") user.ongoing_projects += 1;
      else user.todo_projects += 1;
    });
  });

  return Array.from(userMap.values()).map((user) => ({
    ...user,
    average_task_progress:
      user.total_tasks > 0
        ? Math.round(user.average_task_progress / user.total_tasks)
        : 0,
  }));
};

const getSuperadminOverview = async (req, res) => {
  try {
    const users = await buildUserWorkSummary();
    const tasks = await getAllMainTasks();
    const projects = await getAllProjects();

    const stats = {
      total_users: users.length,
      total_projects: projects.length,
      total_tasks: tasks.length,
      active_tasks: tasks.filter((task) =>
        ["not_started", "in_progress", "under_review"].includes(task.status_group)
      ).length,
      completed_tasks: tasks.filter((task) => task.status_group === "completed")
        .length,
      pending_tasks: tasks.filter((task) => task.status_group !== "completed")
        .length,
    };

    return res.json({
      success: true,
      stats,
      employee_workload: users,
      recent_tasks: tasks,
      projects,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load superadmin overview.",
      error: error.message,
    });
  }
};

const getSuperadminUsers = async (req, res) => {
  try {
    const users = await buildUserWorkSummary();

    return res.json({
      success: true,
      users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load superadmin users.",
      error: error.message,
    });
  }
};

const getSuperadminUserDetails = async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    const users = await buildUserWorkSummary();
    const user = users.find((item) => Number(item.user_id) === userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const tasks = await getAllMainTasks();
    const projects = await getAllProjects();

    const assignedTasks = tasks.filter(
      (task) => Number(task.assigned_to_user_id) === userId
    );

    const createdTasks = tasks.filter(
      (task) => Number(task.created_by_user_id) === userId
    );

    const assignedProjects = projects.filter((project) => {
      const assignedIds = String(project.assigned_user_ids || "")
        .split(",")
        .map((id) => Number(String(id).trim()))
        .filter(Boolean);

      return assignedIds.includes(userId);
    });

    const [recentAttendance] = await db.query(
      `
      SELECT
        attendance_id,
        DATE_FORMAT(attendance_date, '%Y-%m-%d') AS attendance_date,
        status,
        check_in_time,
        check_out_time,
        total_minutes,
        remarks
      FROM attendance
      WHERE employee_id = ?
      ORDER BY attendance_date DESC
      LIMIT 30
      `,
      [userId]
    );

    return res.json({
      success: true,
      user,
      assigned_tasks: assignedTasks,
      created_tasks: createdTasks,
      assigned_projects: assignedProjects,
      recent_attendance: recentAttendance,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load user details.",
      error: error.message,
    });
  }
};

const getSuperadminTasks = async (req, res) => {
  try {
    const tasks = await getAllMainTasks();

    return res.json({
      success: true,
      tasks,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load superadmin tasks.",
      error: error.message,
    });
  }
};

const getSuperadminProjects = async (req, res) => {
  try {
    const projects = await getAllProjects();

    return res.json({
      success: true,
      projects,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load superadmin projects.",
      error: error.message,
    });
  }
};

module.exports = {
  getSuperadminOverview,
  getSuperadminUsers,
  getSuperadminUserDetails,
  getSuperadminTasks,
  getSuperadminProjects,
};
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  ClipboardList,
  FolderKanban,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import "./superadminOverview.css";

const getPendingTasks = (user) => {
  return (
    Number(user.todo_tasks || 0) +
    Number(user.in_progress_tasks || 0) +
    Number(user.under_review_tasks || 0) +
    Number(user.rejected_tasks || 0) +
    Number(user.blocked_tasks || 0)
  );
};

const statusLabel = (status) => {
  const value = String(status || "").toLowerCase();

  if (value === "not_started") return "To Do";
  if (value === "todo") return "To Do";
  if (value === "in_progress") return "In Progress";
  if (value === "ongoing") return "In Progress";
  if (value === "under_review") return "Under Review";
  if (value === "completed") return "Completed";
  if (value === "done") return "Completed";
  if (value === "rejected") return "Rejected";
  if (value === "blocked") return "Blocked";
  if (value === "on_hold") return "On Hold";
  if (value === "cancelled") return "Cancelled";

  return status || "-";
};

const ProgressBar = ({ value = 0 }) => {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));

  return (
    <progress
      className="sa-ov-progress"
      value={safeValue}
      max="100"
      aria-label={`Progress ${safeValue}%`}
    />
  );
};

const OverviewStatCard = ({ icon: Icon, label, value, onClick }) => {
  return (
    <button
      type="button"
      className="sa-overview-inline-stat-card sa-ov-overview-stat-card"
      onClick={onClick}
    >
      <strong className="sa-ov-overview-stat-value">{value || 0}</strong>

      <div className="sa-ov-overview-stat-footer">
        <div
          className="sa-overview-inline-stat-icon sa-ov-overview-stat-icon"
        >
          <Icon size={20} />
        </div>

        <span className="sa-ov-overview-stat-label">{label}</span>
      </div>
    </button>
  );
};

const SuperadminOverview = () => {
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [modal, setModal] = useState(null);
  const [userDetailsLoading, setUserDetailsLoading] = useState(false);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await api.get("/superadmin/overview");
      setData(response.data);
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to load superadmin overview."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const users = data?.employee_workload || [];
  const tasks = data?.recent_tasks || [];
  const projects = data?.projects || [];
  const stats = data?.stats || {};

  const activeUsers = useMemo(() => {
    return [...users]
      .filter((user) => Number(user.total_tasks || 0) > 0)
      .sort((a, b) => Number(b.total_tasks || 0) - Number(a.total_tasks || 0));
  }, [users]);

  const attentionUsers = useMemo(() => {
    return [...users]
      .filter((user) => getPendingTasks(user) > 0)
      .sort((a, b) => getPendingTasks(b) - getPendingTasks(a));
  }, [users]);

  const filteredQuickUsers = useMemo(() => {
    const value = search.toLowerCase().trim();

    if (!value) return [];

    return users
      .filter((user) => {
        return (
          user.full_name?.toLowerCase().includes(value) ||
          user.email?.toLowerCase().includes(value) ||
          user.employee_code?.toLowerCase().includes(value) ||
          user.department_name?.toLowerCase().includes(value) ||
          user.designation?.toLowerCase().includes(value) ||
          user.role_name?.toLowerCase().includes(value)
        );
      })
      .slice(0, 6);
  }, [users, search]);

  const departmentSummary = useMemo(() => {
    const map = new Map();

    users.forEach((user) => {
      const department = user.department_name || "No Department";

      if (!map.has(department)) {
        map.set(department, {
          department,
          users: 0,
          tasks: 0,
          pending: 0,
          projects: 0,
          progressTotal: 0,
        });
      }

      const item = map.get(department);

      item.users += 1;
      item.tasks += Number(user.total_tasks || 0);
      item.projects += Number(user.total_projects || 0);
      item.pending += getPendingTasks(user);
      item.progressTotal += Number(user.average_task_progress || 0);
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        averageProgress:
          item.users > 0 ? Math.round(item.progressTotal / item.users) : 0,
      }))
      .sort((a, b) => b.tasks - a.tasks);
  }, [users]);

  const openUserDetails = async (user) => {
    try {
      setUserDetailsLoading(true);

      const response = await api.get(`/superadmin/users/${user.user_id}`);

      setModal({
        type: "user",
        title: user.full_name || "User Details",
        data: response.data,
      });
    } catch (error) {
      setModal({
        type: "error",
        title: "Unable to Load User",
        data:
          error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to load user details.",
      });
    } finally {
      setUserDetailsLoading(false);
    }
  };

  const openTaskDetails = (task) => {
    setModal({
      type: "task",
      title: task.task_title || "Task Details",
      data: task,
    });
  };

  const openProjectDetails = (project) => {
    setModal({
      type: "project",
      title: project.project_title || "Project Details",
      data: project,
    });
  };

  const openDepartmentDetails = (department) => {
    const departmentName = department.department;

    const departmentUsers = users.filter(
      (user) => (user.department_name || "No Department") === departmentName
    );

    const departmentTasks = tasks.filter(
      (task) => (task.department_name || "No Department") === departmentName
    );

    const departmentProjects = projects.filter(
      (project) =>
        (project.department_name || "No Department") === departmentName
    );

    setModal({
      type: "department",
      title: `${departmentName} Department`,
      data: {
        department,
        users: departmentUsers,
        tasks: departmentTasks,
        projects: departmentProjects,
      },
    });
  };

  const openListModal = (title, type, items) => {
    setModal({
      type,
      title,
      data: items,
    });
  };

  const activeTasks = tasks.filter((task) =>
    ["not_started", "in_progress", "under_review"].includes(
      String(task.status_group || "").toLowerCase()
    )
  );

  const pendingTasks = tasks.filter(
    (task) => String(task.status_group || "").toLowerCase() !== "completed"
  );

  if (loading) {
    return <div className="sa-ov-card">Loading superadmin dashboard...</div>;
  }

  return (
    <div className="sa-ov-page">
      <div className="sa-ov-title-row">
        <div>
          <h1 className="sa-ov-h1">Superadmin Overview</h1>
          <p className="sa-ov-subtitle">
            Click any tile, user, task, project, department or snapshot to view
            the complete details.
          </p>
        </div>

        <button className="sa-ov-primary-btn" onClick={fetchOverview}>
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      {message && <div className="sa-ov-message">{message}</div>}

      <div className="sa-ov-stat-grid">
        <OverviewStatCard
          icon={Users}
          label="Total Users"
          value={stats.total_users}
          onClick={() => navigate("/superadmin/users")}
        />

        <OverviewStatCard
          icon={FolderKanban}
          label="Total Projects"
          value={stats.total_projects}
          onClick={() => navigate("/superadmin/projects")}
        />

        <OverviewStatCard
          icon={ClipboardList}
          label="Total Tasks"
          value={stats.total_tasks}
          onClick={() => navigate("/superadmin/tasks")}
        />

<OverviewStatCard
  icon={TrendingUp}
  label="Active Tasks"
  value={stats.active_tasks}
  onClick={() => openListModal("Active Tasks", "taskList", activeTasks)}
/>

<OverviewStatCard
  icon={AlertCircle}
  label="Pending Tasks"
  value={stats.pending_tasks}
  onClick={() =>
    openListModal("Pending Tasks", "taskList", pendingTasks)
  }
/>
      </div>

      <section className="sa-ov-card">
        <div className="sa-ov-quick-search-header">
          <h2 className="sa-ov-section-title">
            <Search size={22} className="sa-ov-section-icon" />
            Quick User Search
          </h2>

          <p className="sa-ov-section-sub">
            Search and click any user card to open personal details, attendance,
            skills and tasks.
          </p>
        </div>

        <div className="sa-ov-big-search-bar">
          <div className="sa-ov-big-search-input-wrap">
            <Search size={18} className="sa-ov-search-icon" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Type a name, email, department, role or designation..."
              className="sa-ov-big-search-input"
            />
          </div>

          <button
            type="button"
            className="sa-ov-open-users-btn"
            onClick={() => navigate("/superadmin/users")}
          >
            Open full Users page
            <ArrowRight size={17} />
          </button>
        </div>

        {search.trim() ? (
          filteredQuickUsers.length ? (
            <div className="sa-ov-user-card-grid">
              {filteredQuickUsers.map((user) => (
                <UserMiniCard
                  key={user.user_id}
                  user={user}
                  onClick={() => openUserDetails(user)}
                />
              ))}
            </div>
          ) : (
            <div className="sa-ov-empty">No matching users found.</div>
          )
        ) : null}
      </section>

      <div className="sa-ov-two-column-grid">
        <section className="sa-ov-card">
          <h2 className="sa-ov-section-title">
            <AlertCircle size={22} className="sa-ov-section-icon" />
            Needs Attention
          </h2>

          <p className="sa-ov-section-sub">
            First 3 users are visible. Scroll to view the remaining users.
          </p>

          {attentionUsers.length ? (
            <div
              className="sa-overview-user-scroll sa-overview-hidden-scrollbar sa-ov-user-scroll-list"
            >
              {attentionUsers.map((user) => (
                <UserMiniCard
                  key={user.user_id}
                  user={user}
                  showPending
                  onClick={() => openUserDetails(user)}
                />
              ))}
            </div>
          ) : (
            <div className="sa-ov-empty">No pending workload found.</div>
          )}
        </section>

        <section className="sa-ov-card">
          <h2 className="sa-ov-section-title">
            <TrendingUp size={22} className="sa-ov-section-icon" />
            Most Active Users
          </h2>

          <p className="sa-ov-section-sub">
            First 3 users are visible. Scroll to view the remaining users.
          </p>

          {activeUsers.length ? (
            <div
              className="sa-overview-user-scroll sa-overview-hidden-scrollbar sa-ov-user-scroll-list"
            >
              {activeUsers.map((user) => (
                <UserMiniCard
                  key={user.user_id}
                  user={user}
                  onClick={() => openUserDetails(user)}
                />
              ))}
            </div>
          ) : (
            <div className="sa-ov-empty">No active users found.</div>
          )}
        </section>
      </div>

      <section className="sa-ov-card">
        <h2 className="sa-ov-section-title">
          <Users size={22} className="sa-ov-section-icon" />
          Department Snapshot
        </h2>

        <p className="sa-ov-section-sub">
          Scroll horizontally to view all departments.
        </p>

        <div
          className="sa-overview-department-grid-scroll sa-overview-hidden-scrollbar sa-ov-department-horizontal-scroll"
        >
          {departmentSummary.map((department) => (
            <button
              type="button"
              className="sa-overview-department-card sa-ov-department-card"
              key={department.department}
              onClick={() => openDepartmentDetails(department)}
            >
              <div className="sa-ov-department-top">
                <h3>{department.department}</h3>
                <span className="sa-ov-badge">{department.users} users</span>
              </div>

              <div className="sa-ov-metric-row">
                <span>Tasks</span>
                <strong>{department.tasks}</strong>
              </div>

              <div className="sa-ov-metric-row">
                <span>Projects</span>
                <strong>{department.projects}</strong>
              </div>

              <div className="sa-ov-metric-row">
                <span>Pending</span>
                <strong>{department.pending}</strong>
              </div>

              <div className="sa-ov-metric-row">
                <span>Avg Progress</span>
                <strong>{department.averageProgress}%</strong>
              </div>

              <ProgressBar value={department.averageProgress} />

            </button>
          ))}
        </div>
      </section>

      <div className="sa-ov-two-column-grid">
        <section className="sa-ov-card">
          <h2 className="sa-ov-section-title">
            <ClipboardList size={22} className="sa-ov-section-icon" />
            Task Progress Snapshot
          </h2>

          <p className="sa-ov-section-sub">
            One task tile is fully visible. Scroll to view the remaining tasks.
          </p>

          <div
            className="sa-overview-snapshot-scroll sa-overview-hidden-scrollbar sa-ov-snapshot-scroll-list"
          >
            {tasks.map((task) => (
              <button
                type="button"
                className="sa-overview-snapshot-card sa-ov-work-card"
                key={task.task_id}
                onClick={() => openTaskDetails(task)}
              >
                <div className="sa-ov-work-card-top">
                  <div className="sa-ov-min-width-0">
                    <h3>{task.task_title}</h3>
                    <p>{task.project_title || "-"}</p>
                  </div>

                  <span className="sa-ov-badge">
                    {statusLabel(task.status_group)}
                  </span>
                </div>

                <div className="sa-ov-info-grid">
                  <InfoBox label="Assignee" value={task.assignee_name || "-"} />

                  <InfoBox
                    label="Assigned By"
                    value={task.assigned_by_name || "-"}
                  />

                  <InfoBox
                    label="Subtasks"
                    value={`${task.completed_subtasks || 0}/${
                      task.total_subtasks || 0
                    }`}
                  />
                </div>

                <ProgressBar value={task.progress || 0} />

                <p className="sa-ov-small-text">Progress: {task.progress || 0}%</p>
              </button>
            ))}

            {!tasks.length && <div className="sa-ov-empty">No tasks found.</div>}
          </div>
        </section>

        <section className="sa-ov-card">
          <h2 className="sa-ov-section-title">
            <FolderKanban size={22} className="sa-ov-section-icon" />
            Project Snapshot
          </h2>

          <p className="sa-ov-section-sub">
            One project tile is fully visible. Scroll to view the remaining projects.
          </p>

          <div
            className="sa-overview-snapshot-scroll sa-overview-hidden-scrollbar sa-ov-snapshot-scroll-list"
          >
            {projects.map((project) => (
              <button
                type="button"
                className="sa-overview-snapshot-card sa-ov-work-card"
                key={project.project_id}
                onClick={() => openProjectDetails(project)}
              >
                <div className="sa-ov-work-card-top">
                  <div className="sa-ov-min-width-0">
                    <h3>{project.project_title}</h3>
                    <p>{project.project_description || "-"}</p>
                  </div>

                  <span className="sa-ov-badge">{statusLabel(project.status)}</span>
                </div>

                <div className="sa-ov-info-grid">
                  <InfoBox
                    label="Created By"
                    value={project.created_by_name || "-"}
                  />

                  <InfoBox
                    label="Assigned To"
                    value={project.assigned_names || "-"}
                  />

                  <InfoBox
                    label="Tasks"
                    value={`${project.completed_tasks || 0}/${
                      project.total_tasks || 0
                    }`}
                  />
                </div>

                <ProgressBar value={project.overall_progress || 0} />

                <p className="sa-ov-small-text">
                  Project Progress: {project.overall_progress || 0}%
                </p>
              </button>
            ))}

            {!projects.length && (
              <div className="sa-ov-empty">No projects found.</div>
            )}
          </div>
        </section>
      </div>

      {userDetailsLoading && (
        <DetailsModal title="Loading User Details..." onClose={() => {}}>
          <div className="sa-ov-empty">Loading...</div>
        </DetailsModal>
      )}

      {modal && !userDetailsLoading && (
        <DetailsModal title={modal.title} onClose={() => setModal(null)}>
          {modal.type === "user" && <UserDetails data={modal.data} />}
          {modal.type === "task" && <TaskDetails task={modal.data} />}
          {modal.type === "project" && <ProjectDetails project={modal.data} />}
          {modal.type === "department" && (
            <DepartmentDetails
              data={modal.data}
              openUserDetails={openUserDetails}
              openTaskDetails={openTaskDetails}
              openProjectDetails={openProjectDetails}
            />
          )}
          {modal.type === "userList" && (
            <UserList users={modal.data} openUserDetails={openUserDetails} />
          )}
          {modal.type === "taskList" && (
  <FilterableTaskList
    tasks={modal.data}
    openTaskDetails={openTaskDetails}
  />
)}
          {modal.type === "projectList" && (
            <ProjectList
              projects={modal.data}
              openProjectDetails={openProjectDetails}
            />
          )}
          {modal.type === "error" && <div className="sa-ov-empty">{modal.data}</div>}
        </DetailsModal>
      )}
    </div>
  );
};

const UserMiniCard = ({ user, showPending = false, onClick }) => {
  const pendingTasks = getPendingTasks(user);

  return (
    <button type="button" className="sa-ov-user-mini-card" onClick={onClick}>
      <div className="sa-ov-user-mini-top">
        <div className="sa-ov-min-width-0">
          <h3 className="sa-ov-user-name">{user.full_name || "-"}</h3>
          <p className="sa-ov-small-text">{user.email || "-"}</p>
        </div>

        <span className="sa-ov-badge">{user.role_name || "-"}</span>
      </div>

      <div className="sa-ov-user-meta-grid">
        <div className="sa-ov-user-meta-item">
          <span className="sa-ov-user-meta-label">Department</span>
          <strong className="sa-ov-user-meta-value">
            {user.department_name || "-"}
          </strong>
        </div>

        <div className="sa-ov-user-meta-item">
          <span className="sa-ov-user-meta-label">Designation</span>
          <strong className="sa-ov-user-meta-value">
            {user.designation || "-"}
          </strong>
        </div>

        <div className="sa-ov-user-meta-item">
          <span className="sa-ov-user-meta-label">Tasks</span>
          <strong className="sa-ov-user-meta-value">{user.total_tasks || 0}</strong>
        </div>

        <div className="sa-ov-user-meta-item">
          <span className="sa-ov-user-meta-label">
            {showPending ? "Pending" : "Projects"}
          </span>
          <strong className="sa-ov-user-meta-value">
            {showPending ? pendingTasks : user.total_projects || 0}
          </strong>
        </div>
      </div>

      <ProgressBar value={user.average_task_progress || 0} />

      <p className="sa-ov-small-text">
        Task Progress: {user.average_task_progress || 0}%
      </p>
    </button>
  );
};

const InfoBox = ({ label, value }) => {
  return (
    <div className="sa-ov-info-box">
      <span className="sa-ov-info-label">{label}</span>
      <strong className="sa-ov-info-value">{value || "-"}</strong>
    </div>
  );
};

const DetailsModal = ({ title, children, onClose }) => {
  return (
    <div className="sa-ov-modal-backdrop">
      <div className="sa-ov-modal">
        <button type="button" className="sa-ov-close-btn" onClick={onClose}>
          <X size={18} />
          Close
        </button>

        <div className="sa-ov-modal-top">
          <h2 className="sa-ov-modal-title">{title}</h2>
        </div>

        {children}
      </div>
    </div>
  );
};

const UserDetails = ({ data }) => {
  const user = data.user || {};
  const assignedTasks = data.assigned_tasks || [];
  const createdTasks = data.created_tasks || [];
  const assignedProjects = data.assigned_projects || [];
  const recentAttendance = data.recent_attendance || [];

  return (
    <div className="sa-ov-modal-content">
      <div className="sa-ov-detail-grid">
        <DetailBox label="Name" value={user.full_name} />
        <DetailBox label="Email" value={user.email} />
        <DetailBox label="Employee Code" value={user.employee_code} />
        <DetailBox label="Role" value={user.role_name} />
        <DetailBox label="Department" value={user.department_name} />
        <DetailBox label="Designation" value={user.designation} />
        <DetailBox label="Skills" value={user.skills} />
        <DetailBox
          label="Attendance"
          value={`${user.attendance?.attendance_percentage || 0}%`}
        />
        <DetailBox
          label="Task Progress"
          value={`${user.average_task_progress || 0}%`}
        />
      </div>

      <SectionHeading title="Assigned Tasks" />
      <TaskList tasks={assignedTasks} />

      <SectionHeading title="Tasks Assigned By This User" />
      <TaskList tasks={createdTasks} />

      <SectionHeading title="Assigned Projects" />
      <ProjectList projects={assignedProjects} />

      <SectionHeading title="Recent Attendance" />
      {recentAttendance.length ? (
        <div className="sa-ov-compact-list">
          {recentAttendance.map((row) => (
            <div className="sa-ov-compact-row" key={row.attendance_id}>
              <strong>{row.attendance_date}</strong>
              <span className="sa-ov-badge">{row.status}</span>
              <p>
                Check In: {row.check_in_time || "-"} · Check Out:{" "}
                {row.check_out_time || "-"} · Minutes: {row.total_minutes || 0}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="sa-ov-empty">No attendance found.</div>
      )}
    </div>
  );
};

const TaskDetails = ({ task }) => {
  return (
    <div className="sa-ov-modal-content">
      <div className="sa-ov-detail-grid">
        <DetailBox label="Task" value={task.task_title} />
        <DetailBox label="Project" value={task.project_title} />
        <DetailBox label="Status" value={statusLabel(task.status_group)} />
        <DetailBox label="Progress" value={`${task.progress || 0}%`} />
        <DetailBox label="Assignee" value={task.assignee_name} />
        <DetailBox label="Assignee Email" value={task.assignee_email} />
        <DetailBox label="Assigned By" value={task.assigned_by_name} />
        <DetailBox label="Assigned By Email" value={task.assigned_by_email} />
        <DetailBox label="Department" value={task.department_name} />
        <DetailBox label="Start Date" value={task.start_date} />
        <DetailBox label="Due Date" value={task.due_date} />
        <DetailBox
          label="Subtasks"
          value={`${task.completed_subtasks || 0}/${task.total_subtasks || 0}`}
        />
      </div>

      <ProgressBar value={task.progress || 0} />

      <SectionHeading title="Description" />
      <p className="sa-ov-description-text">{task.task_description || "-"}</p>

      <SectionHeading title="Subtasks" />
      {task.subtasks?.length ? (
        <div className="sa-ov-compact-list">
          {task.subtasks.map((subtask) => (
            <div className="sa-ov-compact-row" key={subtask.task_id}>
              <strong>{subtask.task_title}</strong>
              <span className="sa-ov-badge">
                {subtask.is_checked ? "Completed" : "Pending"}
              </span>
              <p>
                {subtask.start_date || "-"} to {subtask.due_date || "-"}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="sa-ov-empty">No subtasks found.</div>
      )}
    </div>
  );
};

const ProjectDetails = ({ project }) => {
  return (
    <div className="sa-ov-modal-content">
      <div className="sa-ov-detail-grid">
        <DetailBox label="Project" value={project.project_title} />
        <DetailBox label="Status" value={statusLabel(project.status)} />
        <DetailBox label="Progress" value={`${project.overall_progress || 0}%`} />
        <DetailBox label="Department" value={project.department_name} />
        <DetailBox label="Created By" value={project.created_by_name} />
        <DetailBox label="Creator Email" value={project.created_by_email} />
        <DetailBox label="Assigned To" value={project.assigned_names} />
        <DetailBox label="Assigned Emails" value={project.assigned_emails} />
        <DetailBox label="Start Date" value={project.start_date} />
        <DetailBox label="Due Date" value={project.due_date} />
        <DetailBox label="Total Tasks" value={project.total_tasks} />
        <DetailBox label="Completed Tasks" value={project.completed_tasks} />
      </div>

      <ProgressBar value={project.overall_progress || 0} />

      <SectionHeading title="Description" />
      <p className="sa-ov-description-text">{project.project_description || "-"}</p>
    </div>
  );
};

const DepartmentDetails = ({
  data,
  openUserDetails,
  openTaskDetails,
  openProjectDetails,
}) => {
  return (
    <div className="sa-ov-modal-content">
      <div className="sa-ov-detail-grid">
        <DetailBox label="Department" value={data.department.department} />
        <DetailBox label="Users" value={data.department.users} />
        <DetailBox label="Tasks" value={data.department.tasks} />
        <DetailBox label="Projects" value={data.department.projects} />
        <DetailBox label="Pending" value={data.department.pending} />
        <DetailBox
          label="Average Progress"
          value={`${data.department.averageProgress}%`}
        />
      </div>

      <SectionHeading title="Department Users" />
      <UserList users={data.users} openUserDetails={openUserDetails} />

      <SectionHeading title="Department Tasks" />
      <TaskList tasks={data.tasks} openTaskDetails={openTaskDetails} />

      <SectionHeading title="Department Projects" />
      <ProjectList
        projects={data.projects}
        openProjectDetails={openProjectDetails}
      />
    </div>
  );
};

const UserList = ({ users = [], openUserDetails }) => {
  if (!users.length) return <div className="sa-ov-empty">No users found.</div>;

  return (
    <div className="sa-ov-compact-list">
      {users.map((user) => (
        <button
          key={user.user_id}
          type="button"
          className="sa-ov-list-button"
          onClick={() => openUserDetails?.(user)}
        >
          <div>
            <strong>{user.full_name}</strong>
            <p>{user.email}</p>
            <p>
              {user.department_name || "-"} · {user.designation || "-"}
            </p>
          </div>

          <span className="sa-ov-badge">{user.role_name}</span>
        </button>
      ))}
    </div>
  );
};

const FilterableTaskList = ({
  tasks = [],
  openTaskDetails,
}) => {
  const [taskSearch, setTaskSearch] =
    useState("");

  const [
    departmentFilter,
    setDepartmentFilter,
  ] = useState("");

  const [
    projectFilter,
    setProjectFilter,
  ] = useState("");

  /*
  ==========================================
  DEPARTMENTS
  ==========================================
  */
  const departments =
    useMemo(() => {
      return Array.from(
        new Set(
          tasks
            .map(
              (task) =>
                task.department_name ||
                "No Department"
            )
            .filter(Boolean)
        )
      ).sort((a, b) =>
        a.localeCompare(b)
      );
    }, [tasks]);

  /*
  ==========================================
  TASKS AFTER DEPARTMENT FILTER
  ==========================================
  */
  const departmentTasks =
    useMemo(() => {
      if (!departmentFilter) {
        return tasks;
      }

      return tasks.filter(
        (task) =>
          (task.department_name ||
            "No Department") ===
          departmentFilter
      );
    }, [
      tasks,
      departmentFilter,
    ]);

  /*
  ==========================================
  PROJECTS BELONGING TO SELECTED DEPARTMENT
  ==========================================
  */
  const projectOptions =
    useMemo(() => {
      if (!departmentFilter) {
        return [];
      }

      const projectMap =
        new Map();

      departmentTasks.forEach(
        (task) => {
          if (!task.project_id) {
            return;
          }

          const projectId =
            String(
              task.project_id
            );

          if (
            !projectMap.has(
              projectId
            )
          ) {
            projectMap.set(
              projectId,
              {
                project_id:
                  task.project_id,

                project_title:
                  task.project_title ||
                  "Untitled Project",
              }
            );
          }
        }
      );

      return Array.from(
        projectMap.values()
      ).sort((a, b) =>
        String(
          a.project_title
        ).localeCompare(
          String(
            b.project_title
          )
        )
      );
    }, [
      departmentTasks,
      departmentFilter,
    ]);

  /*
  Whenever department changes,
  reset project.
  */
  useEffect(() => {
    setProjectFilter("");
  }, [departmentFilter]);

  /*
  ==========================================
  FINAL TASK FILTER
  ==========================================
  */
  const filteredTasks =
    useMemo(() => {
      const query =
        taskSearch
          .trim()
          .toLowerCase();

      return departmentTasks.filter(
        (task) => {
          if (
            projectFilter &&
            String(
              task.project_id
            ) !==
              String(
                projectFilter
              )
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const searchable =
            [
              task.task_title,
              task.task_description,
              task.project_title,
              task.department_name,
              task.assignee_name,
              task.assignee_email,
              task.assigned_by_name,
              task.assigned_by_email,
              statusLabel(
                task.status_group
              ),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          return searchable.includes(
            query
          );
        }
      );
    }, [
      departmentTasks,
      projectFilter,
      taskSearch,
    ]);

  return (
    <div className="sa-ov-modal-content">
      <div className="sa-ov-task-filter-panel">

        {/* SEARCH */}
        <div className="sa-ov-task-search-wrap">
          <Search
            size={18}
            className="sa-ov-task-search-icon"
          />

          <input
            type="text"
            value={taskSearch}
            onChange={(event) =>
              setTaskSearch(
                event.target.value
              )
            }
            placeholder="Search task, employee, project..."
            className="sa-ov-task-search-input"
          />
        </div>

        {/* DEPARTMENT */}
        <select
          className="sa-ov-task-filter-select"
          value={
            departmentFilter
          }
          onChange={(event) =>
            setDepartmentFilter(
              event.target.value
            )
          }
        >
          <option value="">
            All Departments
          </option>

          {departments.map(
            (department) => (
              <option
                key={
                  department
                }
                value={
                  department
                }
              >
                {department}
              </option>
            )
          )}
        </select>

        {/* PROJECT */}
        <select
          className="sa-ov-task-filter-select"
          value={
            projectFilter
          }
          disabled={
            !departmentFilter
          }
          onChange={(event) =>
            setProjectFilter(
              event.target.value
            )
          }
        >
          <option value="">
            {departmentFilter
              ? "All Projects"
              : "Select Department First"}
          </option>

          {projectOptions.map(
            (project) => (
              <option
                key={
                  project.project_id
                }
                value={
                  project.project_id
                }
              >
                {
                  project.project_title
                }
              </option>
            )
          )}
        </select>
      </div>

      <div className="sa-ov-task-filter-info">
        <span>
          Department:{" "}
          <strong>
            {departmentFilter ||
              "All"}
          </strong>
        </span>

        <span>
          Project:{" "}
          <strong>
            {projectFilter
              ? projectOptions.find(
                  (project) =>
                    String(
                      project.project_id
                    ) ===
                    String(
                      projectFilter
                    )
                )
                  ?.project_title ||
                "-"
              : "All"}
          </strong>
        </span>

        <span>
          Showing:{" "}
          <strong>
            {
              filteredTasks.length
            }
          </strong>{" "}
          task(s)
        </span>
      </div>

      <TaskList
        tasks={filteredTasks}
        openTaskDetails={
          openTaskDetails
        }
      />
    </div>
  );
};
const TaskList = ({ tasks = [], openTaskDetails }) => {
  if (!tasks.length) return <div className="sa-ov-empty">No tasks found.</div>;

  return (
    <div className="sa-ov-compact-list">
      {tasks.map((task) => (
        <button
          key={task.task_id}
          type="button"
          className="sa-ov-list-button"
          onClick={() => openTaskDetails?.(task)}
        >
          <div>
            <strong>{task.task_title}</strong>
            <p>{task.project_title || "-"}</p>
            <p>
              Assignee: {task.assignee_name || "-"} · Assigned By:{" "}
              {task.assigned_by_name || "-"}
            </p>
            <ProgressBar value={task.progress || 0} />
          </div>

          <span className="sa-ov-badge">{statusLabel(task.status_group)}</span>
        </button>
      ))}
    </div>
  );
};

const ProjectList = ({ projects = [], openProjectDetails }) => {
  if (!projects.length) return <div className="sa-ov-empty">No projects found.</div>;

  return (
    <div className="sa-ov-compact-list">
      {projects.map((project) => (
        <button
          key={project.project_id}
          type="button"
          className="sa-ov-list-button"
          onClick={() => openProjectDetails?.(project)}
        >
          <div>
            <strong>{project.project_title}</strong>
            <p>{project.project_description || "-"}</p>
            <p>
              Created By: {project.created_by_name || "-"} · Assigned To:{" "}
              {project.assigned_names || "-"}
            </p>
            <ProgressBar value={project.overall_progress || 0} />
          </div>

          <span className="sa-ov-badge">{statusLabel(project.status)}</span>
        </button>
      ))}
    </div>
  );
};

const DetailBox = ({ label, value }) => {
  const labelText = String(label || "");
  const shouldBeWide =
    labelText.toLowerCase().includes("email") ||
    labelText.toLowerCase().includes("skills");

  return (
    <div className={`sa-ov-detail-box ${shouldBeWide ? "sa-ov-detail-box-wide" : ""}`}>
      <span className="sa-ov-detail-label">{label}</span>
      <strong className="sa-ov-detail-value">{value || "-"}</strong>
    </div>
  );
};

const SectionHeading = ({ title }) => {
  return <h3 className="sa-ov-modal-section-heading">{title}</h3>;
};

export default SuperadminOverview;

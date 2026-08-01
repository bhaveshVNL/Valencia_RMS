import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Clock3,
  FolderKanban,
  PauseCircle,
  RefreshCw,
  Search,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import api from "../../api/axios";
import "./superadminTasks.css";

const STATUS_COLUMNS = [
  {
    key: "not_started",
    label: "To Do",
    icon: CircleDot,
  },
  {
    key: "in_progress",
    label: "In Progress",
    icon: Clock3,
  },
  {
    key: "under_review",
    label: "Under Review",
    icon: Search,
  },
  {
    key: "completed",
    label: "Completed",
    icon: CheckCircle2,
  },
  {
    key: "rejected",
    label: "Rejected",
    icon: XCircle,
  },
  {
    key: "blocked",
    label: "Blocked",
    icon: PauseCircle,
  },
];

const normalizeStatus = (status) => {
  const value = String(status || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

  if (
    value === "todo" ||
    value === "to_do" ||
    value === "pending" ||
    value === "not-started"
  ) {
    return "not_started";
  }

  if (value === "ongoing" || value === "progress") {
    return "in_progress";
  }

  if (value === "review") {
    return "under_review";
  }

  if (value === "done" || value === "complete") {
    return "completed";
  }

  if (value === "on_hold" || value === "hold") {
    return "blocked";
  }

  return value || "not_started";
};

const statusLabel = (status) => {
  const normalized = normalizeStatus(status);

  return (
    STATUS_COLUMNS.find((column) => column.key === normalized)?.label ||
    String(status || "To Do")
  );
};

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getSafeProgress = (value) => {
  const progress = Number(value || 0);

  if (Number.isNaN(progress)) return 0;
  return Math.max(0, Math.min(100, progress));
};

const isTaskOverdue = (task) => {
  const normalizedStatus = normalizeStatus(task.status_group || task.status);

  if (normalizedStatus === "completed") return false;
  if (!task.due_date) return false;

  const dueDate = new Date(task.due_date);

  if (Number.isNaN(dueDate.getTime())) return false;

  dueDate.setHours(23, 59, 59, 999);
  return dueDate.getTime() < Date.now();
};

const SuperadminTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await api.get("/superadmin/tasks");
      setTasks(response.data?.tasks || []);
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to load tasks."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const departments = useMemo(() => {
    return Array.from(
      new Set(
        tasks
          .map((task) => task.department_name)
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
      )
    );
  }, [tasks]);

  const assignees = useMemo(() => {
    const map = new Map();

    tasks.forEach((task) => {
      if (task.assignee_name) {
        map.set(task.assignee_name, task.assignee_name);
      }
    });

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const term = search.toLowerCase().trim();

    return tasks.filter((task) => {
      const matchesSearch =
        !term ||
        String(task.task_title || "").toLowerCase().includes(term) ||
        String(task.task_description || "").toLowerCase().includes(term) ||
        String(task.project_title || "").toLowerCase().includes(term) ||
        String(task.assignee_name || "").toLowerCase().includes(term) ||
        String(task.assigned_by_name || "").toLowerCase().includes(term) ||
        String(task.department_name || "").toLowerCase().includes(term);

      const matchesDepartment =
        department === "all" || task.department_name === department;

      const matchesAssignee =
        assignee === "all" || task.assignee_name === assignee;

      return matchesSearch && matchesDepartment && matchesAssignee;
    });
  }, [tasks, search, department, assignee]);

  const groupedTasks = useMemo(() => {
    return STATUS_COLUMNS.reduce((acc, column) => {
      acc[column.key] = filteredTasks.filter(
        (task) =>
          normalizeStatus(task.status_group || task.status) === column.key
      );

      return acc;
    }, {});
  }, [filteredTasks]);

  return (
    <div className="sa-tasks-page">
      <div className="sa-tasks-header">
        <div>
          <h1>All Tasks</h1>
          <p>
            Read-only Kanban view of every task across projects, departments and
            employees.
          </p>
        </div>

        <button
          type="button"
          className="sa-tasks-refresh-btn"
          onClick={fetchTasks}
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {message && <div className="sa-tasks-message">{message}</div>}

      <section className="sa-tasks-toolbar">
        <label className="sa-tasks-search">
          <Search size={18} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search task, project, assignee, assigned by..."
          />
        </label>

        <select
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
          aria-label="Filter by department"
        >
          <option value="all">All Departments</option>
          {departments.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          value={assignee}
          onChange={(event) => setAssignee(event.target.value)}
          aria-label="Filter by assignee"
        >
          <option value="all">All Assignees</option>
          {assignees.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </section>

      {loading ? (
        <div className="sa-tasks-empty">Loading tasks...</div>
      ) : (
        <section className="sa-tasks-board" aria-label="Task Kanban Board">
          {STATUS_COLUMNS.map((column) => {
            const ColumnIcon = column.icon;
            const columnTasks = groupedTasks[column.key] || [];

            return (
              <article
                className={`sa-tasks-column sa-tasks-column-${column.key}`}
                key={column.key}
              >
                <div className="sa-tasks-column-header">
                  <div>
                    <span className="sa-tasks-column-icon">
                      <ColumnIcon size={18} />
                    </span>
                    <h2>{column.label}</h2>
                  </div>

                  <span className="sa-tasks-column-count">
                    {columnTasks.length}
                  </span>
                </div>

                <div className="sa-tasks-column-list">
                  {columnTasks.map((task) => (
                    <TaskCard
                      key={task.task_id}
                      task={task}
                      onClick={() => setSelectedTask(task)}
                    />
                  ))}

                  {!columnTasks.length && (
                    <div className="sa-tasks-column-empty">
                      No {column.label.toLowerCase()} tasks.
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
};

const TaskCard = ({ task, onClick }) => {
  const progress = getSafeProgress(task.progress);
  const overdue = isTaskOverdue(task);

  return (
    <button type="button" className="sa-task-kanban-card" onClick={onClick}>
      <div className="sa-task-card-title-row">
        <span className="sa-task-card-title-icon">
          <ClipboardList size={18} />
        </span>

        <h3>{task.task_title || "Untitled Task"}</h3>

        {overdue && (
          <span className="sa-task-overdue-badge">
            <AlertTriangle size={13} />
            Overdue
          </span>
        )}
      </div>

      <div className="sa-task-card-info-box">
        <span>Project Name</span>
        <strong>{task.project_title || "No project"}</strong>
      </div>

      <div className="sa-task-card-info-box sa-task-card-department-box">
        <span>Department</span>
        <strong>{task.department_name || "-"}</strong>
      </div>

      <div className="sa-task-card-info-box">
        <span>Assigned Employee</span>
        <strong>{task.assignee_name || "-"}</strong>
      </div>

      <div className="sa-task-card-date-grid">
        <div>
          <span>Start Date</span>
          <strong>{formatDate(task.start_date)}</strong>
        </div>

        <div>
          <span>Due Date</span>
          <strong>{formatDate(task.due_date)}</strong>
        </div>
      </div>
    </button>
  );
};

const TaskDetailsModal = ({ task, onClose }) => {
  const progress = getSafeProgress(task.progress);
  const overdue = isTaskOverdue(task);

  return (
    <div
      className="sa-task-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="sa-task-modal">
        <div className="sa-task-modal-header">
          <div>
            <div className="sa-task-modal-title-row">
              <h2>{task.task_title || "Task Details"}</h2>

              {overdue && (
                <span className="sa-task-overdue-badge">
                  <AlertTriangle size={13} />
                  Overdue
                </span>
              )}
            </div>

            <p>{task.project_title || "No project"}</p>
          </div>

          <button type="button" className="sa-task-modal-close" onClick={onClose}>
            <X size={18} />
            Close
          </button>
        </div>

        <div className="sa-task-modal-grid">
          <DetailBox label="Status" value={statusLabel(task.status_group)} />
          <DetailBox label="Progress" value={`${progress}%`} />
          <DetailBox label="Department" value={task.department_name} />
          <DetailBox label="Assignee" value={task.assignee_name} />
          <DetailBox label="Assignee Email" value={task.assignee_email} />
          <DetailBox label="Assigned By" value={task.assigned_by_name} />
          <DetailBox label="Assigned By Email" value={task.assigned_by_email} />
          <DetailBox label="Start Date" value={formatDate(task.start_date)} />
          <DetailBox label="Due Date" value={formatDate(task.due_date)} />
          <DetailBox
            label="Subtasks"
            value={`${task.completed_subtasks || 0}/${
              task.total_subtasks || 0
            }`}
          />
        </div>

        <div className="sa-task-modal-progress">
          <progress value={progress} max="100">
            {progress}%
          </progress>
          <span>Task Progress: {progress}%</span>
        </div>

        <section className="sa-task-modal-section">
          <h3>Description</h3>
          <p>{task.task_description || "No description added."}</p>
        </section>

        <section className="sa-task-modal-section">
          <h3>Subtasks</h3>

          {task.subtasks?.length ? (
            <div className="sa-task-modal-subtasks">
              {task.subtasks.map((subtask) => (
                <div className="sa-task-modal-subtask" key={subtask.task_id}>
                  <span
                    className={`sa-task-modal-subtask-dot ${
                      subtask.is_checked ? "done" : ""
                    }`}
                  />

                  <div>
                    <strong>{subtask.task_title || "-"}</strong>
                    <p>
                      {formatDate(subtask.start_date)} to{" "}
                      {formatDate(subtask.due_date)}
                    </p>
                  </div>

                  <span className="sa-task-modal-subtask-status">
                    {subtask.is_checked ? "Completed" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="sa-task-modal-empty">No subtasks found.</div>
          )}
        </section>
      </div>
    </div>
  );
};

const DetailBox = ({ label, value }) => (
  <div className="sa-task-detail-box">
    <span>{label}</span>
    <strong>{value || "-"}</strong>
  </div>
);

export default SuperadminTasks;
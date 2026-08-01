import { useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardList,
  Download,
  RefreshCw,
  Search,
  Upload,
  X,
} from "lucide-react";
import api from "../../api/axios";
import "./administratorTasks.css";

const taskColumns = [
  {
    key: "todo",
    title: "To Do",
    subtitle: "Tasks that have not started",
  },
  {
    key: "in_progress",
    title: "In Progress",
    subtitle: "Tasks currently being worked on",
  },
  {
    key: "completed",
    title: "Completed",
    subtitle: "Tasks that are finished",
  },
  {
    key: "blocked",
    title: "Blocked",
    subtitle: "Tasks that cannot continue",
  },
];

const normalizeStatus = (status) => {
  const value = String(status || "")
    .toLowerCase()
    .trim()
    .replaceAll(" ", "_");

  if (
    value === "completed" ||
    value === "complete" ||
    value === "done"
  ) {
    return "completed";
  }

  if (
    value === "in_progress" ||
    value === "ongoing" ||
    value === "progress"
  ) {
    return "in_progress";
  }

  if (value === "blocked" || value === "on_hold") {
    return "blocked";
  }

  return "todo";
};

const getStatusLabel = (status) => {
  const normalizedStatus = normalizeStatus(status);

  if (normalizedStatus === "in_progress") return "In Progress";
  if (normalizedStatus === "completed") return "Completed";
  if (normalizedStatus === "blocked") return "Blocked";

  return "To Do";
};

const formatDate = (date) => {
  if (!date) return "-";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const AdministratorTasks = () => {
  const fileInputRef = useRef(null);

  const [allTasks, setAllTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await api.get("/administrator/tasks/all");

      setAllTasks(response.data.tasks || []);
    } catch (error) {
      setMessage(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to load tasks."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const filteredTasks = useMemo(() => {
    const value = search.toLowerCase().trim();

    if (!value) {
      return allTasks;
    }

    return allTasks.filter((task) => {
      return (
        String(task.task_title || "").toLowerCase().includes(value) ||
        String(task.task_description || "").toLowerCase().includes(value) ||
        String(task.project_title || "").toLowerCase().includes(value) ||
        String(task.status || "").toLowerCase().includes(value) ||
        String(task.priority || "").toLowerCase().includes(value) ||
        String(task.assigned_to_name || "").toLowerCase().includes(value) ||
        String(task.assigned_to_email || "").toLowerCase().includes(value) ||
        String(task.created_by_name || "").toLowerCase().includes(value) ||
        String(task.created_by_email || "").toLowerCase().includes(value)
      );
    });
  }, [allTasks, search]);

  const groupedTasks = useMemo(() => {
    const grouped = {
      todo: [],
      in_progress: [],
      completed: [],
      blocked: [],
    };

    filteredTasks.forEach((task) => {
      const status = normalizeStatus(task.status);

      grouped[status].push(task);
    });

    return grouped;
  }, [filteredTasks]);

  const exportTasks = async () => {
    try {
      setMessage("");

      const response = await api.get("/administrator/tasks/export", {
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8;",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.setAttribute("download", "valencia-rms-tasks.csv");

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to export tasks."
      );
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const importTasks = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setImporting(true);
      setMessage("");

      const response = await api.post(
        "/administrator/tasks/import",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setMessage(
        `${response.data.message || "Import completed."} Imported Tasks: ${
          response.data.inserted_tasks || 0
        }, Skipped Rows: ${response.data.skipped_rows || 0}, Missing Projects: ${
          response.data.missing_projects || 0
        }, Missing Assigned Users: ${
          response.data.missing_assigned_users || 0
        }`
      );

      await fetchTasks();
    } catch (error) {
      setMessage(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to import tasks."
      );
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const openTaskModal = (task) => {
    setSelectedTask(task);
  };

  const closeTaskModal = () => {
    setSelectedTask(null);
  };

  const renderTaskCard = (task) => {
    return (
      <article
        className="administrator-task-card"
        key={task.task_id}
        onClick={() => openTaskModal(task)}
      >
        <div className="administrator-task-card-header">
          <div className="administrator-task-card-icon">
            <ClipboardList size={17} />
          </div>

          <h3>{task.task_title || "Untitled Task"}</h3>
        </div>

        <div className="administrator-task-card-field">
          <span>Project Name</span>
          <strong>{task.project_title || "-"}</strong>
        </div>

        <div className="administrator-task-card-field">
          <span>Assigned Employee</span>
          <strong>{task.assigned_to_name || "-"}</strong>
        </div>
      </article>
    );
  };

  return (
    <div className="administrator-tasks-page">
      <div className="administrator-tasks-header">
        <div>
          <h1>Tasks</h1>

          <p>View all tasks assigned across the company.</p>
        </div>

        <div className="administrator-tasks-actions">
          <button
            type="button"
            className="administrator-task-import-btn"
            onClick={handleImportClick}
            disabled={importing}
          >
            <Upload size={15} />
            {importing ? "Importing..." : "Import CSV"}
          </button>

          <button
            type="button"
            className="administrator-task-action-btn"
            onClick={exportTasks}
          >
            <Download size={15} />
            Export CSV
          </button>

          <button
            type="button"
            className="administrator-task-action-btn"
            onClick={fetchTasks}
            disabled={loading}
          >
            <RefreshCw size={15} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            hidden
            onChange={importTasks}
          />
        </div>
      </div>

      {message && (
        <div className="administrator-tasks-message">{message}</div>
      )}

      <div className="administrator-tasks-search">
        <Search size={17} />

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search tasks, projects, employees or status..."
        />
      </div>

      {loading ? (
        <div className="administrator-tasks-loader">
          Loading tasks...
        </div>
      ) : (
        <div className="administrator-tasks-kanban">
          {taskColumns.map((column) => (
            <section
              className="administrator-task-column"
              key={column.key}
            >
              <div className="administrator-task-column-header">
                <div>
                  <h2>{column.title}</h2>
                  <p>{column.subtitle}</p>
                </div>

                <span>{groupedTasks[column.key]?.length || 0}</span>
              </div>

              <div className="administrator-task-column-body">
                {groupedTasks[column.key]?.length > 0 ? (
                  groupedTasks[column.key].map(renderTaskCard)
                ) : (
                  <div className="administrator-task-empty">
                    No tasks here.
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="administrator-task-csv-help">
        <h3>CSV Import Format</h3>

        <p>
          Use only these columns:
          <strong>
            {" "}
            task_title, project_title, assigned_employee_email,
            created_by_email, status, start_date, due_date
          </strong>
        </p>

        <p>
          Imported tasks are treated as main tasks. Employee-created subtasks
          appear under their parent task.
        </p>
      </div>

      {selectedTask && (
        <div
          className="administrator-task-modal-overlay"
          onClick={closeTaskModal}
        >
          <div
            className="administrator-task-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="administrator-task-modal-header">
              <div>
                <h2>{selectedTask.task_title || "Untitled Task"}</h2>

                <p>
                  {selectedTask.task_description ||
                    "No task description added."}
                </p>
              </div>

              <button type="button" onClick={closeTaskModal}>
                <X size={19} />
              </button>
            </div>

            <div className="administrator-task-modal-grid">
              <div>
                <span>Project Name</span>
                <strong>{selectedTask.project_title || "-"}</strong>
              </div>

              <div>
                <span>Task Type</span>
                <strong>
                  {String(selectedTask.task_type || "-").replaceAll("_", " ")}
                </strong>
              </div>

              <div>
                <span>Status</span>
                <strong>{getStatusLabel(selectedTask.status)}</strong>
              </div>

              <div>
                <span>Priority</span>
                <strong>{selectedTask.priority || "-"}</strong>
              </div>

              <div>
                <span>Progress</span>
                <strong>{selectedTask.progress || 0}%</strong>
              </div>

              <div>
                <span>Parent Task</span>
                <strong>{selectedTask.parent_task_title || "-"}</strong>
              </div>

              <div>
                <span>Assigned Employee</span>
                <strong>{selectedTask.assigned_to_name || "-"}</strong>
              </div>

              <div>
                <span>Assigned Employee Email</span>
                <strong>{selectedTask.assigned_to_email || "-"}</strong>
              </div>

              <div>
                <span>Created By</span>
                <strong>{selectedTask.created_by_name || "-"}</strong>
              </div>

              <div>
                <span>Created By Email</span>
                <strong>{selectedTask.created_by_email || "-"}</strong>
              </div>

              <div>
                <span>Start Date</span>
                <strong>{formatDate(selectedTask.start_date)}</strong>
              </div>

              <div>
                <span>Due Date</span>
                <strong>{formatDate(selectedTask.due_date)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdministratorTasks;
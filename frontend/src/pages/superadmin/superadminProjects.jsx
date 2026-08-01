import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleDot,
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
import "./superadminProjects.css";

const PROJECT_COLUMNS = [
  { key: "not_started", label: "To Do", icon: CircleDot },
  { key: "in_progress", label: "In Progress", icon: Clock3 },
  { key: "under_review", label: "Under Review", icon: Search },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
  { key: "rejected", label: "Rejected", icon: XCircle },
  { key: "on_hold", label: "On Hold", icon: PauseCircle },
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

  if (value === "progress" || value === "ongoing") {
    return "in_progress";
  }

  if (value === "review") {
    return "under_review";
  }

  if (value === "done" || value === "complete") {
    return "completed";
  }

  if (value === "hold") {
    return "on_hold";
  }

  if (value === "cancelled" || value === "canceled") {
    return "rejected";
  }

  return value || "not_started";
};

const statusLabel = (status) => {
  const normalized = normalizeStatus(status);

  return (
    PROJECT_COLUMNS.find((column) => column.key === normalized)?.label ||
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

const getNumber = (...values) => {
  for (const value of values) {
    const number = Number(value);

    if (!Number.isNaN(number)) {
      return Math.max(0, Math.min(100, number));
    }
  }

  return 0;
};

const resolveProjectStatus = (project) => {
  const values = [
    project.is_rejected ? "rejected" : "",
    project.rejected_at ? "rejected" : "",
    project.rejection_reason ? "rejected" : "",
    project.status,
    project.project_status,
    project.status_group,
    project.normalized_status,
  ];

  const value =
    values.find((item) => String(item || "").trim()) || "not_started";

  return normalizeStatus(value);
};

const isProjectOverdue = (project) => {
  if (project.normalized_status === "completed") return false;

  const value =
    project.due_date || project.end_date || project.project_end_date;

  if (!value) return false;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return false;

  date.setHours(23, 59, 59, 999);
  return date.getTime() < Date.now();
};

const SuperadminProjects = () => {
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [creator, setCreator] = useState("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await api.get("/superadmin/projects");
      setProjects(response.data?.projects || []);
    } catch (error) {
      setMessage(
        error.response?.data?.sqlMessage ||
          error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to load projects."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const preparedProjects = useMemo(() => {
    return projects.map((project) => ({
      ...project,
      normalized_status: resolveProjectStatus(project),
      progress: getNumber(
        project.overall_progress,
        project.progress,
        project.computed_progress
      ),
    }));
  }, [projects]);

  const departments = useMemo(() => {
    return Array.from(
      new Set(
        preparedProjects
          .map((project) => project.department_name)
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [preparedProjects]);

  const creators = useMemo(() => {
    return Array.from(
      new Set(
        preparedProjects
          .map((project) => project.created_by_name)
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [preparedProjects]);

  const filteredProjects = useMemo(() => {
    const term = search.toLowerCase().trim();

    return preparedProjects.filter((project) => {
      const matchesSearch =
        !term ||
        String(project.project_title || "").toLowerCase().includes(term) ||
        String(project.project_description || "")
          .toLowerCase()
          .includes(term) ||
        String(project.description || "").toLowerCase().includes(term) ||
        String(project.department_name || "").toLowerCase().includes(term) ||
        String(project.created_by_name || "").toLowerCase().includes(term) ||
        String(project.assigned_names || "").toLowerCase().includes(term);

      const matchesDepartment =
        department === "all" || project.department_name === department;

      const matchesCreator =
        creator === "all" || project.created_by_name === creator;

      return matchesSearch && matchesDepartment && matchesCreator;
    });
  }, [preparedProjects, search, department, creator]);

  const groupedProjects = useMemo(() => {
    return PROJECT_COLUMNS.reduce((result, column) => {
      result[column.key] = filteredProjects.filter(
        (project) => project.normalized_status === column.key
      );

      return result;
    }, {});
  }, [filteredProjects]);

  return (
    <div className="sa-projects-page">
      <header className="sa-projects-header">
        <div>
          <h1>All Projects</h1>
          <p>
            Read-only Kanban view of projects across departments, creators and
            assigned employees.
          </p>
        </div>

        <button
          type="button"
          className="sa-projects-refresh"
          onClick={fetchProjects}
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </header>

      {message && <div className="sa-projects-message">{message}</div>}

      <section className="sa-projects-toolbar">
        <label className="sa-projects-search">
          <Search size={18} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search project, creator, assignee, department..."
          />
        </label>

        <select
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
          aria-label="Filter projects by department"
        >
          <option value="all">All Departments</option>
          {departments.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          value={creator}
          onChange={(event) => setCreator(event.target.value)}
          aria-label="Filter projects by creator"
        >
          <option value="all">All Creators</option>
          {creators.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </section>

      {loading ? (
        <div className="sa-projects-empty">Loading projects...</div>
      ) : (
        <section className="sa-projects-board" aria-label="Project Kanban Board">
          {PROJECT_COLUMNS.map((column) => {
            const ColumnIcon = column.icon;
            const columnProjects = groupedProjects[column.key] || [];

            return (
              <article
                key={column.key}
                className={`sa-projects-column sa-projects-column-${column.key}`}
              >
                <div className="sa-projects-column-header">
                  <div>
                    <span className="sa-projects-column-icon">
                      <ColumnIcon size={18} />
                    </span>
                    <h2>{column.label}</h2>
                  </div>

                  <span className="sa-projects-column-count">
                    {columnProjects.length}
                  </span>
                </div>

                <div className="sa-projects-column-list">
                  {columnProjects.map((project) => (
                    <ProjectCard
                      key={project.project_id}
                      project={project}
                      onClick={() => setSelectedProject(project)}
                    />
                  ))}

                  {!columnProjects.length && (
                    <div className="sa-projects-column-empty">
                      No {column.label.toLowerCase()} projects.
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {selectedProject && (
        <ProjectDetailsModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  );
};

const ProjectCard = ({ project, onClick }) => {
  const overdue = isProjectOverdue(project);

  return (
    <button type="button" className="sa-project-card" onClick={onClick}>
      <div className="sa-project-card-title">
        <span className="sa-project-card-icon">
          <FolderKanban size={18} />
        </span>

        <h3>{project.project_title || "Untitled Project"}</h3>

        {overdue && (
          <span className="sa-project-overdue">
            <AlertTriangle size={12} />
            Overdue
          </span>
        )}
      </div>

      <div className="sa-project-info-box">
        <span>Department</span>
        <strong>{project.department_name || "-"}</strong>
      </div>

      <div className="sa-project-info-box">
        <span>Created By</span>
        <strong>{project.created_by_name || "-"}</strong>
      </div>

      <div className="sa-project-info-box">
        <span>Assigned To</span>
        <strong>{project.assigned_names || "-"}</strong>
      </div>

      <div className="sa-project-date-grid">
        <div>
          <span>Start Date</span>
          <strong>
            {formatDate(
              project.start_date ||
                project.project_start_date ||
                project.created_at
            )}
          </strong>
        </div>

        <div>
          <span>Due Date</span>
          <strong>
            {formatDate(
              project.due_date ||
                project.end_date ||
                project.project_end_date
            )}
          </strong>
        </div>
      </div>

      <div className="sa-project-progress">
        <div>
          <span>Progress</span>
          <strong>{project.progress}%</strong>
        </div>

        <progress value={project.progress} max="100">
          {project.progress}%
        </progress>
      </div>

      <div className="sa-project-card-footer">
        <span>
          Tasks {project.completed_tasks || 0}/{project.total_tasks || 0}
        </span>
        <span>View details</span>
      </div>
    </button>
  );
};

const ProjectDetailsModal = ({ project, onClose }) => {
  const overdue = isProjectOverdue(project);

  return (
    <div
      className="sa-project-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sa-project-modal">
        <div className="sa-project-modal-header">
          <div>
            <div className="sa-project-modal-title-row">
              <h2>{project.project_title || "Project Details"}</h2>

              {overdue && (
                <span className="sa-project-overdue">
                  <AlertTriangle size={12} />
                  Overdue
                </span>
              )}
            </div>

            <p>{statusLabel(project.normalized_status)}</p>
          </div>

          <button
            type="button"
            className="sa-project-modal-close"
            onClick={onClose}
          >
            <X size={18} />
            Close
          </button>
        </div>

        <div className="sa-project-detail-grid">
          <DetailBox label="Status" value={statusLabel(project.normalized_status)} />
          <DetailBox label="Progress" value={`${project.progress}%`} />
          <DetailBox label="Department" value={project.department_name} />
          <DetailBox label="Created By" value={project.created_by_name} />
          <DetailBox label="Creator Email" value={project.created_by_email} />
          <DetailBox label="Assigned To" value={project.assigned_names} />
          <DetailBox label="Assigned Emails" value={project.assigned_emails} />
          <DetailBox
            label="Start Date"
            value={formatDate(
              project.start_date ||
                project.project_start_date ||
                project.created_at
            )}
          />
          <DetailBox
            label="Due Date"
            value={formatDate(
              project.due_date ||
                project.end_date ||
                project.project_end_date
            )}
          />
          <DetailBox label="Total Tasks" value={project.total_tasks || 0} />
          <DetailBox
            label="Completed Tasks"
            value={project.completed_tasks || 0}
          />
        </div>

        <div className="sa-project-modal-progress">
          <progress value={project.progress} max="100">
            {project.progress}%
          </progress>
          <span>Project Progress: {project.progress}%</span>
        </div>

        <section className="sa-project-modal-section">
          <h3>Description</h3>
          <p>
            {project.project_description ||
              project.description ||
              "No description added."}
          </p>
        </section>

        {project.normalized_status === "on_hold" && (
          <div className="sa-project-status-notice hold">
            <PauseCircle size={18} />
            This project is currently on hold.
          </div>
        )}

        {project.normalized_status === "rejected" && (
          <div className="sa-project-status-notice rejected">
            <XCircle size={18} />
            This project has been rejected.
          </div>
        )}
      </div>
    </div>
  );
};

const DetailBox = ({ label, value }) => (
  <div className="sa-project-detail-box">
    <span>{label}</span>
    <strong>{value || "-"}</strong>
  </div>
);

export default SuperadminProjects;
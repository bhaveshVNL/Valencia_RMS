import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import "./administratorProjects.css";

const statusColumns = [
  {
    key: "todo",
    title: "To Do",
    subtitle: "Project/task has not started",
  },
  {
    key: "in_progress",
    title: "In Progress",
    subtitle: "Work has started",
  },
  {
    key: "under_review",
    title: "Under Review",
    subtitle: "Waiting for admin review",
  },
  {
    key: "done",
    title: "Done",
    subtitle: "Completed work",
  },
];

const formatDate = (dateValue) => {
  if (!dateValue) return "";

  const value = String(dateValue);

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const compareDateOnly = (leftDate, rightDate) => {
  const left = formatDate(leftDate);
  const right = formatDate(rightDate);

  if (!left || !right) return 0;

  if (left < right) return -1;
  if (left > right) return 1;

  return 0;
};

const isSubtaskDone = (status) => {
  const value = String(status || "").toLowerCase().trim();

  return value === "done" || value === "completed" || value === "complete";
};

const isDateRangeOverlapping = (
  newStartDate,
  newEndDate,
  existingStartDate,
  existingEndDate
) => {
  const newStart = formatDate(newStartDate);
  const newEnd = formatDate(newEndDate);
  const existingStart = formatDate(existingStartDate);
  const existingEnd = formatDate(existingEndDate);

  if (!newStart || !newEnd || !existingStart || !existingEnd) {
    return false;
  }

  return !(existingEnd < newStart || existingStart > newEnd);
};

const AdministratorProjects = ({ showAllProjects = true }) => {
  const [activeTab, setActiveTab] = useState("my");

  const [myProjects, setMyProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [rejectedProjects, setRejectedProjects] = useState([]);
  const [onHoldProjects, setOnHoldProjects] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");

  const [selectedProject, setSelectedProject] = useState(null);
  const [subtasks, setSubtasks] = useState([]);

  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [subtaskStartDate, setSubtaskStartDate] = useState("");
  const [subtaskEndDate, setSubtaskEndDate] = useState("");

  const [modalLoading, setModalLoading] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [togglingSubtaskId, setTogglingSubtaskId] = useState(null);
  const [specialActionProjectId, setSpecialActionProjectId] = useState(null);

  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageSuccess, setPageSuccess] = useState("");

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/administrator-projects/projects");

      setMyProjects(response.data?.myProjects || []);
      setAllProjects(response.data?.allProjects || []);
      setRejectedProjects(response.data?.rejectedProjects || []);
      setOnHoldProjects(response.data?.onHoldProjects || []);
    } catch (err) {
      console.error("Fetch administrator projects error:", err);

      setError(
        err?.response?.data?.sqlMessage ||
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to fetch projects."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const visibleProjects =
    activeTab === "my"
      ? myProjects
      : showAllProjects && activeTab === "all"
        ? allProjects
        : activeTab === "rejected"
          ? rejectedProjects
          : onHoldProjects;

  const filteredProjects = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    if (!term) {
      return visibleProjects;
    }

    return visibleProjects.filter((project) => {
      return (
        String(project.project_title || "").toLowerCase().includes(term) ||
        String(project.description || "").toLowerCase().includes(term) ||
        String(project.status_label || "").toLowerCase().includes(term) ||
        String(project.department_name || "").toLowerCase().includes(term) ||
        String(project.created_by_name || "").toLowerCase().includes(term) ||
        String(project.assigned_names || "").toLowerCase().includes(term)
      );
    });
  }, [visibleProjects, searchTerm]);

  const groupedMyProjects = useMemo(() => {
    const grouped = {
      todo: [],
      in_progress: [],
      under_review: [],
      done: [],
    };

    filteredProjects.forEach((project) => {
      const key = project.status_group || "todo";

      if (!grouped[key]) {
        grouped.todo.push(project);
        return;
      }

      grouped[key].push(project);
    });

    return grouped;
  }, [filteredProjects]);

  const getProjectStartDate = (project) => {
    return (
      formatDate(project?.start_date) ||
      formatDate(project?.project_start_date) ||
      ""
    );
  };

  const getProjectEndDate = (project) => {
    return (
      formatDate(project?.end_date) ||
      formatDate(project?.due_date) ||
      formatDate(project?.project_end_date) ||
      formatDate(project?.deadline) ||
      ""
    );
  };

  const getMainTask = (project) => {
    return (
      project?.main_task ||
      project?.task_title ||
      project?.main_task_title ||
      project?.description ||
      "No main task added."
    );
  };

  const openProjectModal = async (project) => {
    if (project.is_rejected || project.is_on_hold) {
      return;
    }

    try {
      setSelectedProject(project);
      setSubtasks([]);
      setSubtaskTitle("");
      setSubtaskStartDate("");
      setSubtaskEndDate("");
      setModalError("");
      setModalSuccess("");
      setModalLoading(true);

      const response = await api.get(
        `/administrator-projects/projects/${project.project_id}/subtasks`
      );

      if (response.data?.project) {
        setSelectedProject({
          ...project,
          ...response.data.project,
        });
      }

      setSubtasks(response.data?.subtasks || []);
    } catch (err) {
      console.error("Fetch subtasks error:", err);

      setModalError(
        err?.response?.data?.sqlMessage ||
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to fetch subtasks."
      );
    } finally {
      setModalLoading(false);
    }
  };

  const closeProjectModal = () => {
    setSelectedProject(null);
    setSubtasks([]);
    setSubtaskTitle("");
    setSubtaskStartDate("");
    setSubtaskEndDate("");
    setModalError("");
    setModalSuccess("");
  };

  const handleAddSubtask = async (event) => {
    event.preventDefault();

    if (!selectedProject) {
      return;
    }

    setModalError("");
    setModalSuccess("");

    const projectStartDate = getProjectStartDate(selectedProject);
    const projectEndDate = getProjectEndDate(selectedProject);

    if (!subtaskTitle.trim()) {
      setModalError("Please enter subtask title.");
      return;
    }

    if (!subtaskStartDate) {
      setModalError("Please select subtask start date.");
      return;
    }

    if (!subtaskEndDate) {
      setModalError("Please select subtask end date.");
      return;
    }

    if (compareDateOnly(subtaskEndDate, subtaskStartDate) < 0) {
      setModalError("Subtask end date cannot be before subtask start date.");
      return;
    }

    if (
      projectStartDate &&
      compareDateOnly(subtaskStartDate, projectStartDate) < 0
    ) {
      setModalError(
        `Subtask start date cannot be before project start date ${projectStartDate}.`
      );
      return;
    }

    if (projectEndDate && compareDateOnly(subtaskEndDate, projectEndDate) > 0) {
      setModalError(
        `Subtask end date cannot exceed project end date ${projectEndDate}.`
      );
      return;
    }

    const overlappingSubtask = subtasks.find((subtask) =>
      isDateRangeOverlapping(
        subtaskStartDate,
        subtaskEndDate,
        subtask.start_date,
        subtask.end_date
      )
    );

    if (overlappingSubtask) {
      setModalError(
        `This date range is already assigned to "${
          overlappingSubtask.title
        }" from ${formatDate(overlappingSubtask.start_date)} to ${formatDate(
          overlappingSubtask.end_date
        )}. Please select another date range.`
      );
      return;
    }

    try {
      setAddingSubtask(true);

      const response = await api.post(
        `/administrator-projects/projects/${selectedProject.project_id}/subtasks`,
        {
          title: subtaskTitle.trim(),
          start_date: subtaskStartDate,
          end_date: subtaskEndDate,
        }
      );

      setSubtasks(response.data?.subtasks || []);
      setSubtaskTitle("");
      setSubtaskStartDate("");
      setSubtaskEndDate("");

      setModalSuccess(
        response.data?.message || "Subtask added successfully."
      );

      await fetchProjects();
    } catch (err) {
      console.error("Add subtask error:", err);

      setModalError(
        err?.response?.data?.sqlMessage ||
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to add subtask."
      );
    } finally {
      setAddingSubtask(false);
    }
  };

  const handleToggleSubtask = async (
    project,
    subtask,
    checked,
    event
  ) => {
    if (event) {
      event.stopPropagation();
    }

    if (isSubtaskDone(subtask.status)) {
      return;
    }

    try {
      setTogglingSubtaskId(subtask.subtask_id);
      setModalError("");
      setModalSuccess("");

      const response = await api.patch(
        `/administrator-projects/projects/${project.project_id}/subtasks/${subtask.subtask_id}/status`,
        {
          checked,
        }
      );

      setSubtasks(response.data?.subtasks || []);

      await fetchProjects();
    } catch (err) {
      console.error("Toggle subtask error:", err);

      const message =
        err?.response?.data?.sqlMessage ||
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Failed to update subtask.";

      if (selectedProject) {
        setModalError(message);
      } else {
        setError(message);
      }
    } finally {
      setTogglingSubtaskId(null);
    }
  };

  const handleResumeOnHoldProject = async (projectId) => {
    try {
      setSpecialActionProjectId(projectId);
      setError("");
      setPageSuccess("");

      const response = await api.post(
        `/administrator-projects/projects/${projectId}/on-hold/resume`
      );

      setPageSuccess(
        response.data?.message || "Project resumed successfully."
      );

      await fetchProjects();
      setActiveTab("my");
    } catch (err) {
      console.error("Resume on-hold project error:", err);

      setError(
        err?.response?.data?.sqlMessage ||
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to resume on-hold project."
      );
    } finally {
      setSpecialActionProjectId(null);
    }
  };

  const renderProjectCard = (project) => {
    return (
      <article
        className="administrator-project-card clickable"
        key={project.project_id}
        onClick={() => openProjectModal(project)}
      >
        <div className="administrator-project-card-header">
          <h3>{project.project_title || "Untitled Project"}</h3>

          <span className="administrator-status-badge">
            {project.status_label || "To Do"}
          </span>
        </div>

        <div className="administrator-project-card-field">
          <span>Main Task</span>
          <strong>{getMainTask(project)}</strong>
        </div>

        <div className="administrator-project-card-field">
          <span>Assigned To</span>
          <strong>{project.assigned_names || "-"}</strong>
        </div>

        <div className="administrator-project-card-dates">
          <div>
            <span>Start Date</span>
            <strong>{getProjectStartDate(project) || "-"}</strong>
          </div>

          <div>
            <span>End Date</span>
            <strong>{getProjectEndDate(project) || "-"}</strong>
          </div>
        </div>

        <div className="administrator-card-progress">
          <div className="administrator-progress-bar">
            <div
              className="administrator-progress-fill"
              style={{
                width: `${Math.min(Number(project.progress || 0), 100)}%`,
              }}
            />
          </div>

          
        </div>

        
      </article>
    );
  };

  const renderRejectedProjects = () => {
    if (filteredProjects.length === 0) {
      return (
        <div className="administrator-rejected-empty">
          No rejected projects found.
        </div>
      );
    }

    return (
      <div className="administrator-rejected-grid">
        {filteredProjects.map((project) => (
          <div
            className="administrator-rejected-card"
            key={project.project_id}
          >
            <div className="administrator-rejected-card-header">
              <div>
                <h3>{project.project_title}</h3>
                <p>{project.description || "No description added."}</p>
              </div>

              <span>Rejected</span>
            </div>

            <div className="administrator-rejected-reason">
              {project.rejection_reason ||
                "Project rejected by admin. This project cannot be edited."}
            </div>

            <div className="administrator-rejected-info-grid">
              <div>
                <span>Assigned</span>
                <strong>{project.assigned_names || "-"}</strong>
              </div>

              <div>
                <span>Rejected On</span>
                <strong>{formatDate(project.rejected_at) || "-"}</strong>
              </div>

              <div>
                <span>Available Till</span>
                <strong>
                  {formatDate(project.rejection_expires_at) || "-"}
                </strong>
              </div>

              <div>
                <span>Status</span>
                <strong>Rejected - Locked</strong>
              </div>
            </div>

            <div className="administrator-rejected-locked">
              This project is rejected. No action is allowed.
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderOnHoldProjects = () => {
    if (filteredProjects.length === 0) {
      return (
        <div className="administrator-rejected-empty">
          No on-hold projects found.
        </div>
      );
    }

    return (
      <div className="administrator-rejected-grid">
        {filteredProjects.map((project) => (
          <div className="administrator-hold-card" key={project.project_id}>
            <div className="administrator-hold-card-header">
              <div>
                <h3>{project.project_title}</h3>
                <p>{project.description || "No description added."}</p>
              </div>

              <span>On Hold</span>
            </div>

            <div className="administrator-hold-reason">
              {project.hold_reason ||
                "Project kept on hold by admin. You can resume it."}
            </div>

            <div className="administrator-rejected-info-grid">
              <div>
                <span>Assigned</span>
                <strong>{project.assigned_names || "-"}</strong>
              </div>

              <div>
                <span>Held On</span>
                <strong>{formatDate(project.held_at) || "-"}</strong>
              </div>

              <div>
                <span>Progress</span>
                <strong>{project.progress || 0}%</strong>
              </div>

              <div>
                <span>Status</span>
                <strong>On Hold</strong>
              </div>
            </div>

            <div className="administrator-rejected-actions">
              <button
                type="button"
                className="administrator-resume-btn"
                disabled={specialActionProjectId === project.project_id}
                onClick={() =>
                  handleResumeOnHoldProject(project.project_id)
                }
              >
                {specialActionProjectId === project.project_id
                  ? "Resuming..."
                  : "Resume Project"}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="administrator-projects-page">
      <div className="administrator-projects-header">
        <div className="administrator-projects-title-area">
          <h1>Projects</h1>

          <p>
            Manage assigned projects, subtasks and project progress.
          </p>
        </div>

        <button
          type="button"
          className="administrator-refresh-button"
          onClick={fetchProjects}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="administrator-project-tabs">
        <button
          type="button"
          className={activeTab === "my" ? "active" : ""}
          onClick={() => setActiveTab("my")}
        >
          My Projects
          <span>{myProjects.length}</span>
        </button>

        {showAllProjects && (
          <button
            type="button"
            className={activeTab === "all" ? "active" : ""}
            onClick={() => setActiveTab("all")}
          >
            All Projects
            <span>{allProjects.length}</span>
          </button>
        )}

        <button
          type="button"
          className={activeTab === "rejected" ? "active" : ""}
          onClick={() => setActiveTab("rejected")}
        >
          Rejected Projects
          <span>{rejectedProjects.length}</span>
        </button>

        <button
          type="button"
          className={activeTab === "on_hold" ? "active" : ""}
          onClick={() => setActiveTab("on_hold")}
        >
          Projects On Hold
          <span>{onHoldProjects.length}</span>
        </button>
      </div>

      <input
        className="administrator-project-search"
        type="text"
        placeholder="Search projects, employee, admin, status..."
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
      />

      {pageSuccess && (
        <div className="administrator-project-success">
          {pageSuccess}
        </div>
      )}

      {loading && (
        <div className="administrator-project-message">
          Loading projects...
        </div>
      )}

      {!loading && error && (
        <div className="administrator-project-error">{error}</div>
      )}

      {!loading && !error && activeTab === "my" && (
        <div className="administrator-kanban-board">
          {statusColumns.map((column) => (
            <section
              className="administrator-kanban-column"
              key={column.key}
            >
              <div className="administrator-kanban-column-header">
                <div>
                  <h2>{column.title}</h2>
                  <p>{column.subtitle}</p>
                </div>

                <span>{groupedMyProjects[column.key]?.length || 0}</span>
              </div>

              <div className="administrator-kanban-column-body">
                {groupedMyProjects[column.key]?.length === 0 ? (
                  <div className="administrator-empty-column">
                    No projects here.
                  </div>
                ) : (
                  groupedMyProjects[column.key].map(renderProjectCard)
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {!loading && !error && activeTab === "all" && (
        <div className="administrator-all-projects-card">
          <table className="administrator-all-projects-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Dates</th>
                <th>Department</th>
                <th>Created By</th>
                <th>Assigned</th>
              </tr>
            </thead>

            <tbody>
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan="7" className="administrator-empty-table">
                    No projects found.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project) => (
                  <tr key={project.project_id}>
                    <td>
                      <strong>{project.project_title}</strong>
                      <p>{project.description || "-"}</p>
                    </td>

                    <td>
                      <span className="administrator-status-badge">
                        {project.status_label || "To Do"}
                      </span>
                    </td>

                    <td>
                      <div className="administrator-progress-row table-progress">
                        <div className="administrator-progress-bar">
                          <div
                            className="administrator-progress-fill"
                            style={{
                              width: `${Math.min(
                                Number(project.progress || 0),
                                100
                              )}%`,
                            }}
                          />
                        </div>

                        <span>{project.progress || 0}%</span>
                      </div>

                      <small>
                        {project.completed_subtasks || 0}/
                        {project.total_subtasks || 0} subtasks done
                      </small>
                    </td>

                    <td>
                      <strong>{getProjectStartDate(project) || "-"}</strong>
                      <p>to {getProjectEndDate(project) || "-"}</p>
                    </td>

                    <td>{project.department_name || "-"}</td>

                    <td>
                      <strong>{project.created_by_name || "-"}</strong>
                      <p>{project.created_by_email || "-"}</p>
                    </td>

                    <td>{project.assigned_names || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading &&
        !error &&
        activeTab === "rejected" &&
        renderRejectedProjects()}

      {!loading &&
        !error &&
        activeTab === "on_hold" &&
        renderOnHoldProjects()}

      {selectedProject && (
        <div
          className="administrator-project-modal-overlay"
          onClick={closeProjectModal}
        >
          <div
            className="administrator-project-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="administrator-project-modal-header">
              <div>
                <h2>{selectedProject.project_title}</h2>

                <p>
                  {selectedProject.description ||
                    "No description added."}
                </p>
              </div>

              <button type="button" onClick={closeProjectModal}>
                ×
              </button>
            </div>

            <div className="administrator-project-modal-info">
              <div>
                <span>Status</span>
                <strong>
                  {selectedProject.status_label || "To Do"}
                </strong>
              </div>

              <div>
                <span>Department</span>
                <strong>
                  {selectedProject.department_name || "-"}
                </strong>
              </div>

              <div>
                <span>Created By</span>
                <strong>
                  {selectedProject.created_by_name || "-"}
                </strong>
              </div>
            </div>

            <div className="administrator-project-modal-info">
              <div>
                <span>Assigned</span>
                <strong>
                  {selectedProject.assigned_names || "-"}
                </strong>
              </div>

              <div>
                <span>Project Start Date</span>
                <strong>
                  {getProjectStartDate(selectedProject) || "-"}
                </strong>
              </div>

              <div>
                <span>Project End Date</span>
                <strong>
                  {getProjectEndDate(selectedProject) || "-"}
                </strong>
              </div>
            </div>

            <div className="administrator-project-modal-info">
              <div>
                <span>Main Task</span>
                <strong>{getMainTask(selectedProject)}</strong>
              </div>

              <div>
                <span>Progress</span>
                <strong>
                  {selectedProject.progress || 0}%
                </strong>
              </div>

              <div>
                <span>Subtasks</span>
                <strong>{subtasks.length}</strong>
              </div>
            </div>

            <form
              className="administrator-subtask-form"
              onSubmit={handleAddSubtask}
            >
              <label>Add Subtask</label>

              <div className="administrator-subtask-input-column">
                <input
                  type="text"
                  placeholder="Example: Collect vendor quotation details"
                  value={subtaskTitle}
                  onChange={(event) =>
                    setSubtaskTitle(event.target.value)
                  }
                />

                <div className="administrator-subtask-date-grid">
                  <div>
                    <label>Subtask Start Date</label>

                    <input
                      type="date"
                      value={subtaskStartDate}
                      min={
                        getProjectStartDate(selectedProject) || undefined
                      }
                      max={
                        getProjectEndDate(selectedProject) || undefined
                      }
                      onChange={(event) =>
                        setSubtaskStartDate(event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label>Subtask End Date</label>

                    <input
                      type="date"
                      value={subtaskEndDate}
                      min={
                        subtaskStartDate ||
                        getProjectStartDate(selectedProject) ||
                        undefined
                      }
                      max={
                        getProjectEndDate(selectedProject) || undefined
                      }
                      onChange={(event) =>
                        setSubtaskEndDate(event.target.value)
                      }
                    />
                  </div>
                </div>

                <button type="submit" disabled={addingSubtask}>
                  {addingSubtask ? "Adding..." : "Add Subtask"}
                </button>
              </div>
            </form>

            {modalSuccess && (
              <div className="administrator-modal-success">
                {modalSuccess}
              </div>
            )}

            {modalError && (
              <div className="administrator-modal-error">
                {modalError}
              </div>
            )}

            <div className="administrator-subtask-list">
              <h3>Subtasks</h3>

              {modalLoading ? (
                <div className="administrator-subtask-empty">
                  Loading subtasks...
                </div>
              ) : subtasks.length === 0 ? (
                <div className="administrator-subtask-empty">
                  No subtasks added yet.
                </div>
              ) : (
                subtasks.map((subtask) => (
                  <label
                    className={`administrator-subtask-row with-checkbox ${
                      isSubtaskDone(subtask.status)
                        ? "locked-subtask"
                        : ""
                    }`}
                    key={subtask.subtask_id}
                  >
                    <input
                      type="checkbox"
                      checked={isSubtaskDone(subtask.status)}
                      disabled={
                        togglingSubtaskId === subtask.subtask_id ||
                        isSubtaskDone(subtask.status)
                      }
                      onChange={(event) =>
                        handleToggleSubtask(
                          selectedProject,
                          subtask,
                          event.target.checked,
                          event
                        )
                      }
                    />

                    <div>
                      <strong>{subtask.title}</strong>

                      <p>
                        {formatDate(subtask.start_date) || "-"} to{" "}
                        {formatDate(subtask.end_date) || "-"}
                      </p>
                    </div>

                    <span>
                      {isSubtaskDone(subtask.status)
                        ? "done - locked"
                        : subtask.status || "todo"}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdministratorProjects;
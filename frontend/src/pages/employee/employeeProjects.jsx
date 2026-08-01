import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import api from "../../api/axios";

const API_BASE = "/employee-projects";

const getFirstWorkingEndpoint = async (endpoints) => {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      return await api.get(endpoint);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

const normalizeProjectsResponse = (data) => {
  if (Array.isArray(data)) {
    return {
      myProjects: data,
      rejectedProjects: [],
      onHoldProjects: [],
    };
  }

  return {
    myProjects:
      data?.myProjects ||
      data?.my_projects ||
      data?.projects ||
      data?.assignedProjects ||
      data?.assigned_projects ||
      data?.data ||
      [],

    rejectedProjects:
      data?.rejectedProjects ||
      data?.rejected_projects ||
      [],

    onHoldProjects:
      data?.onHoldProjects ||
      data?.on_hold_projects ||
      data?.holdProjects ||
      data?.hold_projects ||
      [],
  };
};

const statusColumns = [
  {
    key: "todo",
    title: "To Do",
    subtitle: "Project/task has not started yet",
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

  if (Number.isNaN(parsedDate.getTime())) return "";

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

const normalizeStatus = (status) => {
  const value = String(status || "").toLowerCase().trim().replace(/\s+/g, "_");

  if (
    value === "todo" ||
    value === "to_do" ||
    value === "pending" ||
    value === "not_started" ||
    value === "not-started"
  ) {
    return "todo";
  }

  if (value === "in_progress" || value === "ongoing" || value === "progress") {
    return "in_progress";
  }

  if (value === "under_review" || value === "review") {
    return "under_review";
  }

  if (value === "done" || value === "completed" || value === "complete") {
    return "done";
  }

  if (value === "rejected" || value === "reject") {
    return "rejected";
  }

  if (value === "on_hold" || value === "hold") {
    return "on_hold";
  }

  return "todo";
};

const getStatusLabel = (status) => {
  const value = normalizeStatus(status);

  if (value === "todo") return "To Do";
  if (value === "in_progress") return "In Progress";
  if (value === "under_review") return "Under Review";
  if (value === "done") return "Done";
  if (value === "rejected") return "Rejected";
  if (value === "on_hold") return "On Hold";

  return "To Do";
};

const isSubtaskDone = (status, isChecked) => {
  const value = normalizeStatus(status);
  return value === "done" || Number(isChecked || 0) === 1;
};

const getProjectTitle = (project) => {
  return project?.project_title || project?.title || "Untitled Project";
};

const getProjectMainTask = (project) => {
  return (
    project?.description ||
    project?.project_description ||
    project?.main_task ||
    project?.task_description ||
    "No main task added."
  );
};

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

const getAssignedNames = (project) => {
  return (
    project?.assigned_names ||
    project?.assigned_employees ||
    project?.assigned_to_names ||
    project?.assigned_to ||
    "-"
  );
};

const getAssignedEmails = (project) => {
  return (
    project?.assigned_emails ||
    project?.assigned_employee_emails ||
    project?.assigned_to_emails ||
    "-"
  );
};

const getSubtaskId = (subtask) => {
  return subtask?.subtask_id || subtask?.task_id;
};

const getSubtaskTitle = (subtask) => {
  return subtask?.title || subtask?.task_title || "Untitled Subtask";
};

const getSubtaskDescription = (subtask) => {
  return (
    subtask?.description ||
    subtask?.task_description ||
    subtask?.subtask_description ||
    ""
  );
};

const getSubtaskStartDate = (subtask) => {
  return formatDate(subtask?.start_date || subtask?.task_start_date);
};

const getSubtaskEndDate = (subtask) => {
  return formatDate(
    subtask?.end_date || subtask?.due_date || subtask?.task_end_date
  );
};

const isProjectLocked = (project) => {
  const status = normalizeStatus(
    project?.status_group || project?.status || project?.project_status
  );

  return (
    status === "under_review" ||
    status === "done" ||
    status === "rejected" ||
    status === "on_hold"
  );
};

const EmployeeProjects = () => {
  const [activeTab, setActiveTab] = useState("my");

  const [myProjects, setMyProjects] = useState([]);
  const [rejectedProjects, setRejectedProjects] = useState([]);
  const [onHoldProjects, setOnHoldProjects] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");

  const [selectedProject, setSelectedProject] = useState(null);
  const [subtasks, setSubtasks] = useState([]);

  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [subtaskDescription, setSubtaskDescription] = useState("");
  const [subtaskStartDate, setSubtaskStartDate] = useState("");
  const [subtaskEndDate, setSubtaskEndDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [togglingSubtaskId, setTogglingSubtaskId] = useState(null);

  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getFirstWorkingEndpoint([
        `${API_BASE}/projects`,
        `${API_BASE}/my-projects`,
        `${API_BASE}/my`,
        `${API_BASE}`,
        `/employee/projects/my`,
        `/employee/projects`,
      ]);

      const data = response.data || {};
      const normalizedData = normalizeProjectsResponse(data);

      const receivedProjects = normalizedData.myProjects || [];

      const receivedRejected =
        normalizedData.rejectedProjects.length > 0
          ? normalizedData.rejectedProjects
          : receivedProjects.filter((project) => {
              return (
                normalizeStatus(project.status_group || project.status) ===
                "rejected"
              );
            });

      const receivedOnHold =
        normalizedData.onHoldProjects.length > 0
          ? normalizedData.onHoldProjects
          : receivedProjects.filter((project) => {
              return (
                normalizeStatus(project.status_group || project.status) ===
                "on_hold"
              );
            });

      const activeProjects = receivedProjects.filter((project) => {
        const status = normalizeStatus(project.status_group || project.status);
        return status !== "rejected" && status !== "on_hold";
      });

      setMyProjects(activeProjects);
      setRejectedProjects(receivedRejected);
      setOnHoldProjects(receivedOnHold);
    } catch (err) {
      console.error("Fetch employee projects error:", err);

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
      : activeTab === "rejected"
      ? rejectedProjects
      : onHoldProjects;

  const filteredProjects = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    if (!term) return visibleProjects;

    return visibleProjects.filter((project) => {
      return (
        String(getProjectTitle(project)).toLowerCase().includes(term) ||
        String(getProjectMainTask(project)).toLowerCase().includes(term) ||
        String(getStatusLabel(project.status_group || project.status))
          .toLowerCase()
          .includes(term) ||
        String(project.department_name || "").toLowerCase().includes(term) ||
        String(project.created_by_name || "").toLowerCase().includes(term) ||
        String(getAssignedNames(project)).toLowerCase().includes(term)
      );
    });
  }, [visibleProjects, searchTerm]);

  const groupedProjects = useMemo(() => {
    const grouped = {
      todo: [],
      in_progress: [],
      under_review: [],
      done: [],
    };

    filteredProjects.forEach((project) => {
      const key = normalizeStatus(
        project.status_group || project.status || project.project_status
      );

      if (!grouped[key]) {
        grouped.todo.push(project);
        return;
      }

      grouped[key].push(project);
    });

    return grouped;
  }, [filteredProjects]);

  const openProjectModal = async (project) => {
    try {
      setSelectedProject(project);
      setSubtasks(project.subtasks || []);
      setSubtaskTitle("");
      setSubtaskDescription("");
      setSubtaskStartDate("");
      setSubtaskEndDate("");
      setModalError("");
      setModalSuccess("");
      setModalLoading(true);

      const response = await api.get(
        `${API_BASE}/projects/${project.project_id}/subtasks`
      );

      if (response.data?.project) {
        setSelectedProject({
          ...project,
          ...response.data.project,
        });
      }

      setSubtasks(response.data?.subtasks || project.subtasks || []);
    } catch (err) {
      console.error("Fetch employee project subtasks error:", err);

      setModalError(
        err?.response?.data?.sqlMessage ||
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to fetch project details."
      );
    } finally {
      setModalLoading(false);
    }
  };

  const closeProjectModal = () => {
    setSelectedProject(null);
    setSubtasks([]);
    setSubtaskTitle("");
    setSubtaskDescription("");
    setSubtaskStartDate("");
    setSubtaskEndDate("");
    setModalError("");
    setModalSuccess("");
  };

  const handleAddSubtask = async (event) => {
    event.preventDefault();

    if (!selectedProject) return;

    setModalError("");
    setModalSuccess("");

    if (isProjectLocked(selectedProject)) {
      setModalError("This project is locked. Subtasks cannot be added now.");
      return;
    }

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

    try {
      setAddingSubtask(true);

      const response = await api.post(
        `${API_BASE}/projects/${selectedProject.project_id}/subtasks`,
        {
          title: subtaskTitle,
          description: subtaskDescription,
          start_date: subtaskStartDate,
          end_date: subtaskEndDate,
        }
      );

      setSubtasks(response.data?.subtasks || []);
      setSubtaskTitle("");
      setSubtaskDescription("");
      setSubtaskStartDate("");
      setSubtaskEndDate("");
      setModalSuccess(response.data?.message || "Subtask added successfully.");

      await fetchProjects();
    } catch (err) {
      console.error("Add employee subtask error:", err);

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

  const handleToggleSubtask = async (subtask, checked) => {
    if (!selectedProject) return;

    const subtaskId = getSubtaskId(subtask);

    if (!subtaskId) {
      setModalError("Subtask ID not found.");
      return;
    }

    if (isProjectLocked(selectedProject)) {
      setModalError("This project is locked. Subtasks cannot be changed now.");
      return;
    }

    if (isSubtaskDone(subtask.status, subtask.is_checked)) {
      setModalError("Completed subtasks are locked and cannot be unchecked.");
      return;
    }

    try {
      setTogglingSubtaskId(subtaskId);
      setModalError("");
      setModalSuccess("");

      const response = await api.patch(
        `${API_BASE}/projects/${selectedProject.project_id}/subtasks/${subtaskId}/status`,
        {
          checked,
        }
      );

      setSubtasks(response.data?.subtasks || []);
      setModalSuccess(response.data?.message || "Subtask updated successfully.");

      await fetchProjects();
    } catch (err) {
      console.error("Toggle employee subtask error:", err);

      setModalError(
        err?.response?.data?.sqlMessage ||
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to update subtask."
      );
    } finally {
      setTogglingSubtaskId(null);
    }
  };

  const renderCompactProjectTile = (project) => {
    return (
      <button
        type="button"
        style={styles.projectTile}
        key={project.project_id}
        onClick={() => openProjectModal(project)}
      >
        <div style={styles.projectTileTop}>
          <h3 style={styles.projectTileTitle}>{getProjectTitle(project)}</h3>

          <span style={styles.statusPill}>
            {getStatusLabel(project.status_group || project.status)}
          </span>
        </div>

        <p style={styles.projectTileDescription}>{getProjectMainTask(project)}</p>

        <span style={styles.clickHint}>Click to view full details</span>
      </button>
    );
  };

  const renderSpecialProjectList = (projects, type) => {
    if (projects.length === 0) {
      return (
        <div style={styles.emptySpecial}>
          No {type === "rejected" ? "rejected" : "on-hold"} projects found.
        </div>
      );
    }

    return (
      <div style={styles.specialGrid}>
        {projects.map((project) => (
          <button
            type="button"
            key={project.project_id}
            style={
              type === "rejected" ? styles.rejectedProjectTile : styles.holdTile
            }
            onClick={() => openProjectModal(project)}
          >
            <div style={styles.projectTileTop}>
              <h3 style={styles.projectTileTitle}>{getProjectTitle(project)}</h3>

              <span
                style={type === "rejected" ? styles.rejectedPill : styles.holdPill}
              >
                {type === "rejected" ? "Rejected" : "On Hold"}
              </span>
            </div>

            <p style={styles.projectTileDescription}>{getProjectMainTask(project)}</p>

            <span style={styles.clickHint}>Click to view details</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div style={styles.page}>
      <div
  style={{
    width: "100%",
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: "18px",
  }}
>
  <button type="button" style={styles.refreshBtn} onClick={fetchProjects}>
    <RefreshCw size={18} />
    Refresh
  </button>
</div>

      <section style={styles.tabs}>
        <button
          type="button"
          style={activeTab === "my" ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab("my")}
        >
          My Projects <span>{myProjects.length}</span>
        </button>

        <button
          type="button"
          style={activeTab === "rejected" ? styles.activeRejectedTab : styles.tab}
          onClick={() => setActiveTab("rejected")}
        >
          Rejected Projects <span>{rejectedProjects.length}</span>
        </button>

        <button
          type="button"
          style={activeTab === "on_hold" ? styles.activeHoldTab : styles.tab}
          onClick={() => setActiveTab("on_hold")}
        >
          Projects On Hold <span>{onHoldProjects.length}</span>
        </button>
      </section>

      <input
        style={styles.search}
        type="text"
        placeholder="Search projects, admin, status..."
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
      />

      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <div style={styles.empty}>Loading projects...</div>
      ) : activeTab === "my" ? (
        <section style={styles.stageRow}>
          {statusColumns.map((column) => (
            <div style={styles.stageColumn} key={column.key}>
              <div style={styles.stageHeader}>
                <div>
                  <h2 style={styles.stageTitle}>{column.title}</h2>
                  <p style={styles.stageSubtitle}>{column.subtitle}</p>
                </div>

                <span style={styles.stageCount}>
                  {groupedProjects[column.key]?.length || 0}
                </span>
              </div>

              <div style={styles.stageBody}>
                {groupedProjects[column.key]?.length === 0 ? (
                  <div style={styles.emptyColumn}>No projects here.</div>
                ) : (
                  groupedProjects[column.key].map(renderCompactProjectTile)
                )}
              </div>
            </div>
          ))}
        </section>
      ) : activeTab === "rejected" ? (
        renderSpecialProjectList(filteredProjects, "rejected")
      ) : (
        renderSpecialProjectList(filteredProjects, "on_hold")
      )}

      {selectedProject && (
        <div style={styles.modalBackdrop} onClick={closeProjectModal}>
          <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  {getProjectTitle(selectedProject)}
                </h2>
                <p style={styles.modalDescription}>
                  {getProjectMainTask(selectedProject)}
                </p>
              </div>

              <button type="button" style={styles.closeBtn} onClick={closeProjectModal}>
                <X size={18} />
              </button>
            </div>

            <div style={styles.detailGrid}>
              <div style={styles.detailBox}>
                <span>Department</span>
                <strong>{selectedProject.department_name || "-"}</strong>
              </div>

              <div style={styles.detailBox}>
                <span>Created By</span>
                <strong>{selectedProject.created_by_name || "-"}</strong>
                <p>{selectedProject.created_by_email || "-"}</p>
              </div>

              <div style={styles.detailBox}>
                <span>Assigned To</span>
                <strong>{getAssignedNames(selectedProject)}</strong>
                <p>{getAssignedEmails(selectedProject)}</p>
              </div>

              <div style={styles.detailBox}>
                <span>Status</span>
                <strong>
                  {getStatusLabel(
                    selectedProject.status_group || selectedProject.status
                  )}
                </strong>
              </div>

              <div style={styles.detailBox}>
                <span>Start Date</span>
                <strong>{getProjectStartDate(selectedProject) || "-"}</strong>
              </div>

              <div style={styles.detailBox}>
                <span>End Date</span>
                <strong>{getProjectEndDate(selectedProject) || "-"}</strong>
              </div>
            </div>

            <div style={styles.progressBlock}>
              <div style={styles.progressTop}>
                <strong>Project Progress</strong>
                <span>
                  {selectedProject.progress || selectedProject.overall_progress || 0}%
                </span>
              </div>

              <div style={styles.progressTrack}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${
                      selectedProject.progress ||
                      selectedProject.overall_progress ||
                      0
                    }%`,
                  }}
                />
              </div>

              <p style={styles.progressNote}>
                {selectedProject.completed_subtasks || 0}/
                {selectedProject.total_subtasks || 0} subtasks completed
              </p>
            </div>

            {isProjectLocked(selectedProject) && (
              <div style={styles.lockNotice}>
                This project is locked because it is{" "}
                {getStatusLabel(selectedProject.status_group || selectedProject.status)}.
              </div>
            )}

            {!isProjectLocked(selectedProject) && (
              <form style={styles.subtaskForm} onSubmit={handleAddSubtask}>
                <div style={styles.formTitleRow}>
                  <Plus size={18} />
                  <h3>Add Subtask</h3>
                </div>

                <div style={styles.formGrid}>
                  <div style={styles.field}>
                    <label>Subtask Title</label>
                    <input
                      type="text"
                      value={subtaskTitle}
                      onChange={(event) => setSubtaskTitle(event.target.value)}
                      placeholder="Example: Backend API"
                    />
                  </div>

                  <div style={styles.field}>
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={subtaskStartDate}
                      min={getProjectStartDate(selectedProject) || undefined}
                      max={getProjectEndDate(selectedProject) || undefined}
                      onChange={(event) =>
                        setSubtaskStartDate(event.target.value)
                      }
                    />
                  </div>

                  <div style={styles.field}>
                    <label>End Date</label>
                    <input
                      type="date"
                      value={subtaskEndDate}
                      min={
                        subtaskStartDate ||
                        getProjectStartDate(selectedProject) ||
                        undefined
                      }
                      max={getProjectEndDate(selectedProject) || undefined}
                      onChange={(event) => setSubtaskEndDate(event.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    style={styles.addBtn}
                    disabled={addingSubtask}
                  >
                    {addingSubtask ? "Adding..." : "Add"}
                  </button>

                  <div style={styles.fieldFull}>
                    <label>Subtask Description</label>
                    <textarea
                      value={subtaskDescription}
                      onChange={(event) =>
                        setSubtaskDescription(event.target.value)
                      }
                      placeholder="Write what this subtask includes..."
                      style={styles.textarea}
                    />
                  </div>
                </div>
              </form>
            )}

            {modalSuccess && <div style={styles.modalSuccess}>{modalSuccess}</div>}
            {modalError && <div style={styles.modalError}>{modalError}</div>}

            <section style={styles.subtaskSection}>
              <h3 style={styles.sectionTitle}>Subtasks</h3>

              {modalLoading ? (
                <div style={styles.empty}>Loading subtasks...</div>
              ) : subtasks.length === 0 ? (
                <div style={styles.empty}>No subtasks added yet.</div>
              ) : (
                <div style={styles.subtaskList}>
                  {subtasks.map((subtask) => {
                    const subtaskId = getSubtaskId(subtask);
                    const done = isSubtaskDone(
                      subtask.status,
                      subtask.is_checked
                    );

                    return (
                      <label style={styles.subtaskRow} key={subtaskId}>
                        <input
                          type="checkbox"
                          checked={done}
                          disabled={
                            done ||
                            isProjectLocked(selectedProject) ||
                            togglingSubtaskId === subtaskId
                          }
                          onChange={(event) =>
                            handleToggleSubtask(subtask, event.target.checked)
                          }
                        />

                        <div>
                          <strong>{getSubtaskTitle(subtask)}</strong>

                          <p>
                            {getSubtaskStartDate(subtask) || "-"} to{" "}
                            {getSubtaskEndDate(subtask) || "-"}
                          </p>

                          {getSubtaskDescription(subtask) && (
                            <p style={styles.subtaskDescription}>
                              {getSubtaskDescription(subtask)}
                            </p>
                          )}
                        </div>

                        <span style={done ? styles.doneBadge : styles.todoBadge}>
                          {done ? "Done" : getStatusLabel(subtask.status)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  page: {
    width: "100%",
    paddingBottom: "40px",
  },
  header: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "22px",
    padding: "30px 34px",
    marginBottom: "22px",
    display: "flex",
    justifyContent: "space-between",
    gap: "18px",
    alignItems: "center",
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
  },
  h1: {
    margin: "0 0 8px",
    color: "#111827",
    fontSize: "36px",
    fontWeight: 900,
  },
  subtitle: {
    margin: 0,
    color: "#667085",
    fontSize: "16px",
    lineHeight: 1.5,
  },
  refreshBtn: {
    border: "0",
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "14px",
    padding: "13px 18px",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
  },
  tabs: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  tab: {
    border: "0",
    background: "#ffffff",
    color: "#111827",
    borderRadius: "16px",
    padding: "16px 22px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)",
  },
  activeTab: {
    border: "0",
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "16px",
    padding: "16px 22px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(255, 87, 51, 0.18)",
  },
  activeRejectedTab: {
    border: "0",
    background: "#ef4444",
    color: "#ffffff",
    borderRadius: "16px",
    padding: "16px 22px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(239, 68, 68, 0.18)",
  },
  activeHoldTab: {
    border: "0",
    background: "#111827",
    color: "#ffffff",
    borderRadius: "16px",
    padding: "16px 22px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(17, 24, 39, 0.18)",
  },
  search: {
    width: "min(720px, 100%)",
    height: "54px",
    border: "1px solid #d1d5db",
    borderRadius: "16px",
    padding: "0 18px",
    outline: "0",
    fontSize: "15px",
    marginBottom: "24px",
    background: "#ffffff",
  },
  stageRow: {
    display: "flex",
    flexWrap: "nowrap",
    gap: "20px",
    overflowX: "auto",
    paddingBottom: "14px",
  },
  stageColumn: {
    flex: "0 0 300px",
    minHeight: "520px",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "22px",
    padding: "18px",
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
  },
  stageHeader: {
    background: "#f8fafc",
    borderRadius: "18px",
    padding: "16px",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    marginBottom: "16px",
  },
  stageTitle: {
    margin: 0,
    color: "#111827",
    fontSize: "22px",
    fontWeight: 900,
  },
  stageSubtitle: {
    margin: "5px 0 0",
    color: "#667085",
    fontSize: "13px",
  },
  stageCount: {
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    background: "#e5e7eb",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    color: "#111827",
    flexShrink: 0,
  },
  stageBody: {
    display: "grid",
    gap: "12px",
  },
  projectTile: {
    width: "100%",
    textAlign: "left",
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: "18px",
    padding: "18px",
    cursor: "pointer",
    transition: "0.2s ease",
  },
  projectTileTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    marginBottom: "10px",
  },
  projectTileTitle: {
    margin: 0,
    color: "#111827",
    fontSize: "19px",
    fontWeight: 900,
  },
  projectTileDescription: {
    margin: "0 0 14px",
    color: "#667085",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  statusPill: {
    background: "#eef2ff",
    color: "#374151",
    borderRadius: "999px",
    padding: "7px 11px",
    fontSize: "12px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  clickHint: {
    color: "#ff5733",
    fontSize: "13px",
    fontWeight: 900,
  },
  emptyColumn: {
    border: "1px dashed #d1d5db",
    borderRadius: "16px",
    padding: "22px",
    textAlign: "center",
    color: "#94a3b8",
    fontWeight: 800,
  },
  empty: {
    border: "1px dashed #d1d5db",
    borderRadius: "16px",
    padding: "24px",
    textAlign: "center",
    color: "#94a3b8",
    fontWeight: 800,
    background: "#ffffff",
  },
  error: {
    background: "#fff1f2",
    color: "#dc2626",
    border: "1px solid #fecdd3",
    borderRadius: "14px",
    padding: "14px 16px",
    marginBottom: "18px",
    fontWeight: 800,
  },
  specialGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "18px",
  },
  rejectedProjectTile: {
    textAlign: "left",
    border: "1px solid #fecaca",
    background: "#fff7f7",
    borderRadius: "20px",
    padding: "20px",
    cursor: "pointer",
  },
  holdTile: {
    textAlign: "left",
    border: "1px solid #fde68a",
    background: "#fffbeb",
    borderRadius: "20px",
    padding: "20px",
    cursor: "pointer",
  },
  rejectedPill: {
    background: "#fee2e2",
    color: "#991b1b",
    borderRadius: "999px",
    padding: "7px 11px",
    fontSize: "12px",
    fontWeight: 900,
  },
  holdPill: {
    background: "#fef3c7",
    color: "#92400e",
    borderRadius: "999px",
    padding: "7px 11px",
    fontSize: "12px",
    fontWeight: 900,
  },
  emptySpecial: {
    border: "1px dashed #d1d5db",
    borderRadius: "18px",
    padding: "28px",
    background: "#ffffff",
    textAlign: "center",
    color: "#94a3b8",
    fontWeight: 900,
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(17, 24, 39, 0.55)",
    zIndex: 9999,
    display: "grid",
    placeItems: "center",
    padding: "24px",
  },
  modal: {
    width: "min(900px, 96vw)",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: "26px",
    padding: "28px",
    boxShadow: "0 24px 70px rgba(0,0,0,0.25)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "18px",
    alignItems: "flex-start",
    marginBottom: "22px",
  },
  modalTitle: {
    margin: 0,
    color: "#111827",
    fontSize: "30px",
    fontWeight: 900,
  },
  modalDescription: {
    margin: "8px 0 0",
    color: "#667085",
    fontSize: "15px",
    lineHeight: 1.5,
  },
  closeBtn: {
    border: "0",
    background: "#111827",
    color: "#ffffff",
    borderRadius: "12px",
    width: "42px",
    height: "42px",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    flexShrink: 0,
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "12px",
    marginBottom: "20px",
  },
  detailBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "14px",
  },
  progressBlock: {
    background: "#fff7f4",
    border: "1px solid #ffd4c8",
    borderRadius: "18px",
    padding: "16px",
    marginBottom: "18px",
  },
  progressTop: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "10px",
    color: "#111827",
    fontWeight: 900,
  },
  progressTrack: {
    width: "100%",
    height: "10px",
    borderRadius: "999px",
    background: "#ffd6cc",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: "999px",
    background: "#ff5733",
  },
  progressNote: {
    margin: "8px 0 0",
    color: "#667085",
    fontSize: "13px",
    fontWeight: 800,
  },
  lockNotice: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    color: "#374151",
    borderRadius: "16px",
    padding: "14px",
    fontWeight: 900,
    marginBottom: "18px",
  },
  subtaskForm: {
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    borderRadius: "18px",
    padding: "16px",
    marginBottom: "18px",
  },
  formTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "14px",
    color: "#ff5733",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr 1fr auto",
    gap: "12px",
    alignItems: "end",
  },
  field: {
    display: "grid",
    gap: "7px",
  },
  fieldFull: {
    gridColumn: "1 / -1",
    display: "grid",
    gap: "7px",
  },
  textarea: {
    width: "100%",
    minHeight: "85px",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "14px",
    outline: "0",
    resize: "vertical",
    fontFamily: "inherit",
  },
  addBtn: {
    border: "0",
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "13px",
    height: "46px",
    padding: "0 18px",
    fontWeight: 900,
    cursor: "pointer",
  },
  modalSuccess: {
    background: "#f0fdf4",
    color: "#15803d",
    border: "1px solid #bbf7d0",
    borderRadius: "14px",
    padding: "12px 14px",
    marginBottom: "14px",
    fontWeight: 800,
  },
  modalError: {
    background: "#fff1f2",
    color: "#dc2626",
    border: "1px solid #fecdd3",
    borderRadius: "14px",
    padding: "12px 14px",
    marginBottom: "14px",
    fontWeight: 800,
  },
  subtaskSection: {
    marginTop: "8px",
  },
  sectionTitle: {
    margin: "0 0 14px",
    color: "#111827",
    fontSize: "22px",
    fontWeight: 900,
  },
  subtaskList: {
    display: "grid",
    gap: "10px",
  },
  subtaskRow: {
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "14px",
    display: "grid",
    gridTemplateColumns: "24px 1fr auto",
    gap: "12px",
    alignItems: "center",
  },
  subtaskDescription: {
    margin: "5px 0 0",
    color: "#667085",
    fontSize: "13px",
    lineHeight: 1.45,
  },
  doneBadge: {
    background: "#dcfce7",
    color: "#166534",
    borderRadius: "999px",
    padding: "7px 11px",
    fontSize: "12px",
    fontWeight: 900,
  },
  todoBadge: {
    background: "#eef2ff",
    color: "#374151",
    borderRadius: "999px",
    padding: "7px 11px",
    fontSize: "12px",
    fontWeight: 900,
  },
};

export default EmployeeProjects;
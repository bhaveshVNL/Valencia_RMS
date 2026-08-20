import React, { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Search, X } from "lucide-react";
import api from "../../api/axios";

const API_BASE = "/employee-projects";

const normalizeStatus = (status) => {
  const value = String(status || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (["", "todo", "to_do", "pending", "not_started"].includes(value)) {
    return "todo";
  }

  if (["in_progress", "ongoing", "progress"].includes(value)) {
    return "in_progress";
  }

  if (["under_review", "review", "pending_review"].includes(value)) {
    return "under_review";
  }

  if (["done", "completed", "complete"].includes(value)) {
    return "done";
  }

  if (["rejected", "reject"].includes(value)) {
    return "rejected";
  }

  if (["on_hold", "hold"].includes(value)) {
    return "on_hold";
  }

  if (["blocked", "block"].includes(value)) {
    return "blocked";
  }

  return "todo";
};

const getStatusLabel = (status) => {
  const value = normalizeStatus(status);

  if (value === "todo") return "To Do";
  if (value === "in_progress") return "In Progress";
  if (value === "under_review") return "Under Review";
  if (value === "done") return "Completed";
  if (value === "rejected") return "Rejected";
  if (value === "on_hold") return "On Hold";
  if (value === "blocked") return "Blocked";

  return "To Do";
};

const statusColumns = [
  {
    key: "todo",
    title: "To Do",
    subtitle: "Project has not started yet",
  },
  {
    key: "in_progress",
    title: "In Progress",
    subtitle: "Project work has started",
  },
  {
    key: "blocked",
    title: "Blocked",
    subtitle: "Project is currently blocked",
  },
  {
    key: "under_review",
    title: "Under Review",
    subtitle: "Waiting for admin review",
  },
  {
    key: "done",
    title: "Completed",
    subtitle: "Completed projects",
  },
];

const formatDate = (value) => {
  if (!value) return "";

  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const parsed = new Date(text);

  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (value) => {
  const date = formatDate(value);

  if (!date) return "-";

  const [year, month, day] = date.split("-");

  return `${day}-${month}-${year}`;
};

const compareDateOnly = (left, right) => {
  const a = formatDate(left);
  const b = formatDate(right);

  if (!a || !b) return 0;
  if (a < b) return -1;
  if (a > b) return 1;

  return 0;
};

const getProjectTitle = (project) => {
  return project?.project_title || project?.title || "Untitled Project";
};

const getProjectDescription = (project) => {
  return project?.project_description || project?.description || "";
};

const getProjectStartDate = (project) => {
  return formatDate(project?.start_date || project?.project_start_date);
};

const getProjectEndDate = (project) => {
  return formatDate(
    project?.due_date ||
    project?.end_date ||
    project?.project_end_date ||
    project?.deadline
  );
};

const getAssignedNames = (project) => {
  if (project?.assigned_names) return project.assigned_names;

  if (Array.isArray(project?.assignees)) {
    const names = project.assignees
      .map((employee) => employee?.full_name)
      .filter(Boolean)
      .join(", ");

    if (names) return names;
  }

  return "-";
};

const getAssignedEmails = (project) => {
  if (project?.assigned_emails) return project.assigned_emails;

  if (Array.isArray(project?.assignees)) {
    const emails = project.assignees
      .map((employee) => employee?.email)
      .filter(Boolean)
      .join(", ");

    if (emails) return emails;
  }

  return "-";
};

const getMainTasks = (project) => {
  const tasks =
    project?.main_tasks ||
    project?.mainTasks ||
    project?.tasks ||
    [];

  return Array.isArray(tasks) ? tasks : [];
};

const getMainTaskId = (task) => {
  return Number(task?.task_id || task?.main_task_id || task?.id || 0);
};

const getMainTaskTitle = (task) => {
  return task?.task_title || task?.main_task || task?.title || "Main Task";
};

const getMainTaskDescription = (task) => {
  return task?.task_description || task?.description || "";
};

const getMainTaskStartDate = (task) => {
  return formatDate(task?.start_date || task?.task_start_date);
};

const getMainTaskEndDate = (task) => {
  return formatDate(task?.due_date || task?.end_date || task?.task_end_date);
};

const getMainTaskAssignees = (task) => {
  if (task?.assigned_names) return task.assigned_names;

  if (Array.isArray(task?.assignees)) {
    const names = task.assignees
      .map((employee) => employee?.full_name)
      .filter(Boolean)
      .join(", ");

    if (names) return names;
  }

  return "-";
};

const getMainTaskSubtasks = (task) => {
  const subtasks =
    task?.subtasks ||
    task?.children ||
    task?.sub_tasks ||
    [];

  return Array.isArray(subtasks) ? subtasks : [];
};

const getSubtaskId = (subtask) => {
  return Number(subtask?.task_id || subtask?.subtask_id || subtask?.id || 0);
};

const getSubtaskTitle = (subtask) => {
  return subtask?.task_title || subtask?.title || "Untitled Subtask";
};

const getSubtaskDescription = (subtask) => {
  return subtask?.task_description || subtask?.description || "";
};

const getSubtaskStartDate = (subtask) => {
  return formatDate(subtask?.start_date || subtask?.task_start_date);
};

const getSubtaskEndDate = (subtask) => {
  return formatDate(
    subtask?.due_date ||
    subtask?.end_date ||
    subtask?.task_end_date
  );
};

const isSubtaskDone = (subtask) => {
  return (
    Number(subtask?.is_checked || 0) === 1 ||
    normalizeStatus(subtask?.status) === "done"
  );
};
const getSubtaskDisplayStatus = (subtask, mainTask) => {
  if (isSubtaskDone(subtask)) {
    return "Done";
  }

  const mainStatus = normalizeStatus(
    mainTask?.status || mainTask?.task_status
  );

  if (mainStatus === "in_progress") {
    return "In Progress";
  }

  return getStatusLabel(subtask?.status);
};
const isProjectLocked = (project) => {
  return ["done", "rejected", "on_hold"].includes(
    normalizeStatus(
      project?.status_group ||
      project?.status ||
      project?.project_status
    )
  );
};

const isMainTaskLocked = (task) => {
  return ["under_review", "done", "rejected", "on_hold"].includes(
    normalizeStatus(task?.status || task?.task_status)
  );
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

const EmployeeProjects = () => {
  const [activeTab, setActiveTab] = useState("my");

  const [myProjects, setMyProjects] = useState([]);
  const [rejectedProjects, setRejectedProjects] = useState([]);
  const [onHoldProjects, setOnHoldProjects] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");

  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedMainTaskId, setSelectedMainTaskId] = useState(0);

  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [subtaskDescription, setSubtaskDescription] = useState("");
  const [subtaskStartDate, setSubtaskStartDate] = useState("");
  const [subtaskEndDate, setSubtaskEndDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [togglingSubtaskId, setTogglingSubtaskId] = useState(null);
  const [confirmSubtask, setConfirmSubtask] = useState(null);

  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");

  const selectedMainTask = useMemo(() => {
    const tasks = getMainTasks(selectedProject);

    if (!tasks.length) return null;

    return (
      tasks.find(
        (task) => getMainTaskId(task) === Number(selectedMainTaskId)
      ) || tasks[0]
    );
  }, [selectedProject, selectedMainTaskId]);

  const selectedSubtasks = useMemo(() => {
    return getMainTaskSubtasks(selectedMainTask);
  }, [selectedMainTask]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(`${API_BASE}/projects`);

      const normalized = normalizeProjectsResponse(response.data || {});
      const receivedProjects = normalized.myProjects || [];

      const receivedRejected =
        normalized.rejectedProjects.length > 0
          ? normalized.rejectedProjects
          : receivedProjects.filter(
            (project) =>
              normalizeStatus(
                project.status_group ||
                project.status ||
                project.project_status
              ) === "rejected"
          );

      const receivedOnHold =
        normalized.onHoldProjects.length > 0
          ? normalized.onHoldProjects
          : receivedProjects.filter(
            (project) =>
              normalizeStatus(
                project.status_group ||
                project.status ||
                project.project_status
              ) === "on_hold"
          );

      const activeProjects = receivedProjects.filter((project) => {
        const status = normalizeStatus(
          project.status_group ||
          project.status ||
          project.project_status
        );

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
      const mainTaskText = getMainTasks(project)
        .map(
          (task) =>
            `${getMainTaskTitle(task)} ${getMainTaskDescription(task)}`
        )
        .join(" ");

      return [
        getProjectTitle(project),
        getProjectDescription(project),
        mainTaskText,
        getStatusLabel(
          project.status_group ||
          project.status ||
          project.project_status
        ),
        project.department_name,
        project.created_by_name,
        getAssignedNames(project),
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [visibleProjects, searchTerm]);

  const grouped = useMemo(() => {
    const result = {
      todo: [],
      in_progress: [],
      blocked: [],
      under_review: [],
      done: [],
    };

    filteredProjects.forEach((project) => {
      const status = normalizeStatus(
        project.status_group ||
        project.status ||
        project.project_status
      );

      if (!result[status]) {
        result.todo.push(project);
        return;
      }

      result[status].push(project);
    });

    return result;
  }, [filteredProjects]);

  const applyProjectDetailResponse = (
    originalProject,
    responseData,
    preferredTaskId = 0
  ) => {
    const responseProject = responseData?.project || {};

    const responseMainTasks =
      responseData?.main_tasks ||
      responseProject?.main_tasks ||
      responseProject?.mainTasks ||
      [];

    const mergedProject = {
      ...originalProject,
      ...responseProject,
      main_tasks: Array.isArray(responseMainTasks)
        ? responseMainTasks
        : [],
    };

    setSelectedProject(mergedProject);

    const tasks = getMainTasks(mergedProject);

    if (!tasks.length) {
      setSelectedMainTaskId(0);
      return;
    }

    const wantedId = Number(preferredTaskId || selectedMainTaskId || 0);

    const matchingTask = tasks.find(
      (task) => getMainTaskId(task) === wantedId
    );

    setSelectedMainTaskId(
      matchingTask
        ? getMainTaskId(matchingTask)
        : getMainTaskId(tasks[0])
    );
  };

  const refreshSelectedProject = async (
    projectId,
    preferredTaskId = 0,
    originalProject = selectedProject
  ) => {
    const response = await api.get(
      `${API_BASE}/projects/${projectId}/subtasks`
    );

    applyProjectDetailResponse(
      originalProject || {},
      response.data || {},
      preferredTaskId
    );

    return response;
  };

  const openProjectModal = async (project) => {
    try {
      setSelectedProject(project);

      setSelectedMainTaskId(
        getMainTaskId(getMainTasks(project)[0]) || 0
      );

      setSubtaskTitle("");
      setSubtaskDescription("");
      setSubtaskStartDate("");
      setSubtaskEndDate("");

      setModalError("");
      setModalSuccess("");
      setModalLoading(true);

      await refreshSelectedProject(
        project.project_id,
        getMainTaskId(getMainTasks(project)[0]) || 0,
        project
      );
    } catch (err) {
      console.error("Fetch employee project details error:", err);

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
    setSelectedMainTaskId(0);

    setSubtaskTitle("");
    setSubtaskDescription("");
    setSubtaskStartDate("");
    setSubtaskEndDate("");

    setModalError("");
    setModalSuccess("");

    setConfirmSubtask(null);
    setTogglingSubtaskId(null);
  };

  const selectMainTask = (task) => {
    setSelectedMainTaskId(getMainTaskId(task));

    setSubtaskTitle("");
    setSubtaskDescription("");
    setSubtaskStartDate("");
    setSubtaskEndDate("");

    setModalError("");
    setModalSuccess("");
  };

  const handleAddSubtask = async (event) => {
    event?.preventDefault?.();

    if (!selectedProject || !selectedMainTask || addingSubtask) return;

    setModalError("");
    setModalSuccess("");

    if (isProjectLocked(selectedProject)) {
      setModalError("This Project is locked.");
      return;
    }

    if (isMainTaskLocked(selectedMainTask)) {
      setModalError(
        `Subtasks cannot be added while this Main Task is ${getStatusLabel(
          selectedMainTask.status
        )}.`
      );
      return;
    }

    if (!subtaskTitle.trim()) {
      setModalError("Please enter Subtask title.");
      return;
    }

    if (!subtaskStartDate || !subtaskEndDate) {
      setModalError("Please select Subtask start date and deadline.");
      return;
    }

    if (compareDateOnly(subtaskEndDate, subtaskStartDate) < 0) {
      setModalError(
        "Subtask deadline cannot be before Subtask start date."
      );
      return;
    }

    const mainStartDate = getMainTaskStartDate(selectedMainTask);
    const mainEndDate = getMainTaskEndDate(selectedMainTask);

    if (
      mainStartDate &&
      compareDateOnly(subtaskStartDate, mainStartDate) < 0
    ) {
      setModalError(
        `Subtask start date cannot be before Main Task start date ${formatDisplayDate(
          mainStartDate
        )}.`
      );
      return;
    }

    if (
      mainEndDate &&
      compareDateOnly(subtaskEndDate, mainEndDate) > 0
    ) {
      setModalError(
        `Subtask deadline cannot exceed Main Task deadline ${formatDisplayDate(
          mainEndDate
        )}.`
      );
      return;
    }

    try {
      setAddingSubtask(true);

      const taskId = getMainTaskId(selectedMainTask);

      const response = await api.post(
        `${API_BASE}/projects/${selectedProject.project_id}/subtasks`,
        {
          main_task_id: taskId,
          task_title: subtaskTitle.trim(),
          title: subtaskTitle.trim(),
          task_description: subtaskDescription.trim(),
          description: subtaskDescription.trim(),
          start_date: subtaskStartDate,
          due_date: subtaskEndDate,
          end_date: subtaskEndDate,
        }
      );

      setSubtaskTitle("");
      setSubtaskDescription("");
      setSubtaskStartDate("");
      setSubtaskEndDate("");

      await refreshSelectedProject(
        selectedProject.project_id,
        taskId,
        selectedProject
      );

      await fetchProjects();

      setModalSuccess(
        response.data?.message || "Subtask added successfully."
      );
    } catch (err) {
      console.error("Add employee Subtask error:", err);

      setModalError(
        err?.response?.data?.sqlMessage ||
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Failed to add Subtask."
      );
    } finally {
      setAddingSubtask(false);
    }
  };

  const handleToggleSubtask = (subtask) => {
    if (!selectedProject || !selectedMainTask) return;

    if (
      isProjectLocked(selectedProject) ||
      isMainTaskLocked(selectedMainTask)
    ) {
      setModalError(
        "This Main Task is locked. Subtasks cannot be changed now."
      );
      return;
    }

    if (isSubtaskDone(subtask) || togglingSubtaskId) return;

    setModalError("");
    setModalSuccess("");
    setConfirmSubtask(subtask);
  };

  const confirmMarkSubtaskDone = async () => {
    if (
      !selectedProject ||
      !selectedMainTask ||
      !confirmSubtask
    ) {
      return;
    }

    const subtaskId = getSubtaskId(confirmSubtask);
    const taskId = getMainTaskId(selectedMainTask);

    if (!subtaskId) {
      setConfirmSubtask(null);
      return;
    }

    try {
      setTogglingSubtaskId(subtaskId);
      setModalError("");
      setModalSuccess("");


      const response = await api.patch(
        `/employee-tasks/subtasks/${subtaskId}/check`,
        {
          checked: true,
          is_checked: true,
          status: "completed",
        }
      );

      await refreshSelectedProject(
        selectedProject.project_id,
        taskId,
        selectedProject
      );

      await fetchProjects();

      setModalSuccess(
        response.data?.message || "Subtask marked as Done."
      );
    } catch (err) {
      console.error("Complete employee Subtask error:", err);

      setModalError(
        err?.response?.data?.sqlMessage ||
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Failed to complete Subtask."
      );
    } finally {
      setTogglingSubtaskId(null);
      setConfirmSubtask(null);
    }
  };

  const renderProjectTile = (project) => {
    const mainTasks = getMainTasks(project);

    return (
      <button
        type="button"
        style={styles.projectTile}
        key={project.project_id}
        onClick={() => openProjectModal(project)}
      >
        <div style={styles.projectTileTop}>
          <h3 style={styles.projectTileTitle}>
            {getProjectTitle(project)}
          </h3>

          <span style={styles.statusPill}>
            {getStatusLabel(
              selectedMainTask?.status ||
              selectedProject?.status_group ||
              selectedProject?.status ||
              selectedProject?.project_status
            )}
          </span>
        </div>

        <p style={styles.projectTileMeta}>
          {mainTasks.length} Main{" "}
          {mainTasks.length === 1 ? "Task" : "Tasks"}
        </p>

        <p style={styles.projectDate}>
          {formatDisplayDate(getProjectStartDate(project))} →{" "}
          {formatDisplayDate(getProjectEndDate(project))}
        </p>

        <span style={styles.clickHint}>
          Click to view Project and Main Tasks
        </span>
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
              type === "rejected"
                ? styles.rejectedProjectTile
                : styles.holdTile
            }
            onClick={() => openProjectModal(project)}
          >
            <div style={styles.projectTileTop}>
              <h3 style={styles.projectTileTitle}>
                {getProjectTitle(project)}
              </h3>

              <span
                style={
                  type === "rejected"
                    ? styles.rejectedPill
                    : styles.holdPill
                }
              >
                {type === "rejected" ? "Rejected" : "On Hold"}
              </span>
            </div>

            <span style={styles.clickHint}>
              Click to view details
            </span>
          </button>
        ))}
      </div>
    );
  };

  const projectProgress = selectedProject
    ? Number(
      selectedProject.overall_progress ??
      selectedProject.progress ??
      0
    )
    : 0;

  const canAddSubtask =
    selectedProject &&
    selectedMainTask &&
    !isProjectLocked(selectedProject) &&
    !isMainTaskLocked(selectedMainTask);

  return (
    <div style={styles.page}>
      <div style={styles.toolbar}>
        <div style={styles.searchContainer}>
          <Search size={19} style={styles.searchIcon} />

          <input
            style={styles.search}
            type="text"
            placeholder="Search project, task, admin..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <button
          type="button"
          style={
            activeTab === "my"
              ? styles.activeTab
              : styles.tab
          }
          onClick={() => setActiveTab("my")}
        >
          My Projects {myProjects.length}
        </button>

        <button
          type="button"
          style={
            activeTab === "rejected"
              ? styles.activeRejectedTab
              : styles.tab
          }
          onClick={() => setActiveTab("rejected")}
        >
          Rejected {rejectedProjects.length}
        </button>

        <button
          type="button"
          style={
            activeTab === "on_hold"
              ? styles.activeHoldTab
              : styles.tab
          }
          onClick={() => setActiveTab("on_hold")}
        >
          On Hold {onHoldProjects.length}
        </button>

        <button
          type="button"
          style={styles.refreshBtn}
          onClick={fetchProjects}
          disabled={loading}
        >
          <RefreshCw size={18} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      {activeTab === "my" ? (
        <section style={styles.stageRow}>
          {statusColumns.map((column) => (
            <div
              style={styles.stageColumn}
              key={column.key}
            >
              <div style={styles.stageHeader}>
                <div>
                  <h2 style={styles.stageTitle}>
                    {column.title}
                  </h2>

                  <p style={styles.stageSubtitle}>
                    {column.subtitle}
                  </p>
                </div>

                <span style={styles.stageCount}>
                  {grouped[column.key]?.length || 0}
                </span>
              </div>

              <div style={styles.stageBody}>
                {grouped[column.key]?.length === 0 ? (
                  <div style={styles.emptyColumn}>
                    No projects here.
                  </div>
                ) : (
                  grouped[column.key].map(renderProjectTile)
                )}
              </div>
            </div>
          ))}
        </section>
      ) : activeTab === "rejected" ? (
        renderSpecialProjectList(
          filteredProjects,
          "rejected"
        )
      ) : (
        renderSpecialProjectList(
          filteredProjects,
          "on_hold"
        )
      )}

      {selectedProject && (
        <div
          style={styles.modalBackdrop}
          onClick={closeProjectModal}
        >
          <div
            style={styles.modal}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={styles.modalBody}>
              <div style={styles.modalHeader}>
                <div style={{ minWidth: 0 }}>
                  <h2 style={styles.modalTitle}>
                    {getProjectTitle(selectedProject)}
                  </h2>

                  <p style={styles.modalDescription}>
                    {getProjectDescription(selectedProject) ||
                      "No Project description provided."}
                  </p>
                </div>

                <button
                  type="button"
                  style={styles.closeBtn}
                  onClick={closeProjectModal}
                >
                  <X size={18} />
                </button>
              </div>


              <div style={styles.detailGrid}>
                <div style={styles.detailBox}>
                  <span style={styles.detailBoxLabel}>
                    Department
                  </span>
                  <p style={styles.detailBoxValue}>
                    {selectedProject.department_name || "-"}
                  </p>
                </div>

                <div style={styles.detailBox}>
                  <span style={styles.detailBoxLabel}>
                    Created By
                  </span>
                  <p style={styles.detailBoxValue}>
                    {selectedProject.created_by_name || "-"}
                    <br />
                    {selectedProject.created_by_email || "-"}
                  </p>
                </div>

                <div style={styles.detailBox}>
                  <span style={styles.detailBoxLabel}>
                    Project Assigned To
                  </span>
                  <p style={styles.detailBoxValue}>
                    {getAssignedNames(selectedProject)}
                    <br />
                    {getAssignedEmails(selectedProject)}
                  </p>
                </div>

                <div style={styles.detailBox}>
                  <span style={styles.detailBoxLabel}>
                    Project Status
                  </span>
                  <p style={styles.detailBoxValue}>
                    {getStatusLabel(
                      selectedProject.status_group ||
                      selectedProject.status ||
                      selectedProject.project_status
                    )}
                  </p>
                </div>
                {normalizeStatus(
  selectedProject.status_group ||
  selectedProject.status ||
  selectedProject.project_status
) === "rejected" && (
  <div style={styles.detailBox}>
    <span style={styles.detailBoxLabel}>
      Admin Remark
    </span>

    <p style={styles.detailBoxValue}>
      {
        selectedProject.rejection_remark ||
        selectedProject.reject_remark ||
        selectedProject.admin_remark ||
        selectedProject.rejection_reason ||
        "-"
      }
    </p>
  </div>
)}

                <div style={styles.detailBox}>
                  <span style={styles.detailBoxLabel}>
                    Project Start
                  </span>
                  <p style={styles.detailBoxValue}>
                    {formatDisplayDate(
                      getProjectStartDate(selectedProject)
                    )}
                  </p>
                </div>

                <div style={styles.detailBox}>
                  <span style={styles.detailBoxLabel}>
                    Project Deadline
                  </span>
                  <p style={styles.detailBoxValue}>
                    {formatDisplayDate(
                      getProjectEndDate(selectedProject)
                    )}
                  </p>
                </div>
              </div>

              <div style={styles.progressBlock}>
                <div style={styles.progressTop}>
                  <strong>Project Progress</strong>
                  <span>{projectProgress}%</span>
                </div>

                <div style={styles.progressTrack}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${Math.min(
                        100,
                        Math.max(0, projectProgress)
                      )}%`,
                    }}
                  />
                </div>

                <p style={styles.progressNote}>
                  {selectedProject.completed_subtasks || 0}/
                  {selectedProject.total_subtasks || 0} Subtasks completed
                </p>
              </div>

              <section style={styles.mainTaskSection}>
                <div style={styles.sectionHeadingRow}>
                  <div>
                    <h3 style={styles.sectionTitle}>
                      Assigned Main Tasks
                    </h3>

                    <p style={styles.sectionSubtitle}>
                      Select a Main Task to view its shared Subtasks.
                    </p>
                  </div>

                  <span style={styles.mainTaskCount}>
                    {getMainTasks(selectedProject).length}
                  </span>
                </div>

                {modalLoading ? (
                  <div style={styles.empty}>
                    Loading Main Tasks...
                  </div>
                ) : getMainTasks(selectedProject).length === 0 ? (
                  <div style={styles.empty}>
                    No Main Task has been assigned to you for this Project.
                  </div>
                ) : (
                  <div style={styles.mainTaskTabs}>
                    {getMainTasks(selectedProject).map((task) => {
                      const taskId = getMainTaskId(task);
                      const active =
                        taskId === getMainTaskId(selectedMainTask);

                      return (
                        <button
                          key={taskId}
                          type="button"
                          style={
                            active
                              ? styles.activeMainTaskTab
                              : styles.mainTaskTab
                          }
                          onClick={() => selectMainTask(task)}
                        >
                          <span style={styles.mainTaskTabTitle}>
                            {getMainTaskTitle(task)}
                          </span>

                          <span style={styles.mainTaskTabStatus}>
                            {getStatusLabel(task.status)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {selectedMainTask && (
                <>
                  <section style={styles.mainTaskDetailCard}>
                    <div style={styles.mainTaskHeader}>
                      <div style={{ minWidth: 0 }}>
                        <span style={styles.eyebrow}>
                          MAIN TASK
                        </span>

                        <h3 style={styles.mainTaskTitle}>
                          {getMainTaskTitle(selectedMainTask)}
                        </h3>
                      </div>

                      <span style={styles.statusPill}>
                        {getStatusLabel(selectedMainTask.status)}
                      </span>
                    </div>

                    <div style={styles.mainTaskInfoGrid}>
                      <div style={styles.detailBox}>
                        <span style={styles.detailBoxLabel}>
                          Main Task Description
                        </span>
                        <p style={styles.detailBoxValue}>
                          {getMainTaskDescription(selectedMainTask) || "-"}
                        </p>
                      </div>

                      <div style={styles.detailBox}>
                        <span style={styles.detailBoxLabel}>
                          Main Task Assigned To
                        </span>
                        <p style={styles.detailBoxValue}>
                          {getMainTaskAssignees(selectedMainTask)}
                        </p>
                      </div>

                      <div style={styles.detailBox}>
                        <span style={styles.detailBoxLabel}>
                          Start Date
                        </span>
                        <p style={styles.detailBoxValue}>
                          {formatDisplayDate(
                            getMainTaskStartDate(selectedMainTask)
                          )}
                        </p>
                      </div>

                      <div style={styles.detailBox}>
                        <span style={styles.detailBoxLabel}>
                          Deadline
                        </span>
                        <p style={styles.detailBoxValue}>
                          {formatDisplayDate(
                            getMainTaskEndDate(selectedMainTask)
                          )}
                        </p>
                      </div>
                    </div>

                    <div style={styles.taskProgressRow}>
                      <strong>
                        {selectedMainTask.completed_subtasks || 0}/
                        {selectedMainTask.total_subtasks || 0} Subtasks
                      </strong>

                      <strong>
                        {Number(selectedMainTask.progress || 0)}%
                      </strong>
                    </div>

                    <div style={styles.progressTrack}>
                      <div
                        style={{
                          ...styles.progressFill,
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              Number(selectedMainTask.progress || 0)
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </section>

                  {!canAddSubtask && (
                    <div style={styles.modalWarning}>
                      Subtasks cannot be added while this Main Task is{" "}
                      <strong>
                        {getStatusLabel(selectedMainTask.status)}
                      </strong>
                      .
                    </div>
                  )}

                  {canAddSubtask && (
                    <form
                      style={styles.subtaskForm}
                      onSubmit={handleAddSubtask}
                    >
                      <div style={styles.formTitleRow}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Plus size={18} />
                          <h3 style={{ margin: 0 }}>
                            Add Subtask
                          </h3>
                        </div>

                        <button
                          type="submit"
                          style={styles.addBtn}
                          disabled={addingSubtask}
                        >
                          {addingSubtask ? "Adding..." : "Add"}
                        </button>
                      </div>

                      <p style={styles.formHint}>
                        Subtask dates must stay within this Main Task:{" "}
                        <strong>
                          {formatDisplayDate(
                            getMainTaskStartDate(selectedMainTask)
                          )}
                        </strong>{" "}
                        to{" "}
                        <strong>
                          {formatDisplayDate(
                            getMainTaskEndDate(selectedMainTask)
                          )}
                        </strong>
                        .
                      </p>

                      <div style={styles.formGrid}>
                        <label style={styles.field}>
                          <span>Subtask Title</span>
                          <input
                            style={styles.input}
                            type="text"
                            value={subtaskTitle}
                            onChange={(event) =>
                              setSubtaskTitle(event.target.value)
                            }
                            placeholder="Example: Backend API"
                          />
                        </label>

                        <label style={styles.field}>
                          <span>Start Date</span>
                          <input
                            style={styles.input}
                            type="date"
                            value={subtaskStartDate}
                            min={
                              getMainTaskStartDate(selectedMainTask) ||
                              undefined
                            }
                            max={
                              getMainTaskEndDate(selectedMainTask) ||
                              undefined
                            }
                            onChange={(event) => {
                              const value = event.target.value;

                              setSubtaskStartDate(value);

                              if (
                                subtaskEndDate &&
                                value &&
                                subtaskEndDate < value
                              ) {
                                setSubtaskEndDate("");
                              }
                            }}
                          />
                        </label>

                        <label style={styles.field}>
                          <span>End Date / Deadline</span>
                          <input
                            style={styles.input}
                            type="date"
                            value={subtaskEndDate}
                            min={
                              subtaskStartDate ||
                              getMainTaskStartDate(selectedMainTask) ||
                              undefined
                            }
                            max={
                              getMainTaskEndDate(selectedMainTask) ||
                              undefined
                            }
                            onChange={(event) =>
                              setSubtaskEndDate(event.target.value)
                            }
                          />
                        </label>




                        <label style={styles.fieldFull}>
                          <span>Subtask Description</span>
                          <textarea
                            value={subtaskDescription}
                            onChange={(event) =>
                              setSubtaskDescription(event.target.value)
                            }
                            placeholder="Write what this Subtask includes..."
                            style={styles.textarea}
                          />
                        </label>
                      </div>
                    </form>
                  )}

                  {modalError && (
                    <div style={styles.modalError}>
                      {modalError}
                    </div>
                  )}

                  {modalSuccess && (
                    <div style={styles.modalSuccess}>
                      {modalSuccess}
                    </div>
                  )}

                  <section style={styles.subtaskSection}>
                    <h3 style={styles.sectionTitle}>
                      Shared Subtasks
                    </h3>

                    {selectedSubtasks.length === 0 ? (
                      <div style={styles.empty}>
                        No Subtasks added under this Main Task yet.
                      </div>
                    ) : (
                      <div style={styles.subtaskList}>
                        {selectedSubtasks.map((subtask) => {
                          const subtaskId = getSubtaskId(subtask);
                          const done = isSubtaskDone(subtask);

                          return (
                            <div
                              style={styles.subtaskRow}
                              key={subtaskId}
                            >
                              <input
                                type="checkbox"
                                checked={done}
                                disabled={
                                  done ||
                                  isProjectLocked(selectedProject) ||
                                  isMainTaskLocked(selectedMainTask) ||
                                  togglingSubtaskId === subtaskId
                                }
                                onChange={() =>
                                  handleToggleSubtask(subtask)
                                }
                              />

                              <div style={{ minWidth: 0 }}>
                                <strong>
                                  {getSubtaskTitle(subtask)}
                                </strong>

                                <p style={styles.subtaskDates}>
                                  {formatDisplayDate(
                                    getSubtaskStartDate(subtask)
                                  )}{" "}
                                  to{" "}
                                  {formatDisplayDate(
                                    getSubtaskEndDate(subtask)
                                  )}
                                </p>

                                {getSubtaskDescription(subtask) && (
                                  <p style={styles.subtaskDescription}>
                                    {getSubtaskDescription(subtask)}
                                  </p>
                                )}

                                {subtask.created_by_name && (
                                  <p style={styles.subtaskCreator}>
                                    Added by {subtask.created_by_name}
                                  </p>
                                )}
                              </div>

                              <span
                                style={{
                                  fontWeight: 900,
                                  fontSize: "14px",
                                  textAlign: "center",
                                  minWidth: "90px",
                                }}
                              >
                                {getSubtaskDisplayStatus(
                                  subtask,
                                  selectedMainTask
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </>
                           )}
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.cancelModalButton}
                onClick={closeProjectModal}
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}

      {confirmSubtask && (
        <div style={styles.confirmOverlay}>
          <div style={styles.confirmBox}>
            <h3 style={styles.confirmTitle}>
              Mark this Subtask as Done?
            </h3>

            <p style={styles.confirmText}>
              Completed Subtasks cannot be unchecked from this page.
            </p>

            <div style={styles.confirmActions}>
              <button
                type="button"
                style={styles.confirmCancelBtn}
                onClick={() => setConfirmSubtask(null)}
              >
                Cancel
              </button>

              <button
                type="button"
                style={styles.confirmYesBtn}
                onClick={confirmMarkSubtaskDone}
              >
                Yes, Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  page: {
    width: "100%",
    minWidth: 0,
    paddingBottom: "40px",
  },

  toolbar: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "18px",
    flexWrap: "nowrap",
  },

  searchContainer: {
    position: "relative",
    height: "56px",
    minWidth: 0,
  },

  searchIcon: {
    position: "absolute",
    left: "18px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#64748b",
    pointerEvents: "none",
  },

  search: {
    width: "100%",
    height: "56px",
    boxSizing: "border-box",
    border: "1px solid #d7dde7",
    borderRadius: "16px",
    padding: "0 18px 0 50px",
    outline: 0,
    fontSize: "15px",
    fontWeight: 600,
    color: "#111827",
    background: "#ffffff",
  },

  tab: {
    border: "1px solid #d7dde7",
    background: "#ffffff",
    color: "#111827",
    borderRadius: "16px",
    height: "56px",
    padding: "0 18px",
    fontSize: "14px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  activeTab: {
    border: "none",
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "16px",
    height: "56px",
    padding: "0 18px",
    fontSize: "14px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 8px 18px rgba(255, 87, 51, 0.16)",
  },

  activeRejectedTab: {
    border: "none",
    background: "#ef4444",
    color: "#ffffff",
    borderRadius: "16px",
    height: "56px",
    padding: "0 18px",
    fontSize: "14px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  activeHoldTab: {
    border: "none",
    background: "#111827",
    color: "#ffffff",
    borderRadius: "16px",
    height: "56px",
    padding: "0 18px",
    fontSize: "14px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  refreshBtn: {
    border: "none",
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "16px",
    height: "56px",
    padding: "0 22px",
    fontSize: "15px",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 8px 18px rgba(255, 87, 51, 0.16)",
  },

  stageRow: {
    width: "100%",
    display: "flex",
    flexWrap: "nowrap",
    gap: "20px",
    overflowX: "auto",
    overflowY: "hidden",
    paddingBottom: "16px",
    scrollBehavior: "smooth",
  },

  stageColumn: {
    flex: "0 0 calc((100% - 40px) / 3)",
  width: "calc((100% - 40px) / 3)",
    height: "620px",
    minHeight: "620px",
    maxHeight: "620px",
    boxSizing: "border-box",
    background: "#ffffff",
    borderRadius: "20px",
    padding: "18px",
    boxShadow: "0 6px 20px rgba(15, 23, 42, 0.06)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },

  stageHeader: {
    width: "100%",
    minHeight: "105px",
    boxSizing: "border-box",
    background: "#f7f9fc",
    borderRadius: "18px",
    padding: "17px",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    marginBottom: "16px",
    flexShrink: 0,
  },

  stageTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "22px",
    lineHeight: 1.15,
    fontWeight: 900,
  },

  stageSubtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.35,
  },

  stageCount: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    background: "#e9edf3",
    display: "grid",
    placeItems: "center",
    fontSize: "13px",
    fontWeight: 900,
    color: "#111827",
    flexShrink: 0,
  },

  stageBody: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    paddingRight: "5px",
  },

  projectTile: {
    width: "100%",
    boxSizing: "border-box",
    textAlign: "left",
    border: "1px solid #e3e8ef",
    background: "#ffffff",
    borderRadius: "16px",
    padding: "16px",
    cursor: "pointer",
    flexShrink: 0,
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
    fontSize: "18px",
    lineHeight: 1.2,
    fontWeight: 900,
  },

  projectTileMeta: {
    margin: "0 0 8px",
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 800,
  },

  projectDate: {
    margin: "0 0 12px",
    color: "#475569",
    fontSize: "12px",
    fontWeight: 800,
  },

  statusPill: {
    background: "#eef2ff",
    color: "#374151",
    borderRadius: "999px",
    padding: "7px 14px",
    fontSize: "12px",
    fontWeight: 900,
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    height: "36px",
  },

  clickHint: {
    color: "#ff5733",
    fontSize: "12px",
    fontWeight: 800,
  },

  emptyColumn: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px dashed #d5dbe5",
    borderRadius: "14px",
    padding: "16px 12px",
    textAlign: "center",
    color: "#94a3b8",
    fontSize: "12px",
    fontWeight: 800,
    background: "#ffffff",
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
    position: "relative",
    width: "min(1250px, 96vw)",
    height: "90vh",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    background: "#ffffff",
    borderRadius: "26px",
    padding: "0",
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.28)",
    overflow: "hidden",
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
    border: 0,
    background: "#111827",
    color: "#ffffff",
    borderRadius: "12px",
    width: "42px",
    height: "42px",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
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
    padding: "16px",
    minWidth: 0,
    overflow: "hidden",
  },

  detailBoxLabel: {
    fontWeight: 800,
    display: "block",
    marginBottom: "6px",
    color: "#475569",
    fontSize: "12px",
  },

  detailBoxValue: {
    color: "#111827",
    fontSize: "14px",
    fontWeight: 500,
    margin: 0,
    lineHeight: 1.5,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },

  progressBlock: {
    background: "#fff7f4",
    border: "1px solid #ffd4c8",
    borderRadius: "18px",
    padding: "16px",
    marginBottom: "22px",
  },

  progressTop: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "10px",
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

  mainTaskSection: {
    marginBottom: "20px",
  },

  sectionHeadingRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    marginBottom: "12px",
  },

  sectionTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 900,
  },

  sectionSubtitle: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: "13px",
  },

  mainTaskCount: {
    minWidth: "38px",
    height: "38px",
    padding: "0 10px",
    borderRadius: "999px",
    background: "#f1f5f9",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
  },

  mainTaskTabs: {
    display: "flex",
    gap: "10px",
    overflowX: "auto",
  },

  mainTaskTab: {
    flex: "0 0 220px",
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: "14px",
    padding: "13px",
    textAlign: "left",
  },

  activeMainTaskTab: {
    flex: "0 0 220px",
    border: "1px solid #ffb8a7",
    background: "#fff7f4",
    borderRadius: "14px",
    padding: "13px",
    textAlign: "left",
  },

  mainTaskTabTitle: {
    display: "block",
    fontWeight: 900,
    fontSize: "13px",
  },

  mainTaskTabStatus: {
    color: "#64748b",
    fontSize: "11px",
  },

  mainTaskDetailCard: {
    border: "1px solid #e5e7eb",
    borderRadius: "20px",
    padding: "18px",
    marginBottom: "18px",
  },

  mainTaskHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "16px",
  },

  eyebrow: {
    color: "#ff5733",
    fontSize: "11px",
    fontWeight: 900,
  },

  mainTaskTitle: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 900,
  },

  mainTaskInfoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "10px",
  },

  taskProgressRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "12px",
    marginBottom: "12px",
  },

  modalWarning: {
    background: "#fff7ed",
    color: "#c2410c",
    border: "1px solid #fed7aa",
    borderRadius: "14px",
    padding: "12px 14px",
    marginBottom: "18px",
  },

  subtaskForm: {
    background: "#f8fafc",
    borderRadius: "18px",
    padding: "16px",
    marginBottom: "18px",
  },

  formTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    color: "#ff5733",
    marginBottom: "12px",
  },

  formHint: {
    color: "#64748b",
    fontSize: "12px",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr 1fr",
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

  input: {
    height: "46px",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "0 12px",
  },

  textarea: {
    minHeight: "85px",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "12px",
  },

  addBtn: {
    border: 0,
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "13px",
    height: "46px",
    padding: "0 18px",
  },

  modalSuccess: {
    background: "#f0fdf4",
    color: "#15803d",
    padding: "12px",
  },

  modalError: {
    background: "#fff1f2",
    color: "#dc2626",
    padding: "12px",
  },
  modalBody: {
    flex: 1,
    overflowY: "auto",
    padding: "34px",
  },

  modalFooter: {
    height: "80px",
    flexShrink: 0,
    borderTop: "1px solid #e5e7eb",
    background: "#ffffff",
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    padding: "0 34px",
  },

  cancelModalButton: {
    height: "42px",
    padding: "0 24px",
    borderRadius: "12px",
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    fontWeight: 900,
    cursor: "pointer",
  },

  subtaskSection: {
    marginTop: "8px",
  },

  subtaskList: {
    display: "grid",
    gap: "10px",
    maxHeight: "340px",
    overflowY: "auto",
  },

  subtaskRow: {
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "14px",
    display: "grid",
    gridTemplateColumns: "24px 1fr 100px",
    gap: "12px",
    alignItems: "center",
  },

  subtaskDates: {
    color: "#475569",
    fontSize: "12px",
  },

  subtaskDescription: {
    color: "#667085",
    fontSize: "13px",
  },

  subtaskCreator: {
    color: "#94a3b8",
    fontSize: "11px",
  },

  doneBadge: {
    background: "#dcfce7",
    color: "#166534",
    borderRadius: "10px",
    padding: "4px 8px",
    fontSize: "12px",
    fontWeight: 900,
  },

  todoBadge: {
    background: "#eef2ff",
    color: "#374151",
    borderRadius: "10px",
    padding: "4px 8px",
    fontSize: "12px",
    fontWeight: 900,
  },

  confirmOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20000,
  },

  confirmBox: {
    width: "400px",
    background: "#ffffff",
    borderRadius: "22px",
    padding: "30px",
    textAlign: "center",
  },

  confirmTitle: {
    margin: "0 0 10px",
  },

  confirmText: {
    color: "#64748b",
  },

  confirmActions: {
    display: "flex",
    justifyContent: "center",
    gap: "12px",
  },

  confirmCancelBtn: {
    height: "46px",
    padding: "0 20px",
    borderRadius: "13px",
    border: "1px solid #d1d5db",
    background: "#ffffff",
  },

  confirmYesBtn: {
    height: "46px",
    padding: "0 20px",
    borderRadius: "13px",
    border: 0,
    background: "#ff5733",
    color: "#ffffff",
  },
};

export default EmployeeProjects;
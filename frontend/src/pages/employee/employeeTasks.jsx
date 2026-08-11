import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import api from "../../api/axios";

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  return [];
};

const getResponseData = (response) => {
  return response?.data?.data || response?.data || {};
};

const normalizeStatus = (status, progress = 0) => {
  const value = String(status || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (Number(progress) >= 100) return "completed";
  if (["todo", "to_do", "pending", "not_started", ""].includes(value)) return "not_started";
  if (["ongoing", "in_progress", "progress"].includes(value)) return "ongoing";
  if (["under_review", "review"].includes(value)) return "under_review";
  if (["completed", "done", "complete"].includes(value)) return "completed";
  if (["rejected", "reject"].includes(value)) return "rejected";
  if (["on_hold", "hold"].includes(value)) return "on_hold";

  return value || "not_started";
};

const formatStatus = (status, progress = 0) => {
  const value = normalizeStatus(status, progress);

  if (value === "not_started") return "To Do";
  if (value === "ongoing") return "In Progress";
  if (value === "under_review") return "Under Review";
  if (value === "completed") return "Done";
  if (value === "rejected") return "Rejected";
  if (value === "on_hold") return "On Hold";

  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const formatDateForInput = (dateValue) => {
  if (!dateValue) return "";
  const value = String(dateValue);
  if (value.includes("T")) return value.split("T")[0];
  return value.slice(0, 10);
};

const getTaskId = (task) => {
  return task?.task_id || task?.main_task_id || task?.id;
};

const getSubtaskId = (subtask) => {
  return subtask?.task_id || subtask?.subtask_id || subtask?.id;
};

const getTaskTitle = (task) => {
  return task?.task_title || task?.main_task_title || task?.title || "Main Task";
};

const getTaskDescription = (task) => {
  return task?.task_description || task?.description || task?.main_task_description || "-";
};

const getProjectTitle = (task) => {
  return task?.project_title || task?.project_name || "-";
};

const getTaskStartDate = (task) => {
  return formatDateForInput(task?.start_date || task?.task_start_date);
};

const getTaskEndDate = (task) => {
  return formatDateForInput(task?.due_date || task?.end_date || task?.task_end_date);
};

const getAssignedByName = (task) => {
  return (
    task?.created_by_name ||
    task?.assigned_by_name ||
    task?.admin_name ||
    task?.created_by ||
    "-"
  );
};

const getAssignedByEmail = (task) => {
  return (
    task?.created_by_email ||
    task?.assigned_by_email ||
    task?.admin_email ||
    ""
  );
};

const getTaskProgress = (task) => {
  return Number(task?.progress ?? task?.task_progress ?? task?.overall_progress ?? 0);
};

const normalizeSubtask = (subtask) => {
  const progress = Number(subtask?.progress || 0);
  const status = normalizeStatus(subtask?.status, progress);
  const checked =
    Number(subtask?.is_checked || 0) === 1 ||
    Boolean(subtask?.checked) ||
    status === "completed";

  return {
    ...subtask,
    task_id: getSubtaskId(subtask),
    task_title: subtask?.task_title || subtask?.subtask_title || subtask?.title || "Subtask",
    task_description:
      subtask?.task_description || subtask?.subtask_description || subtask?.description || "",
    start_date: formatDateForInput(subtask?.start_date || subtask?.task_start_date),
    due_date: formatDateForInput(subtask?.due_date || subtask?.end_date || subtask?.task_end_date),
    status: checked ? "completed" : status,
    is_checked: checked ? 1 : 0,
  };
};

const normalizeMainTask = (task) => {
  const subtasks = asArray(
    task?.subtasks ||
      task?.project_subtasks ||
      task?.children ||
      task?.sub_tasks ||
      task?.main_subtasks
  ).map(normalizeSubtask);

  const totalSubtasks = subtasks.length;
  const completedSubtasks = subtasks.filter((subtask) => Number(subtask.is_checked) === 1).length;

  const backendProgress = getTaskProgress(task);
  const calculatedProgress =
    totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : backendProgress;

  const finalProgress = Number.isFinite(calculatedProgress) ? calculatedProgress : 0;
  const status = normalizeStatus(task?.status || task?.main_task_status, finalProgress);

  return {
    ...task,
    task_id: getTaskId(task),
    task_title: getTaskTitle(task),
    task_description: getTaskDescription(task),
    project_title: getProjectTitle(task),
    start_date: getTaskStartDate(task),
    due_date: getTaskEndDate(task),
    created_by_name: getAssignedByName(task),
    created_by_email: getAssignedByEmail(task),
    status,
    progress: finalProgress,
    subtasks,
    total_subtasks: totalSubtasks,
    completed_subtasks: completedSubtasks,
  };
};

const parseTasksFromResponse = (response) => {
  const data = getResponseData(response);

  const taskList =
    data.main_tasks ||
    data.mainTasks ||
    data.tasks ||
    data.my_tasks ||
    data.assigned_tasks ||
    data.assignedTasks ||
    data;

  return asArray(taskList).map(normalizeMainTask);
};

const EmployeeTasks = () => {
  const location = useLocation();
  const [mainTasks, setMainTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [savingSubtask, setSavingSubtask] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [subtaskForm, setSubtaskForm] = useState({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
  });

  const callFirstWorkingGet = async (urls) => {
    let lastError;

    for (const url of urls) {
      try {
        return await api.get(url);
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError;
  };

  const callFirstWorkingPost = async (urls, payload) => {
    let lastError;

    for (const url of urls) {
      try {
        return await api.post(url, payload);
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError;
  };

  const callFirstWorkingPatch = async (urls, payload) => {
    let lastError;

    for (const item of urls) {
      try {
        if (item.method === "put") {
          return await api.put(item.url, payload);
        }

        if (item.method === "post") {
          return await api.post(item.url, payload);
        }

        return await api.patch(item.url, payload);
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError;
  };

  const fetchTasks = async () => {
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await callFirstWorkingGet([
        "/employee-tasks",
        "/employee-tasks/my",
        "/employee/tasks",
        "/employee/tasks/my",
        "/employee/main-tasks",
      ]);

      setMainTasks(parseTasksFromResponse(response));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to fetch assigned tasks."
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchTaskDetails = async (task) => {
    const taskId = getTaskId(task);

    if (!taskId) {
      setSelectedTask(normalizeMainTask(task));
      return;
    }

    try {
      const response = await callFirstWorkingGet([
        `/employee-tasks/${taskId}`,
        `/employee-tasks/${taskId}/details`,
        `/employee/tasks/${taskId}`,
        `/employee/tasks/${taskId}/details`,
      ]);

      const data = getResponseData(response);
      const taskData =
        data.task ||
        data.main_task ||
        data.mainTask ||
        data.task_details ||
        data.details ||
        data;

      setSelectedTask(normalizeMainTask({ ...task, ...taskData }));
    } catch {
      setSelectedTask(normalizeMainTask(task));
    }
  };

 useEffect(() => {
  fetchTasks();
}, []);

useEffect(() => {
  const requestedFilter = location.state?.filter;
  const requestedTaskId = location.state?.taskId;

  if (
    requestedFilter &&
    ["all", "todo", "in_progress", "done"].includes(requestedFilter)
  ) {
    setActiveFilter(requestedFilter);
  }

  if (requestedTaskId && mainTasks.length > 0) {
    const matchedTask = mainTasks.find(
      (task) => Number(task.task_id) === Number(requestedTaskId)
    );

    if (matchedTask) {
      fetchTaskDetails(matchedTask);
    }
  }
}, [location.state, mainTasks]);

const stats = useMemo(() => {
    const total = mainTasks.length;

    const todo = mainTasks.filter((task) => {
      const status = normalizeStatus(task.status, task.progress);
      return status === "not_started";
    }).length;

    const inProgress = mainTasks.filter((task) => {
      const status = normalizeStatus(task.status, task.progress);
      return status === "ongoing" || status === "under_review";
    }).length;

    const done = mainTasks.filter((task) => {
      const status = normalizeStatus(task.status, task.progress);
      return status === "completed";
    }).length;

    return {
      total,
      todo,
      inProgress,
      done,
    };
  }, [mainTasks]);

  const filteredTasks = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return mainTasks.filter((task) => {
      const status = normalizeStatus(task.status, task.progress);

      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "todo" && status === "not_started") ||
        (activeFilter === "in_progress" &&
          (status === "ongoing" || status === "under_review")) ||
        (activeFilter === "done" && status === "completed");

      const searchableText = [
        task.task_title,
        task.task_description,
        task.project_title,
        task.created_by_name,
        task.created_by_email,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [mainTasks, searchText, activeFilter]);

  const validateSubtaskForm = () => {
    const title = subtaskForm.title.trim();

    if (!title) {
      return "Subtask title is required.";
    }

    if (!subtaskForm.start_date || !subtaskForm.end_date) {
      return "Subtask start date and end date are required.";
    }

    if (subtaskForm.start_date > subtaskForm.end_date) {
      return "Subtask start date cannot be after end date.";
    }

    const mainStartDate = selectedTask?.start_date;
    const mainEndDate = selectedTask?.due_date;

    if (mainStartDate && subtaskForm.start_date < mainStartDate) {
      return `Subtask start date must be on or after ${mainStartDate}.`;
    }

    if (mainEndDate && subtaskForm.end_date > mainEndDate) {
      return `Subtask end date must be on or before ${mainEndDate}.`;
    }

    return "";
  };

  const addSubtask = async () => {
    if (!selectedTask?.task_id) return;

    setError("");
    setSuccessMessage("");

    const validationError = validateSubtaskForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSavingSubtask(true);

    try {
      const payload = {
        task_title: subtaskForm.title.trim(),
        title: subtaskForm.title.trim(),
        subtask_title: subtaskForm.title.trim(),
        task_description: subtaskForm.description.trim(),
        description: subtaskForm.description.trim(),
        subtask_description: subtaskForm.description.trim(),
        start_date: subtaskForm.start_date,
        due_date: subtaskForm.end_date,
        end_date: subtaskForm.end_date,
      };

      await callFirstWorkingPost(
        [
          `/employee-tasks/${selectedTask.task_id}/subtasks`,
          `/employee-tasks/tasks/${selectedTask.task_id}/subtasks`,
          `/employee/tasks/${selectedTask.task_id}/subtasks`,
          `/employee/tasks/${selectedTask.task_id}/subtasks/add`,
        ],
        payload
      );

      setSubtaskForm({
        title: "",
        description: "",
        start_date: "",
        end_date: "",
      });

      setSuccessMessage("Subtask added successfully.");

      await fetchTasks();
      await fetchTaskDetails(selectedTask);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to add subtask."
      );
    } finally {
      setSavingSubtask(false);
    }
  };

  const markSubtaskDone = async (subtask) => {
    const subtaskId = getSubtaskId(subtask);

    if (!subtaskId || Number(subtask.is_checked) === 1) return;

    setError("");
    setSuccessMessage("");

    try {
      await callFirstWorkingPatch(
        [
          { method: "patch", url: `/employee-tasks/subtasks/${subtaskId}/check` },
          { method: "put", url: `/employee-tasks/subtasks/${subtaskId}/check` },
          { method: "patch", url: `/employee/tasks/subtasks/${subtaskId}/check` },
          { method: "put", url: `/employee/tasks/subtasks/${subtaskId}/check` },
          { method: "put", url: `/employee/tasks/${subtaskId}/check` },
        ],
        {
          is_checked: true,
          checked: true,
          status: "completed",
        }
      );

      setSuccessMessage("Subtask marked as done.");

      await fetchTasks();
      await fetchTaskDetails(selectedTask);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to update subtask."
      );
    }
  };

  const closeModal = () => {
    setSelectedTask(null);
    setSubtaskForm({
      title: "",
      description: "",
      start_date: "",
      end_date: "",
    });
    setError("");
    setSuccessMessage("");
  };

  return (
    <div style={styles.page}>
      <div style={styles.topActions}>
        <button type="button" style={styles.refreshBtn} onClick={fetchTasks} disabled={loading}>
          <RefreshCw size={18} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}
      {successMessage && <div style={styles.successBox}>{successMessage}</div>}

      <div style={styles.taskStatsGrid}>
        <button
          type="button"
          style={{
            ...styles.taskStatCard,
            ...(activeFilter === "all" ? styles.activeStatCard : {}),
          }}
          onClick={() => setActiveFilter("all")}
        >
          <strong style={styles.taskStatNumber}>{stats.total}</strong>
          <span style={styles.taskStatLabel}>
            <ClipboardList size={20} />
            Total Main Tasks
          </span>
        </button>

        <button
          type="button"
          style={{
            ...styles.taskStatCard,
            ...(activeFilter === "todo" ? styles.activeStatCard : {}),
          }}
          onClick={() => setActiveFilter("todo")}
        >
          <strong style={styles.taskStatNumber}>{stats.todo}</strong>
          <span style={styles.taskStatLabel}>
            <Clock3 size={20} />
            To Do
          </span>
        </button>

        <button
          type="button"
          style={{
            ...styles.taskStatCard,
            ...(activeFilter === "in_progress" ? styles.activeStatCard : {}),
          }}
          onClick={() => setActiveFilter("in_progress")}
        >
          <strong style={styles.taskStatNumber}>{stats.inProgress}</strong>
          <span style={styles.taskStatLabel}>
            <Activity size={20} />
            In Progress
          </span>
        </button>

        <button
          type="button"
          style={{
            ...styles.taskStatCard,
            ...(activeFilter === "done" ? styles.activeStatCard : {}),
          }}
          onClick={() => setActiveFilter("done")}
        >
          <strong style={styles.taskStatNumber}>{stats.done}</strong>
          <span style={styles.taskStatLabel}>
            <CheckCircle2 size={20} />
            Done
          </span>
        </button>
      </div>

      <section style={styles.tasksPanel}>
        <div style={styles.panelHeader}>
          <div style={styles.panelTitleWrap}>
            <ClipboardList size={24} color="#ff5733" />
            <div>
              <h2 style={styles.panelTitle}>My Assigned Main Tasks</h2>
              <p style={styles.panelSubtitle}>
                Click any main task to add subtasks and update progress.
              </p>
            </div>
          </div>

          <div style={styles.searchBox}>
            <Search size={19} color="#64748b" />
            <input
              style={styles.searchInput}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search project, main task, admin..."
            />
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div style={styles.emptyBox}>No tasks found.</div>
        ) : (
          <div style={styles.taskGrid}>
            {filteredTasks.map((task) => {
              const statusLabel = formatStatus(task.status, task.progress);

              return (
                <button
                  type="button"
                  style={styles.taskCard}
                  key={task.task_id}
                  onClick={() => fetchTaskDetails(task)}
                >
                  <div style={styles.taskCardTop}>
                    <div>
                      <h3 style={styles.taskTitle}>{task.task_title}</h3>
                      <p style={styles.projectTitle}>{task.project_title}</p>
                    </div>

                    <span style={styles.statusBadge}>{statusLabel}</span>
                  </div>

                  <p style={styles.taskDescription}>{task.task_description}</p>

                  <div style={styles.taskAssignedByLine}>
                    Assigned by: <strong>{getAssignedByName(task)}</strong>
                  </div>

                  <div style={styles.taskDateRow}>
                    <span>{task.start_date || "-"}</span>
                    <span>to</span>
                    <span>{task.due_date || "-"}</span>
                  </div>

                  <div style={styles.progressMeta}>
                    <strong>
                      {task.completed_subtasks}/{task.total_subtasks} subtasks done
                    </strong>
                    <strong>{task.progress}%</strong>
                  </div>

                  <div style={styles.progressTrack}>
                    <div style={{ ...styles.progressFill, width: `${task.progress}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedTask && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <button type="button" style={styles.closeBtn} onClick={closeModal}>
              <X size={22} />
            </button>

            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{selectedTask.task_title}</h2>
              <p style={styles.modalSubtitle}>{selectedTask.project_title}</p>
            </div>

            <div style={styles.detailsGrid}>
              <div style={styles.detailBox}>
                <span>Status</span>
                <strong>{formatStatus(selectedTask.status, selectedTask.progress)}</strong>
              </div>

              <div style={styles.detailBox}>
                <span>Assigned By</span>
                <strong>{getAssignedByName(selectedTask)}</strong>
                {getAssignedByEmail(selectedTask) && (
                  <small style={styles.assignedByEmail}>
                    {getAssignedByEmail(selectedTask)}
                  </small>
                )}
              </div>

              <div style={styles.detailBox}>
                <span>Start Date</span>
                <strong>{selectedTask.start_date || "-"}</strong>
              </div>

              <div style={styles.detailBox}>
                <span>End Date</span>
                <strong>{selectedTask.due_date || "-"}</strong>
              </div>
            </div>

            <div style={styles.descriptionBox}>
              <span>Main Task Description</span>
              <p>{selectedTask.task_description || "-"}</p>
            </div>

            <div style={styles.modalProgressBox}>
              <div style={styles.progressMeta}>
                <strong>Task Progress</strong>
                <strong>{selectedTask.progress}%</strong>
              </div>

              <div style={styles.progressTrack}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${selectedTask.progress}%`,
                  }}
                />
              </div>

              <p style={styles.subtaskCountText}>
                {selectedTask.completed_subtasks}/{selectedTask.total_subtasks} subtasks completed
              </p>
            </div>

            {normalizeStatus(selectedTask.status, selectedTask.progress) !== "completed" && (
              <div style={styles.addSubtaskBox}>
                <h3 style={styles.addSubtaskTitle}>
                  <Plus size={20} />
                  Add Subtask
                </h3>

                <div style={styles.formGrid}>
                  <label style={styles.formGroup}>
                    <span>Subtask Title</span>
                    <input
                      style={styles.input}
                      value={subtaskForm.title}
                      onChange={(event) =>
                        setSubtaskForm((previous) => ({
                          ...previous,
                          title: event.target.value,
                        }))
                      }
                      placeholder="Example: Backend API"
                    />
                  </label>

                  <label style={styles.formGroup}>
                    <span>Start Date</span>
                    <input
                      type="date"
                      style={styles.input}
                      value={subtaskForm.start_date}
                      onChange={(event) =>
                        setSubtaskForm((previous) => ({
                          ...previous,
                          start_date: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label style={styles.formGroup}>
                    <span>End Date</span>
                    <input
                      type="date"
                      style={styles.input}
                      value={subtaskForm.end_date}
                      onChange={(event) =>
                        setSubtaskForm((previous) => ({
                          ...previous,
                          end_date: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <label style={styles.formGroup}>
                  <span>Subtask Description</span>
                  <textarea
                    style={styles.textarea}
                    value={subtaskForm.description}
                    onChange={(event) =>
                      setSubtaskForm((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Write what this subtask includes..."
                  />
                </label>

                <button
                  type="button"
                  style={styles.addBtn}
                  onClick={addSubtask}
                  disabled={savingSubtask}
                >
                  <Plus size={18} />
                  {savingSubtask ? "Adding..." : "Add Subtask"}
                </button>
              </div>
            )}

            <div style={styles.subtasksSection}>
              <h3 style={styles.sectionTitle}>Subtasks</h3>

              {selectedTask.subtasks.length === 0 ? (
                <div style={styles.emptyBox}>No subtasks added yet.</div>
              ) : (
                <div style={styles.subtaskList}>
                  {selectedTask.subtasks.map((subtask) => {
                    const checked = Number(subtask.is_checked) === 1;

                    return (
                      <div style={styles.subtaskItem} key={subtask.task_id}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={checked}
                          onChange={() => markSubtaskDone(subtask)}
                          style={styles.checkbox}
                        />

                        <div style={styles.subtaskContent}>
                          <h4 style={styles.subtaskTitle}>{subtask.task_title}</h4>

                          {subtask.task_description && (
                            <p style={styles.subtaskDescription}>
                              {subtask.task_description}
                            </p>
                          )}

                          <p style={styles.subtaskDate}>
                            {subtask.start_date || "-"} to {subtask.due_date || "-"}
                          </p>
                        </div>

                        <span
                          style={{
                            ...styles.statusBadge,
                            ...(checked ? styles.doneBadge : {}),
                          }}
                        >
                          {checked ? "Done" : "To Do"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
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
    padding: "0",
  },

  topActions: {
    width: "100%",
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: "22px",
  },

  refreshBtn: {
    border: "none",
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "18px",
    padding: "15px 24px",
    fontSize: "16px",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    cursor: "pointer",
    boxShadow: "0 14px 28px rgba(255, 87, 51, 0.22)",
  },

  errorBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#b91c1c",
    borderRadius: "18px",
    padding: "16px 20px",
    fontSize: "16px",
    fontWeight: 800,
    marginBottom: "22px",
  },

  successBox: {
    background: "#dcfce7",
    border: "1px solid #bbf7d0",
    color: "#166534",
    borderRadius: "18px",
    padding: "16px 20px",
    fontSize: "16px",
    fontWeight: 800,
    marginBottom: "22px",
  },

  taskStatsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "22px",
    marginBottom: "28px",
  },

  taskStatCard: {
    background: "#ffffff",
    borderRadius: "22px",
    padding: "24px 26px",
    minHeight: "120px",
    display: "grid",
    gridTemplateColumns: "24px minmax(0, 1fr)",
    gridTemplateRows: "auto auto",
    alignContent: "center",
    alignItems: "center",
    gap: "16px 10px",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)",
    border: "1px solid #eef2f7",
    cursor: "pointer",
    textAlign: "left",
  },

  activeStatCard: {
    border: "1px solid #ff5733",
    background: "#fff7f4",
  },

  taskStatNumber: {
    gridColumn: "1 / -1",
    color: "#111827",
    fontSize: "34px",
    fontWeight: 900,
    lineHeight: 1,
  },

  taskStatLabel: {
    gridColumn: "1 / -1",
    color: "#64748b",
    fontSize: "15px",
    fontWeight: 900,
    lineHeight: 1.25,
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  tasksPanel: {
    background: "#ffffff",
    borderRadius: "28px",
    padding: "32px",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)",
  },

  panelHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 0.8fr) minmax(320px, 1fr)",
    gap: "24px",
    alignItems: "start",
    marginBottom: "26px",
  },

  panelTitleWrap: {
    display: "flex",
    alignItems: "flex-start",
    gap: "16px",
  },

  panelTitle: {
    margin: "0 0 10px",
    color: "#111827",
    fontSize: "32px",
    fontWeight: 900,
    lineHeight: 1.12,
  },

  panelSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "16px",
    lineHeight: 1.45,
  },

  searchBox: {
    height: "60px",
    border: "1px solid #d6dde8",
    borderRadius: "18px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "0 18px",
    background: "#ffffff",
  },

  searchInput: {
    width: "100%",
    border: "none",
    outline: "none",
    color: "#111827",
    fontSize: "16px",
    fontWeight: 700,
    background: "transparent",
  },

  emptyBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: "18px",
    padding: "28px",
    textAlign: "center",
    color: "#64748b",
    fontSize: "16px",
    fontWeight: 900,
    background: "#f8fafc",
  },

  taskGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "22px",
  },

  taskCard: {
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: "20px",
    padding: "22px",
    cursor: "pointer",
    textAlign: "left",
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.04)",
  },

  taskCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "16px",
  },

  taskTitle: {
    margin: "0 0 8px",
    color: "#111827",
    fontSize: "20px",
    fontWeight: 900,
    lineHeight: 1.25,
  },

  projectTitle: {
    margin: 0,
    color: "#475569",
    fontSize: "16px",
    fontWeight: 700,
  },

  statusBadge: {
    background: "#eef2ff",
    color: "#334155",
    padding: "9px 14px",
    borderRadius: "999px",
    fontSize: "14px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  doneBadge: {
    background: "#dcfce7",
    color: "#166534",
  },

  taskDescription: {
    margin: "0 0 14px",
    color: "#64748b",
    fontSize: "15px",
    lineHeight: 1.45,
  },

  taskAssignedByLine: {
    marginBottom: "16px",
    color: "#64748b",
    fontSize: "14px",
    fontWeight: 800,
  },

  taskDateRow: {
    display: "flex",
    gap: "8px",
    color: "#64748b",
    fontSize: "14px",
    fontWeight: 700,
    marginBottom: "18px",
  },

  progressMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    color: "#111827",
    fontSize: "15px",
    marginBottom: "10px",
  },

  progressTrack: {
    width: "100%",
    height: "11px",
    borderRadius: "999px",
    background: "#ffd6cc",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: "999px",
    background: "#ff5733",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.62)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "36px",
    zIndex: 9999,
  },

  modal: {
    width: "min(1080px, 96vw)",
    maxHeight: "88vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: "28px",
    padding: "34px",
    position: "relative",
    boxShadow: "0 30px 90px rgba(15, 23, 42, 0.28)",
  },

  closeBtn: {
    position: "absolute",
    top: "28px",
    right: "28px",
    width: "52px",
    height: "52px",
    borderRadius: "16px",
    border: "none",
    background: "#111827",
    color: "#ffffff",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  },

  modalHeader: {
    paddingRight: "70px",
    marginBottom: "26px",
  },

  modalTitle: {
    margin: "0 0 8px",
    color: "#111827",
    fontSize: "34px",
    fontWeight: 900,
  },

  modalSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "18px",
  },

  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "16px",
    marginBottom: "20px",
  },

  detailBox: {
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    borderRadius: "16px",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  assignedByEmail: {
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.3,
    wordBreak: "break-word",
  },

  descriptionBox: {
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: "16px",
    padding: "18px",
    marginBottom: "20px",
  },

  modalProgressBox: {
    border: "1px solid #ffc6b8",
    background: "#fff7f4",
    borderRadius: "18px",
    padding: "20px",
    marginBottom: "22px",
  },

  subtaskCountText: {
    margin: "10px 0 0",
    color: "#64748b",
    fontSize: "15px",
    fontWeight: 800,
  },

  addSubtaskBox: {
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    borderRadius: "20px",
    padding: "22px",
    marginBottom: "26px",
  },

  addSubtaskTitle: {
    margin: "0 0 18px",
    color: "#ff5733",
    fontSize: "24px",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr 1fr",
    gap: "14px",
    marginBottom: "16px",
  },

  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    color: "#111827",
    fontSize: "15px",
    fontWeight: 800,
  },

  input: {
    height: "52px",
    border: "1px solid #d6dde8",
    borderRadius: "14px",
    padding: "0 14px",
    fontSize: "15px",
    fontWeight: 700,
    outline: "none",
    background: "#ffffff",
  },

  textarea: {
    minHeight: "96px",
    border: "1px solid #d6dde8",
    borderRadius: "14px",
    padding: "14px",
    fontSize: "15px",
    fontWeight: 700,
    outline: "none",
    resize: "vertical",
    background: "#ffffff",
  },

  addBtn: {
    width: "100%",
    height: "56px",
    border: "none",
    borderRadius: "16px",
    background: "#ff5733",
    color: "#ffffff",
    fontSize: "17px",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    marginTop: "18px",
    cursor: "pointer",
  },

  subtasksSection: {
    marginTop: "10px",
  },

  sectionTitle: {
    margin: "0 0 16px",
    color: "#111827",
    fontSize: "26px",
    fontWeight: 900,
  },

  subtaskList: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },

  subtaskItem: {
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "18px",
    display: "grid",
    gridTemplateColumns: "24px 1fr auto",
    alignItems: "center",
    gap: "16px",
  },

  checkbox: {
    width: "18px",
    height: "18px",
  },

  subtaskContent: {
    minWidth: 0,
  },

  subtaskTitle: {
    margin: "0 0 6px",
    color: "#111827",
    fontSize: "17px",
    fontWeight: 900,
  },

  subtaskDescription: {
    margin: "0 0 8px",
    color: "#64748b",
    fontSize: "15px",
    lineHeight: 1.4,
  },

  subtaskDate: {
    margin: 0,
    color: "#64748b",
    fontSize: "14px",
    fontWeight: 700,
  },
};

export default EmployeeTasks;
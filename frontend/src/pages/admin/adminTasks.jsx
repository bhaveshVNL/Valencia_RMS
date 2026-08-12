import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import AdminDepartmentMiniTasks from "../../components/MiniTasks/AdminDepartmentMiniTasks";

const formatDate = (dateValue) => {
  if (!dateValue) return "-";
  return String(dateValue).slice(0, 10);
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

  if (value === "in_progress" || value === "progress" || value === "ongoing") {
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

const getStatusPriority = (status) => {
  const value = normalizeStatus(status);

  if (value === "rejected") return 6;
  if (value === "under_review") return 5;
  if (value === "in_progress") return 4;
  if (value === "todo") return 3;
  if (value === "on_hold") return 2;
  if (value === "done") return 1;

  return 0;
};

const getTaskStatus = (tasks) => {
  const statuses = tasks.map((task) =>
    normalizeStatus(task.status_group || task.status || task.project_status)
  );

  if (statuses.includes("rejected")) {
    return { status_group: "rejected", status_label: "Rejected" };
  }

  if (statuses.includes("under_review")) {
    return { status_group: "under_review", status_label: "Under Review" };
  }

  if (statuses.includes("in_progress")) {
    return { status_group: "in_progress", status_label: "In Progress" };
  }

  if (statuses.includes("on_hold")) {
    return { status_group: "on_hold", status_label: "On Hold" };
  }

  const allDone =
    tasks.length > 0 &&
    statuses.every((status) => normalizeStatus(status) === "done");

  if (allDone) {
    return { status_group: "done", status_label: "Done" };
  }

  return { status_group: "todo", status_label: "To Do" };
};

const dedupeUsers = (users) => {
  const map = new Map();

  (Array.isArray(users) ? users : []).forEach((user) => {
    const id =
      user.user_id ||
      user.assigned_user_id ||
      user.employee_id ||
      user.assignee_id ||
      user.email;

    if (!id) return;

    const key = String(id);

    if (!map.has(key)) {
      map.set(key, user);
    }
  });

  return Array.from(map.values());
};

const getInitial = (name) => {
  return String(name || "E").charAt(0).toUpperCase();
};

const getEmployeeInitials = (assignees = []) => {
  const cleanAssignees = Array.isArray(assignees) ? assignees : [];

  return cleanAssignees.map((assignee) => {
    const name = assignee.assigned_name || assignee.full_name || "Employee";
    const email = assignee.assigned_email || assignee.email || "";

    return {
      id:
        assignee.task_id ||
        assignee.assigned_user_id ||
        assignee.user_id ||
        email,
      name,
      email,
      initial: getInitial(name),
    };
  });
};

const AdminTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [admin, setAdmin] = useState(null);

  const [activeFilter, setActiveFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedTask, setSelectedTask] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/admin-tasks/department-tasks");

      setTasks(response.data?.tasks || []);
      setAdmin(response.data?.admin || null);
    } catch (err) {
      console.error("Fetch admin department tasks error:", err);

      setError(
        err?.response?.data?.sqlMessage ||
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to load department tasks."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const groupedMainTasks = useMemo(() => {
    const map = new Map();

    tasks.forEach((task) => {
      const mainTaskKey =
        task.main_task_key ||
        [
          task.project_id || "",
          task.task_title || "",
          task.task_description || "",
        ].join("::") ||
        task.task_id;

      if (!map.has(mainTaskKey)) {
        map.set(mainTaskKey, {
          main_task_key: mainTaskKey,
          project_id: task.project_id,
          project_title: task.project_title || "Untitled Project",

          task_title: task.task_title || "Untitled Main Task",
          task_description:
            task.task_description ||
            task.project_description ||
            "No task description added.",

          project_start_date: task.project_start_date || task.start_date,
          project_end_date:
            task.project_end_date || task.due_date || task.end_date,

          created_by_name: task.created_by_name,

          tasks: [],
          main_task_assignees: [],
          project_assignees: dedupeUsers(task.project_assignees || []),

          total_progress: 0,
          total_subtasks: 0,
          completed_subtasks: 0,

          is_rejected: false,
          rejection_reason: "",
          rejected_at: "",
          rejection_expires_at: "",
        });
      }

      const mainTask = map.get(mainTaskKey);

      mainTask.tasks.push(task);
      mainTask.total_progress += Number(task.progress || 0);
      mainTask.total_subtasks += Number(task.total_subtasks || 0);
      mainTask.completed_subtasks += Number(task.completed_subtasks || 0);

      mainTask.project_assignees = dedupeUsers([
        ...mainTask.project_assignees,
        ...(task.project_assignees || []),
      ]);

      mainTask.main_task_assignees.push({
        task_id: task.task_id,
        assigned_user_id: task.assigned_user_id,
        assigned_name: task.assigned_name,
        assigned_email: task.assigned_email,
        assigned_employee_code: task.assigned_employee_code,
        assigned_designation: task.assigned_designation,
        assigned_department_name: task.assigned_department_name,
        status_group: normalizeStatus(
          task.status_group || task.status || task.project_status
        ),
        status_label: task.status_label || getTaskStatus([task]).status_label,
        progress: Number(task.progress || 0),
        completed_subtasks: Number(task.completed_subtasks || 0),
        total_subtasks: Number(task.total_subtasks || 0),
        subtasks: task.subtasks || [],
      });

      if (
        task.is_rejected ||
        normalizeStatus(
          task.status_group || task.status || task.project_status
        ) === "rejected"
      ) {
        mainTask.is_rejected = true;
        mainTask.rejection_reason = task.rejection_reason || "";
        mainTask.rejected_at = task.rejected_at || "";
        mainTask.rejection_expires_at = task.rejection_expires_at || "";
      }
    });

    return Array.from(map.values())
      .map((mainTask) => {
        const status = getTaskStatus(mainTask.tasks);

        const averageProgress =
          mainTask.tasks.length > 0
            ? Math.round(mainTask.total_progress / mainTask.tasks.length)
            : 0;

        const projectAssignedNames =
          mainTask.project_assignees
            .map((assignee) => assignee.full_name || assignee.assigned_name)
            .filter(Boolean)
            .join(", ") || "-";

        const projectAssignedEmails =
          mainTask.project_assignees
            .map((assignee) => assignee.email || assignee.assigned_email)
            .filter(Boolean)
            .join(", ") || "-";

        const mainTaskAssignedNames =
          mainTask.main_task_assignees
            .map((assignee) => assignee.assigned_name)
            .filter(Boolean)
            .join(", ") || "-";

        return {
          ...mainTask,
          ...status,
          progress: averageProgress,
          project_assigned_names: projectAssignedNames,
          project_assigned_emails: projectAssignedEmails,
          main_task_assigned_names: mainTaskAssignedNames,
        };
      })
      .sort((a, b) => {
        const statusDifference =
          getStatusPriority(b.status_group) -
          getStatusPriority(a.status_group);

        if (statusDifference !== 0) return statusDifference;

        return Number(b.project_id || 0) - Number(a.project_id || 0);
      });
  }, [tasks]);

  const taskCounts = useMemo(() => {
    return groupedMainTasks.reduce(
      (acc, task) => {
        acc.all += 1;

        const status = normalizeStatus(task.status_group);

        acc[status] = (acc[status] || 0) + 1;

        return acc;
      },
      {
        all: 0,
        todo: 0,
        in_progress: 0,
        under_review: 0,
        done: 0,
        rejected: 0,
        on_hold: 0,
      }
    );
  }, [groupedMainTasks]);

  const filteredTasks = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return groupedMainTasks.filter((task) => {
      const matchesFilter =
        activeFilter === "all" || task.status_group === activeFilter;

      const matchesSearch =
        !term ||
        String(task.project_title || "").toLowerCase().includes(term) ||
        String(task.task_title || "").toLowerCase().includes(term) ||
        String(task.task_description || "").toLowerCase().includes(term) ||
        String(task.created_by_name || "").toLowerCase().includes(term) ||
        String(task.status_label || "").toLowerCase().includes(term) ||
        String(task.project_assigned_names || "").toLowerCase().includes(term) ||
        String(task.project_assigned_emails || "").toLowerCase().includes(term) ||
        String(task.main_task_assigned_names || "")
          .toLowerCase()
          .includes(term) ||
        task.project_assignees.some((assignee) => {
          return (
            String(assignee.full_name || assignee.assigned_name || "")
              .toLowerCase()
              .includes(term) ||
            String(assignee.email || assignee.assigned_email || "")
              .toLowerCase()
              .includes(term) ||
            String(
              assignee.employee_code || assignee.assigned_employee_code || ""
            )
              .toLowerCase()
              .includes(term) ||
            String(assignee.designation || assignee.assigned_designation || "")
              .toLowerCase()
              .includes(term)
          );
        }) ||
        task.main_task_assignees.some((assignee) => {
          return (
            String(assignee.assigned_name || "")
              .toLowerCase()
              .includes(term) ||
            String(assignee.assigned_email || "")
              .toLowerCase()
              .includes(term) ||
            String(assignee.assigned_employee_code || "")
              .toLowerCase()
              .includes(term) ||
            String(assignee.assigned_designation || "")
              .toLowerCase()
              .includes(term) ||
            String(assignee.status_label || "").toLowerCase().includes(term)
          );
        });

      return matchesFilter && matchesSearch;
    });
  }, [groupedMainTasks, activeFilter, searchTerm]);

  const kanbanColumns = [
    {
      key: "todo",
      title: "To Do",
      subtitle: "Not started",
      tasks: filteredTasks.filter(
        (task) => normalizeStatus(task.status_group) === "todo"
      ),
    },
    {
      key: "in_progress",
      title: "In Progress",
      subtitle: "Work started",
      tasks: filteredTasks.filter(
        (task) => normalizeStatus(task.status_group) === "in_progress"
      ),
    },
    {
      key: "under_review",
      title: "Under Review",
      subtitle: "Waiting review",
      tasks: filteredTasks.filter(
        (task) => normalizeStatus(task.status_group) === "under_review"
      ),
    },
    {
      key: "done",
      title: "Done",
      subtitle: "Completed",
      tasks: filteredTasks.filter(
        (task) => normalizeStatus(task.status_group) === "done"
      ),
    },
    {
      key: "rejected",
      title: "Rejected",
      subtitle: "Rejected tasks",
      tasks: filteredTasks.filter(
        (task) => normalizeStatus(task.status_group) === "rejected"
      ),
    },
    {
      key: "on_hold",
      title: "On Hold",
      subtitle: "Paused",
      tasks: filteredTasks.filter(
        (task) => normalizeStatus(task.status_group) === "on_hold"
      ),
    },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.topActions}>
        <button type="button" style={styles.refreshButton} onClick={fetchTasks}>
          Refresh
        </button>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      <input
        style={styles.searchInput}
        type="text"
        placeholder="Search by project, task, employee, email, code, designation..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <section style={styles.kanbanSection}>
        <div style={styles.kanbanHeader}>
          <div>
            <h2 style={styles.kanbanTitle}>Tasks Kanban</h2>
            <p style={styles.kanbanSubtitle}>
              Each tile represents one main task. Click a tile to view
              employee-wise subtasks and progress.
            </p>
          </div>
        </div>

        {loading ? (
          <div style={styles.messageBox}>Loading department tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div style={styles.messageBox}>No tasks found.</div>
        ) : (
          <div style={styles.kanbanScroll}>
            <div style={styles.kanbanBoard}>
              {kanbanColumns.map((column) => (
                <div style={styles.kanbanColumn} key={column.key}>
                  <div style={styles.columnHeader}>
                    <div>
                      <h3 style={styles.columnTitle}>{column.title}</h3>
                      <p style={styles.columnSubtitle}>{column.subtitle}</p>
                    </div>

                    <span style={styles.columnCount}>{column.tasks.length}</span>
                  </div>

                  <div style={styles.columnBody}>
                    {column.tasks.length === 0 ? (
                      <div style={styles.emptyBox}>No tasks here.</div>
                    ) : (
                      column.tasks.map((task) => (
                        <button
                          type="button"
                          key={task.main_task_key}
                          style={styles.taskTile}
                          onClick={() => setSelectedTask(task)}
                        >
                          <div style={styles.tileContent}>
                            <h3
                              style={styles.tileMainTaskTitle}
                              title={task.task_title || "Untitled Main Task"}
                            >
                              {task.task_title || "Untitled Main Task"}
                            </h3>

                            <p
                              style={styles.tileProjectName}
                              title={task.project_title || "-"}
                            >
                              {task.project_title || "-"}
                            </p>
                          </div>

                          <div style={styles.tileBottomRow}>
                            <span style={styles.tileSubtaskText}>
                              {task.completed_subtasks || 0}/
                              {task.total_subtasks || 0} subtasks done
                            </span>

                            <div style={styles.tileAvatarGroup}>
                              {getEmployeeInitials(task.main_task_assignees)
                                .length === 0 ? (
                                <span style={styles.tileNoEmployee}>-</span>
                              ) : (
                                getEmployeeInitials(
                                  task.main_task_assignees
                                ).map((employee) => (
                                  <span
                                    key={employee.id}
                                    style={styles.tileAvatar}
                                    title={`${employee.name}${
                                      employee.email
                                        ? ` - ${employee.email}`
                                        : ""
                                    }`}
                                  >
                                    {employee.initial}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
            </section>

      <AdminDepartmentMiniTasks />

      {selectedTask && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <button
              type="button"
              style={styles.closeButton}
              onClick={() => setSelectedTask(null)}
            >
              ×
            </button>

            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>{selectedTask.task_title}</h2>
                <p style={styles.modalSubtitle}>
                  Project: <strong>{selectedTask.project_title || "-"}</strong>
                </p>
              </div>

              <span style={styles.modalStatus}>
                {selectedTask.status_label ||
                  getStatusLabel(selectedTask.status_group)}
              </span>
            </div>

            <div style={styles.infoGrid}>
              <div style={styles.infoBox}>
                <span>Project Dates</span>
                <strong>
                  {formatDate(selectedTask.project_start_date)} to{" "}
                  {formatDate(selectedTask.project_end_date)}
                </strong>
              </div>

              <div style={styles.infoBox}>
                <span>Created By</span>
                <strong>{selectedTask.created_by_name || "-"}</strong>
              </div>

              <div style={styles.infoBox}>
                <span>Total Project Assignees</span>
                <strong>{selectedTask.project_assignees.length}</strong>
              </div>

              <div style={styles.infoBox}>
                <span>Main Task Progress</span>
                <strong>{selectedTask.progress || 0}%</strong>
              </div>
            </div>

            <div style={styles.modalProgressBox}>
              <div style={styles.modalProgressTop}>
                <strong>Overall Main Task Progress</strong>
                <b>{selectedTask.progress || 0}%</b>
              </div>

              <div style={styles.progressTrack}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${selectedTask.progress || 0}%`,
                  }}
                />
              </div>
            </div>

            <section style={styles.modalSection}>
              <h3 style={styles.modalSectionTitle}>Project Assignees</h3>

              {selectedTask.project_assignees.length === 0 ? (
                <div style={styles.emptyBox}>No project assignees found.</div>
              ) : (
                <div style={styles.assigneeGrid}>
                  {selectedTask.project_assignees.map((assignee) => (
                    <div
                      style={styles.assigneeCard}
                      key={
                        assignee.user_id ||
                        assignee.assigned_user_id ||
                        assignee.email
                      }
                    >
                      <div style={styles.avatar}>
                        {getInitial(assignee.full_name || assignee.assigned_name)}
                      </div>

                      <div>
                        <h4 style={styles.assigneeName}>
                          {assignee.full_name || assignee.assigned_name || "-"}
                        </h4>
                        <p style={styles.assigneeEmail}>
                          {assignee.email || assignee.assigned_email || "-"}
                        </p>
                        <span style={styles.assigneeMeta}>
                          {assignee.employee_code ||
                            assignee.assigned_employee_code ||
                            "-"}{" "}
                          ·{" "}
                          {assignee.designation ||
                            assignee.assigned_designation ||
                            "-"}{" "}
                          · {assignee.department_name || "-"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={styles.modalSection}>
              <h3 style={styles.modalSectionTitle}>
                Employee-wise Main Task Subtasks
              </h3>

              {selectedTask.main_task_assignees.length === 0 ? (
                <div style={styles.emptyBox}>No main task assignees found.</div>
              ) : (
                <div style={styles.employeeTaskList}>
                  {selectedTask.main_task_assignees.map((assignee) => (
                    <div style={styles.employeeTaskCard} key={assignee.task_id}>
                      <div style={styles.employeeTaskTop}>
                        <div style={styles.employeeIdentity}>
                          <div style={styles.avatar}>
                            {getInitial(assignee.assigned_name)}
                          </div>

                          <div>
                            <h4 style={styles.assigneeName}>
                              {assignee.assigned_name || "-"}
                            </h4>
                            <p style={styles.assigneeEmail}>
                              {assignee.assigned_email || "-"}
                            </p>
                            <span style={styles.assigneeMeta}>
                              {assignee.assigned_employee_code || "-"} ·{" "}
                              {assignee.assigned_designation || "-"} ·{" "}
                              {assignee.status_label || "To Do"}
                            </span>
                          </div>
                        </div>

                        <strong style={styles.employeeProgressNumber}>
                          {assignee.progress || 0}%
                        </strong>
                      </div>

                      <div style={styles.progressTrack}>
                        <div
                          style={{
                            ...styles.progressFill,
                            width: `${assignee.progress || 0}%`,
                          }}
                        />
                      </div>

                      <p style={styles.subtaskCount}>
                        {assignee.completed_subtasks || 0}/
                        {assignee.total_subtasks || 0} subtasks done
                      </p>

                      <div style={styles.subtaskList}>
                        {assignee.subtasks && assignee.subtasks.length > 0 ? (
                          assignee.subtasks.map((subtask) => (
                            <div
                              style={styles.subtaskRow}
                              key={
                                subtask.subtask_key ||
                                `${assignee.task_id}-${subtask.subtask_id}`
                              }
                            >
                              <span
                                style={
                                  normalizeStatus(subtask.status) === "done"
                                    ? styles.doneDot
                                    : styles.pendingDot
                                }
                              />

                              <div>
                                <strong style={styles.subtaskTitle}>
                                  {subtask.title}
                                </strong>
                                <p style={styles.subtaskMeta}>
                                  {formatDate(subtask.start_date)} to{" "}
                                  {formatDate(subtask.end_date)} ·{" "}
                                  {getStatusLabel(subtask.status)}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={styles.noSubtasks}>
                            No subtasks added by{" "}
                            {assignee.assigned_name || "employee"}.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
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
  },

  topActions: {
    width: "100%",
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: "22px",
  },

  refreshButton: {
    border: "none",
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "16px",
    padding: "15px 24px",
    fontSize: "16px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 12px 28px rgba(255, 87, 51, 0.2)",
  },

  errorBox: {
    background: "#fff1f2",
    color: "#b91c1c",
    border: "1px solid #fecdd3",
    borderRadius: "18px",
    padding: "16px 18px",
    fontSize: "15px",
    fontWeight: 800,
    marginBottom: "22px",
  },

  searchInput: {
    width: "100%",
    height: "58px",
    border: "1.5px solid #cbd5e1",
    borderRadius: "16px",
    background: "#ffffff",
    padding: "0 22px",
    fontSize: "16px",
    fontWeight: 800,
    color: "#111827",
    outline: "none",
    marginBottom: "28px",
  },

  kanbanSection: {
    marginTop: "28px",
    background: "#ffffff",
    borderRadius: "26px",
    padding: "26px",
    boxShadow: "0 14px 36px rgba(15, 23, 42, 0.06)",
  },

  kanbanHeader: {
    marginBottom: "22px",
  },

  kanbanTitle: {
    margin: "0 0 8px",
    color: "#111827",
    fontSize: "30px",
    fontWeight: 900,
  },

  kanbanSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "16px",
    lineHeight: 1.45,
  },

  messageBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: "18px",
    padding: "34px",
    textAlign: "center",
    color: "#94a3b8",
    fontWeight: 900,
    background: "#f8fafc",
  },

  kanbanScroll: {
    width: "100%",
    overflowX: "auto",
    paddingBottom: "14px",
  },

  kanbanBoard: {
    minWidth: "1280px",
    display: "grid",
    gridTemplateColumns: "repeat(6, 360px)",
    gap: "20px",
  },

  kanbanColumn: {
    border: "1px solid #e5e7eb",
    borderRadius: "22px",
    padding: "18px",
    minHeight: "500px",
    background: "#ffffff",
  },

  columnHeader: {
    background: "#f8fafc",
    borderRadius: "18px",
    padding: "18px",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "16px",
  },

  columnTitle: {
    margin: "0 0 8px",
    color: "#111827",
    fontSize: "23px",
    fontWeight: 900,
  },

  columnSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "14px",
    fontWeight: 700,
  },

  columnCount: {
    width: "46px",
    height: "46px",
    borderRadius: "50%",
    background: "#e5e7eb",
    color: "#111827",
    display: "grid",
    placeItems: "center",
    fontSize: "16px",
    fontWeight: 900,
    flexShrink: 0,
  },

columnBody: {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  maxHeight: "500px",
  overflowY: "auto",
  paddingRight: "8px",
},

taskTile: {
  width: "100%",
  minHeight: "155px",
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  borderRadius: "18px",
  padding: "16px 18px",
  textAlign: "left",
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  gap: "14px",
  overflow: "hidden",
},

tileContent: {
  width: "100%",
  minWidth: 0,
  textAlign: "left",
  overflow: "hidden",
},

tileMainTaskTitle: {
  margin: "0 0 7px",
  color: "#111827",
  fontSize: "15px",
  fontWeight: 900,
  lineHeight: 1.22,
  textAlign: "left",
  wordBreak: "break-word",
  overflow: "hidden",
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
},

tileProjectName: {
  margin: 0,
  color: "#64748b",
  fontSize: "13px",
  fontWeight: 800,
  lineHeight: 1.25,
  textAlign: "left",
  wordBreak: "break-word",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
},

tileBottomRow: {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  marginTop: "auto",
},

tileSubtaskText: {
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: 900,
  textAlign: "left",
  lineHeight: 1.2,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: "210px",
},

tileAvatarGroup: {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "5px",
  flexWrap: "nowrap",
  flexShrink: 0,
  marginLeft: "auto",
},

tileAvatar: {
  width: "28px",
  height: "28px",
  borderRadius: "8px",
  background: "#ff5733",
  color: "#ffffff",
  display: "grid",
  placeItems: "center",
  fontSize: "11px",
  fontWeight: 900,
  boxShadow: "0 8px 18px rgba(255, 87, 51, 0.22)",
},

tileNoEmployee: {
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  border: "2px solid #ffb7a7",
  color: "#ff5733",
  display: "grid",
  placeItems: "center",
  fontSize: "11px",
  fontWeight: 900,
},

  emptyBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: "16px",
    padding: "24px",
    textAlign: "center",
    color: "#94a3b8",
    fontWeight: 900,
    background: "#f8fafc",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.68)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "34px",
  },

  modal: {
    position: "relative",
    width: "min(1240px, 96vw)",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: "26px",
    padding: "34px",
    boxShadow: "0 26px 70px rgba(15, 23, 42, 0.3)",
  },

  closeButton: {
    position: "sticky",
    top: "0px",
    float: "right",
    width: "42px",
    height: "42px",
    border: "none",
    background: "transparent",
    color: "#111827",
    fontSize: "34px",
    lineHeight: "34px",
    cursor: "pointer",
    zIndex: 20,
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    borderBottom: "1px solid #eef2f7",
    paddingBottom: "22px",
    marginBottom: "22px",
  },

  modalTitle: {
    margin: "0 0 10px",
    color: "#111827",
    fontSize: "34px",
    fontWeight: 900,
    paddingRight: "50px",
  },

  modalSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "16px",
  },

  modalStatus: {
    background: "#eef2ff",
    color: "#334155",
    borderRadius: "999px",
    padding: "10px 14px",
    fontSize: "14px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "16px",
    marginBottom: "22px",
  },

  infoBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "18px",
    minHeight: "96px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "8px",
  },

  modalProgressBox: {
    background: "#fff7f5",
    border: "1px solid #fecaca",
    borderRadius: "18px",
    padding: "18px",
    marginBottom: "24px",
  },

  modalProgressTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "12px",
  },

  progressTrack: {
    width: "100%",
    height: "8px",
    background: "#ffd5cc",
    borderRadius: "999px",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    background: "#ff5733",
    borderRadius: "999px",
  },

  modalSection: {
    marginTop: "26px",
  },

  modalSectionTitle: {
    color: "#111827",
    fontSize: "25px",
    fontWeight: 900,
    margin: "0 0 16px",
  },

  assigneeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },

  assigneeCard: {
    display: "grid",
    gridTemplateColumns: "54px 1fr",
    gap: "14px",
    alignItems: "center",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "16px",
    background: "#ffffff",
  },

  avatar: {
    width: "54px",
    height: "54px",
    borderRadius: "16px",
    background: "#ff5733",
    color: "#ffffff",
    display: "grid",
    placeItems: "center",
    fontSize: "18px",
    fontWeight: 900,
  },

  assigneeName: {
    margin: "0 0 5px",
    color: "#111827",
    fontSize: "16px",
    fontWeight: 900,
  },

  assigneeEmail: {
    margin: "0 0 5px",
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  assigneeMeta: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 800,
  },

  employeeTaskList: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },

  employeeTaskCard: {
    border: "1px solid #e5e7eb",
    borderRadius: "20px",
    padding: "18px",
    background: "#ffffff",
  },

  employeeTaskTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    marginBottom: "16px",
  },

  employeeIdentity: {
    display: "grid",
    gridTemplateColumns: "54px 1fr",
    gap: "14px",
    alignItems: "center",
  },

  employeeProgressNumber: {
    color: "#ff5733",
    fontSize: "22px",
    fontWeight: 900,
  },

  subtaskCount: {
    margin: "10px 0 14px",
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 900,
  },

  subtaskList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  subtaskRow: {
    display: "grid",
    gridTemplateColumns: "18px 1fr",
    gap: "12px",
    alignItems: "flex-start",
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "12px",
  },

  pendingDot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    background: "#cbd5e1",
    marginTop: "5px",
  },

  doneDot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    background: "#22c55e",
    marginTop: "5px",
  },

  subtaskTitle: {
    color: "#111827",
    fontSize: "14px",
    fontWeight: 900,
  },

  subtaskMeta: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 700,
  },

  noSubtasks: {
    border: "1px dashed #cbd5e1",
    borderRadius: "14px",
    padding: "14px",
    color: "#94a3b8",
    fontWeight: 900,
    background: "#f8fafc",
  },
};

export default AdminTasks;
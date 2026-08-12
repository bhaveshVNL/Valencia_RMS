import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import AdminDepartmentMiniTasks from "../../components/MiniTasks/AdminDepartmentMiniTasks";

const formatDate = (dateValue) => {
  if (!dateValue) return "-";
  return String(dateValue).slice(0, 10);
};

const normalizeStatus = (status) => {
  const value = String(status || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

  if (
    value === "todo" ||
    value === "to_do" ||
    value === "pending" ||
    value === "not_started" ||
    value === "not-started"
  ) {
    return "todo";
  }

  if (
    value === "in_progress" ||
    value === "progress" ||
    value === "ongoing"
  ) {
    return "in_progress";
  }

  if (value === "under_review" || value === "review") {
    return "under_review";
  }

  if (
    value === "done" ||
    value === "completed" ||
    value === "complete"
  ) {
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
    normalizeStatus(task.status_group || task.status)
  );

  if (statuses.includes("rejected")) {
    return {
      status_group: "rejected",
      status_label: "Rejected",
    };
  }

  if (statuses.includes("under_review")) {
    return {
      status_group: "under_review",
      status_label: "Under Review",
    };
  }

  if (statuses.includes("in_progress")) {
    return {
      status_group: "in_progress",
      status_label: "In Progress",
    };
  }

  if (statuses.includes("on_hold")) {
    return {
      status_group: "on_hold",
      status_label: "On Hold",
    };
  }

  const allDone =
    tasks.length > 0 &&
    statuses.every((status) => normalizeStatus(status) === "done");

  if (allDone) {
    return {
      status_group: "done",
      status_label: "Done",
    };
  }

  return {
    status_group: "todo",
    status_label: "To Do",
  };
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

    if (!map.has(String(id))) {
      map.set(String(id), user);
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
    const name =
      assignee.assigned_name ||
      assignee.full_name ||
      "Employee";

    const email =
      assignee.assigned_email ||
      assignee.email ||
      "";

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

  const [reviewRemark, setReviewRemark] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        "/admin-tasks/department-tasks"
      );

      setTasks(response.data?.tasks || []);
      setAdmin(response.data?.admin || null);
    } catch (err) {
      console.error(
        "Fetch admin department tasks error:",
        err
      );

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

  const openTaskDetails = (task) => {
    setSelectedTask(task);
    setReviewRemark("");
    setReviewError("");
  };

  const closeTaskDetails = () => {
    setSelectedTask(null);
    setReviewRemark("");
    setReviewError("");
  };

  const reviewSelectedTask = async (action) => {
    if (!selectedTask) return;

    const taskIds = [
      ...new Set(
        (selectedTask.main_task_assignees || [])
          .map((assignee) => Number(assignee.task_id))
          .filter(Boolean)
      ),
    ];

    if (!taskIds.length) {
      setReviewError(
        "No task IDs were found for this main task."
      );
      return;
    }

    if (
      (action === "reject" || action === "on_hold") &&
      !reviewRemark.trim()
    ) {
      setReviewError(
        action === "reject"
          ? "Please add a remark before rejecting the task."
          : "Please add a remark before putting the task on hold."
      );
      return;
    }

    try {
      setReviewLoading(true);
      setReviewError("");

      await api.post("/admin-tasks/review", {
        task_ids: taskIds,
        action,
        remark: reviewRemark.trim(),
      });

      closeTaskDetails();
      await fetchTasks();
    } catch (err) {
      setReviewError(
        err?.response?.data?.sqlMessage ||
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to review task."
      );
    } finally {
      setReviewLoading(false);
    }
  };

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
          project_title:
            task.project_title || "Untitled Project",

          task_title:
            task.task_title || "Untitled Main Task",

          task_description:
            task.task_description ||
            task.project_description ||
            "No task description added.",

          project_start_date:
            task.project_start_date ||
            task.start_date,

          project_end_date:
            task.project_end_date ||
            task.due_date ||
            task.end_date,

          created_by_name: task.created_by_name,

          tasks: [],
          main_task_assignees: [],

          project_assignees: dedupeUsers(
            task.project_assignees || []
          ),

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

      mainTask.total_progress += Number(
        task.progress || 0
      );

      mainTask.total_subtasks += Number(
        task.total_subtasks || 0
      );

      mainTask.completed_subtasks += Number(
        task.completed_subtasks || 0
      );

      mainTask.project_assignees = dedupeUsers([
        ...mainTask.project_assignees,
        ...(task.project_assignees || []),
      ]);

      mainTask.main_task_assignees.push({
        task_id: task.task_id,

        assigned_user_id:
          task.assigned_user_id,

        assigned_name:
          task.assigned_name,

        assigned_email:
          task.assigned_email,

        assigned_employee_code:
          task.assigned_employee_code,

        assigned_designation:
          task.assigned_designation,

        assigned_department_name:
          task.assigned_department_name,

        status_group: normalizeStatus(
          task.status_group || task.status
        ),

        status_label:
          task.status_label ||
          getTaskStatus([task]).status_label,

        progress: Number(task.progress || 0),

        completed_subtasks: Number(
          task.completed_subtasks || 0
        ),

        total_subtasks: Number(
          task.total_subtasks || 0
        ),

        subtasks: task.subtasks || [],
      });

      if (
        task.is_rejected ||
        normalizeStatus(
          task.status_group || task.status
        ) === "rejected"
      ) {
        mainTask.is_rejected = true;
        mainTask.rejection_reason =
          task.rejection_reason || "";
        mainTask.rejected_at =
          task.rejected_at || "";
        mainTask.rejection_expires_at =
          task.rejection_expires_at || "";
      }
    });

    return Array.from(map.values())
      .map((mainTask) => {
        const status = getTaskStatus(
          mainTask.tasks
        );

        const averageProgress =
          mainTask.tasks.length > 0
            ? Math.round(
                mainTask.total_progress /
                  mainTask.tasks.length
              )
            : 0;

        const projectAssignedNames =
          mainTask.project_assignees
            .map(
              (assignee) =>
                assignee.full_name ||
                assignee.assigned_name
            )
            .filter(Boolean)
            .join(", ") || "-";

        const projectAssignedEmails =
          mainTask.project_assignees
            .map(
              (assignee) =>
                assignee.email ||
                assignee.assigned_email
            )
            .filter(Boolean)
            .join(", ") || "-";

        const mainTaskAssignedNames =
          mainTask.main_task_assignees
            .map(
              (assignee) =>
                assignee.assigned_name
            )
            .filter(Boolean)
            .join(", ") || "-";

        return {
          ...mainTask,
          ...status,

          progress: averageProgress,

          project_assigned_names:
            projectAssignedNames,

          project_assigned_emails:
            projectAssignedEmails,

          main_task_assigned_names:
            mainTaskAssignedNames,
        };
      })
      .sort((a, b) => {
        const statusDifference =
          getStatusPriority(b.status_group) -
          getStatusPriority(a.status_group);

        if (statusDifference !== 0) {
          return statusDifference;
        }

        return (
          Number(b.project_id || 0) -
          Number(a.project_id || 0)
        );
      });
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const term = searchTerm
      .toLowerCase()
      .trim();

    return groupedMainTasks.filter((task) => {
      const matchesFilter =
        activeFilter === "all" ||
        task.status_group === activeFilter;

      const matchesSearch =
        !term ||
        String(task.project_title || "")
          .toLowerCase()
          .includes(term) ||
        String(task.task_title || "")
          .toLowerCase()
          .includes(term) ||
        String(task.task_description || "")
          .toLowerCase()
          .includes(term) ||
        String(task.created_by_name || "")
          .toLowerCase()
          .includes(term) ||
        String(task.status_label || "")
          .toLowerCase()
          .includes(term) ||
        String(task.project_assigned_names || "")
          .toLowerCase()
          .includes(term) ||
        String(task.project_assigned_emails || "")
          .toLowerCase()
          .includes(term) ||
        String(task.main_task_assigned_names || "")
          .toLowerCase()
          .includes(term);

      return matchesFilter && matchesSearch;
    });
  }, [
    groupedMainTasks,
    activeFilter,
    searchTerm,
  ]);

  const kanbanColumns = [
    {
      key: "todo",
      title: "To Do",
      subtitle: "Not started",
      tasks: filteredTasks.filter(
        (task) =>
          normalizeStatus(task.status_group) ===
          "todo"
      ),
    },
    {
      key: "in_progress",
      title: "In Progress",
      subtitle: "Work started",
      tasks: filteredTasks.filter(
        (task) =>
          normalizeStatus(task.status_group) ===
          "in_progress"
      ),
    },
    {
      key: "under_review",
      title: "Under Review",
      subtitle: "Waiting review",
      tasks: filteredTasks.filter(
        (task) =>
          normalizeStatus(task.status_group) ===
          "under_review"
      ),
    },
    {
      key: "done",
      title: "Done",
      subtitle: "Completed",
      tasks: filteredTasks.filter(
        (task) =>
          normalizeStatus(task.status_group) ===
          "done"
      ),
    },
    {
      key: "rejected",
      title: "Rejected",
      subtitle: "Rejected tasks",
      tasks: filteredTasks.filter(
        (task) =>
          normalizeStatus(task.status_group) ===
          "rejected"
      ),
    },
    {
      key: "on_hold",
      title: "On Hold",
      subtitle: "Paused",
      tasks: filteredTasks.filter(
        (task) =>
          normalizeStatus(task.status_group) ===
          "on_hold"
      ),
    },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.topActions}>
        <button
          type="button"
          style={styles.refreshButton}
          onClick={fetchTasks}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div style={styles.errorBox}>
          {error}
        </div>
      )}

      <input
        style={styles.searchInput}
        type="text"
        placeholder="Search by project, task, employee, email, code, designation..."
        value={searchTerm}
        onChange={(event) =>
          setSearchTerm(event.target.value)
        }
      />

      <section style={styles.kanbanSection}>
        <div style={styles.kanbanHeader}>
          <h2 style={styles.kanbanTitle}>
            Tasks Kanban
          </h2>

          <p style={styles.kanbanSubtitle}>
            Three columns are visible at a
            time. Scroll horizontally to view
            the remaining task statuses.
          </p>
        </div>

        {loading ? (
          <div style={styles.messageBox}>
            Loading department tasks...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div style={styles.messageBox}>
            No tasks found.
          </div>
        ) : (
          <div style={styles.kanbanViewport}>
            <div style={styles.kanbanScroll}>
              <div style={styles.kanbanBoard}>
                {kanbanColumns.map((column) => (
                  <div
                    style={styles.kanbanColumn}
                    key={column.key}
                  >
                    <div style={styles.columnHeader}>
                      <div>
                        <h3 style={styles.columnTitle}>
                          {column.title}
                        </h3>

                        <p
                          style={
                            styles.columnSubtitle
                          }
                        >
                          {column.subtitle}
                        </p>
                      </div>

                      <span
                        style={styles.columnCount}
                      >
                        {column.tasks.length}
                      </span>
                    </div>

                    <div style={styles.columnBody}>
                      {column.tasks.length ===
                      0 ? (
                        <div
                          style={styles.emptyBox}
                        >
                          No tasks here.
                        </div>
                      ) : (
                        column.tasks.map(
                          (task) => (
                            <button
                              type="button"
                              key={
                                task.main_task_key
                              }
                              style={
                                styles.taskTile
                              }
                              onClick={() =>
                                openTaskDetails(
                                  task
                                )
                              }
                            >
                              <div
                                style={
                                  styles.tileContent
                                }
                              >
                                <h3
                                  style={
                                    styles.tileMainTaskTitle
                                  }
                                >
                                  {
                                    task.task_title
                                  }
                                </h3>

                                <p
                                  style={
                                    styles.tileProjectName
                                  }
                                >
                                  {
                                    task.project_title
                                  }
                                </p>
                              </div>

                              <div
                                style={
                                  styles.tileBottomRow
                                }
                              >
                                <span
                                  style={
                                    styles.tileSubtaskText
                                  }
                                >
                                  {
                                    task.completed_subtasks
                                  }
                                  /
                                  {
                                    task.total_subtasks
                                  }{" "}
                                  subtasks done
                                </span>

                                <div
                                  style={
                                    styles.tileAvatarGroup
                                  }
                                >
                                  {getEmployeeInitials(task.main_task_assignees)
                                    .slice(0, 3)
                                    .map((employee) => (
                                      <span
                                      key={employee.id}
                                      style={styles.tileAvatar}
                                      title={employee.name}
                                    >
                                      {employee.initial}
                                         </span>
                                  ))}
    
  
 
                                </div>
                              </div>
                            </button>
                          )
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <div style={styles.miniTasksGap}>
        <AdminDepartmentMiniTasks />
      </div>

      {selectedTask && (
        <div
          style={styles.modalOverlay}
          onClick={closeTaskDetails}
        >
          <div
            style={styles.modal}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              style={styles.closeButton}
              onClick={closeTaskDetails}
            >
              ×
            </button>

            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  {selectedTask.task_title}
                </h2>

                <p
                  style={styles.modalSubtitle}
                >
                  Project:{" "}
                  <strong>
                    {selectedTask.project_title ||
                      "-"}
                  </strong>
                </p>
              </div>

              <span style={styles.modalStatus}>
                {selectedTask.status_label ||
                  getStatusLabel(
                    selectedTask.status_group
                  )}
              </span>
            </div>

            <div style={styles.infoGrid}>
              <div style={styles.infoBox}>
                <span>Project Dates</span>
                <strong>
                  {formatDate(
                    selectedTask.project_start_date
                  )}{" "}
                  to{" "}
                  {formatDate(
                    selectedTask.project_end_date
                  )}
                </strong>
              </div>

              <div style={styles.infoBox}>
                <span>Created By</span>
                <strong>
                  {selectedTask.created_by_name ||
                    "-"}
                </strong>
              </div>

              <div style={styles.infoBox}>
                <span>
                  Total Project Assignees
                </span>
                <strong>
                  {
                    selectedTask
                      .project_assignees
                      .length
                  }
                </strong>
              </div>

              <div style={styles.infoBox}>
                <span>
                  Main Task Progress
                </span>
                <strong>
                  {selectedTask.progress || 0}%
                </strong>
              </div>
            </div>

            <div
              style={styles.modalProgressBox}
            >
              <div
                style={styles.modalProgressTop}
              >
                <strong>
                  Overall Main Task Progress
                </strong>

                <b>
                  {selectedTask.progress || 0}%
                </b>
              </div>

              <div
                style={styles.progressTrack}
              >
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${
                      selectedTask.progress ||
                      0
                    }%`,
                  }}
                />
              </div>
            </div>

            {normalizeStatus(
              selectedTask.status_group
            ) === "under_review" && (
              <section
                style={styles.reviewSection}
              >
                <h3
                  style={styles.reviewTitle}
                >
                  Task Review
                </h3>

                <p
                  style={styles.reviewSubtitle}
                >
                  Approve this task, place
                  it on hold, or reject it
                  and send it back to the
                  employee's To Do section.
                </p>

                {reviewError && (
                  <div
                    style={
                      styles.reviewErrorBox
                    }
                  >
                    {reviewError}
                  </div>
                )}

                <label
                  style={styles.reviewField}
                >
                  <span>Remark</span>

                  <textarea
                    style={
                      styles.reviewTextarea
                    }
                    value={reviewRemark}
                    onChange={(event) =>
                      setReviewRemark(
                        event.target.value
                      )
                    }
                    placeholder="Add review remark..."
                    disabled={reviewLoading}
                  />
                </label>

                <div
                  style={styles.reviewButtons}
                >
                  <button
                    type="button"
                    style={
                      styles.approveButton
                    }
                    disabled={reviewLoading}
                    onClick={() =>
                      reviewSelectedTask(
                        "approve"
                      )
                    }
                  >
                    {reviewLoading
                      ? "Processing..."
                      : "Approve"}
                  </button>

                  <button
                    type="button"
                    style={styles.holdButton}
                    disabled={reviewLoading}
                    onClick={() =>
                      reviewSelectedTask(
                        "on_hold"
                      )
                    }
                  >
                    On Hold
                  </button>

                  <button
                    type="button"
                    style={styles.rejectButton}
                    disabled={reviewLoading}
                    onClick={() =>
                      reviewSelectedTask(
                        "reject"
                      )
                    }
                  >
                    Reject
                  </button>
                </div>
              </section>
            )}

            <section style={styles.modalSection}>
              <h3
                style={styles.modalSectionTitle}
              >
                Project Assignees
              </h3>

              {selectedTask.project_assignees
                .length === 0 ? (
                <div style={styles.emptyBox}>
                  No project assignees found.
                </div>
              ) : (
                <div
                  style={styles.assigneeGrid}
                >
                  {selectedTask.project_assignees.map(
                    (assignee) => (
                      <div
                        style={
                          styles.assigneeCard
                        }
                        key={
                          assignee.user_id ||
                          assignee.assigned_user_id ||
                          assignee.email
                        }
                      >
                        <div
                          style={styles.avatar}
                        >
                          {getInitial(
                            assignee.full_name ||
                              assignee.assigned_name
                          )}
                        </div>

                        <div>
                          <h4
                            style={
                              styles.assigneeName
                            }
                          >
                            {assignee.full_name ||
                              assignee.assigned_name ||
                              "-"}
                          </h4>

                          <p
                            style={
                              styles.assigneeEmail
                            }
                          >
                            {assignee.email ||
                              assignee.assigned_email ||
                              "-"}
                          </p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>

            <section style={styles.modalSection}>
              <h3
                style={styles.modalSectionTitle}
              >
                Employee-wise Main Task
                Subtasks
              </h3>

              <div
                style={
                  styles.employeeTaskList
                }
              >
                {selectedTask.main_task_assignees.map(
                  (assignee) => (
                    <div
                      style={
                        styles.employeeTaskCard
                      }
                      key={assignee.task_id}
                    >
                      <div
                        style={
                          styles.employeeTaskTop
                        }
                      >
                        <div
                          style={
                            styles.employeeIdentity
                          }
                        >
                          <div
                            style={
                              styles.avatar
                            }
                          >
                            {getInitial(
                              assignee.assigned_name
                            )}
                          </div>

                          <div>
                            <h4
                              style={
                                styles.assigneeName
                              }
                            >
                              {assignee.assigned_name ||
                                "-"}
                            </h4>

                            <p
                              style={
                                styles.assigneeEmail
                              }
                            >
                              {assignee.assigned_email ||
                                "-"}
                            </p>
                          </div>
                        </div>

                        <strong
                          style={
                            styles.employeeProgressNumber
                          }
                        >
                          {assignee.progress ||
                            0}
                          %
                        </strong>
                      </div>

                      <div
                        style={
                          styles.progressTrack
                        }
                      >
                        <div
                          style={{
                            ...styles.progressFill,
                            width: `${
                              assignee.progress ||
                              0
                            }%`,
                          }}
                        />
                      </div>

                      <p
                        style={styles.subtaskCount}
                      >
                        {
                          assignee.completed_subtasks
                        }
                        /
                        {
                          assignee.total_subtasks
                        }{" "}
                        subtasks done
                      </p>

                      <div
                        style={
                          styles.subtaskList
                        }
                      >
                        {assignee.subtasks &&
                        assignee.subtasks.length >
                          0 ? (
                          assignee.subtasks.map(
                            (subtask) => (
                              <div
                                style={
                                  styles.subtaskRow
                                }
                                key={
                                  subtask.subtask_key ||
                                  `${assignee.task_id}-${subtask.subtask_id}`
                                }
                              >
                                <span
                                  style={
                                    normalizeStatus(
                                      subtask.status
                                    ) ===
                                    "done"
                                      ? styles.doneDot
                                      : styles.pendingDot
                                  }
                                />

                                <div>
                                  <strong
                                    style={
                                      styles.subtaskTitle
                                    }
                                  >
                                    {
                                      subtask.title
                                    }
                                  </strong>

                                  <p
                                    style={
                                      styles.subtaskMeta
                                    }
                                  >
                                    {formatDate(
                                      subtask.start_date
                                    )}{" "}
                                    to{" "}
                                    {formatDate(
                                      subtask.end_date
                                    )}{" "}
                                    ·{" "}
                                    {getStatusLabel(
                                      subtask.status
                                    )}
                                  </p>
                                </div>
                              </div>
                            )
                          )
                        ) : (
                          <div
                            style={
                              styles.noSubtasks
                            }
                          >
                            No subtasks added by{" "}
                            {assignee.assigned_name ||
                              "employee"}
                            .
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
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
    paddingBottom: "32px",
  },

  topActions: {
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: "14px",
  },

  refreshButton: {
    border: "none",
    borderRadius: "12px",
    background: "#ff5733",
    color: "#ffffff",
    padding: "12px 20px",
    fontWeight: 900,
    cursor: "pointer",
  },

  errorBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#b91c1c",
    padding: "14px",
    borderRadius: "14px",
    marginBottom: "14px",
    fontWeight: 800,
  },

  searchInput: {
    width: "100%",
    height: "52px",
    border: "1px solid #d8dee7",
    borderRadius: "14px",
    padding: "0 18px",
    fontSize: "14px",
    fontWeight: 700,
    outline: "none",
    marginBottom: "20px",
    boxSizing: "border-box",
  },

  kanbanSection: {
    width: "100%",
    background: "#ffffff",
    borderRadius: "22px",
    padding: "22px",
    border: "1px solid #edf0f4",
    boxShadow:
      "0 8px 26px rgba(15, 23, 42, 0.045)",
    boxSizing: "border-box",
  },

  kanbanHeader: {
    marginBottom: "18px",
  },

  kanbanTitle: {
    margin: "0 0 6px",
    fontSize: "27px",
    fontWeight: 900,
    color: "#111827",
  },

  kanbanSubtitle: {
    margin: 0,
    fontSize: "13px",
    color: "#64748b",
  },

  kanbanViewport: {
    width: "100%",
    overflow: "hidden",
  },

  kanbanScroll: {
    width: "100%",
    overflowX: "auto",
    overflowY: "hidden",
    paddingBottom: "12px",
    position: "relative",
  },

  kanbanBoard: {
    display: "grid",
    gridTemplateColumns:
      "repeat(6, 420px)",
    gap: "18px",
    width: "max-content",
    position: "relative",
  },

  kanbanColumn: {
    width: "420px",
    boxSizing: "border-box",
    border: "1px solid #e5e9ef",
    borderRadius: "18px",
    padding: "14px",
    minHeight: "480px",
    background: "#fbfcfe",
  },

  columnHeader: {
    background: "#f5f7fa",
    borderRadius: "14px",
    padding: "14px 16px",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "14px",
  },

  columnTitle: {
    margin: "0 0 5px",
    fontSize: "18px",
    fontWeight: 900,
    color: "#111827",
  },

  columnSubtitle: {
    margin: 0,
    fontSize: "12px",
    color: "#718096",
  },

  columnCount: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    background: "#e7ebf0",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
  },

  columnBody: {
    display: "flex",
    flexDirection: "column",
    gap: "11px",
    maxHeight: "460px",
    overflowY: "auto",
    paddingRight: "4px",
  },

  taskTile: {
  width: "100%",
  minHeight: "120px",
  boxSizing: "border-box",
  border: "1px solid #e4e8ee",
  background: "#ffffff",
  borderRadius: "14px",
  padding: "14px",
  textAlign: "left",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  alignItems: "stretch",
  gap: "12px",
  position: "relative",
  zIndex: 2,
  pointerEvents: "auto",
  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.035)",
},


  tileContent: {
  width: "100%",
  minWidth: 0,
  textAlign: "left",
  alignSelf: "stretch",
},

  tileMainTaskTitle: {
  margin: "0 0 6px",
  fontSize: "14px",
  fontWeight: 900,
  color: "#111827",
  lineHeight: 1.3,
  textAlign: "left",
  width: "100%",
  wordBreak: "break-word",
},


  tileProjectName: {
  margin: 0,
  fontSize: "12px",
  color: "#64748b",
  fontWeight: 700,
  textAlign: "left",
  width: "100%",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
},


 tileBottomRow: {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
  marginTop: "auto",
},
  tileSubtaskText: {
  fontSize: "10px",
  color: "#94a3b8",
  fontWeight: 800,
  textAlign: "left",
  flex: 1,
},

  tileAvatarGroup: {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "4px",
  flexShrink: 0,
  marginLeft: "auto",
},


  tileAvatar: {
  width: "25px",
  height: "25px",
  borderRadius: "7px",
  background: "#ff5733",
  color: "#ffffff",
  display: "grid",
  placeItems: "center",
  fontSize: "10px",
  fontWeight: 900,
  flexShrink: 0,
},

  messageBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: "16px",
    padding: "30px",
    textAlign: "center",
    color: "#94a3b8",
    fontWeight: 800,
  },

  emptyBox: {
    border: "1px dashed #d5dce5",
    borderRadius: "14px",
    padding: "22px",
    textAlign: "center",
    color: "#9aa7b5",
    fontWeight: 800,
    background: "#ffffff",
  },

  miniTasksGap: {
    marginTop: "32px",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background:
      "rgba(15, 23, 42, 0.68)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "28px",
  },

  modal: {
    position: "relative",
    width: "min(1150px, 95vw)",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: "24px",
    padding: "30px",
    boxSizing: "border-box",
    boxShadow:
      "0 28px 80px rgba(15, 23, 42, 0.32)",
  },

  closeButton: {
    position: "absolute",
    top: "18px",
    right: "18px",
    width: "42px",
    height: "42px",
    border: "none",
    borderRadius: "12px",
    background: "#f8fafc",
    color: "#111827",
    fontSize: "28px",
    cursor: "pointer",
    zIndex: 20,
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    paddingRight: "60px",
    paddingBottom: "20px",
    borderBottom: "1px solid #edf0f4",
    marginBottom: "20px",
  },

  modalTitle: {
    margin: "0 0 8px",
    fontSize: "30px",
    lineHeight: 1.25,
    fontWeight: 900,
    color: "#111827",
  },

  modalSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "14px",
  },

  modalStatus: {
    background: "#eef2ff",
    color: "#334155",
    borderRadius: "999px",
    padding: "9px 14px",
    fontSize: "13px",
    fontWeight: 900,
    whiteSpace: "nowrap",
    flexShrink: 0,
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: "14px",
    marginBottom: "20px",
  },

  infoBox: {
    minHeight: "90px",
    boxSizing: "border-box",
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "7px",
  },

  modalProgressBox: {
    background: "#fff7f5",
    border: "1px solid #fecaca",
    borderRadius: "16px",
    padding: "16px",
    marginBottom: "22px",
  },

  modalProgressTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    marginBottom: "10px",
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

  reviewSection: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "18px",
    marginBottom: "22px",
  },

  reviewTitle: {
    margin: "0 0 6px",
    fontSize: "21px",
    fontWeight: 900,
  },

  reviewSubtitle: {
    margin: "0 0 14px",
    color: "#64748b",
    fontSize: "13px",
  },

  reviewErrorBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#b91c1c",
    borderRadius: "12px",
    padding: "11px 13px",
    marginBottom: "12px",
    fontWeight: 800,
  },

  reviewField: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    fontWeight: 900,
    marginBottom: "14px",
  },

  reviewTextarea: {
    width: "100%",
    minHeight: "110px",
    resize: "vertical",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: "14px",
    padding: "13px",
    outline: "none",
  },

  reviewButtons: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },

  approveButton: {
    border: "none",
    borderRadius: "12px",
    background: "#16a34a",
    color: "#ffffff",
    padding: "12px 18px",
    fontWeight: 900,
    cursor: "pointer",
  },

  holdButton: {
    border: "none",
    borderRadius: "12px",
    background: "#111827",
    color: "#ffffff",
    padding: "12px 18px",
    fontWeight: 900,
    cursor: "pointer",
  },

  rejectButton: {
    border: "none",
    borderRadius: "12px",
    background: "#dc2626",
    color: "#ffffff",
    padding: "12px 18px",
    fontWeight: 900,
    cursor: "pointer",
  },

  modalSection: {
    marginTop: "24px",
  },

  modalSectionTitle: {
    margin: "0 0 14px",
    fontSize: "22px",
    color: "#111827",
    fontWeight: 900,
  },

  assigneeGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },

  assigneeCard: {
    display: "grid",
    gridTemplateColumns: "50px 1fr",
    gap: "12px",
    alignItems: "center",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "14px",
    background: "#ffffff",
  },

  avatar: {
    width: "50px",
    height: "50px",
    borderRadius: "14px",
    background: "#ff5733",
    color: "#ffffff",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
  },

  assigneeName: {
    margin: "0 0 4px",
    fontWeight: 900,
    color: "#111827",
  },

  assigneeEmail: {
    margin: 0,
    color: "#64748b",
    fontSize: "12px",
  },

  employeeTaskList: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },

  employeeTaskCard: {
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "16px",
    background: "#ffffff",
  },

  employeeTaskTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
    marginBottom: "14px",
  },

  employeeIdentity: {
    display: "grid",
    gridTemplateColumns: "50px 1fr",
    gap: "12px",
    alignItems: "center",
  },

  employeeProgressNumber: {
    color: "#ff5733",
    fontSize: "20px",
    fontWeight: 900,
  },

  subtaskCount: {
    margin: "9px 0 12px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 800,
  },

  subtaskList: {
    display: "flex",
    flexDirection: "column",
    gap: "9px",
  },

  subtaskRow: {
    display: "grid",
    gridTemplateColumns: "16px 1fr",
    gap: "10px",
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "11px",
  },

  pendingDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "#cbd5e1",
    marginTop: "5px",
  },

  doneDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "#22c55e",
    marginTop: "5px",
  },

  subtaskTitle: {
    fontWeight: 900,
    color: "#111827",
  },

  subtaskMeta: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: "11px",
  },

  noSubtasks: {
    border: "1px dashed #cbd5e1",
    borderRadius: "12px",
    padding: "12px",
    color: "#94a3b8",
    fontWeight: 800,
    background: "#f8fafc",
  },
};

export default AdminTasks;
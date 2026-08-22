import React, { useEffect, useMemo, useState } from "react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";
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
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (
    [
      "",
      "todo",
      "to_do",
      "pending",
      "not_started",
    ].includes(value)
  ) {
    return "todo";
  }

  if (
    [
      "in_progress",
      "progress",
      "ongoing",
    ].includes(value)
  ) {
    return "in_progress";
  }

  if (
    [
      "under_review",
      "review",
      "pending_review",
    ].includes(value)
  ) {
    return "under_review";
  }

  if (
    [
      "done",
      "completed",
      "complete",
    ].includes(value)
  ) {
    return "done";
  }

  if (
    [
      "rejected",
      "reject",
    ].includes(value)
  ) {
    return "rejected";
  }

  if (
    [
      "on_hold",
      "hold",
    ].includes(value)
  ) {
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
  return (Array.isArray(assignees) ? assignees : []).map(
    (assignee) => {
      const name =
        assignee.full_name ||
        assignee.assigned_name ||
        "Employee";

      const email =
        assignee.email ||
        assignee.assigned_email ||
        "";

      return {
        id:
          assignee.employee_id ||
          assignee.user_id ||
          assignee.assigned_user_id ||
          email,

        name,
        email,
        initial: getInitial(name),
      };
    }
  );
};

const isSubtaskDone = (subtask) => {
  return (
    Number(subtask?.is_checked || 0) === 1 ||
    normalizeStatus(subtask?.status) === "done"
  );
};

const AdminTasks = () => {
  const location =
  useLocation();

const navigate =
  useNavigate();

const requestedTaskId =
  Number(
    location.state?.openTaskId ||
      0
  );
  const [tasks, setTasks] = useState([]);
  const [admin, setAdmin] = useState(null);

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

      setTasks(
        Array.isArray(response.data?.tasks)
          ? response.data.tasks
          : []
      );

      setAdmin(
        response.data?.admin ||
          null
      );
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

  /*
  ========================================================
  ADMIN REVIEW

  ONE shared Main Task = ONE task_id.

  Approve
  -> Done

  To Do
  -> send back to Employee To Do

  In Progress
  -> send back to Employee In Progress

  On Hold
  -> On Hold

  Reject
  -> Rejected
  ========================================================
  */

  const reviewSelectedTask = async (action) => {
    if (
      !selectedTask ||
      reviewLoading
    ) {
      return;
    }

    setReviewError("");

    const taskId = Number(
      selectedTask.task_id ||
        0
    );

    if (!taskId) {
      setReviewError(
        "Main Task ID was not found."
      );

      return;
    }

    if (
      action !== "approve" &&
      !reviewRemark.trim()
    ) {
      setReviewError(
        "Please add a remark before returning, rejecting, or putting the Main Task on hold."
      );

      return;
    }

    try {
      setReviewLoading(true);

      await api.post(
        "/admin-tasks/review",
        {
          task_ids: [
            taskId,
          ],

          action,

          remark:
            reviewRemark.trim(),
        }
      );

      closeTaskDetails();

      await fetchTasks();
    } catch (err) {
      console.error(
        "Review Main Task error:",
        err
      );

      setReviewError(
        err?.response?.data?.sqlMessage ||
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to review Main Task."
      );
    } finally {
      setReviewLoading(false);
    }
  };

  /*
  ========================================================
  NORMALIZE ONE SHARED MAIN TASK

  We no longer group one copy per employee.

  Backend gives:

  Main Task
  ├── assignees[]
  └── subtasks[]
  ========================================================
  */

  const groupedMainTasks = useMemo(() => {
    return tasks
      .map((task) => {
        const statusGroup =
          normalizeStatus(
            task.status_group ||
              task.status ||
              task.task_status
          );

        const assignees =
          dedupeUsers(
            task.main_task_assignees ||
              task.assignees ||
              []
          );

        const projectAssignees =
          dedupeUsers(
            task.project_assignees ||
              []
          );

        const subtasks =
          Array.isArray(
            task.subtasks
          )
            ? task.subtasks
            : [];

        const completedSubtasks =
          Number(
            task.completed_subtasks ??
              subtasks.filter(
                isSubtaskDone
              ).length
          );

        return {
          ...task,

          task_id:
            task.task_id,

          main_task_key:
            String(
              task.task_id
            ),

          status_group:
            statusGroup,

          status_label:
            task.status_label ||
            getStatusLabel(
              statusGroup
            ),

          progress:
            Number(
              task.progress ||
                0
            ),

          main_task_assignees:
            assignees,

          assignees,

          main_task_assigned_names:
            assignees
              .map(
                (employee) =>
                  employee.full_name ||
                  employee.assigned_name
              )
              .filter(Boolean)
              .join(", ") ||
            "-",

          main_task_assigned_emails:
            assignees
              .map(
                (employee) =>
                  employee.email ||
                  employee.assigned_email
              )
              .filter(Boolean)
              .join(", ") ||
            "-",

          project_assignees:
            projectAssignees,

          project_assigned_names:
            projectAssignees
              .map(
                (employee) =>
                  employee.full_name ||
                  employee.assigned_name
              )
              .filter(Boolean)
              .join(", ") ||
            "-",

          project_assigned_emails:
            projectAssignees
              .map(
                (employee) =>
                  employee.email ||
                  employee.assigned_email
              )
              .filter(Boolean)
              .join(", ") ||
            "-",

          subtasks,

          total_subtasks:
            Number(
              task.total_subtasks ??
                subtasks.length
            ),

          completed_subtasks:
            completedSubtasks,

          is_rejected:
            statusGroup ===
            "rejected",

          rejection_reason:
            task.rejection_reason ||
            task.review_note ||
            "",
        };
      })
      .sort((a, b) => {
        const statusDifference =
          getStatusPriority(
            b.status_group
          ) -
          getStatusPriority(
            a.status_group
          );

        if (
          statusDifference !==
          0
        ) {
          return statusDifference;
        }

        return (
          Number(
            b.task_id || 0
          ) -
          Number(
            a.task_id || 0
          )
        );
      });
  }, [tasks]);

  /*
========================================================
OPEN EXACT MAIN TASK FROM ADMIN OVERVIEW
========================================================
*/

useEffect(() => {
  if (
    !requestedTaskId ||
    loading
  ) {
    return;
  }

  const requestedTask =
    groupedMainTasks.find(
      (task) =>
        Number(
          task.task_id
        ) ===
        requestedTaskId
    );

  if (requestedTask) {
    setSelectedTask(
      requestedTask
    );

    setReviewRemark("");
    setReviewError("");
  }

  /*
  Clear router state after opening it once.

  This prevents the same modal from reopening after
  Approve / Return / Reject / Refresh.
  */
  navigate(
    location.pathname,
    {
      replace: true,
      state: null,
    }
  );
}, [
  requestedTaskId,
  loading,
  groupedMainTasks,
  navigate,
  location.pathname,
]);

  const filteredTasks = useMemo(() => {
    const term =
      searchTerm
        .toLowerCase()
        .trim();

    if (!term) {
      return groupedMainTasks;
    }

    return groupedMainTasks.filter(
      (task) => {
        const searchable = [
          task.project_title,
          task.project_description,
          task.task_title,
          task.task_description,
          task.created_by_name,
          task.status_label,

          task.project_assigned_names,
          task.project_assigned_emails,

          task.main_task_assigned_names,
          task.main_task_assigned_emails,

          ...task.subtasks.map(
            (subtask) =>
              subtask.task_title ||
              subtask.title ||
              ""
          ),
        ]
          .join(" ")
          .toLowerCase();

        return searchable.includes(
          term
        );
      }
    );
  }, [
    groupedMainTasks,
    searchTerm,
  ]);

  const kanbanColumns = [
    {
      key: "todo",
      title: "To Do",
      subtitle: "Not started",

      tasks:
        filteredTasks.filter(
          (task) =>
            normalizeStatus(
              task.status_group
            ) === "todo"
        ),
    },

    {
      key: "in_progress",
      title: "In Progress",
      subtitle: "Work started",

      tasks:
        filteredTasks.filter(
          (task) =>
            normalizeStatus(
              task.status_group
            ) ===
            "in_progress"
        ),
    },

    {
      key: "under_review",
      title: "Under Review",
      subtitle: "Waiting review",

      tasks:
        filteredTasks.filter(
          (task) =>
            normalizeStatus(
              task.status_group
            ) ===
            "under_review"
        ),
    },

    {
      key: "done",
      title: "Done",
      subtitle: "Completed",

      tasks:
        filteredTasks.filter(
          (task) =>
            normalizeStatus(
              task.status_group
            ) === "done"
        ),
    },

    {
      key: "rejected",
      title: "Rejected",
      subtitle: "Rejected tasks",

      tasks:
        filteredTasks.filter(
          (task) =>
            normalizeStatus(
              task.status_group
            ) ===
            "rejected"
        ),
    },

    {
      key: "on_hold",
      title: "On Hold",
      subtitle: "Paused",

      tasks:
        filteredTasks.filter(
          (task) =>
            normalizeStatus(
              task.status_group
            ) ===
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
          disabled={loading}
        >
          {loading
            ? "Refreshing..."
            : "Refresh"}
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
        placeholder="Search by project, Main Task, employee, email, status or Subtask..."
        value={searchTerm}
        onChange={(event) =>
          setSearchTerm(
            event.target.value
          )
        }
      />

      <section style={styles.kanbanSection}>
        <div style={styles.kanbanHeader}>
          <div>
            <h2 style={styles.kanbanTitle}>
              Tasks Kanban
            </h2>

            <p style={styles.kanbanSubtitle}>
              Each tile represents one shared Main Task.
              Employees assigned to the same Main Task
              share the same Subtasks and progress.
            </p>
          </div>

          {admin && (
            <div style={styles.adminInfo}>
              <strong>
                {admin.department_name ||
                  "Department"}
              </strong>

              <span>
                {admin.full_name ||
                  ""}
              </span>
            </div>
          )}
        </div>

{loading ? (
  <div style={styles.messageBox}>
    Loading department tasks...
  </div>
) : (
  <div style={styles.kanbanViewport}>
    <div style={styles.kanbanScroll}>
      <div style={styles.kanbanBoard}>
                {kanbanColumns.map(
                  (column) => (
                    <div
                      style={
                        styles.kanbanColumn
                      }
                      key={column.key}
                    >
                      <div
                        style={
                          styles.columnHeader
                        }
                      >
                        <div>
                          <h3
                            style={
                              styles.columnTitle
                            }
                          >
                            {column.title}
                          </h3>

                          <p
                            style={
                              styles.columnSubtitle
                            }
                          >
                            {
                              column.subtitle
                            }
                          </p>
                        </div>

                        <span
                          style={
                            styles.columnCount
                          }
                        >
                          {
                            column.tasks
                              .length
                          }
                        </span>
                      </div>

                      <div
                        style={
                          styles.columnBody
                        }
                      >
                        {column.tasks
                          .length === 0 ? (
                          <div
                            style={
                              styles.emptyBox
                            }
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
                                    Project:{" "}
                                    {
                                      task.project_title
                                    }
                                  </p>
                                </div>

                                <div
                                  style={
                                    styles.tileProgressRow
                                  }
                                >
                                  <span>
                                    {
                                      task.progress
                                    }
                                    %
                                  </span>

                                  <span>
                                    {
                                      task.completed_subtasks
                                    }
                                    /
                                    {
                                      task.total_subtasks
                                    }{" "}
                                    Subtasks
                                  </span>
                                </div>

                                <div
                                  style={
                                    styles.progressTrack
                                  }
                                >
                                  <div
                                    style={{
                                      ...styles.progressFill,

                                      width: `${Math.min(
                                        100,
                                        Math.max(
                                          0,
                                          Number(
                                            task.progress ||
                                              0
                                          )
                                        )
                                      )}%`,
                                    }}
                                  />
                                </div>

                                <div
                                  style={
                                    styles.tileBottomRow
                                  }
                                >
                                  <span
                                    style={
                                      styles.tileAssigneeText
                                    }
                                  >
                                    {
                                      task.main_task_assigned_names
                                    }
                                  </span>

                                  <div
                                    style={
                                      styles.tileAvatarGroup
                                    }
                                  >
                                    {getEmployeeInitials(
                                      task.main_task_assignees
                                    )
                                      .slice(
                                        0,
                                        3
                                      )
                                      .map(
                                        (
                                          employee
                                        ) => (
                                          <span
                                            key={
                                              employee.id
                                            }
                                            style={
                                              styles.tileAvatar
                                            }
                                            title={
                                              employee.name
                                            }
                                          >
                                            {
                                              employee.initial
                                            }
                                          </span>
                                        )
                                      )}
                                  </div>
                                </div>
                              </button>
                            )
                          )
                        )}
                      </div>
                    </div>
                  )
                )}
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
                <span style={styles.eyebrow}>
                  MAIN TASK
                </span>

                <h2 style={styles.modalTitle}>
                  {
                    selectedTask.task_title
                  }
                </h2>

                <p
                  style={
                    styles.modalSubtitle
                  }
                >
                  Project:{" "}
                  <strong>
                    {selectedTask.project_title ||
                      "-"}
                  </strong>
                </p>
              </div>

              <span
                style={
                  styles.modalStatus
                }
              >
                {selectedTask.status_label ||
                  getStatusLabel(
                    selectedTask.status_group
                  )}
              </span>
            </div>

            <div style={styles.infoGrid}>
              <div style={styles.infoBox}>
                <span>
                  Main Task Dates
                </span>

                <strong>
                  {formatDate(
                    selectedTask.task_start_date
                  )}{" "}
                  to{" "}
                  {formatDate(
                    selectedTask.task_end_date
                  )}
                </strong>
              </div>

              <div style={styles.infoBox}>
                <span>
                  Project Dates
                </span>

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
                <span>
                  Created By
                </span>

                <strong>
                  {selectedTask.created_by_name ||
                    "-"}
                </strong>
              </div>

              <div style={styles.infoBox}>
                <span>
                  Main Task Assignees
                </span>

                <strong>
                  {
                    selectedTask
                      .main_task_assignees
                      .length
                  }
                </strong>
              </div>
            </div>

            <section
              style={
                styles.descriptionSection
              }
            >
              <div
                style={
                  styles.descriptionBox
                }
              >
                <span>
                  Project Description
                </span>

                <p>
                  {selectedTask.project_description ||
                    "-"}
                </p>
              </div>

              <div
                style={
                  styles.descriptionBox
                }
              >
                <span>
                  Main Task Description
                </span>

                <p>
                  {selectedTask.task_description ||
                    "-"}
                </p>
              </div>
            </section>

            <div
              style={
                styles.modalProgressBox
              }
            >
              <div
                style={
                  styles.modalProgressTop
                }
              >
                <strong>
                  Main Task Progress
                </strong>

                <b>
                  {selectedTask.progress ||
                    0}
                  %
                </b>
              </div>

              <div
                style={
                  styles.progressTrack
                }
              >
                <div
                  style={{
                    ...styles.progressFill,

                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        Number(
                          selectedTask.progress ||
                            0
                        )
                      )
                    )}%`,
                  }}
                />
              </div>

              <p
                style={
                  styles.modalProgressText
                }
              >
                {
                  selectedTask.completed_subtasks
                }
                /
                {
                  selectedTask.total_subtasks
                }{" "}
                shared Subtasks completed
              </p>
            </div>

            {normalizeStatus(
              selectedTask.status_group ||
                selectedTask.status
            ) ===
              "under_review" && (
              <section
                style={
                  styles.reviewSection
                }
              >
                <h3
                  style={
                    styles.reviewTitle
                  }
                >
                  Main Task Review
                </h3>

                <p
                  style={
                    styles.reviewSubtitle
                  }
                >
                  Approve the Main Task,
                  return it to To Do or
                  In Progress for rework,
                  place it On Hold, or
                  Reject it.
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
                  style={
                    styles.reviewField
                  }
                >
                  <span>
                    Remark
                  </span>

                  <textarea
                    style={
                      styles.reviewTextarea
                    }
                    value={
                      reviewRemark
                    }
                    onChange={(
                      event
                    ) =>
                      setReviewRemark(
                        event.target
                          .value
                      )
                    }
                    placeholder="Required when returning, rejecting or placing the task on hold..."
                    disabled={
                      reviewLoading
                    }
                  />
                </label>

                <div
  style={
    styles.reviewButtons
  }
>
  <button
    type="button"
    style={
      styles.approveButton
    }
    disabled={
      reviewLoading
    }
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
    style={
      styles.holdButton
    }
    disabled={
      reviewLoading
    }
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
    style={
      styles.rejectButton
    }
    disabled={
      reviewLoading
    }
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

            <section
              style={
                styles.modalSection
              }
            >
              <h3
                style={
                  styles.modalSectionTitle
                }
              >
                Main Task Assignees
              </h3>

              {selectedTask
                .main_task_assignees
                .length === 0 ? (
                <div
                  style={
                    styles.emptyBox
                  }
                >
                  No Main Task
                  assignees found.
                </div>
              ) : (
                <div
                  style={
                    styles.assigneeGrid
                  }
                >
                  {selectedTask.main_task_assignees.map(
                    (assignee) => (
                      <div
                        style={
                          styles.assigneeCard
                        }
                        key={
                          assignee.employee_id ||
                          assignee.user_id ||
                          assignee.assigned_user_id ||
                          assignee.email
                        }
                      >
                        <div
                          style={
                            styles.avatar
                          }
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

                          <p
                            style={
                              styles.assigneeMeta
                            }
                          >
                            {assignee.designation ||
                              assignee.assigned_designation ||
                              "-"}
                          </p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>

            <section
              style={
                styles.modalSection
              }
            >
              <h3
                style={
                  styles.modalSectionTitle
                }
              >
                Shared Main Task Subtasks
              </h3>

              {selectedTask.subtasks
                .length === 0 ? (
                <div
                  style={
                    styles.emptyBox
                  }
                >
                  No Subtasks added
                  under this Main Task.
                </div>
              ) : (
                <div
                  style={
                    styles.subtaskList
                  }
                >
                  {selectedTask.subtasks.map(
                    (subtask) => {
                      const done =
                        isSubtaskDone(
                          subtask
                        );

                      return (
                        <div
                          style={
                            styles.subtaskRow
                          }
                          key={
                            subtask.task_id ||
                            subtask.subtask_id
                          }
                        >
                          <span
                            style={
                              done
                                ? styles.doneDot
                                : styles.pendingDot
                            }
                          />

                          <div
                            style={{
                              minWidth: 0,
                            }}
                          >
                            <strong
                              style={
                                styles.subtaskTitle
                              }
                            >
                              {subtask.task_title ||
                                subtask.title ||
                                "Subtask"}
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
                                subtask.due_date ||
                                  subtask.end_date
                              )}{" "}
                              ·{" "}
                              {getStatusLabel(
                                subtask.status
                              )}
                            </p>

                            {(subtask.task_description ||
                              subtask.description) && (
                              <p
                                style={
                                  styles.subtaskDescription
                                }
                              >
                                {subtask.task_description ||
                                  subtask.description}
                              </p>
                            )}

                            {subtask.created_by_name && (
                              <p
                                style={
                                  styles.subtaskCreator
                                }
                              >
                                Added by{" "}
                                {
                                  subtask.created_by_name
                                }
                              </p>
                            )}
                          </div>

                          <span
                            style={
                              done
                                ? styles.doneBadge
                                : styles.pendingBadge
                            }
                          >
                            {done
                              ? "Done"
                              : getStatusLabel(
                                  subtask.status
                                )}
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </section>

            <section
              style={
                styles.modalSection
              }
            >
              <h3
                style={
                  styles.modalSectionTitle
                }
              >
                Project Assignees
              </h3>

              {selectedTask
                .project_assignees
                .length === 0 ? (
                <div
                  style={
                    styles.emptyBox
                  }
                >
                  No Project assignees
                  found.
                </div>
              ) : (
                <div
                  style={
                    styles.assigneeGrid
                  }
                >
                  {selectedTask.project_assignees.map(
                    (assignee) => (
                      <div
                        style={
                          styles.assigneeCard
                        }
                        key={
                          assignee.employee_id ||
                          assignee.user_id ||
                          assignee.email
                        }
                      >
                        <div
                          style={
                            styles.avatarSecondary
                          }
                        >
                          {getInitial(
                            assignee.full_name
                          )}
                        </div>

                        <div>
                          <h4
                            style={
                              styles.assigneeName
                            }
                          >
                            {assignee.full_name ||
                              "-"}
                          </h4>

                          <p
                            style={
                              styles.assigneeEmail
                            }
                          >
                            {assignee.email ||
                              "-"}
                          </p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
             </section>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.cancelModalButton}
                onClick={closeTaskDetails}
              >
                Cancel
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
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "20px",
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
    lineHeight: 1.5,
  },

  adminInfo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "4px",
    color: "#64748b",
    fontSize: "12px",
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
  },

  kanbanBoard: {
  display: "grid",
  gridTemplateColumns: "repeat(6, calc((100vw - 470px) / 3))",
  gap: "20px",
  width: "max-content",
},

  kanbanColumn: {
  width: "calc((100vw - 470px) / 3)",

  height: "660px",
  minHeight: "660px",
  maxHeight: "660px",

  boxSizing: "border-box",
  border: "1px solid #e5e7eb",
  borderRadius: "22px",
  padding: "18px",
  background: "#ffffff",

  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
},

  columnHeader: {
  minHeight: "96px",
  background: "#f8fafc",
  borderRadius: "20px",
  padding: "18px",

  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "12px",

  marginBottom: "18px",
  flexShrink: 0,
},

  columnTitle: {
  margin: "0 0 10px",
  color: "#111827",
  fontSize: "23px",
  fontWeight: 900,
  lineHeight: 1.1,
},

  columnSubtitle: {
  margin: 0,
  color: "#64748b",
  fontSize: "15px",
  fontWeight: 600,
},

  columnCount: {
  width: "48px",
  height: "48px",
  minWidth: "48px",
  borderRadius: "50%",
  background: "#e5e7eb",
  color: "#111827",
  display: "grid",
  placeItems: "center",
  fontSize: "16px",
  fontWeight: 900,
},

  columnBody: {
  display: "flex",
  flexDirection: "column",
  gap: "12px",

  flex: 1,
  minHeight: 0,

  overflowY: "auto",
  overflowX: "hidden",

  paddingRight: "6px",
},

  taskTile: {
    width: "100%",
    minHeight: "142px",
    boxSizing: "border-box",
    border: "1px solid #e4e8ee",
    background: "#ffffff",
    borderRadius: "18px",
    padding: "16px 20px",
    textAlign: "left",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: "10px",
    boxShadow:
      "0 4px 12px rgba(15, 23, 42, 0.035)",
  },

  tileContent: {
    width: "100%",
    minWidth: 0,
  },

  tileMainTaskTitle: {
    margin: "0 0 6px",
    fontSize: "18px",
    fontWeight: 900,
    color: "#111827",
    lineHeight: 1.3,
    wordBreak: "break-word",
  },

  tileProjectName: {
    margin: 0,
    fontSize: "13px",
    color: "#64748b",
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  tileProgressRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 900,
  },

  tileBottomRow: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
  },

  tileAssigneeText: {
    fontSize: "12px",
    color: "#64748b",
    fontWeight: 800,
    flex: 1,
    minWidth: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  tileAvatarGroup: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "4px",
    flexShrink: 0,
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
  top: "20px",
  right: "20px",

  width: "52px",
  height: "52px",

  border: "none",
  borderRadius: "14px",

  background: "#111827",
  color: "#ffffff",

  fontSize: "28px",
  lineHeight: 1,

  display: "grid",
  placeItems: "center",

  cursor: "pointer",
  zIndex: 1000,
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

  eyebrow: {
    display: "block",
    color: "#ff5733",
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "0.08em",
    marginBottom: "5px",
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

  descriptionSection: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "14px",
    marginBottom: "20px",
  },

  descriptionBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "16px",
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

  modalProgressText: {
    margin: "9px 0 0",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 800,
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
    fontFamily: "inherit",
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

  avatarSecondary: {
    width: "50px",
    height: "50px",
    borderRadius: "14px",
    background: "#111827",
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

  assigneeMeta: {
    margin: "4px 0 0",
    color: "#94a3b8",
    fontSize: "11px",
  },

  subtaskList: {
    display: "flex",
    flexDirection: "column",
    gap: "9px",
    maxHeight: "380px",
    overflowY: "auto",
    paddingRight: "4px",
  },

  subtaskRow: {
    display: "grid",
    gridTemplateColumns:
      "16px 1fr auto",
    gap: "10px",
    alignItems: "center",
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "12px",
  },

  pendingDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "#cbd5e1",
  },

  doneDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "#22c55e",
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

  subtaskDescription: {
    margin: "5px 0 0",
    color: "#475569",
    fontSize: "12px",
    lineHeight: 1.45,
  },

  subtaskCreator: {
    margin: "5px 0 0",
    color: "#94a3b8",
    fontSize: "11px",
    fontWeight: 700,
  },

  doneBadge: {
    background: "#dcfce7",
    color: "#166534",
    borderRadius: "999px",
    padding: "7px 11px",
    fontSize: "11px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  pendingBadge: {
    background: "#eef2ff",
    color: "#475569",
    borderRadius: "999px",
    padding: "7px 11px",
    fontSize: "11px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  modalFooter: {
  display: "flex",
  justifyContent: "flex-end",
  marginTop: "30px",
  paddingTop: "20px",
  borderTop: "1px solid #e5e7eb",
},

cancelModalButton: {
  height: "48px",
  padding: "0 28px",
  borderRadius: "14px",
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  fontSize: "15px",
  fontWeight: 900,
  cursor: "pointer",
},
};

export default AdminTasks;
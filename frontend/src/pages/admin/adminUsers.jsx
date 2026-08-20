import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [department, setDepartment] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedUser, setSelectedUser] = useState(null);
  const [timeSummary, setTimeSummary] = useState(null);
const [timeLoading, setTimeLoading] = useState(false);
const [timeError, setTimeError] = useState("");
const [expandedTaskId, setExpandedTaskId] = useState(null);

  const fetchDepartmentUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/admin/users");

      setUsers(response.data?.users || []);
      setDepartment(response.data?.department || "");
    } catch (err) {
      console.error("Fetch admin users error:", err);

      const message = err?.response?.data?.message;
      const sqlMessage = err?.response?.data?.sqlMessage;
      const errorMessage = err?.response?.data?.error;
      const status = err?.response?.status;

      setError(
        sqlMessage ||
          errorMessage ||
          message ||
          `Failed to load department users. Status: ${status || "unknown"}`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartmentUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    if (!term) return users;

    return users.filter((user) => {
      return (
        String(user.full_name || "").toLowerCase().includes(term) ||
        String(user.email || "").toLowerCase().includes(term) ||
        String(user.employee_code || "").toLowerCase().includes(term) ||
        String(user.designation || "").toLowerCase().includes(term) ||
        String(user.role_name || "").toLowerCase().includes(term)
      );
    });
  }, [users, searchTerm]);

  const getUserKey = (user) => {
    return user.user_id || user.id || user.email;
  };

  const openUserDetails = async (user) => {
  setSelectedUser(user);
  setTimeSummary(null);
  setTimeError("");
  setExpandedTaskId(null);

  const userId = user.user_id || user.id;

  if (!userId) {
    setTimeError("Employee ID not found.");
    return;
  }

  try {
    setTimeLoading(true);

    const response = await api.get(
      `/admin/users/${userId}/time-summary`
    );

    setTimeSummary(response.data || null);
  } catch (err) {
    console.error("Fetch employee time summary error:", err);

    setTimeError(
      err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to load employee time details."
    );
  } finally {
    setTimeLoading(false);
  }
};

const closeUserDetails = () => {
  setSelectedUser(null);
  setTimeSummary(null);
  setTimeError("");
  setExpandedTaskId(null);
};
const formatDuration = (seconds) => {
  const totalSeconds = Math.max(0, Number(seconds || 0));

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }

  return `${secs}s`;
};

const formatSessionDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatSessionTime = (value) => {
  if (!value) return "Running";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

  return (
    <div className="admin-users-page">

      <div className="admin-users-header-card">
  <div className="admin-users-title-wrap">
    <h2 className="admin-users-main-title">
      Employee Management
    </h2>

    <p className="admin-users-department-label">
      {department || "Department"} Users
    </p>
  </div>

  <div className="admin-users-header-row">
    <div className="admin-users-toolbar">
      <input
        type="text"
        placeholder="Search employee, email, code, designation..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <div className="admin-users-count">
        Total: {filteredUsers.length}
      </div>
    </div>

    <button
      type="button"
      className="admin-refresh-btn"
      onClick={fetchDepartmentUsers}
    >
      Refresh
    </button>
  </div>
</div>
      {loading && (
        <div className="admin-users-message-card">
          Loading department users...
        </div>
      )}

      {!loading && error && (
        <div className="admin-users-error-card">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="admin-users-table-card">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Phone</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="admin-users-empty">
                    No users found in this department.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={getUserKey(user)}
                    onClick={() => openUserDetails(user)}
                    style={{
                      cursor: "pointer",
                    }}
                    title="Click to view user details"
                  >
                    <td>
                      <div className="admin-user-cell">
                        <div className="admin-user-avatar">
                          {String(user.full_name || "U")
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <div className="admin-user-fullname">
                            {user.full_name || "Unnamed User"}
                          </div>

                          <div className="admin-user-email-text">
                            {user.email || "-"}
                          </div>

                          <div className="admin-user-code-text">
                            {user.employee_code || "-"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="admin-role-badge">
                        {user.role_name || "employee"}
                      </span>
                    </td>

                    <td>{user.department_name || "-"}</td>

                    <td>{user.designation || "-"}</td>

                    <td>{user.phone || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedUser && (
        <div style={styles.modalOverlay} onClick={closeUserDetails}>
          <div
            style={styles.modal}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              style={styles.closeButton}
              onClick={closeUserDetails}
            >
              ×
            </button>

            <div style={styles.userHeader}>
              <div style={styles.avatarLarge}>
                {String(selectedUser.full_name || "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div>
                <h2 style={styles.userName}>
                  {selectedUser.full_name || "Unnamed User"}
                </h2>

                <p style={styles.userEmail}>
                  {selectedUser.email || "-"}
                </p>

                <span style={styles.roleBadge}>
                  {selectedUser.role_name || "employee"}
                </span>
              </div>
            </div>

            <div style={styles.detailsGrid}>
              <div style={styles.detailCard}>
                <span style={styles.detailLabel}>Employee Code</span>
                <strong style={styles.detailValue}>
                  {selectedUser.employee_code || "-"}
                </strong>
              </div>

              <div style={styles.detailCard}>
                <span style={styles.detailLabel}>Department</span>
                <strong style={styles.detailValue}>
                  {selectedUser.department_name || "-"}
                </strong>
              </div>

              <div style={styles.detailCard}>
                <span style={styles.detailLabel}>Designation</span>
                <strong style={styles.detailValue}>
                  {selectedUser.designation || "-"}
                </strong>
              </div>

              <div style={styles.detailCard}>
                <span style={styles.detailLabel}>Phone</span>
                <strong style={styles.detailValue}>
                  {selectedUser.phone || "-"}
                </strong>
              </div>

              <div style={styles.detailCard}>
                <span style={styles.detailLabel}>Role</span>
                <strong style={styles.detailValue}>
                  {selectedUser.role_name || "employee"}
                </strong>
              </div>

              <div style={styles.detailCard}>
                <span style={styles.detailLabel}>Status</span>
                <strong style={styles.detailValue}>
                  {selectedUser.status || "Active"}
                </strong>
              </div>
            </div>
            <div style={styles.timeSection}>
  <div style={styles.timeSectionHeader}>
    <div>
      <h3 style={styles.timeTitle}>
        Projects & Time Tracking
      </h3>

      <p style={styles.timeSubtitle}>
        Time recorded from task Start, Pause and Resume sessions.
      </p>
    </div>
  </div>

  {timeLoading && (
    <div style={styles.timeMessage}>
      Loading employee time...
    </div>
  )}

  {!timeLoading && timeError && (
    <div style={styles.timeError}>
      {timeError}
    </div>
  )}

  {!timeLoading && !timeError && timeSummary && (
    <>
      <div style={styles.summaryCards}>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>
            Total Tracked Time
          </span>

          <strong style={styles.summaryValue}>
            {formatDuration(timeSummary.total_seconds)}
          </strong>
        </div>

        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>
            Projects
          </span>

          <strong style={styles.summaryValue}>
            {timeSummary.total_projects || 0}
          </strong>
        </div>

        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>
            Tasks Worked
          </span>

          <strong style={styles.summaryValue}>
            {timeSummary.total_tasks || 0}
          </strong>
        </div>
      </div>

      {!timeSummary.projects?.length ? (
        <div style={styles.noTimeData}>
          No task work time has been recorded for this employee yet.
        </div>
      ) : (
        <div style={styles.projectsList}>
          {timeSummary.projects.map((project) => (
            <div
              key={
                project.project_id ||
                project.project_title
              }
              style={styles.projectCard}
            >
              <div style={styles.projectHeader}>
                <div>
                  <div style={styles.projectName}>
                    {project.project_title || "Untitled Project"}
                  </div>

                  <div style={styles.projectTaskCount}>
                    {project.tasks?.length || 0} task(s)
                  </div>
                </div>

                <strong style={styles.projectTime}>
                  {formatDuration(project.total_seconds)}
                </strong>
              </div>

              <div style={styles.tasksList}>
                {(project.tasks || []).map((task) => {
                  const isExpanded =
                    expandedTaskId === task.task_id;

                  return (
                    <div
                      key={task.task_id}
                      style={styles.taskCard}
                    >
                      <button
                        type="button"
                        style={styles.taskButton}
                        onClick={() =>
                          setExpandedTaskId(
                            isExpanded ? null : task.task_id
                          )
                        }
                      >
                        <div style={styles.taskLeft}>
                          <div style={styles.taskName}>
                            {task.task_title || "Untitled Task"}
                          </div>

                          <div style={styles.taskMeta}>
                            <span>
                              {String(task.status || "")
                                .replace(/_/g, " ")}
                            </span>

                            {task.currently_running && (
                              <span style={styles.runningBadge}>
                                ● Running
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={styles.taskRight}>
                          <strong style={styles.taskTime}>
                            {formatDuration(task.total_seconds)}
                          </strong>

                          <span style={styles.expandIcon}>
                            {isExpanded ? "▲" : "▼"}
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div style={styles.sessionsBox}>
                          <div style={styles.sessionsTitle}>
                            Work Sessions
                          </div>

                          {!task.sessions?.length ? (
                            <div style={styles.noSessions}>
                              No sessions recorded.
                            </div>
                          ) : (
                            task.sessions.map((session) => (
                              <div
                                key={session.session_id}
                                style={styles.sessionRow}
                              >
                                <div style={styles.sessionDate}>
                                  {formatSessionDate(
                                    session.started_at
                                  )}
                                </div>

                                <div style={styles.sessionTimes}>
                                  {formatSessionTime(
                                    session.started_at
                                  )}
                                  {" → "}
                                  {session.currently_running
                                    ? "Running"
                                    : formatSessionTime(
                                        session.ended_at
                                      )}
                                </div>

                                <div style={styles.sessionDuration}>
                                  {formatDuration(
                                    session.seconds_worked
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )}
</div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.68)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: "24px",
  },

  modal: {
    position: "relative",
    width: "min(900px, 95vw)",
  maxHeight: "90vh",
  overflowY: "auto",
    background: "#ffffff",
    borderRadius: "24px",
    padding: "30px",
    boxShadow: "0 28px 70px rgba(15, 23, 42, 0.3)",
  },

  closeButton: {
    position: "absolute",
    top: "18px",
    right: "20px",
    width: "42px",
    height: "42px",
    border: "none",
    borderRadius: "12px",
    background: "#f1f5f9",
    color: "#111827",
    fontSize: "26px",
    cursor: "pointer",
  },

  userHeader: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
    marginBottom: "28px",
    paddingRight: "60px",
  },

  avatarLarge: {
    width: "78px",
    height: "78px",
    borderRadius: "22px",
    background: "#ff5733",
    color: "#ffffff",
    display: "grid",
    placeItems: "center",
    fontSize: "30px",
    fontWeight: 900,
  },

  userName: {
    margin: "0 0 6px",
    color: "#111827",
    fontSize: "28px",
    fontWeight: 900,
  },

  userEmail: {
    margin: "0 0 10px",
    color: "#64748b",
    fontSize: "14px",
    fontWeight: 700,
  },

  roleBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
    padding: "7px 12px",
    background: "#eef2ff",
    color: "#334155",
    fontSize: "13px",
    fontWeight: 900,
    textTransform: "capitalize",
  },

  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },

  detailCard: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  detailLabel: {
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 800,
  },

  detailValue: {
    color: "#111827",
    fontSize: "16px",
    fontWeight: 900,
  },

  timeSection: {
  marginTop: "28px",
  paddingTop: "24px",
  borderTop: "1px solid #e5e7eb",
},

timeSectionHeader: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "18px",
},

timeTitle: {
  margin: "0 0 5px",
  color: "#111827",
  fontSize: "20px",
  fontWeight: 900,
},

timeSubtitle: {
  margin: 0,
  color: "#64748b",
  fontSize: "13px",
  fontWeight: 600,
},

timeMessage: {
  padding: "20px",
  borderRadius: "14px",
  background: "#f8fafc",
  color: "#475569",
  textAlign: "center",
  fontWeight: 700,
},

timeError: {
  padding: "16px",
  borderRadius: "14px",
  background: "#fef2f2",
  color: "#b91c1c",
  fontWeight: 700,
},

summaryCards: {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "12px",
  marginBottom: "20px",
},

summaryCard: {
  padding: "16px",
  border: "1px solid #e5e7eb",
  borderRadius: "15px",
  background: "#f8fafc",
  display: "flex",
  flexDirection: "column",
  gap: "7px",
},

summaryLabel: {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 800,
},

summaryValue: {
  color: "#111827",
  fontSize: "20px",
  fontWeight: 900,
},

noTimeData: {
  padding: "24px",
  textAlign: "center",
  background: "#f8fafc",
  borderRadius: "15px",
  color: "#64748b",
  fontWeight: 700,
},

projectsList: {
  display: "flex",
  flexDirection: "column",
  gap: "15px",
},

projectCard: {
  border: "1px solid #e5e7eb",
  borderRadius: "17px",
  overflow: "hidden",
  background: "#ffffff",
},

projectHeader: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  padding: "17px 18px",
  background: "#f8fafc",
  borderBottom: "1px solid #e5e7eb",
},

projectName: {
  color: "#111827",
  fontSize: "16px",
  fontWeight: 900,
},

projectTaskCount: {
  marginTop: "4px",
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 700,
},

projectTime: {
  color: "#111827",
  fontSize: "16px",
  fontWeight: 900,
  whiteSpace: "nowrap",
},

tasksList: {
  display: "flex",
  flexDirection: "column",
},

taskCard: {
  borderBottom: "1px solid #eef2f7",
},

taskButton: {
  width: "100%",
  border: "none",
  background: "#ffffff",
  padding: "15px 18px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  cursor: "pointer",
  textAlign: "left",
},

taskLeft: {
  minWidth: 0,
},

taskName: {
  color: "#111827",
  fontSize: "14px",
  fontWeight: 850,
},

taskMeta: {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginTop: "5px",
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 700,
  textTransform: "capitalize",
},

runningBadge: {
  color: "#15803d",
  fontWeight: 900,
},

taskRight: {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexShrink: 0,
},

taskTime: {
  color: "#111827",
  fontSize: "14px",
  fontWeight: 900,
},

expandIcon: {
  color: "#64748b",
  fontSize: "11px",
},

sessionsBox: {
  padding: "4px 18px 15px",
  background: "#f8fafc",
},

sessionsTitle: {
  padding: "10px 0",
  color: "#475569",
  fontSize: "12px",
  fontWeight: 900,
  textTransform: "uppercase",
},

sessionRow: {
  display: "grid",
  gridTemplateColumns: "130px 1fr 90px",
  gap: "12px",
  alignItems: "center",
  padding: "10px 0",
  borderTop: "1px solid #e5e7eb",
  fontSize: "13px",
},

sessionDate: {
  color: "#475569",
  fontWeight: 700,
},

sessionTimes: {
  color: "#111827",
  fontWeight: 700,
},

sessionDuration: {
  color: "#111827",
  fontWeight: 900,
  textAlign: "right",
},

noSessions: {
  padding: "12px 0",
  color: "#64748b",
  fontSize: "13px",
},

};

export default AdminUsers;
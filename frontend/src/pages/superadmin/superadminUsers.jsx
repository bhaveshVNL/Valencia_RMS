import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Search,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import api from "../../api/axios";
import "./superadminUsers.css";

const normalizePercentage = (value) => {
  const number = Number(value || 0);

  if (Number.isNaN(number)) return 0;
  return Math.max(0, Math.min(100, number));
};

const escapeCsvValue = (value) => {
  const text = String(value ?? "");

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
};

const SuperadminUsers = () => {
  const importInputRef = useRef(null);

  const [users, setUsers] = useState([]);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await api.get("/superadmin/users");
      setUsers(response.data?.users || []);
    } catch (error) {
      setMessageType("error");
      setMessage(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to load users."
      );
    } finally {
      setLoading(false);
    }
  };

  const openUserDetails = async (userId) => {
    try {
      setDetailsLoading(true);
      setMessage("");

      const response = await api.get(`/superadmin/users/${userId}`);
      setSelectedDetails(response.data);
    } catch (error) {
      setMessageType("error");
      setMessage(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to load user details."
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const value = search.toLowerCase().trim();

    if (!value) return users;

    return users.filter((user) => {
      return (
        user.full_name?.toLowerCase().includes(value) ||
        user.email?.toLowerCase().includes(value) ||
        user.employee_code?.toLowerCase().includes(value) ||
        user.department_name?.toLowerCase().includes(value) ||
        user.designation?.toLowerCase().includes(value) ||
        user.role_name?.toLowerCase().includes(value)
      );
    });
  }, [users, search]);

  const exportUsersCsv = () => {
    const rows = filteredUsers.map((user) => [
      user.full_name || "",
      user.email || "",
      user.employee_code || "",
      user.role_name || "",
      user.department_name || "",
      user.designation || "",
      user.total_tasks || 0,
      user.created_tasks_count || 0,
      user.attendance?.attendance_percentage || 0,
      user.average_task_progress || 0,
    ]);

    const headings = [
      "Full Name",
      "Email",
      "Employee Code",
      "Role",
      "Department",
      "Designation",
      "Tasks",
      "Created Tasks",
      "Attendance Percentage",
      "Task Progress Percentage",
    ];

    const csv = [headings, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `superadmin-users-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const openImportPicker = () => {
    importInputRef.current?.click();
  };

  const importUsersCsv = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setImporting(true);
      setMessage("");

      const formData = new FormData();
      formData.append("file", file);

      const response = await api.post("/superadmin/users/import", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setMessageType("success");
      setMessage(
        response.data?.message || "Users imported successfully."
      );

      await fetchUsers();
    } catch (error) {
      setMessageType("error");
      setMessage(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to import users."
      );
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  return (
    <div className="sa-users-page">
      <div className="sa-users-header">
        <div className="sa-users-heading">
          <h1>Users</h1>
          <p>Click any user to view full profile, attendance, skills and tasks.</p>
        </div>

        <div className="sa-users-actions">
          <button
            type="button"
            className="sa-users-action-btn sa-users-export-btn"
            onClick={exportUsersCsv}
          >
            <Download size={18} />
            Export CSV
          </button>

          <button
            type="button"
            className="sa-users-action-btn sa-users-import-btn"
            onClick={openImportPicker}
            disabled={importing}
          >
            <Upload size={18} />
            {importing ? "Importing..." : "Import Users"}
          </button>

          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sa-users-file-input"
            onChange={importUsersCsv}
          />
        </div>
      </div>

      <label className="sa-users-search">
        <Search size={20} />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search users, email, role, department, status..."
          aria-label="Search users"
        />
      </label>

      {message && (
        <div
          className={`sa-users-message ${
            messageType === "success" ? "success" : "error"
          }`}
        >
          {message}
        </div>
      )}

      <section className="sa-users-table-card">
        {loading ? (
          <div className="sa-users-empty">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="sa-users-empty">No users found.</div>
        ) : (
          <div className="sa-users-table-wrap">
            <table className="sa-users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Tasks</th>
                  <th>Created Tasks</th>
                  <th>Attendance</th>
                  <th>Progress</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => {
                  const progress = normalizePercentage(
                    user.average_task_progress
                  );

                  return (
                    <tr
                      key={user.user_id}
                      tabIndex={0}
                      onClick={() => openUserDetails(user.user_id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openUserDetails(user.user_id);
                        }
                      }}
                    >
                      <td>
                        <div className="sa-users-user-cell">
                          <div className="sa-users-user-icon">
                            <UserRound size={21} />
                          </div>

                          <div className="sa-users-user-copy">
                            <strong className="sa-users-name">
                              {user.full_name || "-"}
                            </strong>
                            <span className="sa-users-secondary">
                              {user.email || "-"}
                            </span>
                            <span className="sa-users-secondary">
                              {user.employee_code || "-"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="sa-users-badge">
                          {user.role_name || "-"}
                        </span>
                      </td>

                      <td>{user.department_name || "-"}</td>
                      <td>{user.designation || "-"}</td>
                      <td>{user.total_tasks || 0}</td>
                      <td>{user.created_tasks_count || 0}</td>
                      <td>
                        {user.attendance?.attendance_percentage || 0}%
                      </td>

                      <td>
                        <div className="sa-users-progress-cell">
                          <strong>{progress}%</strong>
                          <progress value={progress} max="100">
                            {progress}%
                          </progress>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detailsLoading && (
        <div className="sa-users-modal-backdrop">
          <div className="sa-users-loading-modal">Loading user details...</div>
        </div>
      )}

      {selectedDetails && !detailsLoading && (
        <div
          className="sa-users-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedDetails(null);
            }
          }}
        >
          <div className="sa-users-modal">
            <div className="sa-users-modal-header">
              <div>
                <h2>{selectedDetails.user?.full_name || "User Details"}</h2>
                <p>{selectedDetails.user?.email || "-"}</p>
              </div>

              <button
                type="button"
                className="sa-users-close-btn"
                onClick={() => setSelectedDetails(null)}
              >
                <X size={18} />
                Close
              </button>
            </div>

            <div className="sa-users-stats-grid">
              <DetailStat
                label="Role"
                value={selectedDetails.user?.role_name}
              />
              <DetailStat
                label="Designation"
                value={selectedDetails.user?.designation}
              />
              <DetailStat
                label="Attendance"
                value={`${
                  selectedDetails.user?.attendance?.attendance_percentage || 0
                }%`}
              />
              <DetailStat
                label="Task Progress"
                value={`${
                  selectedDetails.user?.average_task_progress || 0
                }%`}
              />
            </div>

            <section className="sa-users-modal-section">
              <h3>
                <UserRound size={21} />
                Personal Details
              </h3>

              <div className="sa-users-info-grid">
                <InfoBox
                  label="Employee Code"
                  value={selectedDetails.user?.employee_code}
                />
                <InfoBox
                  label="Department"
                  value={selectedDetails.user?.department_name}
                />
                <InfoBox
                  label="Skills"
                  value={selectedDetails.user?.skills}
                />
              </div>
            </section>

            <TaskSection
              title="Assigned Tasks"
              tasks={selectedDetails.assigned_tasks || []}
              emptyText="No assigned tasks."
              showAssignee={false}
            />

            <TaskSection
              title="Tasks Assigned By This User"
              tasks={selectedDetails.created_tasks || []}
              emptyText="This user has not assigned any tasks."
              showAssignee
            />

            <section className="sa-users-modal-section">
              <h3>Recent Attendance</h3>

              {selectedDetails.recent_attendance?.length ? (
                <div className="sa-users-attendance-wrap">
                  <table className="sa-users-attendance-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Check In</th>
                        <th>Check Out</th>
                        <th>Minutes</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedDetails.recent_attendance.map((row) => (
                        <tr key={row.attendance_id}>
                          <td>{row.attendance_date || "-"}</td>
                          <td>
                            <span className="sa-users-badge">
                              {row.status || "-"}
                            </span>
                          </td>
                          <td>{row.check_in_time || "-"}</td>
                          <td>{row.check_out_time || "-"}</td>
                          <td>{row.total_minutes || 0}</td>
                          <td>{row.remarks || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="sa-users-empty">No attendance found.</div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

const DetailStat = ({ label, value }) => (
  <div className="sa-users-stat-card">
    <span>{label}</span>
    <strong>{value || "-"}</strong>
  </div>
);

const InfoBox = ({ label, value }) => (
  <div className="sa-users-info-box">
    <span>{label}</span>
    <strong>{value || "-"}</strong>
  </div>
);

const TaskSection = ({
  title,
  tasks = [],
  emptyText,
  showAssignee = false,
}) => (
  <section className="sa-users-modal-section">
    <h3>{title}</h3>

    {tasks.length ? (
      <div className="sa-users-task-list">
        {tasks.map((task) => {
          const progress = normalizePercentage(task.progress);

          return (
            <article className="sa-users-task-card" key={task.task_id}>
              <div className="sa-users-task-top">
                <div>
                  <h4>{task.task_title || "-"}</h4>
                  <p>
                    {showAssignee
                      ? `Assigned To: ${task.assignee_name || "-"}`
                      : task.project_title || "-"}
                  </p>
                </div>

                <span className="sa-users-badge">
                  {task.status_group || "-"}
                </span>
              </div>

              {!showAssignee && (
                <p className="sa-users-task-meta">
                  Assigned By: <strong>{task.assigned_by_name || "-"}</strong>
                </p>
              )}

              <div className="sa-users-task-progress">
                <progress value={progress} max="100">
                  {progress}%
                </progress>
                <span>
                  Progress: {progress}%
                  {!showAssignee &&
                    ` · Subtasks: ${task.completed_subtasks || 0}/${
                      task.total_subtasks || 0
                    }`}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    ) : (
      <div className="sa-users-empty">{emptyText}</div>
    )}
  </section>
);

export default SuperadminUsers;
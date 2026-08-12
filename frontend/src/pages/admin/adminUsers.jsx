import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [department, setDepartment] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedUser, setSelectedUser] = useState(null);

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

  const openUserDetails = (user) => {
    setSelectedUser(user);
  };

  const closeUserDetails = () => {
    setSelectedUser(null);
  };

  return (
    <div className="admin-users-page">
      <div className="admin-users-header-card">
        <div>
          <h2>Department Users</h2>

          <p>
            Showing employees from{" "}
            <strong>{department || "your department"}</strong> only.
          </p>
        </div>

        <button
          type="button"
          className="admin-refresh-btn"
          onClick={fetchDepartmentUsers}
        >
          Refresh
        </button>
      </div>

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
    width: "min(760px, 95vw)",
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
};

export default AdminUsers;
import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [department, setDepartment] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
                  <tr key={user.id}>
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
    </div>
  );
};

export default AdminUsers;
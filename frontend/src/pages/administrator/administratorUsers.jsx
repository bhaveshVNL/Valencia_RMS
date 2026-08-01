import { useEffect, useRef, useState } from "react";
import {
  Download,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
  Save,
} from "lucide-react";
import api from "../../api/axios";
import "./administratorUsers.css";

const fixedDepartments = [
  "IT",
  "Sales",
  "Creatives",
  "Finance",
  "Nutracare",
  "POS",
];

const emptyForm = {
  employee_code: "",
  full_name: "",
  email: "",
  phone: "",
  designation: "",
  department_name: "",
  role_name: "employee",
};

const AdministratorUsers = () => {
  const fileInputRef = useRef(null);

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDesignation, setSelectedDesignation] = useState("");
  const [updatingRole, setUpdatingRole] = useState(false);
  const [updatingDetails, setUpdatingDetails] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setMessage("");

      const [usersResponse, metaResponse] = await Promise.all([
        api.get("/administrator/users"),
        api.get("/administrator/users/meta"),
      ]);

      setUsers(usersResponse.data.users || []);
      setDepartments(metaResponse.data.departments || []);
      setRoles(metaResponse.data.roles || []);
    } catch (error) {
      setMessage(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to load users."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter((user) => {
    const value = search.toLowerCase();

    return (
      user.full_name?.toLowerCase().includes(value) ||
      user.email?.toLowerCase().includes(value) ||
      user.employee_code?.toLowerCase().includes(value) ||
      user.designation?.toLowerCase().includes(value) ||
      user.department_name?.toLowerCase().includes(value) ||
      user.role_name?.toLowerCase().includes(value) ||
      user.status?.toLowerCase().includes(value)
    );
  });

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const createUser = async (event) => {
    event.preventDefault();

    try {
      setCreating(true);
      setMessage("");

      const response = await api.post("/administrator/users", form);

      setMessage(
        `${response.data.message} Default Password: ${response.data.default_password}`
      );

      setForm(emptyForm);
      fetchUsers();
    } catch (error) {
      setMessage(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to create user."
      );
    } finally {
      setCreating(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const importUsers = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setImporting(true);
      setMessage("");

      const response = await api.post("/administrator/users/import", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setMessage(
        `${response.data.message} Imported Users: ${response.data.inserted_users}, Duplicates: ${response.data.duplicate_emails}, Skipped Rows: ${response.data.skipped_rows}, Default Password: ${response.data.default_password}`
      );

      fetchUsers();
    } catch (error) {
      setMessage(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to import users."
      );
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const openUserDialog = (user) => {
    setSelectedUser(user);
    setSelectedRole(user.role_name || "employee");
    setSelectedDepartment(
      fixedDepartments.includes(user.department_name) ? user.department_name : ""
    );
    setSelectedDesignation(user.designation || "");
    setMessage("");
  };

  const closeUserDialog = () => {
    setSelectedUser(null);
    setSelectedRole("");
    setSelectedDepartment("");
    setSelectedDesignation("");
    setUpdatingRole(false);
    setUpdatingDetails(false);
  };

  const updateUserDetails = async () => {
    if (!selectedUser) return;

    if (!selectedDepartment) {
      setMessage("Please select a department.");
      return;
    }

    try {
      setUpdatingDetails(true);
      setMessage("");

      const response = await api.put(
        `/administrator/users/${selectedUser.user_id}/details`,
        {
          department_name: selectedDepartment,
          designation: selectedDesignation,
        }
      );

      setMessage(response.data.message || "User details updated successfully.");
      await fetchUsers();
      closeUserDialog();
    } catch (error) {
      setMessage(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to update user details."
      );
    } finally {
      setUpdatingDetails(false);
    }
  };

  const updateUserRole = async () => {
    if (!selectedUser) return;

    try {
      setUpdatingRole(true);
      setMessage("");

      const response = await api.put(
        `/administrator/users/${selectedUser.user_id}/role`,
        {
          role_name: selectedRole,
        }
      );

      setMessage(response.data.message || "User role updated successfully.");
      await fetchUsers();
      closeUserDialog();
    } catch (error) {
      setMessage(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to update user role."
      );
    } finally {
      setUpdatingRole(false);
    }
  };

  const updateUserStatus = async (userId, status) => {
    try {
      setMessage("");

      const response = await api.put(`/administrator/users/${userId}/status`, {
        status,
      });

      setMessage(response.data.message);
      await fetchUsers();
      closeUserDialog();
    } catch (error) {
      setMessage(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to update user status."
      );
    }
  };

  const resetPassword = async (userId) => {
    const confirmReset = window.confirm(
      "Reset this user's password to Valencia@123?"
    );

    if (!confirmReset) return;

    try {
      setMessage("");

      const response = await api.put(
        `/administrator/users/${userId}/reset-password`
      );

      setMessage(
        `${response.data.message} Default Password: ${response.data.default_password}`
      );

      closeUserDialog();
    } catch (error) {
      setMessage(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to reset password."
      );
    }
  };

  const deleteUser = async (userId) => {
    const confirmDelete = window.confirm(
      "Delete this user? This will remove access but keep records safe."
    );

    if (!confirmDelete) return;

    try {
      setMessage("");

      const response = await api.delete(`/administrator/users/${userId}`);

      setMessage(response.data.message);
      await fetchUsers();
      closeUserDialog();
    } catch (error) {
      setMessage(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to delete user."
      );
    }
  };

  const exportUsersCsv = () => {
    const headers = [
      "employee_code",
      "full_name",
      "email",
      "phone",
      "designation",
      "department_name",
      "role_name",
      "status",
    ];

    const rows = filteredUsers.map((user) =>
      headers
        .map((header) => {
          const value = user[header] || "";
          const stringValue = String(value);

          if (
            stringValue.includes(",") ||
            stringValue.includes('"') ||
            stringValue.includes("\n")
          ) {
            return `"${stringValue.replaceAll('"', '""')}"`;
          }

          return stringValue;
        })
        .join(",")
    );

    const csvContent = [headers.join(","), ...rows].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.setAttribute("download", "valencia-rms-users.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="users-page">
      <div className="administrator-users-header">
  <div className="administrator-users-heading">
    <h1>Users</h1>
    <p>Add, import, reset password, block, unblock and delete users.</p>
  </div>

  <div className="administrator-users-header-actions">
    <button
      type="button"
      className="administrator-users-header-btn"
      onClick={fetchUsers}
    >
      <RefreshCw size={14} />
      <span>Refresh</span>
    </button>

    <button
      type="button"
      className="administrator-users-header-btn"
      onClick={exportUsersCsv}
    >
      <Download size={14} />
      <span>Export CSV</span>
    </button>

    <button
      type="button"
      className="administrator-users-header-btn"
      onClick={handleImportClick}
      disabled={importing}
    >
      <Upload size={14} />
      <span>{importing ? "Importing..." : "Import Users"}</span>
    </button>

    <input
      ref={fileInputRef}
      type="file"
      accept=".xlsx,.xls,.csv"
      hidden
      onChange={importUsers}
    />
  </div>
</div>

      {message && <div className="projects-message">{message}</div>}

      <div className="user-form-card">
        <div className="section-title-row">
          <div>
            <h2>Add Single User</h2>
            <p>New users receive default password: Valencia@123</p>
          </div>
        </div>

        <form className="user-form-grid" onSubmit={createUser}>
          <div className="form-field">
            <label>Employee Code</label>
            <input
              value="Auto generated"
              disabled
              className="disabled-input"
            />
          </div>

          <div className="form-field">
            <label>Full Name *</label>
            <input
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              placeholder="Employee name"
              required
            />
          </div>

          <div className="form-field">
            <label>Email *</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="name@valencianutrition.com"
              required
            />
          </div>

          <div className="form-field">
            <label>Phone</label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="Phone number"
            />
          </div>

          <div className="form-field">
            <label>Designation</label>
            <input
              name="designation"
              value={form.designation}
              onChange={handleChange}
              placeholder="Designation"
            />
          </div>

          <div className="form-field">
            <label>Department</label>
            <select
              name="department_name"
              value={form.department_name}
              onChange={handleChange}
            >
              <option value="">Select department</option>
              {fixedDepartments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Role</label>
            <select
              name="role_name"
              value={form.role_name}
              onChange={handleChange}
            >
              {roles.map((role) => (
                <option key={role.role_id} value={role.role_name}>
                  {role.role_name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-submit-field">
            <button
              className="primary-action-btn"
              type="submit"
              disabled={creating}
            >
              <UserPlus size={16} />
              {creating ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>

      <div className="projects-toolbar">
        <div className="projects-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search users, email, role, department, status..."
          />
        </div>
      </div>

      {loading ? (
        <div className="page-loader">Loading users...</div>
      ) : (
        <div className="projects-table-card administrator-users-table-card">
          <table className="projects-table users-table administrator-users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Department</th>
                <th>Designation</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr
                    key={user.user_id}
                    className="clickable-user-row"
                    onClick={() => openUserDialog(user)}
                  >
                    <td>
                      <div className="user-name-cell">
                        <div className="user-avatar-small">
                          <Users size={16} />
                        </div>

                        <div>
                          <strong>{user.full_name}</strong>
                          <p>{user.email}</p>
                          <p>{user.employee_code || "Code not generated yet"}</p>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="role-badge">{user.role_name}</span>
                    </td>

                    <td>{user.department_name || "-"}</td>

                    <td>{user.designation || "-"}</td>

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="empty-projects">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="csv-help-card">
        <h3>CSV Import Format</h3>

        <p>
          Supported columns:
          <strong>
            {" "}
            employee_code, full_name, email, phone, designation,
            department_name, role_name
          </strong>
        </p>

        <p className="csv-note">
          Employee code will be auto-generated when administrator saves employee
          details from the dialog.
        </p>
      </div>

      {selectedUser && (
        <div className="user-dialog-backdrop" onClick={closeUserDialog}>
          <div
            className="user-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="user-dialog-header">
              <div>
                <h2>{selectedUser.full_name}</h2>
                <p>{selectedUser.email}</p>
              </div>

              <button className="dialog-close-btn" onClick={closeUserDialog}>
                <X size={18} />
              </button>
            </div>

            <div className="user-dialog-grid">
  <div className="dialog-field">
    <label>Employee Code</label>
    <p>
      {selectedUser.employee_code ||
        "Will be generated automatically after saving details"}
    </p>
  </div>

  <div className="dialog-field">
    <label>Current Role</label>
    <p>{selectedUser.role_name || "-"}</p>
  </div>

  <div className="dialog-field">
    <label>Department</label>
    <select
      value={selectedDepartment}
      onChange={(event) => setSelectedDepartment(event.target.value)}
    >
      <option value="">Select department</option>
      {fixedDepartments.map((department) => (
        <option key={department} value={department}>
          {department}
        </option>
      ))}
    </select>
  </div>

  <div className="dialog-field">
    <label>Designation</label>
    <input
      value={selectedDesignation}
      onChange={(event) => setSelectedDesignation(event.target.value)}
      placeholder="Enter designation"
    />
  </div>

  <div className="dialog-field">
    <label>Status</label>
    <p>{selectedUser.status || "-"}</p>
  </div>

  <div className="dialog-field">
    <label>Skills</label>
    <p>{selectedUser.skills || "-"}</p>
  </div>

  <div className="dialog-save-details-row">
    <button
      className="primary-action-btn"
      onClick={updateUserDetails}
      disabled={updatingDetails}
    >
      <Save size={16} />
      {updatingDetails ? "Saving..." : "Save Details"}
    </button>
  </div>
</div>

            <div className="dialog-role-section">
              <label>Change Role</label>

              <div className="dialog-role-control">
                <select
                  value={selectedRole}
                  onChange={(event) => setSelectedRole(event.target.value)}
                >
                  {roles.map((role) => (
                    <option key={role.role_id} value={role.role_name}>
                      {role.role_name}
                    </option>
                  ))}
                </select>

                <button
                  className="primary-action-btn"
                  onClick={updateUserRole}
                  disabled={updatingRole}
                >
                  <Save size={16} />
                  {updatingRole ? "Saving..." : "Save Role"}
                </button>
              </div>
            </div>

            <div className="dialog-actions">
              <button
                type="button"
                className="dialog-action-btn"
                onClick={() => resetPassword(selectedUser.user_id)}
              >
                <Lock size={16} />
                Reset Password
              </button>

              {selectedUser.status === "blocked" ? (
                <button
                  type="button"
                  className="dialog-action-btn"
                  onClick={() =>
                    updateUserStatus(selectedUser.user_id, "active")
                  }
                >
                  <ShieldCheck size={16} />
                  Unblock User
                </button>
              ) : (
                <button
                  type="button"
                  className="dialog-action-btn"
                  onClick={() =>
                    updateUserStatus(selectedUser.user_id, "blocked")
                  }
                >
                  <ShieldCheck size={16} />
                  Block User
                </button>
              )}

              <button
                type="button"
                className="dialog-action-btn danger"
                onClick={() => deleteUser(selectedUser.user_id)}
              >
                <Trash2 size={16} />
                Delete User
              </button>
            </div>

            <div className="dialog-warning">
              Role change is saved only after clicking{" "}
              <strong>Save Role</strong>. Department, designation and employee
              code are saved only after clicking <strong>Save Details</strong>.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdministratorUsers;
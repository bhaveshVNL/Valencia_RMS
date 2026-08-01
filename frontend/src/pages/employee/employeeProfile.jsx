import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Save, UserRound } from "lucide-react";
import api from "../../api/axios";

const getStoredUser = () => {
  try {
    return JSON.parse(
      sessionStorage.getItem("user") || localStorage.getItem("user") || "{}"
    );
  } catch {
    return {};
  }
};

const getResponseData = (response) => {
  return response?.data?.data || response?.data?.profile || response?.data || {};
};

const getInitials = (name = "") => {
  const cleanName = String(name || "").trim();

  if (!cleanName) return "E";

  return cleanName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const normalizeProfile = (rawProfile, fallbackUser) => {
  const profile = rawProfile || {};
  const user = fallbackUser || {};

  return {
    user_id: profile.user_id || user.user_id || "",
    full_name: profile.full_name || profile.name || user.full_name || "Employee",
    email: profile.email || user.email || "-",
    phone: profile.phone || user.phone || "-",
    department_name:
      profile.department_name ||
      profile.department ||
      user.department_name ||
      user.department ||
      "-",
    designation:
      profile.designation ||
      profile.designation_name ||
      user.designation ||
      "-",
    employee_code:
      profile.employee_code ||
      profile.employeeCode ||
      user.employee_code ||
      "-",
    role_name: profile.role_name || profile.role || user.role_name || "employee",
    skills: profile.skills || user.skills || "",
  };
};

const EmployeeProfile = () => {
  const storedUser = getStoredUser();

  const [profile, setProfile] = useState(() =>
    normalizeProfile(storedUser, storedUser)
  );
  const [skillsText, setSkillsText] = useState("");
  const [editingSkills, setEditingSkills] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingSkills, setSavingSkills] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const initials = useMemo(() => getInitials(profile.full_name), [profile.full_name]);

  const skillsList = useMemo(() => {
    return String(profile.skills || "")
      .split(/,|\n/)
      .map((skill) => skill.trim())
      .filter(Boolean);
  }, [profile.skills]);

  const fetchProfile = async () => {
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      let response;

      try {
        response = await api.get("/employee/profile");
      } catch {
        try {
          response = await api.get("/employee-profile");
        } catch {
          try {
            response = await api.get("/employee-profile/me");
          } catch {
            response = await api.get("/employee/me");
          }
        }
      }

      const normalized = normalizeProfile(getResponseData(response), storedUser);
      setProfile(normalized);
      setSkillsText(normalized.skills || "");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to load profile."
      );
    } finally {
      setLoading(false);
    }
  };

  const saveSkills = async () => {
    setSavingSkills(true);
    setError("");
    setSuccessMessage("");

    try {
      const payload = {
        skills: skillsText,
      };

      try {
        await api.put("/employee/profile/skills", payload);
      } catch {
        try {
          await api.put("/employee-profile/skills", payload);
        } catch {
          await api.put("/employee-profile/me/skills", payload);
        }
      }

      setProfile((previous) => ({
        ...previous,
        skills: skillsText,
      }));

      setEditingSkills(false);
      setSuccessMessage("Skills updated successfully.");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to update skills."
      );
    } finally {
      setSavingSkills(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return (
    <div style={styles.page}>
      <section style={styles.profileTopBar}>
        <div style={styles.profileIdentity}>
          <div style={styles.avatar}>{initials}</div>

          <div>
            <h1 style={styles.employeeName}>{profile.full_name}</h1>

            <div style={styles.identityMeta}>
              <span style={styles.metaPill}>{profile.designation}</span>
              <span style={styles.metaPill}>{profile.department_name}</span>
              <span style={styles.rolePill}>{profile.role_name}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          style={styles.refreshBtn}
          onClick={fetchProfile}
          disabled={loading}
        >
          <RefreshCw size={18} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </section>

      {error && <div style={styles.errorBox}>{error}</div>}
      {successMessage && <div style={styles.successBox}>{successMessage}</div>}

      <section style={styles.detailsCard}>
        <div style={styles.cardHeader}>
          <div style={styles.cardTitleWrap}>
            <UserRound size={25} color="#ff5733" />
            <div>
              <h2 style={styles.cardTitle}>Employee Details</h2>
              <p style={styles.cardSubtitle}>
                Your account information as saved in Valencia RMS.
              </p>
            </div>
          </div>
        </div>

        <div style={styles.detailsGrid}>
          <div style={styles.detailBox}>
            <span style={styles.detailLabel}>Name</span>
            <strong style={styles.detailValue}>{profile.full_name}</strong>
          </div>

          <div style={styles.detailBox}>
            <span style={styles.detailLabel}>Email</span>
            <strong style={styles.detailValue}>{profile.email}</strong>
          </div>

          <div style={styles.detailBox}>
            <span style={styles.detailLabel}>Phone</span>
            <strong style={styles.detailValue}>{profile.phone}</strong>
          </div>

          <div style={styles.detailBox}>
            <span style={styles.detailLabel}>Department</span>
            <strong style={styles.detailValue}>{profile.department_name}</strong>
          </div>

          <div style={styles.detailBox}>
            <span style={styles.detailLabel}>Designation</span>
            <strong style={styles.detailValue}>{profile.designation}</strong>
          </div>

          <div style={styles.detailBox}>
            <span style={styles.detailLabel}>Employee Code</span>
            <strong style={styles.detailValue}>{profile.employee_code}</strong>
          </div>

          <div style={styles.detailBox}>
            <span style={styles.detailLabel}>Role</span>
            <strong style={styles.detailValue}>{profile.role_name}</strong>
          </div>

          <div style={styles.detailBox}>
            <span style={styles.detailLabel}>User ID</span>
            <strong style={styles.detailValue}>{profile.user_id || "-"}</strong>
          </div>
        </div>
      </section>

      <section style={styles.skillsCard}>
        <div style={styles.skillsHeader}>
          <div>
            <h2 style={styles.cardTitle}>Skills</h2>
            <p style={styles.cardSubtitle}>
              Add skills separated by comma or new line.
            </p>
          </div>

          {!editingSkills ? (
            <button
              type="button"
              style={styles.editBtn}
              onClick={() => {
                setSkillsText(profile.skills || "");
                setEditingSkills(true);
              }}
            >
              Edit Skills
            </button>
          ) : (
            <button
              type="button"
              style={styles.saveBtn}
              onClick={saveSkills}
              disabled={savingSkills}
            >
              <Save size={17} />
              {savingSkills ? "Saving..." : "Save Skills"}
            </button>
          )}
        </div>

        {editingSkills ? (
          <textarea
            style={styles.skillsTextarea}
            value={skillsText}
            onChange={(event) => setSkillsText(event.target.value)}
            placeholder="Example: React, Node.js, MySQL, UI Design"
          />
        ) : skillsList.length > 0 ? (
          <div style={styles.skillsList}>
            {skillsList.map((skill, index) => (
              <span style={styles.skillPill} key={`${skill}-${index}`}>
                {skill}
              </span>
            ))}
          </div>
        ) : (
          <div style={styles.emptySkills}>No skills added yet.</div>
        )}
      </section>
    </div>
  );
};

const styles = {
  page: {
    width: "100%",
    padding: "0",
  },

  profileTopBar: {
    width: "100%",
    background: "#ffffff",
    borderRadius: "28px",
    padding: "30px 38px",
    marginBottom: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "24px",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)",
  },

  profileIdentity: {
    display: "flex",
    alignItems: "center",
    gap: "22px",
    minWidth: 0,
  },

  avatar: {
    width: "76px",
    height: "76px",
    minWidth: "76px",
    borderRadius: "22px",
    background: "#111827",
    color: "#ffffff",
    display: "grid",
    placeItems: "center",
    fontSize: "28px",
    fontWeight: 900,
    letterSpacing: "-0.5px",
  },

  employeeName: {
    margin: "0 0 12px",
    color: "#111827",
    fontSize: "38px",
    fontWeight: 900,
    lineHeight: 1.05,
    letterSpacing: "-1px",
  },

  identityMeta: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "10px",
  },

  metaPill: {
    background: "#fff1ec",
    color: "#ff5733",
    borderRadius: "999px",
    padding: "8px 14px",
    fontSize: "14px",
    fontWeight: 900,
  },

  rolePill: {
    background: "#eef2ff",
    color: "#334155",
    borderRadius: "999px",
    padding: "8px 14px",
    fontSize: "14px",
    fontWeight: 900,
    textTransform: "capitalize",
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
    whiteSpace: "nowrap",
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

  detailsCard: {
    width: "100%",
    background: "#ffffff",
    borderRadius: "28px",
    padding: "34px",
    marginBottom: "28px",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)",
  },

  cardHeader: {
    marginBottom: "26px",
  },

  cardTitleWrap: {
    display: "flex",
    alignItems: "flex-start",
    gap: "16px",
  },

  cardTitle: {
    margin: "0 0 8px",
    color: "#111827",
    fontSize: "32px",
    fontWeight: 900,
    lineHeight: 1.1,
    letterSpacing: "-0.5px",
  },

  cardSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "16px",
    lineHeight: 1.45,
  },

  detailsGrid: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "18px",
  },

  detailBox: {
    minHeight: "118px",
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "10px",
    minWidth: 0,
  },

  detailLabel: {
    color: "#64748b",
    fontSize: "14px",
    fontWeight: 900,
  },

  detailValue: {
    color: "#111827",
    fontSize: "18px",
    fontWeight: 900,
    lineHeight: 1.3,
    wordBreak: "break-word",
  },

  skillsCard: {
    width: "100%",
    background: "#ffffff",
    borderRadius: "28px",
    padding: "34px",
    marginBottom: "28px",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)",
  },

  skillsHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
    marginBottom: "24px",
  },

  editBtn: {
    border: "none",
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "16px",
    padding: "14px 22px",
    fontSize: "16px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  saveBtn: {
    border: "none",
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "16px",
    padding: "14px 22px",
    fontSize: "16px",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    gap: "9px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  skillsTextarea: {
    width: "100%",
    minHeight: "150px",
    border: "1px solid #d6dde8",
    borderRadius: "18px",
    padding: "16px",
    fontSize: "16px",
    fontWeight: 700,
    outline: "none",
    resize: "vertical",
    color: "#111827",
    background: "#ffffff",
  },

  skillsList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
  },

  skillPill: {
    background: "#fff1ec",
    color: "#ff5733",
    borderRadius: "999px",
    padding: "10px 15px",
    fontSize: "15px",
    fontWeight: 900,
  },

  emptySkills: {
    border: "1px dashed #cbd5e1",
    borderRadius: "18px",
    padding: "28px",
    textAlign: "center",
    color: "#64748b",
    fontSize: "16px",
    fontWeight: 900,
    background: "#f8fafc",
  },
};

export default EmployeeProfile;
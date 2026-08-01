import React, { useEffect, useMemo, useState } from "react";
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

const getInitials = (name) => {
  const cleanName = String(name || "Admin").trim();

  const initials = cleanName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "A";
};

const AdminProfile = () => {
  const storedUser = getStoredUser();

  const [profile, setProfile] = useState(storedUser);
  const [error, setError] = useState("");

  const fetchProfile = async () => {
    try {
      setError("");

      const response = await api.get("/admin-profile/me");

      const data =
        response.data?.profile ||
        response.data?.admin ||
        response.data?.user ||
        response.data?.data ||
        response.data ||
        {};

      setProfile({
        ...storedUser,
        ...data,
      });
    } catch (err) {
      console.error("Fetch admin profile error:", err);

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to fetch admin profile."
      );

      setProfile(storedUser);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const adminName = profile?.full_name || profile?.name || "Admin";
  const adminEmail = profile?.email || "-";
  const adminRole = profile?.role_name || profile?.role || "admin";
  const adminDepartment = profile?.department_name || profile?.department || "-";

  const otherDetails = useMemo(() => {
    return [
      {
        label: "Designation",
        value: profile?.designation || "-",
      },
      {
        label: "Employee Code",
        value:
          profile?.employee_code ||
          profile?.employee_id ||
          profile?.user_id ||
          "-",
      },
      {
        label: "Phone",
        value: profile?.phone || profile?.mobile || "-",
      },
      {
        label: "Status",
        value: profile?.status || "Active",
      },
    ];
  }, [profile]);

  return (
    <div style={styles.page}>
      {error && <div style={styles.errorBox}>{error}</div>}

      <section style={styles.profileSummaryBlock}>
        <div style={styles.avatarBox}>
          <div style={styles.avatar}>{getInitials(adminName)}</div>
        </div>

        <div style={styles.adminInfoBox}>
          <p style={styles.smallLabel}>Admin Details</p>
          <h1 style={styles.adminName}>{adminName}</h1>
          <p style={styles.adminEmail}>{adminEmail}</p>

          <div style={styles.badgeRow}>
            <span style={styles.roleBadge}>{adminRole}</span>
            <span style={styles.departmentBadge}>{adminDepartment}</span>
          </div>
        </div>
      </section>

      <section style={styles.detailsBlock}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Employee Details</h2>
          <p style={styles.sectionSubtitle}>
            Additional account and employee information.
          </p>
        </div>

        <div style={styles.detailsGrid}>
          {otherDetails.map((item) => (
            <div style={styles.detailCard} key={item.label}>
              <span style={styles.detailLabel}>{item.label}</span>
              <strong style={styles.detailValue}>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const styles = {
  page: {
    width: "100%",
    minHeight: "100%",
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

  profileSummaryBlock: {
    width: "100%",
    background: "#ffffff",
    borderRadius: "28px",
    padding: "34px",
    boxShadow: "0 18px 46px rgba(15, 23, 42, 0.07)",
    display: "grid",
    gridTemplateColumns: "220px 1fr",
    gap: "30px",
    alignItems: "center",
    marginBottom: "28px",
  },

  avatarBox: {
    width: "220px",
    height: "190px",
    borderRadius: "24px",
    background: "linear-gradient(180deg, #fff7f5 0%, #ffffff 100%)",
    border: "1px solid #fee2dc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  avatar: {
    width: "118px",
    height: "118px",
    borderRadius: "30px",
    background: "#ff5733",
    color: "#ffffff",
    display: "grid",
    placeItems: "center",
    fontSize: "44px",
    fontWeight: 900,
    boxShadow: "0 18px 36px rgba(255, 87, 51, 0.26)",
  },

  adminInfoBox: {
    minWidth: 0,
  },

  smallLabel: {
    margin: "0 0 10px",
    color: "#ff5733",
    fontSize: "15px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  adminName: {
    margin: "0 0 10px",
    color: "#111827",
    fontSize: "38px",
    fontWeight: 900,
    lineHeight: 1.1,
    overflowWrap: "anywhere",
  },

  adminEmail: {
    margin: "0 0 18px",
    color: "#64748b",
    fontSize: "17px",
    fontWeight: 800,
    lineHeight: 1.35,
    overflowWrap: "anywhere",
  },

  badgeRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },

  roleBadge: {
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "10px 18px",
    fontSize: "14px",
    fontWeight: 900,
    textTransform: "capitalize",
  },

  departmentBadge: {
    background: "#fff1ed",
    color: "#ff5733",
    borderRadius: "999px",
    padding: "10px 18px",
    fontSize: "14px",
    fontWeight: 900,
  },

  detailsBlock: {
    width: "100%",
    background: "#ffffff",
    borderRadius: "28px",
    padding: "34px",
    boxShadow: "0 18px 46px rgba(15, 23, 42, 0.07)",
  },

  sectionHeader: {
    marginBottom: "24px",
  },

  sectionTitle: {
    margin: "0 0 8px",
    color: "#111827",
    fontSize: "32px",
    fontWeight: 900,
  },

  sectionSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "16px",
    fontWeight: 700,
  },

  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "18px",
  },

  detailCard: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "20px",
    padding: "24px",
    minHeight: "118px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "10px",
  },

  detailLabel: {
    color: "#64748b",
    fontSize: "14px",
    fontWeight: 900,
  },

  detailValue: {
    color: "#111827",
    fontSize: "19px",
    fontWeight: 900,
    lineHeight: 1.35,
    overflowWrap: "anywhere",
    textTransform: "none",
  },
};

export default AdminProfile;
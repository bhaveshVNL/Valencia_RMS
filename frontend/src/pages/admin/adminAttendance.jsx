import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";

const getInitials = (name) => {
  const cleanName = String(name || "User").trim();

  const initials = cleanName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "U";
};

const getStatusBadgeStyle = (status) => {
  const value = String(status || "").toLowerCase();

  if (value === "present") return { ...styles.statusBadge, ...styles.presentBadge };
  if (value === "absent") return { ...styles.statusBadge, ...styles.absentBadge };
  if (value === "late") return { ...styles.statusBadge, ...styles.lateBadge };
  if (value === "leave") return { ...styles.statusBadge, ...styles.leaveBadge };

  return styles.statusBadge;
};

const SummaryBox = ({ label, value, compact = false }) => {
  return (
    <div style={compact ? styles.compactSummaryBox : styles.summaryBox}>
      <span style={compact ? styles.compactSummaryLabel : styles.summaryLabel}>
        {label}
      </span>
      <strong style={compact ? styles.compactSummaryValue : styles.summaryValue}>
        {value ?? 0}
      </strong>
    </div>
  );
};

const AdminAttendance = () => {
  const [activeTab, setActiveTab] = useState("myAttendance");

  const [myAttendance, setMyAttendance] = useState(null);
  const [employeeSummary, setEmployeeSummary] = useState([]);
  const [dateRange, setDateRange] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/admin-attendance/department-attendance");

      setMyAttendance(response.data?.my_attendance || null);
      setEmployeeSummary(response.data?.employee_summary || []);
      setDateRange(response.data?.date_range || null);
    } catch (err) {
      console.error("Fetch admin attendance error:", err);

      setError(
        err?.response?.data?.sqlMessage ||
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to fetch admin attendance."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  const filteredEmployees = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    if (!term) return employeeSummary;

    return employeeSummary.filter((employee) => {
      return (
        String(employee.full_name || "").toLowerCase().includes(term) ||
        String(employee.email || "").toLowerCase().includes(term) ||
        String(employee.department_name || "").toLowerCase().includes(term)
      );
    });
  }, [employeeSummary, searchTerm]);

  const myRecords = useMemo(() => {
    return Array.isArray(myAttendance?.records) ? myAttendance.records : [];
  }, [myAttendance]);

  const EmployeeCard = ({ employee }) => {
    return (
      <div style={styles.employeeCard}>
        <div style={styles.employeeTop}>
          <div style={styles.employeeAvatar}>{getInitials(employee.full_name)}</div>

          <div style={styles.employeeInfo}>
            <h3 style={styles.employeeName}>{employee.full_name || "-"}</h3>
            <p style={styles.employeeEmail}>{employee.email || "-"}</p>
            <span style={styles.employeeDepartment}>
              {employee.department_name || "-"}
            </span>
          </div>
        </div>

        <div style={styles.employeeStatsGrid}>
          <SummaryBox compact label="Working Days" value={employee.total} />
          <SummaryBox compact label="Present" value={employee.present} />
          <SummaryBox compact label="Absent" value={employee.absent} />
          <SummaryBox compact label="Late" value={employee.late} />
          <SummaryBox compact label="Leave" value={employee.leave} />
        </div>

        <div style={styles.employeeBottom}>
          <strong>Latest Attendance:</strong>{" "}
          <span>{employee.latest_attendance_date || "-"}</span>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.page}>
      {error && <div style={styles.errorBox}>{error}</div>}

      <section style={styles.tabBlock}>
        <button
          type="button"
          style={
            activeTab === "myAttendance"
              ? styles.activeTabButton
              : styles.tabButton
          }
          onClick={() => setActiveTab("myAttendance")}
        >
          My Attendance
        </button>

        <button
          type="button"
          style={
            activeTab === "employeeSummary"
              ? styles.activeTabButton
              : styles.tabButton
          }
          onClick={() => setActiveTab("employeeSummary")}
        >
          Employee Summary
        </button>
      </section>

      {activeTab === "myAttendance" && (
        <section style={styles.contentBlock}>
          <div style={styles.myAttendanceHeader}>
            <div style={styles.myAvatar}>{getInitials(myAttendance?.full_name)}</div>

            <div style={styles.myDetails}>
              <p style={styles.smallLabel}>My Attendance</p>
              <h2 style={styles.myName}>{myAttendance?.full_name || "-"}</h2>
              <p style={styles.myEmail}>{myAttendance?.email || "-"}</p>

              <span style={styles.myDepartment}>
                <strong style={styles.myDepartmentText}>
                  {myAttendance?.department_name || "-"}
                </strong>
              </span>
            </div>
          </div>

          <div style={styles.myStatsGrid}>
            <SummaryBox label="Working Days" value={myAttendance?.total || 0} />
            <SummaryBox label="Present" value={myAttendance?.present || 0} />
            <SummaryBox label="Absent" value={myAttendance?.absent || 0} />
            <SummaryBox label="Late" value={myAttendance?.late || 0} />
            <SummaryBox label="Leave" value={myAttendance?.leave || 0} />
          </div>

          <div style={styles.sectionTitleRow}>
            <div>
              <h2 style={styles.sectionTitle}>My Attendance Records</h2>
              <p style={styles.sectionSubtitle}>
                Absent is calculated from missing dates only. Sundays are not counted.
              </p>
            </div>
          </div>

          <div style={styles.tableBlock}>
            {loading ? (
              <div style={styles.emptyBox}>Loading attendance...</div>
            ) : myRecords.length === 0 ? (
              <div style={styles.emptyBox}>No attendance records found.</div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Check In</th>
                    <th style={styles.th}>Check Out</th>
                    <th style={styles.th}>Working Hours</th>
                    <th style={styles.th}>Remarks</th>
                  </tr>
                </thead>

                <tbody>
                  {myRecords.map((record) => (
                    <tr
                      key={`${record.attendance_date}-${record.attendance_id || "missing"}`}
                    >
                      <td style={styles.td}>{record.attendance_date || "-"}</td>
                      <td style={styles.td}>
                        <span style={getStatusBadgeStyle(record.status)}>
                          {record.status || "-"}
                        </span>
                      </td>
                      <td style={styles.td}>{record.check_in_time || "-"}</td>
                      <td style={styles.td}>{record.check_out_time || "-"}</td>
                      <td style={styles.td}>{record.working_hours || "-"}</td>
                      <td style={styles.td}>{record.remarks || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {activeTab === "employeeSummary" && (
        <section style={styles.contentBlock}>

  <div style={styles.employeeSummaryHeader}>

    <div>
      <h2 style={styles.sectionTitle}>
        {employeeSummary[0]?.department_name || "Department"} Users
      </h2>

      <p style={styles.sectionSubtitle}>
        Employee attendance management
      </p>
    </div>

    <button
      type="button"
      style={styles.refreshButton}
      onClick={fetchAttendance}
    >
      Refresh
    </button>

  </div>


  <div style={styles.searchRow}>

    <input
      style={styles.searchInput}
      type="text"
      placeholder="Search employee, email, department..."
      value={searchTerm}
      onChange={(event) => setSearchTerm(event.target.value)}
    />


    <div style={styles.totalBadge}>
      Total: {filteredEmployees.length}
    </div>

  </div>

          {loading ? (
            <div style={styles.emptyBox}>Loading employee summary...</div>
          ) : filteredEmployees.length === 0 ? (
            <div style={styles.emptyBox}>No employees found.</div>
          ) : (
            <div style={styles.employeeGrid}>
              {filteredEmployees.map((employee) => (
                <EmployeeCard employee={employee} key={employee.user_id} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

const styles = {
  page: {
  width: "100%",
  flex: 1,
  minHeight: "100%",

  boxSizing: "border-box",

  margin: 0,
  padding: "18px 20px 32px",
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

  tabBlock: {
    background: "#ffffff",
    borderRadius: "24px",
    padding: "22px",
    boxShadow: "0 14px 36px rgba(15, 23, 42, 0.06)",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginBottom: "26px",
  },

  tabButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#111827",
    borderRadius: "16px",
    padding: "16px 28px",
    fontSize: "17px",
    fontWeight: 900,
    cursor: "pointer",
  },

  activeTabButton: {
    border: "1px solid #ff5733",
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "16px",
    padding: "16px 28px",
    fontSize: "17px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 12px 26px rgba(255, 87, 51, 0.22)",
  },

  contentBlock: {
  width: "100%",
  boxSizing: "border-box",

  background: "#ffffff",
  borderRadius: "28px",

  padding: "32px 38px",

  boxShadow: "0 18px 46px rgba(15, 23, 42, 0.07)",
},

  myAttendanceHeader: {
    display: "grid",
    gridTemplateColumns: "96px 1fr",
    gap: "22px",
    alignItems: "center",
    marginBottom: "24px",
  },

  myAvatar: {
    width: "96px",
    height: "96px",
    borderRadius: "24px",
    background: "#ff5733",
    color: "#ffffff",
    display: "grid",
    placeItems: "center",
    fontSize: "34px",
    fontWeight: 900,
    boxShadow: "0 16px 34px rgba(255, 87, 51, 0.25)",
  },

  myDetails: {
    minWidth: 0,
  },

  smallLabel: {
    margin: "0 0 8px",
    color: "#ff5733",
    fontSize: "14px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  myName: {
    margin: "0 0 6px",
    color: "#111827",
    fontSize: "32px",
    fontWeight: 900,
    lineHeight: 1.15,
  },

  myEmail: {
    margin: "0 0 8px",
    color: "#64748b",
    fontSize: "16px",
    fontWeight: 900,
    overflowWrap: "anywhere",
  },

  myDepartment: {
    display: "inline-flex",
    alignItems: "center",
    background: "#fff1ed",
    color: "#ff5733",
    borderRadius: "999px",
    padding: "8px 16px",
    maxwidth: "auto",
flex: 1,
  },

  myDepartmentText: {
    color: "#ff5733",
    fontSize: "16px",
    fontWeight: 900,
    lineHeight: 1,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  myStatsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "14px",
    marginBottom: "30px",
  },

  summaryBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "18px",
    minHeight: "92px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "8px",
  },

  summaryLabel: {
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 900,
  },

  summaryValue: {
    color: "#111827",
    fontSize: "28px",
    fontWeight: 900,
    lineHeight: 1,
  },

  compactSummaryBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "12px 10px",
    minHeight: "86px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "8px",
    minWidth: 0,
  },

  compactSummaryLabel: {
    color: "#64748b",
    fontSize: "11px",
    fontWeight: 900,
    lineHeight: 1.15,
    wordBreak: "normal",
    whiteSpace: "normal",
  },

  compactSummaryValue: {
    color: "#111827",
    fontSize: "24px",
    fontWeight: 900,
    lineHeight: 1,
  },

  sectionTitleRow: {
    marginBottom: "20px",
  },
  employeeSummaryHeader: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "20px",
},

searchRow: {
  display: "flex",
  alignItems: "center",
  gap: "18px",
  marginBottom: "24px",
},

refreshButton: {
  border: "none",
  background: "#ff5733",
  color: "#ffffff",
  borderRadius: "14px",
  padding: "12px 24px",
  fontSize: "14px",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(255,87,51,0.22)",
},

totalBadge: {
  background: "#111827",
  color: "#ffffff",
  borderRadius: "999px",
  padding: "12px 20px",
  fontSize: "15px",
  fontWeight: 900,
  whiteSpace: "nowrap",
},



  sectionTitle: {
    margin: "0 0 8px",
    color: "#111827",
    fontSize: "30px",
    fontWeight: 900,
  },

  sectionSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "15px",
    fontWeight: 700,
    lineHeight: 1.45,
  },

  searchInput: {
    width: "auto",
flex: 1,
    height: "58px",
    border: "1.5px solid #cbd5e1",
    borderRadius: "16px",
    background: "#ffffff",
    padding: "0 22px",
    fontSize: "16px",
    fontWeight: 800,
    color: "#111827",
    outline: "none",
    marginBottom: "24px",
    boxSizing: "border-box",
  },

  tableBlock: {
  width: "100%",
  overflowX: "auto",
},

  table: {
  width: "100%",
  borderCollapse: "collapse",
},

  th: {
    textAlign: "left",
    color: "#64748b",
    background: "#f8fafc",
    padding: "16px",
    fontSize: "14px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  td: {
    borderTop: "1px solid #eef2f7",
    padding: "16px",
    color: "#111827",
    fontSize: "14px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  statusBadge: {
    borderRadius: "999px",
    padding: "7px 12px",
    fontSize: "12px",
    fontWeight: 900,
    textAlign: "center",
    display: "inline-block",
  },

  presentBadge: {
    background: "#dcfce7",
    color: "#15803d",
  },

  absentBadge: {
    background: "#fee2e2",
    color: "#b91c1c",
  },

  lateBadge: {
    background: "#fef3c7",
    color: "#b45309",
  },

  leaveBadge: {
    background: "#e0f2fe",
    color: "#0369a1",
  },

  employeeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "22px",
  },

  employeeCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)",
    minWidth: 0,
    overflow: "hidden",
  },

  employeeTop: {
    display: "grid",
    gridTemplateColumns: "64px minmax(0, 1fr)",
    gap: "16px",
    alignItems: "center",
    marginBottom: "22px",
  },

  employeeAvatar: {
    width: "64px",
    height: "64px",
    borderRadius: "16px",
    background: "#111827",
    color: "#ffffff",
    display: "grid",
    placeItems: "center",
    fontSize: "22px",
    fontWeight: 900,
    flexShrink: 0,
  },

  employeeInfo: {
    minWidth: 0,
  },

  employeeName: {
    margin: "0 0 6px",
    color: "#111827",
    fontSize: "22px",
    fontWeight: 900,
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  employeeEmail: {
    margin: "0 0 6px",
    color: "#64748b",
    fontSize: "14px",
    fontWeight: 800,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  employeeDepartment: {
    display: "inline-flex",
    alignItems: "center",
    background: "#fff1ed",
    color: "#ff5733",
    borderRadius: "999px",
    padding: "7px 13px",
    fontSize: "14px",
    fontWeight: 900,
    maxwidth: "auto",
flex: 1,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },

  employeeStatsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "10px",
    marginBottom: "16px",
  },

  employeeBottom: {
    color: "#111827",
    fontSize: "14px",
    fontWeight: 800,
  },

  emptyBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: "16px",
    padding: "28px",
    textAlign: "center",
    color: "#94a3b8",
    fontWeight: 900,
    background: "#f8fafc",
  },
};

export default AdminAttendance;
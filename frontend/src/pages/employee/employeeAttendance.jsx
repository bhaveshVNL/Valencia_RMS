import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, RefreshCw, Search } from "lucide-react";
import api from "../../api/axios";

const getResponseData = (response) => {
  return response?.data?.data || response?.data || {};
};

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  return [];
};

const normalizeStatus = (status) => {
  const value = String(status || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (value === "present") return "present";
  if (value === "absent") return "absent";
  if (value === "late") return "late";
  if (value === "leave") return "leave";
  if (value === "half_day") return "half_day";

  return value || "absent";
};

const formatStatus = (status) => {
  const value = normalizeStatus(status);

  if (value === "present") return "Present";
  if (value === "absent") return "Absent";
  if (value === "late") return "Late";
  if (value === "leave") return "Leave";
  if (value === "half_day") return "Half Day";

  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getStatusStyle = (status) => {
  const value = normalizeStatus(status);

  if (value === "present") {
    return {
      background: "#dcfce7",
      color: "#166534",
    };
  }

  if (value === "absent") {
    return {
      background: "#fee2e2",
      color: "#991b1b",
    };
  }

  if (value === "late") {
    return {
      background: "#fef3c7",
      color: "#92400e",
    };
  }

  if (value === "leave") {
    return {
      background: "#e0e7ff",
      color: "#3730a3",
    };
  }

  return {
    background: "#eef2ff",
    color: "#334155",
  };
};

const normalizeAttendanceResponse = (rawData) => {
  const data = rawData || {};

  const profile =
    data.profile ||
    data.employee ||
    data.user ||
    data.employee_profile ||
    {};

  const summary =
    data.summary ||
    data.stats ||
    data.attendance_summary ||
    {};

  const attendance =
    data.attendance ||
    data.records ||
    data.attendance_records ||
    data.rows ||
    [];

  return {
    profile,
    summary,
    attendance: asArray(attendance),
  };
};

const getDateOnly = (dateValue) => {
  if (!dateValue) return "";

  const value = String(dateValue);

  if (value.includes("T")) return value.split("T")[0];

  return value.slice(0, 10);
};

const getCurrentWeekRange = () => {
  const today = new Date();
  const day = today.getDay();

  const mondayOffset = day === 0 ? -6 : 1 - day;

  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);

  const toDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const dayValue = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${dayValue}`;
  };

  return {
    start: toDateString(monday),
    end: toDateString(saturday),
  };
};

const isCurrentMonth = (dateValue) => {
  const dateString = getDateOnly(dateValue);
  if (!dateString) return false;

  const today = new Date();
  const currentMonth = String(today.getMonth() + 1).padStart(2, "0");
  const currentYear = String(today.getFullYear());

  return dateString.startsWith(`${currentYear}-${currentMonth}`);
};

const EmployeeAttendance = () => {
  const [profile, setProfile] = useState({});
  const [summary, setSummary] = useState({
    total_records: 0,
    present: 0,
    absent: 0,
    late: 0,
    leave: 0,
  });

  const [attendance, setAttendance] = useState([]);
  const [activeRange, setActiveRange] = useState("week");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchAttendance = async () => {
    setLoading(true);
    setError("");

    try {
      let response;

      try {
        response = await api.get("/employee-attendance");
      } catch {
        response = await api.get("/employee-attendance/my");
      }

      const normalized = normalizeAttendanceResponse(getResponseData(response));

      setProfile(normalized.profile || {});
      setSummary({
        total_records:
          normalized.summary.total_records ||
          normalized.summary.totalRecords ||
          normalized.attendance.length ||
          0,
        present: normalized.summary.present || 0,
        absent: normalized.summary.absent || 0,
        late: normalized.summary.late || 0,
        leave: normalized.summary.leave || 0,
      });
      setAttendance(normalized.attendance);
    } catch (err) {
      console.error("Employee attendance frontend error:", err);

      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to fetch employee attendance."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  const filteredAttendance = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const weekRange = getCurrentWeekRange();

    return attendance.filter((row) => {
      const rowDate = getDateOnly(row.attendance_date || row.date);

      const matchesRange =
        activeRange === "all" ||
        (activeRange === "month" && isCurrentMonth(rowDate)) ||
        (activeRange === "week" &&
          rowDate >= weekRange.start &&
          rowDate <= weekRange.end);

      const rowStatus = normalizeStatus(row.status || row.attendance_status);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "absent_leave" &&
          (rowStatus === "absent" || rowStatus === "leave")) ||
        rowStatus === statusFilter;

      const searchableText = [
        rowDate,
        rowStatus,
        row.check_in_time,
        row.check_out_time,
        row.working_hours,
        row.remarks,
        row.day_name,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);

      return matchesRange && matchesStatus && matchesSearch;
    });
  }, [attendance, activeRange, statusFilter, searchText]);

  const visibleSummary = useMemo(() => {
    const totalRecords = filteredAttendance.length;

    const present = filteredAttendance.filter(
      (row) => normalizeStatus(row.status) === "present"
    ).length;

    const absent = filteredAttendance.filter(
      (row) => normalizeStatus(row.status) === "absent"
    ).length;

    const late = filteredAttendance.filter(
      (row) => normalizeStatus(row.status) === "late"
    ).length;

    const leave = filteredAttendance.filter(
      (row) => normalizeStatus(row.status) === "leave"
    ).length;

    return {
      total_records: totalRecords,
      present,
      absent,
      late,
      leave,
    };
  }, [filteredAttendance]);

  const summaryToShow = activeRange === "all" && !searchText && statusFilter === "all"
    ? summary
    : visibleSummary;

  return (
    <div style={styles.page}>
      <div style={styles.topActions}>
        <button
          type="button"
          style={styles.refreshBtn}
          onClick={fetchAttendance}
          disabled={loading}
        >
          <RefreshCw size={18} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

<section style={styles.profileCard}>
  <div style={styles.profileBox}>
    <span style={styles.profileLabel}>Employee</span>
    <strong style={styles.profileValue}>
      {profile.full_name || profile.name || "-"}
    </strong>
  </div>

  <div style={styles.profileBox}>
    <span style={styles.profileLabel}>Email</span>
    <strong style={styles.profileEmailValue}>
      {profile.email || "-"}
    </strong>
  </div>

  <div style={styles.profileBox}>
    <span style={styles.profileLabel}>Department</span>
    <strong style={styles.profileValue}>
      {profile.department_name || profile.department || "-"}
    </strong>
  </div>

  <div style={styles.profileBox}>
    <span style={styles.profileLabel}>Designation</span>
    <strong style={styles.profileValue}>
      {profile.designation || "-"}
    </strong>
  </div>
</section>

      <div style={styles.tabs}>
        <button
          type="button"
          style={{
            ...styles.tabBtn,
            ...(activeRange === "week" ? styles.activeTabBtn : {}),
          }}
          onClick={() => setActiveRange("week")}
        >
          This Week
        </button>

        <button
          type="button"
          style={{
            ...styles.tabBtn,
            ...(activeRange === "month" ? styles.activeTabBtn : {}),
          }}
          onClick={() => setActiveRange("month")}
        >
          This Month
        </button>

        <button
          type="button"
          style={{
            ...styles.tabBtn,
            ...(activeRange === "all" ? styles.activeTabBtn : {}),
          }}
          onClick={() => setActiveRange("all")}
        >
          All Records
        </button>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <strong>{summaryToShow.total_records || 0}</strong>
          <span>Total Records</span>
        </div>

        <div style={styles.statCard}>
          <strong>{summaryToShow.present || 0}</strong>
          <span>Present</span>
        </div>

        <div style={styles.statCard}>
          <strong>{summaryToShow.absent || 0}</strong>
          <span>Absent</span>
        </div>

        <div style={styles.statCard}>
          <strong>{summaryToShow.late || 0}</strong>
          <span>Late</span>
        </div>

        <div style={styles.statCard}>
          <strong>{summaryToShow.leave || 0}</strong>
          <span>Leave</span>
        </div>
      </div>

      <div style={styles.filterRow}>
        <div style={styles.searchBox}>
          <Search size={18} color="#64748b" />
          <input
            style={styles.searchInput}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search date, status, time, remarks..."
          />
        </div>

        <select
          style={styles.select}
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">All Status</option>
          <option value="present">Present</option>
          <option value="absent_leave">Absent / Leave</option>
          <option value="late">Late</option>
        </select>
      </div>

      <section style={styles.tableCard}>
        {filteredAttendance.length === 0 ? (
          <div style={styles.emptyBox}>
            No attendance records found for this employee.
          </div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Day</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Check In</th>
                  <th style={styles.th}>Check Out</th>
                  <th style={styles.th}>Working Hours</th>
                  <th style={styles.th}>Remarks</th>
                </tr>
              </thead>

              <tbody>
                {filteredAttendance.map((row, index) => {
                  const status = normalizeStatus(row.status);
                  const statusStyle = getStatusStyle(status);

                  return (
                    <tr key={row.attendance_id || `${row.attendance_date}-${index}`}>
                      <td style={styles.td}>
                        <strong>{getDateOnly(row.attendance_date || row.date)}</strong>
                      </td>

                      <td style={styles.td}>
                        {row.day_name || "-"}
                      </td>

                      <td style={styles.td}>
                        <span style={{ ...styles.statusBadge, ...statusStyle }}>
                          {formatStatus(status)}
                        </span>
                      </td>

                      <td style={styles.td}>{row.check_in_time || "-"}</td>
                      <td style={styles.td}>{row.check_out_time || "-"}</td>
                      <td style={styles.td}>{row.working_hours || "-"}</td>
                      <td style={styles.td}>{row.remarks || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

const styles = {
  page: {
    width: "100%",
    padding: 0,
  },

  topActions: {
    width: "100%",
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: "22px",
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

  profileCard: {
    background: "#ffffff",
    borderRadius: "26px",
    padding: "26px",
    marginBottom: "24px",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)",
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "18px",
  },

profileBox: {
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  borderRadius: "18px",
  padding: "18px 20px",
  minHeight: "94px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: "10px",
  minWidth: 0,
  overflow: "hidden",
},

  tabs: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginBottom: "24px",
    flexWrap: "wrap",
  },

  tabBtn: {
    border: "none",
    background: "#ffffff",
    color: "#111827",
    borderRadius: "16px",
    padding: "16px 28px",
    fontSize: "16px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 26px rgba(15, 23, 42, 0.05)",
  },

  activeTabBtn: {
    background: "#ff5733",
    color: "#ffffff",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "18px",
    marginBottom: "24px",
  },

  statCard: {
    background: "#ffffff",
    borderRadius: "20px",
    padding: "22px",
    minHeight: "105px",
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "12px",
  },

  filterRow: {
    display: "grid",
    gridTemplateColumns: "1fr 230px",
    gap: "14px",
    marginBottom: "24px",
  },

  searchBox: {
    height: "58px",
    background: "#ffffff",
    border: "1px solid #d6dde8",
    borderRadius: "16px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "0 18px",
  },

  searchInput: {
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: "15px",
    fontWeight: 700,
    color: "#111827",
  },

  select: {
    height: "58px",
    background: "#ffffff",
    border: "1px solid #d6dde8",
    borderRadius: "16px",
    padding: "0 18px",
    fontSize: "15px",
    fontWeight: 800,
    color: "#111827",
    outline: "none",
  },

  tableCard: {
    background: "#ffffff",
    borderRadius: "26px",
    padding: "26px",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)",
  },

  tableWrap: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  th: {
    textAlign: "left",
    padding: "16px",
    color: "#64748b",
    fontSize: "14px",
    fontWeight: 900,
    borderBottom: "1px solid #e5e7eb",
  },

  td: {
    padding: "18px 16px",
    color: "#111827",
    fontSize: "15px",
    borderBottom: "1px solid #eef2f7",
    verticalAlign: "middle",
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "999px",
    padding: "8px 14px",
    fontSize: "13px",
    fontWeight: 900,
    minWidth: "82px",
  },

  emptyBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: "18px",
    padding: "32px",
    textAlign: "center",
    color: "#64748b",
    fontSize: "16px",
    fontWeight: 900,
    background: "#f8fafc",
  },

  profileLabel: {
  color: "#64748b",
  fontSize: "14px",
  fontWeight: 900,
  lineHeight: 1.2,
},

profileValue: {
  color: "#111827",
  fontSize: "17px",
  fontWeight: 900,
  lineHeight: 1.3,
  maxWidth: "100%",
  overflowWrap: "break-word",
  wordBreak: "break-word",
},

profileEmailValue: {
  color: "#111827",
  fontSize: "13px",
  fontWeight: 900,
  lineHeight: 1.35,
  maxWidth: "100%",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
},
};

export default EmployeeAttendance;
import { useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
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
  const [attendanceView, setAttendanceView] =
  useState("attendance");

const [fieldVisits, setFieldVisits] = useState([]);

const [visitSummary, setVisitSummary] = useState({
  total: 0,
  approved: 0,
  pending: 0,
  rejected: 0,
});

const [visitSearch, setVisitSearch] = useState("");
const [visitStatus, setVisitStatus] = useState("all");

const [showVisitModal, setShowVisitModal] =
  useState(false);

const [savingVisit, setSavingVisit] =
  useState(false);

const [visitError, setVisitError] = useState("");
const [visitSuccess, setVisitSuccess] =
  useState("");

const [visitForm, setVisitForm] = useState({
  visit_type: "Sales Visit",
  visit_date: "",
  start_time: "",
  end_time: "",
  location: "",
  comment: "",
});

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

  const fetchFieldVisits = async () => {
  try {
    const response = await api.get(
      "/employee-attendance/field-visits"
    );

    setFieldVisits(
      Array.isArray(response.data?.visits)
        ? response.data.visits
        : []
    );

    setVisitSummary({
      total: Number(
        response.data?.summary?.total || 0
      ),
      approved: Number(
        response.data?.summary?.approved || 0
      ),
      pending: Number(
        response.data?.summary?.pending || 0
      ),
      rejected: Number(
        response.data?.summary?.rejected || 0
      ),
    });
  } catch (err) {
    console.error(
      "Field visits fetch error:",
      err
    );

    setVisitError(
      err?.response?.data?.message ||
        "Failed to fetch field visits."
    );
  }
};
const submitFieldVisit = async () => {
  setVisitError("");
  setVisitSuccess("");

  if (
    !visitForm.visit_date ||
    !visitForm.start_time ||
    !visitForm.end_time ||
    !visitForm.location.trim() ||
    !visitForm.comment.trim()
  ) {
    setVisitError(
      "Please fill all required fields."
    );
    return;
  }

  if (
    visitForm.end_time <=
    visitForm.start_time
  ) {
    setVisitError(
      "End time must be later than start time."
    );
    return;
  }

  try {
    setSavingVisit(true);

    await api.post(
      "/employee-attendance/field-visits",
      {
        visit_type: visitForm.visit_type,
        visit_date: visitForm.visit_date,
        start_time: visitForm.start_time,
        end_time: visitForm.end_time,
        location: visitForm.location.trim(),
        comment: visitForm.comment.trim(),
      }
    );

    setVisitForm({
      visit_type: "Sales Visit",
      visit_date: "",
      start_time: "",
      end_time: "",
      location: "",
      comment: "",
    });

    setShowVisitModal(false);

    setVisitSuccess(
      "Field visit submitted for approval."
    );

    await fetchFieldVisits();
  } catch (err) {
    setVisitError(
      err?.response?.data?.message ||
        "Failed to submit field visit."
    );
  } finally {
    setSavingVisit(false);
  }
};
  useEffect(() => {
    fetchAttendance();
    fetchFieldVisits();
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

    const filteredFieldVisits = useMemo(() => {
  const query =
    visitSearch.trim().toLowerCase();

  return fieldVisits.filter((visit) => {
    const status = String(
      visit.status || ""
    ).toLowerCase();

    const matchesStatus =
      visitStatus === "all" ||
      status === visitStatus;

    const matchesSearch =
      !query ||
      [
        visit.visit_date,
        visit.visit_type,
        visit.location,
        visit.comment,
        visit.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);

    return matchesStatus && matchesSearch;
  });
}, [
  fieldVisits,
  visitSearch,
  visitStatus,
]);
  return (
    <div style={styles.page}>
     <div style={styles.topActions}>
  <div style={styles.viewSwitch}>
    <button
      type="button"
      style={{
        ...styles.viewSwitchBtn,
        ...(attendanceView === "attendance"
          ? styles.viewSwitchActive
          : {}),
      }}
      onClick={() =>
        setAttendanceView("attendance")
      }
    >
      Attendance
    </button>

    <button
      type="button"
      style={{
        ...styles.viewSwitchBtn,
        ...(attendanceView === "fieldVisits"
          ? styles.viewSwitchActive
          : {}),
      }}
      onClick={() => {
        setAttendanceView("fieldVisits");
        fetchFieldVisits();
      }}
    >
      Field Visits
    </button>
  </div>

  {attendanceView === "fieldVisits" && (
    <button
      type="button"
      style={styles.addVisitBtn}
      onClick={() => {
        setVisitError("");
        setShowVisitModal(true);
      }}
    >
      <Plus size={18} />
      Add Visit
    </button>
  )}

  <button
    type="button"
    style={styles.refreshBtn}
    onClick={() => {
      if (
        attendanceView ===
        "fieldVisits"
      ) {
        fetchFieldVisits();
      } else {
        fetchAttendance();
      }
    }}
  >
    <RefreshCw size={18} />
    Refresh
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
   {attendanceView === "attendance" && (
  <>

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
      </>
    )}
{attendanceView === "fieldVisits" && (
  <>
    {visitError && (
      <div style={styles.errorBox}>
        {visitError}
      </div>
    )}

    {visitSuccess && (
      <div style={styles.visitSuccess}>
        {visitSuccess}
      </div>
    )}

    <div style={styles.visitStatsGrid}>
      <div style={styles.statCard}>
        <strong>{visitSummary.total}</strong>
        <span>Total Visits</span>
      </div>

      <div style={styles.statCard}>
        <strong>
          {visitSummary.approved}
        </strong>
        <span>Approved</span>
      </div>

      <div style={styles.statCard}>
        <strong>
          {visitSummary.pending}
        </strong>
        <span>Pending</span>
      </div>

      <div style={styles.statCard}>
        <strong>
          {visitSummary.rejected}
        </strong>
        <span>Rejected</span>
      </div>
    </div>

    <div style={styles.filterRow}>
      <div style={styles.searchBox}>
        <Search
          size={18}
          color="#64748b"
        />

        <input
          style={styles.searchInput}
          value={visitSearch}
          onChange={(event) =>
            setVisitSearch(
              event.target.value
            )
          }
          placeholder="Search location, type or reason..."
        />
      </div>

      <select
        style={styles.select}
        value={visitStatus}
        onChange={(event) =>
          setVisitStatus(
            event.target.value
          )
        }
      >
        <option value="all">
          All Status
        </option>

        <option value="pending">
          Pending
        </option>

        <option value="approved">
          Approved
        </option>

        <option value="rejected">
          Rejected
        </option>
      </select>
    </div>

    <section style={styles.tableCard}>
      {filteredFieldVisits.length ===
      0 ? (
        <div style={styles.emptyBox}>
          No field visits found.
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>
                  Date
                </th>

                <th style={styles.th}>
                  Type
                </th>

                <th style={styles.th}>
                  Time
                </th>

                <th style={styles.th}>
                  Location
                </th>

                <th style={styles.th}>
                  Reason
                </th>

                <th style={styles.th}>
                  Status
                </th>

                <th style={styles.th}>
                  Admin Remark
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredFieldVisits.map(
                (visit) => {
                  const status =
                    String(
                      visit.status ||
                        "pending"
                    ).toLowerCase();

                  return (
                    <tr
                      key={
                        visit.visit_id
                      }
                    >
                      <td
                        style={styles.td}
                      >
                        <strong>
                          {
                            visit.visit_date
                          }
                        </strong>
                      </td>

                      <td
                        style={styles.td}
                      >
                        {
                          visit.visit_type
                        }
                      </td>

                      <td
                        style={styles.td}
                      >
                        {
                          visit.start_time
                        }{" "}
                        -{" "}
                        {
                          visit.end_time
                        }
                      </td>

                      <td
                        style={styles.td}
                      >
                        <div
                          style={
                            styles.locationCell
                          }
                        >
                          <MapPin
                            size={15}
                          />
                          {
                            visit.location
                          }
                        </div>
                      </td>

                      <td
                        style={styles.td}
                      >
                        {visit.comment}
                      </td>

                      <td
                        style={styles.td}
                      >
                        <span
                          style={{
                            ...styles.visitStatusBadge,

                            ...(status ===
                            "approved"
                              ? styles.visitApproved
                              : status ===
                                "rejected"
                              ? styles.visitRejected
                              : styles.visitPending),
                          }}
                        >
                          {status
                            .charAt(0)
                            .toUpperCase() +
                            status.slice(
                              1
                            )}
                        </span>
                      </td>

                      <td
                        style={styles.td}
                      >
                        {visit.review_remark ||
                          "-"}
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  </>
)}
{showVisitModal && (
  <div
    style={styles.modalOverlay}
    onMouseDown={(event) => {
      if (
        event.target ===
        event.currentTarget
      ) {
        setShowVisitModal(false);
      }
    }}
  >
    <div style={styles.visitModal}>
      <div style={styles.modalHeader}>
        <div>
          <h2 style={styles.modalTitle}>
            Add Field Visit
          </h2>

          <p style={styles.modalSubtitle}>
            Add your outside sales or
            business visit details.
          </p>
        </div>

        <button
          type="button"
          style={styles.closeBtn}
          onClick={() =>
            setShowVisitModal(false)
          }
        >
          <X size={20} />
        </button>
      </div>

      {visitError && (
        <div style={styles.errorBox}>
          {visitError}
        </div>
      )}

      <div style={styles.visitFormGrid}>
        <label style={styles.formGroup}>
          <span>Visit Type *</span>

          <select
            style={styles.formInput}
            value={
              visitForm.visit_type
            }
            onChange={(event) =>
              setVisitForm(
                (previous) => ({
                  ...previous,
                  visit_type:
                    event.target.value,
                })
              )
            }
          >
            <option value="Sales Visit">
              Sales Visit
            </option>

            <option value="Client Visit">
              Client Visit
            </option>

            <option value="Market Visit">
              Market Visit
            </option>

            <option value="Vendor Visit">
              Vendor Visit
            </option>
          </select>
        </label>

        <label style={styles.formGroup}>
          <span>Date *</span>

          <input
            type="date"
            style={styles.formInput}
            value={
              visitForm.visit_date
            }
            onChange={(event) =>
              setVisitForm(
                (previous) => ({
                  ...previous,
                  visit_date:
                    event.target.value,
                })
              )
            }
          />
        </label>

        <label style={styles.formGroup}>
          <span>Start Time *</span>

          <input
            type="time"
            style={styles.formInput}
            value={
              visitForm.start_time
            }
            onChange={(event) =>
              setVisitForm(
                (previous) => ({
                  ...previous,
                  start_time:
                    event.target.value,
                })
              )
            }
          />
        </label>

        <label style={styles.formGroup}>
          <span>End Time *</span>

          <input
            type="time"
            style={styles.formInput}
            value={
              visitForm.end_time
            }
            onChange={(event) =>
              setVisitForm(
                (previous) => ({
                  ...previous,
                  end_time:
                    event.target.value,
                })
              )
            }
          />
        </label>
      </div>

      <label style={styles.formGroup}>
        <span>Location *</span>

        <input
          type="text"
          style={styles.formInput}
          placeholder="Example: Vashi, Navi Mumbai"
          value={visitForm.location}
          onChange={(event) =>
            setVisitForm(
              (previous) => ({
                ...previous,
                location:
                  event.target.value,
              })
            )
          }
        />
      </label>

      <label style={styles.formGroup}>
        <span>
          Comment / Reason *
        </span>

        <textarea
          style={styles.formTextarea}
          placeholder="Example: Distributor meeting for Vitalize products..."
          value={visitForm.comment}
          onChange={(event) =>
            setVisitForm(
              (previous) => ({
                ...previous,
                comment:
                  event.target.value,
              })
            )
          }
        />
      </label>

      <div style={styles.modalFooter}>
        <button
          type="button"
          style={styles.modalCancelBtn}
          onClick={() =>
            setShowVisitModal(false)
          }
        >
          Cancel
        </button>

        <button
          type="button"
          style={styles.modalSubmitBtn}
          disabled={savingVisit}
          onClick={submitFieldVisit}
        >
          {savingVisit
            ? "Submitting..."
            : "Submit Visit"}
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
    padding: 0,
  },
topActions: {
  width: "100%",
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: "12px",
  marginBottom: "22px",
},

  viewSwitch: {
  display: "flex",
  alignItems: "center",
  padding: "4px",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  borderRadius: "14px",
},

viewSwitchBtn: {
  height: "44px",
  padding: "0 20px",
  border: "none",
  borderRadius: "11px",
  background: "transparent",
  color: "#64748b",
  fontSize: "14px",
  fontWeight: 900,
  cursor: "pointer",
},

viewSwitchActive: {
  background: "#fff0eb",
  color: "#ff5733",
},

addVisitBtn: {
  height: "52px",
  padding: "0 22px",
  border: "1px solid #ff5733",
  borderRadius: "16px",
  background: "#ffffff",
  color: "#ff5733",
  fontSize: "15px",
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  cursor: "pointer",
},

visitStatsGrid: {
  display: "grid",
  gridTemplateColumns:
    "repeat(4, minmax(0, 1fr))",
  gap: "18px",
  marginBottom: "24px",
},

visitSuccess: {
  background: "#dcfce7",
  border: "1px solid #bbf7d0",
  color: "#166534",
  borderRadius: "16px",
  padding: "14px 18px",
  fontWeight: 800,
  marginBottom: "20px",
},

locationCell: {
  display: "flex",
  alignItems: "center",
  gap: "7px",
},

visitStatusBadge: {
  display: "inline-flex",
  padding: "7px 12px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 900,
},

visitApproved: {
  background: "#dcfce7",
  color: "#166534",
},

visitPending: {
  background: "#fef3c7",
  color: "#92400e",
},

visitRejected: {
  background: "#fee2e2",
  color: "#b91c1c",
},

modalOverlay: {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  background:
    "rgba(15, 23, 42, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
},

visitModal: {
  width: "min(620px, 95vw)",
  maxHeight: "90vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: "24px",
  padding: "26px",
  boxShadow:
    "0 30px 80px rgba(15, 23, 42, 0.25)",
},

modalHeader: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "20px",
  marginBottom: "22px",
},

modalTitle: {
  margin: "0 0 6px",
  color: "#111827",
  fontSize: "26px",
  fontWeight: 900,
},

modalSubtitle: {
  margin: 0,
  color: "#64748b",
  fontSize: "14px",
},

closeBtn: {
  width: "42px",
  height: "42px",
  border: "none",
  borderRadius: "12px",
  background: "#f1f5f9",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
},

visitFormGrid: {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: "14px",
},

formGroup: {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  marginBottom: "15px",
  color: "#111827",
  fontSize: "13px",
  fontWeight: 900,
},

formInput: {
  width: "100%",
  height: "48px",
  boxSizing: "border-box",
  border: "1px solid #d6dde8",
  borderRadius: "12px",
  padding: "0 13px",
  background: "#ffffff",
  outline: "none",
  fontSize: "14px",
},

formTextarea: {
  width: "100%",
  minHeight: "110px",
  boxSizing: "border-box",
  border: "1px solid #d6dde8",
  borderRadius: "12px",
  padding: "13px",
  resize: "vertical",
  outline: "none",
  fontSize: "14px",
  fontFamily: "inherit",
},

modalFooter: {
  borderTop: "1px solid #e5e7eb",
  marginTop: "8px",
  paddingTop: "18px",
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
},

modalCancelBtn: {
  height: "46px",
  padding: "0 22px",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  background: "#ffffff",
  color: "#111827",
  fontWeight: 900,
  cursor: "pointer",
},

modalSubmitBtn: {
  height: "46px",
  padding: "0 24px",
  border: "none",
  borderRadius: "12px",
  background: "#ff5733",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
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
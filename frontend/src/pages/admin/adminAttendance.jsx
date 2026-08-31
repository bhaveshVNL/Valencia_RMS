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
  const [fieldVisitMode, setFieldVisitMode] = useState("team");
const [teamVisits, setTeamVisits] = useState([]);
const [myVisits, setMyVisits] = useState([]);
const [visitSearch, setVisitSearch] = useState("");
const [visitStatus, setVisitStatus] = useState("all");
const [visitLoading, setVisitLoading] = useState(false);
const [visitError, setVisitError] = useState("");
const [visitMessage, setVisitMessage] = useState("");

const [showVisitModal, setShowVisitModal] = useState(false);
const [savingVisit, setSavingVisit] = useState(false);

const [visitForm, setVisitForm] = useState({
  visit_type: "Sales Visit",
  visit_date: "",
  start_time: "",
  end_time: "",
  location: "",
  comment: "",
});
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
const fetchTeamVisits = async () => {
  try {
    setVisitLoading(true);
    setVisitError("");

    const response = await api.get(
      "/admin-attendance/field-visits"
    );

    let visits = Array.isArray(response.data?.visits)
      ? response.data.visits
      : [];

    // Do not show Admin's own visit under Team Visits.
    const adminId = Number(myAttendance?.user_id || 0);

    if (adminId) {
      visits = visits.filter(
        (visit) => Number(visit.employee_id) !== adminId
      );
    }

    setTeamVisits(visits);
  } catch (err) {
    console.error("Fetch team field visits error:", err);

    setVisitError(
      err?.response?.data?.message ||
        "Failed to fetch team field visits."
    );
  } finally {
    setVisitLoading(false);
  }
};

const fetchMyVisits = async () => {
  try {
    setVisitLoading(true);
    setVisitError("");

    const response = await api.get(
      "/admin-attendance/field-visits/my"
    );

    setMyVisits(
      Array.isArray(response.data?.visits)
        ? response.data.visits
        : []
    );
  } catch (err) {
    console.error("Fetch Admin field visits error:", err);

    setVisitError(
      err?.response?.data?.message ||
        "Failed to fetch your field visits."
    );
  } finally {
    setVisitLoading(false);
  }
};

const fetchFieldVisits = async () => {
  await Promise.all([
    fetchTeamVisits(),
    fetchMyVisits(),
  ]);
};

const submitAdminVisit = async () => {
  setVisitError("");
  setVisitMessage("");

  if (
    !visitForm.visit_date ||
    !visitForm.start_time ||
    !visitForm.end_time ||
    !visitForm.location.trim() ||
    !visitForm.comment.trim()
  ) {
    setVisitError("Please fill all required fields.");
    return;
  }

  if (visitForm.end_time <= visitForm.start_time) {
    setVisitError("End time must be later than start time.");
    return;
  }

  try {
    setSavingVisit(true);

    await api.post(
      "/admin-attendance/field-visits",
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
    setFieldVisitMode("my");
    setVisitMessage("Field visit added successfully.");

    await fetchMyVisits();
  } catch (err) {
    setVisitError(
      err?.response?.data?.message ||
        "Failed to add field visit."
    );
  } finally {
    setSavingVisit(false);
  }
};

const reviewVisit = async (visit, status) => {
  let remark = "";

  if (status === "rejected") {
    remark = window.prompt(
      `Reason for rejecting ${visit.full_name || "employee"}'s visit:`
    );

    if (remark === null) return;

    if (!remark.trim()) {
      setVisitError("Rejection remark is required.");
      return;
    }
  }

  try {
    setVisitError("");
    setVisitMessage("");

    await api.post(
      `/admin-attendance/field-visits/${visit.visit_id}/review`,
      {
        status,
        review_remark: remark.trim(),
      }
    );

    setVisitMessage(
      status === "approved"
        ? "Field visit approved successfully."
        : "Field visit rejected."
    );

    await fetchTeamVisits();
  } catch (err) {
    setVisitError(
      err?.response?.data?.message ||
        "Failed to review field visit."
    );
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
  const currentVisits =
  fieldVisitMode === "team" ? teamVisits : myVisits;

const visitSummary = useMemo(() => {
  return {
    total: currentVisits.length,

    approved: currentVisits.filter(
      (visit) => String(visit.status).toLowerCase() === "approved"
    ).length,

    pending: currentVisits.filter(
      (visit) => String(visit.status).toLowerCase() === "pending"
    ).length,

    rejected: currentVisits.filter(
      (visit) => String(visit.status).toLowerCase() === "rejected"
    ).length,
  };
}, [currentVisits]);

const filteredVisits = useMemo(() => {
  const query = visitSearch.trim().toLowerCase();

  return currentVisits.filter((visit) => {
    const status = String(visit.status || "").toLowerCase();

    const matchesStatus =
      visitStatus === "all" || status === visitStatus;

    const searchable = [
      visit.full_name,
      visit.employee_code,
      visit.visit_type,
      visit.visit_date,
      visit.start_time,
      visit.end_time,
      visit.location,
      visit.comment,
      visit.status,
    ]
      .join(" ")
      .toLowerCase();

    return (
      matchesStatus &&
      (!query || searchable.includes(query))
    );
  });
}, [currentVisits, visitSearch, visitStatus]);

const employeeVisitSummary = useMemo(() => {
  const map = {};

  teamVisits.forEach((visit) => {
    const id = visit.employee_id;

    if (!map[id]) {
      map[id] = {
        employee_id: id,
        full_name: visit.full_name || "Employee",
        employee_code: visit.employee_code || "-",
        total: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
      };
    }

    map[id].total += 1;

    const status = String(visit.status || "").toLowerCase();

    if (status === "approved") map[id].approved += 1;
    if (status === "pending") map[id].pending += 1;
    if (status === "rejected") map[id].rejected += 1;
  });

  return Object.values(map);
}, [teamVisits]);
const pendingTeamVisits = useMemo(() => {
  return teamVisits.filter(
    (visit) =>
      String(visit.status || "").toLowerCase() === "pending"
  );
}, [teamVisits]);
useEffect(() => {
  if (!visitMessage) return;

  const timer = setTimeout(() => {
    setVisitMessage("");
  }, 3000);

  return () => clearTimeout(timer);
}, [visitMessage]);

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

        <button
  type="button"
  style={
    activeTab === "fieldVisits"
      ? styles.activeTabButton
      : styles.tabButton
  }
  onClick={() => {
    setActiveTab("fieldVisits");
    fetchFieldVisits();
  }}
>
  Field Visits
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
     {activeTab === "fieldVisits" && (
  <section style={styles.contentBlock}>
    {/* HEADER */}
    <div style={styles.visitHeader}>
      <div>
        <h2 style={styles.sectionTitle}>Field Visits</h2>

        <p style={styles.sectionSubtitle}>
          Manage your department field visits and your own visits.
        </p>
      </div>

    <div style={styles.visitHeaderActions}>
  {fieldVisitMode === "my" && (
    <button
      type="button"
      style={styles.outlineVisitButton}
      onClick={() => {
        setVisitError("");
        setVisitMessage("");
        setShowVisitModal(true);
      }}
    >
      + Add Visit
    </button>
  )}

  <button
    type="button"
    style={styles.refreshButton}
    onClick={fetchFieldVisits}
  >
    Refresh
  </button>
</div>
    </div>

    {/* TEAM / MY */}
    <div style={styles.visitSwitch}>
      <button
        type="button"
        style={{
          ...styles.visitSwitchButton,
          ...(fieldVisitMode === "team"
            ? styles.visitSwitchActive
            : {}),
        }}
        onClick={() => {
          setFieldVisitMode("team");
          setVisitSearch("");
          setVisitStatus("all");
          fetchTeamVisits();
        }}
      >
        Team Visits
      </button>

      <button
        type="button"
        style={{
          ...styles.visitSwitchButton,
          ...(fieldVisitMode === "my"
            ? styles.visitSwitchActive
            : {}),
        }}
        onClick={() => {
          setFieldVisitMode("my");
          setVisitSearch("");
          setVisitStatus("all");
          fetchMyVisits();
        }}
      >
        My Visits
      </button>
    </div>

    {visitError && (
      <div style={styles.errorBox}>
        {visitError}
      </div>
    )}

    {visitMessage && (
      <div style={styles.visitSuccessBox}>
        {visitMessage}
      </div>
    )}

    {/* =====================================================
        TEAM VISITS
    ===================================================== */}

    {fieldVisitMode === "team" && (
      <>
        {/* 1. ACTION REQUIRED FIRST */}
        <div style={styles.actionSection}>
          <div style={styles.actionSectionHeader}>
            <div>
              <h3 style={styles.actionSectionTitle}>
                Action Required
              </h3>

              <p style={styles.sectionSubtitle}>
                Pending field visits waiting for your review.
              </p>
            </div>

            <span style={styles.actionCount}>
              {pendingTeamVisits.length} Pending
            </span>
          </div>

          <div style={styles.visitTableBox}>
            {visitLoading ? (
              <div style={styles.emptyBox}>
                Loading pending visits...
              </div>
            ) : pendingTeamVisits.length === 0 ? (
              <div style={styles.noActionBox}>
                No pending field visits. You're all caught up.
              </div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Employee</th>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Visit Details</th>
                    <th style={styles.actionTh}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {pendingTeamVisits.map((visit) => (
                    <tr key={visit.visit_id}>
                      <td style={styles.td}>
                        <strong>
                          {visit.full_name || "-"}
                        </strong>

                        {visit.employee_code && (
                          <div style={styles.visitSecondaryText}>
                            Code: {visit.employee_code}
                          </div>
                        )}
                      </td>

                      <td style={styles.td}>
                        <strong>
                          {visit.visit_date || "-"}
                        </strong>
                      </td>

                      <td style={styles.visitDetailsTd}>
                        <strong style={styles.visitTypeText}>
                          {visit.visit_type || "-"}
                        </strong>

                        <div style={styles.visitDetailLine}>
                          {visit.start_time || "-"} -{" "}
                          {visit.end_time || "-"}
                        </div>

                        <div style={styles.visitDetailLine}>
                          {visit.location || "-"}
                        </div>

                        <div style={styles.visitReasonText}>
                          {visit.comment || "-"}
                        </div>
                      </td>

                      <td style={styles.actionTd}>
                        <div style={styles.visitActionButtons}>
                          <button
                            type="button"
                            style={styles.approveVisitButton}
                            onClick={() =>
                              reviewVisit(visit, "approved")
                            }
                          >
                            Approve
                          </button>

                          <button
                            type="button"
                            style={styles.rejectVisitButton}
                            onClick={() =>
                              reviewVisit(visit, "rejected")
                            }
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 2. TOTAL SUMMARY */}
        <div style={styles.visitStatsGrid}>
          <SummaryBox
            label="Total Visits"
            value={visitSummary.total}
          />

          <SummaryBox
            label="Approved"
            value={visitSummary.approved}
          />

          <SummaryBox
            label="Pending"
            value={visitSummary.pending}
          />

          <SummaryBox
            label="Rejected"
            value={visitSummary.rejected}
          />
        </div>

        {/* 3. ALL FIELD VISITS */}
        <div style={styles.allVisitsHeader}>
          <div>
            <h3 style={styles.visitSubTitle}>
              All Field Visits
            </h3>

            <p style={styles.sectionSubtitle}>
              Complete history of your department field visits.
            </p>
          </div>
        </div>

        <div style={styles.visitFilterRow}>
          <input
            type="text"
            style={styles.visitSearchInput}
            placeholder="Search employee, location, reason..."
            value={visitSearch}
            onChange={(event) =>
              setVisitSearch(event.target.value)
            }
          />

          <select
            style={styles.visitStatusSelect}
            value={visitStatus}
            onChange={(event) =>
              setVisitStatus(event.target.value)
            }
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div style={styles.visitTableBox}>
          {visitLoading ? (
            <div style={styles.emptyBox}>
              Loading field visits...
            </div>
          ) : filteredVisits.length === 0 ? (
            <div style={styles.emptyBox}>
              No field visits found.
            </div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Employee</th>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Visit Details</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredVisits.map((visit) => {
                  const status = String(
                    visit.status || "pending"
                  ).toLowerCase();

                  return (
                    <tr key={visit.visit_id}>
                      <td style={styles.td}>
                        <strong>
                          {visit.full_name || "-"}
                        </strong>

                        {visit.employee_code && (
                          <div style={styles.visitSecondaryText}>
                            Code: {visit.employee_code}
                          </div>
                        )}
                      </td>

                      <td style={styles.td}>
                        <strong>
                          {visit.visit_date || "-"}
                        </strong>
                      </td>

                      <td style={styles.visitDetailsTd}>
                        <strong style={styles.visitTypeText}>
                          {visit.visit_type || "-"}
                        </strong>

                        <div style={styles.visitDetailLine}>
                          {visit.start_time || "-"} -{" "}
                          {visit.end_time || "-"}
                        </div>

                        <div style={styles.visitDetailLine}>
                          {visit.location || "-"}
                        </div>

                        <div style={styles.visitReasonText}>
                          {visit.comment || "-"}
                        </div>

                        {visit.review_remark && (
                          <div style={styles.reviewRemark}>
                            Remark: {visit.review_remark}
                          </div>
                        )}
                      </td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.visitStatusBadge,

                            ...(status === "approved"
                              ? styles.visitApproved
                              : status === "rejected"
                              ? styles.visitRejected
                              : styles.visitPending),
                          }}
                        >
                          {status.charAt(0).toUpperCase() +
                            status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 4. EMPLOYEE SUMMARY LAST */}
        <div style={styles.employeeVisitSummarySection}>
          <div style={styles.visitSubHeader}>
            <h3 style={styles.visitSubTitle}>
              Employee Visit Summary
            </h3>

            <p style={styles.sectionSubtitle}>
              Employee-wise totals for your department.
            </p>
          </div>

          <div style={styles.visitTableBox}>
            {employeeVisitSummary.length === 0 ? (
              <div style={styles.emptyBox}>
                No employee field visits found.
              </div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Employee</th>
                    <th style={styles.th}>Code</th>
                    <th style={styles.th}>Total</th>
                    <th style={styles.th}>Approved</th>
                    <th style={styles.th}>Pending</th>
                    <th style={styles.th}>Rejected</th>
                  </tr>
                </thead>

                <tbody>
                  {employeeVisitSummary.map((employee) => (
                    <tr key={employee.employee_id}>
                      <td style={styles.td}>
                        <strong>
                          {employee.full_name}
                        </strong>
                      </td>

                      <td style={styles.td}>
                        {employee.employee_code}
                      </td>

                      <td style={styles.td}>
                        {employee.total}
                      </td>

                      <td style={styles.td}>
                        {employee.approved}
                      </td>

                      <td style={styles.td}>
                        {employee.pending}
                      </td>

                      <td style={styles.td}>
                        {employee.rejected}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </>
    )}

    {/* =====================================================
        MY VISITS
    ===================================================== */}

    {fieldVisitMode === "my" && (
  <>
    <div style={styles.myVisitOverview}>
      <div>
        <h3 style={styles.myVisitTitle}>
          My Visit History
        </h3>

        <p style={styles.sectionSubtitle}>
          Your recorded field, sales and business visits.
        </p>
      </div>

      <div style={styles.myVisitCount}>
        <strong
          style={{
            fontSize: "24px",
            color: "#111827",
          }}
        >
          {myVisits.length}
        </strong>

        <span
          style={{
            color: "#64748b",
            fontSize: "12px",
            fontWeight: 800,
          }}
        >
          Recorded Visits
        </span>
      </div>
    </div>

    <div style={styles.myVisitSearchRow}>
      <input
        type="text"
        style={styles.myVisitSearchInput}
        placeholder="Search by visit type, location or reason..."
        value={visitSearch}
        onChange={(event) =>
          setVisitSearch(event.target.value)
        }
      />
    </div>

    <div style={styles.myVisitTableCard}>
      {visitLoading ? (
        <div style={styles.myVisitEmpty}>
          Loading your visits...
        </div>
      ) : filteredVisits.length === 0 ? (
        <div style={styles.myVisitEmpty}>
          <div style={styles.myVisitEmptyIcon}>
            ↗
          </div>

          <h3 style={styles.myVisitEmptyTitle}>
            No field visits yet
          </h3>

          <p style={styles.myVisitEmptyText}>
            Add your first field visit to start building your visit history.
          </p>

          <button
            type="button"
            style={styles.myVisitEmptyButton}
            onClick={() => {
              setVisitError("");
              setVisitMessage("");
              setShowVisitModal(true);
            }}
          >
            + Add First Visit
          </button>
        </div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Visit Details</th>
              <th style={styles.th}>Status</th>
            </tr>
          </thead>

          <tbody>
            {filteredVisits.map((visit) => (
              <tr key={visit.visit_id}>
                <td style={styles.myVisitDateTd}>
                  <strong>
                    {visit.visit_date || "-"}
                  </strong>
                </td>

                <td style={styles.myVisitDetailsTd}>
                  <div style={styles.myVisitType}>
                    {visit.visit_type || "-"}
                  </div>

                  <div style={styles.myVisitMeta}>
                    {visit.start_time || "-"}
                    {" • "}
                    {visit.end_time || "-"}
                  </div>

                  <div style={styles.myVisitLocation}>
                    {visit.location || "-"}
                  </div>

                  <div style={styles.myVisitReason}>
                    {visit.comment || "-"}
                  </div>
                </td>

                <td style={styles.td}>
                  <span style={styles.recordedBadge}>
                    Recorded
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </>
)}
  </section>
)}
{showVisitModal && (
  <div
    style={styles.visitModalOverlay}
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        setShowVisitModal(false);
      }
    }}
  >
    <div style={styles.visitModal}>
      <div style={styles.visitModalHeader}>
        <div>
          <h2 style={styles.visitModalTitle}>
            Add Field Visit
          </h2>

          <p style={styles.sectionSubtitle}>
            Add your sales, client or business visit.
          </p>
        </div>

        <button
          type="button"
          style={styles.visitCloseButton}
          onClick={() => setShowVisitModal(false)}
        >
          ×
        </button>
      </div>

      {visitError && (
        <div style={styles.errorBox}>{visitError}</div>
      )}

      <div style={styles.visitFormGrid}>
        <label style={styles.visitFormGroup}>
          <span>Visit Type *</span>

          <select
            style={styles.visitFormInput}
            value={visitForm.visit_type}
            onChange={(event) =>
              setVisitForm((previous) => ({
                ...previous,
                visit_type: event.target.value,
              }))
            }
          >
            <option value="Sales Visit">Sales Visit</option>
            <option value="Client Visit">Client Visit</option>
            <option value="Market Visit">Market Visit</option>
            <option value="Vendor Visit">Vendor Visit</option>
            <option value="Distributor Visit">
              Distributor Visit
            </option>
            <option value="Business Meeting">
              Business Meeting
            </option>
          </select>
        </label>

        <label style={styles.visitFormGroup}>
          <span>Date *</span>

          <input
            type="date"
            style={styles.visitFormInput}
            value={visitForm.visit_date}
            onChange={(event) =>
              setVisitForm((previous) => ({
                ...previous,
                visit_date: event.target.value,
              }))
            }
          />
        </label>

        <label style={styles.visitFormGroup}>
          <span>Start Time *</span>

          <input
            type="time"
            style={styles.visitFormInput}
            value={visitForm.start_time}
            onChange={(event) =>
              setVisitForm((previous) => ({
                ...previous,
                start_time: event.target.value,
              }))
            }
          />
        </label>

        <label style={styles.visitFormGroup}>
          <span>End Time *</span>

          <input
            type="time"
            style={styles.visitFormInput}
            value={visitForm.end_time}
            onChange={(event) =>
              setVisitForm((previous) => ({
                ...previous,
                end_time: event.target.value,
              }))
            }
          />
        </label>
      </div>

      <label style={styles.visitFormGroup}>
        <span>Location *</span>

        <input
          type="text"
          style={styles.visitFormInput}
          placeholder="Example: Vashi, Navi Mumbai"
          value={visitForm.location}
          onChange={(event) =>
            setVisitForm((previous) => ({
              ...previous,
              location: event.target.value,
            }))
          }
        />
      </label>

      <label style={styles.visitFormGroup}>
        <span>Comment / Reason *</span>

        <textarea
          style={styles.visitTextarea}
          placeholder="Purpose of visit..."
          value={visitForm.comment}
          onChange={(event) =>
            setVisitForm((previous) => ({
              ...previous,
              comment: event.target.value,
            }))
          }
        />
      </label>

      <div style={styles.visitModalFooter}>
        <button
          type="button"
          style={styles.visitCancelButton}
          onClick={() => setShowVisitModal(false)}
        >
          Cancel
        </button>

        <button
          type="button"
          style={styles.visitSubmitButton}
          disabled={savingVisit}
          onClick={submitAdminVisit}
        >
          {savingVisit ? "Adding..." : "Add Visit"}
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
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  padding: "5px",
  marginBottom: "26px",

  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",

  boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
},

tabButton: {
  border: "none",
  background: "transparent",
  color: "#64748b",

  borderRadius: "11px",
  padding: "13px 22px",

  fontSize: "14px",
  fontWeight: 900,

  cursor: "pointer",
  transition: "all 0.2s ease",

  minWidth: "155px",
},

activeTabButton: {
  border: "none",
  background: "#ff5733",
  color: "#ffffff",

  borderRadius: "11px",
  padding: "13px 22px",

  fontSize: "14px",
  fontWeight: 900,

  cursor: "pointer",

  minWidth: "155px",

  boxShadow: "0 7px 16px rgba(255, 87, 51, 0.22)",
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
  visitHeader: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "18px",
  marginBottom: "22px",
},

visitHeaderActions: {
  display: "flex",
  alignItems: "center",
  gap: "10px",
},

outlineVisitButton: {
  border: "1px solid #ff5733",
  background: "#ffffff",
  color: "#ff5733",
  borderRadius: "14px",
  padding: "12px 20px",
  fontSize: "14px",
  fontWeight: 900,
  cursor: "pointer",
},

visitSwitch: {
  display: "inline-flex",
  gap: "4px",
  padding: "4px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  marginBottom: "24px",
},

visitSwitchButton: {
  border: "none",
  background: "transparent",
  color: "#64748b",
  borderRadius: "10px",
  padding: "11px 20px",
  fontWeight: 900,
  cursor: "pointer",
},

visitSwitchActive: {
  background: "#ffffff",
  color: "#ff5733",
  boxShadow: "0 5px 14px rgba(15, 23, 42, 0.08)",
},

visitSuccessBox: {
  background: "#dcfce7",
  color: "#166534",
  border: "1px solid #bbf7d0",
  borderRadius: "14px",
  padding: "13px 16px",
  fontWeight: 800,
  marginBottom: "20px",
},

visitStatsGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "14px",
  marginBottom: "26px",
},

visitSubHeader: {
  marginBottom: "14px",
},

visitSubTitle: {
  margin: "0 0 5px",
  color: "#111827",
  fontSize: "20px",
  fontWeight: 900,
},

visitTableBox: {
  border: "1px solid #e5e7eb",
  borderRadius: "18px",
  overflowX: "auto",
  marginBottom: "24px",
},

visitFilterRow: {
  display: "grid",
  gridTemplateColumns: "1fr 220px",
  gap: "14px",
  marginBottom: "20px",
},

visitSearchInput: {
  height: "54px",
  border: "1px solid #d6dde8",
  borderRadius: "14px",
  padding: "0 16px",
  outline: "none",
  fontSize: "14px",
  fontWeight: 700,
},

visitStatusSelect: {
  height: "54px",
  border: "1px solid #d6dde8",
  borderRadius: "14px",
  padding: "0 14px",
  background: "#ffffff",
  outline: "none",
  fontWeight: 800,
},

visitTextTd: {
  borderTop: "1px solid #eef2f7",
  padding: "16px",
  color: "#111827",
  fontSize: "14px",
  fontWeight: 700,
  whiteSpace: "normal",
  minWidth: "150px",
  maxWidth: "260px",
},

visitStatusBadge: {
  display: "inline-flex",
  borderRadius: "999px",
  padding: "7px 12px",
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

visitActionButtons: {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: "7px",
  whiteSpace: "nowrap",
},

approveVisitButton: {
  border: "none",
  background: "#16a34a",
  color: "#ffffff",
  borderRadius: "9px",
  padding: "8px 11px",
  fontWeight: 900,
  cursor: "pointer",
},

rejectVisitButton: {
  border: "none",
  background: "#ef4444",
  color: "#ffffff",
  borderRadius: "9px",
  padding: "8px 11px",
  fontWeight: 900,
  cursor: "pointer",
},

reviewedVisitText: {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 800,
},

visitModalOverlay: {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  background: "rgba(15, 23, 42, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "22px",
},

visitModal: {
  width: "min(620px, 95vw)",
  maxHeight: "90vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: "24px",
  padding: "26px",
  boxShadow: "0 30px 80px rgba(15, 23, 42, 0.25)",
},

visitModalHeader: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "20px",
},

visitModalTitle: {
  margin: "0 0 6px",
  color: "#111827",
  fontSize: "25px",
  fontWeight: 900,
},

visitCloseButton: {
  width: "40px",
  height: "40px",
  border: "none",
  borderRadius: "11px",
  background: "#f1f5f9",
  color: "#111827",
  fontSize: "24px",
  cursor: "pointer",
},

visitFormGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "14px",
},

visitFormGroup: {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  marginBottom: "15px",
  color: "#111827",
  fontSize: "13px",
  fontWeight: 900,
},

visitFormInput: {
  width: "100%",
  height: "48px",
  boxSizing: "border-box",
  border: "1px solid #d6dde8",
  borderRadius: "12px",
  padding: "0 13px",
  background: "#ffffff",
  outline: "none",
},

visitTextarea: {
  width: "100%",
  minHeight: "105px",
  boxSizing: "border-box",
  border: "1px solid #d6dde8",
  borderRadius: "12px",
  padding: "13px",
  outline: "none",
  resize: "vertical",
  fontFamily: "inherit",
},

visitModalFooter: {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  paddingTop: "16px",
  borderTop: "1px solid #e5e7eb",
},

visitCancelButton: {
  height: "44px",
  padding: "0 20px",
  border: "1px solid #d1d5db",
  borderRadius: "11px",
  background: "#ffffff",
  color: "#111827",
  fontWeight: 900,
  cursor: "pointer",
},

visitSubmitButton: {
  height: "44px",
  padding: "0 22px",
  border: "none",
  borderRadius: "11px",
  background: "#ff5733",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
},
actionSection: {
  marginBottom: "28px",
},

actionSectionHeader: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  marginBottom: "14px",
},

actionSectionTitle: {
  margin: "0 0 5px",
  color: "#111827",
  fontSize: "22px",
  fontWeight: 900,
},

actionCount: {
  background: "#fff7ed",
  color: "#ea580c",
  border: "1px solid #fed7aa",
  borderRadius: "999px",
  padding: "8px 14px",
  fontSize: "13px",
  fontWeight: 900,
  whiteSpace: "nowrap",
},

noActionBox: {
  padding: "24px",
  textAlign: "center",
  color: "#15803d",
  background: "#f0fdf4",
  fontSize: "14px",
  fontWeight: 900,
},

actionTh: {
  textAlign: "right",
  color: "#64748b",
  background: "#f8fafc",
  padding: "16px",
  fontSize: "13px",
  fontWeight: 900,
  whiteSpace: "nowrap",
  width: "190px",
},

actionTd: {
  borderTop: "1px solid #eef2f7",
  padding: "16px",
  textAlign: "right",
  width: "190px",
  verticalAlign: "middle",
},

visitDetailsTd: {
  borderTop: "1px solid #eef2f7",
  padding: "16px",
  color: "#111827",
  verticalAlign: "middle",
  width: "48%",
},

visitTypeText: {
  display: "block",
  color: "#111827",
  fontSize: "14px",
  fontWeight: 900,
  marginBottom: "6px",
},

visitDetailLine: {
  color: "#475569",
  fontSize: "13px",
  fontWeight: 700,
  lineHeight: 1.5,
},

visitReasonText: {
  color: "#111827",
  fontSize: "13px",
  fontWeight: 800,
  marginTop: "5px",
  lineHeight: 1.45,
},

visitSecondaryText: {
  marginTop: "4px",
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: 700,
},

reviewRemark: {
  marginTop: "7px",
  padding: "7px 9px",
  background: "#f8fafc",
  borderRadius: "8px",
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 700,
},

allVisitsHeader: {
  marginBottom: "14px",
},

employeeVisitSummarySection: {
  marginTop: "30px",
},
myVisitOverview: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  padding: "20px 22px",
  marginBottom: "18px",
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  borderRadius: "18px",
},

myVisitTitle: {
  margin: "0 0 5px",
  color: "#111827",
  fontSize: "20px",
  fontWeight: 900,
},

myVisitCount: {
  minWidth: "145px",
  padding: "12px 18px",
  borderRadius: "14px",
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: "4px",
},

myVisitSearchRow: {
  marginBottom: "18px",
},

myVisitSearchInput: {
  width: "100%",
  height: "52px",
  boxSizing: "border-box",
  border: "1px solid #d6dde8",
  borderRadius: "14px",
  padding: "0 18px",
  background: "#ffffff",
  color: "#111827",
  outline: "none",
  fontSize: "14px",
  fontWeight: 700,
},

myVisitTableCard: {
  border: "1px solid #e5e7eb",
  borderRadius: "18px",
  overflow: "hidden",
  background: "#ffffff",
},

myVisitEmpty: {
  minHeight: "220px",
  padding: "34px 20px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  background: "#fbfcfe",
},

myVisitEmptyIcon: {
  width: "46px",
  height: "46px",
  borderRadius: "14px",
  display: "grid",
  placeItems: "center",
  marginBottom: "12px",
  background: "#fff1ed",
  color: "#ff5733",
  fontSize: "23px",
  fontWeight: 900,
},

myVisitEmptyTitle: {
  margin: "0 0 6px",
  color: "#111827",
  fontSize: "17px",
  fontWeight: 900,
},

myVisitEmptyText: {
  margin: "0 0 18px",
  color: "#64748b",
  fontSize: "13px",
  fontWeight: 700,
},

myVisitEmptyButton: {
  height: "42px",
  padding: "0 18px",
  border: "none",
  borderRadius: "11px",
  background: "#ff5733",
  color: "#ffffff",
  fontSize: "13px",
  fontWeight: 900,
  cursor: "pointer",
},

myVisitDateTd: {
  borderTop: "1px solid #eef2f7",
  padding: "18px",
  color: "#111827",
  fontSize: "14px",
  width: "180px",
  verticalAlign: "top",
},

myVisitDetailsTd: {
  borderTop: "1px solid #eef2f7",
  padding: "18px",
  color: "#111827",
  verticalAlign: "top",
},

myVisitType: {
  fontSize: "15px",
  fontWeight: 900,
  color: "#111827",
  marginBottom: "5px",
},

myVisitMeta: {
  color: "#64748b",
  fontSize: "13px",
  fontWeight: 800,
  marginBottom: "4px",
},

myVisitLocation: {
  color: "#334155",
  fontSize: "13px",
  fontWeight: 800,
  marginBottom: "5px",
},

myVisitReason: {
  color: "#64748b",
  fontSize: "13px",
  fontWeight: 700,
},

recordedBadge: {
  display: "inline-flex",
  padding: "7px 13px",
  borderRadius: "999px",
  background: "#e8f7ee",
  color: "#15803d",
  fontSize: "12px",
  fontWeight: 900,
},
};

export default AdminAttendance;
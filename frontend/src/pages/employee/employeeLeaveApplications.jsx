import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  RefreshCw,
  Send,
  X,
} from "lucide-react";

import HolidayCalendarModal from "../../components/employee/HolidayCalendarModal";
import LeaveInstructionsModal from "../../components/employee/LeaveInstructionsModal";
import api from "../../api/axios";

const EMPTY_FORM = {
  start_date: "",
  end_date: "",
  duration_type: "full_day",
  half_day_session: "first_half",
  reason: "",
};

const EmployeeLeaveApplications = () => {
  const [balances, setBalances] = useState({
    sick: {
      label: "Sick Leave",
      total: 7,
      earned: 7,
      used: 0,
      pending: 0,
      available: 7,
      remaining: 7,
    },
    casual: {
      label: "Casual Leave",
      total: 7,
      earned: 7,
      used: 0,
      pending: 0,
      available: 7,
      remaining: 7,
    },
    mandatory: {
      label: "Privileged Leave",
      monthly_credit: 1.5,
      annual_entitlement: 18,
      earned: 0,
      used: 0,
      pending: 0,
      available: 0,
      remaining: 0,
    },
  });

  const [applications, setApplications] = useState([]);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [selectedLeaveType, setSelectedLeaveType] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showInstructions, setShowInstructions] =
    useState(false);

  const [showHolidayCalendar, setShowHolidayCalendar] =
    useState(false);

  const [holidaySummary, setHolidaySummary] = useState({
    max_optional: 4,
    selected_count: 0,
    holidays: [],
  });

const [holidayLoading, setHolidayLoading] =
  useState(false);

  const getTomorrowDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const minimumLeaveDate = getTomorrowDate();

  const formatDisplayDate = (value) => {
    if (!value) return "-";

    const cleanDate = String(value).slice(0, 10);
    const parts = cleanDate.split("-");

    if (parts.length !== 3) return cleanDate;

    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  };

  const formatDays = (value) => {
    const number = Number(value || 0);

    return Number.isInteger(number)
      ? String(number)
      : number.toFixed(1);
  };

  const getLeaveLabel = (type) => {
    if (type === "sick") return "Sick Leave";
    if (type === "casual") return "Casual Leave";
    if (type === "mandatory") return "Privileged Leave";

    return type || "-";
  };

  const getDurationLabel = (application) => {
    if (application.duration_type !== "half_day") {
      return "Full Day";
    }

    if (application.half_day_session === "first_half") {
      return "Half Day · First Half";
    }

    if (application.half_day_session === "second_half") {
      return "Half Day · Second Half";
    }

    return "Half Day";
  };

  const calculateDays = useMemo(() => {
    if (form.duration_type === "half_day") {
      return form.start_date ? 0.5 : 0;
    }

    if (!form.start_date || !form.end_date) return 0;

    const start = new Date(`${form.start_date}T00:00:00`);
    const end = new Date(`${form.end_date}T00:00:00`);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end < start
    ) {
      return 0;
    }

    return (
      Math.floor(
        (end.getTime() - start.getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1
    );
  }, [form.start_date, form.end_date, form.duration_type]);

  const filteredApplications = useMemo(() => {
    if (historyFilter === "all") return applications;

    return applications.filter(
      (application) =>
        String(application.status || "").toLowerCase() ===
        historyFilter
    );
  }, [applications, historyFilter]);

  const fetchLeaveData = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        "/employee-leaves/summary"
      );

      if (response.data?.balances) {
        setBalances(response.data.balances);
      }

      setApplications(
        Array.isArray(response.data?.applications)
          ? response.data.applications
          : []
      );
    } catch (err) {
      console.error("Fetch employee leave data error:", err);

      setError(
        err?.response?.data?.sqlMessage ||
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to load leave information."
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchHolidaySummary = async () => {
  try {
    setHolidayLoading(true);

    const response = await api.get(
      "/employee-leaves/holidays"
    );

    setHolidaySummary({
      max_optional: Number(
        response.data?.max_optional || 4
      ),

      selected_count: Number(
        response.data?.selected_count || 0
      ),

      holidays: Array.isArray(
        response.data?.holidays
      )
        ? response.data.holidays
        : [],
    });
  } catch (err) {
    console.error(
      "Fetch holiday summary error:",
      err
    );
  } finally {
    setHolidayLoading(false);
  }
};

  useEffect(() => {
    fetchLeaveData();
    fetchHolidaySummary();
  }, []);

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
  };

  const openApplyModal = (leaveType) => {
    setSelectedLeaveType(leaveType);
    resetForm();
    setError("");
    setSuccess("");
  };

  const closeApplyModal = () => {
    setSelectedLeaveType(null);
    resetForm();
    setError("");
  };

  const handleDurationChange = (durationType) => {
    setForm((previous) => ({
      ...previous,
      duration_type: durationType,
      end_date:
        durationType === "half_day"
          ? previous.start_date
          : previous.end_date,
      half_day_session:
        durationType === "half_day"
          ? previous.half_day_session || "first_half"
          : "first_half",
    }));

    setError("");
  };

 const handleApply = async () => {
  if (!selectedLeaveType) return;

  setError("");
  setSuccess("");

  if (!form.start_date) {
    setError("Please select the leave date.");
    return;
  }

  if (form.start_date < minimumLeaveDate) {
    setError(
      "Leave must be applied for at least 1 day in advance."
    );
    return;
  }

  if (form.duration_type === "full_day") {
    if (!form.end_date) {
      setError("Please select the end date.");
      return;
    }

    if (form.end_date < form.start_date) {
      setError(
        "Leave end date cannot be before start date."
      );
      return;
    }
  }

  if (
    form.duration_type === "half_day" &&
    !["first_half", "second_half"].includes(
      form.half_day_session
    )
  ) {
    setError(
      "Please select First Half or Second Half."
    );
    return;
  }

  if (!form.reason.trim()) {
    setError(
      "Please enter the reason for leave."
    );
    return;
  }

  if (calculateDays <= 0) {
    setError(
      "Unable to calculate leave days."
    );
    return;
  }

  const currentBalance =
    balances[selectedLeaveType];

  const available = Number(
    currentBalance?.available ??
      currentBalance?.remaining ??
      0
  );

  if (calculateDays > available) {
    setError(
      `You only have ${formatDays(
        available
      )} day(s) currently available.`
    );
    return;
  }

  try {
    setSubmitting(true);

    const response = await api.post(
      "/employee-leaves/apply",
      {
        leave_type:
          selectedLeaveType,

        start_date:
          form.start_date,

        end_date:
          form.duration_type === "half_day"
            ? form.start_date
            : form.end_date,

        duration_type:
          form.duration_type,

        half_day_session:
          form.duration_type === "half_day"
            ? form.half_day_session
            : null,

        reason:
          form.reason.trim(),
      }
    );

    const email =
      response.data?.email;

    if (
      email &&
      email.sent === false &&
      email.skipped === false
    ) {
      setSuccess(
        "Leave submitted successfully, but email notification could not be sent."
      );
    } else if (
      email &&
      email.sent === false &&
      email.skipped === true
    ) {
      setSuccess(
        "Leave submitted successfully. Email notification was skipped."
      );
    } else {
      setSuccess(
        response.data?.message ||
          "Leave application submitted successfully."
      );
    }

    await fetchLeaveData();

    setSelectedLeaveType(null);
    resetForm();
  } catch (err) {
    if (
      !err?.response ||
      err.response.status >= 500
    ) {
      console.error(
        "Apply employee leave error:",
        err
      );
    }

    setError(
      err?.response?.data?.sqlMessage ||
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Failed to submit leave application."
    );
  } finally {
    setSubmitting(false);
  }
};

  const leaveCards = [
    {
      key: "sick",
      title: "Sick Leave",
      description: "Annual sick leave entitlement",
    },
    {
      key: "casual",
      title: "Casual Leave",
      description: "Annual casual leave entitlement",
    },
    {
      key: "mandatory",
      title: "Privileged Leave",
      description: "1.5 days credited monthly",
    },
  ];

  const selectedAvailable = selectedLeaveType
    ? Number(
        balances[selectedLeaveType]?.available ??
          balances[selectedLeaveType]?.remaining ??
          0
      )
    : 0;

  
  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
  <div>
    <h1 style={styles.pageTitle}>
      Leave Applications
    </h1>

    <p style={styles.pageSubtitle}>
      Apply for leave and track your available balance.
    </p>
  </div>

  <div style={styles.topActions}>
    <button
      type="button"
      style={styles.calendarIconBtn}
      onClick={() =>
        setShowHolidayCalendar(true)
      }
      title="Holiday Calendar"
    >
      <CalendarDays size={20} />
    </button>

    <button
      type="button"
      style={styles.instructionBtn}
      onClick={() =>
        setShowInstructions(true)
      }
    >
      Leave Instructions
    </button>

    <button
      type="button"
      style={styles.refreshBtn}
      onClick={fetchLeaveData}
      disabled={loading}
    >
      <RefreshCw size={18} />

      {loading
        ? "Refreshing..."
        : "Refresh"}
    </button>
  </div>
</div>

      {error && !selectedLeaveType && (
        <div style={styles.errorBox}>{error}</div>
      )}

      {success && (
        <div style={styles.successBox}>{success}</div>
      )}

      <div style={styles.leaveGrid}>
        {leaveCards.map((leave) => {
          const balance = balances[leave.key] || {};
          const isPrivileged = leave.key === "mandatory";

          const available = Number(
            balance.available ?? balance.remaining ?? 0
          );

          const used = Number(balance.used || 0);
          const pending = Number(balance.pending || 0);

          const total = isPrivileged
            ? Number(balance.earned || 0)
            : Number(
                balance.total || balance.earned || 0
              );

          const progress =
            total > 0
              ? Math.min(
                  100,
                  (available / total) * 100
                )
              : 0;

          return (
            <div style={styles.leaveCard} key={leave.key}>
              <div style={styles.cardIcon}>
                <CalendarDays size={24} />
              </div>

              <h2 style={styles.leaveTitle}>
                {leave.title}
              </h2>

              <p style={styles.leaveDescription}>
                {leave.description}
              </p>

              <div style={styles.balanceGrid}>
                <div style={styles.balanceStat}>
                  <strong style={styles.totalNumber}>
                    {formatDays(total)}
                  </strong>
                  <span>Total</span>
                </div>

                <div style={styles.balanceStat}>
                  <strong style={styles.usedNumber}>
                    {formatDays(used)}
                  </strong>
                  <span>Used</span>
                </div>

                <div style={styles.balanceStat}>
                  <strong style={styles.pendingNumber}>
                    {formatDays(pending)}
                  </strong>
                  <span>Pending</span>
                </div>

                <div style={styles.balanceStat}>
                  <strong style={styles.availableNumber}>
                    {formatDays(available)}
                  </strong>
                  <span>Available</span>
                </div>
              </div>

              <div style={styles.balanceProgressTrack}>
                <div
                  style={{
                    ...styles.balanceProgressFill,
                    width: `${progress}%`,
                  }}
                />
              </div>

              <p style={styles.availableText}>
                {formatDays(available)} of{" "}
                {formatDays(total)} days available
              </p>

              {isPrivileged && (
                <div style={styles.privilegedInfo}>
                  <span>
                    Annual entitlement:{" "}
                    <strong>18 days</strong>
                  </span>

                  <span>
                    No advance leave
                  </span>
                </div>
              )}

              <button
                type="button"
                disabled={available <= 0}
                style={{
                  ...styles.applyBtn,
                  ...(available <= 0
                    ? {
                      opacity: 0.45,
                      cursor: "not-allowed",
                    }
                    : {}),
                }}
                onClick={() => {
                  if (available <= 0) return;

                  openApplyModal(leave.key);
                }}
              >
                <Send size={18} />

                {available <= 0
                  ? "No Leave Available"
                  : "Apply Leave"}
              </button>
            </div>
          );
        })}
        <div style={styles.leaveCard}>
  <div style={styles.cardIcon}>
    <CalendarDays size={24} />
  </div>

  <h2 style={styles.leaveTitle}>
    Holiday Leave
  </h2>

  <p style={styles.leaveDescription}>
    Choose any 4 festival holidays
  </p>

  <div
    style={{
      ...styles.balanceGrid,
      gridTemplateColumns:
        "repeat(3, minmax(0, 1fr))",
    }}
  >
    <div style={styles.balanceStat}>
      <strong style={styles.totalNumber}>
        {holidaySummary.max_optional}
      </strong>

      <span>Total</span>
    </div>

    <div style={styles.balanceStat}>
      <strong style={styles.totalNumber}>
        {holidaySummary.selected_count}
      </strong>

      <span>Selected</span>
    </div>

    <div style={styles.balanceStat}>
      <strong style={styles.totalNumber}>
        {Math.max(
          0,
          holidaySummary.max_optional -
            holidaySummary.selected_count
        )}
      </strong>

      <span>Remaining</span>
    </div>
  </div>

  <div style={styles.balanceProgressTrack}>
    <div
      style={{
        ...styles.balanceProgressFill,

        width: `${
          holidaySummary.max_optional > 0
            ? Math.min(
                100,
                (holidaySummary.selected_count /
                  holidaySummary.max_optional) *
                  100
              )
            : 0
        }%`,
      }}
    />
  </div>

  <p style={styles.availableText}>
    {holidaySummary.selected_count} of{" "}
    {holidaySummary.max_optional} holidays selected
  </p>

  <div style={styles.privilegedInfo}>
    <span>
      Fixed company holidays are separate
    </span>
  </div>

  <button
    type="button"
    style={styles.applyBtn}
    onClick={() =>
      setShowHolidayCalendar(true)
    }
    disabled={holidayLoading}
  >
    <CalendarDays size={18} />

    {holidayLoading
      ? "Loading..."
      : "Choose Holidays"}
  </button>
</div>
      </div>

      <div style={styles.balanceInfo}>
        Pending leave is reserved from your available
        balance. Approved leave is counted as used.
        Privileged Leave is earned at 1.5 days per month
        and cannot be taken in advance.
      </div>

      <section style={styles.historyCard}>
        <div style={styles.historyHeader}>
          <div>
            <h2 style={styles.historyTitle}>
              Leave History
            </h2>

            <p style={styles.historySubtitle}>
              Your submitted leave applications and their
              status.
            </p>
          </div>

          <div style={styles.historyFilters}>
            {[
              "all",
              "pending",
              "approved",
              "rejected",
            ].map((filter) => (
              <button
                type="button"
                key={filter}
                style={
                  historyFilter === filter
                    ? styles.activeHistoryFilter
                    : styles.historyFilterBtn
                }
                onClick={() =>
                  setHistoryFilter(filter)
                }
              >
                {filter.charAt(0).toUpperCase() +
                  filter.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={styles.emptyState}>
            Loading leave applications...
          </div>
        ) : filteredApplications.length === 0 ? (
          <div style={styles.emptyState}>
            No leave applications found.
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th
                    style={{
                      ...styles.tableHeadCell,
                      ...styles.firstHeadCell,
                    }}
                  >
                    Leave Type
                  </th>

                  <th style={styles.tableHeadCell}>
                    From
                  </th>

                  <th style={styles.tableHeadCell}>
                    To
                  </th>

                  <th style={styles.tableHeadCell}>
                    Duration
                  </th>

                  <th style={styles.tableHeadCell}>
                    Days
                  </th>

                  <th style={styles.tableHeadCell}>
                    Reason
                  </th>

                  <th style={styles.tableHeadCell}>
                    Status
                  </th>

                  <th
                    style={{
                      ...styles.tableHeadCell,
                      ...styles.lastHeadCell,
                    }}
                  >
                    Applied On
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredApplications.map(
                  (application) => (
                    <tr key={application.leave_id}>
                      <td
                        style={{
                          ...styles.tableCell,
                          ...styles.firstTableCell,
                        }}
                      >
                        <strong>
                          {getLeaveLabel(
                            application.leave_type
                          )}
                        </strong>
                      </td>

                      <td style={styles.tableCell}>
                        {formatDisplayDate(
                          application.start_date
                        )}
                      </td>

                      <td style={styles.tableCell}>
                        {formatDisplayDate(
                          application.end_date
                        )}
                      </td>

                      <td style={styles.tableCell}>
                        <span
                          style={
                            application.duration_type ===
                            "half_day"
                              ? styles.halfDayBadge
                              : styles.fullDayBadge
                          }
                        >
                          {getDurationLabel(application)}
                        </span>
                      </td>

                      <td style={styles.tableCell}>
                        {formatDays(
                          application.total_days
                        )}
                      </td>

                      <td style={styles.tableCell}>
                        {application.reason || "-"}
                      </td>

                      <td style={styles.tableCell}>
                        <span
                          style={{
                            ...styles.statusBadge,
                            ...(application.status ===
                            "approved"
                              ? styles.approvedBadge
                              : application.status ===
                                "rejected"
                              ? styles.rejectedBadge
                              : styles.pendingBadge),
                          }}
                        >
                          {String(
                            application.status ||
                              "pending"
                          )
                            .charAt(0)
                            .toUpperCase() +
                            String(
                              application.status ||
                                "pending"
                            ).slice(1)}
                        </span>
                      </td>

                      <td
                        style={{
                          ...styles.tableCell,
                          ...styles.lastTableCell,
                        }}
                      >
                        {application.applied_at
                          ? formatDisplayDate(
                              String(
                                application.applied_at
                              ).slice(0, 10)
                            )
                          : "-"}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <HolidayCalendarModal
  open={showHolidayCalendar}
  onClose={() =>
    setShowHolidayCalendar(false)
  }
/>

<LeaveInstructionsModal
  open={showInstructions}
  onClose={() =>
    setShowInstructions(false)
  }
/>
       
      {selectedLeaveType && (
        <div
          style={styles.modalOverlay}
          onClick={closeApplyModal}
        >
          <div
            style={styles.modal}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              style={styles.closeBtn}
              onClick={closeApplyModal}
            >
              <X size={20} />
            </button>

            <h2 style={styles.modalTitle}>
              Apply for{" "}
              {getLeaveLabel(selectedLeaveType)}
            </h2>

            <p style={styles.modalSubtitle}>
              Currently available:{" "}
              <strong>
                {formatDays(selectedAvailable)}
              </strong>{" "}
              day(s)
            </p>

            {error && (
              <div style={styles.modalError}>
                {error}
              </div>
            )}

            <div style={styles.formSection}>
              <span style={styles.formSectionLabel}>
                Leave Duration
              </span>

              <div style={styles.optionGrid}>
                <button
                  type="button"
                  style={
                    form.duration_type === "full_day"
                      ? styles.activeOptionBtn
                      : styles.optionBtn
                  }
                  onClick={() =>
                    handleDurationChange("full_day")
                  }
                >
                  Full Day
                </button>

                <button
                  type="button"
                  style={
                    form.duration_type === "half_day"
                      ? styles.activeOptionBtn
                      : styles.optionBtn
                  }
                  onClick={() =>
                    handleDurationChange("half_day")
                  }
                >
                  Half Day
                </button>
              </div>
            </div>

            {form.duration_type === "half_day" && (
              <div style={styles.formSection}>
                <span style={styles.formSectionLabel}>
                  Half-Day Session
                </span>

                <div style={styles.optionGrid}>
                  <button
                    type="button"
                    style={
                      form.half_day_session ===
                      "first_half"
                        ? styles.activeOptionBtn
                        : styles.optionBtn
                    }
                    onClick={() =>
                      setForm((previous) => ({
                        ...previous,
                        half_day_session:
                          "first_half",
                      }))
                    }
                  >
                    First Half
                  </button>

                  <button
                    type="button"
                    style={
                      form.half_day_session ===
                      "second_half"
                        ? styles.activeOptionBtn
                        : styles.optionBtn
                    }
                    onClick={() =>
                      setForm((previous) => ({
                        ...previous,
                        half_day_session:
                          "second_half",
                      }))
                    }
                  >
                    Second Half
                  </button>
                </div>
              </div>
            )}

            <div
              style={
                form.duration_type === "half_day"
                  ? styles.singleDateGrid
                  : styles.formGrid
              }
            >
              <label style={styles.field}>
                <span>
                  {form.duration_type === "half_day"
                    ? "Leave Date"
                    : "From Date"}
                </span>

                <input
                  type="date"
                  min={minimumLeaveDate}
                  style={styles.input}
                  value={form.start_date}
                  onChange={(event) => {
                    const value = event.target.value;

                    setForm((previous) => ({
                      ...previous,
                      start_date: value,
                      end_date:
                        previous.duration_type ===
                        "half_day"
                          ? value
                          : previous.end_date &&
                            previous.end_date < value
                          ? ""
                          : previous.end_date,
                    }));
                  }}
                />
              </label>

              {form.duration_type === "full_day" && (
                <label style={styles.field}>
                  <span>To Date</span>

                  <input
                    type="date"
                    min={
                      form.start_date ||
                      minimumLeaveDate
                    }
                    style={styles.input}
                    value={form.end_date}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        end_date:
                          event.target.value,
                      }))
                    }
                  />
                </label>
              )}
            </div>

            <div style={styles.daysBox}>
              <span>Leave Days</span>
              <strong>
                {formatDays(calculateDays)}
              </strong>
            </div>

            {calculateDays > 0 && (
              <div style={styles.balancePreview}>
                <div style={styles.balancePreviewItem}>
                  <span>
                    Pending reservation
                  </span>
                  <strong>
                    {formatDays(calculateDays)} day(s)
                  </strong>
                </div>

                <div style={styles.balancePreviewItem}>
                  <span>
                    Available after submission
                  </span>
                  <strong>
                    {formatDays(
                      Math.max(
                        0,
                        selectedAvailable -
                          calculateDays
                      )
                    )}{" "}
                    day(s)
                  </strong>
                </div>
              </div>
            )}

            <label style={styles.field}>
              <span>Reason</span>

              <textarea
                style={styles.textarea}
                value={form.reason}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    reason: event.target.value,
                  }))
                }
                placeholder="Enter reason for leave..."
              />
            </label>

            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.cancelBtn}
                onClick={closeApplyModal}
              >
                Cancel
              </button>

              <button
                type="button"
                style={
                  submitting
                    ? styles.disabledSubmitBtn
                    : styles.submitBtn
                }
                onClick={handleApply}
                disabled={submitting}
              >
                <Send size={18} />
                {submitting
                  ? "Submitting..."
                  : "Submit Leave"}
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
    paddingBottom: "40px",
  },

  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    marginBottom: "26px",
  },

  pageTitle: {
    margin: "0 0 7px",
    color: "#111827",
    fontSize: "34px",
    fontWeight: 900,
  },

  pageSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "15px",
  },

  refreshBtn: {
    border: 0,
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "14px",
    padding: "13px 18px",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
  },

  topActions: {
  display: "flex",
  alignItems: "center",
  gap: "10px",
},

calendarIconBtn: {
  width: "46px",
  height: "46px",
  border: "1px solid #ff5733",
  background: "#ffffff",
  color: "#ff5733",
  borderRadius: "14px",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
},

instructionBtn: {
  height: "46px",
  border: "1px solid #ff5733",
  background: "#ffffff",
  color: "#ff5733",
  borderRadius: "14px",
  padding: "0 18px",
  fontWeight: 900,
  cursor: "pointer",
},

  leaveGrid: {
  display: "grid",
  gridTemplateColumns:
    "repeat(4, minmax(0, 1fr))",
    gap: "20px",
    marginBottom: "26px",
  },

  leaveCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "22px",
    padding: "24px",
    boxShadow:
      "0 8px 20px rgba(15,23,42,0.06)",
    display: "flex",
    flexDirection: "column",
  },

  cardIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "14px",
    display: "grid",
    placeItems: "center",
    background: "#fff1eb",
    color: "#ff5733",
    marginBottom: "17px",
  },

  leaveTitle: {
    margin: "0 0 7px",
    color: "#111827",
    fontSize: "22px",
    fontWeight: 900,
  },

  leaveDescription: {
    margin: "0 0 20px",
    color: "#64748b",
    fontSize: "14px",
    minHeight: "21px",
  },

  balanceGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: "10px",
    marginBottom: "16px",
  },

  balanceStat: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    minWidth: 0,
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 800,
  },

  totalNumber: {
    color: "#111827",
    fontSize: "24px",
    fontWeight: 900,
    lineHeight: 1,
  },

  usedNumber: {
    color: "#111827",
    fontSize: "24px",
    fontWeight: 900,
    lineHeight: 1,
  },

  pendingNumber: {
    color: "#d97706",
    fontSize: "24px",
    fontWeight: 900,
    lineHeight: 1,
  },

  availableNumber: {
    color: "#15803d",
    fontSize: "24px",
    fontWeight: 900,
    lineHeight: 1,
  },

  balanceProgressTrack: {
    width: "100%",
    height: "9px",
    background: "#e5e7eb",
    borderRadius: "999px",
    overflow: "hidden",
    marginBottom: "8px",
  },

  balanceProgressFill: {
    height: "100%",
    background: "#22c55e",
    borderRadius: "999px",
  },

  availableText: {
    margin: "0 0 14px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 800,
    textAlign: "right",
  },

  privilegedInfo: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    flexWrap: "wrap",
    color: "#64748b",
    fontSize: "12px",
    marginBottom: "14px",
  },

  applyBtn: {
    width: "100%",
    height: "48px",
    border: 0,
    borderRadius: "14px",
    background: "#ff5733",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    marginTop: "auto",
  },

  balanceInfo: {
    margin: "-8px 0 26px",
    padding: "13px 16px",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 700,
  },

  historyCard: {
    background: "#ffffff",
    border: "1.5px solid #d1d5db",
    borderRadius: "22px",
    padding: "26px 28px",
    boxShadow:
      "0 8px 20px rgba(15,23,42,0.06)",
    overflow: "hidden",
  },

  historyHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "18px",
    flexWrap: "wrap",
    paddingBottom: "20px",
    marginBottom: "18px",
    borderBottom: "1px solid #e5e7eb",
  },

  historyTitle: {
    margin: "0 0 6px",
    color: "#111827",
    fontSize: "24px",
    fontWeight: 900,
  },

  historySubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "14px",
  },

  historyFilters: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },

  historyFilterBtn: {
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#475569",
    borderRadius: "999px",
    minHeight: "38px",
    padding: "0 15px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
  },

  activeHistoryFilter: {
    border: "1px solid #ff5733",
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "999px",
    minHeight: "38px",
    padding: "0 15px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
  },

  tableWrapper: {
    width: "100%",
    overflowX: "auto",
    background: "#ffffff",
    borderRadius: "16px",
  },

  table: {
    width: "100%",
    minWidth: "1050px",
    borderCollapse: "separate",
    borderSpacing: "0 12px",
  },

  tableHeadCell: {
    background: "#f8fafc",
    color: "#111827",
    fontSize: "14px",
    fontWeight: 900,
    padding: "16px 14px",
    textAlign: "center",
    borderTop: "1px solid #e5e7eb",
    borderBottom: "1px solid #e5e7eb",
  },

  firstHeadCell: {
    borderLeft: "1px solid #e5e7eb",
    borderTopLeftRadius: "14px",
    borderBottomLeftRadius: "14px",
  },

  lastHeadCell: {
    borderRight: "1px solid #e5e7eb",
    borderTopRightRadius: "14px",
    borderBottomRightRadius: "14px",
  },

  tableCell: {
    padding: "16px 14px",
    textAlign: "center",
    verticalAlign: "middle",
    background: "#ffffff",
    color: "#111827",
    fontSize: "14px",
    borderTop: "1px solid #e5e7eb",
    borderBottom: "1px solid #e5e7eb",
  },

  firstTableCell: {
    borderLeft: "1px solid #e5e7eb",
    borderTopLeftRadius: "14px",
    borderBottomLeftRadius: "14px",
  },

  lastTableCell: {
    borderRight: "1px solid #e5e7eb",
    borderTopRightRadius: "14px",
    borderBottomRightRadius: "14px",
  },

  statusBadge: {
    display: "inline-flex",
    borderRadius: "999px",
    padding: "7px 11px",
    fontSize: "12px",
    fontWeight: 900,
  },

  pendingBadge: {
    background: "#fef3c7",
    color: "#92400e",
  },

  approvedBadge: {
    background: "#dcfce7",
    color: "#166534",
  },

  rejectedBadge: {
    background: "#fee2e2",
    color: "#991b1b",
  },

  fullDayBadge: {
    display: "inline-flex",
    whiteSpace: "nowrap",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: "999px",
    padding: "6px 9px",
    fontSize: "11px",
    fontWeight: 900,
  },

  halfDayBadge: {
    display: "inline-flex",
    whiteSpace: "nowrap",
    background: "#f5f3ff",
    color: "#6d28d9",
    borderRadius: "999px",
    padding: "6px 9px",
    fontSize: "11px",
    fontWeight: 900,
  },

  emptyState: {
    border: "1px dashed #d1d5db",
    borderRadius: "16px",
    padding: "26px",
    textAlign: "center",
    color: "#94a3b8",
    fontWeight: 800,
  },

  errorBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#b91c1c",
    borderRadius: "14px",
    padding: "14px",
    marginBottom: "18px",
    fontWeight: 800,
  },

  successBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#15803d",
    borderRadius: "14px",
    padding: "14px",
    marginBottom: "18px",
    fontWeight: 800,
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.52)",
    zIndex: 20000,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
  },

  modal: {
    width: "min(680px, 95vw)",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: "24px",
    padding: "28px",
    position: "relative",
    boxShadow:
      "0 28px 80px rgba(15,23,42,0.3)",
  },

  closeBtn: {
    position: "absolute",
    right: "22px",
    top: "22px",
    width: "40px",
    height: "40px",
    border: 0,
    borderRadius: "12px",
    background: "#111827",
    color: "#ffffff",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  },

  modalTitle: {
    margin: "0 52px 8px 0",
    color: "#111827",
    fontSize: "27px",
    fontWeight: 900,
  },

  modalSubtitle: {
    margin: "0 0 22px",
    color: "#64748b",
  },

  modalError: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#b91c1c",
    borderRadius: "14px",
    padding: "12px",
    marginBottom: "16px",
    fontWeight: 800,
  },

  formSection: {
    marginBottom: "18px",
  },

  formSectionLabel: {
    display: "block",
    color: "#111827",
    fontSize: "14px",
    fontWeight: 900,
    marginBottom: "9px",
  },

  optionGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "10px",
  },

  optionBtn: {
    minHeight: "46px",
    border: "1px solid #d1d5db",
    borderRadius: "13px",
    background: "#ffffff",
    color: "#475569",
    fontWeight: 900,
    cursor: "pointer",
  },

  activeOptionBtn: {
    minHeight: "46px",
    border: "1px solid #ff5733",
    borderRadius: "13px",
    background: "#fff1eb",
    color: "#ff5733",
    fontWeight: 900,
    cursor: "pointer",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
  },

  singleDateGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
  },

  field: {
    display: "grid",
    gap: "8px",
    color: "#111827",
    fontSize: "14px",
    fontWeight: 800,
    marginBottom: "16px",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    height: "46px",
    border: "1px solid #d1d5db",
    borderRadius: "13px",
    padding: "0 12px",
    fontFamily: "inherit",
    color: "#111827",
    background: "#ffffff",
  },

  textarea: {
    minHeight: "100px",
    border: "1px solid #d1d5db",
    borderRadius: "14px",
    padding: "12px",
    resize: "vertical",
    fontFamily: "inherit",
  },

  daysBox: {
    display: "flex",
    justifyContent: "space-between",
    background: "#fff7f4",
    border: "1px solid #ffd4c8",
    borderRadius: "14px",
    padding: "14px",
    marginBottom: "16px",
    color: "#111827",
    fontWeight: 800,
  },

  balancePreview: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "10px",
    marginBottom: "16px",
  },

  balancePreviewItem: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "13px",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 700,
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
  },

  cancelBtn: {
    minWidth: "110px",
    height: "46px",
    border: "1px solid #d1d5db",
    borderRadius: "13px",
    background: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },

  submitBtn: {
    minWidth: "160px",
    height: "46px",
    border: 0,
    borderRadius: "13px",
    background: "#ff5733",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },

  disabledSubmitBtn: {
    minWidth: "160px",
    height: "46px",
    border: 0,
    borderRadius: "13px",
    background: "#fdba9f",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "not-allowed",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
};

export default EmployeeLeaveApplications;

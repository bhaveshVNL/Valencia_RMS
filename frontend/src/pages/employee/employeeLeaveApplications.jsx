import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Mail,
  RefreshCw,
  X,
} from "lucide-react";

import api from "../../api/axios";

const EmployeeLeaveApplications = () => {
  const [balances, setBalances] = useState({
    sick: {
      label: "Sick Leave",
      total: 7,
      used: 0,
      remaining: 7,
    },
    casual: {
      label: "Casual Leave",
      total: 7,
      used: 0,
      remaining: 7,
    },
    mandatory: {
      label: "Mandatory Leave",
      total: 18,
      used: 0,
      remaining: 18,
    },
  });

  const [applications, setApplications] = useState([]);
  const [historyFilter, setHistoryFilter] = useState("all");

  const [selectedLeaveType, setSelectedLeaveType] = useState(null);

  const [form, setForm] = useState({
    start_date: "",
    end_date: "",
    reason: "",
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const formatDisplayDate = (value) => {
    if (!value) return "-";

    const cleanDate = String(value).slice(0, 10);
    const parts = cleanDate.split("-");

    if (parts.length !== 3) {
      return cleanDate;
    }

    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  };

  const getLeaveLabel = (type) => {
    if (type === "sick") return "Sick Leave";
    if (type === "casual") return "Casual Leave";
    if (type === "mandatory") return "Mandatory Leave";

    return type || "-";
  };

  const calculateDays = useMemo(() => {
    if (!form.start_date || !form.end_date) {
      return 0;
    }

    const start = new Date(`${form.start_date}T00:00:00`);
    const end = new Date(`${form.end_date}T00:00:00`);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end < start
    ) {
      return 0;
    }

    const difference =
      end.getTime() - start.getTime();

    return (
      Math.floor(
        difference / (1000 * 60 * 60 * 24)
      ) + 1
    );
  }, [form.start_date, form.end_date]);

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
      console.error(
        "Fetch employee leave data error:",
        err
      );

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

  useEffect(() => {
    fetchLeaveData();
  }, []);

  const openApplyModal = (leaveType) => {
    setSelectedLeaveType(leaveType);

    setForm({
      start_date: "",
      end_date: "",
      reason: "",
    });

    setError("");
    setSuccess("");
  };

  const closeApplyModal = () => {
    setSelectedLeaveType(null);

    setForm({
      start_date: "",
      end_date: "",
      reason: "",
    });

    setError("");
  };

  const handleApply = async () => {
    if (!selectedLeaveType) return;

    setError("");
    setSuccess("");

    if (!form.start_date) {
      setError("Please select the start date.");
      return;
    }

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

    if (
      currentBalance &&
      calculateDays > currentBalance.remaining
    ) {
      setError(
        `You only have ${currentBalance.remaining} day(s) remaining.`
      );
      return;
    }

    try {
      setSubmitting(true);

      const response = await api.post(
        "/employee-leaves/apply",
        {
          leave_type: selectedLeaveType,
          start_date: form.start_date,
          end_date: form.end_date,
          reason: form.reason.trim(),
        }
      );

      const application =
        response.data?.application || {};

      const employeeName =
        application.employee_name ||
        "Employee";

      const leaveLabel =
        getLeaveLabel(selectedLeaveType);

      const subject =
        `${leaveLabel} Application - ${employeeName}`;

      const body = [
        "Dear Sir/Ma'am,",
        "",
        `I would like to apply for ${leaveLabel} from ${formatDisplayDate(
          form.start_date
        )} to ${formatDisplayDate(
          form.end_date
        )} for ${calculateDays} day(s).`,
        "",
        `Reason: ${form.reason.trim()}`,
        "",
        "Kindly approve my leave application.",
        "",
        "Regards,",
        employeeName,
      ].join("\n");

      const mailLink =
        `mailto:?subject=${encodeURIComponent(
          subject
        )}&body=${encodeURIComponent(body)}`;

      setSuccess(
        response.data?.message ||
          "Leave application submitted successfully."
      );

      await fetchLeaveData();

      setSelectedLeaveType(null);

      setForm({
        start_date: "",
        end_date: "",
        reason: "",
      });

      window.location.href = mailLink;
    } catch (err) {
      console.error(
        "Apply employee leave error:",
        err
      );

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
      description:
        "Annual sick leave entitlement",
    },
    {
      key: "casual",
      title: "Casual Leave",
      description:
        "Annual casual leave entitlement",
    },
    {
      key: "mandatory",
      title: "Mandatory Leave",
      description:
        "1.5 days per month · 18 days annually",
    },
  ];

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

        <button
          type="button"
          style={styles.refreshBtn}
          onClick={fetchLeaveData}
          disabled={loading}
        >
          <RefreshCw size={18} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && !selectedLeaveType && (
        <div style={styles.errorBox}>
          {error}
        </div>
      )}

      {success && (
        <div style={styles.successBox}>
          {success}
        </div>
      )}

      <div style={styles.leaveGrid}>
        {leaveCards.map((leave) => {
          const balance =
            balances[leave.key] || {
              total: 0,
              used: 0,
              remaining: 0,
            };

          return (
            <div
              style={styles.leaveCard}
              key={leave.key}
            >
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
                <div>
                  <span>Total</span>
                  <strong>
                    {balance.total}
                  </strong>
                </div>

                <div>
                  <span>Used</span>
                  <strong>
                    {balance.used}
                  </strong>
                </div>

                <div>
                  <span>Remaining</span>
                  <strong>
                    {balance.remaining}
                  </strong>
                </div>
              </div>

              <button
                type="button"
                style={styles.applyBtn}
                onClick={() =>
                  openApplyModal(leave.key)
                }
              >
                <Mail size={18} />
                Apply Leave
              </button>
            </div>
          );
        })}
      </div>

      <section style={styles.historyCard}>
        <div style={styles.historyHeader}>
          <div>
            <h2>Leave History</h2>
            <p>
              Your submitted leave applications and their status.
            </p>
          </div>
        </div>

        {loading ? (
          <div style={styles.emptyState}>
            Loading leave applications...
          </div>
        ) : applications.length === 0 ? (
          <div style={styles.emptyState}>
            No leave applications yet.
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Leave Type</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Applied On</th>
                </tr>
              </thead>

              <tbody>
                {applications.map(
                  (application) => (
                    <tr key={application.leave_id}>
                      <td>
                        <strong>
                          {getLeaveLabel(
                            application.leave_type
                          )}
                        </strong>
                      </td>

                      <td>
                        {formatDisplayDate(
                          application.start_date
                        )}
                      </td>

                      <td>
                        {formatDisplayDate(
                          application.end_date
                        )}
                      </td>

                      <td>
                        {application.total_days}
                      </td>

                      <td>
                        {application.reason || "-"}
                      </td>

                      <td>
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

                      <td>
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
              {getLeaveLabel(
                selectedLeaveType
              )}
            </h2>

            <p style={styles.modalSubtitle}>
              Remaining balance:{" "}
              <strong>
                {balances[selectedLeaveType]
                  ?.remaining || 0}
              </strong>{" "}
              day(s)
            </p>

            {error && (
              <div style={styles.modalError}>
                {error}
              </div>
            )}

            <div style={styles.formGrid}>
              <label style={styles.field}>
                <span>From Date</span>

                <input
                  type="date"
                  value={form.start_date}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      start_date:
                        event.target.value,
                      end_date:
                        previous.end_date &&
                        previous.end_date <
                          event.target.value
                          ? ""
                          : previous.end_date,
                    }))
                  }
                />
              </label>

              <label style={styles.field}>
                <span>To Date</span>

                <input
                  type="date"
                  min={
                    form.start_date ||
                    undefined
                  }
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
            </div>

            <div style={styles.daysBox}>
              Leave Days
              <strong>
                {calculateDays}
              </strong>
            </div>

            <label style={styles.field}>
              <span>Reason</span>

              <textarea
                style={styles.textarea}
                value={form.reason}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    reason:
                      event.target.value,
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
                style={styles.submitBtn}
                onClick={handleApply}
                disabled={submitting}
              >
                <Mail size={18} />

                {submitting
                  ? "Submitting..."
                  : "Apply via Email"}
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

  leaveGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, minmax(0, 1fr))",
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
  },

  balanceGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, 1fr)",
    gap: "10px",
    marginBottom: "20px",
  },

  applyBtn: {
    width: "100%",
    border: 0,
    background: "#ff5733",
    color: "#ffffff",
    height: "48px",
    borderRadius: "14px",
    fontWeight: 900,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },

  historyCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "22px",
    padding: "24px",
    boxShadow:
      "0 8px 20px rgba(15,23,42,0.06)",
  },

  historyHeader: {
    marginBottom: "20px",
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  statusBadge: {
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
    background:
      "rgba(15,23,42,0.52)",
    zIndex: 20000,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
  },

  modal: {
    width: "min(650px, 95vw)",
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
    margin: "0 0 8px",
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

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
  },

  field: {
    display: "grid",
    gap: "8px",
    color: "#111827",
    fontSize: "14px",
    fontWeight: 800,
    marginBottom: "16px",
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
    background: "#fff7f4",
    border: "1px solid #ffd4c8",
    borderRadius: "14px",
    padding: "14px",
    marginBottom: "16px",
    display: "flex",
    justifyContent: "space-between",
    color: "#111827",
    fontWeight: 800,
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
};

export default EmployeeLeaveApplications;
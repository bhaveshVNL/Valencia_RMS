import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Check,
  Eye,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";

import api from "../../api/axios";

const AdminLeaveApplications = () => {
  const [applications, setApplications] =
    useState([]);

  const [summary, setSummary] =
    useState({
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    });

  const [admin, setAdmin] =
    useState(null);

  const [filter, setFilter] =
    useState("all");

  const [selectedLeave, setSelectedLeave] =
    useState(null);

  const [reviewRemark, setReviewRemark] =
    useState("");

  const [confirmation, setConfirmation] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [reviewing, setReviewing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [modalError, setModalError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const formatDate = (value) => {
    if (!value) return "-";

    const clean =
      String(value).slice(0, 10);

    const parts =
      clean.split("-");

    if (parts.length !== 3) {
      return clean;
    }

    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  };

  const formatDateTime = (value) => {
    if (!value) return "-";

    const text =
      String(value);

    const date =
      text.slice(0, 10);

    const time =
      text.includes(" ")
        ? text.split(" ")[1]?.slice(
            0,
            5
          )
        : "";

    return `${formatDate(date)}${
      time ? ` · ${time}` : ""
    }`;
  };

  const formatDays = (value) => {
    const number =
      Number(value || 0);

    return Number.isInteger(number)
      ? String(number)
      : number.toFixed(1);
  };

  const getLeaveLabel = (type) => {
  if (type === "sick") return "Sick Leave";
  if (type === "casual") return "Casual Leave";
  if (type === "mandatory") return "Privileged Leave";
  if (type === "festival") return "Holiday Leave";

  return type || "-";
};

  const getDurationLabel = (
    leave
  ) => {
    if (
      leave.duration_type ===
        "half_day" ||
      Number(
        leave.total_days
      ) === 0.5
    ) {
      if (
        leave.half_day_session === "first_half"
      ) {
        return "Half Day · First Half";
      }

      if (
        leave.half_day_session === "second_half"
      ) {
        return "Half Day · Second Half";
      }

      return "Half Day";
    }

    return "Full Day";
  };

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await api.get(
          "/admin-leaves"
        );

      setApplications(
        Array.isArray(
          response.data
            ?.applications
        )
          ? response.data
              .applications
          : []
      );

      setSummary({
        total:
          Number(
            response.data
              ?.summary?.total ||
              0
          ),

        pending:
          Number(
            response.data
              ?.summary?.pending ||
              0
          ),

        approved:
          Number(
            response.data
              ?.summary?.approved ||
              0
          ),

        rejected:
          Number(
            response.data
              ?.summary?.rejected ||
              0
          ),
      });

      setAdmin(
        response.data?.admin ||
          null
      );
    } catch (err) {
      console.error(
        "Fetch admin leaves error:",
        err
      );

      setError(
        err?.response?.data
          ?.sqlMessage ||
          err?.response?.data
            ?.error ||
          err?.response?.data
            ?.message ||
          "Failed to load leave applications."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const filteredApplications =
    useMemo(() => {
      if (filter === "all") {
        return applications;
      }

      return applications.filter(
        (application) =>
          String(
            application.status ||
              ""
          ).toLowerCase() ===
          filter
      );
    }, [
      applications,
      filter,
    ]);

  /*
  ================================================
  CALCULATE CURRENT EMPLOYEE BALANCE
  FROM ALL APPLICATIONS LOADED FOR ADMIN
  ================================================
  */
  const selectedBalance =
    useMemo(() => {
      if (!selectedLeave) {
        return null;
      }

      const employeeId =
        Number(
          selectedLeave.employee_id
        );

      const leaveType =
        selectedLeave.leave_type;

      const leaveYear =
        Number(
          String(
            selectedLeave.start_date ||
              ""
          ).slice(0, 4)
        ) ||
        new Date().getFullYear();

      let earned;

      if (leaveType === "mandatory") {
        earned = Math.min(
          18,
          (new Date().getMonth() + 1) * 1.5
        );
      } else if (leaveType === "festival") {
        earned = 4;
      } else {
        earned = 7;
      }

      const matching =
        applications.filter(
          (application) =>
            Number(
              application.employee_id
            ) === employeeId &&
            application.leave_type ===
              leaveType &&
            Number(
              String(
                application.start_date ||
                  ""
              ).slice(0, 4)
            ) === leaveYear
        );

      const used =
        matching
          .filter(
            (item) =>
              String(
                item.status ||
                  ""
              ).toLowerCase() ===
              "approved"
          )
          .reduce(
            (total, item) =>
              total +
              Number(
                item.total_days ||
                  0
              ),
            0
          );

      const pending =
        matching
          .filter(
            (item) =>
              String(
                item.status ||
                  ""
              ).toLowerCase() ===
              "pending"
          )
          .reduce(
            (total, item) =>
              total +
              Number(
                item.total_days ||
                  0
              ),
            0
          );

      const available =
        Math.max(
          0,
          earned -
            used -
            pending
        );

      const requestDays =
        Number(
          selectedLeave.total_days ||
            0
        );

      const selectedIsPending =
        String(
          selectedLeave.status ||
            ""
        ).toLowerCase() ===
        "pending";

      return {
        earned,
        used,
        pending,
        available,

        afterApprovalUsed:
          selectedIsPending
            ? used +
              requestDays
            : used,

        afterApprovalPending:
          selectedIsPending
            ? Math.max(
                0,
                pending -
                  requestDays
              )
            : pending,

        /*
        Request is already reserved
        while pending, therefore
        available normally stays the same
        after approval.
        */
        afterApprovalAvailable:
          available,
      };
    }, [
      selectedLeave,
      applications,
    ]);

  const openDetails = (
    leave
  ) => {
    setSelectedLeave(leave);

    setReviewRemark(
      leave.review_remark || ""
    );

    setModalError("");
    setConfirmation(null);
  };

  const closeDetails = () => {
    if (reviewing) return;

    setSelectedLeave(null);
    setReviewRemark("");
    setModalError("");
    setConfirmation(null);
  };

  const requestReview = (
    action
  ) => {
    setModalError("");

    if (
      action === "rejected" &&
      !reviewRemark.trim()
    ) {
      setModalError(
        "Please enter a reason before rejecting this leave application."
      );

      return;
    }

    setConfirmation(action);
  };

  const confirmReview =
    async () => {
      if (
        !selectedLeave ||
        !confirmation
      ) {
        return;
      }

      try {
        setReviewing(true);
        setModalError("");

        const response =
          await api.patch(
            `/admin-leaves/${selectedLeave.leave_id}/status`,
            {
              status:
                confirmation,

              review_remark:
                reviewRemark.trim(),
            }
          );

        setSuccess(
          response.data?.message ||
            (confirmation ===
            "approved"
              ? "Leave approved successfully."
              : "Leave rejected successfully.")
        );

        setConfirmation(null);
        setSelectedLeave(null);
        setReviewRemark("");

        await fetchLeaves();
      } catch (err) {
        console.error(
          "Review leave error:",
          err
        );

        setConfirmation(null);

        setModalError(
          err?.response?.data
            ?.sqlMessage ||
            err?.response?.data
              ?.error ||
            err?.response?.data
              ?.message ||
            "Failed to review leave application."
        );
      } finally {
        setReviewing(false);
      }
    };

  const cards = [
    {
      key: "total",
      label: "Total",
      value: summary.total,
    },

    {
      key: "pending",
      label: "Pending",
      value: summary.pending,
    },

    {
      key: "approved",
      label: "Approved",
      value: summary.approved,
    },

    {
      key: "rejected",
      label: "Rejected",
      value: summary.rejected,
    },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            Leave Applications
          </h1>

          <p style={styles.subtitle}>
            Review and manage leave
            requests from{" "}
            <strong>
              {admin?.department_name ||
                "your department"}
            </strong>
            .
          </p>
        </div>

        <button
          type="button"
          style={styles.refreshBtn}
          onClick={fetchLeaves}
          disabled={loading}
        >
          <RefreshCw size={18} />

          {loading
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>

      {error && (
        <div style={styles.errorBox}>
          {error}
        </div>
      )}

      {success && (
        <div style={styles.successBox}>
          {success}
        </div>
      )}

      <div style={styles.summaryGrid}>
        {cards.map((card) => (
          <div
            key={card.key}
            style={styles.summaryCard}
          >
            <strong
              style={
                styles.summaryNumber
              }
            >
              {card.value}
            </strong>

            <span
              style={
                styles.summaryLabel
              }
            >
              {card.label}
            </span>
          </div>
        ))}
      </div>

      <section style={styles.section}>
        <div style={styles.toolbar}>
          <div>
            <h2 style={styles.sectionTitle}>
              Department Leave Requests
            </h2>

            <p style={styles.sectionSubtitle}>
              Select a request to review
              its complete details.
            </p>
          </div>

          <div style={styles.filters}>
            {[
              "all",
              "pending",
              "approved",
              "rejected",
            ].map((item) => (
              <button
                type="button"
                key={item}
                style={
                  filter === item
                    ? styles.activeFilter
                    : styles.filterBtn
                }
                onClick={() =>
                  setFilter(item)
                }
              >
                {item
                  .charAt(0)
                  .toUpperCase() +
                  item.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={styles.emptyBox}>
            Loading leave
            applications...
          </div>
        ) : filteredApplications.length ===
          0 ? (
          <div style={styles.emptyBox}>
            No leave applications
            found.
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th
                    style={
                      styles.headCell
                    }
                  >
                    Employee
                  </th>

                  <th
                    style={
                      styles.headCell
                    }
                  >
                    Leave Type
                  </th>

                  <th
                    style={
                      styles.headCell
                    }
                  >
                    From
                  </th>

                  <th
                    style={
                      styles.headCell
                    }
                  >
                    To
                  </th>

                  <th
                    style={
                      styles.headCell
                    }
                  >
                    Duration
                  </th>

                  <th
                    style={
                      styles.headCell
                    }
                  >
                    Days
                  </th>

                  <th
                    style={
                      styles.headCell
                    }
                  >
                    Status
                  </th>

                  <th
                    style={
                      styles.headCell
                    }
                  >
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredApplications.map(
                  (leave) => (
                    <tr
                      key={
                        leave.leave_id
                      }
                    >
                      <td
                        style={
                          styles.cell
                        }
                      >
                        <strong>
                          {leave.employee_name ||
                            "-"}
                        </strong>

                        <small
                          style={
                            styles.cellSmall
                          }
                        >
                          {leave.employee_code ||
                            "-"}
                        </small>
                      </td>

                      <td
                        style={
                          styles.cell
                        }
                      >
                        {getLeaveLabel(
                          leave.leave_type
                        )}
                      </td>

                      <td
                        style={
                          styles.cell
                        }
                      >
                        {formatDate(
                          leave.start_date
                        )}
                      </td>

                      <td
                        style={
                          styles.cell
                        }
                      >
                        {formatDate(
                          leave.end_date
                        )}
                      </td>

                      <td
                        style={
                          styles.cell
                        }
                      >
                        {getDurationLabel(
                          leave
                        )}
                      </td>

                      <td
                        style={
                          styles.cell
                        }
                      >
                        {formatDays(
                          leave.total_days
                        )}
                      </td>

                      <td
                        style={
                          styles.cell
                        }
                      >
                        <span
                          style={{
                            ...styles.statusBadge,

                            ...(leave.status ===
                            "approved"
                              ? styles.approvedBadge
                              : leave.status ===
                                "rejected"
                              ? styles.rejectedBadge
                              : styles.pendingBadge),
                          }}
                        >
                          {String(
                            leave.status ||
                              "pending"
                          )
                            .charAt(0)
                            .toUpperCase() +
                            String(
                              leave.status ||
                                "pending"
                            ).slice(1)}
                        </span>
                      </td>

                      <td
                        style={
                          styles.cell
                        }
                      >
                        <button
                          type="button"
                          style={
                            styles.viewBtn
                          }
                          onClick={() =>
                            openDetails(
                              leave
                            )
                          }
                        >
                          <Eye
                            size={16}
                          />
                          View Details
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedLeave && (
        <div
          style={styles.overlay}
          onMouseDown={
            closeDetails
          }
        >
          <div
            style={styles.modal}
            onMouseDown={(
              event
            ) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              style={styles.closeBtn}
              onClick={
                closeDetails
              }
            >
              <X size={20} />
            </button>

            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                Leave Application
              </h2>

              <span
                style={{
                  ...styles.statusBadge,

                  ...(selectedLeave.status ===
                  "approved"
                    ? styles.approvedBadge
                    : selectedLeave.status ===
                      "rejected"
                    ? styles.rejectedBadge
                    : styles.pendingBadge),
                }}
              >
                {String(
                  selectedLeave.status ||
                    "pending"
                )
                  .charAt(0)
                  .toUpperCase() +
                  String(
                    selectedLeave.status ||
                      "pending"
                  ).slice(1)}
              </span>
            </div>

            <section
              style={styles.employeeBox}
            >
              <div
                style={styles.avatar}
              >
                {String(
                  selectedLeave.employee_name ||
                    "E"
                )
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div>
                <h3
                  style={
                    styles.employeeName
                  }
                >
                  {selectedLeave.employee_name ||
                    "-"}
                </h3>

                <p
                  style={
                    styles.employeeMeta
                  }
                >
                  {selectedLeave.employee_code ||
                    "-"}
                  {" · "}
                  {selectedLeave.designation ||
                    "-"}
                  {" · "}
                  {selectedLeave.department_name ||
                    "-"}
                </p>

                <p
                  style={
                    styles.employeeEmail
                  }
                >
                  {selectedLeave.employee_email ||
                    "-"}
                </p>
              </div>
            </section>

            <div style={styles.infoGrid}>
              <div style={styles.infoBox}>
                <span>Leave Type</span>
                <strong>
                  {getLeaveLabel(
                    selectedLeave.leave_type
                  )}
                </strong>
              </div>

              <div style={styles.infoBox}>
                <span>Duration</span>
                <strong>
                  {getDurationLabel(
                    selectedLeave
                  )}
                </strong>
              </div>

              <div style={styles.infoBox}>
                <span>From</span>
                <strong>
                  {formatDate(
                    selectedLeave.start_date
                  )}
                </strong>
              </div>

              <div style={styles.infoBox}>
                <span>To</span>
                <strong>
                  {formatDate(
                    selectedLeave.end_date
                  )}
                </strong>
              </div>

              <div style={styles.infoBox}>
                <span>Leave Days</span>
                <strong>
                  {formatDays(
                    selectedLeave.total_days
                  )}
                </strong>
              </div>

              <div style={styles.infoBox}>
                <span>Applied On</span>
                <strong>
                  {formatDateTime(
                    selectedLeave.applied_at
                  )}
                </strong>
              </div>
            </div>

            <div
              style={
                styles.reasonBox
              }
            >
              <span>Reason</span>

              <p>
                {selectedLeave.reason ||
                  "-"}
              </p>
            </div>

            {selectedBalance && (
              <section
                style={
                  styles.balanceSection
                }
              >
                <h3
                  style={
                    styles.balanceTitle
                  }
                >
                  Leave Balance
                </h3>

                <div
                  style={
                    styles.balanceGrid
                  }
                >
                  <div
                    style={
                      styles.balanceBox
                    }
                  >
                    <strong>
                      {formatDays(
                        selectedBalance.earned
                      )}
                    </strong>
                    <span>
                      Total / Earned
                    </span>
                  </div>

                  <div
                    style={
                      styles.balanceBox
                    }
                  >
                    <strong>
                      {formatDays(
                        selectedBalance.used
                      )}
                    </strong>
                    <span>Used</span>
                  </div>

                  <div
                    style={
                      styles.balanceBox
                    }
                  >
                    <strong>
                      {formatDays(
                        selectedBalance.pending
                      )}
                    </strong>
                    <span>
                      Pending
                    </span>
                  </div>

                  <div
                    style={
                      styles.balanceBox
                    }
                  >
                    <strong>
                      {formatDays(
                        selectedBalance.available
                      )}
                    </strong>
                    <span>
                      Available
                    </span>
                  </div>
                </div>

                {selectedLeave.status ===
                  "pending" && (
                  <div
                    style={
                      styles.afterApproval
                    }
                  >
                    <span>
                      If approved
                    </span>

                    <strong>
                      Used:{" "}
                      {formatDays(
                        selectedBalance.afterApprovalUsed
                      )}
                      {" · "}
                      Pending:{" "}
                      {formatDays(
                        selectedBalance.afterApprovalPending
                      )}
                      {" · "}
                      Available:{" "}
                      {formatDays(
                        selectedBalance.afterApprovalAvailable
                      )}
                    </strong>
                  </div>
                )}
              </section>
            )}

            {modalError && (
              <div
                style={
                  styles.modalError
                }
              >
                {modalError}
              </div>
            )}

            {selectedLeave.status ===
            "pending" ? (
              <>
                <label
                  style={
                    styles.remarkField
                  }
                >
                  <span>
                    Admin Remark
                  </span>

                  <textarea
                    value={
                      reviewRemark
                    }
                    onChange={(
                      event
                    ) =>
                      setReviewRemark(
                        event.target
                          .value
                      )
                    }
                    placeholder="Required when rejecting. Optional when approving."
                    disabled={
                      reviewing
                    }
                  />
                </label>

                <div
                  style={
                    styles.actions
                  }
                >
                  <button
                    type="button"
                    style={
                      styles.rejectBtn
                    }
                    onClick={() =>
                      requestReview(
                        "rejected"
                      )
                    }
                    disabled={
                      reviewing
                    }
                  >
                    <XCircle
                      size={18}
                    />
                    Reject
                  </button>

                  <button
                    type="button"
                    style={
                      styles.approveBtn
                    }
                    onClick={() =>
                      requestReview(
                        "approved"
                      )
                    }
                    disabled={
                      reviewing
                    }
                  >
                    <Check size={18} />
                    Approve
                  </button>
                </div>
              </>
            ) : (
              <section
                style={
                  styles.reviewedBox
                }
              >
                <div>
                  <span>
                    Reviewed By
                  </span>

                  <strong>
                    {selectedLeave.reviewed_by_name ||
                      "-"}
                  </strong>
                </div>

                <div>
                  <span>
                    Reviewed On
                  </span>

                  <strong>
                    {formatDateTime(
                      selectedLeave.reviewed_at
                    )}
                  </strong>
                </div>

                {selectedLeave.review_remark && (
                  <div>
                    <span>
                      Admin Remark
                    </span>

                    <strong>
                      {selectedLeave.review_remark}
                    </strong>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      )}

      {confirmation &&
        selectedLeave && (
          <div
            style={
              styles.confirmOverlay
            }
          >
            <div
              style={
                styles.confirmBox
              }
            >
              <h3>
                {confirmation ===
                "approved"
                  ? "Approve Leave?"
                  : "Reject Leave?"}
              </h3>

              <p>
                {selectedLeave.employee_name}
                <br />

                {getLeaveLabel(
                  selectedLeave.leave_type
                )}
                <br />

                {formatDate(
                  selectedLeave.start_date
                )}
                {" → "}
                {formatDate(
                  selectedLeave.end_date
                )}
                <br />

                {formatDays(
                  selectedLeave.total_days
                )}{" "}
                day(s)
              </p>

              {confirmation ===
                "rejected" &&
                reviewRemark && (
                  <div
                    style={
                      styles.confirmRemark
                    }
                  >
                    <span>
                      Rejection Reason
                    </span>

                    <strong>
                      {reviewRemark}
                    </strong>
                  </div>
                )}

              <div
                style={
                  styles.confirmActions
                }
              >
                <button
                  type="button"
                  style={
                    styles.cancelConfirmBtn
                  }
                  onClick={() =>
                    setConfirmation(
                      null
                    )
                  }
                  disabled={
                    reviewing
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  style={
                    confirmation ===
                    "approved"
                      ? styles.confirmApproveBtn
                      : styles.confirmRejectBtn
                  }
                  onClick={
                    confirmReview
                  }
                  disabled={
                    reviewing
                  }
                >
                  {reviewing
                    ? "Processing..."
                    : confirmation ===
                      "approved"
                    ? "Yes, Approve"
                    : "Yes, Reject"}
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

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent:
      "space-between",
    gap: "18px",
    marginBottom: "24px",
  },

  title: {
    margin: "0 0 6px",
    color: "#111827",
    fontSize: "34px",
    fontWeight: 900,
  },

  subtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "15px",
  },

  refreshBtn: {
    border: 0,
    background: "#ff5733",
    color: "#ffffff",
    minHeight: "46px",
    borderRadius: "14px",
    padding: "0 18px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontWeight: 900,
    cursor: "pointer",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },

  summaryCard: {
    background: "#ffffff",
    border:
      "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    boxShadow:
      "0 8px 20px rgba(15,23,42,0.05)",
  },

  summaryNumber: {
    fontSize: "29px",
    fontWeight: 900,
    color: "#111827",
  },

  summaryLabel: {
    color: "#64748b",
    fontWeight: 800,
    fontSize: "13px",
  },

  section: {
    background: "#ffffff",
    border:
      "1.5px solid #d1d5db",
    borderRadius: "22px",
    padding: "24px",
    boxShadow:
      "0 8px 20px rgba(15,23,42,0.05)",
  },

  toolbar: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
    paddingBottom: "18px",
    marginBottom: "16px",
    borderBottom:
      "1px solid #e5e7eb",
  },

  sectionTitle: {
    margin: "0 0 5px",
    color: "#111827",
    fontSize: "23px",
    fontWeight: 900,
  },

  sectionSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "14px",
  },

  filters: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },

  filterBtn: {
    minHeight: "38px",
    padding: "0 15px",
    border:
      "1px solid #e5e7eb",
    borderRadius: "999px",
    background: "#ffffff",
    color: "#475569",
    fontWeight: 900,
    cursor: "pointer",
  },

  activeFilter: {
    minHeight: "38px",
    padding: "0 15px",
    border:
      "1px solid #ff5733",
    borderRadius: "999px",
    background: "#ff5733",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    minWidth: "1050px",
    borderCollapse:
      "separate",
    borderSpacing: "0 10px",
  },

  headCell: {
    background: "#f8fafc",
    padding: "14px",
    borderTop:
      "1px solid #e5e7eb",
    borderBottom:
      "1px solid #e5e7eb",
    textAlign: "center",
    fontSize: "13px",
    fontWeight: 900,
    color: "#111827",
  },

  cell: {
    background: "#ffffff",
    padding: "15px 14px",
    borderTop:
      "1px solid #e5e7eb",
    borderBottom:
      "1px solid #e5e7eb",
    textAlign: "center",
    fontSize: "13px",
    color: "#111827",
  },

  cellSmall: {
    display: "block",
    marginTop: "4px",
    color: "#94a3b8",
    fontSize: "11px",
  },

  statusBadge: {
    display: "inline-flex",
    padding: "7px 10px",
    borderRadius: "999px",
    fontSize: "11px",
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

  viewBtn: {
    border: 0,
    borderRadius: "10px",
    padding: "9px 12px",
    background: "#111827",
    color: "#ffffff",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontWeight: 800,
    cursor: "pointer",
  },

  emptyBox: {
    border:
      "1px dashed #d1d5db",
    borderRadius: "15px",
    padding: "28px",
    textAlign: "center",
    color: "#94a3b8",
    fontWeight: 800,
  },

  errorBox: {
    marginBottom: "18px",
    padding: "13px",
    border:
      "1px solid #fecdd3",
    borderRadius: "13px",
    background: "#fff1f2",
    color: "#b91c1c",
    fontWeight: 800,
  },

  successBox: {
    marginBottom: "18px",
    padding: "13px",
    border:
      "1px solid #bbf7d0",
    borderRadius: "13px",
    background: "#f0fdf4",
    color: "#15803d",
    fontWeight: 800,
  },

  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 20000,
    background:
      "rgba(15,23,42,0.58)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "24px",
  },

  modal: {
    width: "min(800px, 96vw)",
    maxHeight: "92vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: "24px",
    padding: "28px",
    position: "relative",
    boxShadow:
      "0 30px 90px rgba(15,23,42,0.3)",
  },

  closeBtn: {
    position: "absolute",
    top: "20px",
    right: "20px",
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

  modalHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "20px",
    paddingRight: "55px",
  },

  modalTitle: {
    margin: 0,
    color: "#111827",
    fontSize: "28px",
    fontWeight: 900,
  },

  employeeBox: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    background: "#f8fafc",
    border:
      "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "16px",
    marginBottom: "18px",
  },

  avatar: {
    width: "50px",
    height: "50px",
    borderRadius: "15px",
    background: "#ff5733",
    color: "#ffffff",
    display: "grid",
    placeItems: "center",
    fontSize: "20px",
    fontWeight: 900,
  },

  employeeName: {
    margin: "0 0 4px",
    color: "#111827",
    fontSize: "19px",
    fontWeight: 900,
  },

  employeeMeta: {
    margin: "0 0 3px",
    color: "#64748b",
    fontSize: "12px",
  },

  employeeEmail: {
    margin: 0,
    color: "#64748b",
    fontSize: "12px",
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, minmax(0, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },

  infoBox: {
    border:
      "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "13px",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },

  reasonBox: {
    border:
      "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "14px",
    marginBottom: "18px",
  },

  balanceSection: {
    border:
      "1px solid #e5e7eb",
    background: "#f8fafc",
    borderRadius: "16px",
    padding: "16px",
    marginBottom: "18px",
  },

  balanceTitle: {
    margin: "0 0 14px",
    fontSize: "17px",
    fontWeight: 900,
    color: "#111827",
  },

  balanceGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: "10px",
  },

  balanceBox: {
    background: "#ffffff",
    border:
      "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
  },

  afterApproval: {
    marginTop: "12px",
    border:
      "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
    borderRadius: "12px",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },

  modalError: {
    background: "#fff1f2",
    border:
      "1px solid #fecdd3",
    color: "#b91c1c",
    borderRadius: "13px",
    padding: "12px",
    marginBottom: "15px",
    fontWeight: 800,
  },

  remarkField: {
    display: "grid",
    gap: "7px",
    fontWeight: 900,
    color: "#111827",
  },

  actions: {
    marginTop: "18px",
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
  },

  rejectBtn: {
    minHeight: "44px",
    padding: "0 18px",
    border: 0,
    borderRadius: "12px",
    background: "#dc2626",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "7px",
  },

  approveBtn: {
    minHeight: "44px",
    padding: "0 18px",
    border: 0,
    borderRadius: "12px",
    background: "#16a34a",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "7px",
  },

  reviewedBox: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "10px",
    background: "#f8fafc",
    border:
      "1px solid #e5e7eb",
    borderRadius: "15px",
    padding: "15px",
  },

  confirmOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 30000,
    background:
      "rgba(15,23,42,0.65)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
  },

  confirmBox: {
    width: "min(430px, 94vw)",
    background: "#ffffff",
    borderRadius: "20px",
    padding: "24px",
    boxShadow:
      "0 30px 90px rgba(15,23,42,0.35)",
  },

  confirmRemark: {
    marginTop: "14px",
    padding: "12px",
    background: "#f8fafc",
    border:
      "1px solid #e5e7eb",
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },

  confirmActions: {
    marginTop: "20px",
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
  },

  cancelConfirmBtn: {
    minHeight: "42px",
    padding: "0 16px",
    border:
      "1px solid #d1d5db",
    borderRadius: "11px",
    background: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },

  confirmApproveBtn: {
    minHeight: "42px",
    padding: "0 16px",
    border: 0,
    borderRadius: "11px",
    background: "#16a34a",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },

  confirmRejectBtn: {
    minHeight: "42px",
    padding: "0 16px",
    border: 0,
    borderRadius: "11px",
    background: "#dc2626",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },
};

export default AdminLeaveApplications;
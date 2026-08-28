import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  RefreshCw,
  Send,
  X,
} from "lucide-react";

import LeaveInstructionsModal from "../../components/employee/LeaveInstructionsModal";
import api from "../../api/axios";

const EMPTY_FORM = {
  start_date: "",
  end_date: "",
  duration_type: "full_day",
  half_day_session: "first_half",
  reason: "",
};

const DEFAULT_BALANCES = {
  sick: {
    label: "Sick Leave",
    total: 2,
    earned: 2,
    used: 0,
    pending: 0,
    available: 2,
    remaining: 2,
  },

  casual: {
    label: "Casual Leave",
    total: 2,
    earned: 2,
    used: 0,
    pending: 0,
    available: 2,
    remaining: 2,
  },

  mandatory: {
    label: "Privileged Leave",
    monthly_credit: 1.5,
    carry_forward: true,
    earned: 0,
    used: 0,
    pending: 0,
    available: 0,
    remaining: 0,
  },

  festival: {
    label: "Holiday Leave",
    total: 4,
    earned: 4,
    used: 0,
    pending: 0,
    available: 4,
    remaining: 4,
  },
};

const LEAVE_CARDS = [
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
  {
    key: "festival",
    title: "Holiday Leave",
    description: "1 Holiday Leave in 2026 - Christmas",
  },
];

const HISTORY_FILTERS = [
  "all",
  "pending",
  "approved",
  "rejected",
];

const getTomorrowDate = () => {
  const date = new Date();

  date.setDate(date.getDate() + 1);

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (value) => {
  if (!value) return "-";

  const cleanDate = String(value).slice(
    0,
    10
  );

  const parts = cleanDate.split("-");

  return parts.length === 3
    ? `${parts[2]}-${parts[1]}-${parts[0]}`
    : cleanDate;
};

const formatDays = (value) => {
  const number = Number(value || 0);

  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(1);
};

const getLeaveLabel = (type) => {
  if (type === "sick") {
    return "Sick Leave";
  }

  if (type === "casual") {
    return "Casual Leave";
  }

  if (type === "mandatory") {
    return "Privileged Leave";
  }

  if (type === "festival") {
    return "Holiday Leave";
  }

  return type || "-";
};

const getDurationLabel = (
  application
) => {
  if (
    application.leave_type ===
    "festival"
  ) {
    return "Full Day";
  }

  if (
    application.duration_type !==
    "half_day"
  ) {
    return "Full Day";
  }

  if (
    application.half_day_session ===
    "first_half"
  ) {
    return "Half Day · First Half";
  }

  if (
    application.half_day_session ===
    "second_half"
  ) {
    return "Half Day · Second Half";
  }

  return "Half Day";
};

const BalanceCard = ({
  leave,
  balance,
  onApply,
}) => {
  const isPrivileged =
    leave.key === "mandatory";

  const isFestival =
    leave.key === "festival";

  const available = Number(
    balance.available ??
      balance.remaining ??
      0
  );

  const used = Number(
    balance.used || 0
  );

  const pending = Number(
    balance.pending || 0
  );

  const total = isPrivileged
    ? Number(balance.earned || 0)
    : Number(
        balance.total ||
          balance.earned ||
          0
      );

  const progress =
    total > 0
      ? Math.min(
          100,
          (available / total) * 100
        )
      : 0;

  return (
    <div style={styles.leaveCard}>
      <div style={styles.leaveTitleRow}>
        <div style={styles.cardIcon}>
          <CalendarDays size={24} />
        </div>

        <h2 style={styles.leaveTitle}>
          {leave.title}
        </h2>
      </div>

      <p style={styles.leaveDescription}>
        {leave.description}
      </p>

      <div style={styles.balanceGrid}>
        <div style={styles.balanceStat}>
          <strong
            style={styles.totalNumber}
          >
            {formatDays(total)}
          </strong>

          <span
            style={styles.balanceLabel}
          >
            Total
          </span>
        </div>

        <div style={styles.balanceStat}>
          <strong
            style={styles.usedNumber}
          >
            {formatDays(used)}
          </strong>

          <span
            style={styles.balanceLabel}
          >
            Used
          </span>
        </div>

        <div style={styles.balanceStat}>
          <strong
            style={styles.pendingNumber}
          >
            {formatDays(pending)}
          </strong>

          <span
            style={styles.balanceLabel}
          >
            Pending
          </span>
        </div>

        <div style={styles.balanceStat}>
          <strong
            style={
              styles.availableNumber
            }
          >
            {formatDays(available)}
          </strong>

          <span
            style={styles.balanceLabel}
          >
            Available
          </span>
        </div>
      </div>

      <div
        style={
          styles.balanceProgressTrack
        }
      >
        <div
          style={{
            ...styles.balanceProgressFill,
            width: `${progress}%`,
          }}
        />
      </div>

      <p style={styles.availableText}>
        {formatDays(available)} of{" "}
        {formatDays(total)} days
        available
      </p>

      {isPrivileged && (
        <div style={styles.cardInfo}>
          <span>
            <strong>
              1.5 days credited every
              month
            </strong>
          </span>

          <span>
            Unused balance carries
            forward
          </span>
        </div>
      )}

      {isFestival && (
        <div style={styles.cardInfo}>
          <span>
            Fixed company holidays are
            separate
          </span>
        </div>
      )}

      <button
        type="button"
        disabled={available <= 0}
        style={{
          ...styles.applyBtn,

          ...(available <= 0
            ? styles.disabledApplyBtn
            : {}),
        }}
        onClick={() =>
          available > 0 &&
          onApply(leave.key)
        }
      >
        <Send size={18} />

        {available <= 0
          ? "No Leave Available"
          : isFestival
          ? "Apply Holiday Leave"
          : "Apply Leave"}
      </button>
    </div>
  );
};

const HistoryTable = ({
  loading,
  applications,
}) => {
  if (loading) {
    return (
      <div style={styles.emptyState}>
        Loading leave applications...
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div style={styles.emptyState}>
        No leave applications found.
      </div>
    );
  }

  return (
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

            <th
              style={styles.tableHeadCell}
            >
              From
            </th>

            <th
              style={styles.tableHeadCell}
            >
              To
            </th>

            <th
              style={styles.tableHeadCell}
            >
              Duration
            </th>

            <th
              style={styles.tableHeadCell}
            >
              Days
            </th>

            <th
              style={styles.tableHeadCell}
            >
              Reason
            </th>

            <th
              style={styles.tableHeadCell}
            >
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
          {applications.map(
            (application) => {
              const status = String(
                application.status ||
                  "pending"
              ).toLowerCase();

              return (
                <tr
                  key={
                    application.leave_id
                  }
                >
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

                  <td
                    style={
                      styles.tableCell
                    }
                  >
                    {formatDisplayDate(
                      application.start_date
                    )}
                  </td>

                  <td
                    style={
                      styles.tableCell
                    }
                  >
                    {formatDisplayDate(
                      application.end_date
                    )}
                  </td>

                  <td
                    style={
                      styles.tableCell
                    }
                  >
                    <span
                      style={
                        application.duration_type ===
                        "half_day"
                          ? styles.halfDayBadge
                          : styles.fullDayBadge
                      }
                    >
                      {getDurationLabel(
                        application
                      )}
                    </span>
                  </td>

                  <td
                    style={
                      styles.tableCell
                    }
                  >
                    {formatDays(
                      application.total_days
                    )}
                  </td>

                  <td
                    style={
                      styles.tableCell
                    }
                  >
                    {application.reason ||
                      "-"}
                  </td>

                  <td
                    style={
                      styles.tableCell
                    }
                  >
                    <span
                      style={{
                        ...styles.statusBadge,

                        ...(status ===
                        "approved"
                          ? styles.approvedBadge
                          : status ===
                            "rejected"
                          ? styles.rejectedBadge
                          : styles.pendingBadge),
                      }}
                    >
                      {status
                        .charAt(0)
                        .toUpperCase() +
                        status.slice(1)}
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
              );
            }
          )}
        </tbody>
      </table>
    </div>
  );
};

const EmployeeLeaveApplications =
  () => {
    const [balances, setBalances] =
      useState(DEFAULT_BALANCES);

    const [
      applications,
      setApplications,
    ] = useState([]);

    const [holidays, setHolidays] =
      useState([]);

    const [
      historyFilter,
      setHistoryFilter,
    ] = useState("all");

    const [
      selectedLeaveType,
      setSelectedLeaveType,
    ] = useState(null);

    const [form, setForm] =
      useState(EMPTY_FORM);

    const [loading, setLoading] =
      useState(true);

    const [
      holidayLoading,
      setHolidayLoading,
    ] = useState(false);

    const [
      submitting,
      setSubmitting,
    ] = useState(false);

    const [error, setError] =
      useState("");

    const [success, setSuccess] =
      useState("");

    const [
      showInstructions,
      setShowInstructions,
    ] = useState(false);

    const [
      showHolidayCalendar,
      setShowHolidayCalendar,
    ] = useState(false);

    const POLICY_START_DATE =
      "2026-09-01";

    const minimumLeaveDate =
      getTomorrowDate() >
      POLICY_START_DATE
        ? getTomorrowDate()
        : POLICY_START_DATE;

    const calculateDays =
      useMemo(() => {
        if (
          selectedLeaveType ===
          "festival"
        ) {
          return form.start_date
            ? 1
            : 0;
        }

        if (
          form.duration_type ===
          "half_day"
        ) {
          return form.start_date
            ? 0.5
            : 0;
        }

        if (
          !form.start_date ||
          !form.end_date
        ) {
          return 0;
        }

        const start = new Date(
          `${form.start_date}T00:00:00`
        );

        const end = new Date(
          `${form.end_date}T00:00:00`
        );

        if (
          Number.isNaN(
            start.getTime()
          ) ||
          Number.isNaN(
            end.getTime()
          ) ||
          end < start
        ) {
          return 0;
        }

        return (
          Math.floor(
            (end.getTime() -
              start.getTime()) /
              (1000 *
                60 *
                60 *
                24)
          ) + 1
        );
      }, [
        selectedLeaveType,
        form.start_date,
        form.end_date,
        form.duration_type,
      ]);

    const filteredApplications =
      useMemo(() => {
        if (
          historyFilter === "all"
        ) {
          return applications;
        }

        return applications.filter(
          (application) =>
            String(
              application.status || ""
            ).toLowerCase() ===
            historyFilter
        );
      }, [
        applications,
        historyFilter,
      ]);

    const blockedFestivalDates =
      useMemo(
        () =>
          new Set(
            applications
              .filter(
                (application) =>
                  application.leave_type ===
                    "festival" &&
                  [
                    "pending",
                    "approved",
                  ].includes(
                    String(
                      application.status ||
                        ""
                    ).toLowerCase()
                  )
              )
              .map((application) =>
                String(
                  application.start_date ||
                    ""
                ).slice(0, 10)
              )
          ),
        [applications]
      );

    const eligibleFestivalHolidays =
      useMemo(
        () =>
          holidays
            .filter((holiday) => {
              const date = String(
                holiday.date || ""
              ).slice(0, 10);

              if (
                !date ||
                holiday.type !==
                  "optional"
              ) {
                return false;
              }

              if (
                date <
                minimumLeaveDate
              ) {
                return false;
              }

              if (
                blockedFestivalDates.has(
                  date
                )
              ) {
                return false;
              }

              return (
                new Date(
                  `${date}T00:00:00`
                ).getDay() !== 0
              );
            })
            .sort((a, b) =>
              String(
                a.date || ""
              ).localeCompare(
                String(b.date || "")
              )
            ),
        [
          holidays,
          minimumLeaveDate,
          blockedFestivalDates,
        ]
      );

    const selectedFestival =
      useMemo(
        () =>
          holidays.find(
            (holiday) =>
              holiday.type ===
                "optional" &&
              String(
                holiday.date || ""
              ).slice(0, 10) ===
                form.start_date
          ) || null,
        [
          holidays,
          form.start_date,
        ]
      );

    const selectedAvailable =
      selectedLeaveType
        ? Number(
            balances[
              selectedLeaveType
            ]?.available ??
              balances[
                selectedLeaveType
              ]?.remaining ??
              0
          )
        : 0;

    const fetchLeaveData =
      async () => {
        try {
          setLoading(true);
          setError("");

          const response =
            await api.get(
              "/employee-leaves/summary"
            );

          if (
            response.data?.balances
          ) {
            setBalances(
              (previous) => ({
                ...previous,
                ...response.data
                  .balances,

                festival: {
                  ...previous.festival,

                  ...(response.data
                    .balances
                    .festival || {}),
                },
              })
            );
          }

          setApplications(
            Array.isArray(
              response.data
                ?.applications
            )
              ? response.data
                  .applications
              : []
          );
        } catch (err) {
          console.error(
            "Fetch employee leave data error:",
            err
          );

          setError(
            err?.response?.data
              ?.sqlMessage ||
              err?.response?.data
                ?.error ||
              err?.response?.data
                ?.message ||
              "Failed to load leave information."
          );
        } finally {
          setLoading(false);
        }
      };

    const fetchHolidays =
      async () => {
        try {
          setHolidayLoading(true);

          const response =
            await api.get(
              "/employee-leaves/holidays"
            );

          setHolidays(
            Array.isArray(
              response.data?.holidays
            )
              ? response.data
                  .holidays
              : []
          );
        } catch (err) {
          console.error(
            "Fetch holiday calendar error:",
            err
          );
        } finally {
          setHolidayLoading(false);
        }
      };

    const refreshAll =
      async () => {
        await Promise.all([
          fetchLeaveData(),
          fetchHolidays(),
        ]);
      };

    useEffect(() => {
      refreshAll();
    }, []);

    const resetForm = () => {
      setForm({
        ...EMPTY_FORM,
      });
    };

    const openApplyModal = (
      leaveType
    ) => {
      setSelectedLeaveType(
        leaveType
      );

      resetForm();

      setError("");
      setSuccess("");
    };

    const closeApplyModal = () => {
      if (submitting) return;

      setSelectedLeaveType(null);

      resetForm();

      setError("");
    };

    const handleDurationChange = (
      durationType
    ) => {
      setForm((previous) => ({
        ...previous,

        duration_type:
          durationType,

        end_date:
          durationType ===
          "half_day"
            ? previous.start_date
            : previous.end_date,

        half_day_session:
          durationType ===
          "half_day"
            ? previous.half_day_session ||
              "first_half"
            : "first_half",
      }));

      setError("");
    };

    const handleFestivalChange = (
      holidayDate
    ) => {
      setForm((previous) => ({
        ...previous,

        start_date:
          holidayDate,

        end_date:
          holidayDate,

        duration_type:
          "full_day",

        half_day_session:
          "first_half",
      }));

      setError("");
    };

    const handleApply =
      async () => {
        if (!selectedLeaveType) {
          return;
        }

        setError("");
        setSuccess("");

        if (!form.start_date) {
          setError(
            selectedLeaveType ===
              "festival"
              ? "Please select a festival holiday."
              : "Please select the leave date."
          );

          return;
        }

        if (
          form.start_date <
          minimumLeaveDate
        ) {
          setError(
            "Leave must be applied for at least 1 day in advance."
          );

          return;
        }

        if (
          selectedLeaveType ===
          "festival"
        ) {
          if (
            !selectedFestival
          ) {
            setError(
              "Please select an eligible festival holiday."
            );

            return;
          }
        } else {
          if (
            form.duration_type ===
            "full_day"
          ) {
            if (
              !form.end_date
            ) {
              setError(
                "Please select the end date."
              );

              return;
            }

            if (
              form.end_date <
              form.start_date
            ) {
              setError(
                "Leave end date cannot be before start date."
              );

              return;
            }
          }

          if (
            form.duration_type ===
              "half_day" &&
            ![
              "first_half",
              "second_half",
            ].includes(
              form.half_day_session
            )
          ) {
            setError(
              "Please select First Half or Second Half."
            );

            return;
          }

          if (
            !form.reason.trim()
          ) {
            setError(
              "Please enter the reason for leave."
            );

            return;
          }
        }

        if (
          calculateDays <= 0
        ) {
          setError(
            "Unable to calculate leave days."
          );

          return;
        }

        const available =
          Number(
            balances[
              selectedLeaveType
            ]?.available ??
              balances[
                selectedLeaveType
              ]?.remaining ??
              0
          );

        if (
          calculateDays >
          available
        ) {
          setError(
            `You only have ${formatDays(
              available
            )} day(s) currently available.`
          );

          return;
        }

        try {
          setSubmitting(true);

          const reason =
            selectedLeaveType ===
            "festival"
              ? `Festival: ${
                  selectedFestival.name
                }${
                  form.reason.trim()
                    ? ` - ${form.reason.trim()}`
                    : ""
                }`
              : form.reason.trim();

          const response =
            await api.post(
              "/employee-leaves/apply",
              {
                leave_type:
                  selectedLeaveType,

                start_date:
                  form.start_date,

                end_date:
                  selectedLeaveType ===
                    "festival" ||
                  form.duration_type ===
                    "half_day"
                    ? form.start_date
                    : form.end_date,

                duration_type:
                  selectedLeaveType ===
                  "festival"
                    ? "full_day"
                    : form.duration_type,

                half_day_session:
                  selectedLeaveType !==
                    "festival" &&
                  form.duration_type ===
                    "half_day"
                    ? form.half_day_session
                    : null,

                reason,
              }
            );

          const email =
            response.data?.email;

          if (
            email?.sent ===
              false &&
            email?.skipped ===
              false
          ) {
            setSuccess(
              "Leave submitted successfully, but email notification could not be sent."
            );
          } else if (
            email?.sent ===
              false &&
            email?.skipped ===
              true
          ) {
            setSuccess(
              "Leave submitted successfully. Email notification was skipped."
            );
          } else {
            setSuccess(
              response.data
                ?.message ||
                "Leave application submitted successfully."
            );
          }

          await fetchLeaveData();

          setSelectedLeaveType(
            null
          );

          resetForm();
        } catch (err) {
          if (
            !err?.response ||
            err.response.status >=
              500
          ) {
            console.error(
              "Apply employee leave error:",
              err
            );
          }

          setError(
            err?.response?.data
              ?.sqlMessage ||
              err?.response?.data
                ?.error ||
              err?.response?.data
                ?.message ||
              "Failed to submit leave application."
          );
        } finally {
          setSubmitting(false);
        }
      };

    return (
      <div style={styles.page}>
        <div
          style={styles.topBar}
        >
          <div>
            <h1
              style={
                styles.pageTitle
              }
            >
              Leave Applications
            </h1>

            <p
              style={
                styles.pageSubtitle
              }
            >
              Apply for leave and
              track your available
              balance.
            </p>
          </div>

          <div
            style={
              styles.topActions
            }
          >
            <button
              type="button"
              style={
                styles.calendarIconBtn
              }
              onClick={() =>
                setShowHolidayCalendar(
                  true
                )
              }
              title="Holiday Calendar"
            >
              <CalendarDays
                size={20}
              />
            </button>

            <button
              type="button"
              style={
                styles.instructionBtn
              }
              onClick={() =>
                setShowInstructions(
                  true
                )
              }
            >
              Leave Instructions
            </button>

            <button
              type="button"
              style={
                styles.refreshBtn
              }
              onClick={refreshAll}
              disabled={loading}
            >
              <RefreshCw
                size={18}
              />

              {loading
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>
        </div>

        {error &&
          !selectedLeaveType && (
            <div
              style={
                styles.errorBox
              }
            >
              {error}
            </div>
          )}

        {success && (
          <div
            style={
              styles.successBox
            }
          >
            {success}
          </div>
        )}

        <div
          style={styles.leaveGrid}
        >
          {LEAVE_CARDS.map(
            (leave) => (
              <BalanceCard
                key={leave.key}
                leave={leave}
                balance={
                  balances[
                    leave.key
                  ] || {}
                }
                onApply={
                  openApplyModal
                }
              />
            )
          )}
        </div>

        <div
          style={
            styles.balanceInfo
          }
        >
          Sick and Casual Leave
          reset every January.
          Privileged Leave earns
          1.5 days every month and
          unused balance carries
          forward. Pending Leave is
          reserved from the
          available balance.
        </div>

        <section
          style={
            styles.historyCard
          }
        >
          <div
            style={
              styles.historyHeader
            }
          >
            <div>
              <h2
                style={
                  styles.historyTitle
                }
              >
                Leave History
              </h2>

              <p
                style={
                  styles.historySubtitle
                }
              >
                Your submitted leave
                applications and
                their status.
              </p>
            </div>

            <div
              style={
                styles.historyFilters
              }
            >
              {HISTORY_FILTERS.map(
                (filter) => (
                  <button
                    type="button"
                    key={filter}
                    style={
                      historyFilter ===
                      filter
                        ? styles.activeHistoryFilter
                        : styles.historyFilterBtn
                    }
                    onClick={() =>
                      setHistoryFilter(
                        filter
                      )
                    }
                  >
                    {filter
                      .charAt(0)
                      .toUpperCase() +
                      filter.slice(1)}
                  </button>
                )
              )}
            </div>
          </div>

          <HistoryTable
            loading={loading}
            applications={
              filteredApplications
            }
          />
        </section>

        {showHolidayCalendar && (
          <div
            style={
              styles.modalOverlay
            }
            onClick={() =>
              setShowHolidayCalendar(
                false
              )
            }
          >
            <div
              style={
                styles.holidayCalendarModal
              }
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <button
                type="button"
                style={
                  styles.closeBtn
                }
                onClick={() =>
                  setShowHolidayCalendar(
                    false
                  )
                }
              >
                <X size={20} />
              </button>

              <h2
                style={
                  styles.modalTitle
                }
              >
                Holiday Calendar
              </h2>

              <p
                style={
                  styles.modalSubtitle
                }
              >
                Fixed company
                holidays are
                automatic. Festival
                holidays can be
                applied for from the
                Holiday Leave card
                and require Admin
                approval.
              </p>

              {holidayLoading ? (
                <div
                  style={
                    styles.emptyState
                  }
                >
                  Loading holidays...
                </div>
              ) : (
                <>
                  <div
                    style={
                      styles.holidaySection
                    }
                  >
                    <h3
                      style={
                        styles.holidaySectionTitle
                      }
                    >
                      Fixed Company
                      Holidays
                    </h3>

                    {holidays
                      .filter(
                        (holiday) =>
                          holiday.type ===
                          "fixed"
                      )
                      .map(
                        (holiday) => (
                          <div
                            key={
                              holiday.date
                            }
                            style={
                              styles.fixedHolidayRow
                            }
                          >
                            <strong>
                              {formatDisplayDate(
                                holiday.date
                              )}
                            </strong>

                            <span>
                              {
                                holiday.name
                              }
                            </span>

                            <small>
                              Fixed
                            </small>
                          </div>
                        )
                      )}
                  </div>

                  <div
                    style={
                      styles.holidaySection
                    }
                  >
                    <h3
                      style={
                        styles.holidaySectionTitle
                      }
                    >
                      Festival Holiday
                      Options
                    </h3>

                    {holidays
                      .filter(
                        (holiday) =>
                          holiday.type ===
                          "optional"
                      )
                      .map(
                        (holiday) => {
                          const date =
                            String(
                              holiday.date ||
                                ""
                            ).slice(
                              0,
                              10
                            );

                          const statusApplication =
                            applications.find(
                              (
                                application
                              ) =>
                                application.leave_type ===
                                  "festival" &&
                                String(
                                  application.start_date ||
                                    ""
                                ).slice(
                                  0,
                                  10
                                ) ===
                                  date &&
                                [
                                  "pending",
                                  "approved",
                                ].includes(
                                  String(
                                    application.status ||
                                      ""
                                  ).toLowerCase()
                                )
                            );

                          return (
                            <div
                              key={
                                holiday.date
                              }
                              style={
                                styles.optionalHolidayRow
                              }
                            >
                              <strong>
                                {formatDisplayDate(
                                  holiday.date
                                )}
                              </strong>

                              <span>
                                {
                                  holiday.name
                                }
                              </span>

                              <small>
                                {statusApplication
                                  ? String(
                                      statusApplication.status ||
                                        "pending"
                                    )
                                      .charAt(
                                        0
                                      )
                                      .toUpperCase() +
                                    String(
                                      statusApplication.status ||
                                        "pending"
                                    ).slice(
                                      1
                                    )
                                  : "Available"}
                              </small>
                            </div>
                          );
                        }
                      )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <LeaveInstructionsModal
          open={showInstructions}
          onClose={() =>
            setShowInstructions(
              false
            )
          }
        />

        {selectedLeaveType && (
          <div
            style={
              styles.modalOverlay
            }
            onClick={
              closeApplyModal
            }
          >
            <div
              style={styles.modal}
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <button
                type="button"
                style={
                  styles.closeBtn
                }
                onClick={
                  closeApplyModal
                }
              >
                <X size={20} />
              </button>

              <h2
                style={
                  styles.modalTitle
                }
              >
                Apply for{" "}
                {getLeaveLabel(
                  selectedLeaveType
                )}
              </h2>

              <p
                style={
                  styles.modalSubtitle
                }
              >
                Currently
                available:{" "}
                <strong>
                  {formatDays(
                    selectedAvailable
                  )}
                </strong>{" "}
                day(s)
              </p>

              {error && (
                <div
                  style={
                    styles.modalError
                  }
                >
                  {error}
                </div>
              )}

              {selectedLeaveType ===
              "festival" ? (
                <>
                  <label
                    style={
                      styles.field
                    }
                  >
                    <span>
                      Festival Holiday
                    </span>

                    <select
                      style={
                        styles.input
                      }
                      value={
                        form.start_date
                      }
                      onChange={(
                        event
                      ) =>
                        handleFestivalChange(
                          event.target
                            .value
                        )
                      }
                      disabled={
                        holidayLoading
                      }
                    >
                      <option value="">
                        {holidayLoading
                          ? "Loading holidays..."
                          : "Select a festival holiday"}
                      </option>

                      {eligibleFestivalHolidays.map(
                        (holiday) => (
                          <option
                            key={
                              holiday.date
                            }
                            value={
                              holiday.date
                            }
                          >
                            {formatDisplayDate(
                              holiday.date
                            )}{" "}
                            -{" "}
                            {
                              holiday.name
                            }
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  {!holidayLoading &&
                    eligibleFestivalHolidays.length ===
                      0 && (
                      <div
                        style={
                          styles.festivalInfo
                        }
                      >
                        No eligible
                        festival
                        holidays are
                        currently
                        available.
                      </div>
                    )}

                  {selectedFestival && (
                    <div
                      style={
                        styles.selectedFestival
                      }
                    >
                      <span>
                        Selected
                        Holiday
                      </span>

                      <strong>
                        {
                          selectedFestival.name
                        }
                      </strong>

                      <small>
                        {formatDisplayDate(
                          selectedFestival.date
                        )}
                      </small>
                    </div>
                  )}

                  <label
                    style={
                      styles.field
                    }
                  >
                    <span>
                      Note{" "}
                      <small>
                        (optional)
                      </small>
                    </span>

                    <textarea
                      style={
                        styles.textarea
                      }
                      value={
                        form.reason
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            previous
                          ) => ({
                            ...previous,

                            reason:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      placeholder="Optional note for Admin..."
                    />
                  </label>
                </>
              ) : (
                <>
                  <div
                    style={
                      styles.formSection
                    }
                  >
                    <span
                      style={
                        styles.formSectionLabel
                      }
                    >
                      Leave Duration
                    </span>

                    <div
                      style={
                        styles.optionGrid
                      }
                    >
                      <button
                        type="button"
                        style={
                          form.duration_type ===
                          "full_day"
                            ? styles.activeOptionBtn
                            : styles.optionBtn
                        }
                        onClick={() =>
                          handleDurationChange(
                            "full_day"
                          )
                        }
                      >
                        Full Day
                      </button>

                      <button
                        type="button"
                        style={
                          form.duration_type ===
                          "half_day"
                            ? styles.activeOptionBtn
                            : styles.optionBtn
                        }
                        onClick={() =>
                          handleDurationChange(
                            "half_day"
                          )
                        }
                      >
                        Half Day
                      </button>
                    </div>
                  </div>

                  {form.duration_type ===
                    "half_day" && (
                    <div
                      style={
                        styles.formSection
                      }
                    >
                      <span
                        style={
                          styles.formSectionLabel
                        }
                      >
                        Half-Day
                        Session
                      </span>

                      <div
                        style={
                          styles.optionGrid
                        }
                      >
                        <button
                          type="button"
                          style={
                            form.half_day_session ===
                            "first_half"
                              ? styles.activeOptionBtn
                              : styles.optionBtn
                          }
                          onClick={() =>
                            setForm(
                              (
                                previous
                              ) => ({
                                ...previous,

                                half_day_session:
                                  "first_half",
                              })
                            )
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
                            setForm(
                              (
                                previous
                              ) => ({
                                ...previous,

                                half_day_session:
                                  "second_half",
                              })
                            )
                          }
                        >
                          Second Half
                        </button>
                      </div>
                    </div>
                  )}

                  <div
                    style={
                      form.duration_type ===
                      "half_day"
                        ? styles.singleDateGrid
                        : styles.formGrid
                    }
                  >
                    <label
                      style={
                        styles.field
                      }
                    >
                      <span>
                        {form.duration_type ===
                        "half_day"
                          ? "Leave Date"
                          : "From Date"}
                      </span>

                      <input
                        type="date"
                        min={
                          minimumLeaveDate
                        }
                        style={
                          styles.input
                        }
                        value={
                          form.start_date
                        }
                        onChange={(
                          event
                        ) => {
                          const value =
                            event
                              .target
                              .value;

                          setForm(
                            (
                              previous
                            ) => ({
                              ...previous,

                              start_date:
                                value,

                              end_date:
                                previous.duration_type ===
                                "half_day"
                                  ? value
                                  : previous.end_date &&
                                    previous.end_date <
                                      value
                                  ? ""
                                  : previous.end_date,
                            })
                          );
                        }}
                      />
                    </label>

                    {form.duration_type ===
                      "full_day" && (
                      <label
                        style={
                          styles.field
                        }
                      >
                        <span>
                          To Date
                        </span>

                        <input
                          type="date"
                          min={
                            form.start_date ||
                            minimumLeaveDate
                          }
                          style={
                            styles.input
                          }
                          value={
                            form.end_date
                          }
                          onChange={(
                            event
                          ) =>
                            setForm(
                              (
                                previous
                              ) => ({
                                ...previous,

                                end_date:
                                  event
                                    .target
                                    .value,
                              })
                            )
                          }
                        />
                      </label>
                    )}
                  </div>

                  <div
                    style={
                      styles.daysBox
                    }
                  >
                    <span>
                      Leave Days
                    </span>

                    <strong>
                      {formatDays(
                        calculateDays
                      )}
                    </strong>
                  </div>

                  {calculateDays >
                    0 && (
                    <div
                      style={
                        styles.balancePreview
                      }
                    >
                      <div
                        style={
                          styles.balancePreviewItem
                        }
                      >
                        <span>
                          Pending
                          reservation
                        </span>

                        <strong>
                          {formatDays(
                            calculateDays
                          )}{" "}
                          day(s)
                        </strong>
                      </div>

                      <div
                        style={
                          styles.balancePreviewItem
                        }
                      >
                        <span>
                          Available
                          after
                          submission
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

                  <label
                    style={
                      styles.field
                    }
                  >
                    <span>
                      Reason
                    </span>

                    <textarea
                      style={
                        styles.textarea
                      }
                      value={
                        form.reason
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            previous
                          ) => ({
                            ...previous,

                            reason:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      placeholder="Enter reason for leave..."
                    />
                  </label>
                </>
              )}

              <div
                style={
                  styles.modalActions
                }
              >
                <button
                  type="button"
                  style={
                    styles.cancelBtn
                  }
                  onClick={
                    closeApplyModal
                  }
                  disabled={
                    submitting
                  }
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
                  onClick={
                    handleApply
                  }
                  disabled={
                    submitting
                  }
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
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: "20px",
    marginBottom: "26px",
  },

  pageTitle: {
    margin: "0 0 7px",
    color: "#111827",
    fontSize: "34px",
    fontWeight: 900,
    lineHeight: 1.1,
  },

  pageSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "15px",
  },

  topActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  calendarIconBtn: {
    width: "46px",
    height: "46px",
    minWidth: "46px",

    border:
      "1px solid #ff5733",

    background: "#ffffff",
    color: "#ff5733",

    borderRadius: "14px",

    display: "grid",
    placeItems: "center",

    cursor: "pointer",
  },

  instructionBtn: {
    height: "46px",

    border:
      "1px solid #ff5733",

    background: "#ffffff",
    color: "#ff5733",

    borderRadius: "14px",

    padding: "0 18px",

    fontWeight: 900,

    cursor: "pointer",

    whiteSpace: "nowrap",
  },

  refreshBtn: {
    height: "46px",

    border: 0,

    background: "#ff5733",
    color: "#ffffff",

    borderRadius: "14px",

    padding: "0 18px",

    fontWeight: 900,

    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",

    gap: "8px",

    cursor: "pointer",

    whiteSpace: "nowrap",
  },

  /* ==============================
     LEAVE CARDS
  ============================== */

  leaveGrid: {
    width: "100%",

    display: "grid",

    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",

    gap: "22px",

    marginBottom: "26px",

    alignItems: "stretch",
  },

  leaveCard: {
    width: "100%",

   height: "385px",
minHeight: "385px",

    boxSizing: "border-box",

    background: "#ffffff",

    border:
      "1px solid #e5e7eb",

    borderRadius: "22px",

    padding: "24px",

    boxShadow:
      "0 8px 20px rgba(15,23,42,0.06)",

    display: "flex",

    flexDirection: "column",

    alignItems: "stretch",

    overflow: "hidden",
  },

  leaveTitleRow: {
    display: "flex",

    flexDirection: "column",

    alignItems: "flex-start",

    justifyContent:
      "flex-start",

    gap: "16px",

    marginBottom: "9px",
  },

  cardIcon: {
    width: "48px",
    height: "48px",

    minWidth: "48px",
    minHeight: "48px",

    borderRadius: "14px",

    display: "grid",

    placeItems: "center",

    background: "#fff1eb",

    color: "#ff5733",

    flexShrink: 0,
  },

  leaveTitle: {
    margin: 0,

    color: "#111827",

    fontSize: "22px",

    fontWeight: 900,

    lineHeight: 1.15,

    letterSpacing: "-0.2px",
  },

  leaveDescription: {
    margin: "0 0 20px",

    minHeight: "34px",

    color: "#64748b",

    fontSize: "14px",

    lineHeight: 1.45,
  },

  /* ==============================
     BALANCE ROW
  ============================== */

  balanceGrid: {
    width: "100%",

    display: "grid",

    gridTemplateColumns:
      "0.9fr 0.9fr 1.15fr 1.25fr",

    columnGap: "3px",

    alignItems: "start",

    marginBottom: "16px",
  },

  balanceStat: {
    width: "100%",

    minWidth: 0,

    display: "flex",

    flexDirection: "column",

    alignItems: "center",

    justifyContent: "center",

    gap: "7px",

    textAlign: "center",
  },

  balanceLabel: {
    display: "block",

    width: "100%",

    margin: 0,

    padding: 0,

    color: "#64748b",

    fontSize: "10px",

    fontWeight: 800,

    lineHeight: 1,

    textAlign: "center",

    whiteSpace: "nowrap",
  },

  totalNumber: {
    margin: 0,

    padding: 0,

    display: "block",

    color: "#111827",

    fontSize: "24px",

    fontWeight: 900,

    lineHeight: 1,
  },

  usedNumber: {
    margin: 0,

    padding: 0,

    display: "block",

    color: "#111827",

    fontSize: "24px",

    fontWeight: 900,

    lineHeight: 1,
  },

  pendingNumber: {
    margin: 0,

    padding: 0,

    display: "block",

    color: "#d97706",

    fontSize: "24px",

    fontWeight: 900,

    lineHeight: 1,
  },

  availableNumber: {
    margin: 0,

    padding: 0,

    display: "block",

    color: "#15803d",

    fontSize: "24px",

    fontWeight: 900,

    lineHeight: 1,
  },

  balanceProgressTrack: {
    width: "100%",

    height: "9px",

    flexShrink: 0,

    background: "#e5e7eb",

    borderRadius: "999px",

    overflow: "hidden",

    marginBottom: "9px",
  },

  balanceProgressFill: {
    height: "100%",

    background: "#22c55e",

    borderRadius: "999px",

    transition:
      "width 0.25s ease",
  },

  availableText: {
    margin: "0 0 14px",

    color: "#64748b",

    fontSize: "12px",

    fontWeight: 800,

    lineHeight: 1.3,

    textAlign: "right",
  },

  cardInfo: {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",

  gap: "4px",

  color: "#64748b",

  fontSize: "11.5px",
  lineHeight: 1.3,

  marginBottom: "6px",
},

  applyBtn: {
  width: "100%",

  height: "44px",
  minHeight: "44px",

  flexShrink: 0,

  border: 0,
  borderRadius: "14px",

  background: "#ff5733",
  color: "#ffffff",

  fontSize: "14px",
  fontWeight: 900,

  cursor: "pointer",

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  gap: "8px",

  marginTop: "auto",

  padding: "0 10px",

  boxSizing: "border-box",
},

  disabledApplyBtn: {
    opacity: 0.48,

    cursor: "not-allowed",

    background: "#ff8f7c",
  },

  balanceInfo: {
    margin: "-8px 0 26px",

    padding: "13px 16px",

    border:
      "1px solid #e5e7eb",

    borderRadius: "14px",

    background: "#f8fafc",

    color: "#64748b",

    fontSize: "13px",

    fontWeight: 700,

    lineHeight: 1.45,
  },

  historyCard: {
    background: "#ffffff",

    border:
      "1.5px solid #d1d5db",

    borderRadius: "22px",

    padding: "26px 28px",

    boxShadow:
      "0 8px 20px rgba(15,23,42,0.06)",

    overflow: "hidden",
  },

  historyHeader: {
    display: "flex",

    alignItems: "center",

    justifyContent:
      "space-between",

    gap: "18px",

    flexWrap: "wrap",

    paddingBottom: "20px",

    marginBottom: "18px",

    borderBottom:
      "1px solid #e5e7eb",
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
    border:
      "1px solid #e5e7eb",

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
    border:
      "1px solid #ff5733",

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

    borderTop:
      "1px solid #e5e7eb",

    borderBottom:
      "1px solid #e5e7eb",
  },

  firstHeadCell: {
    borderLeft:
      "1px solid #e5e7eb",

    borderTopLeftRadius:
      "14px",

    borderBottomLeftRadius:
      "14px",
  },

  lastHeadCell: {
    borderRight:
      "1px solid #e5e7eb",

    borderTopRightRadius:
      "14px",

    borderBottomRightRadius:
      "14px",
  },

  tableCell: {
    padding: "16px 14px",

    textAlign: "center",

    verticalAlign: "middle",

    background: "#ffffff",

    color: "#111827",

    fontSize: "14px",

    borderTop:
      "1px solid #e5e7eb",

    borderBottom:
      "1px solid #e5e7eb",
  },

  firstTableCell: {
    borderLeft:
      "1px solid #e5e7eb",

    borderTopLeftRadius:
      "14px",

    borderBottomLeftRadius:
      "14px",
  },

  lastTableCell: {
    borderRight:
      "1px solid #e5e7eb",

    borderTopRightRadius:
      "14px",

    borderBottomRightRadius:
      "14px",
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
    border:
      "1px dashed #d1d5db",

    borderRadius: "16px",

    padding: "26px",

    textAlign: "center",

    color: "#94a3b8",

    fontWeight: 800,
  },

  errorBox: {
    background: "#fff1f2",

    border:
      "1px solid #fecdd3",

    color: "#b91c1c",

    borderRadius: "14px",

    padding: "14px",

    marginBottom: "18px",

    fontWeight: 800,
  },

  successBox: {
    background: "#f0fdf4",

    border:
      "1px solid #bbf7d0",

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
    width:
      "min(680px, 95vw)",

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
    margin:
      "0 52px 8px 0",

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

    border:
      "1px solid #fecdd3",

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

    border:
      "1px solid #d1d5db",

    borderRadius: "13px",

    background: "#ffffff",

    color: "#475569",

    fontWeight: 900,

    cursor: "pointer",
  },

  activeOptionBtn: {
    minHeight: "46px",

    border:
      "1px solid #ff5733",

    borderRadius: "13px",

    background: "#fff1eb",

    color: "#ff5733",

    fontWeight: 900,

    cursor: "pointer",
  },

  formGrid: {
    display: "grid",

    gridTemplateColumns:
      "1fr 1fr",

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

    border:
      "1px solid #d1d5db",

    borderRadius: "13px",

    padding: "0 12px",

    fontFamily: "inherit",

    color: "#111827",

    background: "#ffffff",
  },

  textarea: {
    minHeight: "100px",

    border:
      "1px solid #d1d5db",

    borderRadius: "14px",

    padding: "12px",

    resize: "vertical",

    fontFamily: "inherit",
  },

  daysBox: {
    display: "flex",

    justifyContent:
      "space-between",

    background: "#fff7f4",

    border:
      "1px solid #ffd4c8",

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

    border:
      "1px solid #e5e7eb",

    borderRadius: "14px",

    padding: "13px",

    display: "flex",

    flexDirection: "column",

    gap: "5px",

    color: "#64748b",

    fontSize: "12px",

    fontWeight: 700,
  },

  selectedFestival: {
    display: "grid",

    gap: "5px",

    background: "#fff7f4",

    border:
      "1px solid #ffd4c8",

    borderRadius: "14px",

    padding: "14px",

    marginBottom: "16px",

    color: "#111827",
  },

  festivalInfo: {
    background: "#f8fafc",

    border:
      "1px solid #e5e7eb",

    borderRadius: "14px",

    padding: "14px",

    marginBottom: "16px",

    color: "#64748b",

    fontWeight: 700,
  },

  holidayCalendarModal: {
    width:
      "min(760px, 96vw)",

    maxHeight: "90vh",

    overflowY: "auto",

    background: "#ffffff",

    borderRadius: "24px",

    padding: "28px",

    position: "relative",

    boxShadow:
      "0 28px 80px rgba(15,23,42,0.3)",
  },

  holidaySection: {
    marginTop: "20px",

    display: "grid",

    gap: "9px",
  },

  holidaySectionTitle: {
    margin: "0 0 4px",

    color: "#111827",

    fontSize: "17px",

    fontWeight: 900,
  },

  fixedHolidayRow: {
    display: "grid",

    gridTemplateColumns:
      "120px 1fr auto",

    gap: "14px",

    alignItems: "center",

    padding: "12px 14px",

    border:
      "1px solid #fecdd3",

    borderRadius: "13px",

    background: "#fff1f2",

    color: "#111827",

    fontSize: "13px",
  },

  optionalHolidayRow: {
    display: "grid",

    gridTemplateColumns:
      "120px 1fr auto",

    gap: "14px",

    alignItems: "center",

    padding: "12px 14px",

    border:
      "1px solid #fed7aa",

    borderRadius: "13px",

    background: "#fff7ed",

    color: "#111827",

    fontSize: "13px",
  },

  modalActions: {
    display: "flex",

    justifyContent: "flex-end",

    gap: "12px",
  },

  cancelBtn: {
    minWidth: "110px",

    height: "46px",

    border:
      "1px solid #d1d5db",

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
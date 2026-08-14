import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

import {
  HOLIDAYS,
  HOLIDAY_YEAR,
} from "../../data/holidays";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEK_DAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

const HolidayCalendarModal = ({
  open,
  onClose,
}) => {
  const defaultMonth =
    new Date().getFullYear() ===
    HOLIDAY_YEAR
      ? new Date().getMonth()
      : 0;

  const [month, setMonth] =
    useState(defaultMonth);

  useEffect(() => {
    if (open) {
      setMonth(defaultMonth);
    }
  }, [open, defaultMonth]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(
      HOLIDAY_YEAR,
      month,
      1
    ).getDay();

    const daysInMonth = new Date(
      HOLIDAY_YEAR,
      month + 1,
      0
    ).getDate();

    return [
      ...Array(firstDay).fill(null),

      ...Array.from(
        {
          length: daysInMonth,
        },
        (_, index) =>
          index + 1
      ),
    ];
  }, [month]);

  const monthHolidays = useMemo(
    () =>
      HOLIDAYS.filter(
        (holiday) => {
          const holidayMonth =
            Number(
              holiday.date.slice(
                5,
                7
              )
            ) - 1;

          return (
            holidayMonth === month
          );
        }
      ),
    [month]
  );

  const getHolidayForDay = (
    day
  ) => {
    const date = `${HOLIDAY_YEAR}-${String(
      month + 1
    ).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;

    return HOLIDAYS.find(
      (holiday) =>
        holiday.date === date
    );
  };

  if (!open) {
    return null;
  }

  return (
    <div
      style={styles.overlay}
      onClick={onClose}
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
          onClick={onClose}
        >
          <X size={20} />
        </button>

        <h2 style={styles.title}>
          Holiday Calendar{" "}
          {HOLIDAY_YEAR}
        </h2>

        <p style={styles.subtitle}>
          Fixed company holidays and
          optional festival holidays.
        </p>

        <div style={styles.legend}>
          <span
            style={styles.legendItem}
          >
            <span
              style={styles.fixedDot}
            />

            Fixed Company Holiday
          </span>

          <span
            style={styles.legendItem}
          >
            <span
              style={styles.optionalDot}
            />

            Optional Festival Holiday
          </span>
        </div>

        <div
          style={styles.monthHeader}
        >
          <button
            type="button"
            style={styles.navBtn}
            disabled={month === 0}
            onClick={() =>
              setMonth(
                (value) =>
                  Math.max(
                    0,
                    value - 1
                  )
              )
            }
          >
            <ChevronLeft
              size={18}
            />
          </button>

          <strong
            style={styles.monthTitle}
          >
            {MONTH_NAMES[month]}{" "}
            {HOLIDAY_YEAR}
          </strong>

          <button
            type="button"
            style={styles.navBtn}
            disabled={
              month === 11
            }
            onClick={() =>
              setMonth(
                (value) =>
                  Math.min(
                    11,
                    value + 1
                  )
              )
            }
          >
            <ChevronRight
              size={18}
            />
          </button>
        </div>

        <div
          style={styles.weekGrid}
        >
          {WEEK_DAYS.map(
            (day) => (
              <div
                key={day}
                style={
                  styles.weekDay
                }
              >
                {day}
              </div>
            )
          )}
        </div>

        <div
          style={styles.calendarGrid}
        >
          {calendarDays.map(
            (day, index) => {
              if (!day) {
                return (
                  <div
                    key={`empty-${index}`}
                    style={
                      styles.emptyDay
                    }
                  />
                );
              }

              const holiday =
                getHolidayForDay(
                  day
                );

              const holidayStyle =
                holiday?.type ===
                "fixed"
                  ? styles.fixedDay
                  : holiday?.type ===
                    "optional"
                  ? styles.optionalDay
                  : {};

              return (
                <div
                  key={day}
                  style={{
                    ...styles.dayCell,
                    ...holidayStyle,
                  }}
                >
                  <strong
                    style={
                      styles.dayNumber
                    }
                  >
                    {day}
                  </strong>

                  {holiday && (
                    <span
                      style={
                        styles.holidayName
                      }
                    >
                      {holiday.name}
                    </span>
                  )}
                </div>
              );
            }
          )}
        </div>

        <div
          style={styles.monthList}
        >
          <h3
            style={styles.listTitle}
          >
            Holidays this month
          </h3>

          {monthHolidays.length ===
          0 ? (
            <p
              style={
                styles.noHoliday
              }
            >
              No company or festival
              holidays this month.
            </p>
          ) : (
            monthHolidays.map(
              (holiday) => (
                <div
                  key={
                    holiday.date
                  }
                  style={
                    styles.holidayRow
                  }
                >
                  <div>
                    <strong>
                      {holiday.date
                        .split("-")
                        .reverse()
                        .join("-")}
                    </strong>

                    <div
                      style={
                        styles.rowName
                      }
                    >
                      {holiday.name}
                    </div>
                  </div>

                  <span
                    style={
                      holiday.type ===
                      "fixed"
                        ? styles.fixedBadge
                        : styles.optionalBadge
                    }
                  >
                    {holiday.type ===
                    "fixed"
                      ? "Fixed"
                      : "Festival"}
                  </span>
                </div>
              )
            )
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,

    background:
      "rgba(15,23,42,0.52)",

    zIndex: 30000,

    display: "flex",
    alignItems: "center",
    justifyContent: "center",

    padding: "20px",
  },

  modal: {
    width:
      "min(820px, 96vw)",

    maxHeight: "92vh",

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

    right: "20px",
    top: "20px",

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

  title: {
    margin:
      "0 54px 6px 0",

    fontSize: "27px",
    fontWeight: 900,

    color: "#111827",
  },

  subtitle: {
    margin: "0 0 18px",

    color: "#64748b",

    fontSize: "14px",
  },

  legend: {
    display: "flex",

    flexWrap: "wrap",

    gap: "18px",

    padding: "12px 14px",

    borderRadius: "14px",

    background: "#f8fafc",

    marginBottom: "16px",
  },

  legendItem: {
    display: "inline-flex",

    alignItems: "center",

    gap: "7px",

    color: "#334155",

    fontSize: "13px",

    fontWeight: 800,
  },

  fixedDot: {
    width: "11px",
    height: "11px",

    borderRadius: "50%",

    background: "#ff5733",
  },

  optionalDot: {
    width: "11px",
    height: "11px",

    borderRadius: "50%",

    background: "#f59e0b",
  },

  monthHeader: {
    display: "grid",

    gridTemplateColumns:
      "42px 1fr 42px",

    alignItems: "center",

    gap: "12px",

    marginBottom: "14px",
  },

  monthTitle: {
    textAlign: "center",

    color: "#111827",

    fontSize: "18px",
  },

  navBtn: {
    width: "42px",
    height: "42px",

    border:
      "1px solid #e2e8f0",

    borderRadius: "12px",

    background: "#ffffff",

    display: "grid",

    placeItems: "center",

    cursor: "pointer",
  },

  weekGrid: {
    display: "grid",

    gridTemplateColumns:
      "repeat(7, 1fr)",

    gap: "7px",

    marginBottom: "7px",
  },

  weekDay: {
    textAlign: "center",

    color: "#64748b",

    fontSize: "12px",

    fontWeight: 900,

    padding: "6px 0",
  },

  calendarGrid: {
    display: "grid",

    gridTemplateColumns:
      "repeat(7, 1fr)",

    gap: "7px",
  },

  emptyDay: {
    minHeight: "82px",
  },

  dayCell: {
    minHeight: "82px",

    border:
      "1px solid #e2e8f0",

    borderRadius: "12px",

    padding: "9px",

    background: "#ffffff",

    boxSizing: "border-box",
  },

  fixedDay: {
    background: "#fff1eb",

    border:
      "1px solid #ff9d85",
  },

  optionalDay: {
    background: "#fff8eb",

    border:
      "1px solid #fbbf24",
  },

  dayNumber: {
    display: "block",

    color: "#111827",

    fontSize: "13px",

    marginBottom: "6px",
  },

  holidayName: {
    display: "block",

    color: "#334155",

    fontSize: "10px",

    fontWeight: 800,

    lineHeight: 1.25,
  },

  monthList: {
    borderTop:
      "1px solid #e2e8f0",

    marginTop: "18px",

    paddingTop: "16px",
  },

  listTitle: {
    margin: "0 0 10px",

    color: "#111827",

    fontSize: "17px",

    fontWeight: 900,
  },

  noHoliday: {
    margin: 0,

    color: "#94a3b8",

    fontSize: "13px",
  },

  holidayRow: {
    display: "flex",

    alignItems: "center",

    justifyContent:
      "space-between",

    gap: "14px",

    padding: "11px 0",

    borderBottom:
      "1px solid #f1f5f9",

    color: "#111827",

    fontSize: "13px",
  },

  rowName: {
    marginTop: "3px",

    color: "#64748b",
  },

  fixedBadge: {
    borderRadius: "999px",

    background: "#fff1eb",

    color: "#e54424",

    padding: "6px 10px",

    fontSize: "11px",

    fontWeight: 900,

    whiteSpace: "nowrap",
  },

  optionalBadge: {
    borderRadius: "999px",

    background: "#fef3c7",

    color: "#92400e",

    padding: "6px 10px",

    fontSize: "11px",

    fontWeight: 900,

    whiteSpace: "nowrap",
  },
};

export default HolidayCalendarModal;
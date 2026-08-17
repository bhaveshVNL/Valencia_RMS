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

import api from "../../api/axios";

const HolidayCalendarModal = ({
  open,
  onClose,
  onChanged,
}) => {
  const [calendarMonth, setCalendarMonth] =
    useState(new Date().getMonth());

  const [holidays, setHolidays] =
    useState([]);

  const [selectedCount, setSelectedCount] =
    useState(0);

  const [maxOptional, setMaxOptional] =
    useState(4);

  const [loading, setLoading] =
    useState(false);

  const [savingDate, setSavingDate] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const year = 2026;

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await api.get(
          "/employee-leaves/holidays"
        );

      const data =
        response.data || {};

      const holidayRows =
        Array.isArray(data.holidays)
          ? data.holidays
          : [];

      setHolidays(
        holidayRows
      );

      setSelectedCount(
        Number(
          data.selected_count || 0
        )
      );

      setMaxOptional(
        Number(
          data.max_optional || 4
        )
      );

      if (onChanged) {
        onChanged({
          holidays:
            holidayRows,

          selected_count:
            Number(
              data.selected_count ||
                0
            ),

          max_optional:
            Number(
              data.max_optional ||
                4
            ),
        });
      }
    } catch (err) {
      console.error(
        "Holiday calendar load error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Failed to load holiday calendar."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setMessage("");
      setError("");
      setCalendarMonth(
        new Date().getMonth()
      );

      fetchHolidays();
    }
  }, [open]);

  const today = new Date();

  const todayKey =
    `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;

  const holidaysByDate =
    useMemo(
      () =>
        new Map(
          holidays.map(
            (holiday) => [
              holiday.date,
              holiday,
            ]
          )
        ),
      [holidays]
    );

  const daysInMonth =
    new Date(
      year,
      calendarMonth + 1,
      0
    ).getDate();

  const firstWeekday =
    new Date(
      year,
      calendarMonth,
      1
    ).getDay();

  const monthName =
    new Date(
      year,
      calendarMonth,
      1
    ).toLocaleString(
      "en-IN",
      {
        month: "long",
        year: "numeric",
      }
    );

  const monthHolidays =
    holidays.filter(
      (holiday) =>
        Number(
          holiday.date.slice(
            5,
            7
          )
        ) ===
        calendarMonth + 1
    );

  const toggleHoliday =
    async (holiday) => {
      if (!holiday) return;

      setMessage("");
      setError("");

      if (
        holiday.type ===
        "fixed"
      ) {
        setError(
          "This is already a fixed company holiday."
        );

        return;
      }

      const isSunday =
        new Date(
          `${holiday.date}T00:00:00`
        ).getDay() === 0;

      if (isSunday) {
        setError(
          "This festival falls on Sunday, which is already a weekly off."
        );

        return;
      }

      if (
        holiday.date <
          todayKey &&
        !holiday.selected
      ) {
        setError(
          "Past holidays cannot be selected."
        );

        return;
      }

      try {
        setSavingDate(
          holiday.date
        );

        const response =
          await api.post(
            "/employee-leaves/holidays/toggle",
            {
              holiday_date:
                holiday.date,
            }
          );

        setMessage(
          response.data?.message ||
            "Holiday selection updated."
        );

        /*
        Reload from backend so the
        green selected state and count
        always match MySQL.
        */
        await fetchHolidays();
      } catch (err) {
        console.error(
          "Toggle holiday error:",
          err
        );

        setError(
          err?.response?.data
            ?.message ||
            err?.response?.data
              ?.error ||
            "Failed to update holiday."
        );
      } finally {
        setSavingDate("");
      }
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
          <X size={19} />
        </button>

        <h2 style={styles.title}>
          Holiday Calendar {year}
        </h2>

        <p style={styles.counter}>
          Festival Holidays Selected:{" "}
          <strong>
            {selectedCount} /{" "}
            {maxOptional}
          </strong>
        </p>

        <div style={styles.legend}>
          <span>🔒 Fixed</span>
          <span>🟠 Festival Option</span>
          <span>🟢 Selected</span>
        </div>

        {message && (
          <div style={styles.message}>
            {message}
          </div>
        )}

        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        <div style={styles.monthNav}>
          <button
            type="button"
            style={styles.navBtn}
            disabled={
              calendarMonth === 0
            }
            onClick={() =>
              setCalendarMonth(
                (month) =>
                  Math.max(
                    0,
                    month - 1
                  )
              )
            }
          >
            <ChevronLeft
              size={20}
            />
          </button>

          <strong>
            {monthName}
          </strong>

          <button
            type="button"
            style={styles.navBtn}
            disabled={
              calendarMonth === 11
            }
            onClick={() =>
              setCalendarMonth(
                (month) =>
                  Math.min(
                    11,
                    month + 1
                  )
              )
            }
          >
            <ChevronRight
              size={20}
            />
          </button>
        </div>

        <div style={styles.weekRow}>
          {[
            "Sun",
            "Mon",
            "Tue",
            "Wed",
            "Thu",
            "Fri",
            "Sat",
          ].map((day) => (
            <span key={day}>
              {day}
            </span>
          ))}
        </div>

        {loading ? (
          <div style={styles.loadingBox}>
            Loading holidays...
          </div>
        ) : (
          <div style={styles.grid}>
            {Array.from({
              length:
                firstWeekday,
            }).map(
              (_, index) => (
                <div
                  key={`blank-${index}`}
                />
              )
            )}

            {Array.from({
              length:
                daysInMonth,
            }).map(
              (_, index) => {
                const day =
                  index + 1;

                const date =
                  `${year}-${String(
                    calendarMonth +
                      1
                  ).padStart(
                    2,
                    "0"
                  )}-${String(
                    day
                  ).padStart(
                    2,
                    "0"
                  )}`;

                const holiday =
                  holidaysByDate.get(
                    date
                  );

                const selected =
                  Boolean(
                    holiday?.selected
                  );

                const isSunday =
                  new Date(
                    year,
                    calendarMonth,
                    day
                  ).getDay() === 0;

                const isPast =
                  date <
                  todayKey;

                const isFixed =
                  holiday?.type ===
                  "fixed";

                const canClick =
                  Boolean(
                    holiday
                  ) &&
                  !isFixed &&
                  !isSunday &&
                  (!isPast ||
                    selected);

                let background =
                  "#ffffff";

                let border =
                  "#e5e7eb";

                if (isFixed) {
                  background =
                    "#fee2e2";

                  border =
                    "#fca5a5";
                } else if (
                  selected
                ) {
                  background =
                    "#dcfce7";

                  border =
                    "#22c55e";
                } else if (
                  holiday
                ) {
                  background =
                    "#fff7ed";

                  border =
                    "#fdba74";
                }

                return (
                  <button
                    type="button"
                    key={date}
                    disabled={
                      !canClick ||
                      savingDate ===
                        date
                    }
                    onClick={() =>
                      toggleHoliday(
                        holiday
                      )
                    }
                    style={{
                      ...styles.day,
                      background,
                      borderColor:
                        border,

                      cursor:
                        canClick
                          ? "pointer"
                          : "default",

                      opacity:
                        holiday &&
                        (isPast ||
                          isSunday) &&
                        !selected &&
                        !isFixed
                          ? 0.5
                          : 1,
                    }}
                  >
                    <strong>
                      {day}
                    </strong>

                    {holiday && (
                      <small
                        style={
                          styles.holidayName
                        }
                      >
                        {isFixed
                          ? "🔒 "
                          : selected
                          ? "✓ "
                          : ""}

                        {
                          holiday.name
                        }

                        {savingDate ===
                          date && (
                          <>
                            <br />
                            Saving...
                          </>
                        )}
                      </small>
                    )}
                  </button>
                );
              }
            )}
          </div>
        )}

        <div style={styles.monthList}>
          <strong>
            Holidays this month
          </strong>

          {monthHolidays.length ===
          0 ? (
            <p
              style={
                styles.emptyText
              }
            >
              No listed holidays this
              month.
            </p>
          ) : (
            monthHolidays.map(
              (holiday) => {
                const isFixed =
                  holiday.type ===
                  "fixed";

                const selected =
                  Boolean(
                    holiday.selected
                  );

                const isSunday =
                  new Date(
                    `${holiday.date}T00:00:00`
                  ).getDay() === 0;

                const isPast =
                  holiday.date <
                  todayKey;

                return (
                  <div
                    key={
                      holiday.date
                    }
                    style={
                      styles.listRow
                    }
                  >
                    <div>
                      <strong>
                        {holiday.date
                          .split("-")
                          .reverse()
                          .join("-")}
                      </strong>

                      <div>
                        {
                          holiday.name
                        }
                      </div>
                    </div>

                    {isFixed ? (
                      <span
                        style={
                          styles.fixedBadge
                        }
                      >
                        Fixed
                      </span>
                    ) : (
                      <button
                        type="button"
                        style={
                          selected
                            ? styles.removeBtn
                            : styles.selectBtn
                        }
                        disabled={
                          savingDate ===
                            holiday.date ||
                          (!selected &&
                            (isPast ||
                              isSunday))
                        }
                        onClick={() =>
                          toggleHoliday(
                            holiday
                          )
                        }
                      >
                        {savingDate ===
                        holiday.date
                          ? "Saving..."
                          : selected
                          ? "Remove"
                          : isSunday
                          ? "Sunday"
                          : isPast
                          ? "Past"
                          : "Select"}
                      </button>
                    )}
                  </div>
                );
              }
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
    zIndex: 20000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    background:
      "rgba(15,23,42,0.52)",
  },

  modal: {
    width: "min(820px, 96vw)",
    maxHeight: "92vh",
    overflowY: "auto",
    position: "relative",
    padding: "28px",
    borderRadius: "24px",
    background: "#ffffff",
    boxShadow:
      "0 28px 80px rgba(15,23,42,0.3)",
  },

  closeBtn: {
    position: "absolute",
    top: "20px",
    right: "20px",
    width: "40px",
    height: "40px",
    border: 0,
    borderRadius: "12px",
    display: "grid",
    placeItems: "center",
    background: "#111827",
    color: "#ffffff",
    cursor: "pointer",
  },

  title: {
    margin:
      "0 50px 6px 0",
    fontSize: "26px",
    color: "#111827",
  },

  counter: {
    margin: "0 0 14px",
    color: "#64748b",
  },

  legend: {
    display: "flex",
    flexWrap: "wrap",
    gap: "18px",
    padding: "11px 13px",
    borderRadius: "12px",
    background: "#f8fafc",
    fontSize: "13px",
    fontWeight: 800,
  },

  message: {
    marginTop: "12px",
    padding: "10px 12px",
    borderRadius: "10px",
    background: "#f0fdf4",
    color: "#166534",
    fontSize: "13px",
    fontWeight: 800,
  },

  error: {
    marginTop: "12px",
    padding: "10px 12px",
    borderRadius: "10px",
    background: "#fff1f2",
    color: "#b91c1c",
    fontSize: "13px",
    fontWeight: 800,
  },

  monthNav: {
    display: "flex",
    alignItems: "center",
    justifyContent:
      "space-between",
    margin: "18px 0 12px",
    fontSize: "18px",
  },

  navBtn: {
    width: "40px",
    height: "40px",
    border:
      "1px solid #e5e7eb",
    borderRadius: "10px",
    display: "grid",
    placeItems: "center",
    background: "#ffffff",
    cursor: "pointer",
  },

  weekRow: {
    display: "grid",
    gridTemplateColumns:
      "repeat(7, 1fr)",
    marginBottom: "6px",
    textAlign: "center",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 900,
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(7, minmax(0, 1fr))",
    gap: "7px",
  },

  day: {
    minHeight: "82px",
    padding: "8px",
    border:
      "1px solid #e5e7eb",
    borderRadius: "11px",
    textAlign: "left",
    color: "#111827",
    overflow: "hidden",
  },

  holidayName: {
    display: "block",
    marginTop: "6px",
    fontSize: "9px",
    lineHeight: 1.2,
    fontWeight: 800,
  },

  loadingBox: {
    padding: "35px",
    textAlign: "center",
    color: "#64748b",
  },

  monthList: {
    marginTop: "20px",
    paddingTop: "15px",
    borderTop:
      "1px solid #e5e7eb",
  },

  listRow: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: "14px",
    padding: "11px 0",
    borderBottom:
      "1px solid #f1f5f9",
    fontSize: "13px",
  },

  fixedBadge: {
    padding: "7px 11px",
    borderRadius: "999px",
    background: "#fee2e2",
    color: "#991b1b",
    fontWeight: 900,
  },

  selectBtn: {
    border: 0,
    borderRadius: "10px",
    padding: "8px 14px",
    background: "#ff5733",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },

  removeBtn: {
    border:
      "1px solid #22c55e",
    borderRadius: "10px",
    padding: "8px 14px",
    background: "#f0fdf4",
    color: "#166534",
    fontWeight: 900,
    cursor: "pointer",
  },

  emptyText: {
    color: "#94a3b8",
    fontSize: "13px",
  },
};

export default HolidayCalendarModal;
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Pencil,
Trash2,
  X,
  CalendarDays,
} from "lucide-react";

import "../../layouts/adminCalendar.css";

const API =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const getAuthHeaders = () => ({
  Authorization:
    "Bearer " +
    (sessionStorage.getItem("token") ||
      localStorage.getItem("token") ||
      ""),
  "Content-Type": "application/json",
});

/* =========================================================
   DATE HELPERS
========================================================= */

const localDateString = (date) => {
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const normalizeDate = (value) => {
  if (!value) return "";

  if (typeof value === "string") {
    return value.substring(0, 10);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return localDateString(date);
};

const displayDate = (value) => {
  if (!value) return "";

  const date = new Date(`${value}T00:00:00`);

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const shortDate = (value) => {
  const normalized = normalizeDate(value);

  if (!normalized) return "";

  const date = new Date(`${normalized}T00:00:00`);

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
};

const displayTime = (value) => {
  if (!value) return "";

  const [hourString, minuteString] = String(value).split(":");

  const hour = Number(hourString);
  const minute = Number(minuteString || 0);

  if (Number.isNaN(hour)) return value;

  const date = new Date();

  date.setHours(hour, minute, 0, 0);

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

/* =========================================================
   COMPONENT
========================================================= */

const AdminCalendar = () => {
  const now = new Date();

  const todayString = localDateString(now);

  const [currentDate, setCurrentDate] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1)
  );

  const [events, setEvents] = useState({
    projects: [],
    tasks: [],
    meetings: [],
    mini_tasks: [],
  });

  const [employees, setEmployees] = useState([]);

  const [selectedDate, setSelectedDate] = useState("");

  const [activeFilter, setActiveFilter] = useState("all");

  const [showMeeting, setShowMeeting] = useState(false);

  const [selectedEmployees, setSelectedEmployees] = useState([]);

  const [loading, setLoading] = useState(false);

  const [savingMeeting, setSavingMeeting] = useState(false);

  const [meetingForm, setMeetingForm] = useState({
    title: "",
    description: "",
    date: "",
    start_time: "",
    end_time: "",
  });
  const [editingMeeting, setEditingMeeting] =
  useState(null);

const [cancellingMeeting, setCancellingMeeting] =
  useState(null);

const [showCancelConfirm, setShowCancelConfirm] =
  useState(false);

  /* =========================================================
     API
  ========================================================= */

  const loadCalendar = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `${API}/calendar/admin`,
        {
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json();

      if (data.success) {
        setEvents({
          projects: data.projects || [],
          tasks: data.tasks || [],
          meetings: data.meetings || [],
          mini_tasks: data.mini_tasks || [],
        });
      }
    } catch (error) {
      console.error("Calendar loading error:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const response = await fetch(
        `${API}/calendar/employees`,
        {
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json();

      if (data.success) {
        console.log(
          "Calendar selectable users:",
          data.employees
        );

        setEmployees(data.employees || []);
      }
    } catch (error) {
      console.error(
        "Employee loading error:",
        error
      );
    }
  };

  useEffect(() => {
    loadCalendar();
    loadEmployees();
  }, []);

  /* =========================================================
     CALENDAR GRID
  ========================================================= */

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);

    // Monday = first column
    const offset = (firstDay.getDay() + 6) % 7;

    const gridStart = new Date(
      year,
      month,
      1 - offset
    );

    const result = [];

    for (let index = 0; index < 42; index++) {
      const date = new Date(gridStart);

      date.setDate(gridStart.getDate() + index);

      result.push({
        date,
        dateString: localDateString(date),
        number: date.getDate(),
        currentMonth:
          date.getMonth() === month &&
          date.getFullYear() === year,
      });
    }

    return result;
  }, [year, month]);

  /* =========================================================
     TITLES
  ========================================================= */

  const projectTitle = (item) =>
    item.title ||
    item.project_name ||
    item.name ||
    "Project";

  const taskTitle = (item) =>
    item.title ||
    item.task_name ||
    item.name ||
    "Task";

  const meetingTitle = (item) =>
    item.title ||
    item.meeting_title ||
    "Meeting";

  const miniTaskTitle = (item) =>
    item.title ||
    item.task_name ||
    item.mini_task_name ||
    "Mini Task";

  /* =========================================================
     EVENTS SHOWN INSIDE GRID

     IMPORTANT:
     Projects/tasks appear only on their START DATE.
     They do NOT paint every day of their duration.

     This matches your reference image.
  ========================================================= */

  const gridEventsForDate = (dateString) => {
    const result = [];

    events.projects.forEach((item) => {
      if (
        normalizeDate(item.start_date) === dateString
      ) {
        result.push({
          type: "project",
          title: projectTitle(item),
          source: item,
        });
      }
    });

    events.tasks.forEach((item) => {
      if (
        normalizeDate(item.start_date) === dateString
      ) {
        result.push({
          type: "task",
          title: taskTitle(item),
          source: item,
        });
      }
    });

    events.meetings.forEach((item) => {
      if (
        normalizeDate(item.meeting_date) ===
        dateString
      ) {
        result.push({
          type: "meeting",
          title: meetingTitle(item),
          time: item.start_time,
          source: item,
        });
      }
    });

    events.mini_tasks.forEach((item) => {
      const miniDate = normalizeDate(
        item.task_date ||
          item.date ||
          item.due_date
      );

      if (miniDate === dateString) {
        result.push({
          type: "mini",
          title: miniTaskTitle(item),
          time: item.task_time || item.time,
          source: item,
        });
      }
    });

    if (activeFilter === "all") {
      return result;
    }

    return result.filter(
      (item) => item.type === activeFilter
    );
  };

  /* =========================================================
     EVENTS FOR RIGHT SIDE PANEL

     Here projects/tasks are shown if the selected date falls
     anywhere between start_date and end_date.
  ========================================================= */

  const detailEventsForDate = (dateString) => {
    if (!dateString) return [];

    const result = [];

    events.projects.forEach((item) => {
      const start = normalizeDate(item.start_date);
      const end = normalizeDate(item.end_date);

      if (
        start &&
        end &&
        dateString >= start &&
        dateString <= end
      ) {
        result.push({
          type: "project",
          title: projectTitle(item),
          source: item,
        });
      }
    });

    events.tasks.forEach((item) => {
      const start = normalizeDate(item.start_date);
      const end = normalizeDate(item.end_date);

      if (
        start &&
        end &&
        dateString >= start &&
        dateString <= end
      ) {
        result.push({
          type: "task",
          title: taskTitle(item),
          source: item,
        });
      }
    });

    events.meetings.forEach((item) => {
      if (
        normalizeDate(item.meeting_date) ===
        dateString
      ) {
        result.push({
          type: "meeting",
          title: meetingTitle(item),
          source: item,
        });
      }
    });

    events.mini_tasks.forEach((item) => {
      const miniDate = normalizeDate(
        item.task_date ||
          item.date ||
          item.due_date
      );

      if (miniDate === dateString) {
        result.push({
          type: "mini",
          title: miniTaskTitle(item),
          source: item,
        });
      }
    });

    return result;
  };

  const selectedEvents = useMemo(
    () =>
      selectedDate
        ? detailEventsForDate(selectedDate)
        : [],
    [selectedDate, events]
  );

  const selectedProjects = selectedEvents.filter(
    (item) => item.type === "project"
  );

  const selectedTasks = selectedEvents.filter(
    (item) => item.type === "task"
  );

  const selectedMeetings = selectedEvents.filter(
    (item) => item.type === "meeting"
  );

  const selectedMiniTasks = selectedEvents.filter(
    (item) => item.type === "mini"
  );

  /* =========================================================
     DATE CLICK

     THIS is the only normal action that opens right panel.
  ========================================================= */

  const handleDateClick = (calendarDate) => {
    setSelectedDate(calendarDate.dateString);

    if (!calendarDate.currentMonth) {
      setCurrentDate(
        new Date(
          calendarDate.date.getFullYear(),
          calendarDate.date.getMonth(),
          1
        )
      );
    }
  };

  /* =========================================================
     NAVIGATION
  ========================================================= */

  const previousMonth = () => {
    setSelectedDate("");

    setCurrentDate(
      new Date(year, month - 1, 1)
    );
  };

  const nextMonth = () => {
    setSelectedDate("");

    setCurrentDate(
      new Date(year, month + 1, 1)
    );
  };

  /* =========================================================
     MEETING MODAL
  ========================================================= */

  const openMeeting = (date = "") => {
  setEditingMeeting(null);

  setMeetingForm({
    title: "",
    description: "",
    date:
      date ||
      selectedDate ||
      todayString,
    start_time: "",
    end_time: "",
  });

  setSelectedEmployees([]);

  setShowMeeting(true);
};

  const closeMeeting = () => {
  if (savingMeeting) return;

  setShowMeeting(false);

  setEditingMeeting(null);

  setSelectedEmployees([]);
};

  const toggleEmployee = (employeeId) => {
    setSelectedEmployees((previous) =>
      previous.includes(employeeId)
        ? previous.filter(
            (id) => id !== employeeId
          )
        : [...previous, employeeId]
    );
  };

  const allSelectableIds = employees
    .map((employee) =>
      Number(
        employee.user_id ??
          employee.id
      )
    )
    .filter((id) => !Number.isNaN(id));

  const allSelected =
    allSelectableIds.length > 0 &&
    allSelectableIds.every((id) =>
      selectedEmployees.includes(id)
    );

  const toggleAllEmployees = () => {
    if (allSelected) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(allSelectableIds);
    }
  };

  /* =========================================================
     CREATE MEETING
  ========================================================= */

  const createMeeting = async () => {
    if (!meetingForm.title.trim()) {
      alert("Please enter the meeting title.");
      return;
    }

    if (!meetingForm.date) {
      alert("Please select the meeting date.");
      return;
    }

    if (!meetingForm.start_time) {
      alert("Please select start time.");
      return;
    }

    if (!meetingForm.end_time) {
      alert("Please select end time.");
      return;
    }

    if (
      meetingForm.end_time <=
      meetingForm.start_time
    ) {
      alert(
        "End time must be later than start time."
      );
      return;
    }

    if (selectedEmployees.length === 0) {
      alert(
        "Please select at least one employee."
      );
      return;
    }

    try {
      setSavingMeeting(true);

      const response = await fetch(
        `${API}/calendar/meetings`,
        {
          method: "POST",
          headers: getAuthHeaders(),

          body: JSON.stringify({
            title: meetingForm.title.trim(),

            description:
              meetingForm.description.trim(),

            meeting_date:
              meetingForm.date,

            start_time:
              meetingForm.start_time,

            end_time:
              meetingForm.end_time,

            employee_ids:
              selectedEmployees,
          }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        alert(
          data.message ||
            "Unable to schedule meeting."
        );

        return;
      }

      setShowMeeting(false);
      setSelectedEmployees([]);

      await loadCalendar();
    } catch (error) {
      console.error(
        "Create meeting error:",
        error
      );

      alert(
        "Something went wrong while scheduling the meeting."
      );
    } finally {
      setSavingMeeting(false);
    }
  };

  /* =========================================================
     RIGHT PANEL SECTION
  ========================================================= */
 const openEditMeeting = (meeting) => {
  if (!meeting) return;

  setEditingMeeting(meeting);

  setMeetingForm({
    title:
      meeting.title || "",

    description:
      meeting.description || "",

    date:
      normalizeDate(
        meeting.meeting_date
      ),

    start_time:
      String(
        meeting.start_time || ""
      ).slice(0, 5),

    end_time:
      String(
        meeting.end_time || ""
      ).slice(0, 5),
  });

  /*
    We need actual participant IDs for editing.

    Until the Admin Calendar API returns them,
    populate them from the meeting once we add
    employee_ids to the backend response below.
  */
  setSelectedEmployees(
    Array.isArray(
      meeting.employee_ids
    )
      ? meeting.employee_ids.map(Number)
      : []
  );

  setShowMeeting(true);
};

const askCancelMeeting = (
  meeting
) => {
  if (!meeting) return;

  setCancellingMeeting(
    meeting
  );

  setShowCancelConfirm(
    true
  );
};

const closeCancelConfirm = () => {
  setShowCancelConfirm(false);

  setCancellingMeeting(null);
};

const cancelMeeting = async () => {
  if (
    !cancellingMeeting?.id
  ) {
    return;
  }

  try {
    const response =
      await fetch(
        `${API}/calendar/meetings/${cancellingMeeting.id}/cancel`,
        {
          method: "PATCH",
          headers:
            getAuthHeaders(),
        }
      );

    const data =
      await response.json();

    if (!data.success) {
      alert(
        data.message ||
          "Unable to cancel meeting."
      );

      return;
    }

    closeCancelConfirm();

    await loadCalendar();

  } catch (error) {
    console.error(
      "Cancel meeting error:",
      error
    );

    alert(
      "Something went wrong while cancelling the meeting."
    );
  }
};

  const renderDetailSection = (
    title,
    type,
    items
  ) => {
    if (!items.length) return null;

    return (
      <section className="admin-cal-detail-section">
        <h4
          className={`admin-cal-detail-heading admin-cal-${type}-text`}
        >
          {title}
        </h4>

        {items.map((event, index) => {
          const item = event.source || {};

          let meta = "";

          if (
            type === "project" ||
            type === "task"
          ) {
            meta = `${shortDate(
              item.start_date
            )} – ${shortDate(item.end_date)}`;
          }

          if (type === "meeting") {
            const start = displayTime(
              item.start_time
            );

            const end = displayTime(
              item.end_time
            );

            meta =
              start && end
                ? `${start} – ${end}`
                : start;
          }

          if (type === "mini") {
            meta = displayTime(
              item.task_time ||
                item.time
            );
          }

          return (
            <div
              className="admin-cal-detail-item"
              key={
                item.id ||
                item.task_id ||
                item.project_id ||
                item.meeting_id ||
                `${type}-${index}`
              }
            >
              <span
                className={`admin-cal-detail-dot admin-cal-${type}-dot`}
              />

              <div className="admin-cal-detail-info">
                {meta && (
                  <span className="admin-cal-detail-meta">
                    {meta}
                  </span>
                )}

                <strong>
                  {event.title}
                </strong>

                {type === "meeting" &&
                  item.description && (
                    <p>
                      {item.description}
                    </p>
                  )}
                  {type === "meeting" &&
  String(
    item.status || ""
  ).toLowerCase() !==
    "cancelled" && (
    <div className="admin-cal-meeting-actions">

      <button
        type="button"
        className="admin-cal-edit-meeting"
        onClick={(event) => {
          event.stopPropagation();

          openEditMeeting(
            item
          );
        }}
      >
        <Pencil size={13} />

        Edit
      </button>

      <button
        type="button"
        className="admin-cal-cancel-meeting"
        onClick={(event) => {
          event.stopPropagation();

          askCancelMeeting(
            item
          );
        }}
      >
        <Trash2 size={13} />

        Cancel
      </button>

    </div>
  )}

{type === "meeting" &&
  String(
    item.status || ""
  ).toLowerCase() ===
    "cancelled" && (
    <span className="admin-cal-cancelled-label">
      Cancelled
    </span>
  )}
                  
              </div>
            </div>
          );
        })}
      </section>
    );
  };

  /* =========================================================
     JSX
  ========================================================= */

 return (
  <div
    className="admin-cal-page"
    style={{
      width: "100%",
      maxWidth: "none",
      height: "calc(100vh - 8px)",
      margin: 0,
      padding: 0,
    }}
  >
      {/* ==================== TITLE ==================== */}

      <div className="admin-cal-title-row">
        <div>
          <h1>Calendar</h1>
        </div>
      </div>

      {/* ==================== CARD ==================== */}

      <div className="admin-cal-card">
        {/* ================= TOOLBAR ================= */}

        <div className="admin-cal-toolbar">
          <div className="admin-cal-filter-row">
            <button
              type="button"
              className={
                activeFilter === "all"
                  ? "admin-cal-filter active all"
                  : "admin-cal-filter"
              }
              onClick={() =>
                setActiveFilter("all")
              }
            >
              All
            </button>

            <button
              type="button"
              className={
                activeFilter === "project"
                  ? "admin-cal-filter active project"
                  : "admin-cal-filter"
              }
              onClick={() =>
                setActiveFilter("project")
              }
            >
              Projects
            </button>

            <button
              type="button"
              className={
                activeFilter === "task"
                  ? "admin-cal-filter active task"
                  : "admin-cal-filter"
              }
              onClick={() =>
                setActiveFilter("task")
              }
            >
              Tasks
            </button>

            <button
              type="button"
              className={
                activeFilter === "meeting"
                  ? "admin-cal-filter active meeting"
                  : "admin-cal-filter"
              }
              onClick={() =>
                setActiveFilter("meeting")
              }
            >
              Meetings
            </button>
          </div>

          <div className="admin-cal-navigation">
  <button
    type="button"
    className="admin-cal-nav-arrow"
    onClick={previousMonth}
  >
    <ChevronLeft size={16} />
  </button>

  <button
    type="button"
    className="admin-cal-nav-arrow"
    onClick={nextMonth}
  >
    <ChevronRight size={16} />
  </button>

  <span className="admin-cal-month-name">
    {currentDate.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    })}
  </span>
</div>

          <button
            type="button"
            className="admin-cal-schedule-main"
            onClick={() => openMeeting()}
          >
            <Plus size={17} />

            Schedule Meeting
          </button>
        </div>

        {/* =============== CALENDAR LAYOUT =============== */}

        <div
          className={
            selectedDate
              ? "admin-cal-body admin-cal-body-details"
              : "admin-cal-body"
          }
        >
          {/* ================= CALENDAR ================= */}

          <div className="admin-cal-main">
            <div className="admin-cal-week">
              {[
                "Mon",
                "Tue",
                "Wed",
                "Thu",
                "Fri",
                "Sat",
                "Sun",
              ].map((day) => (
                <div key={day}>
                  {day}
                </div>
              ))}
            </div>

            <div className="admin-cal-grid">
              {calendarDays.map(
                (calendarDate) => {
                  const dateEvents =
                    gridEventsForDate(
                      calendarDate.dateString
                    );

                  const isToday =
                    calendarDate.dateString ===
                    todayString;

                  const isSelected =
                    calendarDate.dateString ===
                    selectedDate;

                  return (
                    <button
                      type="button"
                      key={
                        calendarDate.dateString
                      }
                      className={[
                        "admin-cal-day",
                        !calendarDate.currentMonth
                          ? "outside"
                          : "",
                        isToday
                          ? "today"
                          : "",
                        isSelected
                          ? "selected"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() =>
                        handleDateClick(
                          calendarDate
                        )
                      }
                    >
                      <span className="admin-cal-day-number">
                        {
                          calendarDate.number
                        }
                      </span>

                      <div className="admin-cal-events">
                        {dateEvents
                          .slice(0, 3)
                          .map(
                            (
                              event,
                              eventIndex
                            ) => (
                              <div
                                key={`${event.type}-${eventIndex}`}
                                className={`admin-cal-event admin-cal-event-${event.type}`}
                              >
                                {event.time && (
                                  <Clock
                                    size={10}
                                  />
                                )}

                                <span>
                                  {
                                    event.title
                                  }
                                </span>
                              </div>
                            )
                          )}

                        {dateEvents.length >
                          3 && (
                          <span className="admin-cal-more">
                            +
                            {dateEvents.length -
                              3}{" "}
                            more
                          </span>
                        )}
                      </div>
                    </button>
                  );
                }
              )}
            </div>

            <div className="admin-cal-legend">
              <div>
                <span className="admin-cal-legend-dot project" />
                Project
              </div>

              <div>
                <span className="admin-cal-legend-dot task" />
                Task
              </div>

              <div>
                <span className="admin-cal-legend-dot meeting" />
                Meeting
              </div>

              <div>
                <span className="admin-cal-legend-dot mini" />
                Mini Task
              </div>
            </div>

            {loading && (
              <div className="admin-cal-loading">
                Loading...
              </div>
            )}
          </div>

          {/* ================ RIGHT PANEL ================ */}

          {selectedDate && (
            <aside className="admin-cal-details">
              <div className="admin-cal-details-header">
                <strong>
                  {displayDate(selectedDate)}
                </strong>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedDate("")
                  }
                >
                  <X size={17} />
                </button>
              </div>

              <div className="admin-cal-details-scroll">
                {selectedEvents.length ===
                0 ? (
                  <div className="admin-cal-empty-details">
                    <CalendarDays
                      size={30}
                    />

                    <strong>
                      Nothing scheduled
                    </strong>

                    <p>
                      No projects, tasks,
                      meetings or mini tasks
                      for this date.
                    </p>
                  </div>
                ) : (
                  <>
                    {renderDetailSection(
                      "PROJECTS",
                      "project",
                      selectedProjects
                    )}

                    {renderDetailSection(
                      "TASKS",
                      "task",
                      selectedTasks
                    )}

                    {renderDetailSection(
                      "MEETINGS",
                      "meeting",
                      selectedMeetings
                    )}

                    {renderDetailSection(
                      "MINI TASKS",
                      "mini",
                      selectedMiniTasks
                    )}
                  </>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>


      {/* =====================================================
          SCHEDULE MEETING MODAL
      ===================================================== */}

      {showMeeting && (
        <div
          className="admin-cal-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeMeeting();
            }
          }}
        >
          <div className="admin-cal-modal">
            <div className="admin-cal-modal-header">
              <h2>
  {editingMeeting
    ? "Update Meeting"
    : "Schedule Meeting"}
</h2>

              <button
                type="button"
                onClick={closeMeeting}
              >
                <X size={19} />
              </button>
            </div>

            <div className="admin-cal-modal-content">
              <div className="admin-cal-form-field">
                <label>
                  Meeting Title
                  <span>*</span>
                </label>

                <input
                  type="text"
                  placeholder="Project Review Meeting"
                  value={meetingForm.title}
                  onChange={(event) =>
                    setMeetingForm({
                      ...meetingForm,
                      title:
                        event.target.value,
                    })
                  }
                />
              </div>

              <div className="admin-cal-form-field">
                <label>
                  Description / Notes
                </label>

                <textarea
                  placeholder="Review of homepage development and next steps."
                  value={
                    meetingForm.description
                  }
                  onChange={(event) =>
                    setMeetingForm({
                      ...meetingForm,
                      description:
                        event.target.value,
                    })
                  }
                />
              </div>

              <div className="admin-cal-form-field admin-cal-date-field">
                <label>
                  Date
                  <span>*</span>
                </label>

                <input
                  type="date"
                  value={meetingForm.date}
                  onChange={(event) =>
                    setMeetingForm({
                      ...meetingForm,
                      date:
                        event.target.value,
                    })
                  }
                />
              </div>

              <div className="admin-cal-time-row">
                <div className="admin-cal-form-field">
                  <label>
                    Start Time
                    <span>*</span>
                  </label>

                  <input
                    type="time"
                    value={
                      meetingForm.start_time
                    }
                    onChange={(event) =>
                      setMeetingForm({
                        ...meetingForm,
                        start_time:
                          event.target
                            .value,
                      })
                    }
                  />
                </div>

                <div className="admin-cal-form-field">
                  <label>
                    End Time
                    <span>*</span>
                  </label>

                  <input
                    type="time"
                    value={
                      meetingForm.end_time
                    }
                    onChange={(event) =>
                      setMeetingForm({
                        ...meetingForm,
                        end_time:
                          event.target
                            .value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="admin-cal-employee-block">
                <div className="admin-cal-employee-heading">
                  <label>
                    Select Employees
                    <span>*</span>
                  </label>

                  <button
                    type="button"
                    onClick={
                      toggleAllEmployees
                    }
                  >
                    {allSelected
                      ? "Clear All"
                      : "Select All"}
                  </button>
                </div>

                <div className="admin-cal-employee-list">
                  {employees.map(
                    (employee) => {
                      const rawId =
                        employee.user_id ??
                        employee.id;

                      const employeeId =
                        Number(rawId);

                      return (
                        <label
                          className="admin-cal-employee-option"
                          key={
                            employeeId
                          }
                        >
                          <input
                            type="checkbox"
                            checked={selectedEmployees.includes(
                              employeeId
                            )}
                            onChange={() =>
                              toggleEmployee(
                                employeeId
                              )
                            }
                          />

                          <span>
                            {employee.full_name ||
                              employee.name ||
                              employee.email}
                          </span>
                        </label>
                      );
                    }
                  )}
                </div>
              </div>
            </div>

                        <div className="admin-cal-modal-footer">
              <button
                type="button"
                className="admin-cal-modal-cancel"
                onClick={closeMeeting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="admin-cal-modal-save"
                disabled={savingMeeting}
                onClick={createMeeting}
              >
                {savingMeeting
  ? editingMeeting
    ? "Updating..."
    : "Scheduling..."
  : editingMeeting
    ? "Update Meeting"
    : "Schedule Meeting"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showCancelConfirm &&
  cancellingMeeting && (
    <div className="admin-cal-confirm-overlay">

      <div className="admin-cal-confirm-box">

        <div className="admin-cal-confirm-icon">
          <Trash2 size={22} />
        </div>

        <h3>
          Cancel Meeting?
        </h3>

        <p>
          Are you sure you want
          to cancel{" "}
          <strong>
            {
              cancellingMeeting.title
            }
          </strong>
          ?
        </p>

        <p className="admin-cal-confirm-note">
          All participants will
          receive a cancellation
          email.
        </p>

        <div className="admin-cal-confirm-actions">

          <button
            type="button"
            className="admin-cal-confirm-back"
            onClick={
              closeCancelConfirm
            }
          >
            Keep Meeting
          </button>

          <button
            type="button"
            className="admin-cal-confirm-delete"
            onClick={
              cancelMeeting
            }
          >
            Cancel Meeting
          </button>

        </div>
      </div>
    </div>
  )}
    </div>
  );
};

export default AdminCalendar;
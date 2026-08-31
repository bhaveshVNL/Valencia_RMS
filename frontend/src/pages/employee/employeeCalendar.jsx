import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
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

const EmployeeCalendar = () => {
  const now = new Date();

  const todayString = localDateString(now);

  const [currentDate, setCurrentDate] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1)
  );

  const [events, setEvents] = useState({
  projects: [],
  tasks: [],
  subtasks: [],
  meetings: [],
  mini_tasks: [],
});

  const [loading, setLoading] = useState(false);
 

  const [selectedDate, setSelectedDate] = useState("");

  const [activeFilter, setActiveFilter] = useState("all");

const [employees, setEmployees] =
  useState([]);

const [showMeeting, setShowMeeting] =
  useState(false);

const [
  selectedEmployees,
  setSelectedEmployees,
] = useState([]);

const [
  savingMeeting,
  setSavingMeeting,
] = useState(false);
const [successMessage, setSuccessMessage] =
  useState("");
const [
  meetingForm,
  setMeetingForm,
] = useState({
  title: "",
  description: "",
  date: "",
  start_time: "",
  end_time: "",
});

  

  /* =========================================================
     API
  ========================================================= */

  const loadCalendar = async () => {
    try {
      setLoading(true);

      const response = await fetch(
  `${API}/calendar/employee`,
  {
    headers: getAuthHeaders(),
  }
);

      const data = await response.json();

      console.log("EMPLOYEE CALENDAR DATA:", data);

      if (data.success) {
        setEvents({
  projects: data.projects || [],
  tasks: data.tasks || [],
  subtasks: data.subtasks || [],
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
    const response =
      await fetch(
        `${API}/calendar/employees`,
        {
          headers:
            getAuthHeaders(),
        }
      );

    const data =
      await response.json();

    if (data.success) {
      setEmployees(
        data.employees || []
      );
    } else {
      console.error(
        "Meeting employees error:",
        data.message
      );
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
   CONTINUOUS CALENDAR BARS
========================================================= */

  const calendarWeeks = useMemo(() => {
    const weeks = [];

    for (let index = 0; index < calendarDays.length; index += 7) {
      weeks.push(calendarDays.slice(index, index + 7));
    }

    return weeks;
  }, [calendarDays]);

  /*
    Get all project/task/meeting/mini-task events
    that belong to a particular week.
  
    Projects and tasks become continuous bars
    between start_date and end_date.
  */

  const eventsForWeek = (week) => {
    const weekStart = week[0].dateString;
    const weekEnd = week[6].dateString;

    const result = [];

    /* ---------------- PROJECTS ---------------- */

    events.projects.forEach((item) => {
      const start = normalizeDate(item.start_date);
      const end = normalizeDate(item.end_date);

      if (
        start &&
        end &&
        start <= weekEnd &&
        end >= weekStart
      ) {
        result.push({
          type: "project",
          title: projectTitle(item),
          start,
          end,
          source: item,
        });
      }
    });

    /* ---------------- TASKS ---------------- */

    events.tasks.forEach((item) => {
      const start = normalizeDate(item.start_date);
      const end = normalizeDate(item.end_date);

      if (
        start &&
        end &&
        start <= weekEnd &&
        end >= weekStart
      ) {
        result.push({
          type: "task",
          title: taskTitle(item),
          start,
          end,
          source: item,
        });
      }
    });

    /* ---------------- SUBTASKS ---------------- */

events.subtasks.forEach((item) => {
  const start = normalizeDate(item.start_date);
  const end = normalizeDate(item.end_date);

  if (
    start &&
    end &&
    start <= weekEnd &&
    end >= weekStart
  ) {
    result.push({
      type: "subtask",
      title:
        item.title ||
        item.task_title ||
        "Subtask",
      start,
      end,
      source: item,
    });
  }
});



    /* ---------------- MEETINGS ---------------- */

    events.meetings.forEach((item) => {
      const date = normalizeDate(
        item.meeting_date
      );

      if (
        date &&
        date >= weekStart &&
        date <= weekEnd
      ) {
        result.push({
          type: "meeting",
          title: meetingTitle(item),
          start: date,
          end: date,
          source: item,
        });
      }
    });

 /* ---------------- MINI TASKS ---------------- */

events.mini_tasks.forEach((item) => {
  const date = normalizeDate(
    item.task_date ||
      item.date ||
      item.due_date
  );

  if (
    date &&
    date >= weekStart &&
    date <= weekEnd
  ) {
    result.push({
      type: "mini",
      title: miniTaskTitle(item),
      start: date,
      end: date,
      source: item,
    });
  }
}); 

    if (activeFilter !== "all") {
      return result.filter(
        (item) =>
          item.type === activeFilter
      );
    }

    return result;
  };

  /*
    Convert an event into a bar position
    inside one calendar week.
  */

  const getEventSegment = (
    event,
    week
  ) => {
    const weekStart = week[0].dateString;
    const weekEnd = week[6].dateString;

    const visibleStart =
      event.start < weekStart
        ? weekStart
        : event.start;

    const visibleEnd =
      event.end > weekEnd
        ? weekEnd
        : event.end;

    const startIndex =
      week.findIndex(
        (day) =>
          day.dateString ===
          visibleStart
      );

    const endIndex =
      week.findIndex(
        (day) =>
          day.dateString ===
          visibleEnd
      );

    if (
      startIndex === -1 ||
      endIndex === -1
    ) {
      return null;
    }

    return {
      ...event,

      startIndex,

      endIndex,

      span:
        endIndex -
        startIndex +
        1,

      continuesBefore:
        event.start < weekStart,

      continuesAfter:
        event.end > weekEnd,
    };
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

   const selectedSubtasks = selectedEvents.filter(
  (item) => item.type === "subtask"
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
   EMPLOYEE SCHEDULE MEETING
========================================================= */

const openMeeting = (
  date = ""
) => {
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
  if (savingMeeting) {
    return;
  }

  setShowMeeting(false);

  setSelectedEmployees([]);
};

const toggleEmployee = (
  employeeId
) => {
  setSelectedEmployees(
    (previous) =>
      previous.includes(
        employeeId
      )
        ? previous.filter(
            (id) =>
              id !== employeeId
          )
        : [
            ...previous,
            employeeId,
          ]
  );
};

const allSelectableIds =
  employees
    .map((employee) =>
      Number(
        employee.user_id ??
          employee.id
      )
    )
    .filter(
      (id) =>
        !Number.isNaN(id)
    );

const allSelected =
  allSelectableIds.length > 0 &&
  allSelectableIds.every(
    (id) =>
      selectedEmployees.includes(
        id
      )
  );

const toggleAllEmployees =
  () => {
    if (allSelected) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(
        allSelectableIds
      );
    }
  };

const createMeeting =
  async () => {
    if (
      !meetingForm.title.trim()
    ) {
      alert(
        "Please enter the meeting title."
      );

      return;
    }

    if (!meetingForm.date) {
      alert(
        "Please select the meeting date."
      );

      return;
    }

    if (
      !meetingForm.start_time
    ) {
      alert(
        "Please select start time."
      );

      return;
    }

    if (
      !meetingForm.end_time
    ) {
      alert(
        "Please select end time."
      );

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

    if (
      selectedEmployees.length ===
      0
    ) {
      alert(
        "Please select at least one employee."
      );

      return;
    }

    try {
      setSavingMeeting(true);

      const response =
        await fetch(
          `${API}/calendar/meetings`,
          {
            method: "POST",

            headers:
              getAuthHeaders(),

            body:
              JSON.stringify({
                title:
                  meetingForm.title.trim(),

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

      const data =
        await response.json();

      if (!data.success) {
        alert(
          data.message ||
            "Unable to schedule meeting."
        );

        return;
      }

      setShowMeeting(false);

      setSelectedEmployees(
        []
      );

      await loadCalendar();

setSuccessMessage(
  "Meeting scheduled successfully."
);

setTimeout(() => {
  setSuccessMessage("");
}, 3000);
    } catch (error) {
      console.error(
        "Create meeting error:",
        error
      );

      alert(
        "Something went wrong while scheduling the meeting."
      );
    } finally {
      setSavingMeeting(
        false
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
  type === "task" ||
  type === "subtask"
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
  <div className="admin-main-calendar">
    {successMessage && (
  <div className="calendar-success-toast">
    <div className="calendar-success-icon">
      ✓
    </div>

    <div className="calendar-success-content">
      <strong>Meeting Scheduled</strong>
      <p>{successMessage}</p>
    </div>

    <button
      type="button"
      className="calendar-success-close"
      onClick={() =>
        setSuccessMessage("")
      }
    >
      ×
    </button>
  </div>
)}
    <div
      className="admin-cal-page"
      style={{
  width: "100%",
  maxWidth: "none",
  margin: "0",
  padding: "0",
  boxSizing: "border-box",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
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
  onClick={() =>
    openMeeting()
  }
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
              {calendarWeeks.map(
                (week, weekIndex) => {
                  const weekEvents =
                    eventsForWeek(week);

                  return (
                    <div
                      className="admin-cal-week-row"
                      key={weekIndex}
                    >

                      {/* =========================
              DATE CELLS
          ========================= */}

                      <div className="admin-cal-days-row">
                        {week.map(
                          (calendarDate) => {
                            const isToday =
                              calendarDate.dateString ===
                              todayString;

                            const isSelected =
                              calendarDate.dateString ===
                              selectedDate;

                            return (
                              <button
  type="button"
  key={calendarDate.dateString}
  data-day-number={calendarDate.number}
  className={[
    "admin-cal-day",
    !calendarDate.currentMonth ? "outside" : "",
    isToday ? "today" : "",
    isSelected ? "selected" : "",
  ]
    .filter(Boolean)
    .join(" ")}
  onClick={() =>
    handleDateClick(calendarDate)
  }
>
  <span className="admin-cal-day-number">
    {calendarDate.number}
  </span>
</button>
                            );
                          }
                        )}
                      </div>

                      {/* =========================
              CONTINUOUS EVENT BARS
          ========================= */}

                      <div className="admin-cal-event-layer">
                        {weekEvents.map(
                          (event, eventIndex) => {
                            const segment =
                              getEventSegment(
                                event,
                                week
                              );

                            if (!segment) {
                              return null;
                            }

                            const item =
                              event.source || {};

                           

                            return (
                              <div
                                key={`${event.type}-${eventIndex}-${weekIndex}`}
                                className={`admin-cal-event-bar admin-cal-event-bar-${event.type}`}
                                style={{
                                  gridColumn: `${segment.startIndex + 1
                                    } / span ${segment.span
                                    }`,

                                  gridRow: `${eventIndex + 1}`,
                                }}
                                onClick={(clickEvent) => {
                                  clickEvent.stopPropagation();

                                  setSelectedDate(
                                    segment.start
                                  );
                                }}
                                title={event.title}
                              >

                                <span className="admin-cal-event-bar-dot" />

                                <span className="admin-cal-event-bar-title">
                                  {
                                    segment.continuesBefore
                                      ? ""
                                      : event.title
                                  }
                                </span>

                               
                                {event.type === "meeting" &&
                                  event.source?.start_time && (
                                    <span className="admin-cal-event-bar-time">
                                      {displayTime(
                                        event.source
                                          .start_time
                                      )}
                                    </span>
                                  )}

                              </div>
                            );
                          }
                        )}
                      </div>

                    </div>
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

              <div>
  <span className="admin-cal-legend-dot subtask" />
  Subtask
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
  "SUBTASKS",
  "subtask",
  selectedSubtasks
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
          Schedule Meeting
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
            value={
              meetingForm.title
            }
            onChange={(event) =>
              setMeetingForm({
                ...meetingForm,

                title:
                  event.target
                    .value,
              })
            }
          />
        </div>

        <div className="admin-cal-form-field">
          <label>
            Description / Notes
          </label>

          <textarea
            placeholder="Meeting notes..."
            value={
              meetingForm.description
            }
            onChange={(event) =>
              setMeetingForm({
                ...meetingForm,

                description:
                  event.target
                    .value,
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
            value={
              meetingForm.date
            }
            onChange={(event) =>
              setMeetingForm({
                ...meetingForm,

                date:
                  event.target
                    .value,
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
                const employeeId =
                  Number(
                    employee.user_id ??
                      employee.id
                  );

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
          onClick={
            closeMeeting
          }
        >
          Cancel
        </button>

        <button
          type="button"
          className="admin-cal-modal-save"
          disabled={
            savingMeeting
          }
          onClick={
            createMeeting
          }
        >
          {savingMeeting
            ? "Scheduling..."
            : "Schedule Meeting"}
        </button>
      </div>
    </div>
  </div>
)}

    </div>
      </div>
  );
};

export default EmployeeCalendar;
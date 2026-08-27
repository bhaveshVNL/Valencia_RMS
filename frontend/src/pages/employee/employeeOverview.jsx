import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
} from "lucide-react";
import api from "../../api/axios";

const getResponseData = (response) => {
  return response?.data?.data || response?.data || {};
};

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  return [];
};

const getUser = () => {
  try {
    return JSON.parse(
      sessionStorage.getItem("user") || localStorage.getItem("user") || "{}"
    );
  } catch {
    return {};
  }
};

const normalizeOverviewData = (rawData) => {
  const data = rawData || {};

  const recentTasks =
    data.recent_tasks ||
    data.recentTasks ||
    data.tasks ||
    data.my_tasks ||
    data.assigned_tasks ||
    [];

  const activityLog =
    data.activity_log ||
    data.activityLog ||
    data.activities ||
    data.recent_activity ||
    [];

  const weeklyAttendance =
    data.weekly_attendance ||
    data.weeklyAttendance ||
    data.week_attendance ||
    data.attendance_week ||
    data.attendance ||
    [];

  const summary = data.summary || data.stats || {};

  return {
    summary,
    recentTasks: asArray(recentTasks),
    activityLog: asArray(activityLog),
    weeklyAttendance: asArray(weeklyAttendance),
  };
};

const formatStatus = (status) => {
  const value = String(status || "not_started")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (["todo", "to_do", "pending", "not_started"].includes(value)) {
    return "To Do";
  }

  if (["ongoing", "in_progress", "progress"].includes(value)) {
    return "In Progress";
  }

  if (["under_review", "review"].includes(value)) {
    return "Under Review";
  }

  if (["completed", "done", "complete"].includes(value)) {
    return "Done";
  }

  if (["rejected", "reject"].includes(value)) {
    return "Rejected";
  }

  if (["on_hold", "hold"].includes(value)) {
    return "On Hold";
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getTaskTitle = (task) => {
  return task.task_title || task.main_task_title || task.title || "Task";
};

const getTaskProject = (task) => {
  return (
    task.project_title ||
    task.project_name ||
    task.description ||
    task.task_description ||
    "-"
  );
};

const getTaskStartDate = (task) => {
  return task.start_date || task.task_start_date || "";
};

const getTaskEndDate = (task) => {
  return task.due_date || task.end_date || task.task_end_date || "";
};

const getTaskProgress = (task) => {
  return Number(
    task.progress ?? task.task_progress ?? task.overall_progress ?? 0
  );
};

const getActivityTitle = (activity) => {
  return (
    activity.title ||
    activity.activity_title ||
    activity.action ||
    activity.type ||
    "Activity"
  );
};

const getActivityDescription = (activity) => {
  return (
    activity.description ||
    activity.message ||
    activity.activity_description ||
    activity.details ||
    "-"
  );
};

const getActivityDate = (activity) => {
  return (
    activity.created_at ||
    activity.createdAt ||
    activity.activity_date ||
    activity.date ||
    activity.updated_at ||
    ""
  );
};

const getAttendanceDate = (item) => {
  return item.attendance_date || item.date || item.day_name || item.day || "-";
};

const getAttendanceStatus = (item) => {
  return formatStatus(item.status || item.attendance_status || "-");
};

const EmployeeOverview = () => {
  const navigate = useNavigate();
  const user = getUser();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [overviewData, setOverviewData] = useState({
    summary: {},
    recentTasks: [],
    activityLog: [],
    weeklyAttendance: [],
  });

  const fetchOverview = async () => {
    setLoading(true);
    setError("");

    try {
      let response;

      try {
        response = await api.get("/employee-overview");
      } catch {
        try {
          response = await api.get("/employee-overview/overview");
        } catch {
          response = await api.get("/employee/overview");
        }
      }

      const normalized = normalizeOverviewData(getResponseData(response));
      setOverviewData(normalized);
      try {
  const meetingsResponse = await api.get("/calendar/upcoming");

  setUpcomingMeetings(
    meetingsResponse.data?.meetings || []
  );
} catch (meetingError) {
  console.error(
    "Failed to load upcoming meetings:",
    meetingError
  );

  setUpcomingMeetings([]);
}
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to load employee overview."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const stats = useMemo(() => {
    const summary = overviewData.summary || {};

    const totalTasks =
      summary.total_tasks ??
      summary.totalTasks ??
      overviewData.recentTasks.length ??
      0;

    const inProgressTasks =
      summary.in_progress_tasks ??
      summary.inProgressTasks ??
      overviewData.recentTasks.filter((task) =>
        ["ongoing", "in_progress"].includes(
          String(task.status || "").toLowerCase()
        )
      ).length;

    const completedTasks =
      summary.completed_tasks ??
      summary.completedTasks ??
      overviewData.recentTasks.filter((task) =>
        ["completed", "done"].includes(String(task.status || "").toLowerCase())
      ).length;

    const attendancePercentage =
      summary.attendance_percentage ??
      summary.attendancePercentage ??
      summary.weekly_attendance_percentage ??
      0;

    const pendingTasks = Math.max(
      Number(totalTasks || 0) -
        Number(inProgressTasks || 0) -
        Number(completedTasks || 0),
      0
    );

    return {
      totalTasks: Number(totalTasks || 0),
      inProgressTasks: Number(inProgressTasks || 0),
      completedTasks: Number(completedTasks || 0),
      pendingTasks,
      attendancePercentage: Number(attendancePercentage || 0),
    };
  }, [overviewData]);

  const cardShadowStyle = {
    border: "none",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
  };

  const sectionShadowStyle = {
    border: "none",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.07)",
  };

  return (
    <div className="employee-overview-page">
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          marginBottom: "22px",
        }}
      >
        <button
          type="button"
          className="employee-overview-refresh-btn"
          onClick={fetchOverview}
          disabled={loading}
        >
          <RefreshCw size={18} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <div className="employee-overview-error">{error}</div>}

      <div className="employee-overview-stats">
        <button
          type="button"
          className="employee-overview-stat-card employee-overview-clickable"
          style={cardShadowStyle}
          onClick={() =>
            navigate("/employee/tasks", {
              state: { filter: "all" },
            })
          }
        >
          <h2>{stats.totalTasks}</h2>
          <p>
            <ClipboardList size={22} />
            Total Tasks
          </p>
        </button>

        <button
          type="button"
          className="employee-overview-stat-card employee-overview-clickable"
          style={cardShadowStyle}
          onClick={() =>
            navigate("/employee/tasks", {
              state: { filter: "in_progress" },
            })
          }
        >
          <h2>{stats.inProgressTasks}</h2>
          <p>
            <Activity size={22} />
            In Progress Tasks
          </p>
        </button>

        <button
          type="button"
          className="employee-overview-stat-card employee-overview-clickable"
          style={cardShadowStyle}
          onClick={() =>
            navigate("/employee/tasks", {
              state: { filter: "done" },
            })
          }
        >
          <h2>{stats.completedTasks}</h2>
          <p>
            <CheckCircle2 size={22} />
            Completed Tasks
          </p>
        </button>

        <button
          type="button"
          className="employee-overview-stat-card employee-overview-clickable"
          style={cardShadowStyle}
          onClick={() => navigate("/employee/attendance")}
        >
          <h2>{stats.attendancePercentage}%</h2>
          <p>
            <CalendarCheck size={22} />
            Weekly Attendance
          </p>
        </button>
      </div>

      <div className="employee-overview-main-grid">
  <div className="employee-overview-left-column">

    {/* ================= UPCOMING MEETINGS ================= */}

    <section
      className="employee-overview-card employee-upcoming-meetings-card"
      style={{
        border: "none",
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.07)",
        marginBottom: "24px",
      }}
    >
      <div
        className="employee-overview-card-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <div>
          <h2>Upcoming Meetings</h2>
          <p>Meetings scheduled for you</p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/employee/calendar")}
          style={{
            border: "none",
            background: "#fff1eb",
            color: "#ff5733",
            borderRadius: "12px",
            padding: "10px 14px",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          View Calendar
        </button>
      </div>

      {upcomingMeetings.length > 0 ? (
        <div
          style={{
            display: "grid",
            gap: "12px",
            marginTop: "16px",
          }}
        >
          {upcomingMeetings.slice(0, 3).map((meeting) => (
            <div
              key={meeting.id}
              style={{
                border: "1px solid #edf0f4",
                background: "#f8fafc",
                borderRadius: "16px",
                padding: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "18px",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    color: "#111827",
                    fontSize: "16px",
                    fontWeight: 900,
                  }}
                >
                  {meeting.title || "Meeting"}
                </h3>

                <p
                  style={{
                    margin: "7px 0 0",
                    color: "#667085",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  {meeting.meeting_date}
                  {" · "}
                  {meeting.start_time?.slice(0, 5)}
                  {" – "}
                  {meeting.end_time?.slice(0, 5)}
                </p>

                {meeting.created_by_name && (
                  <p
                    style={{
                      margin: "6px 0 0",
                      color: "#98a2b3",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    Scheduled by {meeting.created_by_name}
                  </p>
                )}
              </div>

              <span
                style={{
                  flexShrink: 0,
                  padding: "6px 10px",
                  borderRadius: "999px",
                  background: "#ecfdf3",
                  color: "#027a48",
                  fontSize: "11px",
                  fontWeight: 900,
                }}
              >
                Scheduled
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="employee-overview-empty">
          No upcoming meetings.
        </div>
      )}
    </section>

    {/* ================= RECENT TASKS ================= */}

    <section
      className="employee-overview-card recent-tasks-card"
      style={sectionShadowStyle}
    >
      <div className="employee-overview-card-header">
        <div>
          <h2>Recent Tasks</h2>
          <p>Your latest assigned tasks</p>
        </div>
      </div>

      <div className="recent-tasks-scroll-area">
        {overviewData.recentTasks.length === 0 ? (
          <div className="employee-overview-empty">
            No recent tasks found.
          </div>
        ) : (
          overviewData.recentTasks.map((task, index) => {
            const progress = getTaskProgress(task);

                  return (
                    <button
                      type="button"
                      className="employee-recent-task-item employee-recent-task-clickable"
                      key={task.task_id || task.main_task_id || index}
                      onClick={() =>
                        navigate("/employee/tasks", {
                          state: {
                            filter: "all",
                            taskId: task.task_id || task.main_task_id,
                          },
                        })
                      }
                    >
                      <div>
                        <h3>{getTaskTitle(task)}</h3>
                        <p>{getTaskProject(task)}</p>
                        <span>
                          {getTaskStartDate(task)}
                          {getTaskStartDate(task) || getTaskEndDate(task)
                            ? " to "
                            : ""}
                          {getTaskEndDate(task)}
                        </span>
                      </div>

                      <div className="employee-recent-task-status">
                        <strong>
                          {formatStatus(task.status || task.main_task_status)}
                        </strong>
                        <b>{progress}%</b>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section
            className="employee-overview-card employee-task-summary-card"
            style={sectionShadowStyle}
          >
            <div className="employee-overview-card-header">
              <div>
                <h2>Task Status Summary</h2>
                <p>Your current task status breakdown</p>
              </div>
            </div>

            <div className="employee-task-summary-list">
              <button
                type="button"
                className="employee-task-summary-row employee-summary-clickable"
                onClick={() =>
                  navigate("/employee/tasks", {
                    state: { filter: "all" },
                  })
                }
              >
                <span>Total Tasks</span>
                <strong>{stats.totalTasks}</strong>
              </button>

              <button
                type="button"
                className="employee-task-summary-row employee-summary-clickable"
                onClick={() =>
                  navigate("/employee/tasks", {
                    state: { filter: "in_progress" },
                  })
                }
              >
                <span>In Progress Tasks</span>
                <strong>{stats.inProgressTasks}</strong>
              </button>

              <button
                type="button"
                className="employee-task-summary-row employee-summary-clickable"
                onClick={() =>
                  navigate("/employee/tasks", {
                    state: { filter: "done" },
                  })
                }
              >
                <span>Completed Tasks</span>
                <strong>{stats.completedTasks}</strong>
              </button>

              <button
                type="button"
                className="employee-task-summary-row employee-summary-clickable"
                onClick={() =>
                  navigate("/employee/tasks", {
                    state: { filter: "todo" },
                  })
                }
              >
                <span>Pending Tasks</span>
                <strong>{stats.pendingTasks}</strong>
              </button>
            </div>
          </section>
        </div>

        <div className="employee-overview-right-column">
          <section
            className="employee-overview-card activity-log-card"
            style={sectionShadowStyle}
          >
            <div className="employee-overview-card-header">
              <div>
                <h2>Activity Log</h2>
                <p>Recent activity related to your tasks</p>
              </div>
            </div>

            <div className="employee-activity-scroll-area">
              <div className="employee-activity-list">
                {overviewData.activityLog.length === 0 ? (
                  <div className="employee-overview-empty">
                    No activity found.
                  </div>
                ) : (
                  overviewData.activityLog.map((activity, index) => (
                    <div
                      className="employee-activity-item"
                      key={activity.activity_id || activity.log_id || index}
                    >
                      <div className="employee-activity-dot">
                        <Activity size={14} />
                      </div>

                      <div>
                        <h3>{getActivityTitle(activity)}</h3>
                        <p>{getActivityDescription(activity)}</p>
                        <span>{getActivityDate(activity)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section
            className="employee-overview-card weekly-attendance-card employee-overview-section-clickable"
            style={sectionShadowStyle}
            onClick={() => navigate("/employee/attendance")}
          >
            <div className="employee-overview-card-header">
              <div>
                <h2>Weekly Attendance</h2>
                <p>Your attendance records for the week</p>
              </div>
            </div>

            <div className="employee-week-attendance-list">
              {overviewData.weeklyAttendance.length === 0 ? (
                <div className="employee-overview-empty">
                  No weekly attendance found.
                </div>
              ) : (
                overviewData.weeklyAttendance.map((item, index) => (
                  <div
                    className="employee-week-attendance-row"
                    key={item.attendance_id || index}
                  >
                    <span>
                      {item.day_name || item.day || "-"} -{" "}
                      {getAttendanceDate(item)}
                    </span>
                    <strong>{getAttendanceStatus(item)}</strong>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default EmployeeOverview;
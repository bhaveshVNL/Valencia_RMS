import { useEffect, useMemo, useState } from "react";
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
  const user = getUser();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
        <div className="employee-overview-stat-card">
          <h2>{stats.totalTasks}</h2>
          <p>
            <ClipboardList size={22} />
            Total Tasks
          </p>
        </div>

        <div className="employee-overview-stat-card">
          <h2>{stats.inProgressTasks}</h2>
          <p>
            <Activity size={22} />
            In Progress Tasks
          </p>
        </div>

        <div className="employee-overview-stat-card">
          <h2>{stats.completedTasks}</h2>
          <p>
            <CheckCircle2 size={22} />
            Completed Tasks
          </p>
        </div>

        <div className="employee-overview-stat-card">
          <h2>{stats.attendancePercentage}%</h2>
          <p>
            <CalendarCheck size={22} />
            Weekly Attendance
          </p>
        </div>
      </div>

      <div className="employee-overview-main-grid">
        <div className="employee-overview-left-column">
          <section className="employee-overview-card recent-tasks-card">
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
                    <div
                      className="employee-recent-task-item"
                      key={task.task_id || task.main_task_id || index}
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
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="employee-overview-card employee-task-summary-card">
            <div className="employee-overview-card-header">
              <div>
                <h2>Task Status Summary</h2>
                <p>Your current task status breakdown</p>
              </div>
            </div>

            <div className="employee-task-summary-list">
              <div className="employee-task-summary-row">
                <span>Total Tasks</span>
                <strong>{stats.totalTasks}</strong>
              </div>

              <div className="employee-task-summary-row">
                <span>In Progress Tasks</span>
                <strong>{stats.inProgressTasks}</strong>
              </div>

              <div className="employee-task-summary-row">
                <span>Completed Tasks</span>
                <strong>{stats.completedTasks}</strong>
              </div>

              <div className="employee-task-summary-row">
                <span>Pending Tasks</span>
                <strong>{stats.pendingTasks}</strong>
              </div>
            </div>
          </section>
        </div>

        <div className="employee-overview-right-column">
          <section className="employee-overview-card activity-log-card">
            <div className="employee-overview-card-header">
              <div>
                <h2>Activity Log</h2>
                <p>Recent activity related to your tasks</p>
              </div>
            </div>

            <div className="employee-activity-list">
              {overviewData.activityLog.length === 0 ? (
                <div className="employee-overview-empty">No activity found.</div>
              ) : (
                overviewData.activityLog.slice(0, 5).map((activity, index) => (
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
          </section>

          <section className="employee-overview-card weekly-attendance-card">
            <div className="employee-overview-card-header">
              <div>
                <h2>Week Attendance</h2>
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
                    <span>{getAttendanceDate(item)}</span>
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
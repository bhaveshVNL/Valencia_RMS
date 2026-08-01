import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  ClipboardList,
  Clock3,
  FolderKanban,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../../api/axios";

const statusLabels = {
  not_started: "To Do",
  ongoing: "In Progress",
  in_progress: "In Progress",
  under_review: "Under Review",
  completed: "Done",
  done: "Done",
  on_hold: "On Hold",
  cancelled: "Cancelled",
  rejected: "Rejected",
};

const attendanceLabels = {
  present: "Present",
  absent: "Absent",
  half_day: "Half Day",
  leave: "Leave",
  holiday: "Holiday",
  not_marked: "Not Marked",
};

const attendanceSymbols = {
  present: "✓",
  absent: "×",
  half_day: "½",
  leave: "L",
  holiday: "H",
  not_marked: "—",
};

const chartColors = [
  "#ff5733",
  "#ff8a65",
  "#ffb199",
  "#ffd6cc",
  "#ffad8f",
  "#f97316",
];

const numberValue = (...values) => {
  for (const value of values) {
    const number = Number(value);

    if (!Number.isNaN(number) && number >= 0) {
      return number;
    }
  }

  return 0;
};

const normalizeText = (value) => {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
};

const getProjectSubtasks = (project) => {
  return (
    project?.subtasks ||
    project?.sub_tasks ||
    project?.tasks ||
    project?.project_tasks ||
    []
  );
};

const getProjectSubtaskStats = (project) => {
  if (!project) {
    return {
      total: 0,
      completed: 0,
    };
  }

  const subtasks = getProjectSubtasks(project);

  if (Array.isArray(subtasks) && subtasks.length > 0) {
    const completed = subtasks.filter((subtask) => {
      return (
        Boolean(subtask.is_checked) ||
        Boolean(subtask.checked) ||
        Boolean(subtask.is_completed) ||
        subtask.status === "completed" ||
        subtask.status === "done" ||
        Number(subtask.progress || 0) === 100
      );
    }).length;

    return {
      total: subtasks.length,
      completed,
    };
  }

  const total = numberValue(
    project.total_subtasks,
    project.totalSubtasks,
    project.total_tasks,
    project.totalTasks,
    project.subtask_count,
    project.subtaskCount,
    project.total_subtask_count,
    project.task_count
  );

  const completed = numberValue(
    project.completed_subtasks,
    project.completedSubtasks,
    project.completed_tasks,
    project.completedTasks,
    project.done_subtasks,
    project.doneSubtasks,
    project.checked_subtasks,
    project.checkedSubtasks,
    project.completed_subtask_count,
    project.completed_task_count,
    project.done_count,
    project.checked_count
  );

  return {
    total,
    completed,
  };
};

const getProjectStatus = (project) => {
  if (!project) return "not_started";

  const originalStatus =
    project.status ||
    project.project_status ||
    project.computed_status ||
    project.display_status ||
    "not_started";

  if (
    originalStatus === "completed" ||
    originalStatus === "done" ||
    originalStatus === "on_hold" ||
    originalStatus === "cancelled" ||
    originalStatus === "rejected"
  ) {
    return originalStatus;
  }

  const stats = getProjectSubtaskStats(project);

  if (stats.total > 0) {
    if (stats.completed === 0) {
      return "not_started";
    }

    if (stats.completed < stats.total) {
      return "ongoing";
    }

    return "under_review";
  }

  return originalStatus;
};

const getProjectProgress = (project) => {
  if (!project) return 0;

  const stats = getProjectSubtaskStats(project);

  if (stats.total > 0) {
    return Math.round((stats.completed / stats.total) * 100);
  }

  const directProgress = numberValue(
    project.computed_progress,
    project.progress,
    project.overall_progress,
    project.employee_progress,
    project.assignment_progress,
    project.progress_percentage,
    project.completion_percentage,
    project.percentage
  );

  if (directProgress > 0) {
    return Math.min(directProgress, 100);
  }

  const status = getProjectStatus(project);

  if (
    status === "under_review" ||
    status === "completed" ||
    status === "done"
  ) {
    return 100;
  }

  return 0;
};

const extractProjects = (payload) => {
  if (!payload) return [];

  const data = payload.data || payload;

  if (Array.isArray(data)) {
    return data;
  }

  const possibleArrays = [
    data.projects,
    data.my_projects,
    data.myProjects,
    data.assigned_projects,
    data.assignedProjects,
    data.data,
    data.rows,
    data.result,
  ];

  for (const item of possibleArrays) {
    if (Array.isArray(item)) {
      return item;
    }
  }

  const kanbanArrays = [
    data.to_do,
    data.todo,
    data.not_started,
    data.in_progress,
    data.ongoing,
    data.under_review,
    data.done,
    data.completed,
    data.on_hold,
    data.cancelled,
    data.rejected,
  ];

  const flattened = [];

  kanbanArrays.forEach((array) => {
    if (Array.isArray(array)) {
      flattened.push(...array);
    }
  });

  if (flattened.length > 0) {
    return flattened;
  }

  if (data.kanban && typeof data.kanban === "object") {
    Object.values(data.kanban).forEach((value) => {
      if (Array.isArray(value)) {
        flattened.push(...value);
      }
    });
  }

  return flattened;
};

const dedupeProjects = (projects) => {
  const projectMap = new Map();

  projects.forEach((project) => {
    if (!project) return;

    const key =
      project.project_id ||
      project.id ||
      `${project.project_title}-${project.assigned_to_email || ""}`;

    if (!projectMap.has(key)) {
      projectMap.set(key, project);
      return;
    }

    const existing = projectMap.get(key);

    projectMap.set(key, {
      ...existing,
      ...project,
      subtasks:
        project.subtasks?.length > 0
          ? project.subtasks
          : existing.subtasks || [],
    });
  });

  return Array.from(projectMap.values());
};

const isProjectAssignedToUser = (project, profile) => {
  if (!project || !profile) return false;

  const userName = normalizeText(profile.full_name);
  const userEmail = normalizeText(profile.email);

  const assignedText = normalizeText(
    [
      project.assigned_employees,
      project.assigned_employee,
      project.assigned_employee_name,
      project.assigned_to_name,
      project.employee_name,
      project.assignee_name,
      project.assigned_to_email,
      project.assigned_employee_email,
      project.employee_email,
      project.assignee_email,
      project.assigned_emails,
      project.assigned_names,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const nameMatched = userName && assignedText.includes(userName);
  const emailMatched = userEmail && assignedText.includes(userEmail);

  return nameMatched || emailMatched;
};

const getAttendanceStyle = (status) => {
  const normalizedStatus = status || "not_marked";

  const stylesByStatus = {
    present: {
      background: "#d1fae5",
      color: "#059669",
      border: "#a7f3d0",
    },
    absent: {
      background: "#fee2e2",
      color: "#dc2626",
      border: "#fecaca",
    },
    half_day: {
      background: "#fef3c7",
      color: "#d97706",
      border: "#fde68a",
    },
    leave: {
      background: "#e0e7ff",
      color: "#4f46e5",
      border: "#c7d2fe",
    },
    holiday: {
      background: "#f3e8ff",
      color: "#9333ea",
      border: "#e9d5ff",
    },
    not_marked: {
      background: "#f1f5f9",
      color: "#64748b",
      border: "#e2e8f0",
    },
  };

  return stylesByStatus[normalizedStatus] || stylesByStatus.not_marked;
};

const styles = {
  page: {
    width: "100%",
    minWidth: 0,
    paddingBottom: "40px",
    overflowX: "hidden",
  },

  titleRow: {
    marginBottom: "24px",
  },

  title: {
    margin: 0,
    color: "#111111",
    fontSize: "34px",
    fontWeight: 900,
  },

  subtitle: {
    margin: "8px 0 0",
    color: "#666666",
    fontSize: "16px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(160px, 1fr))",
    gap: "18px",
    marginBottom: "24px",
  },

  statCard: {
    background: "#ffffff",
    border: "1px solid #eeeeee",
    borderRadius: "22px",
    padding: "22px",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.045)",
  },

  statLabel: {
    display: "block",
    color: "#777777",
    fontSize: "14px",
    fontWeight: 700,
    marginBottom: "10px",
  },

  statValue: {
    display: "block",
    color: "#111111",
    fontSize: "34px",
    fontWeight: 900,
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(370px, 0.95fr) minmax(600px, 1.7fr)",
    gap: "20px",
    alignItems: "stretch",
    marginBottom: "24px",
    minWidth: 0,
  },

  card: {
    background: "#ffffff",
    border: "1px solid #eeeeee",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.045)",
    minWidth: 0,
  },

  activeProjectCard: {
    background: "#ffffff",
    border: "1px solid #eeeeee",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.045)",
    minHeight: "520px",
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },

  activeTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#666666",
    fontSize: "17px",
    marginBottom: "20px",
  },

  activeTitle: {
    margin: 0,
    color: "#111111",
    fontSize: "22px",
    fontWeight: 900,
  },

  activeCount: {
    minWidth: "38px",
    height: "38px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fff1eb",
    color: "#ff5733",
    borderRadius: "50%",
    fontSize: "18px",
    fontWeight: 900,
  },

  assignedProjectsList: {
    display: "grid",
    gap: "14px",
    overflowY: "auto",
    overflowX: "hidden",
    paddingRight: "4px",
    maxHeight: "600px",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },

  projectItem: {
    border: "1px solid #eeeeee",
    borderRadius: "18px",
    padding: "18px",
    background: "#ffffff",
  },

  projectTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "14px",
  },

  projectTitle: {
    margin: 0,
    color: "#111111",
    fontSize: "18px",
    fontWeight: 900,
    lineHeight: 1.3,
    overflowWrap: "anywhere",
  },

  projectDesc: {
    margin: "6px 0 0",
    color: "#777777",
    fontSize: "13px",
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },

  statusBadge: {
    background: "#eef2ff",
    color: "#334155",
    borderRadius: "999px",
    padding: "7px 12px",
    fontSize: "12px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  progressRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginTop: "12px",
  },

  progressTrack: {
    width: "100%",
    height: "10px",
    background: "#ffd6cc",
    borderRadius: "999px",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    background: "#ff5733",
    borderRadius: "999px",
    transition: "width 0.3s ease",
  },

  progressText: {
    color: "#ff5733",
    fontSize: "14px",
    fontWeight: 900,
    minWidth: "42px",
    textAlign: "right",
  },

  subtaskText: {
    margin: "10px 0 0",
    color: "#666666",
    fontSize: "13px",
    fontWeight: 800,
  },

  analyticsCard: {
    background: "#ffffff",
    border: "1px solid #eeeeee",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.045)",
    minHeight: "520px",
    minWidth: 0,
  },

  analyticsTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "22px",
  },

  analyticsTitleIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    background: "#fff1eb",
    color: "#ff5733",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  analyticsTitle: {
    margin: 0,
    color: "#111111",
    fontSize: "24px",
    fontWeight: 900,
  },

  chartsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "20px",
    minWidth: 0,
  },

  chartSection: {
    minWidth: 0,
    border: "1px solid #eeeeee",
    borderRadius: "18px",
    padding: "18px",
    background: "#ffffff",
  },

  chartHeading: {
    margin: "0 0 4px",
    color: "#111111",
    fontSize: "20px",
    fontWeight: 900,
  },

  chartDescription: {
    margin: "0 0 14px",
    color: "#777777",
    fontSize: "13px",
  },

  weeklyCard: {
    background: "#ffffff",
    border: "1px solid #eeeeee",
    borderRadius: "24px",
    padding: "26px",
    marginBottom: "24px",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.045)",
    minWidth: 0,
  },

  weeklyHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "24px",
  },

  weeklyIcon: {
    width: "44px",
    height: "44px",
    borderRadius: "14px",
    background: "#fff1eb",
    color: "#ff5733",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  weeklyTitle: {
    margin: 0,
    color: "#111111",
    fontSize: "28px",
    fontWeight: 900,
  },

  weeklySubtitle: {
    margin: "4px 0 0",
    color: "#777777",
    fontSize: "14px",
  },

  weeklyRow: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(110px, 1fr))",
    gap: "14px",
  },

  dayCard: {
    border: "1px solid #eeeeee",
    borderRadius: "18px",
    padding: "18px 12px",
    textAlign: "center",
    background: "#ffffff",
    minHeight: "190px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  dayName: {
    color: "#111827",
    fontSize: "16px",
    fontWeight: 900,
  },

  dayDate: {
    display: "block",
    color: "#777777",
    fontSize: "14px",
    marginTop: "4px",
  },

  attendanceCircle: {
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "16px auto 12px",
    fontSize: "26px",
    fontWeight: 900,
    borderWidth: "1px",
    borderStyle: "solid",
  },

  attendanceText: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 900,
  },

  bottomGrid: {
    display: "flex",
    gap: "18px",
    width: "100%",
    maxWidth: "100%",
    overflowX: "auto",
    overflowY: "hidden",
    paddingBottom: "4px",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    WebkitOverflowScrolling: "touch",
  },

  bottomCard: {
    background: "#ffffff",
    border: "1px solid #eeeeee",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.045)",
    flex: "0 0 calc((100% - 36px) / 3)",
    minWidth: "360px",
    maxHeight: "620px",
    overflowY: "auto",
    overflowX: "hidden",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },

  sectionTitle: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "18px",
    color: "#ff5733",
  },

  sectionHeading: {
    margin: 0,
    color: "#111111",
    fontSize: "20px",
    fontWeight: 900,
  },

  list: {
    display: "grid",
    gap: "12px",
    minWidth: 0,
  },

  listItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    alignItems: "flex-start",
    border: "1px solid #eeeeee",
    background: "#f8f8f8",
    borderRadius: "16px",
    padding: "14px",
    minWidth: 0,
    overflow: "hidden",
  },

  listContent: {
    minWidth: 0,
    flex: 1,
  },

  listTitle: {
    display: "block",
    color: "#111111",
    fontSize: "14px",
    fontWeight: 900,
    overflowWrap: "anywhere",
  },

  listDescription: {
    margin: "5px 0 0",
    color: "#777777",
    fontSize: "13px",
    lineHeight: 1.4,
    overflowWrap: "anywhere",
  },

  listDate: {
    color: "#777777",
    fontSize: "12px",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },

  emptyText: {
    color: "#888888",
    fontSize: "14px",
    padding: "22px",
    textAlign: "center",
    border: "1px dashed #dddddd",
    borderRadius: "16px",
  },
};

const AdministratorOverview = () => {
  const [overview, setOverview] = useState(null);
  const [myProjects, setMyProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setMessage("");

      const [overviewResponse, myProjectsResponse, allProjectsResponse] =
        await Promise.all([
          api.get("/administrator/overview"),
          api.get("/administrator/projects/my"),
          api.get("/administrator/projects/all").catch(() => ({
            data: {},
          })),
        ]);

      setOverview(overviewResponse.data);
      setMyProjects(extractProjects(myProjectsResponse.data));
      setAllProjects(extractProjects(allProjectsResponse.data));
    } catch (error) {
      setMessage(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to load overview."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const profile = overview?.profile || {};

  const assignedProjects = useMemo(() => {
    const fallbackAssignedProjects = allProjects.filter((project) =>
      isProjectAssignedToUser(project, profile)
    );

    const combinedProjects = dedupeProjects([
      overview?.active_project,
      ...fallbackAssignedProjects,
      ...myProjects,
      ...(overview?.assigned_projects || []),
      ...(overview?.recent_projects || []),
    ]);

    return combinedProjects
      .filter((project) => {
        if (!project) return false;

        const status = getProjectStatus(project);

        return (
          status !== "completed" &&
          status !== "done" &&
          status !== "cancelled" &&
          status !== "rejected"
        );
      })
      .sort((firstProject, secondProject) => {
        const order = {
          not_started: 1,
          ongoing: 2,
          in_progress: 2,
          under_review: 3,
          on_hold: 4,
        };

        return (
          (order[getProjectStatus(firstProject)] || 99) -
          (order[getProjectStatus(secondProject)] || 99)
        );
      });
  }, [myProjects, allProjects, overview, profile]);

  const stats = overview?.stats || {};
  const myTaskStats = overview?.my_task_stats || {};

  const taskOverviewData = [
    {
      name: "Total",
      value: Number(myTaskStats.total || stats.my_tasks || 0),
    },
    {
      name: "In Progress",
      value: Number(myTaskStats.in_progress || 0),
    },
    {
      name: "Completed",
      value: Number(myTaskStats.completed || 0),
    },
  ];

  const projectSplitData = useMemo(() => {
    const backendData = overview?.project_split || [];

    return backendData
      .map((item) => ({
        ...item,
        status:
          statusLabels[item.status] ||
          String(item.status || "")
            .replaceAll("_", " ")
            .replace(/\b\w/g, (character) => character.toUpperCase()),
        count: Number(item.count || item.value || 0),
      }))
      .filter((item) => item.count > 0);
  }, [overview]);

  const weeklyAttendance = overview?.weekly_attendance || [];

  if (loading) {
    return <div className="page-loader">Loading overview...</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.titleRow}>
        <h1 style={styles.title}>Administrator Overview</h1>

        <p style={styles.subtitle}>
          Welcome back, {profile.full_name || "Jay More"}. Here is your complete
          work overview.
        </p>
      </div>

      {message && <div className="projects-message">{message}</div>}

      <div className="administrator-overview-stats" style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Total Users</span>
          <strong style={styles.statValue}>{stats.total_users || 0}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Total Projects</span>
          <strong style={styles.statValue}>{stats.total_projects || 0}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>My Projects</span>
          <strong style={styles.statValue}>{assignedProjects.length}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>My Tasks</span>
          <strong style={styles.statValue}>{stats.my_tasks || 0}</strong>
        </div>
      </div>

      <div className="administrator-overview-main-grid" style={styles.mainGrid}>
        <section style={styles.activeProjectCard}>
          <div style={styles.activeTop}>
            <h2 style={styles.activeTitle}>Active Projects</h2>

            <strong style={styles.activeCount}>
              {assignedProjects.length}
            </strong>
          </div>

          {assignedProjects.length > 0 ? (
            <div
              className="administrator-hidden-scrollbar active-project-scroll"
              style={styles.assignedProjectsList}
            >
              {assignedProjects.map((project, index) => {
                const progress = getProjectProgress(project);
                const subtaskStats = getProjectSubtaskStats(project);
                const status = getProjectStatus(project);

                return (
                  <div
                    style={styles.projectItem}
                    key={project.project_id || project.id || index}
                  >
                    <div style={styles.projectTop}>
                      <div>
                        <h3 style={styles.projectTitle}>
                          {project.project_title ||
                            project.title ||
                            "Untitled Project"}
                        </h3>

                        <p style={styles.projectDesc}>
                          {project.project_description ||
                            project.description ||
                            "No description"}
                        </p>
                      </div>

                      <span style={styles.statusBadge}>
                        {statusLabels[status] || status}
                      </span>
                    </div>

                    <div style={styles.progressRow}>
                      <div style={styles.progressTrack}>
                        <div
                          style={{
                            ...styles.progressFill,
                            width: `${progress}%`,
                          }}
                        />
                      </div>

                      <span style={styles.progressText}>{progress}%</span>
                    </div>

                    <p style={styles.subtaskText}>
                      {subtaskStats.completed}/{subtaskStats.total} subtasks
                      done
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={styles.emptyText}>No assigned projects yet.</div>
          )}
        </section>

        <section style={styles.analyticsCard}>
          <div style={styles.analyticsTitleRow}>
            <div style={styles.analyticsTitleIcon}>
              <Activity size={21} />
            </div>

            <h2 style={styles.analyticsTitle}>Work Analytics</h2>
          </div>

          <div
            className="administrator-overview-charts"
            style={styles.chartsGrid}
          >
            <div style={styles.chartSection}>
              <h3 style={styles.chartHeading}>Task Overview</h3>

              <p style={styles.chartDescription}>
                Summary of your assigned tasks.
              </p>

              {taskOverviewData.some((item) => item.value > 0) ? (
                <ResponsiveContainer width="100%" height={330}>
                  <BarChart
                    data={taskOverviewData}
                    margin={{
                      top: 20,
                      right: 10,
                      left: -20,
                      bottom: 10,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#eeeeee"
                    />

                    <XAxis
                      dataKey="name"
                      tick={{
                        fill: "#666666",
                        fontSize: 12,
                      }}
                      axisLine={{
                        stroke: "#dddddd",
                      }}
                      tickLine={false}
                    />

                    <YAxis
                      allowDecimals={false}
                      tick={{
                        fill: "#666666",
                        fontSize: 12,
                      }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <Tooltip
                      cursor={{
                        fill: "rgba(255, 87, 51, 0.06)",
                      }}
                    />

                    <Bar
                      dataKey="value"
                      fill="#ff5733"
                      radius={[10, 10, 0, 0]}
                      maxBarSize={62}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={styles.emptyText}>No task data available.</div>
              )}
            </div>

            <div style={styles.chartSection}>
              <h3 style={styles.chartHeading}>Project Split</h3>

              <p style={styles.chartDescription}>
                Projects divided by their current status.
              </p>

              {projectSplitData.length > 0 ? (
                <ResponsiveContainer width="100%" height={330}>
                  <PieChart>
                    <Pie
                      data={projectSplitData}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="45%"
                      outerRadius={105}
                      innerRadius={48}
                      paddingAngle={2}
                      label={({ count }) => count}
                    >
                      {projectSplitData.map((entry, index) => (
                        <Cell
                          key={`${entry.status}-${index}`}
                          fill={chartColors[index % chartColors.length]}
                        />
                      ))}
                    </Pie>

                    <Tooltip />

                    <Legend
                      verticalAlign="bottom"
                      height={42}
                      iconType="circle"
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={styles.emptyText}>No project data available.</div>
              )}
            </div>
          </div>
        </section>
      </div>

      <section style={styles.weeklyCard}>
        <div style={styles.weeklyHeader}>
          <div style={styles.weeklyIcon}>
            <CalendarDays size={22} />
          </div>

          <div>
            <h2 style={styles.weeklyTitle}>This Week</h2>

            <p style={styles.weeklySubtitle}>
              Your attendance status for the current week.
            </p>
          </div>
        </div>

        {weeklyAttendance.length > 0 ? (
          <div
            className="administrator-weekly-attendance"
            style={styles.weeklyRow}
          >
            {weeklyAttendance.map((day, index) => {
              const status = day.status || "not_marked";
              const attendanceStyle = getAttendanceStyle(status);

              return (
                <div
                  style={styles.dayCard}
                  key={day.date || `${day.day_name}-${index}`}
                >
                  <strong style={styles.dayName}>
                    {day.day_name || "-"}
                  </strong>

                  <span style={styles.dayDate}>
                    {day.display_date || day.date || "-"}
                  </span>

                  <div
                    style={{
                      ...styles.attendanceCircle,
                      background: attendanceStyle.background,
                      color: attendanceStyle.color,
                      borderColor: attendanceStyle.border,
                    }}
                  >
                    {attendanceSymbols[status] || "—"}
                  </div>

                  <p
                    style={{
                      ...styles.attendanceText,
                      color: attendanceStyle.color,
                    }}
                  >
                    {attendanceLabels[status] || "Not Marked"}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={styles.emptyText}>
            No attendance information available for this week.
          </div>
        )}
      </section>

      <div
        className="administrator-overview-bottom-grid administrator-hidden-scrollbar"
        style={styles.bottomGrid}
      >
        <section
          className="administrator-bottom-card administrator-hidden-scrollbar"
          style={styles.bottomCard}
        >
          <div style={styles.sectionTitle}>
            <FolderKanban size={20} />

            <h2 style={styles.sectionHeading}>My Recent Projects</h2>
          </div>

          {assignedProjects.length > 0 ? (
            <div style={styles.list}>
              {assignedProjects.slice(0, 5).map((project, index) => (
                <div
                  style={styles.listItem}
                  key={project.project_id || project.id || index}
                >
                  <div style={styles.listContent}>
                    <strong style={styles.listTitle}>
                      {project.project_title ||
                        project.title ||
                        "Untitled Project"}
                    </strong>

                    <p style={styles.listDescription}>
                      {statusLabels[getProjectStatus(project)] ||
                        getProjectStatus(project)}{" "}
                      · {getProjectProgress(project)}%
                    </p>
                  </div>

                  <span style={styles.listDate}>
                    {project.due_date ||
                      project.end_date ||
                      project.project_end_date ||
                      "-"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.emptyText}>No projects assigned yet.</div>
          )}
        </section>

        <section
          className="administrator-bottom-card administrator-hidden-scrollbar"
          style={styles.bottomCard}
        >
          <div style={styles.sectionTitle}>
            <ClipboardList size={20} />

            <h2 style={styles.sectionHeading}>My Recent Tasks</h2>
          </div>

          {overview?.recent_tasks?.length > 0 ? (
            <div style={styles.list}>
              {overview.recent_tasks.slice(0, 5).map((task, index) => (
                <div
                  style={styles.listItem}
                  key={task.task_id || task.id || index}
                >
                  <div style={styles.listContent}>
                    <strong style={styles.listTitle}>
                      {task.task_title || task.title || "Untitled Task"}
                    </strong>

                    <p style={styles.listDescription}>
                      {task.project_title || "No project"}
                    </p>
                  </div>

                  <span style={styles.listDate}>
                    {statusLabels[task.status] ||
                      String(task.status || "-").replaceAll("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.emptyText}>No tasks assigned yet.</div>
          )}
        </section>

        <section
          className="administrator-bottom-card administrator-hidden-scrollbar"
          style={styles.bottomCard}
        >
          <div style={styles.sectionTitle}>
            <Clock3 size={20} />

            <h2 style={styles.sectionHeading}>Activity Log</h2>
          </div>

          {overview?.activity_logs?.length > 0 ? (
            <div style={styles.list}>
              {overview.activity_logs.slice(0, 5).map((activity, index) => (
                <div
                  style={styles.listItem}
                  key={activity.log_id || activity.id || index}
                >
                  <div style={styles.listContent}>
                    <strong style={styles.listTitle}>
                      {String(
                        activity.action_type || "Activity"
                      ).replaceAll("_", " ")}
                    </strong>

                    <p style={styles.listDescription}>
                      {activity.description || "No description"}
                    </p>
                  </div>

                  <span style={styles.listDate}>
                    {activity.created_date ||
                      activity.created_at ||
                      activity.date ||
                      "-"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.emptyText}>No activity yet.</div>
          )}
        </section>
      </div>

      <style>
        {`
          .administrator-hidden-scrollbar {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          .administrator-hidden-scrollbar::-webkit-scrollbar {
            display: none;
            width: 0;
            height: 0;
          }

          .active-project-scroll::-webkit-scrollbar {
            display: none;
            width: 0;
            height: 0;
          }

          .administrator-overview-bottom-grid::-webkit-scrollbar {
            display: none;
            width: 0;
            height: 0;
          }

          .administrator-bottom-card::-webkit-scrollbar {
            display: none;
            width: 0;
            height: 0;
          }

          @media (max-width: 1350px) {
            .administrator-overview-main-grid {
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 1050px) {
            .administrator-overview-stats {
              grid-template-columns: repeat(
                2,
                minmax(160px, 1fr)
              ) !important;
            }

            .administrator-overview-charts {
              grid-template-columns: 1fr !important;
            }

            .administrator-weekly-attendance {
              grid-template-columns: repeat(
                4,
                minmax(120px, 1fr)
              ) !important;
            }

            .administrator-bottom-card {
              flex-basis: 420px !important;
              min-width: 420px !important;
            }
          }

          @media (max-width: 700px) {
            .administrator-overview-stats {
              grid-template-columns: 1fr !important;
            }

            .administrator-weekly-attendance {
              grid-template-columns: repeat(
                2,
                minmax(120px, 1fr)
              ) !important;
            }

            .administrator-bottom-card {
              flex-basis: 340px !important;
              min-width: 340px !important;
            }
          }

          @media (max-width: 450px) {
            .administrator-weekly-attendance {
              grid-template-columns: 1fr !important;
            }

            .administrator-bottom-card {
              flex-basis: calc(100vw - 70px) !important;
              min-width: calc(100vw - 70px) !important;
            }
          }
        `}
      </style>
    </div>
  );
};

export default AdministratorOverview;
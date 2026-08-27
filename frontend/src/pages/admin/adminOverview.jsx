import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  Users,
} from "lucide-react";
import api from "../../api/axios";
import AdminReviewPopup from "./AdminReviewPopup";


const statusLabels = {
  todo: "To Do",
  not_started: "To Do",
  in_progress: "In Progress",
  ongoing: "In Progress",
  under_review: "Under Review",
  done: "Done",
  completed: "Completed",
  rejected: "Rejected",
  blocked: "Blocked",
  on_hold: "On Hold",
  cancelled: "Cancelled",
};

const getNumber = (...values) => {
  for (const value of values) {
    const number = Number(value);
    if (!Number.isNaN(number)) return number;
  }

  return 0;
};

const formatDate = (value) => {
  if (!value) return "-";
  return String(value).slice(0, 10);
};

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

const styles = {
  page: {
  paddingTop: "38px",
  paddingBottom: "40px",
},
  warning: {
    background: "#fff7ed",
    color: "#9a3412",
    border: "1px solid #fed7aa",
    borderRadius: "14px",
    padding: "13px 16px",
    marginBottom: "20px",
    fontWeight: 800,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(170px, 1fr))",
    gap: "18px",
    marginBottom: "24px",
  },
  statCard: {
    background: "#ffffff",
    border: "1px solid #eeeeee",
    borderRadius: "22px",
    padding: "22px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.045)",
  },
  statIcon: {
    color: "#ff5733",
    marginBottom: "14px",
  },
  statLabel: {
    display: "block",
    color: "#667085",
    fontSize: "14px",
    fontWeight: 800,
    marginBottom: "8px",
  },
  statValue: {
    display: "block",
    color: "#111827",
    fontSize: "34px",
    fontWeight: 900,
  },
  gridTwo: {
    display: "grid",
    gridTemplateColumns: "1.25fr 0.75fr",
    gap: "22px",
    marginBottom: "24px",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #eeeeee",
    borderRadius: "24px",
    padding: "26px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.045)",
    marginBottom: "24px",
  },
  sectionTitle: {
    margin: 0,
    color: "#111827",
    fontSize: "25px",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  sectionSubtitle: {
    margin: "7px 0 20px",
    color: "#667085",
    fontSize: "14px",
  },
  activityList: {
  display: "grid",
  gap: "14px",
  maxHeight: "420px",
  overflowY: "auto",
  paddingRight: "8px",
  scrollbarWidth: "thin",
},
  activityItem: {
    border: "1px solid #edf0f4",
    background: "#f8fafc",
    borderRadius: "18px",
    padding: "18px",
    display: "grid",
    gridTemplateColumns: "18px 1fr",
    gap: "14px",
  },
  dot: {
    width: "12px",
    height: "12px",
    borderRadius: "999px",
    background: "#ff5733",
    marginTop: "6px",
  },
  activityTitle: {
    margin: 0,
    color: "#111827",
    fontSize: "16px",
    fontWeight: 900,
  },
  activityDesc: {
    margin: "7px 0 0",
    color: "#344054",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  activityMeta: {
    margin: "10px 0 0",
    color: "#98a2b3",
    fontSize: "13px",
    fontWeight: 700,
  },
  attendanceBarContainer: {
  width: "100%",
  margin: "20px 0",
},

attendanceBarLabel: {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "10px",
  color: "#111827",
  fontSize: "15px",
  fontWeight: 800,
},

attendanceBarTrack: {
  width: "100%",
  height: "22px",
  background: "#f1f5f9",
  borderRadius: "999px",
  overflow: "hidden",
  border: "1px solid #edf0f4",
},

attendanceBarFill: {
  height: "100%",
  background: "linear-gradient(90deg, #ff5733, #ff8a65)",
  borderRadius: "999px",
  transition: "width 0.4s ease",
},
  miniGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "12px",
  },
  miniCard: {
    border: "1px solid #edf0f4",
    borderRadius: "16px",
    background: "#f8fafc",
    padding: "14px",
  },
  miniValue: {
    display: "block",
    color: "#111827",
    fontSize: "23px",
    fontWeight: 900,
    marginBottom: "4px",
  },
  miniLabel: {
    color: "#667085",
    fontSize: "13px",
    fontWeight: 800,
  },
  empty: {
    border: "1px dashed #d0d5dd",
    borderRadius: "18px",
    padding: "24px",
    textAlign: "center",
    color: "#667085",
    fontWeight: 800,
  },
  reviewHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "18px",
  },
  reviewCount: {
    minWidth: "38px",
    height: "38px",
    padding: "0 12px",
    borderRadius: "999px",
    background: "#fff1eb",
    color: "#ff5733",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: "14px",
  },
  reviewList: {
    display: "grid",
    gap: "12px",
    maxHeight: "300px",
    overflowY: "auto",
    paddingRight: "6px",
    scrollbarWidth: "thin",
  },
  reviewItem: {
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    borderRadius: "16px",
    padding: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
  },
  reviewMain: {
    minWidth: 0,
  },
  reviewTaskName: {
    margin: "0 0 6px",
    color: "#111827",
    fontSize: "16px",
    fontWeight: 900,
  },
  reviewMeta: {
    margin: 0,
    color: "#667085",
    fontSize: "13px",
    lineHeight: 1.55,
  },
  reviewStatus: {
    display: "inline-flex",
    marginTop: "8px",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#ede9fe",
    color: "#6d28d9",
    fontSize: "11px",
    fontWeight: 900,
  },
  reviewButton: {
    flexShrink: 0,
    minHeight: "40px",
    border: 0,
    borderRadius: "12px",
    padding: "0 15px",
    background: "#ff5733",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },
};

const AdminOverview = () => {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [miniTasks, setMiniTasks] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState({});
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedReviewProject, setSelectedReviewProject] = useState(null);
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setMessage("");

      const [
        profileResult,
        tasksResult,
        attendanceResult,
        miniTasksResult,
        meetingsResult,
      ] = await Promise.allSettled([
        api.get("/admin-profile/me"),
        api.get("/admin-tasks/department-tasks"),
        api.get("/admin-attendance/department-attendance"),
        api.get("/admin-mini-tasks/department"),
        api.get("/calendar/upcoming"),
      ]);

      if (profileResult.status === "fulfilled") {
        const profileData =
          profileResult.value.data?.admin ||
          profileResult.value.data?.profile ||
          profileResult.value.data?.user ||
          profileResult.value.data?.data ||
          profileResult.value.data ||
          null;

        setProfile(profileData);
      }

      if (tasksResult.status === "fulfilled") {
        setTasks(tasksResult.value.data?.tasks || []);
      }

      if (miniTasksResult.status === "fulfilled") {
        setMiniTasks(
          miniTasksResult.value.data?.mini_tasks || []
        );
      }
      if (meetingsResult.status === "fulfilled") {
        setUpcomingMeetings(
          meetingsResult.value.data?.meetings || []
        );
      }

      if (attendanceResult.status === "fulfilled") {
        const attendanceData = attendanceResult.value.data || {};

        const oldSummary = attendanceData?.summary || {};
        const newDepartmentTotals = attendanceData?.department_totals || {};
        const employeeSummary = attendanceData?.employee_summary || [];
        const myAttendance = attendanceData?.my_attendance || null;

        const employeeCount = getNumber(
          oldSummary.total_people,
          newDepartmentTotals.people,
          employeeSummary.length
        );

        const adminCount = myAttendance ? 1 : 0;

        setAttendanceSummary({
          total_people: oldSummary.total_people ?? employeeCount + adminCount,
          total_records:
            oldSummary.total_records ?? newDepartmentTotals.total ?? 0,
          present_count:
            oldSummary.present_count ?? newDepartmentTotals.present ?? 0,
          absent_count:
            oldSummary.absent_count ?? newDepartmentTotals.absent ?? 0,
          late_count: oldSummary.late_count ?? newDepartmentTotals.late ?? 0,
        });

        const combinedRecords = [
          ...(attendanceData?.records || []),
          ...(myAttendance?.records || []),
          ...employeeSummary.flatMap((employee) => employee.records || []),
        ];

        setAttendanceRecords(combinedRecords);
      }

      const failed = [profileResult, tasksResult, attendanceResult].filter(
        (result) => result.status === "rejected"
      );

      if (failed.length > 0) {
        setMessage(
          "Some overview sections could not load. Check backend terminal for the failed admin endpoint."
        );
      }
    } catch (error) {
      setMessage("Failed to load admin overview.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const user = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const adminName = profile?.full_name || user?.full_name || "Admin";

  const totalUsers = getNumber(attendanceSummary.total_people);
  const totalTasks = tasks.length;

  const completedTasks = tasks.filter((task) =>
    ["done", "completed"].includes(
      String(task.status_group || task.status || "").toLowerCase()
    )
  ).length;

  const totalProjects = useMemo(() => {
    const projectKeys = new Set();

    tasks.forEach((task) => {
      const key = task.project_id || task.project_title;
      if (key) projectKeys.add(key);
    });

    return projectKeys.size;
  }, [tasks]);

  /*
  Main tasks submitted by employees for Admin review.
  The department-tasks endpoint is already loaded above,
  so no additional backend request is required here.
  */
  const tasksWaitingForReview = useMemo(() => {
  return tasks
    .filter((task) => {
      const status = normalizeStatus(
        task.status_group ||
          task.task_status ||
          task.status
      );

      return status === "under_review";
    })
    .map((task) => {
      const assignees = Array.isArray(
        task.main_task_assignees ||
          task.assignees
      )
        ? task.main_task_assignees ||
          task.assignees
        : [];

      return {
        task_id: Number(
          task.task_id || 0
        ),

        key: String(
          task.task_id ||
            task.main_task_key ||
            ""
        ),

        task_title:
          task.task_title ||
          "Untitled Main Task",

        project_title:
          task.project_title ||
          "Untitled Project",

        due_date:
          task.task_end_date ||
          task.due_date ||
          task.project_end_date ||
          task.end_date ||
          "",

        assignees: assignees
          .map(
            (employee) =>
              employee.full_name ||
              employee.assigned_name
          )
          .filter(Boolean),
      };
    })
    .filter(
      (task) =>
        task.task_id
    );
}, [tasks]);

  const attendancePercentage = useMemo(() => {
    const totalRecords = getNumber(attendanceSummary.total_records);
    const presentCount = getNumber(attendanceSummary.present_count);

    if (totalRecords === 0) return 0;

    return Math.round((presentCount / totalRecords) * 100);
  }, [attendanceSummary]);

  const activities = useMemo(() => {
    const taskActivities = tasks.slice(0, 4).map((task) => ({
      type: "Task",
      title: task.task_title || "Task",
      description: `${task.assigned_name || "Employee"} is working on ${
        task.project_title || "project"
      }. Status: ${task.status_label || statusLabels[task.status_group] || "-"}`,
      meta: `${task.assigned_email || "-"} · ${formatDate(
        task.project_end_date || task.due_date
      )}`,
    }));

    const attendanceActivities = attendanceRecords.slice(0, 4).map((record) => ({
      type: "Attendance",
      title: record.full_name || record.employee_name || "Attendance",
      description: `${
        record.attendance_status || record.status || "-"
      } attendance marked.`,
      meta: `${record.email || "-"} · ${formatDate(record.attendance_date)}`,
    }));

    return [...taskActivities, ...attendanceActivities].slice(0, 8);
  }, [tasks, attendanceRecords]);

  if (loading) {
    return (
      <div style={styles.card}>
        <strong>Loading admin overview...</strong>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {message && <div style={styles.warning}>{message}</div>}

      <section style={styles.statsGrid}>
  <div
    style={{
      ...styles.statCard,
      cursor: "pointer",
      transition: "0.2s ease",
    }}
    onClick={() => navigate("/admin/users")}
  >
    <div style={styles.statIcon}>
      <Users size={21} />
    </div>

    <span style={styles.statLabel}>
      Department Users
    </span>

    <strong style={styles.statValue}>
      {totalUsers}
    </strong>
  </div>


  <div
    style={{
      ...styles.statCard,
      cursor: "pointer",
      transition: "0.2s ease",
    }}
    onClick={() => navigate("/admin/projects")}
  >
    <div style={styles.statIcon}>
      <FolderKanban size={21} />
    </div>

    <span style={styles.statLabel}>
      Department Projects
    </span>

    <strong style={styles.statValue}>
      {totalProjects}
    </strong>
  </div>


  <div
    style={{
      ...styles.statCard,
      cursor: "pointer",
      transition: "0.2s ease",
    }}
    onClick={() => navigate("/admin/tasks")}
  >
    <div style={styles.statIcon}>
      <ClipboardList size={21} />
    </div>

    <span style={styles.statLabel}>
      Department Tasks
    </span>

    <strong style={styles.statValue}>
      {totalTasks}
    </strong>
  </div>


  <div
    style={{
      ...styles.statCard,
      cursor: "pointer",
      transition: "0.2s ease",
    }}
    onClick={() => navigate("/admin/tasks")}
  >
    <div style={styles.statIcon}>
      <CheckCircle2 size={21} />
    </div>

    <span style={styles.statLabel}>
      Completed Tasks
    </span>

    <strong style={styles.statValue}>
      {completedTasks}
    </strong>
  </div>
</section>
<section style={styles.card}>
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "16px",
      marginBottom: "18px",
    }}
  >
    <div>
      <h2 style={styles.sectionTitle}>
        <CalendarCheck size={22} color="#ff5733" />
        Upcoming Meetings
      </h2>

      <p style={styles.sectionSubtitle}>
        Meetings scheduled for your department.
      </p>
    </div>

    <button
      type="button"
      onClick={() => navigate("/admin/calendar")}
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
          <div style={{ minWidth: 0 }}>
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

            {meeting.employees && (
              <p
                style={{
                  margin: "6px 0 0",
                  color: "#98a2b3",
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                Employees: {meeting.employees}
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
    <div style={styles.empty}>
      No upcoming meetings.
    </div>
  )}
</section>
      <section style={styles.card}>
        <div style={styles.reviewHeader}>
          <div>
            <h2 style={styles.sectionTitle}>
              <ClipboardList
                size={22}
                color="#ff5733"
              />
              Tasks Waiting For Review
            </h2>

            <p
              style={{
                ...styles.sectionSubtitle,
                marginBottom: 0,
              }}
            >
              Main tasks submitted by employees and waiting
              for your review.
            </p>
          </div>

          <span style={styles.reviewCount}>
            {tasksWaitingForReview.length}
          </span>
        </div>

        {tasksWaitingForReview.length > 0 ? (
          <div style={styles.reviewList}>
            {tasksWaitingForReview.map(
              (task) => (
                <div
                  key={task.key}
                  style={styles.reviewItem}
                >
                  <div style={styles.reviewMain}>
                    <h3 style={styles.reviewTaskName}>
                      {task.task_title}
                    </h3>

                    <p style={styles.reviewMeta}>
                      Project:{" "}
                      <strong>
                        {task.project_title}
                      </strong>
                      {task.assignees.length > 0
                        ? ` · Employee: ${task.assignees.join(
                            ", "
                          )}`
                        : ""}
                      {task.due_date
                        ? ` · Deadline: ${formatDate(
                            task.due_date
                          )}`
                        : ""}
                    </p>

                    <span style={styles.reviewStatus}>
                      Under Review
                    </span>
                  </div>

                  <button
                    type="button"
                    style={styles.reviewButton}
                    onClick={() =>
                      navigate(
                        "/admin/tasks",
                        {
                          state: {
                            openTaskId:
                              task.task_id,
                          },
                        }
                      )
                    }
                  >
                    Review Task
                  </button>
                </div>
              )
            )}
          </div>
        ) : (
          <div style={styles.empty}>
            No tasks waiting for review.
          </div>
        )}
      </section>

      <AdminReviewPopup />
      <section style={styles.card}>
  <h2 style={styles.sectionTitle}>
    <ClipboardList size={22} color="#ff5733" />
    Employee Mini Tasks
  </h2>

  <p style={styles.sectionSubtitle}>
    Mini tasks created by employees.
  </p>

  {miniTasks.length > 0 ? (
    <div style={styles.activityList}>
      {miniTasks.map((task, index) => (
        <div style={styles.activityItem} key={index}>
          <div style={styles.dot} />

          <div>
           <h3 style={styles.activityTitle}>
  {task.mini_task_title || "Mini Task"}
</h3>

<p style={styles.activityDesc}>
  {task.mini_task_description || "-"}
</p>

            <p style={styles.activityMeta}>
              Employee: {task.employee_name || "-"}
              {" · "}
              Date: {formatDate(task.task_date)}
            </p>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div style={styles.empty}>
      No mini tasks found.
    </div>
  )}
</section>

      <section style={styles.gridTwo}>
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>
            <Activity size={22} color="#ff5733" />
            Activity Log
          </h2>
          <p style={styles.sectionSubtitle}>
            Recent task and attendance activity visible to {adminName}.
          </p>

          {activities.length > 0 ? (
            <div style={styles.activityList}>
              {activities.map((item, index) => (
                <div style={styles.activityItem} key={index}>
                  <div style={styles.dot} />

                  <div>
                    <h3 style={styles.activityTitle}>{item.type}</h3>
                    <p style={styles.activityDesc}>
                      <strong>{item.title}</strong> — {item.description}
                    </p>
                    <p style={styles.activityMeta}>{item.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.empty}>No activity found.</div>
          )}
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>
            <CalendarCheck size={22} color="#ff5733" />
            Attendance
          </h2>
          <p style={styles.sectionSubtitle}>
            Department attendance summary for {adminName}.
          </p>

          <div style={styles.attendanceBarContainer}>

  <div style={styles.attendanceBarLabel}>
    <span>Attendance Completion</span>
    <strong>{attendancePercentage}%</strong>
  </div>

  <div style={styles.attendanceBarTrack}>
    <div
      style={{
        ...styles.attendanceBarFill,
        width: `${attendancePercentage}%`,
      }}
    />
  </div>

</div>
          <div style={styles.miniGrid}>
            <div style={styles.miniCard}>
              <strong style={styles.miniValue}>
                {attendanceSummary.present_count || 0}
              </strong>
              <span style={styles.miniLabel}>Present</span>
            </div>

            <div style={styles.miniCard}>
              <strong style={styles.miniValue}>
                {attendanceSummary.absent_count || 0}
              </strong>
              <span style={styles.miniLabel}>Absent</span>
            </div>

            <div style={styles.miniCard}>
              <strong style={styles.miniValue}>
                {attendanceSummary.late_count || 0}
              </strong>
              <span style={styles.miniLabel}>Late</span>
            </div>

            <div style={styles.miniCard}>
              <strong style={styles.miniValue}>
                {attendanceSummary.total_records || 0}
              </strong>
              <span style={styles.miniLabel}>Total Records</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminOverview;
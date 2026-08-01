import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Timer,
} from "lucide-react";
import api from "../../api/axios";

const AdminDepartmentMiniTasks = () => {
  const [miniTasks, setMiniTasks] = useState([]);
  const [departmentName, setDepartmentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const fetchMiniTasks = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await api.get("/admin-mini-tasks/department");

      setMiniTasks(response.data?.mini_tasks || []);
      setDepartmentName(response.data?.department_name || "");
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to load department mini tasks."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMiniTasks();
  }, []);

  const filteredMiniTasks = useMemo(() => {
    const value = search.toLowerCase().trim();

    if (!value) return miniTasks;

    return miniTasks.filter((task) => {
      return (
        task.mini_task_title?.toLowerCase().includes(value) ||
        task.mini_task_description?.toLowerCase().includes(value) ||
        task.employee_name?.toLowerCase().includes(value) ||
        task.employee_email?.toLowerCase().includes(value) ||
        task.employee_code?.toLowerCase().includes(value) ||
        task.designation?.toLowerCase().includes(value) ||
        task.task_date?.toLowerCase().includes(value)
      );
    });
  }, [miniTasks, search]);

  const formatDuration = (minutes) => {
    const value = Number(minutes || 0);
    const hours = Math.floor(value / 60);
    const mins = value % 60;

    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} hr`;

    return `${hours} hr ${mins} min`;
  };

  const markReviewed = async (miniTaskId) => {
    try {
      setReviewingId(miniTaskId);
      setMessage("");

      await api.put(`/admin-mini-tasks/${miniTaskId}/reviewed`);

      setMessage("Mini task marked as reviewed.");
      await fetchMiniTasks();
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to mark mini task as reviewed."
      );
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>
            <Timer size={23} color="#ff5733" />
            Department Mini Tasks
          </h2>
          <p style={styles.subtitle}>
            Short tasks logged by employees from your department
            {departmentName ? ` (${departmentName})` : ""}.
          </p>
        </div>

        <button type="button" style={styles.refreshBtn} onClick={fetchMiniTasks}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {message && <div style={styles.message}>{message}</div>}

      <div style={styles.searchBox}>
        <Search size={17} color="#667085" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search mini task, employee, date, designation..."
        />
      </div>

      {loading ? (
        <div style={styles.empty}>Loading department mini tasks...</div>
      ) : filteredMiniTasks.length ? (
        <div style={styles.list}>
          {filteredMiniTasks.map((task) => (
            <div style={styles.taskCard} key={task.mini_task_id}>
              <div style={styles.taskTop}>
                <div>
                  <h4>{task.mini_task_title}</h4>
                  <p>{task.mini_task_description || "-"}</p>
                </div>

                <span style={styles.badge}>{task.status}</span>
              </div>

              <div style={styles.employeeBox}>
                <strong>{task.employee_name || "-"}</strong>
                <span>{task.employee_email || "-"}</span>
                <span>
                  {task.employee_code || "-"} · {task.designation || "-"}
                </span>
              </div>

              <div style={styles.metaGrid}>
                <div>
                  <CalendarDays size={15} />
                  <span>{task.task_date}</span>
                </div>

                <div>
                  <Clock size={15} />
                  <span>
                    {task.start_time} - {task.end_time}
                  </span>
                </div>

                <div>
                  <Timer size={15} />
                  <span>{formatDuration(task.total_minutes)}</span>
                </div>
              </div>

              {task.status !== "reviewed" && (
                <button
                  type="button"
                  style={styles.reviewBtn}
                  onClick={() => markReviewed(task.mini_task_id)}
                  disabled={reviewingId === task.mini_task_id}
                >
                  <CheckCircle2 size={16} />
                  {reviewingId === task.mini_task_id
                    ? "Updating..."
                    : "Mark Reviewed"}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.empty}>No mini tasks found.</div>
      )}
    </section>
  );
};

const styles = {
  card: {
    background: "#ffffff",
    border: "1px solid #eeeeee",
    borderRadius: "24px",
    padding: "26px",
    marginBottom: "28px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.045)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "18px",
    marginBottom: "22px",
  },
  title: {
    margin: 0,
    color: "#111827",
    fontSize: "26px",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#667085",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  refreshBtn: {
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#111827",
    borderRadius: "14px",
    padding: "11px 14px",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
  },
  message: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    borderRadius: "14px",
    padding: "13px 15px",
    fontWeight: 800,
    marginBottom: "18px",
  },
  searchBox: {
    width: "100%",
    border: "1px solid #d0d5dd",
    borderRadius: "16px",
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#ffffff",
    marginBottom: "18px",
  },
  list: {
    display: "grid",
    gap: "14px",
  },
  taskCard: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "17px",
  },
  taskTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    alignItems: "flex-start",
    marginBottom: "14px",
  },
  employeeBox: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "13px",
    marginBottom: "14px",
    display: "grid",
    gap: "4px",
    color: "#667085",
    fontSize: "13px",
  },
  badge: {
    background: "#eef2ff",
    color: "#344054",
    borderRadius: "999px",
    padding: "7px 12px",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "capitalize",
  },
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "12px",
    color: "#667085",
    fontSize: "13px",
    fontWeight: 800,
    marginBottom: "14px",
  },
  reviewBtn: {
    border: 0,
    background: "#111827",
    color: "#ffffff",
    borderRadius: "14px",
    padding: "11px 15px",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
  },
  empty: {
    border: "1px dashed #d0d5dd",
    borderRadius: "16px",
    padding: "20px",
    textAlign: "center",
    color: "#667085",
    fontWeight: 900,
  },
};

export default AdminDepartmentMiniTasks;
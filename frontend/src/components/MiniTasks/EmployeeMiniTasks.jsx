import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  Plus,
  RefreshCw,
  Timer,
} from "lucide-react";
import api from "../../api/axios";

const todayDate = () => {
  return new Date().toISOString().split("T")[0];
};

const EmployeeMiniTasks = () => {
  const [miniTasks, setMiniTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    mini_task_title: "",
    mini_task_description: "",
    task_date: todayDate(),
    start_time: "",
    end_time: "",
  });

  const [message, setMessage] = useState("");

  const fetchMiniTasks = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await api.get("/employee-mini-tasks/my");

      setMiniTasks(response.data?.mini_tasks || []);
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to load mini tasks."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMiniTasks();
  }, []);

  const totalMinutesToday = useMemo(() => {
    return miniTasks
      .filter((task) => task.task_date === todayDate())
      .reduce((sum, task) => sum + Number(task.total_minutes || 0), 0);
  }, [miniTasks]);

  const formatDuration = (minutes) => {
    const value = Number(minutes || 0);
    const hours = Math.floor(value / 60);
    const mins = value % 60;

    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} hr`;

    return `${hours} hr ${mins} min`;
  };

  const updateForm = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const submitMiniTask = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage("");

      await api.post("/employee-mini-tasks", form);

      setForm({
        mini_task_title: "",
        mini_task_description: "",
        task_date: todayDate(),
        start_time: "",
        end_time: "",
      });

      setMessage("Mini task added successfully.");
      await fetchMiniTasks();
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to add mini task."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>
            <Timer size={23} color="#ff5733" />
            Mini Tasks
          </h2>
          <p style={styles.subtitle}>
            Add short work done between major project tasks. Your department
            admin can view these mini tasks.
          </p>
        </div>

        <button type="button" style={styles.refreshBtn} onClick={fetchMiniTasks}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {message && <div style={styles.message}>{message}</div>}

      <div style={styles.summaryRow}>
        <div style={styles.summaryCard}>
          <span>Total Mini Tasks</span>
          <strong>{miniTasks.length}</strong>
        </div>

        <div style={styles.summaryCard}>
          <span>Today's Mini Work</span>
          <strong>{formatDuration(totalMinutesToday)}</strong>
        </div>
      </div>

      <form style={styles.form} onSubmit={submitMiniTask}>
        <div style={styles.field}>
          <label>Mini Task Title</label>
          <input
            value={form.mini_task_title}
            onChange={(event) =>
              updateForm("mini_task_title", event.target.value)
            }
            placeholder="Example: Follow-up call, quick design change, data correction"
          />
        </div>

        <div style={styles.field}>
          <label>Description</label>
          <textarea
            value={form.mini_task_description}
            onChange={(event) =>
              updateForm("mini_task_description", event.target.value)
            }
            placeholder="Write short details of what you worked on"
            rows={3}
          />
        </div>

        <div style={styles.formGrid}>
          <div style={styles.field}>
            <label>Date</label>
            <input
              type="date"
              value={form.task_date}
              onChange={(event) => updateForm("task_date", event.target.value)}
            />
          </div>

          <div style={styles.field}>
            <label>Start Time</label>
            <input
              type="time"
              value={form.start_time}
              onChange={(event) => updateForm("start_time", event.target.value)}
            />
          </div>

          <div style={styles.field}>
            <label>End Time</label>
            <input
              type="time"
              value={form.end_time}
              onChange={(event) => updateForm("end_time", event.target.value)}
            />
          </div>
        </div>

        <button type="submit" style={styles.submitBtn} disabled={saving}>
          <Plus size={17} />
          {saving ? "Adding..." : "Add Mini Task"}
        </button>
      </form>

      <div style={styles.listHeader}>
        <h3>My Mini Tasks</h3>
      </div>

      {loading ? (
        <div style={styles.empty}>Loading mini tasks...</div>
      ) : miniTasks.length ? (
        <div style={styles.list}>
          {miniTasks.map((task) => (
            <div style={styles.taskCard} key={task.mini_task_id}>
              <div style={styles.taskTop}>
                <div>
                  <h4>{task.mini_task_title}</h4>
                  <p>{task.mini_task_description || "-"}</p>
                </div>

                <span style={styles.badge}>{task.status}</span>
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
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.empty}>No mini tasks added yet.</div>
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
  summaryRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "14px",
    marginBottom: "20px",
  },
  summaryCard: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "16px",
  },
  form: {
    display: "grid",
    gap: "16px",
    marginBottom: "26px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
  },
  field: {
    display: "grid",
    gap: "7px",
  },
  submitBtn: {
    justifySelf: "flex-start",
    border: 0,
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "14px",
    padding: "13px 18px",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
  },
  listHeader: {
    marginBottom: "14px",
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

export default EmployeeMiniTasks;
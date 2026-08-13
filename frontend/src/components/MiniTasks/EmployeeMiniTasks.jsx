import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  Plus,
  RefreshCw,
  Timer,
  X,
} from "lucide-react";
import api from "../../api/axios";

const getToday = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const EMPTY_FORM = {
  mini_task_title: "",
  mini_task_description: "",
  task_date: getToday(),
  start_time: "",
  end_time: "",
};

const EmployeeMiniTasks = () => {
  const [miniTasks, setMiniTasks] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);

  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [modalError, setModalError] = useState("");

  const fetchMiniTasks = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await api.get(
        "/employee-mini-tasks/my"
      );

      setMiniTasks(
        Array.isArray(response.data?.mini_tasks)
          ? response.data.mini_tasks
          : []
      );
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

  const formatDuration = (minutes) => {
    const value = Number(minutes || 0);
    const hours = Math.floor(value / 60);
    const mins = value % 60;

    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} hr`;

    return `${hours} hr ${mins} min`;
  };

  const formatDate = (value) => {
    if (!value) return "-";

    const [year, month, day] = String(value)
      .slice(0, 10)
      .split("-");

    return `${day}-${month}-${year}`;
  };

  const formatTime = (value) => {
    if (!value) return "-";

    const [hours, minutes] = String(value).split(":");
    const hour = Number(hours);

    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${minutes} ${suffix}`;
  };

  const calculateMinutes = useMemo(() => {
    if (!form.start_time || !form.end_time) return 0;

    const [startHour, startMinute] = form.start_time
      .split(":")
      .map(Number);

    const [endHour, endMinute] = form.end_time
      .split(":")
      .map(Number);

    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;

    return end > start ? end - start : 0;
  }, [form.start_time, form.end_time]);

  const updateForm = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setModalError("");
  };

  const openModal = () => {
    setForm({ ...EMPTY_FORM, task_date: getToday() });
    setModalError("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setModalError("");
  };

  const submitMiniTask = async (event) => {
    event.preventDefault();

    if (!form.mini_task_title.trim()) {
      setModalError("Mini task title is required.");
      return;
    }

    if (!form.task_date) {
      setModalError("Date is required.");
      return;
    }

    if (!form.start_time || !form.end_time) {
      setModalError("Start time and end time are required.");
      return;
    }

    if (calculateMinutes <= 0) {
      setModalError("End time must be after start time.");
      return;
    }

    if (form.task_date > getToday()) {
      setModalError(
        "Mini tasks cannot be logged for a future date."
      );
      return;
    }

    try {
      setSaving(true);
      setModalError("");

      await api.post("/employee-mini-tasks", {
        ...form,
        mini_task_title: form.mini_task_title.trim(),
        mini_task_description:
          form.mini_task_description.trim(),
      });

      setShowModal(false);
      setMessage("Mini task added successfully.");

      await fetchMiniTasks();
    } catch (error) {
      setModalError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to add mini task."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section style={styles.card}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>
              <Timer size={22} color="#ff5733" />
              Mini Tasks
            </h2>

            <p style={styles.subtitle}>
              Meetings, calls, discussions and other work
              outside project tasks.
            </p>
          </div>

          <div style={styles.headerActions}>
            <button
              type="button"
              style={styles.refreshBtn}
              onClick={fetchMiniTasks}
              disabled={loading}
            >
              <RefreshCw size={16} />
            </button>

            <button
              type="button"
              style={styles.addBtn}
              onClick={openModal}
            >
              <Plus size={17} />
              Add Mini Task
            </button>
          </div>
        </div>

        {message && (
          <div style={styles.message}>{message}</div>
        )}

        {loading ? (
          <div style={styles.empty}>
            Loading mini tasks...
          </div>
        ) : miniTasks.length === 0 ? (
          <div style={styles.empty}>
            No mini tasks added yet.
          </div>
        ) : (
          <div style={styles.list}>
            {miniTasks.slice(0, 6).map((task) => (
              <div
                style={styles.taskRow}
                key={task.mini_task_id}
              >
                <div style={styles.taskMain}>
                  <strong style={styles.taskTitle}>
                    {task.mini_task_title}
                  </strong>

                  <span style={styles.taskDescription}>
                    {task.mini_task_description || "-"}
                  </span>
                </div>

                <div style={styles.metaItem}>
                  <CalendarDays size={15} />
                  {formatDate(task.task_date)}
                </div>

                <div style={styles.metaItem}>
                  <Clock size={15} />
                  {formatTime(task.start_time)} -{" "}
                  {formatTime(task.end_time)}
                </div>

                <div style={styles.duration}>
                  <Timer size={15} />
                  {formatDuration(task.total_minutes)}
                </div>

                <span
                  style={{
                    ...styles.statusBadge,
                    ...(task.status === "reviewed"
                      ? styles.reviewedBadge
                      : styles.loggedBadge),
                  }}
                >
                  {task.status === "reviewed"
                    ? "Reviewed"
                    : "Logged"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {showModal && (
        <div
          style={styles.modalOverlay}
          onMouseDown={closeModal}
        >
          <div
            style={styles.modal}
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              style={styles.closeBtn}
              onClick={closeModal}
            >
              <X size={20} />
            </button>

            <h2 style={styles.modalTitle}>
              Add Mini Task
            </h2>

            <p style={styles.modalSubtitle}>
              Log work that happened outside your project
              tasks.
            </p>

            {modalError && (
              <div style={styles.modalError}>
                {modalError}
              </div>
            )}

            <form onSubmit={submitMiniTask}>
              <label style={styles.field}>
                <span>Title</span>
                <input
                  style={styles.input}
                  value={form.mini_task_title}
                  onChange={(event) =>
                    updateForm(
                      "mini_task_title",
                      event.target.value
                    )
                  }
                  placeholder="Example: Sales meeting"
                />
              </label>

              <label style={styles.field}>
                <span>Description</span>
                <textarea
                  style={styles.textarea}
                  value={form.mini_task_description}
                  onChange={(event) =>
                    updateForm(
                      "mini_task_description",
                      event.target.value
                    )
                  }
                  placeholder="What happened during this activity?"
                />
              </label>

              <div style={styles.formGrid}>
                <label style={styles.field}>
                  <span>Date</span>
                  <input
                    type="date"
                    max={getToday()}
                    style={styles.input}
                    value={form.task_date}
                    onChange={(event) =>
                      updateForm(
                        "task_date",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label style={styles.field}>
                  <span>Start Time</span>
                  <input
                    type="time"
                    style={styles.input}
                    value={form.start_time}
                    onChange={(event) =>
                      updateForm(
                        "start_time",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label style={styles.field}>
                  <span>End Time</span>
                  <input
                    type="time"
                    style={styles.input}
                    value={form.end_time}
                    onChange={(event) =>
                      updateForm(
                        "end_time",
                        event.target.value
                      )
                    }
                  />
                </label>
              </div>

              <div style={styles.durationPreview}>
                <span>Duration</span>
                <strong>
                  {calculateMinutes > 0
                    ? formatDuration(calculateMinutes)
                    : "0 min"}
                </strong>
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={closeModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={styles.submitBtn}
                  disabled={saving}
                >
                  <Plus size={17} />
                  {saving
                    ? "Adding..."
                    : "Add Mini Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

const styles = {
  card: {
    width: "100%",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "20px",
    padding: "18px 20px",
    boxSizing: "border-box",
    boxShadow: "0 8px 20px rgba(15,23,42,0.05)",
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "14px",
  },

  title: {
    margin: 0,
    color: "#111827",
    fontSize: "22px",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },

  subtitle: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: "12px",
  },

  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },

  refreshBtn: {
    width: "40px",
    height: "40px",
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: "12px",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  },

  addBtn: {
    height: "40px",
    border: 0,
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "0 15px",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: "7px",
    cursor: "pointer",
  },

  message: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#166534",
    borderRadius: "12px",
    padding: "10px 12px",
    marginBottom: "12px",
    fontSize: "12px",
    fontWeight: 800,
  },

  list: {
    maxHeight: "220px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  taskRow: {
    display: "grid",
    gridTemplateColumns:
      "minmax(200px, 1.8fr) 130px 210px 100px 90px",
    alignItems: "center",
    gap: "14px",
    padding: "11px 13px",
    border: "1px solid #e5e7eb",
    borderRadius: "13px",
    background: "#f8fafc",
  },

  taskMain: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },

  taskTitle: {
    color: "#111827",
    fontSize: "13px",
    fontWeight: 900,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  taskDescription: {
    color: "#64748b",
    fontSize: "11px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  metaItem: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "#475569",
    fontSize: "11px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  duration: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "#111827",
    fontSize: "11px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  statusBadge: {
    borderRadius: "999px",
    padding: "6px 9px",
    textAlign: "center",
    fontSize: "10px",
    fontWeight: 900,
  },

  loggedBadge: {
    background: "#fef3c7",
    color: "#92400e",
  },

  reviewedBadge: {
    background: "#dcfce7",
    color: "#166534",
  },

  empty: {
    border: "1px dashed #d1d5db",
    borderRadius: "13px",
    padding: "16px",
    textAlign: "center",
    color: "#94a3b8",
    fontSize: "12px",
    fontWeight: 800,
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 10000,
    background: "rgba(15,23,42,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },

  modal: {
    width: "min(650px, 95vw)",
    background: "#ffffff",
    borderRadius: "22px",
    padding: "26px",
    position: "relative",
    boxShadow: "0 25px 80px rgba(15,23,42,0.3)",
  },

  closeBtn: {
    position: "absolute",
    top: "18px",
    right: "18px",
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

  modalTitle: {
    margin: "0 50px 5px 0",
    fontSize: "25px",
    fontWeight: 900,
    color: "#111827",
  },

  modalSubtitle: {
    margin: "0 0 20px",
    color: "#64748b",
    fontSize: "13px",
  },

  modalError: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#b91c1c",
    borderRadius: "12px",
    padding: "11px",
    marginBottom: "14px",
    fontWeight: 800,
  },

  field: {
    display: "grid",
    gap: "7px",
    marginBottom: "14px",
    color: "#111827",
    fontSize: "12px",
    fontWeight: 900,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "10px",
  },

  input: {
    width: "100%",
    height: "44px",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: "11px",
    padding: "0 11px",
    fontFamily: "inherit",
  },

  textarea: {
    minHeight: "85px",
    border: "1px solid #d1d5db",
    borderRadius: "11px",
    padding: "11px",
    fontFamily: "inherit",
    resize: "vertical",
  },

  durationPreview: {
    display: "flex",
    justifyContent: "space-between",
    background: "#fff7f4",
    border: "1px solid #ffd4c8",
    borderRadius: "12px",
    padding: "12px",
    marginBottom: "18px",
    fontSize: "13px",
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
  },

  cancelBtn: {
    height: "44px",
    minWidth: "100px",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    background: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },

  submitBtn: {
    height: "44px",
    border: 0,
    borderRadius: "12px",
    background: "#ff5733",
    color: "#ffffff",
    padding: "0 17px",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: "7px",
    cursor: "pointer",
  },
};

export default EmployeeMiniTasks;
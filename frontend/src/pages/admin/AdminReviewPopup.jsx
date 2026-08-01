import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  PauseCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import api from "../../api/axios";

const AdminReviewPopup = () => {
  const [reviewProjects, setReviewProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState("");

  const fetchReviewProjects = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/admin-review/projects");

      const projects =
        response.data?.review_projects ||
        response.data?.projects ||
        [];

      setReviewProjects(projects);
    } catch (err) {
      console.error("Review projects error:", err);

      setError(
        err?.response?.data?.sqlMessage ||
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to load review projects."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviewProjects();
  }, []);

  const handleAction = async (projectId, action) => {
    try {
      setActionLoadingId(`${projectId}-${action}`);
      setError("");

      await api.post(`/admin-review/projects/${projectId}/action`, {
        action,
      });

      await fetchReviewProjects();
    } catch (err) {
      console.error("Review action error:", err);

      setError(
        err?.response?.data?.sqlMessage ||
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to update project."
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const isSubtaskDone = (subtask) => {
    const status = String(subtask.status || "").toLowerCase();

    return (
      Number(subtask.is_checked || 0) === 1 ||
      status === "completed" ||
      status === "done" ||
      status === "complete"
    );
  };

  const renderSubtasks = (task) => {
    if (!task.subtasks || task.subtasks.length === 0) {
      return (
        <div style={styles.emptySmall}>
          This assignee has not added subtasks.
        </div>
      );
    }

    return (
      <div style={styles.subtaskList}>
        {task.subtasks.map((subtask) => (
          <div key={subtask.task_id} style={styles.subtaskItem}>
            <div>
              <strong>{subtask.task_title}</strong>
              <p>{subtask.task_description || "-"}</p>
              <span>
                {subtask.start_date || "-"} to {subtask.due_date || "-"}
              </span>
            </div>

            <span style={isSubtaskDone(subtask) ? styles.doneMiniBadge : styles.pendingMiniBadge}>
              {isSubtaskDone(subtask) ? "Done" : "Pending"}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderProjectCard = (project) => {
    return (
      <div key={project.project_id} style={styles.reviewCard}>
        <div style={styles.reviewTop}>
          <div>
            <h3 style={styles.cardTitle}>{project.project_title}</h3>
            <p style={styles.cardDesc}>
              {project.project_description || "No project description."}
            </p>
          </div>

          <span style={styles.reviewBadge}>Ready For Review</span>
        </div>

        <div style={styles.infoGrid}>
          <div style={styles.infoBox}>
            <span>Department</span>
            <strong>{project.department_name || "-"}</strong>
          </div>

          <div style={styles.infoBox}>
            <span>Assigned To</span>
            <strong>{project.assigned_names || "-"}</strong>
            <p>{project.assigned_emails || "-"}</p>
          </div>

          <div style={styles.infoBox}>
            <span>Created By</span>
            <strong>{project.created_by_name || "-"}</strong>
            <p>{project.created_by_email || "-"}</p>
          </div>

          <div style={styles.infoBox}>
            <span>Dates</span>
            <strong>
              {project.start_date || "-"} to {project.due_date || "-"}
            </strong>
          </div>
        </div>

        <div style={styles.progressBlock}>
          <div style={styles.progressTop}>
            <span>Project Progress</span>
            <strong>{project.overall_progress || 0}%</strong>
          </div>

          <div style={styles.progressTrack}>
            <div
              style={{
                ...styles.progressFill,
                width: `${project.overall_progress || 0}%`,
              }}
            />
          </div>

          <p style={styles.taskLine}>
            {project.completed_active_assignees || 0}/{project.active_assignees || 0} active assignees completed.
            Assignees with no subtasks are not counted.
          </p>
        </div>

        <div style={styles.assigneeSection}>
          <h4 style={styles.assigneeTitle}>Assignee Work Details</h4>

          {(project.main_tasks || []).map((task) => (
            <div key={task.task_id} style={styles.assigneeCard}>
              <div style={styles.assigneeTop}>
                <div>
                  <strong>{task.assignee_name || "-"}</strong>
                  <p>{task.assignee_email || "-"}</p>
                </div>

                <span style={styles.assigneeProgress}>
                  {task.completed_subtasks || 0}/{task.total_subtasks || 0} done
                </span>
              </div>

              <div style={styles.mainTaskBox}>
                <span>Main Task</span>
                <strong>{task.task_title || "-"}</strong>
                <p>{task.task_description || "-"}</p>
              </div>

              {renderSubtasks(task)}
            </div>
          ))}
        </div>

        <div style={styles.actionRow}>
          <button
            type="button"
            style={styles.doneBtn}
            disabled={Boolean(actionLoadingId)}
            onClick={() => handleAction(project.project_id, "done")}
          >
            <CheckCircle2 size={17} />
            {actionLoadingId === `${project.project_id}-done`
              ? "Saving..."
              : "Done"}
          </button>

          <button
            type="button"
            style={styles.rejectBtn}
            disabled={Boolean(actionLoadingId)}
            onClick={() => handleAction(project.project_id, "reject")}
          >
            <XCircle size={17} />
            {actionLoadingId === `${project.project_id}-reject`
              ? "Saving..."
              : "Reject"}
          </button>

          <button
            type="button"
            style={styles.holdBtn}
            disabled={Boolean(actionLoadingId)}
            onClick={() => handleAction(project.project_id, "on_hold")}
          >
            <PauseCircle size={17} />
            {actionLoadingId === `${project.project_id}-on_hold`
              ? "Saving..."
              : "On Hold"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.sectionTitle}>
            <AlertCircle size={25} />
            Projects Waiting For Review
          </h2>
          <p style={styles.sectionSub}>
            A project appears here when every assignee who added subtasks has completed them.
            Assignees with zero subtasks do not block the review.
          </p>
        </div>

        <button type="button" style={styles.refreshBtn} onClick={fetchReviewProjects}>
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <div style={styles.emptyBox}>Loading review projects...</div>
      ) : reviewProjects.length === 0 ? (
        <div style={styles.emptyBox}>No projects waiting for review.</div>
      ) : (
        <div style={styles.reviewList}>
          {reviewProjects.map(renderProjectCard)}
        </div>
      )}
    </section>
  );
};

const styles = {
  section: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "24px",
    padding: "28px 32px",
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)",
    marginBottom: "28px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "18px",
    marginBottom: "20px",
  },
  sectionTitle: {
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "#111827",
    fontSize: "28px",
    fontWeight: 900,
  },
  sectionSub: {
    margin: "8px 0 0",
    color: "#667085",
    fontSize: "15px",
    lineHeight: 1.5,
  },
  refreshBtn: {
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#111827",
    borderRadius: "14px",
    padding: "12px 16px",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
  },
  emptyBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: "18px",
    padding: "26px",
    textAlign: "center",
    color: "#64748b",
    fontWeight: 900,
    background: "#f8fafc",
  },
  emptySmall: {
    border: "1px dashed #cbd5e1",
    borderRadius: "14px",
    padding: "14px",
    color: "#64748b",
    fontWeight: 800,
    background: "#ffffff",
  },
  error: {
    background: "#fff1f2",
    color: "#b91c1c",
    border: "1px solid #fecdd3",
    borderRadius: "14px",
    padding: "13px 15px",
    fontWeight: 900,
    marginBottom: "16px",
  },
  reviewList: {
    display: "grid",
    gap: "16px",
  },
  reviewCard: {
    border: "1px solid #ffd0c4",
    borderRadius: "20px",
    padding: "20px",
    background: "#fff7f4",
  },
  reviewTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    marginBottom: "16px",
  },
  cardTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 900,
    color: "#111827",
  },
  cardDesc: {
    margin: "6px 0 0",
    color: "#667085",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  reviewBadge: {
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "8px 13px",
    fontSize: "13px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },
  infoBox: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "15px",
    padding: "13px",
  },
  progressBlock: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "15px",
    padding: "13px",
    marginBottom: "16px",
  },
  progressTop: {
    display: "flex",
    justifyContent: "space-between",
    fontWeight: 900,
    color: "#111827",
    marginBottom: "8px",
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
  },
  taskLine: {
    margin: "8px 0 0",
    color: "#667085",
    fontSize: "13px",
    fontWeight: 800,
  },
  assigneeSection: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "14px",
    marginBottom: "16px",
  },
  assigneeTitle: {
    margin: "0 0 12px",
    color: "#111827",
    fontSize: "17px",
    fontWeight: 900,
  },
  assigneeCard: {
    border: "1px solid #eef2f7",
    borderRadius: "14px",
    padding: "14px",
    marginBottom: "12px",
    background: "#f8fafc",
  },
  assigneeTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "12px",
  },
  assigneeProgress: {
    background: "#eef2ff",
    color: "#374151",
    borderRadius: "999px",
    padding: "7px 11px",
    height: "fit-content",
    fontSize: "12px",
    fontWeight: 900,
  },
  mainTaskBox: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "13px",
    padding: "12px",
    marginBottom: "12px",
  },
  subtaskList: {
    display: "grid",
    gap: "10px",
  },
  subtaskItem: {
    border: "1px solid #e5e7eb",
    borderRadius: "13px",
    padding: "12px",
    background: "#ffffff",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
  },
  doneMiniBadge: {
    background: "#dcfce7",
    color: "#166534",
    borderRadius: "999px",
    padding: "7px 11px",
    height: "fit-content",
    fontSize: "12px",
    fontWeight: 900,
  },
  pendingMiniBadge: {
    background: "#fee2e2",
    color: "#991b1b",
    borderRadius: "999px",
    padding: "7px 11px",
    height: "fit-content",
    fontSize: "12px",
    fontWeight: 900,
  },
  actionRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  doneBtn: {
    border: "0",
    background: "#16a34a",
    color: "#ffffff",
    borderRadius: "13px",
    padding: "11px 15px",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    cursor: "pointer",
  },
  rejectBtn: {
    border: "0",
    background: "#dc2626",
    color: "#ffffff",
    borderRadius: "13px",
    padding: "11px 15px",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    cursor: "pointer",
  },
  holdBtn: {
    border: "0",
    background: "#111827",
    color: "#ffffff",
    borderRadius: "13px",
    padding: "11px 15px",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    cursor: "pointer",
  },
};

export default AdminReviewPopup;
import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  PauseCircle,
  RefreshCw,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import api from "../../api/axios";

const AdminReviewPopup = () => {
  const [reviewProjects, setReviewProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [expandedProjectId, setExpandedProjectId] = useState(null);
  const [error, setError] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);

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

  const toggleProject = (projectId) => {
    setExpandedProjectId((current) =>
      current === projectId ? null : projectId
    );
  };

  const handleAction = async (projectId, action) => {
    try {
      setActionLoadingId(`${projectId}-${action}`);
      setError("");

      await api.post(`/admin-review/projects/${projectId}/action`, {
        action,
      });

      setExpandedProjectId(null);
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
          <div
            key={subtask.task_id}
            style={styles.subtaskItem}
          >
            <div style={styles.subtaskContent}>
              <strong>{subtask.task_title}</strong>

              <p style={styles.wrapText}>
                {subtask.task_description || "-"}
              </p>

              <span style={styles.subtaskDate}>
                {subtask.start_date || "-"} to{" "}
                {subtask.due_date || "-"}
              </span>
            </div>

            <span
              style={
                isSubtaskDone(subtask)
                  ? styles.doneMiniBadge
                  : styles.pendingMiniBadge
              }
            >
              {isSubtaskDone(subtask)
                ? "Done"
                : "Pending"}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderProjectCard = (project) => {
    return (
      <div
        key={project.project_id}
        style={styles.reviewCard}
      >
        <div style={styles.reviewTop}>
          <div style={styles.reviewProjectInfo}>
            <h3 style={styles.cardTitle}>
              {project.project_title}
            </h3>

            <p style={styles.cardDesc}>
              {project.department_name || "-"}
              {" | "}
              {project.assigned_names || "-"}
            </p>
          </div>

          <button
            type="button"
            style={styles.viewDetailsBtn}
            onClick={() => setSelectedProject(project)}
          >
            View Details
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.sectionTitle}>
            <AlertCircle size={24} />
            Projects Waiting For Review
          </h2>

          <p style={styles.sectionSub}>
            Review completed projects before moving them forward.
          </p>
        </div>

        <button
          style={styles.refreshBtn}
          onClick={fetchReviewProjects}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={styles.emptyBox}>
          Loading projects...
        </div>
      ) : reviewProjects.length === 0 ? (
        <div style={styles.emptyBox}>
          No projects waiting for review.
        </div>
      ) : (
        <>
          <div style={styles.reviewList}>
            {reviewProjects.map(renderProjectCard)}
          </div>

          {selectedProject && (
            <div
              style={styles.modalOverlay}
              onClick={() => setSelectedProject(null)}
            >
              <div
                style={styles.modal}
                onClick={(event) => event.stopPropagation()}
              >
                <div style={styles.modalHeader}>
                  <div style={styles.modalHeadingContent}>
                    <h2 style={styles.modalTitle}>
                      {selectedProject.project_title}
                    </h2>

                    <p style={styles.cardDesc}>
                      {selectedProject.project_description ||
                        "No project description."}
                    </p>
                  </div>

                  <button
                    type="button"
                    style={styles.closeBtn}
                    onClick={() => setSelectedProject(null)}
                  >
                    Close
                  </button>
                </div>

                <div style={styles.infoGrid}>
                  <div style={styles.infoBox}>
                    <span style={styles.infoLabel}>
                      Department
                    </span>

                    <strong style={styles.infoValue}>
                      {selectedProject.department_name || "-"}
                    </strong>
                  </div>

                  <div style={styles.infoBox}>
                    <span style={styles.infoLabel}>
                      Assigned To
                    </span>

                    <strong style={styles.infoValue}>
                      {selectedProject.assigned_names || "-"}
                    </strong>

                    <p style={styles.infoSecondary}>
                      {selectedProject.assigned_emails || "-"}
                    </p>
                  </div>

                  <div style={styles.infoBox}>
                    <span style={styles.infoLabel}>
                      Created By
                    </span>

                    <strong style={styles.infoValue}>
                      {selectedProject.created_by_name || "-"}
                    </strong>

                    <p style={styles.infoSecondary}>
                      {selectedProject.created_by_email || "-"}
                    </p>
                  </div>

                  <div style={styles.infoBox}>
                    <span style={styles.infoLabel}>
                      Dates
                    </span>

                    <strong style={styles.infoValue}>
                      {selectedProject.start_date || "-"} to{" "}
                      {selectedProject.due_date || "-"}
                    </strong>
                  </div>
                </div>

                <div style={styles.progressBlock}>
                  <div style={styles.progressTop}>
                    <span>Project Progress</span>

                    <strong>
                      {selectedProject.overall_progress || 0}%
                    </strong>
                  </div>

                  <div style={styles.progressTrack}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${selectedProject.overall_progress || 0}%`,
                      }}
                    />
                  </div>

                  <p style={styles.taskLine}>
                    {selectedProject.completed_active_assignees || 0}/
                    {selectedProject.active_assignees || 0} active
                    assignees completed.
                  </p>
                </div>

                <div style={styles.assigneeSection}>
                  <h4 style={styles.assigneeTitle}>
                    Assignee Work Details
                  </h4>

                  {(selectedProject.main_tasks || []).map((task) => (
                    <div
                      key={task.task_id}
                      style={styles.assigneeCard}
                    >
                      <div style={styles.assigneeTop}>
                        <div style={styles.assigneeInfo}>
                          <strong style={styles.assigneeName}>
                            {task.assignee_name || "-"}
                          </strong>

                          <p style={styles.assigneeEmail}>
                            {task.assignee_email || "-"}
                          </p>
                        </div>

                        <span style={styles.assigneeProgress}>
                          {task.completed_subtasks || 0}/
                          {task.total_subtasks || 0} done
                        </span>
                      </div>

                      <div style={styles.mainTaskBox}>
                        <span style={styles.mainTaskLabel}>
                          Main Task
                        </span>

                        <strong style={styles.mainTaskTitle}>
                          {task.task_title || "-"}
                        </strong>

                        <p style={styles.wrapText}>
                          {task.task_description || "-"}
                        </p>
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
                    onClick={() =>
                      handleAction(
                        selectedProject.project_id,
                        "done"
                      )
                    }
                  >
                    <CheckCircle2 size={17} />
                    Done
                  </button>

                  <button
                    type="button"
                    style={styles.rejectBtn}
                    disabled={Boolean(actionLoadingId)}
                    onClick={() =>
                      handleAction(
                        selectedProject.project_id,
                        "reject"
                      )
                    }
                  >
                    <XCircle size={17} />
                    Reject
                  </button>

                  <button
                    type="button"
                    style={styles.holdBtn}
                    disabled={Boolean(actionLoadingId)}
                    onClick={() =>
                      handleAction(
                        selectedProject.project_id,
                        "on_hold"
                      )
                    }
                  >
                    <PauseCircle size={17} />
                    On Hold
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
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
    maxHeight: "450px",
    overflowY: "auto",
    paddingRight: "8px",
  },

  reviewCard: {
    border: "1px solid #ffd0c4",
    borderRadius: "20px",
    padding: "20px 24px",
    background: "#fff7f4",
  },

  reviewTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "24px",
    width: "100%",
  },

  reviewProjectInfo: {
    minWidth: 0,
    flex: 1,
  },

  dropdownHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    cursor: "pointer",
  },

  cardTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 900,
    color: "#111827",
    overflowWrap: "anywhere",
  },

  cardDesc: {
    margin: "6px 0 0",
    color: "#667085",
    fontSize: "14px",
    lineHeight: 1.5,
    overflowWrap: "anywhere",
  },

  reviewBadge: {
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "8px 13px",
    fontSize: "13px",
    fontWeight: 900,
    whiteSpace: "nowrap",
    display: "flex",
    alignItems: "center",
    gap: "5px",
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "14px",
    marginTop: "18px",
    marginBottom: "18px",
  },

  infoBox: {
    minWidth: 0,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "15px",
    padding: "15px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    overflow: "hidden",
  },

  infoLabel: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 800,
  },

  infoValue: {
    color: "#111827",
    fontSize: "14px",
    fontWeight: 900,
    lineHeight: 1.35,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },

  infoSecondary: {
    margin: 0,
    color: "#64748b",
    fontSize: "12px",
    lineHeight: 1.35,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },

  progressBlock: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "15px",
    padding: "15px",
    marginBottom: "16px",
  },

  progressTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    fontWeight: 900,
    color: "#111827",
    marginBottom: "10px",
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
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 700,
  },

  assigneeSection: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "16px",
    marginBottom: "16px",
  },

  assigneeTitle: {
    margin: "0 0 14px",
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
    minWidth: 0,
    overflow: "hidden",
  },

  assigneeTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "18px",
    marginBottom: "12px",
  },

  assigneeInfo: {
    minWidth: 0,
    flex: 1,
  },

  assigneeName: {
    display: "block",
    color: "#111827",
    fontSize: "15px",
    fontWeight: 900,
    overflowWrap: "anywhere",
  },

  assigneeEmail: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.4,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },

  assigneeProgress: {
    flexShrink: 0,
    background: "#eef2ff",
    color: "#334155",
    borderRadius: "999px",
    padding: "7px 11px",
    fontSize: "12px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  mainTaskBox: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "13px",
    padding: "13px",
    marginTop: "12px",
    marginBottom: "12px",
    display: "grid",
    gap: "6px",
    minWidth: 0,
  },

  mainTaskLabel: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 800,
  },

  mainTaskTitle: {
    color: "#111827",
    fontSize: "14px",
    fontWeight: 900,
    overflowWrap: "anywhere",
  },

  wrapText: {
    margin: 0,
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.5,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "14px",
    minWidth: 0,
  },

  subtaskContent: {
    minWidth: 0,
    flex: 1,
    display: "grid",
    gap: "5px",
    overflowWrap: "anywhere",
  },

  subtaskDate: {
    color: "#64748b",
    fontSize: "12px",
    lineHeight: 1.4,
  },

  doneMiniBadge: {
    background: "#dcfce7",
    color: "#166534",
    borderRadius: "999px",
    padding: "7px 11px",
    height: "fit-content",
    fontSize: "12px",
    fontWeight: 900,
    flexShrink: 0,
  },

  pendingMiniBadge: {
    background: "#fee2e2",
    color: "#991b1b",
    borderRadius: "999px",
    padding: "7px 11px",
    height: "fit-content",
    fontSize: "12px",
    fontWeight: 900,
    flexShrink: 0,
  },

  actionRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    paddingTop: "2px",
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

  viewDetailsBtn: {
    border: 0,
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "11px 18px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
    flexShrink: 0,
    marginLeft: "auto",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.68)",
    zIndex: 10000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "28px",
    overflow: "hidden",
  },

  modal: {
    width: "min(1100px, 94vw)",
    maxWidth: "1100px",
    maxHeight: "90vh",
    overflowY: "auto",
    overflowX: "hidden",
    background: "#ffffff",
    borderRadius: "24px",
    padding: "28px",
    boxShadow: "0 30px 80px rgba(15, 23, 42, 0.32)",
    boxSizing: "border-box",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "24px",
    marginBottom: "22px",
  },

  modalHeadingContent: {
    minWidth: 0,
    flex: 1,
  },

  modalTitle: {
    margin: 0,
    color: "#111827",
    fontSize: "28px",
    fontWeight: 900,
    overflowWrap: "anywhere",
  },

  closeBtn: {
    border: 0,
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "14px",
    padding: "11px 18px",
    fontWeight: 900,
    cursor: "pointer",
    flexShrink: 0,
  },
};

export default AdminReviewPopup;
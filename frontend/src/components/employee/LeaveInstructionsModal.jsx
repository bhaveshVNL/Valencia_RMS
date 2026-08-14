import { X } from "lucide-react";

const LeaveInstructionsModal = ({
  open,
  onClose,
}) => {
  if (!open) {
    return null;
  }

  return (
    <div
      style={styles.overlay}
      onClick={onClose}
    >
      <div
        style={styles.modal}
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <button
          type="button"
          style={styles.closeBtn}
          onClick={onClose}
        >
          <X size={20} />
        </button>

        <h2 style={styles.title}>
          Leave Instructions
        </h2>

        <p style={styles.subtitle}>
          Please review these rules
          before submitting a leave
          request.
        </p>

        <div style={styles.rules}>
          <div style={styles.rule}>
            <strong>
              Casual Leave
            </strong>

            <span>
              Apply at least 7 days in
              advance.
            </span>
          </div>

          <div style={styles.rule}>
            <strong>
              Privileged Leave
            </strong>

            <span>
              Apply at least 1 day in
              advance and only from the
              available earned balance.
            </span>
          </div>

          <div style={styles.rule}>
            <strong>
              Sick Leave
            </strong>

            <span>
              Apply as soon as possible.
              More than one consecutive
              sick day requires medical
              proof.
            </span>
          </div>

          <div style={styles.rule}>
            <strong>
              Half-Day Leave
            </strong>

            <span>
              Apply at least 1 day in
              advance except in
              emergencies.
            </span>
          </div>

          <div style={styles.rule}>
            <strong>
              Approval
            </strong>

            <span>
              Leave is valid only after
              approval.
            </span>
          </div>

          <div style={styles.rule}>
            <strong>
              Holiday Calendar
            </strong>

            <span>
              Company holidays follow
              the official holiday
              calendar shown on this
              page.
            </span>
          </div>

          <div style={styles.rule}>
            <strong>
              Attendance
            </strong>

            <span>
              Arrival after 11:00 AM is
              Late. Arrival after
              12:00 PM is treated as
              Half Day.
            </span>
          </div>

          <div style={styles.rule}>
            <strong>
              Unapproved Absence
            </strong>

            <span>
              Absence without approval
              may be treated as Loss of
              Pay.
            </span>
          </div>
        </div>

        <button
          type="button"
          style={styles.doneBtn}
          onClick={onClose}
        >
          Got It
        </button>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: "fixed",

    inset: 0,

    background:
      "rgba(15,23,42,0.52)",

    zIndex: 30000,

    display: "flex",

    alignItems: "center",

    justifyContent: "center",

    padding: "20px",
  },

  modal: {
    width:
      "min(580px, 95vw)",

    maxHeight: "88vh",

    overflowY: "auto",

    background: "#ffffff",

    borderRadius: "24px",

    padding: "28px",

    position: "relative",

    boxShadow:
      "0 28px 80px rgba(15,23,42,0.3)",
  },

  closeBtn: {
    position: "absolute",

    right: "20px",

    top: "20px",

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

  title: {
    margin:
      "0 52px 7px 0",

    color: "#111827",

    fontSize: "27px",

    fontWeight: 900,
  },

  subtitle: {
    margin: "0 0 20px",

    color: "#64748b",

    fontSize: "14px",
  },

  rules: {
    display: "grid",

    gap: "10px",
  },

  rule: {
    display: "grid",

    gap: "4px",

    padding: "13px 14px",

    border:
      "1px solid #e2e8f0",

    borderRadius: "14px",

    background: "#f8fafc",

    color: "#475569",

    fontSize: "13px",

    lineHeight: 1.5,
  },

  doneBtn: {
    width: "100%",

    height: "46px",

    marginTop: "18px",

    border: 0,

    borderRadius: "13px",

    background: "#ff5733",

    color: "#ffffff",

    fontWeight: 900,

    cursor: "pointer",
  },
};

export default LeaveInstructionsModal;
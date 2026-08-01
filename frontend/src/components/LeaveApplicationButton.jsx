import { useState } from "react";
import { Mail } from "lucide-react";
import api from "../api/axios";

const LeaveApplicationButton = ({ className = "" }) => {
  const [loading, setLoading] = useState(false);

  const openLeaveApplicationMail = async () => {
    const popup = window.open("", "_blank");

    try {
      setLoading(true);

      const response = await api.get("/auth/leave-mail-info");

      const mailInfo = response.data;

      const to = (mailInfo.to || []).join(",");
      const subject = mailInfo.subject || "LEAVE APPLICATION";
      const body = mailInfo.body || "";

      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
        to
      )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      if (popup) {
        popup.location.href = gmailUrl;
      } else {
        window.location.href = `mailto:${to}?subject=${encodeURIComponent(
          subject
        )}&body=${encodeURIComponent(body)}`;
      }
    } catch (error) {
      if (popup) {
        popup.close();
      }

      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to open leave application email."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className={className || "primary-action-btn"}
      onClick={openLeaveApplicationMail}
      disabled={loading}
    >
      <Mail size={18} />
      {loading ? "Opening Mail..." : "Apply for Leave"}
    </button>
  );
};

export default LeaveApplicationButton;
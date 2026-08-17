import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, LogIn, Mail } from "lucide-react";
import api from "../api/axios";

const getDashboardRoute = (roleName) => {
  if (roleName === "administrator") return "/administrator/overview";
  if (roleName === "superadmin") return "/superadmin/overview";
  if (roleName === "admin") return "/admin/overview";
  if (roleName === "employee") return "/employee/overview";

  return "/login";
};

const LoginPage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setMessage("");

      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      const response = await api.post("/auth/login", {
        email: formData.email.trim(),
        password: formData.password,
      });

      const token = response.data.token;
      const user = response.data.user;

      if (!token || !user) {
        setMessage("Login failed. Token or user data missing.");
        return;
      }

      sessionStorage.setItem("token", token);
      sessionStorage.setItem("user", JSON.stringify(user));

      localStorage.setItem("user", JSON.stringify(user));

      const dashboardRoute = getDashboardRoute(user.role_name);

      if (dashboardRoute === "/login") {
        setMessage("No dashboard found for this user role.");
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");
        localStorage.removeItem("user");
        return;
      }

      navigate(dashboardRoute, { replace: true });
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Invalid email or password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f7fb",
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "430px",
          background: "#ffffff",
          borderRadius: "28px",
          padding: "34px",
          boxShadow: "0 18px 50px rgba(0, 0, 0, 0.08)",
          border: "1px solid #eeeeee",
        }}
      >
        <div style={{ marginBottom: "26px", textAlign: "center" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "22px",
              background: "#ff5733",
              color: "#ffffff",
              display: "grid",
              placeItems: "center",
              margin: "0 auto 16px",
              fontWeight: 900,
              fontSize: "30px",
            }}
          >
            V
          </div>

          <h1
            style={{
              margin: 0,
              color: "#111111",
              fontSize: "30px",
              fontWeight: 900,
            }}
          >
            Valencia RMS
          </h1>

          <p
            style={{
              margin: "8px 0 0",
              color: "#666666",
              fontSize: "15px",
            }}
          >
            Login to access your role-based dashboard.
          </p>
        </div>

        {message && (
          <div
            style={{
              background: "#fff1f0",
              color: "#b42318",
              border: "1px solid #ffd5d0",
              borderRadius: "14px",
              padding: "12px 14px",
              marginBottom: "18px",
              fontSize: "14px",
              fontWeight: 700,
            }}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleLogin}>
  <div style={{ marginBottom: "16px" }}>
    <label
      style={{
        display: "block",
        marginBottom: "8px",
        color: "#333333",
        fontSize: "14px",
        fontWeight: 800,
      }}
    >
      Email
    </label>

    <div
      style={{
        display: "flex",
        alignItems: "center",
        border: "1px solid #e5e5e5",
        borderRadius: "16px",
        padding: "0 14px",
        background: "#ffffff",
        height: "54px",
      }}
    >
      <Mail
        size={18}
        color="#777777"
        style={{ flexShrink: 0 }}
      />

      <input
        type="email"
        name="email"
        value={formData.email}
        onChange={handleChange}
        placeholder="Enter your email"
        required
        autoComplete="email"
        style={{
          flex: 1,
          minWidth: 0,
          border: "0",
          outline: "none",
          padding: "0 12px",
          height: "100%",
          fontSize: "15px",
          fontWeight: 700,
          background: "transparent",
          color: "#111111",
        }}
      />
    </div>
  </div>

  <div style={{ marginBottom: "22px" }}>
    <label
      style={{
        display: "block",
        marginBottom: "8px",
        color: "#333333",
        fontSize: "14px",
        fontWeight: 800,
      }}
    >
      Password
    </label>

    <div
      style={{
        display: "flex",
        alignItems: "center",
        border: "1px solid #e5e5e5",
        borderRadius: "16px",
        padding: "0 10px 0 14px",
        background: "#ffffff",
        height: "54px",
      }}
    >
      <Lock
        size={18}
        color="#777777"
        style={{ flexShrink: 0 }}
      />

      <input
        type={showPassword ? "text" : "password"}
        name="password"
        value={formData.password}
        onChange={handleChange}
        placeholder="Enter your password"
        required
        autoComplete="current-password"
        style={{
          flex: 1,
          minWidth: 0,
          border: "0",
          outline: "none",
          padding: "0 12px",
          height: "100%",
          fontSize: "15px",
          fontWeight: 700,
          background: "transparent",
          color: "#111111",
        }}
      />

      <button
        type="button"
        onClick={() => setShowPassword((previous) => !previous)}
        aria-label={showPassword ? "Hide password" : "Show password"}
        style={{
          width: "38px",
          height: "38px",
          flexShrink: 0,
          border: "0",
          borderRadius: "10px",
          background: "transparent",
          padding: 0,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#777777",
        }}
      >
        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  </div>

  <button
    type="submit"
    disabled={loading}
    style={{
      width: "100%",
      border: "0",
      borderRadius: "16px",
      background: loading ? "#ff9a82" : "#ff5733",
      color: "#ffffff",
      padding: "15px 18px",
      fontSize: "16px",
      fontWeight: 900,
      cursor: loading ? "not-allowed" : "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "10px",
    }}
  >
    <LogIn size={18} />
    {loading ? "Logging in..." : "Login"}
  </button>
</form>
      </div>
    </div>
  );
};

export default LoginPage;
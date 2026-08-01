const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/db");

const authRoutes = require("./routes/authroutes");
const administratorRoutes = require("./routes/administratorroutes");
const adminRoutes = require("./routes/adminroutes");
const adminProjectRoutes = require("./routes/adminprojectroutes");
const administratorProjectRoutes = require("./routes/administratorprojectroutes");
const adminOverviewRoutes = require("./routes/adminoverviewroutes");
const adminProfileRoutes = require("./routes/adminprofileroutes");
const adminTaskRoutes = require("./routes/admintaskroutes");
const adminAttendanceRoutes = require("./routes/adminattendanceroutes");
const employeeOverviewRoutes = require("./routes/employeeoverviewroutes");
const employeeTaskRoutes = require("./routes/employeetaskroutes");
const employeeProfileRoutes = require("./routes/employeeprofileroutes");
const employeeAttendanceRoutes = require("./routes/employeeattendanceroutes");
const app = express();
const superadminRoutes = require("./routes/superadminroutes");
const { startDeadlineEmailJob } = require("./jobs/deadlineemailjob");
const employeeMiniTaskRoutes = require("./routes/employeeminitaskroutes");
const adminMiniTaskRoutes = require("./routes/adminminitaskroutes");
const employeeProjectRoutes = require("./routes/employeeprojectroutes");
const adminReviewRoutes = require("./routes/adminreviewroutes");

const allowedOrigins = String(process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin is not allowed by CORS"));
    },
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Valencia RMS Backend is running",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "valencia-rms-backend",
  });
});

app.get("/api/db-test", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT DATABASE() AS database_name");

    res.json({
      success: true,
      database: rows[0].database_name,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/administrator", administratorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin-projects", adminProjectRoutes);
app.use("/api/administrator-projects", administratorProjectRoutes);
app.use("/api/admin-overview", adminOverviewRoutes);
app.use("/api/admin-profile", adminProfileRoutes);
app.use("/api/admin-tasks", adminTaskRoutes);
app.use("/api/admin-attendance", adminAttendanceRoutes);
app.use("/api/employee-overview", employeeOverviewRoutes);
app.use("/api/employee-tasks", employeeTaskRoutes);
app.use("/api/employee-profile", employeeProfileRoutes);
app.use("/api/employee-attendance", employeeAttendanceRoutes);
app.use("/api/superadmin", superadminRoutes);
app.use("/api/employee-mini-tasks", employeeMiniTaskRoutes);
app.use("/api/admin-mini-tasks", adminMiniTaskRoutes);
app.use("/api/employee-projects", employeeProjectRoutes);
app.use("/api/admin-review", adminReviewRoutes);

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  startDeadlineEmailJob();
});

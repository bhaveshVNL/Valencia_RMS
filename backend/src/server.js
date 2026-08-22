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
const adminLeaveRoutes = require("./routes/adminleaveroutes");
const employeeOverviewRoutes = require("./routes/employeeoverviewroutes");
const employeeTaskRoutes = require("./routes/employeetaskroutes");
const employeeProfileRoutes = require("./routes/employeeprofileroutes");
const employeeAttendanceRoutes = require("./routes/employeeattendanceroutes");
const employeeLeaveRoutes = require("./routes/employeeleaveroutes");
const app = express();

const superadminRoutes = require("./routes/superadminroutes");
const { startDeadlineEmailJob } = require("./jobs/deadlineemailjob");
const employeeMiniTaskRoutes = require("./routes/employeeminitaskroutes");
const adminMiniTaskRoutes = require("./routes/adminminitaskroutes");
const employeeProjectRoutes = require("./routes/employeeprojectroutes");
const adminReviewRoutes = require("./routes/adminreviewroutes");
const calendarRoutes = require("./routes/calendarroutes");
/*
|--------------------------------------------------------------------------
| CORS Configuration
|--------------------------------------------------------------------------
|
| Hostinger FRONTEND_URL example:
|
| FRONTEND_URL=https://valenciabeverages.com,https://www.valenciabeverages.com
|
| Multiple frontend URLs can be separated with commas.
|
*/

const allowedOrigins = String(
  process.env.FRONTEND_URL ||
    "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    /*
     * Requests such as direct browser URL checks, health checks,
     * Postman and server-to-server requests may not include Origin.
     */
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.trim().replace(/\/$/, "");

    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    console.error("Blocked by CORS:", {
      receivedOrigin: normalizedOrigin,
      allowedOrigins,
    });

    return callback(
      new Error(`Origin ${normalizedOrigin} is not allowed by CORS`)
    );
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "Origin",
    "X-Requested-With",
  ],

  exposedHeaders: ["Content-Length"],

  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

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
    const [rows] = await db.query(
      "SELECT DATABASE() AS database_name"
    );

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
app.use(
  "/api/administrator-projects",
  administratorProjectRoutes
);
app.use("/api/admin-overview", adminOverviewRoutes);
app.use("/api/admin-profile", adminProfileRoutes);
app.use("/api/admin-tasks", adminTaskRoutes);
app.use("/api/admin-attendance", adminAttendanceRoutes);
app.use("/api/admin-leaves", adminLeaveRoutes);
app.use("/api/employee-overview", employeeOverviewRoutes);
app.use("/api/employee-tasks", employeeTaskRoutes);
app.use("/api/employee-profile", employeeProfileRoutes);
app.use(
  "/api/employee-attendance",
  employeeAttendanceRoutes
);
app.use(
  "/api/employee-leaves",
  employeeLeaveRoutes
);
app.use("/api/superadmin", superadminRoutes);
app.use(
  "/api/employee-mini-tasks",
  employeeMiniTaskRoutes
);
app.use("/api/admin-mini-tasks", adminMiniTaskRoutes);
app.use("/api/employee-projects", employeeProjectRoutes);
app.use("/api/admin-review", adminReviewRoutes);
app.use("/api/calendar", calendarRoutes);
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log("Allowed frontend origins:", allowedOrigins);

  startDeadlineEmailJob();
});
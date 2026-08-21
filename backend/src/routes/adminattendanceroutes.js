const express = require("express");
const authMiddleware = require("../middleware/authmiddleware");
const { requireRole } = require("../middleware/rolemiddleware");

const {
  getDepartmentAttendance,
} = require("../controllers/adminattendancecontroller");

const router = express.Router();

router.get(
  "/department-attendance",
  authMiddleware,
  requireRole("admin"),
  getDepartmentAttendance
);

router.get(
  "/",
  authMiddleware,
  requireRole("admin"),
  getDepartmentAttendance
);

module.exports = router;

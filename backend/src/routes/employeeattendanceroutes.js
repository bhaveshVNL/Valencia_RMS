const express = require("express");

const authMiddleware = require("../middleware/authmiddleware");
const employeeAttendanceController = require("../controllers/employeeattendancecontroller");

const router = express.Router();

const onlyEmployee = (req, res, next) => {
  const roleName = String(req.user?.role_name || "").toLowerCase();

  if (roleName !== "employee") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Employee only.",
    });
  }

  next();
};

router.get(
  "/",
  authMiddleware,
  onlyEmployee,
  employeeAttendanceController.getEmployeeAttendance
);

router.get(
  "/my",
  authMiddleware,
  onlyEmployee,
  employeeAttendanceController.getEmployeeAttendance
);

module.exports = router;
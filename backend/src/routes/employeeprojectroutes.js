const express = require("express");

const authMiddleware = require("../middleware/authmiddleware");
const { requireRole } = require("../middleware/rolemiddleware");

const {
  getEmployeeProjects,
  getEmployeeProjectSubtasks,
  addEmployeeProjectSubtask,
  updateEmployeeProjectSubtaskStatus,
} = require("../controllers/employeeprojectcontroller");

const router = express.Router();

router.get(
  "/projects",
  authMiddleware,
  requireRole("employee", "administrator", "admin", "superadmin"),
  getEmployeeProjects
);

router.get(
  "/projects/:projectId/subtasks",
  authMiddleware,
  requireRole("employee", "administrator", "admin", "superadmin"),
  getEmployeeProjectSubtasks
);

router.post(
  "/projects/:projectId/subtasks",
  authMiddleware,
  requireRole("employee", "administrator", "admin", "superadmin"),
  addEmployeeProjectSubtask
);

router.patch(
  "/projects/:projectId/subtasks/:subtaskId/status",
  authMiddleware,
  requireRole("employee", "administrator", "admin", "superadmin"),
  updateEmployeeProjectSubtaskStatus
);

module.exports = router;
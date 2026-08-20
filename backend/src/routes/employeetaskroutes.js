const express = require("express");

const authMiddleware = require("../middleware/authmiddleware");
const { requireRole } = require("../middleware/rolemiddleware");

const {
  getEmployeeTasks,
  getEmployeeTaskDetails,
  addEmployeeSubtask,
  markEmployeeSubtaskDone,
  startEmployeeTask,
  pauseEmployeeTask,
  resumeEmployeeTask,
  submitEmployeeTaskForReview,
} = require("../controllers/employeetaskcontroller");

const router = express.Router();

const employeeAccess = [
  authMiddleware,
  requireRole(
    "employee",
    "administrator",
    "admin",
    "superadmin"
  ),
];

/*
========================================================
EMPLOYEE MAIN TASKS
========================================================
*/

// Get all Main Tasks assigned to logged-in employee
router.get(
  "/",
  ...employeeAccess,
  getEmployeeTasks
);

// Existing frontend alias
router.get(
  "/my",
  ...employeeAccess,
  getEmployeeTasks
);

/*
========================================================
SUBTASK STATUS

Keep these BEFORE the dynamic /:taskId routes.
========================================================
*/

// Mark shared Subtask as completed
router.patch(
  "/subtasks/:subtaskId/check",
  ...employeeAccess,
  markEmployeeSubtaskDone
);

// PUT alias because older frontend may try PUT
router.put(
  "/subtasks/:subtaskId/check",
  ...employeeAccess,
  markEmployeeSubtaskDone
);

/*
========================================================
MAIN TASK DETAILS
========================================================
*/

// Get one Main Task + shared Subtasks
router.get(
  "/:taskId",
  ...employeeAccess,
  getEmployeeTaskDetails
);

// Existing frontend alias
router.get(
  "/:taskId/details",
  ...employeeAccess,
  getEmployeeTaskDetails
);

/*
========================================================
ADD SUBTASK

Subtask belongs to MAIN TASK, not directly to Project.
========================================================
*/

router.post(
  "/:taskId/subtasks",
  ...employeeAccess,
  addEmployeeSubtask
);

// Older frontend compatibility
router.post(
  "/tasks/:taskId/subtasks",
  ...employeeAccess,
  addEmployeeSubtask
);

/*
========================================================
TASK TIMER / STATUS ACTIONS
========================================================
*/

// To Do -> In Progress
router.post(
  "/:taskId/start",
  ...employeeAccess,
  startEmployeeTask
);

// Pause employee's timer
router.post(
  "/:taskId/pause",
  ...employeeAccess,
  pauseEmployeeTask
);

// Resume employee's timer
router.post(
  "/:taskId/resume",
  ...employeeAccess,
  resumeEmployeeTask
);

/*
Main Tasks with all Subtasks completed will already
move automatically to Under Review.

This endpoint remains useful for Main Tasks that have
no Subtasks.
*/
router.post(
  "/:taskId/submit-review",
  ...employeeAccess,
  submitEmployeeTaskForReview
);

module.exports = router;
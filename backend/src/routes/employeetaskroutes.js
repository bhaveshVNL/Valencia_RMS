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

router.get(
  "/",
  authMiddleware,
  requireRole("employee"),
  getEmployeeTasks
);

router.get(
  "/my",
  authMiddleware,
  requireRole("employee"),
  getEmployeeTasks
);

/* TASK TIMER ACTIONS */

router.post(
  "/:taskId/start",
  authMiddleware,
  requireRole("employee"),
  startEmployeeTask
);

router.post(
  "/:taskId/pause",
  authMiddleware,
  requireRole("employee"),
  pauseEmployeeTask
);

router.post(
  "/:taskId/resume",
  authMiddleware,
  requireRole("employee"),
  resumeEmployeeTask
);

router.post(
  "/:taskId/submit-review",
  authMiddleware,
  requireRole("employee"),
  submitEmployeeTaskForReview
);

/* SUBTASKS */

router.post(
  "/:taskId/subtasks",
  authMiddleware,
  requireRole("employee"),
  addEmployeeSubtask
);

router.post(
  "/tasks/:taskId/subtasks",
  authMiddleware,
  requireRole("employee"),
  addEmployeeSubtask
);

router.patch(
  "/subtasks/:subtaskId/check",
  authMiddleware,
  requireRole("employee"),
  markEmployeeSubtaskDone
);

router.put(
  "/subtasks/:subtaskId/check",
  authMiddleware,
  requireRole("employee"),
  markEmployeeSubtaskDone
);

/*
Keep generic /:taskId routes AFTER the specific routes.
*/

router.get(
  "/:taskId",
  authMiddleware,
  requireRole("employee"),
  getEmployeeTaskDetails
);

router.get(
  "/:taskId/details",
  authMiddleware,
  requireRole("employee"),
  getEmployeeTaskDetails
);

module.exports = router;
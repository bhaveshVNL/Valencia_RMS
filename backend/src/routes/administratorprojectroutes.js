const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authmiddleware");

const {
  getAdministratorProjects,
  getProjectSubtasks,
  createProjectSubtask,
  updateSubtaskStatus,
  redoRejectedProject,
  cancelRejectedProject,
  resumeHeldProject,
} = require("../controllers/administratorprojectcontroller");

router.get("/projects", authMiddleware, getAdministratorProjects);

router.get(
  "/projects/:projectId/subtasks",
  authMiddleware,
  getProjectSubtasks
);

router.post(
  "/projects/:projectId/subtasks",
  authMiddleware,
  createProjectSubtask
);

router.patch(
  "/projects/:projectId/subtasks/:subtaskId/status",
  authMiddleware,
  updateSubtaskStatus
);

router.post(
  "/projects/:projectId/rejected/redo",
  authMiddleware,
  redoRejectedProject
);

router.post(
  "/projects/:projectId/rejected/cancel",
  authMiddleware,
  cancelRejectedProject
);

router.post(
  "/projects/:projectId/on-hold/resume",
  authMiddleware,
  resumeHeldProject
);

module.exports = router;
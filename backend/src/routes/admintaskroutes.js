const express = require("express");

const authMiddleware = require("../middleware/authmiddleware");
const { requireRole } = require("../middleware/rolemiddleware");

const {
  getDepartmentTasks,
  reviewDepartmentTask,
} = require("../controllers/admintaskcontroller");

const router = express.Router();

const adminOnly = [
  authMiddleware,
  requireRole("admin"),
];

/*
========================================================
DEPARTMENT MAIN TASKS
========================================================
*/

router.get(
  "/department-tasks",
  ...adminOnly,
  getDepartmentTasks
);

router.get(
  "/",
  ...adminOnly,
  getDepartmentTasks
);

/*
========================================================
MAIN TASK REVIEW
========================================================
*/

router.post(
  "/review",
  ...adminOnly,
  reviewDepartmentTask
);

router.post(
  "/:taskId/review",
  ...adminOnly,
  reviewDepartmentTask
);

module.exports = router;
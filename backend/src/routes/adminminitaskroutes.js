const express = require("express");

const authMiddleware = require("../middleware/authmiddleware");
const { requireRole } = require("../middleware/rolemiddleware");

const {
  getDepartmentMiniTasks,
  markMiniTaskReviewed,
} = require("../controllers/minitaskcontroller");

const router = express.Router();

router.get(
  "/department",
  authMiddleware,
  requireRole("admin"),
  getDepartmentMiniTasks
);

router.put(
  "/:miniTaskId/reviewed",
  authMiddleware,
  requireRole("admin"),
  markMiniTaskReviewed
);

module.exports = router;
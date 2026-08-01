const express = require("express");

const authMiddleware = require("../middleware/authmiddleware");
const { requireRole } = require("../middleware/rolemiddleware");

const {
  createEmployeeMiniTask,
  getMyMiniTasks,
} = require("../controllers/minitaskcontroller");

const router = express.Router();

router.get(
  "/my",
  authMiddleware,
  requireRole("employee"),
  getMyMiniTasks
);

router.post(
  "/",
  authMiddleware,
  requireRole("employee"),
  createEmployeeMiniTask
);

module.exports = router;
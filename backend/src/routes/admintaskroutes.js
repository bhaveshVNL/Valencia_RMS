const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authmiddleware");

const {
  getDepartmentTasks,
  reviewDepartmentTask,
} = require("../controllers/admintaskcontroller");

router.get(
  "/department-tasks",
  authMiddleware,
  getDepartmentTasks
);

router.post(
  "/review",
  authMiddleware,
  reviewDepartmentTask
);

module.exports = router;
const express = require("express");

const authMiddleware = require("../middleware/authmiddleware");
const { requireRole } = require("../middleware/rolemiddleware");

const {
  getEmployeeTasks,
  getEmployeeTaskDetails,
  addEmployeeSubtask,
  markEmployeeSubtaskDone,
} = require("../controllers/employeetaskcontroller");

const router = express.Router();

router.get("/", authMiddleware, requireRole("employee"), getEmployeeTasks);
router.get("/my", authMiddleware, requireRole("employee"), getEmployeeTasks);

router.get("/:taskId", authMiddleware, requireRole("employee"), getEmployeeTaskDetails);
router.get("/:taskId/details", authMiddleware, requireRole("employee"), getEmployeeTaskDetails);

router.post("/:taskId/subtasks", authMiddleware, requireRole("employee"), addEmployeeSubtask);
router.post("/tasks/:taskId/subtasks", authMiddleware, requireRole("employee"), addEmployeeSubtask);

router.patch("/subtasks/:subtaskId/check", authMiddleware, requireRole("employee"), markEmployeeSubtaskDone);
router.put("/subtasks/:subtaskId/check", authMiddleware, requireRole("employee"), markEmployeeSubtaskDone);

module.exports = router;
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authmiddleware");

const {
  getDepartmentTasks,
} = require("../controllers/admintaskcontroller");

router.get("/department-tasks", authMiddleware, getDepartmentTasks);

module.exports = router;
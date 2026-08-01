const express = require("express");

const authMiddleware = require("../middleware/authmiddleware");
const { requireRole } = require("../middleware/rolemiddleware");

const {
  getEmployeeOverview,
} = require("../controllers/employeeoverviewcontroller");

const router = express.Router();

router.get("/", authMiddleware, requireRole("employee"), getEmployeeOverview);
router.get("/overview", authMiddleware, requireRole("employee"), getEmployeeOverview);

module.exports = router;
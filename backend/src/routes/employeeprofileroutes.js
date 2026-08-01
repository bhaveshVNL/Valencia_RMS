const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authmiddleware");

const {
  getEmployeeProfile,
  updateEmployeeSkills,
} = require("../controllers/employeeprofilecontroller");

router.get("/me", authMiddleware, getEmployeeProfile);
router.put("/skills", authMiddleware, updateEmployeeSkills);

module.exports = router;
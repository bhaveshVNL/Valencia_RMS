const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authmiddleware");

const {
  getEmployeeProfile,
  updateEmployeeSkills,
  changePassword,
} = require("../controllers/employeeprofilecontroller");


router.get(
  "/me",
  authMiddleware,
  getEmployeeProfile
);


router.put(
  "/skills",
  authMiddleware,
  updateEmployeeSkills
);


router.put(
  "/change-password",
  authMiddleware,
  changePassword
);


module.exports = router;
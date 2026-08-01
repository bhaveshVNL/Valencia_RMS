const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authmiddleware");

const {
  getAdminDepartmentUsers,
  getAdminAssignableUsers,
  createAdminProject,
} = require("../controllers/admincontroller");

router.get("/users", authMiddleware, getAdminDepartmentUsers);

router.get("/assignable-users", authMiddleware, getAdminAssignableUsers);

router.post("/projects", authMiddleware, createAdminProject);

module.exports = router;
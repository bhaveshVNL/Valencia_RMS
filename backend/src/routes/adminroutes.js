const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authmiddleware");

const {
  getAdminDepartmentUsers,
  getAdminAssignableUsers,
  getAdminUserTimeSummary,
} = require("../controllers/admincontroller");


const {
  createAdminProject,
  getAdminProjects,
  exportAdminProjectsCsv,
} = require("../controllers/adminprojectcontroller");
router.get("/users", authMiddleware, getAdminDepartmentUsers);
router.get(
  "/users/:userId/time-summary",
  authMiddleware,
  getAdminUserTimeSummary
);

router.get("/assignable-users", authMiddleware, getAdminAssignableUsers);
router.get(
  "/projects",
  authMiddleware,
  getAdminProjects
);

router.post(
  "/projects",
  authMiddleware,
  createAdminProject
);

router.get(
  "/projects/export",
  authMiddleware,
  exportAdminProjectsCsv
);
module.exports = router;
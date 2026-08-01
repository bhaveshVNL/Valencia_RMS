const express = require("express");

const authMiddleware = require("../middleware/authmiddleware");
const { requireRole } = require("../middleware/rolemiddleware");

const {
  getSuperadminOverview,
  getSuperadminUsers,
  getSuperadminUserDetails,
  getSuperadminTasks,
  getSuperadminProjects,
} = require("../controllers/superadmincontroller");

const router = express.Router();

router.get("/overview", authMiddleware, requireRole("superadmin"), getSuperadminOverview);

router.get("/users", authMiddleware, requireRole("superadmin"), getSuperadminUsers);

router.get(
  "/users/:userId",
  authMiddleware,
  requireRole("superadmin"),
  getSuperadminUserDetails
);

router.get("/tasks", authMiddleware, requireRole("superadmin"), getSuperadminTasks);

router.get("/projects", authMiddleware, requireRole("superadmin"), getSuperadminProjects);

module.exports = router;
const express = require("express");

const authMiddleware = require("../middleware/authmiddleware");
const { requireRole } = require("../middleware/rolemiddleware");

const {
  getReviewProjects,
  reviewProjectAction,
} = require("../controllers/adminreviewcontroller");

const router = express.Router();

router.get(
  "/projects",
  authMiddleware,
  requireRole("admin", "administrator", "superadmin"),
  getReviewProjects
);

router.post(
  "/projects/:projectId/action",
  authMiddleware,
  requireRole("admin", "administrator", "superadmin"),
  reviewProjectAction
);

module.exports = router;
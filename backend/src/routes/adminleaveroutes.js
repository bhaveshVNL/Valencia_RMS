const express = require("express");

const authMiddleware = require(
  "../middleware/authmiddleware"
);

const {
  requireRole,
} = require(
  "../middleware/rolemiddleware"
);

const {
  getAdminLeaveApplications,
  reviewLeaveApplication,
} = require(
  "../controllers/adminleavecontroller"
);

const router = express.Router();

router.get(
  "/",
  authMiddleware,
  requireRole("admin"),
  getAdminLeaveApplications
);

router.get(
  "/applications",
  authMiddleware,
  requireRole("admin"),
  getAdminLeaveApplications
);

router.patch(
  "/:leaveId/status",
  authMiddleware,
  requireRole("admin"),
  reviewLeaveApplication
);

module.exports = router;
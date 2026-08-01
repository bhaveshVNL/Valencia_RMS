const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authmiddleware");

const {
  getAdminOverviewSummary,
  reviewProjectFromOverview,
} = require("../controllers/adminoverviewcontroller");

router.get("/summary", authMiddleware, getAdminOverviewSummary);

router.post(
  "/projects/:projectId/review",
  authMiddleware,
  reviewProjectFromOverview
);

module.exports = router;
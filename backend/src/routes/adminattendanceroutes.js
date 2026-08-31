const express = require("express");
const authMiddleware = require("../middleware/authmiddleware");
const { requireRole } = require("../middleware/rolemiddleware");

const {
  getDepartmentAttendance,
  getDepartmentFieldVisits,
  reviewFieldVisit,
  createAdminFieldVisit,
getAdminFieldVisits,
} = require("../controllers/adminattendancecontroller");

const router = express.Router();

router.get(
  "/field-visits/my",
  authMiddleware,
  requireRole("admin"),
  getAdminFieldVisits
);

router.post(
  "/field-visits",
  authMiddleware,
  requireRole("admin"),
  createAdminFieldVisit
);

router.get(
  "/department-attendance",
  authMiddleware,
  requireRole("admin"),
  getDepartmentAttendance
);

router.get(
  "/",
  authMiddleware,
  requireRole("admin"),
  getDepartmentAttendance
);
/* =========================================================
   FIELD VISITS
========================================================= */

router.get(
  "/field-visits",
  authMiddleware,
  requireRole("admin"),
  getDepartmentFieldVisits
);

router.post(
  "/field-visits/:visitId/review",
  authMiddleware,
  requireRole("admin"),
  reviewFieldVisit
);
module.exports = router;

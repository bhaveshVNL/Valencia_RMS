const express = require("express");

const authMiddleware = require("../middleware/authmiddleware");

const { requireRole } = require("../middleware/rolemiddleware");

const {
  getDepartmentAttendance,
  getDepartmentFieldVisits,
  reviewFieldVisit,
  createAdminFieldVisit,
  getAdminFieldVisits,
  getEmployeesForFieldVisit,
} = require("../controllers/adminattendancecontroller");

const router = express.Router();


/* =========================
   ADMIN OWN FIELD VISITS
========================= */

router.get(
  "/field-visits/my",
  authMiddleware,
  requireRole("admin"),
  getAdminFieldVisits
);


/* =========================
   CREATE FIELD VISIT
========================= */

router.post(
  "/field-visits",
  authMiddleware,
  requireRole("admin"),
  createAdminFieldVisit
);


/* =========================
   DEPARTMENT ATTENDANCE
========================= */

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


/* =========================
   FIELD VISITS REVIEW
========================= */

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


/* =========================
   EMPLOYEE SEARCH LIST
========================= */

router.get(
  "/employees",
  authMiddleware,
  requireRole("admin"),
  getEmployeesForFieldVisit
);


module.exports = router;
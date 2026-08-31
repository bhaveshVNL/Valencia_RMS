const express = require("express");

const authMiddleware =
  require("../middleware/authmiddleware");

const {
  requireRole,
} = require(
  "../middleware/rolemiddleware"
);

const {
  getMeetingEmployees,

  createMeeting,
  updateMeeting,
  cancelMeeting,

  getAdminCalendar,
  getEmployeeCalendar,

  getUpcomingMeetings,
} = require(
  "../controllers/calendarcontroller"
);

const router = express.Router();

/*
========================================================
ADMIN
========================================================
*/

router.get(
  "/admin",
  authMiddleware,
  requireRole("admin"),
  getAdminCalendar
);

router.get(
  "/employees",
  authMiddleware,
  requireRole(
    "admin",
    "employee"
  ),
  getMeetingEmployees
);

router.post(
  "/meetings",
  authMiddleware,
  requireRole(
    "admin",
    "employee"
  ),
  createMeeting
);

router.put(
  "/meetings/:meetingId",
  authMiddleware,
  requireRole("admin"),
  updateMeeting
);

router.patch(
  "/meetings/:meetingId/cancel",
  authMiddleware,
  requireRole("admin"),
  cancelMeeting
);

/*
========================================================
EMPLOYEE
========================================================
*/

router.get(
  "/employee",
  authMiddleware,
  requireRole("employee"),
  getEmployeeCalendar
);

/*
========================================================
UPCOMING MEETINGS
========================================================
*/

router.get(
  "/upcoming",
  authMiddleware,
  requireRole(
    "admin",
    "employee"
  ),
  getUpcomingMeetings
);

module.exports = router;
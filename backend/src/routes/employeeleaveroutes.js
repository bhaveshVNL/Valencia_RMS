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
  getEmployeeLeaveSummary,
  applyEmployeeLeave,
  getEmployeeHolidayCalendar,
  toggleEmployeeOptionalHoliday,
} = require(
  "../controllers/employeeleavecontroller"
);

const router = express.Router();

router.get(
  "/summary",
  authMiddleware,
  requireRole(
    "employee",
    "administrator",
    "admin",
    "superadmin"
  ),
  getEmployeeLeaveSummary
);

router.get(
  "/holidays",
  authMiddleware,
  requireRole(
    "employee",
    "administrator",
    "admin",
    "superadmin"
  ),
  getEmployeeHolidayCalendar
);

router.post(
  "/holidays/toggle",
  authMiddleware,
  requireRole(
    "employee",
    "administrator",
    "admin",
    "superadmin"
  ),
  toggleEmployeeOptionalHoliday
);

router.post(
  "/apply",
  authMiddleware,
  requireRole(
    "employee",
    "administrator",
    "admin",
    "superadmin"
  ),
  applyEmployeeLeave
);

module.exports = router;
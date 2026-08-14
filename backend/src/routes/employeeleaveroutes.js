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

/*
GET LEAVE BALANCE + HISTORY
/api/employee-leaves/summary
*/
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

/*
APPLY FOR LEAVE
/api/employee-leaves/apply
*/
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
module.exports = router;
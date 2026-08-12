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

module.exports = router;
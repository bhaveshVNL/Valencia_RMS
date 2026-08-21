const express = require("express");
const multer = require("multer");

const authMiddleware = require("../middleware/authmiddleware");
const { requireJayAdministrator } = require("../middleware/rolemiddleware");

const {
  getAdministratorOverview,

  getAdministratorMyProjects,
  getAdministratorAllProjects,
  exportAdministratorProjectsCsv,
  importAdministratorProjectsCsv,

  getAdministratorMyTasks,
  getAdministratorAllTasks,
  exportAdministratorTasksCsv,
  importAdministratorTasksCsv,

  getAdministratorReports,
  getAdministratorProfile,
  updateAdministratorSkills,

  getAdministratorUsersMeta,
  getAdministratorUsers,
  createAdministratorUser,
  importAdministratorUsersCsv,
  updateAdministratorUserStatus,
  resetAdministratorUserPassword,
  deleteAdministratorUser,

  getAdministratorAttendance,
  importAdministratorAttendanceCsv,

  updateAdministratorUserRole,
  updateAdministratorUserDetails,

} = require("../controllers/administratorcontroller");


const router = express.Router();


const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});



// =========================
// OVERVIEW
// =========================

router.get(
  "/overview",
  authMiddleware,
  requireJayAdministrator,
  getAdministratorOverview
);



// =========================
// PROJECTS
// =========================

router.get(
  "/projects/my",
  authMiddleware,
  requireJayAdministrator,
  getAdministratorMyProjects
);


router.get(
  "/projects/all",
  authMiddleware,
  requireJayAdministrator,
  getAdministratorAllProjects
);


router.get(
  "/projects/export",
  authMiddleware,
  requireJayAdministrator,
  exportAdministratorProjectsCsv
);


router.post(
  "/projects/import",
  authMiddleware,
  requireJayAdministrator,
  upload.single("file"),
  importAdministratorProjectsCsv
);



// =========================
// TASKS
// =========================

router.get(
  "/tasks/my",
  authMiddleware,
  requireJayAdministrator,
  getAdministratorMyTasks
);


router.get(
  "/tasks/all",
  authMiddleware,
  requireJayAdministrator,
  getAdministratorAllTasks
);


router.get(
  "/tasks/export",
  authMiddleware,
  requireJayAdministrator,
  exportAdministratorTasksCsv
);


router.post(
  "/tasks/import",
  authMiddleware,
  requireJayAdministrator,
  upload.single("file"),
  importAdministratorTasksCsv
);



// =========================
// REPORTS
// =========================

router.get(
  "/reports",
  authMiddleware,
  requireJayAdministrator,
  getAdministratorReports
);



// =========================
// PROFILE
// =========================

router.get(
  "/profile",
  authMiddleware,
  requireJayAdministrator,
  getAdministratorProfile
);


router.put(
  "/profile/skills",
  authMiddleware,
  requireJayAdministrator,
  updateAdministratorSkills
);



// =========================
// USERS
// =========================

router.get(
  "/users/meta",
  authMiddleware,
  requireJayAdministrator,
  getAdministratorUsersMeta
);


router.get(
  "/users",
  authMiddleware,
  requireJayAdministrator,
  getAdministratorUsers
);


router.post(
  "/users",
  authMiddleware,
  requireJayAdministrator,
  createAdministratorUser
);


router.post(
  "/users/import",
  authMiddleware,
  requireJayAdministrator,
  upload.single("file"),
  importAdministratorUsersCsv
);


router.put(
  "/users/:userId/status",
  authMiddleware,
  requireJayAdministrator,
  updateAdministratorUserStatus
);


router.put(
  "/users/:userId/reset-password",
  authMiddleware,
  requireJayAdministrator,
  resetAdministratorUserPassword
);


router.delete(
  "/users/:userId",
  authMiddleware,
  requireJayAdministrator,
  deleteAdministratorUser
);


router.put(
  "/users/:userId/role",
  authMiddleware,
  requireJayAdministrator,
  updateAdministratorUserRole
);


router.put(
  "/users/:userId/details",
  authMiddleware,
  requireJayAdministrator,
  updateAdministratorUserDetails
);



// =========================
// ATTENDANCE
// =========================

router.get(
  "/attendance",
  authMiddleware,
  requireJayAdministrator,
  getAdministratorAttendance
);


router.post(
  "/attendance/import",
  authMiddleware,
  requireJayAdministrator,
  upload.single("file"),
  importAdministratorAttendanceCsv
);



module.exports = router;
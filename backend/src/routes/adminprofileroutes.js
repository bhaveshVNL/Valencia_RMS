const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authmiddleware");

const {
  getAdminProfile,
  changeAdminPassword,
} = require("../controllers/adminprofilecontroller");

router.get(
  "/me",
  authMiddleware,
  getAdminProfile
);
router.put(
  "/change-password",
  authMiddleware,
  changeAdminPassword
);
module.exports = router;
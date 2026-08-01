const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authmiddleware");

const {
  getAdminProfile,
} = require("../controllers/adminprofilecontroller");

router.get("/me", authMiddleware, getAdminProfile);

module.exports = router;
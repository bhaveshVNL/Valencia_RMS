const express = require("express");

const {
  login,
  getMe,
  getLeaveMailInfo,
} = require("../controllers/authcontroller");

const authMiddleware = require("../middleware/authmiddleware");

const router = express.Router();

router.post("/login", login);
router.get("/me", authMiddleware, getMe);
router.get("/leave-mail-info", authMiddleware, getLeaveMailInfo);

module.exports = router;
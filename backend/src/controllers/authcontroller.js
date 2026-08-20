const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const FIXED_LEAVE_RECIPIENTS = [
  "premal.mehta@valencianutrition.com",
  "rathika.haleangadi@valencianutrition.com",
];

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Server authentication is not configured.",
      });
    }

    const [rows] = await db.query(
      `
      SELECT
        u.user_id,
        u.department_id,
        u.role_id,
        u.employee_code,
        u.full_name,
        u.email,
        u.password_hash,
        u.phone,
        u.designation,
        u.status,
        u.force_password_change,
        r.role_name,
        d.department_name
      FROM users u
      JOIN roles r ON r.role_id = u.role_id
      LEFT JOIN departments d ON d.department_id = u.department_id
      WHERE LOWER(u.email) = LOWER(?)
      LIMIT 1
      `,
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const user = rows[0];

    if (user.status === "blocked") {
      return res.status(403).json({
        success: false,
        message: "Your account is blocked. Please contact administrator.",
      });
    }

    if (user.status === "deleted") {
      return res.status(403).json({
        success: false,
        message: "Your account has been deleted.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const token = jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        role_name: user.role_name,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    delete user.password_hash;

    return res.json({
      success: true,
      message: "Login successful.",
      token,
      user,
    });
  }catch (error) {
  console.error("LOGIN ERROR:", error);

  return res.status(500).json({
    message: "Login failed",
    error: error.message,
  });
}
};

const getMe = async (req, res) => {
  return res.json({
    success: true,
    user: req.user,
  });
};

const getLeaveMailInfo = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [userRows] = await db.query(
      `
      SELECT
        u.user_id,
        u.full_name,
        u.email,
        u.employee_code,
        u.designation,
        u.department_id,
        d.department_name,
        r.role_name
      FROM users u
      JOIN roles r ON r.role_id = u.role_id
      LEFT JOIN departments d ON d.department_id = u.department_id
      WHERE u.user_id = ?
      LIMIT 1
      `,
      [userId]
    );

    if (!userRows.length) {
      return res.status(404).json({
        success: false,
        message: "Logged-in user not found.",
      });
    }

    const user = userRows[0];
    const finalRecipients = [
  ...FIXED_LEAVE_RECIPIENTS,
];

    const subject = "LEAVE APPLICATION";

    const body = `Dear Sir/Madam,

I would like to apply for leave.

Employee Name: ${user.full_name || ""}
Employee Code: ${user.employee_code || ""}
Department: ${user.department_name || ""}
Designation: ${user.designation || ""}
From Email: ${user.email || ""}

Leave Details:
`;

    return res.json({
      success: true,
      from_email: user.email,
      from_name: user.full_name,
      department_name: user.department_name,
      to: finalRecipients,
      subject,
      body,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to prepare leave application email.",
      error: error.message,
    });
  }
};

module.exports = {
  login,
  getMe,
  getLeaveMailInfo,
};

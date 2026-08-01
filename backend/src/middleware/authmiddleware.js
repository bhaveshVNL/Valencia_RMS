const jwt = require("jsonwebtoken");
const db = require("../config/db");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing.",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [users] = await db.query(
      `
      SELECT 
        u.user_id,
        u.employee_code,
        u.full_name,
        u.email,
        u.status,
        u.designation,
        u.department_id,
        d.department_name,
        r.role_id,
        r.role_name
      FROM users u
      JOIN roles r ON r.role_id = u.role_id
      LEFT JOIN departments d ON d.department_id = u.department_id
      WHERE u.user_id = ?
      LIMIT 1
      `,
      [decoded.user_id]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "User not found.",
      });
    }

    const user = users[0];

    if (user.status === "blocked") {
      return res.status(403).json({
        success: false,
        message: "This user is blocked.",
      });
    }

    if (user.status === "deleted") {
      return res.status(403).json({
        success: false,
        message: "This user is deleted.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
      error: error.message,
    });
  }
};

module.exports = authMiddleware;
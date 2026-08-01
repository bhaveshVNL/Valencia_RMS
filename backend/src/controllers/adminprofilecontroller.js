const db = require("../config/db");

const getAdminProfile = async (req, res) => {
  try {
    const loggedInUserId =
      req.user?.user_id || req.user?.id || req.user?.userId || req.user?.uid;

    if (!loggedInUserId) {
      return res.status(401).json({
        message: "Unauthorized. User not found in token.",
      });
    }

    const [rows] = await db.query(
      `
      SELECT 
        u.user_id,
        u.employee_code,
        u.full_name,
        u.email,
        u.designation,
        u.department_id,
        r.role_name,
        d.department_name
      FROM users u
      LEFT JOIN roles r 
        ON u.role_id = r.role_id
      LEFT JOIN departments d 
        ON u.department_id = d.department_id
      WHERE u.user_id = ?
      LIMIT 1
      `,
      [loggedInUserId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        message: "Admin profile not found.",
      });
    }

    const admin = rows[0];

    const roleName = String(admin.role_name || "").toLowerCase().trim();

    if (roleName !== "admin") {
      return res.status(403).json({
        message: "Access denied. Admin role required.",
      });
    }

    return res.status(200).json({
      admin: {
        user_id: admin.user_id,
        employee_code: admin.employee_code,
        full_name: admin.full_name,
        email: admin.email,
        department_id: admin.department_id,
        department_name: admin.department_name,
        designation: admin.designation,
        role_name: admin.role_name,
      },
    });
  } catch (error) {
    console.error("Get admin profile error:", error);

    return res.status(500).json({
      message: "Failed to fetch admin profile.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};

module.exports = {
  getAdminProfile,
};
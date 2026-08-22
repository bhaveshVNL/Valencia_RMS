const db = require("../config/db");
const bcrypt = require("bcryptjs");
const changeAdminPassword = async (req,res)=>{
  try {

    const userId =
      req.user?.user_id ||
      req.user?.id ||
      req.user?.userId;


    if (!userId) {
      return res.status(401).json({
        message:"Unauthorized"
      });
    }


    const {
      oldPassword,
      newPassword
    } = req.body;


    if(!oldPassword || !newPassword){

      return res.status(400).json({
        message:
        "Old and new password are required"
      });

    }


    const [users] = await db.query(
      `
      SELECT password_hash
      FROM users
      WHERE user_id = ?
      `,
      [userId]
    );


    if(!users.length){

      return res.status(404).json({
        message:"User not found"
      });

    }


    const match =
      await bcrypt.compare(
        oldPassword,
        users[0].password_hash
      );


    if(!match){

      return res.status(400).json({
        message:
        "Current password incorrect"
      });

    }


    const hashedPassword =
      await bcrypt.hash(
        newPassword,
        10
      );


    await db.query(
      `
      UPDATE users
      SET password_hash = ?,
          force_password_change = 0
      WHERE user_id = ?
      `,
      [
        hashedPassword,
        userId
      ]
    );


    res.json({
      message:
      "Password changed successfully"
    });


  } catch(error){

    console.error(
      "Administrator password change:",
      error
    );


    res.status(500).json({
      message:"Server error"
    });

  }

};
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
  changeAdminPassword,
};
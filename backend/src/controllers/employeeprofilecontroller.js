const db = require("../config/db");

const ensureEmployeeSkillsTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS employee_skills (
      skill_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      skill_name VARCHAR(120) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_employee_skills_user_id (user_id)
    )
  `);
};

const getLoggedInEmployee = async (req) => {
  const loggedInUserId =
    req.user?.user_id || req.user?.id || req.user?.userId || req.user?.uid;

  if (!loggedInUserId) {
    return {
      error: {
        status: 401,
        message: "Unauthorized. User not found in token.",
      },
    };
  }

  const [rows] = await db.query(
    `
    SELECT 
      u.user_id,
      u.employee_code,
      u.full_name,
      u.email,
      u.phone,
      u.designation,
      u.department_id,
      u.role_id,
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
    return {
      error: {
        status: 404,
        message: "Employee not found.",
      },
    };
  }

  const employee = rows[0];
  const roleName = String(employee.role_name || "").toLowerCase().trim();

  if (roleName !== "employee") {
    return {
      error: {
        status: 403,
        message: "Only employees can access employee profile.",
      },
    };
  }

  return { employee };
};

const normalizeSkills = (skillsInput) => {
  if (Array.isArray(skillsInput)) {
    return skillsInput
      .map((skill) => String(skill || "").trim())
      .filter(Boolean);
  }

  return String(skillsInput || "")
    .split(/[\n,]/)
    .map((skill) => skill.trim())
    .filter(Boolean);
};

const removeDuplicateSkills = (skills) => {
  const seen = new Set();
  const uniqueSkills = [];

  skills.forEach((skill) => {
    const key = skill.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      uniqueSkills.push(skill);
    }
  });

  return uniqueSkills;
};

const getEmployeeProfile = async (req, res) => {
  try {
    await ensureEmployeeSkillsTable();

    const { employee, error } = await getLoggedInEmployee(req);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const [skills] = await db.query(
      `
      SELECT 
        skill_id,
        skill_name
      FROM employee_skills
      WHERE user_id = ?
      ORDER BY skill_name ASC
      `,
      [employee.user_id]
    );

    return res.status(200).json({
      profile: {
        user_id: employee.user_id,
        employee_code: employee.employee_code,
        full_name: employee.full_name,
        email: employee.email,
        department_name: employee.department_name,
        designation: employee.designation,
        role_name: employee.role_name,
      },
      skills,
    });
  } catch (error) {
    console.error("Get employee profile error:", error);

    return res.status(500).json({
      message: "Failed to fetch employee profile.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};

const updateEmployeeSkills = async (req, res) => {
  try {
    await ensureEmployeeSkillsTable();

    const { employee, error } = await getLoggedInEmployee(req);

    if (error) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    const rawSkills = normalizeSkills(req.body?.skills);
    const skills = removeDuplicateSkills(rawSkills).slice(0, 30);

    await db.query(
      `
      DELETE FROM employee_skills
      WHERE user_id = ?
      `,
      [employee.user_id]
    );

    if (skills.length > 0) {
      const placeholders = skills.map(() => "(?, ?)").join(", ");
      const values = [];

      skills.forEach((skill) => {
        values.push(employee.user_id, skill);
      });

      await db.query(
        `
        INSERT INTO employee_skills
        (user_id, skill_name)
        VALUES ${placeholders}
        `,
        values
      );
    }

    const [updatedSkills] = await db.query(
      `
      SELECT 
        skill_id,
        skill_name
      FROM employee_skills
      WHERE user_id = ?
      ORDER BY skill_name ASC
      `,
      [employee.user_id]
    );

    return res.status(200).json({
      message: "Skills updated successfully.",
      skills: updatedSkills,
    });
  } catch (error) {
    console.error("Update employee skills error:", error);

    return res.status(500).json({
      message: "Failed to update skills.",
      error: error.message,
      sqlMessage: error.sqlMessage || null,
    });
  }
};
const bcrypt = require("bcryptjs");

const changePassword = async (req, res) => {
    try {
    const userId = req.user.user_id;

    const {
      oldPassword,
      newPassword,
    } = req.body;


    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        message: "Old and new password are required",
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


    if (!users.length) {
      return res.status(404).json({
        message: "User not found",
      });
    }


    const isMatch = await bcrypt.compare(
      oldPassword,
      users[0].password_hash
    );


    if (!isMatch) {
      return res.status(400).json({
        message: "Current password is incorrect",
      });
    }


    const hashedPassword =
      await bcrypt.hash(newPassword, 10);


    await db.query(
      `
      UPDATE users
      SET password_hash = ?,
          force_password_change = 0
      WHERE user_id = ?
      `,
      [
        hashedPassword,
        userId,
      ]
    );


    res.json({
      message:
        "Password changed successfully",
    });


  } catch(error){

    console.error(
      "Change password error:",
      error
    );

    res.status(500).json({
      message:"Server error"
    });

  }
};
module.exports = {
  getEmployeeProfile,
  updateEmployeeSkills,
  changePassword,
};
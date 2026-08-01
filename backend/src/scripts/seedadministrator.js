const bcrypt = require("bcryptjs");
const db = require("../config/db");

const seedAdministrator = async () => {
  try {
    const defaultPassword = "Valencia@123";
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    await db.query(`
      INSERT IGNORE INTO roles (role_name) VALUES
      ('employee'),
      ('admin'),
      ('superadmin'),
      ('administrator');
    `);

    await db.query(`
      INSERT IGNORE INTO departments (department_name, description)
      VALUES ('Administration', 'Administrator Department');
    `);

    const [roleRows] = await db.query(
      `SELECT role_id FROM roles WHERE role_name = 'administrator' LIMIT 1`
    );

    const [departmentRows] = await db.query(
      `SELECT department_id FROM departments WHERE department_name = 'Administration' LIMIT 1`
    );

    const administratorRoleId = roleRows[0].role_id;
    const administrationDepartmentId = departmentRows[0].department_id;

    await db.query(
      `
      INSERT INTO users (
        department_id,
        role_id,
        employee_code,
        full_name,
        email,
        password_hash,
        phone,
        designation,
        status,
        force_password_change
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', false)
      ON DUPLICATE KEY UPDATE
        department_id = VALUES(department_id),
        role_id = VALUES(role_id),
        full_name = VALUES(full_name),
        password_hash = VALUES(password_hash),
        designation = VALUES(designation),
        status = 'active';
      `,
      [
        administrationDepartmentId,
        administratorRoleId,
        "ADMIN-JAY-001",
        "Jay More",
        "jay.more@valencianutrition.com",
        passwordHash,
        null,
        "Administrator",
      ]
    );

    console.log("Jay More administrator account created successfully.");
    console.log("Email: jay.more@valencianutrition.com");
    console.log("Password: Valencia@123");

    process.exit(0);
  } catch (error) {
    console.error("Administrator seeding failed:", error.message);
    process.exit(1);
  }
};

seedAdministrator();
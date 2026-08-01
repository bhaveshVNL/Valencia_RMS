const db = require("../config/db");

const createAttendanceTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        attendance_id INT AUTO_INCREMENT PRIMARY KEY,

        employee_id INT NOT NULL,
        attendance_date DATE NOT NULL,

        check_in_time TIME NULL,
        check_out_time TIME NULL,

        total_minutes INT DEFAULT 0,

        status ENUM('present', 'absent', 'half_day', 'leave', 'holiday') DEFAULT 'present',

        remarks TEXT,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        FOREIGN KEY (employee_id) REFERENCES users(user_id),

        UNIQUE(employee_id, attendance_date)
      );
    `);

    console.log("Attendance table created successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Attendance table creation failed:", error.message);
    process.exit(1);
  }
};

createAttendanceTable();
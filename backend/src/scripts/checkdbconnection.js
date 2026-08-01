const db = require("../config/db");

const checkDatabaseConnection = async () => {
  try {
    const [rows] = await db.query(
      "SELECT DATABASE() AS database_name, VERSION() AS mysql_version"
    );

    console.log("Database connection successful.");
    console.log(`Database: ${rows[0].database_name}`);
    console.log(`MySQL: ${rows[0].mysql_version}`);
    process.exitCode = 0;
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
};

checkDatabaseConnection();

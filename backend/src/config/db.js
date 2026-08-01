const mysql = require("mysql2/promise");
require("dotenv").config();

const useSsl = String(process.env.DB_SSL || "false") === "true";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  charset: "utf8mb4",
  ssl: useSsl
    ? {
        rejectUnauthorized:
          String(process.env.DB_SSL_REJECT_UNAUTHORIZED || "true") === "true",
      }
    : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;

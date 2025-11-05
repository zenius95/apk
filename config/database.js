// Load bien moi truong tu file .env
require('dotenv').config();

const { Sequelize } = require('sequelize');

// Kiem tra xem may bien quan trong da set chua
if (!process.env.DB_NAME || !process.env.DB_USER || !process.env.DB_HOST) {
  console.error("❌ ERRO: Thieu cac bien moi truong DB_NAME, DB_USER, DB_PASS hoac DB_HOST trong file .env");
  process.exit(1);
}

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false, // Tat log SQL query cho do roi console
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

module.exports = sequelize;
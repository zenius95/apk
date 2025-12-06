const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WpPostLog = sequelize.define('WpPostLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  appId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'ID cua App da dang'
  },
  wpSiteId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'ID cua Site Wordpress'
  },
  wpPostId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID bai viet tren WP (de tham chieu nguoc)'
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'SUCCESS'
  },
  // +++ MOI: Luu lai noi dung AI da viet de review +++
  aiContent: {
    type: DataTypes.TEXT('long'), // Dung long text cho thoai mai
    allowNull: true,
    comment: 'Noi dung bai viet do AI tao ra'
  }
}, {
  tableName: 'wp_post_logs',
  timestamps: true,
  charset: 'utf8mb4', // [FIX] Quan trong: Cho phep luu emoji
  collate: 'utf8mb4_unicode_ci', 
  indexes: [
    {
      unique: true,
      fields: ['appId', 'wpSiteId'] 
    }
  ]
});

module.exports = WpPostLog;
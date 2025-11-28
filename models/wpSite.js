const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WpSite = sequelize.define('WpSite', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  siteName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Ten de nhan biet site (vd: Blog Chinh)'
  },
  siteUrl: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // +++ MOI: Khong cho phep trung URL +++
    validate: {
      isUrl: true
    },
    comment: 'URL day du cua site Wordpress (vd: https://blog.example.com)'
  },
  apiKey: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'API Key de ket noi (vd: mot chuoi bi mat)'
  },
  aiPrompt: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Prompt mau de tao noi dung AI cho site nay'
  }
}, {
  tableName: 'wp_sites',
  timestamps: true 
});

module.exports = WpSite;
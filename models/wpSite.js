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
    unique: true,
    comment: 'URL day du cua site Wordpress (vd: https://blog.example.com)'
  },
  apiKey: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'API Key de ket noi (vd: mot chuoi bi mat)'
  },
  // --- Prompt Title ---
  aiPromptTitle: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Prompt de tao Tieu de bai viet'
  },
  // --- Prompt Excerpt ---
  aiPromptExcerpt: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Prompt de tao Excerpt/Summary'
  },
  // --- Prompt Content (Main) ---
  aiPrompt: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Prompt mau de tao noi dung chinh'
  },
  // --- MOI: Prompt Footer (Them vao cuoi) ---
  aiPromptFooter: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Prompt de tao noi dung them vao cuoi bai (vd: Loi ket, CTA)'
  }
}, {
  tableName: 'wp_sites',
  timestamps: true 
});

module.exports = WpSite;
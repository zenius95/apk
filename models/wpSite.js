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
  // --- Prompt Footer ---
  aiPromptFooter: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Prompt de tao noi dung them vao cuoi bai (vd: Loi ket, CTA)'
  },
  // --- ALT Text cho Gallery ---
  galleryAlt: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Alt text mac dinh cho anh Gallery (ho tro Spintax dang nhieu dong)'
  },
  // --- ALT Text cho Featured Image ---
  featuredImageAlt: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Alt text mac dinh cho anh dai dien (Featured Image)'
  },
  // --- Download Link Template ---
  downloadLink: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Mau nut download (ho tro shortcode {url}, {version}, {size}...)'
  },
  // --- Thoi gian cho Download ---
  downloadWaitTime: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Thoi gian cho (giay) truoc khi tai. 0 la tat.'
  },
  // +++ MOI: Che do hien thi Screenshot (gallery / normal) +++
  screenshotMode: {
    type: DataTypes.STRING(20),
    defaultValue: 'gallery',
    comment: 'Che do hien thi anh: gallery (mac dinh) hoac normal (anh don)'
  }
}, {
  tableName: 'wp_sites',
  timestamps: true 
});

module.exports = WpSite;
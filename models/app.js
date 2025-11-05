const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Import ket noi database da cau hinh

// Dinh nghia model 'App'
// Sequelize se tu dong tao bang ten la 'Apps' (so nhieu)
const App = sequelize.define('App', {
  appId: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
    unique: true,
    comment: 'Package ID cua app (vd: com.google.android.gm)'
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Ten app de hien thi, query cho nhanh'
  },
  fullData: {
    type: DataTypes.JSON, // Kieu du lieu JSON
    allowNull: true,
    comment: 'Luu tru toan bo JSON data goc tu google-play-scraper'
  },
  lastScrapedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  // Cac tuy chon them cho model
  tableName: 'apps', // Ten bang trong DB
  timestamps: true, // Tu dong them createdAt
  updatedAt: 'lastScrapedAt' // Su dung lastScrapedAt thay cho updatedAt
});

module.exports = App;
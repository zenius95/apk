const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

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
  appType: {
    type: DataTypes.STRING(20), // GAME hoac APP
    allowNull: true
  },
  fullData: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Luu tru toan bo JSON data goc tu google-play-scraper'
  },
  lastScrapedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
  // Khong can them cot deletedAt, paranoid se tu lo
}, {
  tableName: 'apps',
  timestamps: true,
  updatedAt: 'lastScrapedAt',
  
  // +++ MOI: THEM THUNG RAC (SOFT DELETE) +++
  paranoid: true 
});

module.exports = App;
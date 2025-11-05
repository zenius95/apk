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
  // +++ (MOI) THEM COT "LOAI" +++
  appType: {
    type: DataTypes.STRING(20), // GAME hoac APP
    allowNull: true
  },
  // +++ HET MOI +++
  fullData: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Luu tru toan bo JSON data goc tu google-play-scraper'
  },
  lastScrapedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'apps',
  timestamps: true,
  updatedAt: 'lastScrapedAt'
});

module.exports = App;
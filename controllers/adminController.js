const App = require('../models/app'); // Goi Model App
const { default: gplay } = require('google-play-scraper'); // Goi thu vien gplay

/**
 * Controller nay chi de render (hien thi) cac trang admin
 */

// Hien thi trang Scrape chinh
const renderScrapePage = async (req, res) => {
  try {
    // 1. LAY TAT CA APP DA LUU TU DB
    const savedApps = await App.findAll({
      order: [['lastScrapedAt', 'DESC']] // Sap xep theo ngay moi nhat
    });

    // 2. LAY DANH SACH CATEGORY & COLLECTION TU THU VIEN
    const categories = gplay.category;
    const collections = gplay.collection;

    // Render file views/pages/scrape.ejs
    res.render('pages/scrape', {
      data: {
        title: 'Bảng điều khiển - Lấy dữ liệu App'
      },
      savedApps: savedApps,
      categories: categories,     // +++ Truyen categories vao view
      collections: collections    // +++ Truyen collections vao view
    });
  } catch (err) {
    console.error("Loi render trang scrape:", err);
    res.status(500).send("Loi server roi Bro oi.");
  }
};

module.exports = {
  renderScrapePage
};
const App = require('../models/app'); // Goi Model App
const { default: gplay } = require('google-play-scraper'); // Goi thu vien gplay
const { Op } = require('sequelize'); // +++ THEM Op DE TIM KIEM

/**
 * Controller nay chi de render (hien thi) cac trang admin
 */

// Hien thi trang Scrape chinh
const renderScrapePage = async (req, res) => {
  try {
    // +++ CAU HINH PHAN TRANG VA TIM KIEM +++
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 15; // 15 app moi trang
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let whereClause = {};
    if (search) {
      whereClause = {
        [Op.or]: [
          { appId: { [Op.like]: `%${search}%` } },
          { title: { [Op.like]: `%${search}%` } }
        ]
      };
    }

    // 1. LAY APP (CO PHAN TRANG/TIM KIEM) TU DB
    // Su dung findAndCountAll de lay ca 'count' (tong so) va 'rows' (du lieu trang)
    const { count, rows: savedApps } = await App.findAndCountAll({
      where: whereClause,
      order: [['lastScrapedAt', 'DESC']], // Sap xep theo ngay moi nhat
      limit: limit,
      offset: offset
    });

    // 2. LAY DANH SACH CATEGORY & COLLECTION TU THU VIEN
    const categories = gplay.category;
    const collections = gplay.collection;
    
    // 3. TINH TOAN THONG TIN PHAN TRANG
    const totalPages = Math.ceil(count / limit);
    const pagination = {
      totalItems: count,
      totalPages: totalPages,
      currentPage: page,
      limit: limit
    };

    // Render file views/pages/scrape.ejs
    res.render('pages/scrape', {
      data: {
        title: 'Bảng điều khiển - Lấy dữ liệu App'
      },
      savedApps: savedApps,       // +++ Danh sach app cua trang hien tai
      categories: categories,     
      collections: collections,   
      pagination: pagination,     // +++ Truyen thong tin phan trang
      search: search              // +++ Truyen lai tu khoa tim kiem
    });
  } catch (err) {
    console.error("Loi render trang scrape:", err);
    res.status(500).send("Loi server roi Bro oi.");
  }
};

module.exports = {
  renderScrapePage
};
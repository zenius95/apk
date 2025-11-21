const App = require('../models/app');
const WpSite = require('../models/wpSite'); // +++ MOI: Import model WpSite
const { default: gplay } = require('google-play-scraper');
const { Op } = require('sequelize');
const fs = require('fs-extra'); 
const path = require('path'); 

/**
 * (MOI) Ham helper de xoa thu muc anh cua app
 */
async function deleteAppImages(appId) {
  // Duong dan giong het luc scraperService luu vao
  const imgDir = path.join(__dirname, '..', 'public', 'images', 'apps', appId);
  try {
    await fs.remove(imgDir);
    console.log(`[Image Delete] ✅ Da xoa thu muc: ${imgDir}`);
  } catch (err) {
    // Neu loi cung khong can lam gi lon, chi log lai
    console.error(`[Image Delete] ❌ Loi khi xoa ${imgDir}: ${err.message}`);
  }
}

/**
 * (MOI) Ham helper de lay data, tranh lap code
 */
async function getPagedApps(req, isTrashView = false) {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 20; // Tang len 20 cho "sướng"
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

    const queryOptions = {
        where: whereClause,
        limit: limit,
        offset: offset
    };

    if (isTrashView) {
        whereClause.deletedAt = { [Op.not]: null };
        queryOptions.paranoid = false;
        queryOptions.order = [['deletedAt', 'DESC']];
    } else {
        queryOptions.order = [['lastScrapedAt', 'DESC']];
    }

    const { count, rows: apps } = await App.findAndCountAll(queryOptions);

    const totalPages = Math.ceil(count / limit);
    const pagination = {
        totalItems: count,
        totalPages: totalPages,
        currentPage: page,
        limit: limit
    };
    
    return { apps, pagination, search };
}

/**
 * Hien thi trang Scrape chinh (/)
 */
const renderScrapePage = async (req, res) => {
  try {
    const categories = gplay.category;
    const collections = gplay.collection;
    
    res.render('pages/scrape', {
      data: {
        title: 'Bảng điều khiển - Lấy dữ liệu App',
        page: 'scrape' 
      },
      categories: categories,     
      collections: collections
    });
  } catch (err)
 {
    console.error("Loi render trang scrape:", err);
    res.status(500).send("Loi server roi Bro oi.");
  }
};

/**
 * (SUA) Hien thi trang Danh Sach App
 */
const renderAppListPage = async (req, res) => {
  try {
    const { apps, pagination, search } = await getPagedApps(req, false);
    
    // Dem so rac
    const trashCount = await App.count({
        where: { deletedAt: { [Op.not]: null } },
        paranoid: false
    });

    res.render('pages/appList', {
      data: {
        title: 'Danh sách APP đã lưu',
        page: 'appList'
      },
      savedApps: apps, // Doi ten bien
      pagination: pagination,
      search: search,
      trashCount: trashCount,
      baseUrl: '/app-list' // Cho phan trang
    });
  } catch (err) {
    console.error("Loi render trang App List:", err);
    res.status(500).send("Loi server roi Bro oi.");
  }
};

/**
 * (SUA) Hien thi trang Thung Rac
 */
const renderTrashPage = async (req, res) => {
  try {
    const { apps, pagination, search } = await getPagedApps(req, true);
    
    res.render('pages/trash', {
      data: {
        title: 'Thùng rác - App đã xoá',
        page: 'trash'
      },
      savedApps: apps, // Doi ten bien
      pagination: pagination,
      search: search,
      baseUrl: '/trash' // Cho phan trang
    });
  } catch (err) {
    console.error("Loi render trang Thung Rac:", err);
    res.status(500).send("Loi server roi Bro oi.");
  }
};


// --- (Cac ham API (handleDeleteApps, handleRestoreApps) giu nguyen) ---

const handleDeleteApps = async (req, res) => {
  const { appIds, deleteAll } = req.body;
  try {
    let numDeleted = 0;
    let whereClause = {};
    if (deleteAll) {
      const search = req.body.search || '';
      if (search) {
        whereClause = { [Op.or]: [ { appId: { [Op.like]: `%${search}%` } }, { title: { [Op.like]: `%${search}%` } } ] };
      }
      numDeleted = await App.destroy({ where: whereClause });
    } else if (appIds && Array.isArray(appIds) && appIds.length > 0) {
      whereClause = { appId: appIds };
      numDeleted = await App.destroy({ where: whereClause });
    } else {
      return res.status(400).json({ success: false, message: 'Chưa chọn app nào để xoá, Bro.' });
    }
    return res.status(200).json({ 
      success: true, 
      message: `Đã vứt ${numDeleted} app${numDeleted > 1 ? 's' : ''} vào thùng rác.`,
      deletedCount: numDeleted
    });
  } catch (err) {
    console.error("Loi xoa mem app:", err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi vứt app vào rác.' });
  }
};

// --- 1. SỬA HÀM KHÔI PHỤC (handleRestoreApps) ---
const handleRestoreApps = async (req, res) => {
  const { appIds, restoreAll } = req.body;
  try {
    let numRestored = 0;
    let whereClause = {};

    if (restoreAll) {
      // Nếu chọn tất cả: Phải lọc theo Search (nếu có) VÀ chỉ những thằng đang trong thùng rác
      const search = req.body.search || '';
      
      // Logic tạo điều kiện tìm kiếm
      if (search) {
        whereClause = {
            [Op.and]: [
                { deletedAt: { [Op.not]: null } }, // QUAN TRỌNG: Chỉ lấy thằng đã xóa
                {
                    [Op.or]: [
                        { appId: { [Op.like]: `%${search}%` } },
                        { title: { [Op.like]: `%${search}%` } }
                    ]
                }
            ]
        };
      } else {
        // Nếu không search, chỉ cần điều kiện đã xóa
        whereClause = { deletedAt: { [Op.not]: null } };
      }

      // Thực hiện khôi phục
      numRestored = await App.restore({ where: whereClause, paranoid: false });

    } else if (appIds && Array.isArray(appIds) && appIds.length > 0) {
      // Nếu chọn lẻ tẻ: Chỉ cần where theo ID
      whereClause = { appId: appIds };
      numRestored = await App.restore({ where: whereClause, paranoid: false });
    } else {
      return res.status(400).json({ success: false, message: 'Chưa chọn app nào để khôi phục.' });
    }

    return res.status(200).json({ 
      success: true, 
      message: `Đã khôi phục ${numRestored} app${numRestored > 1 ? 's' : ''}.`,
      restoredCount: numRestored
    });
  } catch (err) {
    console.error("Loi khoi phuc app:", err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi khôi phục app.' });
  }
};

// --- 2. SỬA HÀM XÓA VĨNH VIỄN (handleForceDeleteApps) ---
const handleForceDeleteApps = async (req, res) => {
  const { appIds, deleteAll } = req.body;
  try {
    let numDeleted = 0;
    let whereClause = {};
    let appIdsToDelete = []; 

    if (deleteAll) {
      // Tương tự, phải lọc chỉ những thằng trong thùng rác
      const search = req.body.search || '';
      
      if (search) {
        whereClause = {
            [Op.and]: [
                { deletedAt: { [Op.not]: null } }, // QUAN TRỌNG: Chỉ lấy thằng đã xóa
                {
                    [Op.or]: [
                        { appId: { [Op.like]: `%${search}%` } },
                        { title: { [Op.like]: `%${search}%` } }
                    ]
                }
            ]
        };
      } else {
        whereClause = { deletedAt: { [Op.not]: null } };
      }
      
      // Tim ID để xóa file ảnh trước
      const apps = await App.findAll({ where: whereClause, attributes: ['appId'], paranoid: false });
      appIdsToDelete = apps.map(app => app.appId);

    } else if (appIds && Array.isArray(appIds) && appIds.length > 0) {
      whereClause = { appId: appIds };
      appIdsToDelete = [...appIds];
      
    } else {
      return res.status(400).json({ success: false, message: 'Chưa chọn app nào để xoá vĩnh viễn.' });
    }

    if (appIdsToDelete.length === 0) {
       return res.status(200).json({ 
        success: true, 
        message: `Chẳng có app rác nào để xoá vĩnh viễn cả.`,
        deletedCount: 0
      });
    }

    // Xoa trong DB
    numDeleted = await App.destroy({ where: whereClause, force: true, paranoid: false });

    // Xoa hinh anh
    if (numDeleted > 0) {
      console.log(`[Job Delete] Bat dau xoa ${appIdsToDelete.length} thu muc anh...`);
      const deletePromises = appIdsToDelete.map(id => deleteAppImages(id));
      Promise.all(deletePromises)
        .then(() => console.log(`[Job Delete] Da hoan tat lenh xoa ${appIdsToDelete.length} thu muc anh.`))
        .catch(err => console.error('[Job Delete] Loi trong luc xoa dong loat thu muc anh:', err));
    }

    return res.status(200).json({ 
      success: true, 
      message: `Đã xoá vĩnh viễn ${numDeleted} app${numDeleted > 1 ? 's' : ''}. (Đã bắt đầu dọn dẹp file ảnh)`,
      deletedCount: numDeleted
    });
  } catch (err) {
    console.error("Loi xoa vinh vien app:", err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi xoá vĩnh viễn.' });
  }
};


// ---------------------------------------------------
// +++ MOI: CAC HAM XU LY CHO WORDPRESS SITES
// ---------------------------------------------------

/**
 * (MOI) Hien thi trang Quan ly WP Sites
 */
const renderWpSitesPage = async (req, res) => {
  try {
    // Khong can phan trang, lay het site ra
    const sites = await WpSite.findAll({ order: [['siteName', 'ASC']] });
    
    res.render('pages/wpSites', {
      data: {
        title: 'Quản lý Wordpress Sites',
        page: 'wpSites' 
      },
      wpSites: sites // Truyen bien nay vao EJS
    });
  } catch (err) {
    console.error("Loi render trang WP Sites:", err);
    res.status(500).send("Loi server roi Bro oi.");
  }
};

/**
 * (MOI) API: Lay tat ca WP Sites
 */
const handleGetWpSites = async (req, res) => {
  try {
    const sites = await WpSite.findAll({ order: [['siteName', 'ASC']] });
    return res.status(200).json(sites);
  } catch (err) {
    console.error("Loi API Get WP Sites:", err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách site.' });
  }
};

/**
 * (MOI) API: Tao WP Site moi
 */
const handleCreateWpSite = async (req, res) => {
  const { siteName, siteUrl, apiKey } = req.body;
  
  if (!siteName || !siteUrl || !apiKey) {
    return res.status(400).json({ success: false, message: 'Nhập thiếu rồi Bro. Cần Tên, URL, và API Key.' });
  }

  try {
    const newSite = await WpSite.create({
      siteName,
      siteUrl,
      apiKey
    });
    return res.status(201).json({ success: true, message: 'Đã thêm site mới ngon lành!', site: newSite });
  } catch (err) {
    console.error("Loi API Create WP Site:", err);
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ success: false, message: `URL không hợp lệ: ${err.errors[0].message}` });
    }
    return res.status(500).json({ success: false, message: 'Lỗi server khi tạo site.' });
  }
};

/**
 * (MOI) API: Cap nhat WP Site
 */
const handleUpdateWpSite = async (req, res) => {
  const { id } = req.params;
  const { siteName, siteUrl, apiKey } = req.body;

  if (!siteName || !siteUrl || !apiKey) {
    return res.status(400).json({ success: false, message: 'Nhập thiếu rồi Bro. Cần Tên, URL, và API Key.' });
  }

  try {
    const site = await WpSite.findByPk(id);
    if (!site) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy site này, Bro.' });
    }

    site.siteName = siteName;
    site.siteUrl = siteUrl;
    site.apiKey = apiKey;
    
    await site.save();
    
    return res.status(200).json({ success: true, message: 'Đã cập nhật site ngon lành!', site: site });
  } catch (err) {
    console.error("Loi API Update WP Site:", err);
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ success: false, message: `URL không hợp lệ: ${err.errors[0].message}` });
    }
    return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật site.' });
  }
};

/**
 * (MOI) API: Xoa WP Site
 */
const handleDeleteWpSite = async (req, res) => {
  const { id } = req.params;
  try {
    const site = await WpSite.findByPk(id);
    if (!site) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy site này, Bro.' });
    }

    await site.destroy();
    
    return res.status(200).json({ success: true, message: 'Đã xoá site vĩnh viễn.' });
  } catch (err) {
    console.error("Loi API Delete WP Site:", err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi xoá site.' });
  }
};


module.exports = {
  renderScrapePage,
  renderAppListPage,
  renderTrashPage,
  handleDeleteApps,
  handleRestoreApps,
  handleForceDeleteApps,
  
  // +++ MOI: Export cac ham moi +++
  renderWpSitesPage,
  handleGetWpSites,
  handleCreateWpSite,
  handleUpdateWpSite,
  handleDeleteWpSite
};
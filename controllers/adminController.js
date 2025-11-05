const App = require('../models/app');
const { default: gplay } = require('google-play-scraper');
const { Op } = require('sequelize');
const fs = require('fs-extra'); // +++ MOI: Them module 'fs-extra'
const path = require('path'); // +++ MOI: Them module 'path'

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
  } catch (err) {
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

const handleRestoreApps = async (req, res) => {
  const { appIds, restoreAll } = req.body;
  try {
    let numRestored = 0;
    let whereClause = {};
    if (restoreAll) {
      const search = req.body.search || '';
      if (search) {
        whereClause = { [Op.or]: [ { appId: { [Op.like]: `%${search}%` } }, { title: { [Op.like]: `%${search}%` } } ] };
      }
      numRestored = await App.restore({ where: whereClause, paranoid: false });
    } else if (appIds && Array.isArray(appIds) && appIds.length > 0) {
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

// --- (CAP NHAT LON HAM NAY) ---
const handleForceDeleteApps = async (req, res) => {
  const { appIds, deleteAll } = req.body;
  try {
    let numDeleted = 0;
    let whereClause = {};
    let appIdsToDelete = []; // +++ MOI: Luu ID de xoa file

    if (deleteAll) {
      const search = req.body.search || '';
      if (search) {
        whereClause = { [Op.or]: [ { appId: { [Op.like]: `%${search}%` } }, { title: { [Op.like]: `%${search}%` } } ] };
      }
      
      // +++ MOI: Tim tat ca app truoc khi xoa de lay ID +++
      // Phai them paranoid: false de tim trong thung rac
      const apps = await App.findAll({ where: whereClause, attributes: ['appId'], paranoid: false });
      appIdsToDelete = apps.map(app => app.appId);

    } else if (appIds && Array.isArray(appIds) && appIds.length > 0) {
      whereClause = { appId: appIds };
      appIdsToDelete = [...appIds]; // +++ MOI: Luu lai ID
      
    } else {
      return res.status(400).json({ success: false, message: 'Chưa chọn app nào để xoá vĩnh viễn.' });
    }

    // Neu khong co gi de xoa
    if (appIdsToDelete.length === 0) {
       return res.status(200).json({ 
        success: true, 
        message: `Chẳng có app nào để xoá vĩnh viễn cả.`,
        deletedCount: 0
      });
    }

    // 1. Xoa trong DB
    numDeleted = await App.destroy({ where: whereClause, force: true, paranoid: false });

    // 2. +++ MOI: Xoa hinh anh (khong can await, cho no chay ngam) +++
    if (numDeleted > 0) {
      console.log(`[Job Delete] Bat dau xoa ${appIdsToDelete.length} thu muc anh...`);
      // Chay song song cac tac vu xoa file
      const deletePromises = appIdsToDelete.map(id => deleteAppImages(id));
      
      // Khong can await Promise.all, cu de no chay ngam
      Promise.all(deletePromises)
        .then(() => console.log(`[Job Delete] Da hoan tat lenh xoa ${appIdsToDelete.length} thu muc anh.`))
        .catch(err => console.error('[Job Delete] Loi trong luc xoa dong loat thu muc anh:', err));
    }
    // -----------------------------------------------------------------

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

module.exports = {
  renderScrapePage,
  renderAppListPage,
  renderTrashPage,
  handleDeleteApps,
  handleRestoreApps,
  handleForceDeleteApps // Giu nguyen
};
const App = require('../models/app');
const WpSite = require('../models/wpSite');
const { default: gplay } = require('google-play-scraper');
const { Op } = require('sequelize');
const fs = require('fs-extra'); 
const path = require('path'); 

async function deleteAppImages(appId) {
  const imgDir = path.join(__dirname, '..', 'public', 'images', 'apps', appId);
  try {
    await fs.remove(imgDir);
    console.log(`[Image Delete] ✅ Da xoa thu muc: ${imgDir}`);
  } catch (err) {
    console.error(`[Image Delete] ❌ Loi khi xoa ${imgDir}: ${err.message}`);
  }
}

async function getPagedApps(req, isTrashView = false) {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 20; 
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

const renderAppListPage = async (req, res) => {
  try {
    const { apps, pagination, search } = await getPagedApps(req, false);
    
    const trashCount = await App.count({
        where: { deletedAt: { [Op.not]: null } },
        paranoid: false
    });

    const wpSites = await WpSite.findAll({ 
        attributes: ['id', 'siteName'],
        order: [['siteName', 'ASC']]
    });

    res.render('pages/appList', {
      data: {
        title: 'Danh sách APP đã lưu',
        page: 'appList'
      },
      savedApps: apps, 
      pagination: pagination,
      search: search,
      trashCount: trashCount,
      wpSites: wpSites, 
      baseUrl: '/app-list'
    });
  } catch (err) {
    console.error("Loi render trang App List:", err);
    res.status(500).send("Loi server roi Bro oi.");
  }
};

const renderTrashPage = async (req, res) => {
  try {
    const { apps, pagination, search } = await getPagedApps(req, true);
    
    res.render('pages/trash', {
      data: {
        title: 'Thùng rác - App đã xoá',
        page: 'trash'
      },
      savedApps: apps,
      pagination: pagination,
      search: search,
      baseUrl: '/trash'
    });
  } catch (err) {
    console.error("Loi render trang Thung Rac:", err);
    res.status(500).send("Loi server roi Bro oi.");
  }
};

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
        whereClause = {
            [Op.and]: [
                { deletedAt: { [Op.not]: null } },
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

const handleForceDeleteApps = async (req, res) => {
  const { appIds, deleteAll } = req.body;
  try {
    let numDeleted = 0;
    let whereClause = {};
    let appIdsToDelete = []; 

    if (deleteAll) {
      const search = req.body.search || '';
      if (search) {
        whereClause = {
            [Op.and]: [
                { deletedAt: { [Op.not]: null } },
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

    numDeleted = await App.destroy({ where: whereClause, force: true, paranoid: false });

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

const renderWpSitesPage = async (req, res) => {
  try {
    const sites = await WpSite.findAll({ order: [['siteName', 'ASC']] });
    
    res.render('pages/wpSites', {
      data: {
        title: 'Quản lý Wordpress Sites',
        page: 'wpSites' 
      },
      wpSites: sites 
    });
  } catch (err) {
    console.error("Loi render trang WP Sites:", err);
    res.status(500).send("Loi server roi Bro oi.");
  }
};

const handleGetWpSites = async (req, res) => {
  try {
    const sites = await WpSite.findAll({ order: [['siteName', 'ASC']] });
    return res.status(200).json(sites);
  } catch (err) {
    console.error("Loi API Get WP Sites:", err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách site.' });
  }
};

const handleCreateWpSite = async (req, res) => {
  const { siteName, siteUrl, apiKey, aiPrompt } = req.body;
  
  if (!siteName || !siteUrl || !apiKey) {
    return res.status(400).json({ success: false, message: 'Nhập thiếu rồi Bro. Cần Tên, URL, và API Key.' });
  }

  try {
    const newSite = await WpSite.create({
      siteName,
      siteUrl,
      apiKey,
      aiPrompt: aiPrompt || '' 
    });
    return res.status(201).json({ success: true, message: 'Đã thêm site mới ngon lành!', site: newSite });
  } catch (err) {
    console.error("Loi API Create WP Site:", err);
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ success: false, message: `URL không hợp lệ: ${err.errors[0].message}` });
    }
    // +++ MOI: Bat loi trung URL +++
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ success: false, message: 'URL này đã tồn tại trong hệ thống rồi Bro.' });
    }
    return res.status(500).json({ success: false, message: 'Lỗi server khi tạo site.' });
  }
};

const handleUpdateWpSite = async (req, res) => {
  const { id } = req.params;
  const { siteName, siteUrl, apiKey, aiPrompt } = req.body;

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
    site.aiPrompt = aiPrompt || ''; 
    
    await site.save();
    
    return res.status(200).json({ success: true, message: 'Đã cập nhật site ngon lành!', site: site });
  } catch (err) {
    console.error("Loi API Update WP Site:", err);
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ success: false, message: `URL không hợp lệ: ${err.errors[0].message}` });
    }
    // +++ MOI: Bat loi trung URL +++
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ success: false, message: 'URL này đã tồn tại trong hệ thống rồi Bro.' });
    }
    return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật site.' });
  }
};

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
  renderWpSitesPage,
  handleGetWpSites,
  handleCreateWpSite,
  handleUpdateWpSite,
  handleDeleteWpSite
};
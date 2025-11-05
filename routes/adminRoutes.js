const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/auth'); // Goi "bao ve"

// Tat ca cac route trong file nay deu phai di qua "bao ve"
router.use(adminAuth);

/**
 * @route GET /
 * @desc Hien thi trang Scrape (trang chinh)
 * @access Private (Da qua Basic Auth)
 */
router.get('/', adminController.renderScrapePage);

// Bro co the them cac route GET cho cac trang admin khac o day
// Vi du: router.get('/settings', adminController.renderSettingsPage);

module.exports = router;
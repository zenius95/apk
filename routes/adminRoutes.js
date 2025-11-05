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

/**
 * @route GET /app-list
 * @desc Hien thi trang danh sach App da luu
 * @access Private (Da qua Basic Auth)
 */
router.get('/app-list', adminController.renderAppListPage); 

/**
 * @route GET /trash
 * @desc Hien thi trang Thung Rac (app da xoa)
 * @access Private (Da qua Basic Auth)
 */
router.get('/trash', adminController.renderTrashPage); // +++ MOI +++

module.exports = router;
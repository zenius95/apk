const express = require('express');
const router = express.Router();
const scrapeController = require('../controllers/scrapeController');
const adminController = require('../controllers/adminController'); //
const adminAuth = require('../middleware/auth'); // Goi "bao ve"

// Tat ca cac route trong file nay deu phai di qua "bao ve"
router.use(adminAuth);

/**
 * @route POST /api/scrape
 * @desc Nhan lenh bat dau scrape tu form
 * @access Private (Da qua Basic Auth)
 */
router.post('/scrape', scrapeController.handleScrapeRequest);

/**
 * @route GET /api/scrape/status
 * @desc (Optional) De UI kiem tra xem job dang chay hay khong
 * @access Private (Da qua Basic Auth)
 */
router.get('/scrape/status', scrapeController.getJobStatus);

/**
 * @route DELETE /api/apps
 * @desc Xoa mot hoac nhieu apps (Xoa mem - Vao thung rac)
 * @access Private (Da qua Basic Auth)
 */
router.delete('/apps', adminController.handleDeleteApps);

/**
 * @route POST /api/apps/restore
 * @desc Khoi phuc mot hoac nhieu apps tu thung rac
 * @access Private (Da qua Basic Auth)
 */
router.post('/apps/restore', adminController.handleRestoreApps); // +++ DONG NAY MOI

/**
 * @route DELETE /api/apps/permanent
 * @desc Xoa vinh vien mot hoac nhieu apps
 * @access Private (Da qua Basic Auth)
 */
router.delete('/apps/permanent', adminController.handleForceDeleteApps); // +++ DONG NAY MOI

module.exports = router;
const express = require('express');
const router = express.Router();
const scrapeController = require('../controllers/scrapeController');
const adminController = require('../controllers/adminController'); //
const adminAuth = require('../middleware/auth'); // Goi "bao ve"
const aiController = require('../controllers/aiController'); // +++ MOI +++

// Tat ca cac route trong file nay deu phai di qua "bao ve"
router.use(adminAuth);

// === Cac route cho Scrape Apps ===

/**
 * @route POST /api/scrape
 * @desc Nhan lenh bat dau scrape tu form
 * @access Private (Da qua Basic Auth)
 */
router.post('/scrape', scrapeController.handleScrapeRequest);

// Route Stop Job
router.post('/scrape/stop', scrapeController.handleStopJob);


/**
 * @route GET /api/scrape/status
 * @desc (Optional) De UI kiem tra xem job dang chay hay khong
 * @access Private (Da qua Basic Auth)
 */
router.get('/scrape/status', scrapeController.getJobStatus);

// === Cac route cho Quan ly Apps ===

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
router.post('/apps/restore', adminController.handleRestoreApps); 

/**
 * @route DELETE /api/apps/permanent
 * @desc Xoa vinh vien mot hoac nhieu apps
 * @access Private (Da qua Basic Auth)
 */
router.delete('/apps/permanent', adminController.handleForceDeleteApps); 

// === (MOI) Cac route cho Quan ly Wordpress Sites ===

/**
 * @route GET /api/wp-sites
 * @desc (MOI) Lay tat ca WP Sites
 * @access Private (Da qua Basic Auth)
 */
router.get('/wp-sites', adminController.handleGetWpSites);

/**
 * @route POST /api/wp-sites
 * @desc (MOI) Tao mot WP Site moi
 * @access Private (Da qua Basic Auth)
 */
router.post('/wp-sites', adminController.handleCreateWpSite);

/**
 * @route PUT /api/wp-sites/:id
 * @desc (MOI) Cap nhat mot WP Site
 * @access Private (Da qua Basic Auth)
 */
router.put('/wp-sites/:id', adminController.handleUpdateWpSite);

/**
 * @route DELETE /api/wp-sites/:id
 * @desc (MOI) Xoa mot WP Site
 * @access Private (Da qua Basic Auth)
 */
router.delete('/wp-sites/:id', adminController.handleDeleteWpSite);


// === AI Content Routes ===
router.post('/ai/start', aiController.handleStartAiJob);
router.post('/ai/stop', aiController.handleStopAiJob);


module.exports = router;
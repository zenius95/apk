const express = require('express');
const router = express.Router();
const scrapeController = require('../controllers/scrapeController');
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

module.exports = router;
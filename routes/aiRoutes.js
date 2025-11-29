const express = require('express');
const router = express.Router();
const scrapeController = require('../controllers/scrapeController');
const adminController = require('../controllers/adminController'); 
const aiController = require('../controllers/aiController'); // +++ MOI +++
const adminAuth = require('../middleware/auth'); 

router.use(adminAuth);

// ... (Cac route cu giu nguyen)

// === AI Content Routes ===
router.post('/ai/start', aiController.handleStartAiJob);
router.post('/ai/stop', aiController.handleStopAiJob);

module.exports = router;
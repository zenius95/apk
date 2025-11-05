const scraperService = require('../services/scraperService');
const { default: gplay } = require('google-play-scraper'); // +++ THEM VAO
const App = require('../models/app'); // +++ THEM VAO

let isJobRunning = false;

/**
 * "Bo nao" xu ly job (Giu nguyen)
 * @param {object} io - Instance cua Socket.IO
 */
async function runScrapingJob(appIds, concurrency, delay, io) {
  isJobRunning = true;
  
  const emit = (event, data) => io.emit(event, data);
  
  emit('job:start', { count: appIds.length });
  console.log(`[Job] 🚀 BAT DAU JOB! Tong so ${appIds.length} apps.`);

  const queue = [...appIds]; 
  const results = { success: 0, failed: 0 };

  const worker = async (workerId) => {
    while (queue.length > 0) {
      const appId = queue.shift(); 
      if (!appId) continue; 

      emit('app:running', { appId });
      console.log(`[Worker ${workerId}] 👷 Dang xu ly: ${appId}`);
      
      try {
        const result = await scraperService.scrapeAndSave(appId);
        
        if (result.success) {
          emit('app:success', {
            app: result.data, 
            created: result.created
          });
          results.success++;
        } else {
          emit('app:failed', { appId: appId, error: result.error });
          results.failed++;
        }
      } catch (err) {
        emit('app:failed', { appId: appId, error: err.message });
        results.failed++;
        console.error(`[Worker ${workerId}] ❌ LOI NANG voi ${appId}: ${err.message}`);
      }

      if (queue.length > 0) {
        await scraperService.sleep(delay);
      }
    }
  };

  const workerPool = [];
  const actualConcurrency = Math.min(concurrency, appIds.length);
  
  for (let i = 0; i < actualConcurrency; i++) {
    workerPool.push(worker(i + 1)); 
  }

  await Promise.all(workerPool);

  console.log(`[Job] ✅✅✅ JOB HOAN TAT! ✅✅✅`);
  emit('job:done', results); 
  isJobRunning = false;
}

/**
 * Nhan request tu router de bat dau scrape (CAP NHAT LON)
 */
const handleScrapeRequest = async (req, res) => { // +++ PHAI LA ASYNC
  const io = req.io; 

  if (isJobRunning) {
    io.emit('job:error', "Job dang chay roi Bro, tu tu da.");
    return res.status(429).json({ message: "Job dang chay roi Bro...", error: true });
  }

  // +++ DESTRUCTURE TAT CA DATA TU BODY +++
  const {
    scrapeMode,
    appIdsList,
    category,
    collection,
    num,
    concurrency,
    delay
  } = req.body;

  let appIdsToScrape = [];
  let successMessage = "";
  const numConcurrency = parseInt(concurrency, 10) || 5;
  const numDelay = parseInt(delay, 10) || 1000;

  try {
    // +++ LOGIC PHAN LOAI CHE DO +++
    if (scrapeMode === 'by_id') {
      if (!appIdsList) {
        throw new Error("Bro chua nhap App ID nao ca?");
      }
      appIdsToScrape = [...new Set(appIdsList.split('\n').map(id => id.trim()).filter(Boolean))];
      if (appIdsToScrape.length === 0) {
        throw new Error("Bro chua nhap App ID nao ca?");
      }
      successMessage = `OK Bro! Da nhan lenh lay ${appIdsToScrape.length} apps theo ID.`;

    } else if (scrapeMode === 'by_list') {
      const numValue = parseInt(num, 10) || 50;
      
      // Thong bao cho UI la dang "tim"
      io.emit('job:info', `Đang tìm ${numValue} apps (Category: ${category}, Collection: ${collection})...`);

      const listResults = await gplay.list({
        category: category,
        collection: collection,
        num: numValue
      });
      
      appIdsToScrape = listResults.map(app => app.appId);
      if (appIdsToScrape.length === 0) {
        throw new Error("Khong tim thay app nao tu danh sach da chon.");
      }
      successMessage = `OK Bro! Tim thay ${appIdsToScrape.length} apps.`;

    } else {
      throw new Error("Che do scrape khong hop le.");
    }

    // +++ LOGIC LOC APP MOI (QUAN TRONG) +++
    // Luon loc o backend, vi frontend chi co data cua 1 trang
    console.log(`[Job] Da tim thay ${appIdsToScrape.length} apps. Dang kiem tra DB...`);
    const existingApps = await App.findAll({
      where: { appId: appIdsToScrape },
      attributes: ['appId']
    });
    const existingAppIds = new Set(existingApps.map(app => app.appId));
    
    const newAppIds = appIdsToScrape.filter(id => !existingAppIds.has(id));
    console.log(`[Job] Phat hien ${newAppIds.length} app moi.`);

    if (newAppIds.length === 0) {
      return res.status(200).json({ 
        message: "Tat ca app tim thay deu da co trong 'Da luu'. Khong co gi de them.", 
        appIds: [] // Gui mang rong
      });
    }
    
    // +++ GUI REPONSE VA CHAY JOB VOI APP MOI +++
    res.status(200).json({
      message: `${successMessage} Phat hien ${newAppIds.length} app moi. Bat dau them...`,
      appIds: newAppIds // Chi gui appIds MOI cho frontend
    });

    // Chi chay job voi cac app "moi"
    runScrapingJob(newAppIds, numConcurrency, numDelay, io);

  } catch (err) {
    console.error("[Job] Loi khi xu ly request scrape:", err.message);
    io.emit('job:error', `Loi: ${err.message}`);
    return res.status(500).json({ message: err.message, error: true });
  }
};

// Ham kiem tra status (giu nguyen)
const getJobStatus = (req, res) => {
  res.status(200).json({
    isJobRunning: isJobRunning
  });
};

module.exports = {
  handleScrapeRequest,
  getJobStatus
};
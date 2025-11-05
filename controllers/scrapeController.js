const scraperService = require('../services/scraperService');
// const { default: gplay } = require('google-play-scraper'); // Dong nay da chuyen sang service

let isJobRunning = false;

/**
 * "Bo nao" xu ly job
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
          // 2. Bao cho UI: "Lam xong thang nay, day la ket qua"
          // +++ GUI TOAN BO APP INSTANCE (result.data) +++
          emit('app:success', {
            app: result.data, // appInstance tu DB
            created: result.created
          });
          results.success++;
        } else {
          // 3. Bao cho UI: "Thang nay 'toang' roi"
          emit('app:failed', { appId: appId, error: result.error });
          results.failed++;
        }
      } catch (err) {
        // 4. Bao cho UI: "Thang nay 'toang' nang"
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
 * Nhan request tu router de bat dau scrape
 */
const handleScrapeRequest = (req, res) => {
  const io = req.io; 

  if (isJobRunning) {
    io.emit('job:error', "Job dang chay roi Bro, tu tu da.");
    return res.status(429).json({ message: "Job dang chay roi Bro...", error: true });
  }

  const { appIds, concurrency, delay } = req.body;

  if (!appIds || appIds.length === 0) {
    return res.status(400).json({ message: "Khong co app 'moi' nao de them vao hang cho.", error: true });
  }

  const numConcurrency = parseInt(concurrency, 10) || 5;
  const numDelay = parseInt(delay, 10) || 1000;

  res.status(200).json({
    message: `OK Bro! Da nhan lenh. Bat dau lay ${appIds.length} apps.`,
    appIds: appIds
  });

  runScrapingJob(appIds, numConcurrency, numDelay, io);
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
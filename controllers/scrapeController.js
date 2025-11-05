const scraperService = require('../services/scraperService');

let isJobRunning = false;

/**
 * Xu ly logic "chia viec" (concurrency pool)
 * @param {object} io - Instance cua Socket.IO de "ban" log
 */
async function runScrapingJob(appIds, concurrency, delay, io) {
  isJobRunning = true;
  
  // Dinh nghia ham ban log (qua ca console va socket)
  const log = (message, type = 'message') => {
    console.log(message);
    io.emit(`log:${type}`, message); // Ban log ra cho client
  };
  
  log(`[Job] 🚀 BAT DAU JOB! Tong so ${appIds.length} apps.`, 'info');
  log(`[Job] 🛠️ Cau hinh: ${concurrency} luong song song, delay ${delay}ms`, 'info');

  const queue = [...appIds]; 
  const results = {
    success: [],
    failed: []
  };

  /**
   * Dinh nghia mot "Lao cong" (Worker)
   */
  const worker = async (workerId) => {
    while (queue.length > 0) {
      const appId = queue.shift(); 
      if (!appId) continue; 

      log(`[Worker ${workerId}] 👷 Dang xu ly: ${appId} (Con lai: ${queue.length})`, 'message');
      
      try {
        const result = await scraperService.scrapeAndSave(appId);
        if (result.success) {
          results.success.push(appId);
          const logMsg = result.created
            ? `[Worker ${workerId}] ✅ DA LUU (Moi): ${result.data.title}`
            : `[Worker ${workerId}] ✅ DA CAP NHAT (Cu): ${result.data.title}`;
          log(logMsg, 'success');
        } else {
          results.failed.push({ appId, error: result.error });
          log(`[Worker ${workerId}] ❌ LOI (App): ${appId} - ${result.error}`, 'error');
        }
      } catch (err) {
        log(`[Worker ${workerId}] ❌ LOI NANG voi ${appId}: ${err.message}`, 'error');
        results.failed.push({ appId, error: err.message });
      }

      if (queue.length > 0) {
        await scraperService.sleep(delay);
      }
    }
  };

  // Tao "doi quan" (worker pool)
  const workerPool = [];
  const actualConcurrency = Math.min(concurrency, appIds.length);
  log(`[Job] 🤖 Huy dong ${actualConcurrency} workers...`, 'info');
  
  for (let i = 0; i < actualConcurrency; i++) {
    workerPool.push(worker(i + 1)); 
  }

  await Promise.all(workerPool);

  log("-------------------------------------------------", 'info');
  log(`[Job] ✅✅✅ JOB HOAN TAT! ✅✅✅`, 'info');
  log(`[Job] 👍 Thanh cong: ${results.success.length}`, 'success');
  log(`[Job] 👎 That bai: ${results.failed.length}`, 'error');
  if(results.failed.length > 0) {
    log(`[Job] Cac app loi: ${results.failed.map(f => f.appId).join(', ')}`, 'error');
  }
  log("-------------------------------------------------", 'info');
  
  io.emit('job:done'); // Bao cho client biet la job da xong
  isJobRunning = false;
}

/**
 * Nhan request tu router de bat dau scrape
 */
const handleScrapeRequest = (req, res) => {
  const io = req.io; // Lay io tu req (da duoc gan o server.js)

  if (isJobRunning) {
    io.emit('log:error', "[Job] ⚠️ Job dang chay roi, Bro tu choi request moi.");
    return res.status(429).json({ 
      message: "Job dang chay roi Bro, tu tu da. Spam a?",
      error: true 
    });
  }

  const { appIdsList, concurrency, delay } = req.body;

  const appIds = [...new Set(
    appIdsList.split('\n')
      .map(id => id.trim())
      .filter(Boolean)
  )];

  const numConcurrency = parseInt(concurrency, 10) || 5;
  const numDelay = parseInt(delay, 10) || 1000;

  if (appIds.length === 0) {
    return res.status(400).json({ 
      message: "Bro chua nhap App ID nao ca? Lay cai gi bay gio?",
      error: true 
    });
  }

  res.status(200).json({
    message: `OK Bro! Da nhan lenh. Bat dau lay ${appIds.length} apps.`,
  });

  // Goi ham chay job (khong await)
  runScrapingJob(appIds, numConcurrency, numDelay, io);
};

// ... (ham getJobStatus giu nguyen) ...
const getJobStatus = (req, res) => {
  res.status(200).json({
    isJobRunning: isJobRunning
  });
};

module.exports = {
  handleScrapeRequest,
  getJobStatus
};
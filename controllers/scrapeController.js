const scraperService = require('../services/scraperService');
const { default: gplay } = require('google-play-scraper');
const App = require('../models/app');

// --- GLOBAL STATE (Luu trong RAM server) ---
let jobState = {
  isRunning: false,
  isStopping: false, // Co dang yeu cau dung khong
  queue: [],
  logs: [], // Mang luu logs de hien thi lai khi F5
  stats: { success: 0, failed: 0, total: 0 }
};

// Ham them log va ban socket
const addLog = (io, type, message) => {
  const timestamp = new Date().toLocaleTimeString('vi-VN');
  const logEntry = { time: timestamp, type, message };
  
  // Luu vao RAM (Gioi han 1000 dong de khong tran RAM)
  jobState.logs.push(logEntry);
  if (jobState.logs.length > 1000) jobState.logs.shift();

  // Ban ra UI
  io.emit('job:log', logEntry);
};

/**
 * Xu ly Job cào dữ liệu
 */
async function runScrapingJob(appIds, concurrency, delay, io) {
  jobState.isRunning = true;
  jobState.isStopping = false;
  jobState.stats = { success: 0, failed: 0, total: appIds.length };
  jobState.queue = [...appIds];
  
  // Xoa log cu khi chay job moi (hoac giu lai tuy Bro)
  jobState.logs = []; 

  addLog(io, 'INFO', `🚀 BẮT ĐẦU JOB! Tổng số: ${appIds.length} apps.`);
  io.emit('job:update_stats', jobState.stats); // Cap nhat so lieu ban dau

  const worker = async (workerId) => {
    while (jobState.queue.length > 0) {
      // 1. Check tin hieu STOP
      if (jobState.isStopping) {
        break;
      }

      const appId = jobState.queue.shift(); 
      if (!appId) continue; 

      addLog(io, 'mW', `[Worker ${workerId}] Đang xử lý: ${appId}...`);
      
      try {
        const result = await scraperService.scrapeAndSave(appId);
        
        if (result.success) {
          jobState.stats.success++;
          addLog(io, 'mW_OK', `✅ [Worker ${workerId}] Xong: ${result.data.title}`);
        } else {
          jobState.stats.failed++;
          addLog(io, 'mW_ERR', `❌ [Worker ${workerId}] Lỗi ${appId}: ${result.error}`);
        }
      } catch (err) {
        jobState.stats.failed++;
        addLog(io, 'ERR', `❌ [Worker ${workerId}] Exception: ${err.message}`);
      }

      // Cap nhat thong so ra client
      io.emit('job:update_stats', jobState.stats);

      // Delay
      if (jobState.queue.length > 0 && !jobState.isStopping) {
        await scraperService.sleep(delay);
      }
    }
  };

  // Khoi tao Worker Pool
  const workerPool = [];
  const actualConcurrency = Math.min(concurrency, appIds.length);
  
  for (let i = 0; i < actualConcurrency; i++) {
    workerPool.push(worker(i + 1)); 
  }

  await Promise.all(workerPool);

  // Ket thuc
  if (jobState.isStopping) {
    addLog(io, 'WARN', `OAAP! Job đã bị Bro bắt dừng lại. (Còn lại ${jobState.queue.length} app)`);
  } else {
    addLog(io, 'INFO', `✅ JOB HOÀN TẤT!`);
  }

  io.emit('job:done', jobState.stats); 
  jobState.isRunning = false;
  jobState.isStopping = false;
}

/**
 * API: Bat dau Scrape
 */
const handleScrapeRequest = async (req, res) => {
  const io = req.io; 

  if (jobState.isRunning) {
    return res.status(400).json({ message: "Job đang chạy rồi Bro!", error: true });
  }

  const { scrapeMode, appIdsList, category, collection, num, concurrency, delay } = req.body;
  // ... (Logic loc App ID giu nguyen nhu cu) ...
  
  // (Minh gian luoc doan check DB de tap trung vao logic Log, Bro copy lai doan logic loc ID cu vao day nhe)
  // GIA DU la da co danh sach finalAppIds
  let appIdsToScrape = [];
  
  try {
      // --- TAI SU DUNG LOGIC CU DE LAY ID ---
      if (scrapeMode === 'by_id') {
        if (!appIdsList) throw new Error("Thiếu danh sách ID.");
        appIdsToScrape = [...new Set(appIdsList.split('\n').map(id => id.trim()).filter(Boolean))];
      } else {
         // Logic lay theo list giong cu...
         const listResults = await gplay.list({ category, collection, num: parseInt(num) || 50 });
         appIdsToScrape = listResults.map(app => app.appId);
      }

      // Loc app da co (Copy tu file cu sang)
      const existingApps = await App.findAll({ where: { appId: appIdsToScrape }, attributes: ['appId'] });
      const existingAppIds = new Set(existingApps.map(app => app.appId));
      const newAppIds = appIdsToScrape.filter(id => !existingAppIds.has(id));

      if (newAppIds.length === 0) {
          return res.status(200).json({ message: "Không có app mới.", appIds: [] });
      }

      // Chay Job
      const numConcurrency = parseInt(concurrency) || 5;
      const numDelay = parseInt(delay) || 1000;
      
      runScrapingJob(newAppIds, numConcurrency, numDelay, io);

      return res.status(200).json({ 
          message: `Bắt đầu xử lý ${newAppIds.length} apps...`, 
          appIds: newAppIds 
      });

  } catch (err) {
      return res.status(500).json({ message: err.message, error: true });
  }
};

/**
 * API: Lay trang thai hien tai (Dung de Load lai Log khi F5)
 */
const getJobStatus = (req, res) => {
  res.status(200).json({
    isRunning: jobState.isRunning,
    logs: jobState.logs, // Tra ve toan bo log trong RAM
    stats: jobState.stats
  });
};

/**
 * API: Dung Job (Stop)
 */
const handleStopJob = (req, res) => {
  if (!jobState.isRunning) {
    return res.status(400).json({ message: "Có Job nào đang chạy đâu mà dừng Bro?" });
  }
  jobState.isStopping = true;
  // Log ngay lap tuc
  addLog(req.io, 'WARN', '⚠️ Đang gửi lệnh dừng... Đợi các worker hoàn thành nốt task hiện tại.');
  return res.status(200).json({ message: "Đang dừng Job..." });
};

module.exports = {
  handleScrapeRequest,
  getJobStatus,
  handleStopJob // Export them ham nay
};
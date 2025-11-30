const scraperService = require('../services/scraperService');
const { default: gplay } = require('google-play-scraper');
const App = require('../models/app');
const fs = require('fs');
const path = require('path');

// --- GLOBAL STATE ---
let jobState = {
  isRunning: false,
  isStopping: false,
  queue: [],
  logs: [],
  stats: { success: 0, failed: 0, total: 0 }
};

const writeLogToFile = (logEntry) => {
  try {
    const dateStr = new Date().toISOString().split('T')[0];
    const logDir = path.join(__dirname, '..', 'logs');
    const logFile = path.join(logDir, `scrape-${dateStr}.log`);
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
    const logLine = `[${logEntry.time}] [${logEntry.type}] ${logEntry.message}\n`;
    fs.appendFile(logFile, logLine, (err) => { if (err) console.error("Loi ghi log:", err); });
  } catch (e) { console.error("Exception ghi log:", e); }
};

const addLog = (io, type, message) => {
  const timestamp = new Date().toLocaleTimeString('vi-VN');
  const logEntry = { time: timestamp, type, message };
  jobState.logs.push(logEntry);
  if (jobState.logs.length > 100) jobState.logs.shift();
  writeLogToFile(logEntry);
  io.emit('job:log', logEntry);
};

async function runScrapingJob(appIds, concurrency, delay, io, lang, country) {
  jobState.isRunning = true;
  jobState.isStopping = false;
  jobState.stats = { success: 0, failed: 0, total: appIds.length };
  jobState.queue = [...appIds];
  jobState.logs = []; 

  addLog(io, 'INFO', `🚀 BẮT ĐẦU JOB! Tổng số: ${appIds.length} apps. (Lang: ${lang}, Country: ${country})`);
  io.emit('job:update_stats', jobState.stats);

  const worker = async (workerId) => {
    while (jobState.queue.length > 0) {
      // 1. Check Stop & Queue
      if (jobState.isStopping) break;

      const appId = jobState.queue.shift(); 
      if (!appId) continue; 

      addLog(io, 'mW', `[Worker ${workerId}] Đang xử lý: ${appId}...`);
      
      try {
        const result = await scraperService.scrapeAndSave(appId, lang, country);
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

      io.emit('job:update_stats', jobState.stats);

      // Delay (Chi delay neu hang doi con va khong bi dung)
      if (jobState.queue.length > 0 && !jobState.isStopping) {
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

  if (jobState.isStopping) {
    addLog(io, 'WARN', `🛑 JOB ĐÃ DỪNG! (Đã hủy các task còn lại)`);
  } else {
    addLog(io, 'INFO', `✅ JOB HOÀN TẤT!`);
  }

  io.emit('job:done', jobState.stats); 
  jobState.isRunning = false;
  jobState.isStopping = false;
}

const handleScrapeRequest = async (req, res) => {
  const io = req.io; 
  if (jobState.isRunning) return res.status(400).json({ message: "Job đang chạy rồi Bro!", error: true });

  const { scrapeMode, appIdsList, category, collection, num, concurrency, delay, lang, country } = req.body;
  const targetLang = lang || 'en';
  const targetCountry = country || 'us';
  let appIdsToScrape = [];
  
  try {
      if (scrapeMode === 'by_id') {
        if (!appIdsList) throw new Error("Thiếu danh sách ID.");
        appIdsToScrape = [...new Set(appIdsList.split('\n').map(id => id.trim()).filter(Boolean))];
      } else {
         const listResults = await gplay.list({ 
             category, collection, num: parseInt(num) || 50, lang: targetLang, country: targetCountry
         });
         appIdsToScrape = listResults.map(app => app.appId);
      }

      const existingApps = await App.findAll({ where: { appId: appIdsToScrape }, attributes: ['appId'] });
      const existingAppIds = new Set(existingApps.map(app => app.appId));
      const newAppIds = appIdsToScrape.filter(id => !existingAppIds.has(id));

      if (newAppIds.length === 0) return res.status(200).json({ message: "Không có app mới.", appIds: [] });

      const numConcurrency = parseInt(concurrency) || 5;
      const numDelay = parseInt(delay) || 1000;
      
      runScrapingJob(newAppIds, numConcurrency, numDelay, io, targetLang, targetCountry);

      return res.status(200).json({ message: `Bắt đầu xử lý ${newAppIds.length} apps...`, appIds: newAppIds });

  } catch (err) {
      return res.status(500).json({ message: err.message, error: true });
  }
};

const getJobStatus = (req, res) => {
  res.status(200).json({ isRunning: jobState.isRunning, logs: jobState.logs, stats: jobState.stats });
};

// +++ FIX: DUNG NGAY LAP TUC +++
const handleStopJob = (req, res) => {
  if (!jobState.isRunning) return res.status(400).json({ message: "Có Job nào đang chạy đâu?" });
  
  jobState.isStopping = true;
  jobState.queue = []; // <--- XOA SACH HANG DOI DE WORKER DUNG NGAY
  
  addLog(req.io, 'WARN', '⚠️ Lệnh DỪNG đã được kích hoạt! Đang hủy hàng đợi...');
  return res.status(200).json({ message: "Đang dừng..." });
};

module.exports = { handleScrapeRequest, getJobStatus, handleStopJob };
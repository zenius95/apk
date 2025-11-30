const App = require('../models/app');
const WpSite = require('../models/wpSite');
const WpPostLog = require('../models/wpPostLog');
const aiService = require('../services/aiService');
const wpService = require('../services/wpService');
const path = require('path');

let aiJobState = {
    isRunning: false,
    isStopping: false,
    stats: { total: 0, success: 0, failed: 0, skipped: 0 }
};

const addLog = (io, type, message) => {
    const time = new Date().toLocaleTimeString('vi-VN');
    io.emit('job:log', { time, type, message });
};

const getLocalPath = (relPath) => {
    if (!relPath || !relPath.startsWith('/images/')) return null;
    return path.join(__dirname, '..', 'public', relPath);
};

// +++ HELPER: Parse JSON an toan cho Server Linux/MariaDB +++
const getSafeAppData = (appRecord) => {
    let rawData = appRecord.fullData;
    // Neu DB tra ve String (do driver MariaDB/MySQL cu), parse no ra
    if (typeof rawData === 'string') {
        try {
            rawData = JSON.parse(rawData);
        } catch (e) {
            console.error("❌ JSON Parse Error:", e.message);
            rawData = {};
        }
    }
    // Dam bao Title luon co (uu tien tu cot Title cua bang App)
    if (!rawData.title) rawData.title = appRecord.title;
    return rawData;
};

// +++ UPDATE: Them tham so postStatus +++
async function processSingleItem(app, site, openAiKey, io, postStatus) {
    const appId = app.appId;
    const siteId = site.id;

    const existing = await WpPostLog.findOne({ where: { appId, wpSiteId: siteId } });
    if (existing) {
        addLog(io, 'WARN', `⏩ Bỏ qua: ${app.title} đã đăng trên ${site.siteName}.`);
        aiJobState.stats.skipped++;
        return;
    }

    addLog(io, 'INFO', `🤖 Đang xử lý: ${app.title} -> ${site.siteName}...`);

    try {
        if (!site.aiPrompt) throw new Error("Site chưa cấu hình Prompt!");
        
        // +++ FIX: Parse Data truoc khi dung +++
        const appData = getSafeAppData(app);

        const generatedContent = await aiService.generateContent(openAiKey, site.aiPrompt, appData);

        let wpFullData = JSON.parse(JSON.stringify(appData)); 
        let featuredMediaId = 0;

        if (wpFullData.icon) {
            const localPath = getLocalPath(wpFullData.icon);
            const uploaded = await wpService.uploadMedia(site, localPath);
            if (uploaded) {
                featuredMediaId = uploaded.id; 
                wpFullData.icon = uploaded.url; 
            }
        }

        if (wpFullData.headerImage) {
            const localPath = getLocalPath(wpFullData.headerImage);
            const uploaded = await wpService.uploadMedia(site, localPath);
            if (uploaded) {
                wpFullData.headerImage = uploaded.url; 
            }
        }

        if (wpFullData.screenshots && wpFullData.screenshots.length > 0) {
            const uploadPromises = wpFullData.screenshots.map(async (ssUrl) => {
                const localPath = getLocalPath(ssUrl);
                const uploaded = await wpService.uploadMedia(site, localPath);
                return uploaded ? uploaded.url : ssUrl; 
            });
            const newScreenshots = await Promise.all(uploadPromises);
            wpFullData.screenshots = newScreenshots;
        }

        let categoryIds = [];
        if (appData.genre) {
            const catId = await wpService.ensureTerm(site, 'categories', appData.genre);
            if (catId) categoryIds.push(catId);
        }

        let tagIds = [];
        if (appData.developer) {
            const tagId = await wpService.ensureTerm(site, 'tags', appData.developer);
            if (tagId) tagIds.push(tagId);
        }

        const postData = {
            title: app.title,
            content: generatedContent,
            excerpt: appData.summary || '',
            status: postStatus || 'publish', 
            featured_media: featuredMediaId || undefined,
            categories: categoryIds, 
            tags: tagIds,            
            meta: {
                app_full_data: wpFullData 
            }
        };

        const wpPost = await wpService.createPost(site, postData);

        await WpPostLog.create({
            appId: appId,
            wpSiteId: siteId,
            wpPostId: wpPost.id,
            status: 'SUCCESS',
            aiContent: generatedContent 
        });

        addLog(io, 'mW_OK', `✅ Đã đăng: ${app.title} (ID: ${wpPost.id})`);
        aiJobState.stats.success++;

    } catch (err) {
        addLog(io, 'ERR', `❌ Lỗi đăng ${app.title}: ${err.message}`);
        aiJobState.stats.failed++;
    }
}

const handleStartAiJob = async (req, res) => {
    const io = req.io;
    const { appIds, siteIds, openAiKey, concurrency, delay, isDemo, postStatus } = req.body;

    if (!isDemo && aiJobState.isRunning) return res.status(400).json({ message: "Job đang chạy rồi!" });

    if (!appIds || !siteIds || !openAiKey) return res.status(400).json({ message: "Thiếu thông tin!" });

    // +++ DEMO MODE +++
    if (isDemo) {
        try {
            const app = await App.findOne({ where: { appId: appIds[0] } }); 
            if (!app) return res.status(404).json({ message: "Không tìm thấy App." });

            // +++ FIX: Parse Data cho Demo +++
            const appData = getSafeAppData(app);

            const sites = await WpSite.findAll({ where: { id: siteIds } });
            if (sites.length === 0) return res.status(404).json({ message: "Không tìm thấy Site." });

            const demoResults = await Promise.all(sites.map(async (site) => {
                if (!site.aiPrompt) {
                    return { siteName: site.siteName, error: "Chưa cấu hình Prompt." };
                }
                try {
                    // Fix regex shortcode o day neu can, nhung logic chinh nam o aiService
                    const renderedPrompt = site.aiPrompt
                        .replace(/{title}/gi, app.title || '')
                        .replace(/{summary}/gi, appData.summary || '')
                        .replace(/{description}/gi, appData.description || '')
                        .replace(/{developer}/gi, appData.developer || '')
                        .replace(/{score}/gi, appData.scoreText || '');

                    const content = await aiService.generateContent(openAiKey, site.aiPrompt, appData);
                    return { siteName: site.siteName, prompt: renderedPrompt, content: content };
                } catch (err) {
                    return { siteName: site.siteName, error: err.message };
                }
            }));

            return res.status(200).json({ success: true, isDemo: true, appName: app.title, results: demoResults, message: "Đã tạo nội dung Demo!" });
        } catch (err) {
            console.error("Loi Demo:", err);
            return res.status(500).json({ message: "Lỗi Demo: " + err.message });
        }
    }
    // +++ END DEMO +++

    const apps = await App.findAll({ where: { appId: appIds } });
    const sites = await WpSite.findAll({ where: { id: siteIds } });

    if (apps.length === 0 || sites.length === 0) return res.status(400).json({ message: "Không tìm thấy Apps hoặc Sites." });

    aiJobState.isRunning = true;
    aiJobState.isStopping = false;
    aiJobState.stats = { total: apps.length * sites.length, success: 0, failed: 0, skipped: 0 };

    addLog(io, 'INFO', `🚀 BẮT ĐẦU AUTO CONTENT! Target: ${apps.length} Apps x ${sites.length} Sites.`);

    res.status(200).json({ message: "Job đã bắt đầu!" });

    (async () => {
        let tasks = [];
        for (const app of apps) {
            for (const site of sites) {
                tasks.push({ app, site, postStatus });
            }
        }

        const numConcurrency = parseInt(concurrency) || 1;
        const numDelay = parseInt(delay) || 2000;

        while (tasks.length > 0) {
            if (aiJobState.isStopping) break;

            const batch = tasks.splice(0, numConcurrency);
            const promises = batch.map(task => processSingleItem(task.app, task.site, openAiKey, io, task.postStatus));
            
            await Promise.all(promises);

            if (tasks.length > 0) await new Promise(r => setTimeout(r, numDelay));
        }

        addLog(io, 'INFO', `🏁 AI Job hoàn tất! Success: ${aiJobState.stats.success}, Fail: ${aiJobState.stats.failed}, Skipped: ${aiJobState.stats.skipped}`);
        
        io.emit('ai_job:done', aiJobState.stats);
        
        aiJobState.isRunning = false;
    })();
};

const handleStopAiJob = (req, res) => {
    if (!aiJobState.isRunning) return res.status(400).json({ message: "Không có Job nào để dừng." });
    aiJobState.isStopping = true;
    addLog(req.io, 'WARN', '⚠️ Đang dừng AI Job...');
    return res.status(200).json({ message: "Đang dừng..." });
};

module.exports = { handleStartAiJob, handleStopAiJob };
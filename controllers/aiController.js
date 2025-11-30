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

const getSafeAppData = (appRecord) => {
    let rawData = appRecord.fullData;
    if (typeof rawData === 'string') {
        try { rawData = JSON.parse(rawData); } catch (e) { rawData = {}; }
    }
    if (!rawData.title) rawData.title = appRecord.title;
    return rawData;
};

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
        if (!site.aiPrompt) throw new Error("Site chưa cấu hình Prompt Nội dung!");
        
        const appData = getSafeAppData(app);

        // --- 1. TITLE ---
        let finalTitle = app.title;
        if (site.aiPromptTitle && site.aiPromptTitle.trim()) {
            finalTitle = await aiService.generateContent(openAiKey, site.aiPromptTitle, appData);
            finalTitle = finalTitle.replace(/^"|"$/g, '').trim(); 
        }

        // --- 2. EXCERPT ---
        let finalExcerpt = appData.summary || '';
        if (site.aiPromptExcerpt && site.aiPromptExcerpt.trim()) {
            finalExcerpt = await aiService.generateContent(openAiKey, site.aiPromptExcerpt, appData);
        }

        // --- 3. MAIN CONTENT ---
        let generatedContent = await aiService.generateContent(openAiKey, site.aiPrompt, appData);

        // --- 4. FOOTER (APPEND) CONTENT ---
        if (site.aiPromptFooter && site.aiPromptFooter.trim()) {
            const footerContent = await aiService.generateContent(openAiKey, site.aiPromptFooter, appData);
            generatedContent += `\n\n${footerContent}`; // Noi vao cuoi
        }

        // --- MEDIA ---
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
            if (uploaded) wpFullData.headerImage = uploaded.url; 
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

        // --- TERMS ---
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

        // --- POSTING ---
        const postData = {
            title: finalTitle,
            content: generatedContent,
            excerpt: finalExcerpt,
            status: postStatus || 'publish', 
            featured_media: featuredMediaId || undefined,
            categories: categoryIds, 
            tags: tagIds,            
            meta: { app_full_data: wpFullData }
        };

        const wpPost = await wpService.createPost(site, postData);

        await WpPostLog.create({
            appId: appId,
            wpSiteId: siteId,
            wpPostId: wpPost.id,
            status: 'SUCCESS',
            aiContent: generatedContent 
        });

        addLog(io, 'mW_OK', `✅ Đã đăng: ${finalTitle} (ID: ${wpPost.id})`);
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

    // === DEMO MODE ===
    if (isDemo) {
        try {
            const app = await App.findOne({ where: { appId: appIds[0] } }); 
            if (!app) return res.status(404).json({ message: "Không tìm thấy App." });

            const appData = getSafeAppData(app);
            const sites = await WpSite.findAll({ where: { id: siteIds } });
            if (sites.length === 0) return res.status(404).json({ message: "Không tìm thấy Site." });

            const demoResults = await Promise.all(sites.map(async (site) => {
                if (!site.aiPrompt) {
                    return { siteName: site.siteName, error: "Chưa cấu hình Prompt Nội dung." };
                }
                try {
                    // 1. Title
                    let demoTitle = app.title;
                    let promptTitleUsed = null;
                    if (site.aiPromptTitle && site.aiPromptTitle.trim()) {
                        demoTitle = await aiService.generateContent(openAiKey, site.aiPromptTitle, appData);
                        demoTitle = demoTitle.replace(/^"|"$/g, '').trim();
                        promptTitleUsed = site.aiPromptTitle;
                    }

                    // 2. Excerpt
                    let demoExcerpt = appData.summary || '';
                    let promptExcerptUsed = null;
                    if (site.aiPromptExcerpt && site.aiPromptExcerpt.trim()) {
                        demoExcerpt = await aiService.generateContent(openAiKey, site.aiPromptExcerpt, appData);
                        promptExcerptUsed = site.aiPromptExcerpt;
                    }

                    // 3. Content
                    const renderedContentPrompt = site.aiPrompt
                        .replace(/{title}/gi, app.title || '')
                        .replace(/{summary}/gi, appData.summary || '')
                        .replace(/{description}/gi, appData.description || '')
                        .replace(/{developer}/gi, appData.developer || '')
                        .replace(/{score}/gi, appData.scoreText || '');

                    let content = await aiService.generateContent(openAiKey, site.aiPrompt, appData);
                    
                    // 4. Footer
                    let demoFooter = '';
                    let promptFooterUsed = null;
                    if (site.aiPromptFooter && site.aiPromptFooter.trim()) {
                        demoFooter = await aiService.generateContent(openAiKey, site.aiPromptFooter, appData);
                        promptFooterUsed = site.aiPromptFooter;
                        // Noi luon vao noi dung demo de view cho de
                        content += `\n\n[FOOTER_APPEND]\n${demoFooter}`;
                    }

                    return { 
                        siteName: site.siteName, 
                        title: demoTitle,
                        excerpt: demoExcerpt,
                        content: content,
                        promptTitle: promptTitleUsed,
                        promptExcerpt: promptExcerptUsed,
                        promptContent: renderedContentPrompt,
                        promptFooter: promptFooterUsed // Tra ve de hien thi trong tab Prompt
                    };
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
    // === END DEMO ===

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
            await Promise.all(batch.map(task => processSingleItem(task.app, task.site, openAiKey, io, task.postStatus)));
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
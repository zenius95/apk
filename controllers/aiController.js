const App = require('../models/app');
const WpSite = require('../models/wpSite');
const WpPostLog = require('../models/wpPostLog');
const aiService = require('../services/aiService');
const wpService = require('../services/wpService');
const path = require('path');
const fs = require('fs');

let aiJobState = {
    isRunning: false,
    isStopping: false,
    queue: [], // +++ MOI: Quan ly queue toan cuc +++
    logs: [],
    stats: { total: 0, success: 0, failed: 0, skipped: 0 }
};

const addLog = (io, type, message) => {
    const time = new Date().toLocaleTimeString('vi-VN');
    const logEntry = { time, type, message };
    aiJobState.logs.push(logEntry);
    if (aiJobState.logs.length > 100) aiJobState.logs.shift();
    io.emit('ai_job:log', logEntry);
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

// Helper: Replace Shortcode (Tách ra để dùng chung cho Prompt và Alt)
const replaceShortcodes = (text, appData) => {
    if (!text) return '';
    return text
        .replace(/{title}/g, appData.title || '')
        .replace(/{summary}/g, appData.summary || '')
        .replace(/{description}/g, appData.description || '')
        .replace(/{developer}/g, appData.developer || '')
        .replace(/{score}/g, appData.scoreText || '');
};

// [UPDATE] Thêm tham số galleryPos, galleryAltTemplate vào hàm xử lý
async function processSingleItem(app, site, openAiKey, io, postStatus, galleryPos = 'top', galleryAltTemplate = '') {
    const appId = app.appId;
    const siteId = site.id;

    // Check Duplicate
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

        // --- MEDIA UPLOAD ---
        let wpFullData = JSON.parse(JSON.stringify(appData)); 
        let featuredMediaId = 0;
        let uploadedScreenshotIds = [];

        // +++ MOI: Parse Alt Text cho anh +++
        const finalAltText = replaceShortcodes(galleryAltTemplate, appData);

        if (wpFullData.icon) {
            const localPath = getLocalPath(wpFullData.icon);
            if (fs.existsSync(localPath)) {
                // [UPDATE] Truyen Alt Text vao uploadMedia
                const uploaded = await wpService.uploadMedia(site, localPath, finalAltText || `Icon ${appData.title}`);
                if (uploaded) { featuredMediaId = uploaded.id; wpFullData.icon = uploaded.url; }
            }
        }

        if (wpFullData.headerImage) {
            const localPath = getLocalPath(wpFullData.headerImage);
            if (fs.existsSync(localPath)) {
                // [UPDATE] Truyen Alt Text vao uploadMedia
                const uploaded = await wpService.uploadMedia(site, localPath, finalAltText || `Banner ${appData.title}`);
                if (uploaded) wpFullData.headerImage = uploaded.url; 
            }
        }

        if (wpFullData.screenshots && wpFullData.screenshots.length > 0) {
            addLog(io, 'INFO', `📸 Tìm thấy ${wpFullData.screenshots.length} ảnh screenshots trong DB.`);
            const uploadPromises = wpFullData.screenshots.map(async (ssUrl, index) => {
                const localPath = getLocalPath(ssUrl);
                if (!localPath || !fs.existsSync(localPath)) { return { url: ssUrl, id: null }; }
                
                // [UPDATE] Truyen Alt Text (DA LOAI BO SO THU TU)
                const ssAlt = finalAltText ? finalAltText : `Screenshot ${appData.title}`;
                const uploaded = await wpService.uploadMedia(site, localPath, ssAlt);
                
                return uploaded && uploaded.id ? { url: uploaded.url, id: uploaded.id } : { url: ssUrl, id: null };
            });
            const results = await Promise.all(uploadPromises);
            wpFullData.screenshots = results.map(r => r.url);
            uploadedScreenshotIds = results.map(r => r.id).filter(id => id);
            
            if(uploadedScreenshotIds.length > 0) addLog(io, 'INFO', `✨ Upload thành công ${uploadedScreenshotIds.length} ảnh.`);
        }

        // --- 4. GALLERY LOGIC (MOI: CHON VI TRI) ---
        let galleryShortcode = '';
        if (uploadedScreenshotIds.length > 0) {
            galleryShortcode = `[gallery columns="3" link="file" size="medium" ids="${uploadedScreenshotIds.join(',')}"]`;
            addLog(io, 'INFO', `📝 Đã tạo Gallery Shortcode (Vị trí: ${galleryPos}).`);
        }

        // Xử lý chèn Gallery dựa trên vị trí
        if (galleryShortcode) {
            if (galleryPos === 'top') {
                generatedContent = galleryShortcode + "\n\n" + generatedContent;
            } 
            else if (galleryPos === 'middle') {
                generatedContent = generatedContent + "\n\n" + galleryShortcode;
            }
            // Neu la 'bottom', se noi vao sau footer hoac cuoi cung
        }

        // --- 5. FOOTER CONTENT ---
        if (site.aiPromptFooter && site.aiPromptFooter.trim()) {
            const footerContent = await aiService.generateContent(openAiKey, site.aiPromptFooter, appData);
            generatedContent += `\n\n${footerContent}`; 
        }

        // [UPDATE] Xu ly Gallery Bottom (sau khi da co footer)
        if (galleryShortcode && galleryPos === 'bottom') {
            generatedContent += `\n\n${galleryShortcode}`;
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
    // [UPDATE] Lay them params galleryPos, galleryAlt
    const { appIds, siteIds, openAiKey, concurrency, delay, isDemo, postStatus, galleryPos, galleryAlt } = req.body;

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
                if (!site.aiPrompt) return { siteName: site.siteName, error: "Chưa cấu hình Prompt." };
                try {
                    let demoTitle = app.title;
                    let promptTitleUsed = null;
                    if (site.aiPromptTitle && site.aiPromptTitle.trim()) {
                        demoTitle = await aiService.generateContent(openAiKey, site.aiPromptTitle, appData);
                        demoTitle = demoTitle.replace(/^"|"$/g, '').trim();
                        promptTitleUsed = site.aiPromptTitle;
                    }
                    let demoExcerpt = appData.summary || '';
                    let promptExcerptUsed = null;
                    if (site.aiPromptExcerpt && site.aiPromptExcerpt.trim()) {
                        demoExcerpt = await aiService.generateContent(openAiKey, site.aiPromptExcerpt, appData);
                        promptExcerptUsed = site.aiPromptExcerpt;
                    }
                    let content = await aiService.generateContent(openAiKey, site.aiPrompt, appData);
                    
                    // [UPDATE] Demo Gallery Placeholder theo vi tri
                    const galleryPlaceholder = `\n[GALLERY_PLACEHOLDER: Vị trí ${galleryPos || 'top'} - Alt: "${replaceShortcodes(galleryAlt, appData) || 'Default'}"]\n`;
                    
                    if (!galleryPos || galleryPos === 'top') {
                        content = galleryPlaceholder + "\n" + content;
                    } else if (galleryPos === 'middle') {
                        content = content + "\n" + galleryPlaceholder;
                    }
                    
                    let demoFooter = '';
                    let promptFooterUsed = null;
                    if (site.aiPromptFooter && site.aiPromptFooter.trim()) {
                        demoFooter = await aiService.generateContent(openAiKey, site.aiPromptFooter, appData);
                        promptFooterUsed = site.aiPromptFooter;
                        content += `\n\n[FOOTER_APPEND]\n${demoFooter}`;
                    }

                    // [UPDATE] Demo Gallery Bottom
                    if (galleryPos === 'bottom') {
                        content += "\n" + galleryPlaceholder;
                    }

                    return { siteName: site.siteName, title: demoTitle, excerpt: demoExcerpt, content: content, promptTitle: promptTitleUsed, promptExcerpt: promptExcerptUsed, promptFooter: promptFooterUsed };
                } catch (err) { return { siteName: site.siteName, error: err.message }; }
            }));
            return res.status(200).json({ success: true, isDemo: true, appName: app.title, results: demoResults, message: "Đã tạo nội dung Demo!" });
        } catch (err) { return res.status(500).json({ message: "Lỗi Demo: " + err.message }); }
    }
    // === END DEMO ===

    const apps = await App.findAll({ where: { appId: appIds } });
    const sites = await WpSite.findAll({ where: { id: siteIds } });

    if (apps.length === 0 || sites.length === 0) return res.status(400).json({ message: "Không tìm thấy Apps hoặc Sites." });

    // RESET STATE
    aiJobState.isRunning = true;
    aiJobState.isStopping = false;
    aiJobState.logs = [];
    aiJobState.stats = { total: apps.length * sites.length, success: 0, failed: 0, skipped: 0 };
    aiJobState.queue = []; // Xoa queue cu

    // +++ NAP QUEUE MOI +++
    for (const app of apps) {
        for (const site of sites) {
            // [UPDATE] Pass them params vao queue task
            aiJobState.queue.push({ app, site, postStatus, galleryPos, galleryAlt });
        }
    }

    addLog(io, 'INFO', `🚀 BẮT ĐẦU AUTO CONTENT! Tổng: ${aiJobState.queue.length} tasks.`);
    res.status(200).json({ message: "Job đã bắt đầu!" });

    (async () => {
        const numConcurrency = parseInt(concurrency) || 1;
        const numDelay = parseInt(delay) || 2000;

        while (aiJobState.queue.length > 0) {
            if (aiJobState.isStopping) break;

            const batch = aiJobState.queue.splice(0, numConcurrency);
            // [UPDATE] Goi processSingleItem voi cac param moi tu task
            await Promise.all(batch.map(task => processSingleItem(task.app, task.site, openAiKey, io, task.postStatus, task.galleryPos, task.galleryAlt)));
            
            io.emit('ai_job:update_stats', aiJobState.stats);
            
            // Delay thong minh: Chi delay neu con hang doi va chua bi dung
            if (aiJobState.queue.length > 0 && !aiJobState.isStopping) {
                await new Promise(r => setTimeout(r, numDelay));
            }
        }

        if (aiJobState.isStopping) {
            addLog(io, 'WARN', `🛑 JOB ĐÃ DỪNG! (Đã hủy ${aiJobState.queue.length} task còn lại)`);
        } else {
            addLog(io, 'INFO', `🏁 AI Job hoàn tất! Success: ${aiJobState.stats.success}, Fail: ${aiJobState.stats.failed}, Skipped: ${aiJobState.stats.skipped}`);
        }
        
        io.emit('ai_job:done', aiJobState.stats);
        aiJobState.isRunning = false;
        aiJobState.isStopping = false;
    })();
};

// +++ FIX: STOPPING LOGIC +++
const handleStopAiJob = (req, res) => {
    if (!aiJobState.isRunning) return res.status(400).json({ message: "Không có Job nào để dừng." });
    
    aiJobState.isStopping = true;
    aiJobState.queue = []; // <--- XOA QUEUE DE DUNG NGAY
    
    addLog(req.io, 'WARN', '⚠️ Lệnh DỪNG đã được kích hoạt! Đang hủy hàng đợi...');
    return res.status(200).json({ message: "Đang dừng..." });
};

const getAiJobStatus = (req, res) => {
    res.status(200).json({ isRunning: aiJobState.isRunning, logs: aiJobState.logs, stats: aiJobState.stats });
};

module.exports = { handleStartAiJob, handleStopAiJob, getAiJobStatus };
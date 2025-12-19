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
    queue: [], 
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

// [UPDATE] Full options Shortcode
const replaceShortcodes = (text, appData) => {
    if (!text) return '';
    return text
        .replace(/{title}/g, appData.title || '')
        .replace(/{summary}/g, appData.summary || '')
        .replace(/{description}/g, appData.description || '')
        .replace(/{developer}/g, appData.developer || '')
        .replace(/{score}/g, appData.scoreText || '')
        // New Shortcodes
        .replace(/{url}/g, appData.url || '#')
        .replace(/{version}/g, appData.version || 'Latest')
        .replace(/{size}/g, appData.size || 'Varies with device')
        .replace(/{updated}/g, appData.updated ? new Date(appData.updated).toLocaleDateString('vi-VN') : 'Unknown')
        .replace(/{genre}/g, appData.genre || 'App')
        .replace(/{installs}/g, appData.installs || 'N/A')
        .replace(/{icon}/g, appData.icon || '');
};

async function processSingleItem(app, site, openAiKey, io, postStatus) {
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
        let uploadedScreenshots = []; // Luu object {id, url, alt}

        // Parse Alt Text & Prepare Random Lines
        const galleryAltRaw = site.galleryAlt || ''; 
        const galleryAltLines = galleryAltRaw.split('\n').map(line => line.trim()).filter(line => line);

        const featAltTemplate = site.featuredImageAlt || '';
        const finalFeatAlt = replaceShortcodes(featAltTemplate, appData);

        let isHeaderUploaded = false; // Biến cờ để đánh dấu

        // 1. Ưu tiên xử lý Header Image trước
        if (wpFullData.headerImage) {
            const localPath = getLocalPath(wpFullData.headerImage);
            if (fs.existsSync(localPath)) {
                const uploaded = await wpService.uploadMedia(site, localPath, finalFeatAlt || `Banner ${appData.title}`);
                if (uploaded) { 
                    wpFullData.headerImage = uploaded.url;
                    featuredMediaId = uploaded.id; // Set luôn làm ảnh đại diện
                    isHeaderUploaded = true; // Đánh dấu là đã có hàng xịn
                }
            }
        }

        // 2. Chỉ upload Icon nếu KHÔNG có Header (hoặc upload Header bị lỗi)
        if (!isHeaderUploaded && wpFullData.icon) {
            const localPath = getLocalPath(wpFullData.icon);
            if (fs.existsSync(localPath)) {
                const uploaded = await wpService.uploadMedia(site, localPath, finalFeatAlt || `Icon ${appData.title}`);
                if (uploaded) { 
                    featuredMediaId = uploaded.id; // Lấy Icon làm ảnh đại diện (chữa cháy)
                    wpFullData.icon = uploaded.url; 
                }
            }
        }

        if (wpFullData.screenshots && wpFullData.screenshots.length > 0) {
            addLog(io, 'INFO', `📸 Tìm thấy ${wpFullData.screenshots.length} ảnh screenshots trong DB.`);
            
            const uploadPromises = wpFullData.screenshots.map(async (ssUrl, index) => {
                const localPath = getLocalPath(ssUrl);
                if (!localPath || !fs.existsSync(localPath)) { return { url: ssUrl, id: null, alt: '' }; }
                
                // Logic Random Alt Line
                let selectedTemplate = '';
                if (galleryAltLines.length > 0) {
                    selectedTemplate = galleryAltLines[Math.floor(Math.random() * galleryAltLines.length)];
                }

                let ssAlt = replaceShortcodes(selectedTemplate, appData);
                if (!ssAlt) ssAlt = `Screenshot ${appData.title}`;
                
                // Manual number {i}
                if (ssAlt.includes('{i}')) {
                    ssAlt = ssAlt.replace(/{i}/g, index + 1);
                }

                const uploaded = await wpService.uploadMedia(site, localPath, ssAlt);
                
                return uploaded && uploaded.id ? { url: uploaded.url, id: uploaded.id, alt: ssAlt } : { url: ssUrl, id: null, alt: '' };
            });
            
            uploadedScreenshots = await Promise.all(uploadPromises);
            wpFullData.screenshots = uploadedScreenshots.map(r => r.url);
            
            const successCount = uploadedScreenshots.filter(r => r.id).length;
            if(successCount > 0) addLog(io, 'INFO', `✨ Upload thành công ${successCount} ảnh.`);
        }

        // --- 4. DISPLAY MODE LOGIC (GALLERY vs NORMAL) ---
        let imagesHtml = '';
        const validScreenshots = uploadedScreenshots.filter(item => item.id);

        if (validScreenshots.length > 0) {
            if (site.screenshotMode === 'normal') {
                // +++ MOI: Che do Anh thuong +++
                imagesHtml = validScreenshots.map(img => {
                    return `<p style="text-align: center;"><img src="${img.url}" alt="${img.alt}" class="aligncenter size-full wp-image-${img.id}" style="max-width: 100%; height: auto;" /></p>`;
                }).join('\n');
                addLog(io, 'INFO', `🖼️ Đã tạo HTML danh sách ảnh thường.`);
            } else {
                // Che do Gallery (Mac dinh)
                const ids = validScreenshots.map(img => img.id).join(',');
                imagesHtml = `[gallery columns="3" link="file" size="medium" ids="${ids}"]`;
                addLog(io, 'INFO', `📝 Đã tạo Gallery Shortcode.`);
            }
        }

        // Insert Images (Sau content)
        if (imagesHtml) {
            generatedContent += `\n\n${imagesHtml}`;
        }

        // --- 5. FOOTER CONTENT ---
        if (site.aiPromptFooter && site.aiPromptFooter.trim()) {
            const footerContent = await aiService.generateContent(openAiKey, site.aiPromptFooter, appData);
            generatedContent += `\n\n${footerContent}`; 
        }

        // --- 6. DOWNLOAD LINK & SCRIPT ---
        if (site.downloadLink && site.downloadLink.trim()) {
            let finalDownloadLink = replaceShortcodes(site.downloadLink, appData);
            
            // Logic Script Countdown (Manual Click)
            if (site.downloadWaitTime && site.downloadWaitTime > 0) {
                const waitTime = parseInt(site.downloadWaitTime);
                const uniqueId = `dl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                
                const scriptWrapper = `
<div id="${uniqueId}" class="download-wrapper">${finalDownloadLink}</div>
<script>
(function(){var wrapper=document.getElementById('${uniqueId}');if(!wrapper)return;var btn=wrapper.querySelector('a');if(!btn)return;var originalHref=btn.href;var originalText=btn.innerText;var seconds=${waitTime};btn.href='javascript:void(0)';btn.onclick=function(e){e.preventDefault();if(btn.dataset.processing==='true')return;btn.dataset.processing='true';var count=seconds;btn.innerText='Xin chờ '+count+' giây...';var interval=setInterval(function(){count--;if(count<=0){clearInterval(interval);btn.innerText=originalText;btn.dataset.processing='false';btn.href=originalHref;btn.onclick=null;}else{btn.innerText='Xin chờ '+count+' giây...';}},1000);};})();
</script>`.replace(/[\r\n]+/g, '');

                finalDownloadLink = scriptWrapper;
                addLog(io, 'INFO', `⏳ Đã thêm script đếm ngược ${waitTime}s (Manual Click) cho nút Download.`);
            }

            generatedContent += `\n\n${finalDownloadLink}`;
            addLog(io, 'INFO', `🔗 Đã chèn Download Link (Cuối bài).`);
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
                    
                    // Demo Gallery/Normal Images
                    const galleryAltRaw = site.galleryAlt || '';
                    const galleryAltLines = galleryAltRaw.split('\n').map(l => l.trim()).filter(l => l);
                    let demoAltLine = galleryAltLines.length > 0 ? galleryAltLines[0] : `Screenshot ${appData.title}`;
                    demoAltLine = replaceShortcodes(demoAltLine, appData);
                    
                    let imagesPlaceholder = '';
                    if (site.screenshotMode === 'normal') {
                        imagesPlaceholder = `\n[NORMAL IMAGES AUTO]\n<img src="demo1.jpg" alt="${demoAltLine} 1" ...>\n<img src="demo2.jpg" alt="${demoAltLine} 2" ...>\n`;
                    } else {
                        imagesPlaceholder = `\n[GALLERY_AUTO]\n(Shortcode [gallery ...])\n`;
                    }
                    content += "\n" + imagesPlaceholder;

                    // Demo Footer
                    let demoFooter = '';
                    let promptFooterUsed = null;
                    if (site.aiPromptFooter && site.aiPromptFooter.trim()) {
                        demoFooter = await aiService.generateContent(openAiKey, site.aiPromptFooter, appData);
                        promptFooterUsed = site.aiPromptFooter;
                        content += `\n\n[FOOTER_APPEND]\n${demoFooter}`;
                    }

                    // Demo Download Link
                    if (site.downloadLink && site.downloadLink.trim()) {
                        let demoDownloadLink = replaceShortcodes(site.downloadLink, appData);
                        if (site.downloadWaitTime > 0) {
                            demoDownloadLink += `\n<br><i>[AUTO SCRIPT: Countdown ${site.downloadWaitTime}s then Restore Link (Manual Click)]</i>`;
                        }
                        content += `\n\n${demoDownloadLink}`;
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

    aiJobState.isRunning = true;
    aiJobState.isStopping = false;
    aiJobState.logs = [];
    aiJobState.stats = { total: apps.length * sites.length, success: 0, failed: 0, skipped: 0 };
    aiJobState.queue = []; 

    for (const app of apps) {
        for (const site of sites) {
            aiJobState.queue.push({ app, site, postStatus });
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
            await Promise.all(batch.map(task => processSingleItem(task.app, task.site, openAiKey, io, task.postStatus)));
            
            io.emit('ai_job:update_stats', aiJobState.stats);
            
            if (aiJobState.queue.length > 0 && !aiJobState.isStopping) {
                await new Promise(r => setTimeout(r, numDelay));
            }
        }

        if (aiJobState.isStopping) {
            addLog(io, 'WARN', `🛑 JOB ĐÃ DỪNG!`);
        } else {
            addLog(io, 'INFO', `🏁 AI Job hoàn tất! Success: ${aiJobState.stats.success}, Fail: ${aiJobState.stats.failed}, Skipped: ${aiJobState.stats.skipped}`);
        }
        
        io.emit('ai_job:done', aiJobState.stats);
        aiJobState.isRunning = false;
        aiJobState.isStopping = false;
    })();
};

const handleStopAiJob = (req, res) => {
    if (!aiJobState.isRunning) return res.status(400).json({ message: "Không có Job nào để dừng." });
    aiJobState.isStopping = true;
    aiJobState.queue = []; 
    addLog(req.io, 'WARN', '⚠️ Lệnh DỪNG đã được kích hoạt! Đang hủy hàng đợi...');
    return res.status(200).json({ message: "Đang dừng..." });
};

const getAiJobStatus = (req, res) => {
    res.status(200).json({ isRunning: aiJobState.isRunning, logs: aiJobState.logs, stats: aiJobState.stats });
};

module.exports = { handleStartAiJob, handleStopAiJob, getAiJobStatus };
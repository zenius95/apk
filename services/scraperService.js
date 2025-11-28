const { default: gplay } = require('google-play-scraper');
const App = require('../models/app');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Ham helper de download 1 file anh
 */
async function downloadImage(url, filepath) {
  if (!url) return Promise.resolve(null); 

  try {
    await fs.ensureDir(path.dirname(filepath));
    const writer = fs.createWriteStream(filepath);
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream'
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', (err) => {
        console.error(`[Service] Loi pipe/write image ${filepath}: ${err.message}`);
        reject(err);
      });
    });
  } catch (err) {
    console.error(`[Service] Loi download image ${url}: ${err.message}`);
    return Promise.reject(err);
  }
}

/**
 * Lay du lieu chi tiet cua 1 app va luu vao DB
 */
async function scrapeAndSave(appId) {
  console.log(`[Service] Bat dau lay du lieu cho: ${appId}`);
  try {
    // 1. Goi API lay du lieu goc
    const appData = await gplay.app({ appId: appId });

    // --- 2. DOWNLOAD & XU LY ANH (TOI UU) ---
    const appImgDir = path.join(__dirname, '..', 'public', 'images', 'apps', appId);
    
    const imageTasks = [];
    const localPaths = {
        icon: null,
        headerImage: null,
        screenshots: []
    };

    // Task cho Icon
    if (appData.icon) {
        const iconPath = path.join(appImgDir, 'icon.png');
        const p = downloadImage(appData.icon, iconPath)
            .then(() => { localPaths.icon = `/images/apps/${appId}/icon.png`; });
        imageTasks.push(p);
    }

    // Task cho Header
    if (appData.headerImage) {
        const headerPath = path.join(appImgDir, 'header.jpg');
        const p = downloadImage(appData.headerImage, headerPath)
            .then(() => { localPaths.headerImage = `/images/apps/${appId}/header.jpg`; });
        imageTasks.push(p);
    }

    // Task cho Screenshots
    if (appData.screenshots && appData.screenshots.length > 0) {
        // Khoi tao mang screenshots voi kich thuoc dung
        localPaths.screenshots = new Array(appData.screenshots.length).fill(null);
        
        appData.screenshots.forEach((ssUrl, i) => {
            const ssName = `ss-${i + 1}.jpg`;
            const ssPath = path.join(appImgDir, ssName);
            const p = downloadImage(ssUrl, ssPath)
                .then(() => { 
                    localPaths.screenshots[i] = `/images/apps/${appId}/${ssName}`; 
                });
            imageTasks.push(p);
        });
    }

    // CHAY DONG LOAT (Dung allSettled de 1 anh chet khong lam chet ca job)
    await Promise.allSettled(imageTasks);
    
    // Loc bo cac phan tu null trong screenshots (neu co anh loi hoac mang thua)
    localPaths.screenshots = localPaths.screenshots.filter(Boolean);

    console.log(`[Service] 🖼️  Da xu ly xong download anh cho ${appId}.`);
    // --- KET THUC XU LY ANH ---


    // 3. PHAN LOAI APP/GAME
    const appType = appData.genreId && appData.genreId.startsWith('GAME') ? 'GAME' : 'APP';

    // 4. Chuan bi du lieu de luu
    if (localPaths.icon) appData.icon = localPaths.icon;
    if (localPaths.headerImage) appData.headerImage = localPaths.headerImage;
    appData.screenshots = localPaths.screenshots;

    const dataToSave = {
      appId: appData.appId,
      title: appData.title,
      appType: appType,
      fullData: appData
    };

    // 5. Luu vao DB
    const [appInstance, created] = await App.upsert(dataToSave);

    if (created) {
      console.log(`[Service] ✅ DA LUU (Moi): ${appData.title}`);
    } else {
      console.log(`[Service] ✅ DA CAP NHAT (Cu): ${appData.title}`);
    }

    return { success: true, appId: appId, data: appInstance, created: created };

  } catch (err) {
    console.error(`[Service] ❌ LOI khi scrape app ${appId}: ${err.message}`);
    return { success: false, appId: appId, error: err.message };
  }
}

module.exports = {
  scrapeAndSave,
  sleep
};
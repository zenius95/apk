const { default: gplay } = require('google-play-scraper');
const App = require('../models/app');
const axios = require('axios'); // +++ MOI
const fs = require('fs-extra'); // +++ MOI
const path = require('path'); // +++ MOI

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * +++ MOI: Ham helper de download 1 file anh
 * @param {string} url Link anh
 * @param {string} filepath Duong dan de luu file
 */
async function downloadImage(url, filepath) {
  if (!url) return Promise.resolve(null); // Bo qua neu URL rong

  try {
    // Dam bao thu muc chua file ton tai
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
        reject(err); // Bao loi de Promise.allSettled biet
      });
    });
  } catch (err) {
    console.error(`[Service] Loi download image ${url}: ${err.message}`);
    return Promise.reject(err); // Bao loi de Promise.allSettled biet
  }
}

/**
 * Lay du lieu chi tiet cua 1 app va luu vao DB (DA CAP NHAT)
 * @returns {Promise<object>} Ket qua { success, data (appInstance), created, error }
 */
async function scrapeAndSave(appId) {
  console.log(`[Service] Bat dau lay du lieu cho: ${appId}`);
  try {
    // 1. Goi API lay du lieu goc
    const appData = await gplay.app({ appId: appId });

    // --- 2. MOI: DOWNLOAD & XU LY ANH ---
    const appImgDir = path.join(__dirname, '..', 'public', 'images', 'apps', appId);
    const tasks = [];
    const localPaths = {
        icon: null,
        headerImage: null,
        screenshots: []
    };

    // Task cho Icon
    if (appData.icon) {
        const iconPath = path.join(appImgDir, 'icon.png');
        tasks.push(downloadImage(appData.icon, iconPath)
            .then(() => { localPaths.icon = `/images/apps/${appId}/icon.png`; })
            .catch(() => {}) // Neu loi thi bo qua
        );
    }

    // Task cho Header
    if (appData.headerImage) {
        const headerPath = path.join(appImgDir, 'header.jpg');
        tasks.push(downloadImage(appData.headerImage, headerPath)
            .then(() => { localPaths.headerImage = `/images/apps/${appId}/header.jpg`; })
            .catch(() => {})
        );
    }

    // Task cho Screenshots
    if (appData.screenshots && appData.screenshots.length > 0) {
        let ssTasks = appData.screenshots.map((ssUrl, i) => {
            const ssName = `ss-${i + 1}.jpg`;
            const ssPath = path.join(appImgDir, ssName);
            const localSsPath = `/images/apps/${appId}/${ssName}`;

            return downloadImage(ssUrl, ssPath)
                .then(() => localSsPath) // Tra ve local path neu thanh cong
                .catch(() => null); // Tra ve null neu loi
        });
        // Gan ket qua vao localPaths.screenshots
        tasks.push(
            Promise.all(ssTasks).then(paths => {
                localPaths.screenshots = paths.filter(Boolean); // Loc bo cac cai null (loi)
            })
        );
    }

    // Cho tat ca cac task (download + gan path) hoan tat
    await Promise.all(tasks);
    console.log(`[Service] 🖼️  Da xu ly xong download anh cho ${appId}.`);
    // --- KET THUC XU LY ANH ---


    // 3. PHAN LOAI APP/GAME
    const appType = appData.genreId && appData.genreId.startsWith('GAME') ? 'GAME' : 'APP';

    // 4. Chuan bi du lieu de luu

    // +++ CAP NHAT appData goc voi local paths +++
    if (localPaths.icon) appData.icon = localPaths.icon;
    if (localPaths.headerImage) appData.headerImage = localPaths.headerImage;
    appData.screenshots = localPaths.screenshots; // Gan mang da loc

    const dataToSave = {
      appId: appData.appId,
      title: appData.title,
      appType: appType,
      fullData: appData // appData bay gio da chua local URLs
    };

    // 5. Luu vao DB (Upsert)
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
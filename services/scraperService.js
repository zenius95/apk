const { default: gplay } = require('google-play-scraper'); // <-- SUA DONG NAY
const App = require('../models/app'); // Import Model

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Lay du lieu chi tiet cua 1 app va luu vao DB
 * @returns {Promise<object>} Ket qua { success, data (appInstance), created, error }
 */
async function scrapeAndSave(appId) {
  console.log(`[Service] Bat dau lay du lieu cho: ${appId}`);
  try {
    // 1. Goi API lay du lieu
    const appData = await gplay.app({ appId: appId });

    // PHAN LOAI APP/GAME
    const appType = appData.genreId && appData.genreId.startsWith('GAME') ? 'GAME' : 'APP';

    // 2. Chuan bi du lieu de luu
    const dataToSave = {
      appId: appData.appId,
      title: appData.title,
      appType: appType,
      fullData: appData
    };

    // 3. Luu vao DB (Upsert)
    const [appInstance, created] = await App.upsert(dataToSave);

    if (created) {
      console.log(`[Service] ✅ DA LUU (Moi): ${appData.title}`);
    } else {
      console.log(`[Service] ✅ DA CAP NHAT (Cu): ${appData.title}`);
    }

    // TRA VE appInstance (da co du lieu tu DB)
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
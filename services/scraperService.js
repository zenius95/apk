const gplay = require('google-play-scraper');
const App = require('../models/app'); // Import Model

/**
 * Ham sleep de "nghi" giua cac request
 * @param {number} ms So miligiay can cho
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Lay du lieu chi tiet cua 1 app va luu vao DB
 * Su dung App.upsert() de tu dong UPDATE neu da ton tai (dua tren primaryKey: appId)
 * hoac INSERT neu la app moi.
 *
 * @param {string} appId ID cua app (vd: com.google.android.gm)
 * @returns {Promise<object>} Ket qua { success, data, created, error }
 */
async function scrapeAndSave(appId) {
  console.log(`[Service] Bat dau lay du lieu cho: ${appId}`);
  try {
    // 1. Goi API lay du lieu
    // Su dung gplay.app() de lay full detail
    const appData = await gplay.app({ appId: appId });

    // 2. Chuan bi du lieu de luu (theo model da toi uu)
    const dataToSave = {
      appId: appData.appId, // Dam bao lay appId tu data tra ve
      title: appData.title, // Luu truong title rieng de truy van
      fullData: appData     // Luu toan bo data vao cot JSON
    };

    // 3. Luu vao DB (Upsert = Update + Insert)
    // lastScrapedAt se tu dong cap nhat (vi ta map no voi 'updatedAt' trong model)
    const [appInstance, created] = await App.upsert(dataToSave);

    if (created) {
      console.log(`[Service] ✅ DA LUU (Moi): ${appData.title}`);
    } else {
      console.log(`[Service] ✅ DA CAP NHAT (Cu): ${appData.title}`);
    }

    return { success: true, appId: appId, data: appInstance, created: created };

  } catch (err) {
    console.error(`[Service] ❌ LOI khi scrape app ${appId}: ${err.message}`);
    // Tra ve loi de controller biet duong xu ly
    return { success: false, appId: appId, error: err.message };
  }
}

module.exports = {
  scrapeAndSave,
  sleep
};
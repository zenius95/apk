const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

/**
 * Tao Header Auth (Basic Auth)
 */
function getAuthHeader(apiKey) {
    const token = Buffer.from(apiKey).toString('base64');
    return {
        'Authorization': `Basic ${token}`
    };
}

/**
 * Upload 1 file anh len WP Media Library
 * Tra ve { id, url }
 * [UPDATE] Them tham so altText
 */
async function uploadMedia(site, localPath, altText = '') {
    if (!fs.existsSync(localPath)) return null;

    const formData = new FormData();
    formData.append('file', fs.createReadStream(localPath));

    // +++ MOI: Chi them Alt Text (van ban thay the), khong them caption/description +++
    if (altText) {
        formData.append('alt_text', altText);
    }

    try {
        const res = await axios.post(`${site.siteUrl}/wp-json/wp/v2/media`, formData, {
            headers: {
                ...getAuthHeader(site.apiKey),
                ...formData.getHeaders()
            }
        });

        return {
            id: res.data.id,
            url: res.data.source_url
        };
    } catch (err) {
        console.error(`[WP Service] Upload anh loi (${site.siteUrl}):`, err.message);
        return null;
    }
}

/**
 * +++ MOI: Tim hoac Tao Category/Tag +++
 * @param {string} taxonomy 'categories' hoac 'tags'
 * @param {string} name Ten Can Tao/Tim
 */
async function ensureTerm(site, taxonomy, name, logger = null, maxRetries = 2) {
    if (!name) return null;

    let endpoint = taxonomy;
    if (taxonomy === 'category') endpoint = 'categories';
    if (taxonomy === 'tag') endpoint = 'tags';

    const authHeader = getAuthHeader(site.apiKey);
    const log = (type, msg) => {
        if (logger && typeof logger === 'function') logger(type, msg);
        else console.log(`[WP Service] ${type}: ${msg}`);
    };

    let attempt = 0;
    while (attempt <= maxRetries) {
        attempt++;
        if (attempt > 1) {
            log('WARN', `⚠️ Đang thử lại (${attempt - 1}/${maxRetries}) tạo/tìm Term: ${name}...`);
        }

        try {
            // 1. Thu tao moi truc tiep
            const res = await axios.post(`${site.siteUrl}/wp-json/wp/v2/${endpoint}`, {
                name: name
            }, {
                headers: {
                    ...authHeader,
                    'Content-Type': 'application/json'
                }
            });
            // Tao thanh cong -> Tra ve ID
            log('INFO', `✨ Đã tạo mới ${taxonomy}: ${name} (ID: ${res.data.id})`);
            return res.data.id;

        } catch (err) {
            // 2. Neu loi do da ton tai (term_exists) hoac 400
            if (err.response && (err.response.data.code === 'term_exists' || err.response.status === 400)) {
                try {
                    const searchRes = await axios.get(`${site.siteUrl}/wp-json/wp/v2/${endpoint}?search=${encodeURIComponent(name)}`, {
                        headers: authHeader
                    });
                    const found = searchRes.data.find(t => t.name.toLowerCase() === name.toLowerCase());
                    if (found) {
                        log('INFO', `✅ Tìm thấy ${taxonomy}: ${name} (ID: ${found.id})`);
                        return found.id;
                    }
                } catch (searchErr) {
                    console.error(`[WP Service] Loi tim kiem Term ${name}:`, searchErr.message);
                }
            }

            // Neu la loi khac hoac khong tim thay sau khi loi -> Retry neu con luot
            console.error(`[WP Service] Loi xu ly Term (${endpoint} - ${name}) - Lan ${attempt}:`, err.message);

            if (attempt <= maxRetries) {
                // Wait small delay before retry
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }
        }
    }

    log('ERR', `❌ Thất bại tạo/tìm ${taxonomy}: ${name} sau ${maxRetries + 1} lần thử.`);
    return null;
}

/**
 * Kiem tra bai viet co ton tai tren WP khong (Check 404)
 */
async function checkPostExists(site, postId) {
    if (!postId) return false;
    try {
        // GET /wp-json/wp/v2/posts/{id}
        // Chi can check status 200 la OK
        await axios.get(`${site.siteUrl}/wp-json/wp/v2/posts/${postId}`, {
            headers: getAuthHeader(site.apiKey)
        });
        return true;
    } catch (err) {
        // Neu loi 404 -> Bai viet da bi xoa
        if (err.response && err.response.status === 404) {
            return false;
        }
        // Cac loi khac (500, mang...) -> Coi nhu ton tai de an toan, hoac throw tuy logic
        // O day ta tra ve true de tranh spam post moi neu chi la loi mang nhat thoi
        // Tuy nhien, neu muon chac an co the log loi
        console.error(`[WP Service] Check Exist Failure (${postId}):`, err.message);
        return true;
    }
}

/**
 * Dang bai viet moi
 */
async function createPost(site, postData) {
    try {
        const res = await axios.post(`${site.siteUrl}/wp-json/wp/v2/posts`, postData, {
            headers: {
                ...getAuthHeader(site.apiKey),
                'Content-Type': 'application/json'
            }
        });
        return res.data;
    } catch (err) {
        console.error(`[WP Service] Dang bai loi (${site.siteUrl}):`, err.response?.data?.message || err.message);
        throw new Error(err.response?.data?.message || "Loi ket noi WP");
    }
}

module.exports = { uploadMedia, createPost, ensureTerm, checkPostExists };
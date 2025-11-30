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
 */
async function uploadMedia(site, localPath) {
    if (!fs.existsSync(localPath)) return null;

    const formData = new FormData();
    formData.append('file', fs.createReadStream(localPath));

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
async function ensureTerm(site, taxonomy, name) {
    if (!name) return null;
    
    // API endpoint: /wp-json/wp/v2/categories hoac /wp-json/wp/v2/tags
    // Luu y: Tham so taxonomy truyen vao nen la 'categories' hoac 'tags'
    // Nhung neu nguoi dung truyen 'category' hay 'tag' (so it) thi minh map lai cho dung
    let endpoint = taxonomy;
    if (taxonomy === 'category') endpoint = 'categories';
    if (taxonomy === 'tag') endpoint = 'tags';

    const authHeader = getAuthHeader(site.apiKey);

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
        return res.data.id;

    } catch (err) {
        // 2. Neu loi do da ton tai (term_exists) hoac 400
        if (err.response && (err.response.data.code === 'term_exists' || err.response.status === 400)) {
             // Thuong thi WP se tra ve ID cua term da ton tai trong data error, nhung de chac an nhat:
             // Goi API Search de tim ID cua ten do
             try {
                 const searchRes = await axios.get(`${site.siteUrl}/wp-json/wp/v2/${endpoint}?search=${encodeURIComponent(name)}`, {
                    headers: authHeader
                 });
                 // Tim item co ten khop nhat (vi search co the ra ket qua gan dung)
                 const found = searchRes.data.find(t => t.name.toLowerCase() === name.toLowerCase());
                 return found ? found.id : null;
             } catch (searchErr) {
                 console.error(`[WP Service] Loi tim kiem Term ${name}:`, searchErr.message);
                 return null;
             }
        }
        
        console.error(`[WP Service] Loi xu ly Term (${endpoint} - ${name}):`, err.message);
        return null;
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

module.exports = { uploadMedia, createPost, ensureTerm };
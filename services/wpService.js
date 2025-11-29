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
        
        // +++ UPDATE: Tra ve ca ID va URL +++
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

module.exports = { uploadMedia, createPost };
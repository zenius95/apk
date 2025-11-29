const OpenAI = require("openai");

/**
 * Goi OpenAI de tao noi dung
 * @param {string} apiKey Key API cua Bro
 * @param {string} promptTemplate Prompt mau (co shortcode)
 * @param {object} appData Du lieu app de replace vao shortcode
 */
async function generateContent(apiKey, promptTemplate, appData) {
    if (!apiKey) throw new Error("Thieu OpenAI API Key");
    if (!promptTemplate) throw new Error("Thieu Prompt mau");

    const openai = new OpenAI({ apiKey: apiKey });

    // 1. Replace Shortcode
    let finalPrompt = promptTemplate
        .replace(/{title}/g, appData.title || '')
        .replace(/{summary}/g, appData.summary || '')
        .replace(/{description}/g, appData.description || '')
        .replace(/{developer}/g, appData.developer || '')
        .replace(/{score}/g, appData.scoreText || '');

    // 2. Goi AI
    try {
        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: finalPrompt }],
            model: "gpt-3.5-turbo", // Hoac gpt-4 neu Bro giau
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error("[AI Service] Loi goi OpenAI:", error);
        throw error;
    }
}

module.exports = { generateContent };
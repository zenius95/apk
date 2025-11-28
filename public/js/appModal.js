/*
 * File: public/js/appModal.js
 * Phien ban "Bat tu": Khong crash khi thieu element hoac data
 */

// Dinh nghia ham global ngay lap tuc, khong cho DOMContentLoaded
window.showAppDetailModal = function(data) {
    console.log("🚀 Gọi Modal với data:", data); // Debug xem data vao chua

    // 1. Lay Modal (bat buoc phai co)
    const appDetailModal = document.getElementById('appDetailModal');
    if (!appDetailModal) {
        console.error("❌ Lỗi: Không tìm thấy element #appDetailModal trong HTML");
        alert("Lỗi giao diện: Thiếu Modal HTML. Hãy kiểm tra file main.ejs");
        return;
    }

    const modalBodyScroll = document.getElementById('modal-body-scroll');

    // 2. Ham helper an toan de gan text
    const setText = (id, value, fallback = 'N/A') => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = (value !== null && value !== undefined && value !== '') ? value : fallback;
        } else {
            console.warn(`⚠️ Cảnh báo: Không tìm thấy ID #${id} trong HTML`);
        }
    };

    // 3. Ham helper an toan de gan anh
    const setImg = (id, src) => {
        const el = document.getElementById(id);
        if (el) {
            if (src) {
                el.src = src;
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden'); // An neu khong co anh
            }
        }
    };

    // 4. Format so & ngay thang
    const formatNumber = (num) => {
        return (typeof num === 'number') ? new Intl.NumberFormat('en-US').format(num) : num;
    };
    
    const formatDate = (ts) => {
        if (!ts) return 'N/A';
        const d = new Date(ts);
        return isNaN(d.getTime()) ? ts : d.toLocaleDateString('vi-VN');
    };

    // --- BAT DAU BOM DATA ---
    try {
        setText('modal-header-title', data.title, 'Chi tiết App');
        setText('modal-title', data.title);
        setText('modal-developer', data.developer);
        setText('modal-score', data.scoreText);
        setText('modal-reviews', `(${formatNumber(data.reviews) || '0'} reviews)`);
        setText('modal-installs', data.installs);
        setText('modal-price', data.priceText, 'Free');
        setText('modal-genre', data.genre);
        setText('modal-size', data.size);
        setText('modal-version', data.version);
        setText('modal-updated', formatDate(data.updated));
        setText('modal-rating', data.contentRating);

        // Xu ly Link
        const playLinkEl = document.getElementById('modal-play-link');
        if (playLinkEl) playLinkEl.href = data.url || '#';

        // Xu ly Icon
        setImg('modal-icon', data.icon || 'https://placehold.co/100x100?text=No+Icon');

        // Xu ly Header Image
        setImg('modal-header-image', data.headerImage);

        // Xu ly Description (HTML)
        const descEl = document.getElementById('modal-description');
        if (descEl) {
            descEl.innerHTML = data.description || '<p class="text-slate-500 italic">Chưa có mô tả.</p>';
        }

        // Xu ly Screenshots
        const ssContainer = document.getElementById('modal-screenshots');
        if (ssContainer) {
            ssContainer.innerHTML = ''; // Xoa cu
            if (data.screenshots && Array.isArray(data.screenshots) && data.screenshots.length > 0) {
                data.screenshots.forEach(ssUrl => {
                    const img = document.createElement('img');
                    img.src = ssUrl;
                    img.className = 'h-40 rounded-md flex-shrink-0 border border-slate-700/50 cursor-pointer hover:opacity-90 transition';
                    // Click vao anh de xem to (neu thich lam sau)
                    ssContainer.appendChild(img);
                });
            } else {
                ssContainer.innerHTML = '<p class="text-sm text-slate-500 italic p-2 w-full text-center">Không có ảnh chụp màn hình.</p>';
            }
        }

        // Hien Modal
        appDetailModal.classList.remove('hidden');
        if (modalBodyScroll) modalBodyScroll.scrollTop = 0;

    } catch (err) {
        console.error("❌ CRASH khi render modal:", err);
        alert("Có lỗi khi hiển thị dữ liệu app này. Check Console đi Bro.");
    }
};

// Gan su kien dong Modal (chay khi DOM load xong)
document.addEventListener('DOMContentLoaded', () => {
    const appDetailModal = document.getElementById('appDetailModal');
    const modalBackdrop = document.getElementById('modalBackdrop');
    const modalCloseBtn = document.getElementById('modalCloseBtn');

    const closeModal = () => {
        if(appDetailModal) appDetailModal.classList.add('hidden');
    };

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
});
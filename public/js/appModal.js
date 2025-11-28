/*
 * File: public/js/appModal.js
 * Xu ly rieng cho App Detail Modal
 */
document.addEventListener('DOMContentLoaded', () => {
    // Lay linh kien Modal
    const appDetailModal = document.getElementById('appDetailModal');
    if (!appDetailModal) return;

    const modalBackdrop = document.getElementById('modalBackdrop');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalBodyScroll = document.getElementById('modal-body-scroll');

    // Placeholders
    const modalHeaderTitle = document.getElementById('modal-header-title');
    const modalIcon = document.getElementById('modal-icon');
    const modalTitle = document.getElementById('modal-title');
    const modalDeveloper = document.getElementById('modal-developer');
    const modalPlayLink = document.getElementById('modal-play-link');
    
    const modalScore = document.getElementById('modal-score');
    const modalReviews = document.getElementById('modal-reviews');
    const modalInstalls = document.getElementById('modal-installs');
    const modalPrice = document.getElementById('modal-price');
    const modalGenre = document.getElementById('modal-genre');
    const modalSize = document.getElementById('modal-size');
    const modalVersion = document.getElementById('modal-version');
    const modalUpdated = document.getElementById('modal-updated');
    const modalRating = document.getElementById('modal-rating');

    const modalHeaderImage = document.getElementById('modal-header-image');
    const modalScreenshots = document.getElementById('modal-screenshots');
    const modalDescription = document.getElementById('modal-description');

    // Helper format
    const formatNumber = (num) => {
        if (typeof num !== 'number') return num;
        return new Intl.NumberFormat('en-US').format(num);
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return timestamp;
        return date.toLocaleDateString('vi-VN');
    };

    // Ham hien thi Modal (Global)
    window.showAppDetailModal = (data) => {
        if (!data) return;

        // Bom data vao modal
        modalHeaderTitle.textContent = data.title || 'Chi tiết App';
        modalIcon.src = data.icon || '';
        modalTitle.textContent = data.title || 'N/A';
        modalDeveloper.textContent = data.developer || 'N/A';
        modalPlayLink.href = data.url || '#';
        
        modalScore.textContent = data.scoreText || 'N/A';
        modalReviews.textContent = `(${formatNumber(data.reviews) || 'N/A'} reviews)`;
        modalInstalls.textContent = data.installs || 'N/A';
        modalPrice.textContent = data.priceText || 'N/A';
        modalGenre.textContent = data.genre || 'N/A';
        modalSize.textContent = data.size || 'N/A';
        modalVersion.textContent = data.version || 'N/A';
        modalUpdated.textContent = formatDate(data.updated);
        modalRating.textContent = data.contentRating || 'N/A';

        // Mo ta
        modalDescription.innerHTML = data.description || '<p class="text-slate-500">Không có mô tả.</p>';
        
        // Header Image
        if (data.headerImage) {
            modalHeaderImage.src = data.headerImage;
            modalHeaderImage.classList.remove('hidden');
        } else {
            modalHeaderImage.classList.add('hidden');
        }

        // Screenshots
        modalScreenshots.innerHTML = '';
        if (data.screenshots && data.screenshots.length > 0) {
            data.screenshots.forEach(ssUrl => {
                const img = document.createElement('img');
                img.src = ssUrl;
                img.className = 'h-40 rounded-md flex-shrink-0';
                modalScreenshots.appendChild(img);
            });
        } else {
            modalScreenshots.innerHTML = '<p class="text-sm text-slate-500">Không có ảnh chụp màn hình.</p>';
        }

        // Hien modal
        appDetailModal.classList.remove('hidden');
        modalBodyScroll.scrollTop = 0;
    };

    const closeAppModal = () => {
        appDetailModal.classList.add('hidden');
    };

    // Events
    modalCloseBtn.addEventListener('click', closeAppModal);
    modalBackdrop.addEventListener('click', closeAppModal);
});
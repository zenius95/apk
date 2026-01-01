document.addEventListener('DOMContentLoaded', () => {

    const pageMode = document.body.dataset.pageMode;
    if (pageMode !== 'wpSites') return;

    const tableBody = document.getElementById('wp-sites-table-body');
    const placeholder = document.getElementById('wp-table-placeholder');
    const alertContainer = document.getElementById('alert-container-wp');

    // Modal Elements
    const wpSiteModal = document.getElementById('wpSiteModal');
    const wpModalBackdrop = document.getElementById('wpModalBackdrop');
    const wpModalCloseBtn = document.getElementById('wpModalCloseBtn');
    const btnOpenAddModal = document.getElementById('btn-open-add-modal');
    const modalAlertContainer = document.getElementById('modal-alert-container');
    const modalAlertMsg = document.getElementById('modal-alert-msg');

    // Form Elements
    const form = document.getElementById('wp-site-form');
    const formTitle = document.getElementById('wp-form-title');
    const siteIdInput = document.getElementById('wp-site-id');
    const siteNameInput = document.getElementById('wp-site-name');
    const siteUrlInput = document.getElementById('wp-site-url');
    const apiKeyInput = document.getElementById('wp-api-key');

    // Prompts
    const aiPromptTitleInput = document.getElementById('wp-ai-prompt-title');
    const aiPromptExcerptInput = document.getElementById('wp-ai-prompt-excerpt');
    const aiPromptInput = document.getElementById('wp-ai-prompt');
    const aiPromptFooterInput = document.getElementById('wp-ai-prompt-footer');
    const galleryAltInput = document.getElementById('wp-gallery-alt');
    const featuredAltInput = document.getElementById('wp-featured-alt');
    const downloadLinkInput = document.getElementById('wp-download-link');

    // [FIX] Thêm biến input cho chế độ ảnh màn hình
    const screenshotModeInput = document.getElementById('wp-screenshot-mode');

    const submitButton = document.getElementById('wp-form-submit');
    const submitButtonIcon = document.getElementById('wp-btn-icon');
    const submitButtonText = document.getElementById('wp-btn-text');
    const cancelButton = document.getElementById('wp-form-cancel');

    let sites = (typeof initialWpSites !== 'undefined') ? initialWpSites : [];

    function showAlert(message, isError = false) {
        alertContainer.innerHTML = '';
        if (!message) return;
        const t = isError
            ? { bg: 'bg-red-900/80', b: 'border-red-700/50', x: 'text-red-200', i: 'Toang!' }
            : { bg: 'bg-emerald-900/80', b: 'border-emerald-700/50', x: 'text-emerald-200', i: 'Ngon!' };
        alertContainer.innerHTML = `
            <div class="${t.bg} ${t.b} border backdrop-blur-md ${t.x} px-4 py-3 rounded-lg relative shadow-lg" role="alert">
                <strong class="font-bold flex items-center"><i class="ri-${isError ? 'error-warning' : 'checkbox-circle'}-fill mr-2"></i>${t.i}</strong>
                <span class="block sm:inline ml-1">${message}</span>
            </div>`;
        setTimeout(() => { alertContainer.innerHTML = ''; }, 5000);
    }

    function showModalError(message) {
        modalAlertMsg.textContent = message;
        modalAlertContainer.classList.remove('hidden');
    }

    function hideModalError() {
        modalAlertContainer.classList.add('hidden');
    }

    function openModal() {
        wpSiteModal.classList.remove('hidden');
        hideModalError();
        setTimeout(() => {
            wpSiteModal.firstElementChild?.classList.remove('scale-95', 'opacity-0');
        }, 10);
    }

    function closeModal() {
        wpSiteModal.classList.add('hidden');
        resetForm();
    }

    function buildRow(site) {
        return `
            <tr data-site-id="${site.id}" class="hover:bg-slate-800/30 transition-colors">
                <td class="py-4 pl-4 pr-3 text-sm sm:pl-6">
                    <div class="font-bold text-white">${site.siteName}</div>
                    <div class="text-slate-500 text-xs font-mono mt-0.5">ID: ${site.id}</div>
                </td>
                <td class="px-3 py-4 text-sm text-slate-300">
                    <a href="${site.siteUrl}" target="_blank" class="hover:text-emerald-400 truncate block max-w-[250px] transition-colors">
                        ${site.siteUrl} <i class="ri-external-link-line text-xs ml-1 opacity-50"></i>
                    </a>
                </td>
                <td class="py-4 pl-3 pr-4 sm:pr-6 text-center w-32">
                    <div class="flex justify-center items-center space-x-2">
                        <button class="btn-edit-site p-2 rounded-lg text-cyan-400 hover:bg-cyan-400/10 transition-colors" data-id="${site.id}" title="Sửa">
                            <i class="ri-pencil-line text-xl"></i>
                        </button>
                        <button class="btn-delete-site p-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors" data-id="${site.id}" title="Xoá">
                            <i class="ri-delete-bin-line text-xl"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    }

    function buildTable() {
        if (sites.length === 0) {
            placeholder.classList.remove('hidden');
            tableBody.innerHTML = '';
        } else {
            placeholder.classList.add('hidden');
            tableBody.innerHTML = sites.map(buildRow).join('');
        }
    }

    function resetForm() {
        form.reset();
        siteIdInput.value = '';
        aiPromptInput.value = '';
        if (aiPromptTitleInput) aiPromptTitleInput.value = '';
        if (aiPromptExcerptInput) aiPromptExcerptInput.value = '';
        if (aiPromptFooterInput) aiPromptFooterInput.value = '';
        if (galleryAltInput) galleryAltInput.value = '';
        if (featuredAltInput) featuredAltInput.value = '';
        if (downloadLinkInput) downloadLinkInput.value = '';

        // [FIX] Reset chế độ hiển thị về mặc định
        if (screenshotModeInput) screenshotModeInput.value = 'gallery';

        hideModalError();

        formTitle.innerHTML = '<i class="ri-add-line mr-2 text-emerald-400"></i> Thêm Trang Mới';
        submitButtonIcon.className = 'ri-add-line text-xl mr-2';
        submitButtonText.textContent = 'Thêm Site';
        submitButton.disabled = false;
    }

    function setEditMode(site) {
        siteIdInput.value = site.id;
        siteNameInput.value = site.siteName;
        siteUrlInput.value = site.siteUrl;
        apiKeyInput.value = site.apiKey;
        aiPromptInput.value = site.aiPrompt || '';

        if (aiPromptTitleInput) aiPromptTitleInput.value = site.aiPromptTitle || '';
        if (aiPromptExcerptInput) aiPromptExcerptInput.value = site.aiPromptExcerpt || '';
        if (aiPromptFooterInput) aiPromptFooterInput.value = site.aiPromptFooter || '';
        if (galleryAltInput) galleryAltInput.value = site.galleryAlt || '';
        if (featuredAltInput) featuredAltInput.value = site.featuredImageAlt || '';
        if (downloadLinkInput) downloadLinkInput.value = site.downloadLink || '';

        // [FIX] Load giá trị chế độ hiển thị đã lưu
        if (screenshotModeInput) screenshotModeInput.value = site.screenshotMode || 'gallery';

        formTitle.innerHTML = '<i class="ri-pencil-line mr-2 text-cyan-400"></i> Sửa Site';
        submitButtonIcon.className = 'ri-save-line text-xl mr-2';
        submitButtonText.textContent = 'Lưu Thay Đổi';
    }

    async function handleSubmit(e) {
        e.preventDefault();
        hideModalError();

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const siteId = data.id;
        const isUpdating = !!siteId;

        const endpoint = isUpdating ? `/api/wp-sites/${siteId}` : '/api/wp-sites';
        const method = isUpdating ? 'PUT' : 'POST';

        submitButton.disabled = true;
        submitButtonText.textContent = isUpdating ? 'Đang lưu...' : 'Đang thêm...';

        try {
            const response = await fetch(endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Lỗi không xác định');

            showAlert(result.message, false);

            if (isUpdating) {
                const index = sites.findIndex(s => s.id == siteId);
                if (index !== -1) sites[index] = result.site;
            } else {
                sites.push(result.site);
            }

            sites.sort((a, b) => a.siteName.localeCompare(b.siteName));
            buildTable();
            closeModal();

        } catch (err) {
            showModalError(err.message);
        } finally {
            submitButton.disabled = false;
            submitButtonText.textContent = isUpdating ? 'Lưu Thay Đổi' : 'Thêm Site';
        }
    }

    async function handleTableClick(e) {
        const target = e.target;
        const btnEdit = target.closest('.btn-edit-site');
        const btnDelete = target.closest('.btn-delete-site');

        if (btnEdit) {
            const id = btnEdit.dataset.id;
            const siteToEdit = sites.find(s => s.id == id);
            if (siteToEdit) {
                setEditMode(siteToEdit);
                openModal();
            }
        }

        if (btnDelete) {
            const id = btnDelete.dataset.id;
            const siteToDelete = sites.find(s => s.id == id);
            if (!siteToDelete) return;

            const confirmResult = await Swal.fire({
                title: 'Xoá site này?',
                text: `Bạn có chắc muốn xoá "${siteToDelete.siteName}"?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Xoá luôn!',
                cancelButtonText: 'Huỷ',
                confirmButtonColor: '#dc2626',
                cancelButtonColor: '#475569',
                background: '#1e293b',
                color: '#e2e8f0'
            });

            if (confirmResult.isConfirmed) {
                try {
                    const response = await fetch(`/api/wp-sites/${id}`, { method: 'DELETE' });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.message);

                    showAlert(result.message, false);
                    sites = sites.filter(s => s.id != id);
                    buildTable();
                } catch (err) {
                    showAlert(err.message, true);
                }
            }
        }
    }

    form.addEventListener('submit', handleSubmit);

    btnOpenAddModal.addEventListener('click', () => {
        resetForm();
        openModal();
    });

    wpModalCloseBtn.addEventListener('click', closeModal);
    wpModalBackdrop.addEventListener('click', closeModal);
    cancelButton.addEventListener('click', closeModal);

    tableBody.addEventListener('click', handleTableClick);

    buildTable();
});
/*
 * File: public/js/wpSitesManager.js
 * "Não" chung cho trang Quan Ly WP Sites
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Kiem tra co phai trang WP Sites khong ---
    // +++ SUA LOGIC TIM PAGEMODE +++
    const pageModeEl = document.querySelector('div[data-page-mode="wpSites"]');
    if (!pageModeEl) {
        // Khong phai trang WP Sites, thoat
        return; 
    }

    // --- 2. Lay linh kien UI (Lay tu document) ---
    const tableBody = document.getElementById('wp-sites-table-body');
    const placeholder = document.getElementById('wp-table-placeholder');
    const alertContainer = document.getElementById('alert-container-wp');
    
    // +++ MOI: Linh kien Modal (Phai tim o document goc) +++
    const wpSiteModal = document.getElementById('wpSiteModal');
    const wpSiteModalBackdrop = document.getElementById('wpSiteModalBackdrop');
    const wpSiteModalCloseBtn = document.getElementById('wpSiteModalCloseBtn');
    const btnOpenWpModal = document.getElementById('btn-open-wp-modal'); // Nut "Them Site Moi"

    // Form (Ben trong Modal)
    const form = document.getElementById('wp-site-form');
    const formTitle = document.getElementById('wp-form-title'); // Title tren Modal
    const siteIdInput = document.getElementById('wp-site-id');
    const siteNameInput = document.getElementById('wp-site-name');
    const siteUrlInput = document.getElementById('wp-site-url');
    const apiKeyInput = document.getElementById('wp-api-key');
    
    const submitButton = document.getElementById('wp-form-submit');
    const submitButtonIcon = document.getElementById('wp-btn-icon');
    const submitButtonText = document.getElementById('wp-btn-text');

    // Lay data co san tu EJS (Gio bien nay la global)
    let sites = (typeof initialWpSites !== 'undefined') ? initialWpSites : [];

    // --- 3. Dinh nghia Ham ---

    // +++ MOI: Ham Mo/Dong Modal +++
    function showWpModal() {
        if (wpSiteModal) wpSiteModal.classList.remove('hidden');
    }
    function closeWpModal() {
        if (wpSiteModal) wpSiteModal.classList.add('hidden');
        resetForm(); // Reset form khi dong
    }

    // Ham hien thong bao (Giu nguyen)
    function showAlert(message, isError = false) { 
        alertContainer.innerHTML = ''; 
        if (!message) return;
        
        const t = isError 
            ? { bg: 'bg-red-800/70', b: 'border-red-600/50', x: 'text-red-200', i: 'Toang!' } 
            : { bg: 'bg-green-800/70', b: 'border-green-600/50', x: 'text-green-200', i: 'Ngon!' };
        
        alertContainer.innerHTML = `
            <div class="${t.bg} ${t.b} backdrop-blur-md ${t.x} px-4 py-3 rounded-lg relative ring-1 ring-white/10" role="alert">
                <strong class="font-bold">${t.i}</strong>
                <span class="block sm:inline ml-2">${message}</span>
            </div>`;
        
        setTimeout(() => {
            alertContainer.innerHTML = '';
        }, 5000);
    }

    // Ham "Ve" 1 hang (Giu nguyen)
    function buildRow(site) {
        return `
            <tr data-site-id="${site.id}">
                <td class="py-4 pl-4 pr-3 text-sm sm:pl-6">
                    <div class="font-medium text-white">${site.siteName}</div>
                    <div class="text-slate-400 text-xs">ID: ${site.id}</div>
                </td>
                <td class="px-3 py-4 text-sm text-slate-300">
                    <a href="${site.siteUrl}" target="_blank" class="hover:text-emerald-400">${site.siteUrl} <i class="ri-external-link-line text-xs"></i></a>
                </td>
                <td class="py-4 pl-3 pr-4 sm:pr-6 text-center w-32">
                    <div class="flex justify-center items-center space-x-3">
                        <button class="btn-edit-site text-cyan-500/70 hover:text-cyan-400" data-id="${site.id}" title="Sửa site này">
                            <i class="ri-pencil-line text-lg"></i>
                        </button>
                        <button class="btn-delete-site text-red-500/70 hover:text-red-400" data-id="${site.id}" title="Xoá site này">
                            <i class="ri-delete-bin-line text-lg"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    // Ham "Ve" toan bo bang (Giu nguyen)
    function buildTable() {
        if (!tableBody) return; 
        if (sites.length === 0) {
            if (placeholder) placeholder.classList.remove('hidden');
            tableBody.innerHTML = '';
        } else {
            if (placeholder) placeholder.classList.add('hidden');
            tableBody.innerHTML = sites.map(buildRow).join('');
        }
    }

    // Ham reset Form ve che do "Them moi" (Giu nguyen)
    function resetForm() {
        if (!form) return; 
        form.reset();
        if (siteIdInput) siteIdInput.value = ''; 
        
        if (formTitle) formTitle.innerHTML = '<i class="ri-add-line mr-2 text-emerald-400"></i> Thêm Site Mới';
        if (submitButtonIcon) submitButtonIcon.className = 'ri-add-line text-2xl -ml-1 mr-2';
        if (submitButtonText) submitButtonText.textContent = 'Thêm Site';
        
        if (submitButton) submitButton.disabled = false;
    }

    // Ham bat che do "Sua" (Goi them showWpModal)
    function setEditMode(site) {
        if (!form) return; 
        siteIdInput.value = site.id;
        siteNameInput.value = site.siteName;
        siteUrlInput.value = site.siteUrl;
        apiKeyInput.value = site.apiKey;
        
        formTitle.innerHTML = '<i class="ri-pencil-line mr-2 text-cyan-400"></i> Sửa Site';
        submitButtonIcon.className = 'ri-save-line text-2xl -ml-1 mr-2';
        submitButtonText.textContent = 'Lưu Thay Đổi';
        
        // +++ MOI: Hien Modal len +++
        showWpModal();
        siteNameInput.focus();
    }

    // Ham xu ly Submit (Goi closeWpModal khi xong)
    async function handleSubmit(e) {
        e.preventDefault();
        showAlert(null); 

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
            if (!response.ok) {
                throw new Error(result.message || 'Lỗi không xác định');
            }

            showAlert(result.message, false);

            if (isUpdating) {
                const index = sites.findIndex(s => s.id == siteId);
                if (index !== -1) {
                    sites[index] = result.site;
                }
            } else {
                sites.push(result.site);
            }
            
            sites.sort((a, b) => a.siteName.localeCompare(b.siteName));
            
            buildTable(); 
            // +++ MOI: Dong Modal (thay vi resetForm) +++
            closeWpModal(); 

        } catch (err) {
            showAlert(err.message, true);
            // Neu loi, van phai bat lai nut
            submitButton.disabled = false;
            submitButtonText.textContent = isUpdating ? 'Lưu Thay Đổi' : 'Thêm Site';
        } 
    }

    // Ham xu ly nut Edit / Delete (Giu nguyen)
    async function handleTableClick(e) {
        const target = e.target;
        const btnEdit = target.closest('.btn-edit-site');
        const btnDelete = target.closest('.btn-delete-site');

        if (btnEdit) {
            e.preventDefault();
            const id = btnEdit.dataset.id;
            const siteToEdit = sites.find(s => s.id == id);
            if (siteToEdit) {
                setEditMode(siteToEdit);
            }
            return;
        }

        if (btnDelete) {
            e.preventDefault();
            const id = btnDelete.dataset.id;
            const siteToDelete = sites.find(s => s.id == id);
            
            if (!siteToDelete) return;

            // ... (Phan code Swal.fire confirm giu nguyen) ...
            const confirmResult = await Swal.fire({
                title: 'Bro, xoá site này?',
                text: `Xoá vĩnh viễn "${siteToDelete.siteName}". Không thể hoàn tác!`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'OK, xoá đi!',
                cancelButtonText: 'Đổi ý',
                confirmButtonColor: '#dc2626',
                cancelButtonColor: '#64748b', 
                background: '#1e293b',
                color: '#e2e8f0'
            });

            if (confirmResult.isConfirmed) {
                try {
                    const response = await fetch(`/api/wp-sites/${id}`, {
                        method: 'DELETE'
                    });
                    const result = await response.json();
                    if (!response.ok) {
                        throw new Error(result.message || 'Lỗi không xác định');
                    }
                    
                    showAlert(result.message, false);
                    
                    sites = sites.filter(s => s.id != id);
                    buildTable(); 
                    
                    if (siteIdInput && siteIdInput.value == id) {
                        resetForm();
                    }

                } catch (err) {
                    showAlert(err.message, true);
                }
            }
        }
    }


    // --- 4. Gan Su Kien (Them check ton tai) ---
    if (form) form.addEventListener('submit', handleSubmit);
    if (tableBody) tableBody.addEventListener('click', handleTableClick);

    // +++ MOI: Gan su kien cho Modal +++
    if (btnOpenWpModal) {
        btnOpenWpModal.addEventListener('click', () => {
            resetForm(); 
            showWpModal(); 
            if (siteNameInput) siteNameInput.focus();
        });
    }
    if (wpSiteModalCloseBtn) wpSiteModalCloseBtn.addEventListener('click', closeWpModal);
    if (wpSiteModalBackdrop) wpSiteModalBackdrop.addEventListener('click', closeWpModal);


    // --- 5. Chay lan dau ---
    buildTable();
    resetForm(); // Chay lan dau de set title cho form (mac du form dang an)
});
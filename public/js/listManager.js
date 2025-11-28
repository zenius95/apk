/*
 * File: public/js/listManager.js
 * "Não" chung cho ca trang App List va Trash
 */
document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. Xac dinh che do & "Linh kien" ---
    const pageMode = document.body.dataset.pageMode;
    const searchTerm = document.body.dataset.searchTerm || '';

    if (pageMode !== 'list' && pageMode !== 'trash') return; 

    const tableBody = document.getElementById('app-table-body');
    const placeholder = document.getElementById('table-placeholder');
    const selectAllPageCheckbox = document.getElementById('select-all-page');
    const selectionControls = document.getElementById('selection-controls');
    const selectionCount = document.getElementById('selection-count');
    const btnSelectAllDb = document.getElementById('btn-select-all-db');

    // +++ MOI: AI Panel Elements +++
    const btnStartAi = document.getElementById('btn-start-ai');
    const btnStopAi = document.getElementById('btn-stop-ai');
    const aiProgressContainer = document.getElementById('ai-progress-container');
    const aiStatusText = document.getElementById('ai-status-text');
    // +++ END +++

    let btnDeleteSelected, btnRestoreSelected, btnForceDeleteSelected;
    if (pageMode === 'list') {
        btnDeleteSelected = document.getElementById('btn-delete-selected');
    } else {
        btnRestoreSelected = document.getElementById('btn-restore-selected');
        btnForceDeleteSelected = document.getElementById('btn-force-delete-selected');
    }
    
    const itemsOnPage = (typeof initialData !== 'undefined') ? initialData : [];
    const totalItemsInDb = (typeof paginationData !== 'undefined') ? paginationData.totalItems : 0;

    let selectedAppIds = new Set();
    let isSelectingAllDb = false;

    // --- KHOI TAO SELECT2 (Neu co) ---
    if ($('#ai-sites-select').length) {
        $('#ai-sites-select').select2({
            placeholder: "Chọn site đăng bài...",
            width: '100%',
            closeOnSelect: false,
            allowClear: true
        });

        // Lang nghe su kien change cua Select2
        $('#ai-sites-select').on('change', function() {
            updateAiButtonState();
        });
    }

    // --- Helper: Parse Safe Data ---
    const getSafeAppData = (app) => {
        let data = app.fullData;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { data = null; }
        }
        if (!data) data = {};
        return {
            ...data,
            title: data.title || app.title || 'No Title',
            appId: app.appId,
            icon: data.icon || 'https://placehold.co/100x100?text=No+Icon'
        };
    };

    // --- 2. Build Row ---
    function buildRow(app) {
        const row = document.createElement('tr');
        row.setAttribute('data-app-id', app.appId);
        row.classList.toggle('bg-slate-700/50', selectedAppIds.has(app.appId));

        const appData = getSafeAppData(app);

        const typeLabel = app.appType === 'GAME'
          ? `<span class="inline-flex items-center rounded-md bg-purple-700/80 px-2 py-1 text-xs font-medium text-purple-200"><i class="ri-gamepad-line mr-1.5"></i>GAME</span>`
          : `<span class="inline-flex items-center rounded-md bg-sky-700/80 px-2 py-1 text-xs font-medium text-sky-200"><i class="ri-app-store-line mr-1.5"></i>APP</span>`;

        const colCheck = `
            <td class="px-4 sm:px-6 py-4">
                <input type="checkbox" class="app-checkbox h-4 w-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-600" value="${app.appId}" ${selectedAppIds.has(app.appId) ? 'checked' : ''}>
            </td>`;
        
        const colApp = `
            <td class="py-4 pl-4 pr-3 text-sm">
                <div class="flex items-center">
                    <div class="h-10 w-10 flex-shrink-0"><img class="h-10 w-10 rounded-lg object-cover" src="${appData.icon}" alt="" onerror="this.src='https://placehold.co/100x100?text=Err'"></div>
                    <div class="ml-4">
                        <div class="font-medium text-white">
                            <a href="#" class="app-title-link hover:text-emerald-400 transition-colors">${appData.title}</a>
                        </div>
                        <div class="text-slate-400 text-xs font-mono mt-0.5">${app.appId}</div>
                    </div>
                </div>
            </td>`;
        
        const colType = `<td class="px-3 py-4 text-sm">${typeLabel}</td>`;
        
        let colDate, colActions;
        
        if (pageMode === 'list') {
            colDate = `<td class="px-3 py-4 text-sm text-slate-400">${new Date(app.lastScrapedAt).toLocaleDateString('vi-VN')}</td>`;
            colActions = `
                <td class="py-4 pl-3 pr-4 sm:pr-6 text-center w-32">
                    <button class="btn-delete-single p-2 rounded hover:bg-slate-700 text-red-500 hover:text-red-400 transition" data-app-id="${app.appId}" title="Vứt vào thùng rác">
                        <i class="ri-delete-bin-line text-lg"></i>
                    </button>
                </td>`;
        } else { 
            colDate = `<td class="px-3 py-4 text-sm text-slate-400">${new Date(app.deletedAt).toLocaleDateString('vi-VN')}</td>`;
            colActions = `
                <td class="py-4 pl-3 pr-4 sm:pr-6 text-center w-32">
                    <div class="flex justify-center items-center space-x-2">
                        <button class="btn-restore-single p-2 rounded hover:bg-slate-700 text-emerald-500 hover:text-emerald-400 transition" data-app-id="${app.appId}" title="Khôi phục">
                            <i class="ri-arrow-go-back-line text-lg"></i>
                        </button>
                        <button class="btn-force-delete-single p-2 rounded hover:bg-slate-700 text-red-500 hover:text-red-400 transition" data-app-id="${app.appId}" title="Xoá vĩnh viễn">
                            <i class="ri-delete-bin-2-line text-lg"></i>
                        </button>
                    </div>
                </td>`;
        }
        
        row.innerHTML = colCheck + colApp + colType + colDate + colActions;
        return row;
    }

    function buildTable() {
        tableBody.innerHTML = '';
        if (itemsOnPage.length === 0) { 
            placeholder.classList.remove('hidden');
            let message = (pageMode === 'trash') ? 'Thùng rác trống.' : 'Chưa có app nào.';
            if (searchTerm) message = `Không tìm thấy app khớp với "${searchTerm}".`;
            placeholder.innerHTML = `<div class="p-12 text-center text-slate-500"><i class="ri-database-2-line text-5xl"></i><p class="mt-4 text-lg">${message}</p></div>`;
        } else {
            placeholder.classList.add('hidden');
            itemsOnPage.forEach(app => {
                tableBody.appendChild(buildRow(app));
            });
        }
    }

    // +++ MOI: Ham check trang thai nut Start AI +++
    function updateAiButtonState() {
        if (!btnStartAi) return;
        
        const hasSelectedApps = selectedAppIds.size > 0;
        
        // Lay gia tri tu Select2
        const selectedSites = $('#ai-sites-select').val(); // Tra ve mang ID hoac null
        const hasSelectedSites = selectedSites && selectedSites.length > 0;

        if (hasSelectedApps && hasSelectedSites) {
            btnStartAi.disabled = false;
            btnStartAi.classList.remove('opacity-50', 'cursor-not-allowed');
            btnStartAi.classList.add('hover:scale-[1.02]');
        } else {
            btnStartAi.disabled = true;
            btnStartAi.classList.add('opacity-50', 'cursor-not-allowed');
            btnStartAi.classList.remove('hover:scale-[1.02]');
        }
    }

    function updateSelectionControls() {
        const count = selectedAppIds.size;
        tableBody.querySelectorAll('tr').forEach(row => {
            const appId = row.dataset.appId;
            row.classList.toggle('bg-slate-700/50', selectedAppIds.has(appId));
        });
        
        if (count === 0) {
            selectionControls.classList.add('hidden');
            isSelectingAllDb = false;
            selectAllPageCheckbox.checked = false;
            selectAllPageCheckbox.indeterminate = false;
        } else {
            selectionControls.classList.remove('hidden');
            selectionCount.textContent = isSelectingAllDb 
                ? `Đã chọn tất cả ${totalItemsInDb} app` 
                : `Đã chọn ${count} app`;
            
            btnSelectAllDb.classList.toggle('hidden', isSelectingAllDb || (count !== itemsOnPage.length) || (totalItemsInDb <= itemsOnPage.length));

            if (isSelectingAllDb || count === itemsOnPage.length) {
                selectAllPageCheckbox.checked = true;
                selectAllPageCheckbox.indeterminate = false;
            } else {
                selectAllPageCheckbox.checked = false;
                selectAllPageCheckbox.indeterminate = true;
            }
        }
        
        // +++ MOI: Cap nhat nut AI moi khi doi app selection +++
        updateAiButtonState();
    }

    // Xu ly Nut Bam AI
    if (btnStartAi) {
        btnStartAi.addEventListener('click', () => {
            btnStartAi.classList.add('hidden');
            btnStopAi.classList.remove('hidden');
            aiProgressContainer.classList.remove('hidden');
            aiStatusText.innerHTML = `<i class="ri-loader-4-line animate-spin mr-2 text-purple-400"></i> Đang khởi tạo...`;
            
            document.getElementById('ai-concurrency').disabled = true;
            document.getElementById('ai-delay').disabled = true;
            // Disable Select2
            $('#ai-sites-select').prop('disabled', true);
        });
    }

    if (btnStopAi) {
        btnStopAi.addEventListener('click', () => {
            if(!confirm('Dừng tạo nội dung?')) return;
            
            btnStartAi.classList.remove('hidden');
            btnStopAi.classList.add('hidden');
            aiProgressContainer.classList.add('hidden');
            
            document.getElementById('ai-concurrency').disabled = false;
            document.getElementById('ai-delay').disabled = false;
            // Enable Select2
            $('#ai-sites-select').prop('disabled', false);
        });
    }
    // +++ END AI LOGIC +++

    // --- Action Handler ---
    async function performAction(actionType, appIds) {
        let endpoint, method, confirmTitle, confirmText, confirmButtonText, confirmButtonColor;
        const count = isSelectingAllDb ? totalItemsInDb : appIds.length;

        switch(actionType) {
            case 'delete':
                endpoint = '/api/apps'; method = 'DELETE';
                confirmTitle = `Vứt ${count} app vào rác?`;
                confirmButtonText = 'Vứt luôn'; confirmButtonColor = '#dc2626';
                break;
            case 'restore':
                endpoint = '/api/apps/restore'; method = 'POST';
                confirmTitle = `Khôi phục ${count} app?`;
                confirmButtonText = 'Khôi phục'; confirmButtonColor = '#10b981';
                break;
            case 'force_delete':
                endpoint = '/api/apps/permanent'; method = 'DELETE';
                confirmTitle = `XOÁ VĨNH VIỄN ${count} app?`;
                confirmText = 'Không thể hoàn tác!';
                confirmButtonText = 'Xoá vĩnh viễn'; confirmButtonColor = '#dc2626';
                break;
        }

        const res = await Swal.fire({
            title: confirmTitle, text: confirmText, icon: 'warning',
            showCancelButton: true, confirmButtonText, confirmButtonColor, cancelButtonText: 'Huỷ',
            background: '#1e293b', color: '#e2e8f0'
        });

        if (!res.isConfirmed) return;

        Swal.fire({ title: 'Đang xử lý...', didOpen: () => Swal.showLoading(), background: '#1e293b', color: '#e2e8f0' });

        try {
            const payload = {
                appIds: isSelectingAllDb ? null : appIds,
                [actionType === 'restore' ? 'restoreAll' : 'deleteAll']: isSelectingAllDb,
                search: (isSelectingAllDb && searchTerm) ? searchTerm : null
            };
            const response = await fetch(endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            
            Swal.fire({ title: 'Xong!', icon: 'success', timer: 1000, showConfirmButton: false, background: '#1e293b', color: '#e2e8f0' });
            setTimeout(() => window.location.reload(), 1000);
        } catch (err) {
            Swal.fire({ title: 'Lỗi', text: err.message, icon: 'error', background: '#1e293b', color: '#e2e8f0' });
        }
    }

    // --- Events Delegation ---
    tableBody.addEventListener('click', (e) => {
        const target = e.target;
        
        // 1. Click vao Link Title -> Mo Modal
        if (target.closest('.app-title-link')) {
            e.preventDefault();
            const row = target.closest('tr');
            const appId = row.dataset.appId;
            
            console.log("🖱️ Click vao app:", appId);

            const app = itemsOnPage.find(a => a.appId === appId);
            if (app) {
                const safeData = getSafeAppData(app);
                if (typeof window.showAppDetailModal === 'function') {
                    window.showAppDetailModal(safeData);
                } else {
                    console.error("❌ Error: window.showAppDetailModal missing.");
                }
            }
            return;
        }

        // 2. Cac nut Action khac
        const btnDelete = target.closest('.btn-delete-single');
        const btnRestore = target.closest('.btn-restore-single');
        const btnForce = target.closest('.btn-force-delete-single');
        const row = target.closest('tr');
        
        if (!row) return;

        if (btnDelete) performAction('delete', [row.dataset.appId]);
        if (btnRestore) performAction('restore', [row.dataset.appId]);
        if (btnForce) performAction('force_delete', [row.dataset.appId]);
    });

    // Checkbox events
    selectAllPageCheckbox.addEventListener('change', () => {
        const checked = selectAllPageCheckbox.checked;
        isSelectingAllDb = false;
        itemsOnPage.forEach(app => checked ? selectedAppIds.add(app.appId) : selectedAppIds.delete(app.appId));
        tableBody.querySelectorAll('.app-checkbox').forEach(cb => cb.checked = checked);
        updateSelectionControls();
    });

    btnSelectAllDb.addEventListener('click', () => {
        isSelectingAllDb = true;
        itemsOnPage.forEach(app => selectedAppIds.add(app.appId));
        tableBody.querySelectorAll('.app-checkbox').forEach(cb => cb.checked = true);
        updateSelectionControls();
    });

    tableBody.addEventListener('change', (e) => {
        if (e.target.classList.contains('app-checkbox')) {
            e.target.checked ? selectedAppIds.add(e.target.value) : selectedAppIds.delete(e.target.value);
            isSelectingAllDb = false;
            updateSelectionControls();
        }
    });

    // Bulk actions
    if (btnDeleteSelected) btnDeleteSelected.onclick = () => performAction('delete', Array.from(selectedAppIds));
    if (btnRestoreSelected) btnRestoreSelected.onclick = () => performAction('restore', Array.from(selectedAppIds));
    if (btnForceDeleteSelected) btnForceDeleteSelected.onclick = () => performAction('force_delete', Array.from(selectedAppIds));

    // Init
    buildTable();
    updateAiButtonState(); // Check trang thai ban dau
});
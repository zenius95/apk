/*
 * File: public/js/listManager.js
 * "Não" chung cho ca trang App List va Trash
 */
document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. Xac dinh che do & "Linh kien" ---
    const pageMode = document.body.dataset.pageMode; // 'list' hoac 'trash'
    const searchTerm = document.body.dataset.searchTerm || '';

    if (!pageMode) {
        return;
    }

    const tableBody = document.getElementById('app-table-body');
    const placeholder = document.getElementById('table-placeholder');
    const selectAllPageCheckbox = document.getElementById('select-all-page');
    const selectionControls = document.getElementById('selection-controls');
    const selectionCount = document.getElementById('selection-count');
    const btnSelectAllDb = document.getElementById('btn-select-all-db');

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

    // --- 2. Dinh nghia Ham ---

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        background: '#1e293b', 
        color: '#e2e8f0',
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });

    // Ham "Ve" 1 hang (Row)
    function buildRow(app) {
        const row = document.createElement('tr');
        row.setAttribute('data-app-id', app.appId);
        row.classList.toggle('bg-slate-700/50', selectedAppIds.has(app.appId));

        const appData = app.fullData;
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
                    <div class="h-10 w-10 flex-shrink-0"><img class="h-10 w-10 rounded-lg" src="${appData.icon}" alt=""></div>
                    <div class="ml-4">
                        <div class="font-medium text-white">${appData.title}</div>
                        <div class="text-slate-400">${appData.appId}</div>
                    </div>
                </div>
            </td>`;
        
        const colType = `<td class="px-3 py-4 text-sm">${typeLabel}</td>`;
        
        let colDate, colActions;
        
        if (pageMode === 'list') {
            colDate = `<td class="px-3 py-4 text-sm text-slate-400">${new Date(app.lastScrapedAt).toLocaleString()}</td>`;
            // +++ (SUA) Them class w-32 vao td +++
            colActions = `
                <td class="py-4 pl-3 pr-4 sm:pr-6 text-center w-32">
                    <button class="btn-delete-single text-red-500/70 hover:text-red-400" data-app-id="${app.appId}" title="Vứt vào thùng rác">
                        <i class="ri-delete-bin-line text-lg"></i>
                    </button>
                </td>`;
        } else { // pageMode === 'trash'
            colDate = `<td class="px-3 py-4 text-sm text-slate-400">${new Date(app.deletedAt).toLocaleString()}</td>`;
            // +++ (SUA) Them class w-32 vao td +++
            colActions = `
                <td class="py-4 pl-3 pr-4 sm:pr-6 text-center w-32">
                    <div class="flex justify-center items-center space-x-3">
                        <button class="btn-restore-single text-emerald-500/70 hover:text-emerald-400" data-app-id="${app.appId}" title="Khôi phục app này">
                            <i class="ri-arrow-go-back-line text-lg"></i>
                        </button>
                        <button class="btn-force-delete-single text-red-500/70 hover:text-red-400" data-app-id="${app.appId}" title="Xoá vĩnh viễn">
                            <i class="ri-delete-bin-2-line text-lg"></i>
                        </button>
                    </div>
                </td>`;
        }
        
        row.innerHTML = colCheck + colApp + colType + colDate + colActions;
        return row;
    }

    // Ham "Ve" toan bo bang
    function buildTable() {
        tableBody.innerHTML = '';
        if (itemsOnPage.length === 0) { 
            placeholder.classList.remove('hidden');
            let icon = 'ri-database-2-line';
            let message = 'Chưa có app nào trong Database.';
            if (pageMode === 'trash') {
                icon = 'ri-inbox-archive-line';
                message = 'Thùng rác trống. Tốt!';
                if (searchTerm) {
                    message = `Không tìm thấy app nào trong thùng rác khớp với "${searchTerm}".`;
                }
            } else if (searchTerm) {
                icon = 'ri-search-line';
                message = `Không tìm thấy app nào khớp với "${searchTerm}".`;
            }
            placeholder.innerHTML = `<div class="p-12 text-center text-slate-500"><i class="${icon} text-5xl"></i><p class="mt-4 text-lg">${message}</p></div>`;
        } else {
            placeholder.classList.add('hidden');
            itemsOnPage.forEach(app => {
                tableBody.appendChild(buildRow(app));
            });
        }
    }

    // Ham Cap nhat Thanh Chon (Selection Bar)
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
            return;
        }

        selectionControls.classList.remove('hidden');
        selectionCount.textContent = `Đã chọn ${count} app`;
        
        if (isSelectingAllDb) {
            selectionCount.textContent = `Đã chọn tất cả ${totalItemsInDb} app`;
            btnSelectAllDb.classList.add('hidden');
        } else {
            const showSelectAllDb = (count === itemsOnPage.length) && (totalItemsInDb > itemsOnPage.length);
            btnSelectAllDb.classList.toggle('hidden', !showSelectAllDb);
        }

        if (count === itemsOnPage.length && !isSelectingAllDb) {
            selectAllPageCheckbox.checked = true;
            selectAllPageCheckbox.indeterminate = false;
        } else if (count > 0) {
            selectAllPageCheckbox.checked = false;
            selectAllPageCheckbox.indeterminate = true;
        }
    }

    // Ham Hanh Dong (API Call)
    async function performAction(actionType, appIds) {
        let endpoint, method, confirmTitle, confirmText, confirmButtonText, confirmButtonColor, loadingText, successIcon;
        const isSearch = searchTerm.length > 0;
        const deleteAll = isSelectingAllDb;
        const finalAppIds = deleteAll ? null : appIds;
        const count = deleteAll ? totalItemsInDb : appIds.length;

        switch(actionType) {
            case 'delete':
                endpoint = '/api/apps';
                method = 'DELETE';
                confirmTitle = `Bro, vứt ${count} app?`;
                confirmText = "Nó sẽ bay vào thùng rác.";
                confirmButtonText = 'OK, vứt nó!';
                confirmButtonColor = '#dc2626';
                loadingText = 'Đang vứt rác...';
                successIcon = 'success';
                break;
            case 'restore':
                endpoint = '/api/apps/restore';
                method = 'POST';
                confirmTitle = `Bro, khôi phục ${count} app?`;
                confirmText = "Nó sẽ bay về lại trang Danh sách APP.";
                confirmButtonText = 'OK, khôi phục!';
                confirmButtonColor = '#10b981';
                loadingText = 'Đang vớt app...';
                successIcon = 'success';
                break;
            case 'force_delete':
                endpoint = '/api/apps/permanent';
                method = 'DELETE';
                confirmTitle = `XOÁ VĨNH VIỄN ${count} app?`;
                confirmText = "KHÔNG THỂ HOÀN TÁC! Bro chắc chưa? Nó bay màu luôn đó!";
                confirmButtonText = 'OK, cho nó bay!';
                confirmButtonColor = '#dc2626';
                loadingText = 'Đang cho bay màu...';
                successIcon = 'warning';
                break;
            default: return;
        }
        
        if (deleteAll && isSearch) {
             confirmTitle = `${confirmButtonText.split('!')[0]} tất cả app khớp với "${searchTerm}"?`;
        }

        const confirmResult = await Swal.fire({
            title: confirmTitle,
            text: confirmText,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: confirmButtonText,
            cancelButtonText: 'Đổi ý',
            confirmButtonColor: confirmButtonColor,
            cancelButtonColor: '#64748b', 
            background: '#1e293b',
            color: '#e2e8f0'
        });

        if (!confirmResult.isConfirmed) return;

        if(btnDeleteSelected) btnDeleteSelected.disabled = true;
        if(btnRestoreSelected) btnRestoreSelected.disabled = true;
        if(btnForceDeleteSelected) btnForceDeleteSelected.disabled = true;
        
        Swal.fire({
            title: 'Đang xử lý...',
            text: loadingText,
            background: '#1e293b',
            color: '#e2e8f0',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            const payload = {
                appIds: finalAppIds,
                [actionType === 'restore' ? 'restoreAll' : 'deleteAll']: deleteAll,
                search: (deleteAll && isSearch) ? searchTerm : null
            };
            const response = await fetch(endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) { throw new Error(result.message || 'Lỗi không xác định'); }

            Swal.close();
            await Swal.fire({
                title: 'Xong!',
                text: result.message,
                icon: successIcon,
                background: '#1e293b',
                color: '#e2e8f0',
                confirmButtonColor: '#10b981'
            });
            window.location.reload(); 
        } catch (err) {
            Swal.fire({
                title: 'Toang!',
                text: err.message,
                icon: 'error',
                background: '#1e293b',
                color: '#e2e8f0',
                confirmButtonColor: '#dc2626'
            });
            if(btnDeleteSelected) btnDeleteSelected.disabled = false;
            if(btnRestoreSelected) btnRestoreSelected.disabled = false;
            if(btnForceDeleteSelected) btnForceDeleteSelected.disabled = false;
        }
    }

    // --- 3. Gan Su Kien ---

    selectAllPageCheckbox.addEventListener('change', () => {
        const isChecked = selectAllPageCheckbox.checked;
        isSelectingAllDb = false; 
        itemsOnPage.forEach(app => {
            if (isChecked) {
                selectedAppIds.add(app.appId);
            } else {
                selectedAppIds.delete(app.appId);
            }
        });
        tableBody.querySelectorAll('.app-checkbox').forEach(cb => cb.checked = isChecked);
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
            const appId = e.target.value;
            if (e.target.checked) {
                selectedAppIds.add(appId);
            } else {
                selectedAppIds.delete(appId);
                isSelectingAllDb = false;
            }
            updateSelectionControls();
        }
    });

    tableBody.addEventListener('click', (e) => {
        const appId = e.target.closest('tr')?.dataset.appId;
        if (!appId) return;
        if (e.target.closest('.btn-delete-single')) {
            e.preventDefault();
            performAction('delete', [appId]);
        }
        else if (e.target.closest('.btn-restore-single')) {
            e.preventDefault();
            performAction('restore', [appId]);
        }
        else if (e.target.closest('.btn-force-delete-single')) {
            e.preventDefault();
            performAction('force_delete', [appId]);
        }
    });

    if (pageMode === 'list') {
        btnDeleteSelected.addEventListener('click', () => {
            performAction('delete', Array.from(selectedAppIds));
        });
    } else {
        btnRestoreSelected.addEventListener('click', () => {
            performAction('restore', Array.from(selectedAppIds));
        });
        btnForceDeleteSelected.addEventListener('click', () => {
            performAction('force_delete', Array.from(selectedAppIds));
        });
    }

    // --- 4. Chay lan dau ---
    buildTable();
});
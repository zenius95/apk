document.addEventListener('DOMContentLoaded', () => {

    const savedTableBody = document.getElementById('app-table-body-saved');
    if (!savedTableBody) {
        console.log("Khong phai trang Thung Rac, trash.js thoat.");
        return;
    }
    
    // Kiem tra xem co phai trang appList khong (de tranh load nham)
    if(document.getElementById('btn-delete-selected')) {
        console.log("Day la trang App List, trash.js thoat.");
        return;
    }

    // --- 1. Lay "linh kien" UI (Trang Thung Rac) ---
    const savedPlaceholder = document.getElementById('table-placeholder-saved');
    const selectAllPageCheckbox = document.getElementById('select-all-page');
    const selectionControls = document.getElementById('selection-controls');
    const selectionCount = document.getElementById('selection-count');
    const selectAllDbContainer = document.getElementById('select-all-container');
    const btnSelectAllDb = document.getElementById('btn-select-all-db');
    
    // Nut moi
    const btnRestoreSelected = document.getElementById('btn-restore-selected');
    const btnForceDeleteSelected = document.getElementById('btn-force-delete-selected');

    // Bien data tu EJS
    // initialSavedApps, paginationData, searchTerm

    // Bien toan cuc
    let selectedAppIds = new Set();
    let isSelectingAllDb = false;
    const totalItemsInDb = paginationData.totalItems || 0;
    const itemsOnPage = initialSavedApps.length;

    // --- 2. Dinh nghia cac ham "chuc nang" ---

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

    function showAlert(message, isError = false) { 
        if (!message) return;
        Toast.fire({
            icon: isError ? 'error' : 'success',
            title: message
        });
    }

    // Ve hang (Doi nut, doi cot ngay)
    function buildSavedRow(app) {
        const row = document.createElement('tr');
        row.setAttribute('data-app-id', app.appId);
        row.classList.add('hover:bg-slate-800'); 

        const appData = app.fullData;
        const typeLabel = app.appType === 'GAME'
          ? `<span class="inline-flex items-center rounded-md bg-purple-700/80 px-2 py-1 text-xs font-medium text-purple-200"><i class="ri-gamepad-line mr-1.5"></i>GAME</span>`
          : `<span class="inline-flex items-center rounded-md bg-sky-700/80 px-2 py-1 text-xs font-medium text-sky-200"><i class="ri-app-store-line mr-1.5"></i>APP</span>`;
        
        row.innerHTML = `
            <td class="px-4 sm:px-6 py-4">
                <label for="checkbox-${app.appId}" class="sr-only">Select ${app.title}</label>
                <input type="checkbox" id="checkbox-${app.appId}" class="app-checkbox h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-600" value="${app.appId}">
            </td>
            <td class="py-4 pl-4 pr-3 text-sm">
                <div class="flex items-center">
                    <div class="h-10 w-10 flex-shrink-0"><img class="h-10 w-10 rounded-lg" src="${appData.icon}" alt=""></div>
                    <div class="ml-4">
                        <div class="font-medium text-white">${appData.title}</div>
                        <div class="text-slate-400">${appData.appId}</div>
                    </div>
                </div>
            </td>
            <td class="px-3 py-4 text-sm">${typeLabel}</td>
            <td class="px-3 py-4 text-sm text-slate-400">${new Date(app.deletedAt).toLocaleString()}</td>
            <td class="relative py-4 pl-3 pr-4 sm:pr-6 text-center space-x-2">
                <button class="btn-restore-single text-emerald-500/70 hover:text-emerald-400" data-app-id="${app.appId}" title="Khôi phục app này">
                    <i class="ri-arrow-go-back-line text-lg"></i>
                </button>
                <button class="btn-force-delete-single text-red-500/70 hover:text-red-400" data-app-id="${app.appId}" title="Xoá vĩnh viễn app này">
                    <i class="ri-delete-bin-2-line text-lg"></i>
                </button>
            </td>
        `;
        return row;
    }
    
    // Ve bang
    function buildInitialSavedTable() {
        savedTableBody.innerHTML = '';
        if (initialSavedApps.length === 0) { 
            savedPlaceholder.classList.remove('hidden');
            if (searchTerm) {
                savedPlaceholder.innerHTML = `<div class="p-8 text-center text-slate-500"><i class="ri-search-line text-4xl"></i><p class="mt-2">Không tìm thấy app nào trong thùng rác khớp với "<span class="text-yellow-400">${searchTerm}</span>".</p></div>`;
            } else {
                savedPlaceholder.innerHTML = '<div class="p-8 text-center text-slate-500"><i class="ri-inbox-archive-line text-4xl"></i><p class="mt-2">Thùng rác trống. Tốt!</p></div>';
            }
        } else { 
            savedPlaceholder.classList.add('hidden'); 
            initialSavedApps.forEach(app => { savedTableBody.appendChild(buildSavedRow(app)); }); 
        }
    }

    // Cap nhat thanh dieu khien
    function updateSelectionControls() {
        const count = selectedAppIds.size;
        
        savedTableBody.querySelectorAll('tr').forEach(row => {
            const appId = row.dataset.appId;
            if (appId && selectedAppIds.has(appId)) {
                row.classList.add('bg-slate-700/50');
            } else {
                row.classList.remove('bg-slate-700/50');
            }
        });
        
        if (count === 0) {
            selectionControls.classList.add('hidden');
            isSelectingAllDb = false;
            selectAllPageCheckbox.checked = false;
            selectAllPageCheckbox.indeterminate = false;
            return;
        }

        selectionControls.classList.remove('hidden');
        btnRestoreSelected.disabled = false;
        btnForceDeleteSelected.disabled = false;

        if (isSelectingAllDb) {
            selectionCount.textContent = `Đã chọn tất cả ${totalItemsInDb} app (toàn bộ thùng rác)`;
            selectAllDbContainer.classList.add('hidden');
            selectAllPageCheckbox.checked = true;
            selectAllPageCheckbox.indeterminate = false;
        } else {
            selectionCount.textContent = `Đã chọn ${count} app`;
            if (count === itemsOnPage && totalItemsInDb > itemsOnPage) {
                selectAllDbContainer.classList.remove('hidden');
            } else {
                selectAllDbContainer.classList.add('hidden');
            }

            if (count === itemsOnPage) {
                selectAllPageCheckbox.checked = true;
                selectAllPageCheckbox.indeterminate = false;
            } else {
                selectAllPageCheckbox.checked = false;
                selectAllPageCheckbox.indeterminate = true;
            }
        }
    }

    // --- (MOI) Ham hanh dong chung (Khoi phuc / Xoa vinh vien) ---
    async function performAction(actionType, appIds, deleteAll = false, isSearch = false) {
        
        const isRestore = actionType === 'restore';
        const endpoint = isRestore ? '/api/apps/restore' : '/api/apps/permanent';
        const method = isRestore ? 'POST' : 'DELETE';
        
        let confirmTitle = '';
        let confirmText = '';
        let confirmButtonText = '';
        let confirmButtonColor = '';

        if (isRestore) {
            confirmTitle = `Bro, khôi phục ${deleteAll ? `TẤT CẢ ${totalItemsInDb} app` : `${appIds.length} app`}?`;
            confirmText = "Nó sẽ bay về lại trang Danh sách APP.";
            confirmButtonText = 'OK, khôi phục!';
            confirmButtonColor = '#10b981'; // emerald-600
        } else {
            confirmTitle = `XOÁ VĨNH VIỄN ${deleteAll ? `TẤT CẢ ${totalItemsInDb} app` : `${appIds.length} app`}?`;
            confirmText = "KHÔNG THỂ HOÀN TÁC! Bro chắc chưa? Nó bay màu luôn đó!";
            confirmButtonText = 'OK, cho nó bay!';
            confirmButtonColor = '#dc2626'; // red-600
        }
        
        if (deleteAll && isSearch && searchTerm) {
             confirmTitle = `${isRestore ? 'Khôi phục' : 'Xoá vĩnh viễn'} tất cả app khớp với "${searchTerm}"?`;
        }

        // 1. Hop thoai XAC NHAN
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

        if (!confirmResult.isConfirmed) {
            return;
        }

        // 2. Hop thoai LOADING
        btnRestoreSelected.disabled = true;
        btnForceDeleteSelected.disabled = true;
        Swal.fire({
            title: 'Đang xử lý...',
            text: `Chờ tí, Bro, đang ${isRestore ? 'vớt' : 'cho bay'} app...`,
            background: '#1e293b',
            color: '#e2e8f0',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            // 3. Goi API
            const payload = {
                appIds: deleteAll ? null : appIds,
                [isRestore ? 'restoreAll' : 'deleteAll']: deleteAll, // Key khac nhau cho 2 ham
                search: (deleteAll && isSearch) ? searchTerm : null
            };

            const response = await fetch(endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!response.ok) { throw new Error(result.message || 'Lỗi không xác định'); }

            Swal.close(); // Tat loading
            
            // 4. Hop thoai THANH CONG
            await Swal.fire({
                title: 'Xong!',
                text: result.message,
                icon: 'success',
                background: '#1e293b',
                color: '#e2e8f0',
                confirmButtonColor: '#10b981'
            });
            
            window.location.reload(); // Reload lai trang

        } catch (err) {
            // 5. Hop thoai LOI
            Swal.fire({
                title: 'Toang!',
                text: err.message,
                icon: 'error',
                background: '#1e293b',
                color: '#e2e8f0',
                confirmButtonColor: '#dc2626'
            });
            btnRestoreSelected.disabled = false;
            btnForceDeleteSelected.disabled = false;
        }
    }

    // --- 3. Gan Su Kien ---

    selectAllPageCheckbox.addEventListener('change', () => {
        const isChecked = selectAllPageCheckbox.checked;
        isSelectingAllDb = false; 
        savedTableBody.querySelectorAll('.app-checkbox').forEach(checkbox => {
            checkbox.checked = isChecked;
            const appId = checkbox.value;
            if (isChecked) {
                selectedAppIds.add(appId);
            } else {
                selectedAppIds.delete(appId);
            }
        });
        updateSelectionControls();
    });

    savedTableBody.addEventListener('change', (e) => {
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

    btnSelectAllDb.addEventListener('click', () => {
        isSelectingAllDb = true;
        savedTableBody.querySelectorAll('.app-checkbox').forEach(checkbox => {
            checkbox.checked = true;
            if (!selectedAppIds.has(checkbox.value)) {
                 selectedAppIds.add(checkbox.value);
            }
        });
        updateSelectionControls();
    });

    // Nut "Khoi phuc" (Chon nhieu)
    btnRestoreSelected.addEventListener('click', () => {
        const isSearch = searchTerm.length > 0;
        if (isSelectingAllDb) {
            performAction('restore', null, true, isSearch);
        } else {
            performAction('restore', Array.from(selectedAppIds), false);
        }
    });

    // Nut "Xoa vinh vien" (Chon nhieu)
    btnForceDeleteSelected.addEventListener('click', () => {
        const isSearch = searchTerm.length > 0;
        if (isSelectingAllDb) {
            performAction('delete', null, true, isSearch);
        } else {
            performAction('delete', Array.from(selectedAppIds), false);
        }
    });

    // Nut le (trong hang)
    savedTableBody.addEventListener('click', (e) => {
        // Nut Khoi phuc le
        const restoreButton = e.target.closest('.btn-restore-single');
        if (restoreButton) {
            e.preventDefault();
            const appId = restoreButton.dataset.appId;
            performAction('restore', [appId], false);
        }
        
        // Nut Xoa vinh vien le
        const deleteButton = e.target.closest('.btn-force-delete-single');
        if (deleteButton) {
            e.preventDefault();
            const appId = deleteButton.dataset.appId;
            performAction('delete', [appId], false);
        }
    });


    // --- 4. Chay lan dau ---
    buildInitialSavedTable();
});
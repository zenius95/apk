/*
 * File: public/js/listManager.js
 * "Não" chung cho cả trang App List và Trash
 * Fix: Re-structure code to prevent ReferenceError
 */
document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. KHOI TAO BIEN & ELEMENTS
    // ==========================================
    const pageMode = document.body.dataset.pageMode;
    const searchTerm = document.body.dataset.searchTerm || '';

    if (pageMode !== 'list' && pageMode !== 'trash') return; 

    // Table Elements
    const tableBody = document.getElementById('app-table-body');
    const placeholder = document.getElementById('table-placeholder');
    const selectAllPageCheckbox = document.getElementById('select-all-page');
    const selectionControls = document.getElementById('selection-controls');
    const selectionCount = document.getElementById('selection-count');
    const btnSelectAllDb = document.getElementById('btn-select-all-db');

    // Action Buttons
    let btnDeleteSelected, btnRestoreSelected, btnForceDeleteSelected;
    if (pageMode === 'list') {
        btnDeleteSelected = document.getElementById('btn-delete-selected');
    } else {
        btnRestoreSelected = document.getElementById('btn-restore-selected');
        btnForceDeleteSelected = document.getElementById('btn-force-delete-selected');
    }

    // AI Panel Elements
    const btnStartAi = document.getElementById('btn-start-ai');
    const btnStopAi = document.getElementById('btn-stop-ai');
    const aiProgressContainer = document.getElementById('ai-progress-container');
    const aiStatusText = document.getElementById('ai-status-text');
    const aiOpenAiKey = document.getElementById('ai-openai-key'); 
    const aiConcurrency = document.getElementById('ai-concurrency');
    const aiDelay = document.getElementById('ai-delay');
    const aiDemoMode = document.getElementById('ai-demo-mode'); 
    const siteCheckboxes = document.querySelectorAll('.site-checkbox'); 
    const btnSelectAllSites = document.getElementById('btn-select-all-sites');
    
    // Result Modal Elements
    const aiResultModal = document.getElementById('aiResultModal');
    const aiResultBackdrop = document.getElementById('aiResultBackdrop');
    const aiResultCloseBtn = document.getElementById('aiResultCloseBtn');
    const aiResultTabs = document.getElementById('ai-result-tabs');         
    const aiResultTabContent = document.getElementById('ai-result-tab-content'); 
    const aiResultAppName = document.getElementById('ai-result-app-name');
    const aiResultCopyBtn = document.getElementById('aiResultCopyBtn');
    
    // +++ MOI: Posted Details Modal +++
    const postedDetailsModal = document.getElementById('postedDetailsModal');
    const postedDetailsBackdrop = document.getElementById('postedDetailsBackdrop');
    const postedDetailsCloseBtn = document.getElementById('postedDetailsCloseBtn');
    // +++ END +++

    // Data
    const itemsOnPage = (typeof initialData !== 'undefined') ? initialData : [];
    const totalItemsInDb = (typeof paginationData !== 'undefined') ? paginationData.totalItems : 0;
    const globalWpSites = (typeof allWpSites !== 'undefined') ? allWpSites : []; // +++ MOI +++

    let selectedAppIds = new Set();
    let isSelectingAllDb = false;

    // Initialize Socket
    const socket = typeof io !== 'undefined' ? io() : null;

    // ==========================================
    // 2. DINH NGHIA HAM (FUNCTIONS)
    // ==========================================

    // --- Helper: Safe Data ---
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
            icon: data.icon || 'https://placehold.co/100x100?text=No+Icon',
            // +++ MOI: Them mang ID site da post +++
            postedSiteIds: app.postedSiteIds || []
        };
    };

    // --- UI: Build Row ---
    function buildRow(app) {
        const isSelected = selectedAppIds.has(app.appId);
        const appData = getSafeAppData(app);
        
        const typeLabel = app.appType === 'GAME'
          ? `<span class="inline-flex items-center rounded-md bg-purple-500/10 px-2 py-1 text-xs font-medium text-purple-400 ring-1 ring-inset ring-purple-500/20"><i class="ri-gamepad-line mr-1.5"></i>GAME</span>`
          : `<span class="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20"><i class="ri-app-store-line mr-1.5"></i>APP</span>`;

        let actionButtons = '';
        if (pageMode === 'list') {
            actionButtons = `
                <button class="btn-delete-single group p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all" data-app-id="${app.appId}" title="Vứt vào thùng rác">
                    <i class="ri-delete-bin-line text-lg"></i>
                </button>`;
        } else {
            actionButtons = `
                <button class="btn-restore-single p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 transition-all" data-app-id="${app.appId}" title="Khôi phục">
                    <i class="ri-arrow-go-back-line text-lg"></i>
                </button>
                <button class="btn-force-delete-single p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all" data-app-id="${app.appId}" title="Xoá vĩnh viễn">
                    <i class="ri-delete-bin-2-line text-lg"></i>
                </button>`;
        }

        // +++ MOI: Tinh toan cot Da Dang +++
        const postedCount = appData.postedSiteIds.length;
        const totalSites = globalWpSites.length;
        let postedBadge = '';
        
        if (totalSites === 0) {
            postedBadge = `<span class="text-xs text-slate-600 italic">--</span>`;
        } else {
            let badgeColor = 'bg-slate-700/50 text-slate-400 border-slate-600/50';
            if (postedCount > 0 && postedCount < totalSites) badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            if (postedCount === totalSites && totalSites > 0) badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            
            postedBadge = `<button class="btn-show-posted border ${badgeColor} px-2.5 py-1 rounded text-xs font-mono font-bold hover:brightness-125 transition-all" data-app-id="${app.appId}">
                ${postedCount}/${totalSites}
            </button>`;
        }
        // +++ END +++

        return `
            <tr data-app-id="${app.appId}" class="group transition-colors border-b border-slate-800/50 hover:bg-slate-800/30 ${isSelected ? 'bg-slate-800/50' : ''}">
                <td class="px-4 sm:px-6 py-4">
                    <input type="checkbox" class="app-checkbox h-4 w-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer" value="${app.appId}" ${isSelected ? 'checked' : ''}>
                </td>
                <td class="py-4 pl-4 pr-3 text-sm">
                    <div class="flex items-center">
                        <div class="h-10 w-10 flex-shrink-0 relative group-hover:scale-105 transition-transform">
                            <img class="h-10 w-10 rounded-lg object-cover ring-1 ring-white/10" src="${appData.icon}" alt="" onerror="this.src='https://placehold.co/100x100?text=Err'">
                        </div>
                        <div class="ml-4 max-w-[200px] sm:max-w-xs">
                            <div class="font-medium text-white truncate">
                                <a href="#" class="app-title-link hover:text-emerald-400 transition-colors cursor-pointer">${appData.title}</a>
                            </div>
                            <div class="text-slate-500 text-xs font-mono mt-0.5 truncate">${app.appId}</div>
                        </div>
                    </div>
                </td>
                <td class="px-3 py-4 text-sm">${typeLabel}</td>
                <td class="px-3 py-4 text-sm text-center">${postedBadge}</td>
                <td class="px-3 py-4 text-sm text-slate-400 font-mono text-xs">
                    ${pageMode === 'list' ? new Date(app.lastScrapedAt).toLocaleDateString('vi-VN') : new Date(app.deletedAt).toLocaleDateString('vi-VN')}
                </td>
                <td class="py-4 pl-3 pr-4 sm:pr-6 text-center w-32">
                    <div class="flex justify-center items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        ${actionButtons}
                    </div>
                </td>
            </tr>
        `;
    }

    // --- UI: Build Table ---
    function buildTable() {
        if (itemsOnPage.length === 0) { 
            const placeholderEl = document.getElementById('table-placeholder');
            placeholderEl.classList.remove('hidden');
            tableBody.innerHTML = '';
        } else {
            document.getElementById('table-placeholder').classList.add('hidden');
            tableBody.innerHTML = itemsOnPage.map(buildRow).join('');
        }
    }

    // --- UI: Update Controls ---
    function updateSelectionControls() {
        // (Giu nguyen nhu cu)
        const count = selectedAppIds.size;
        
        const rows = tableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const appId = row.dataset.appId;
            if (selectedAppIds.has(appId)) {
                row.classList.add('bg-slate-800/50');
                row.querySelector('.app-checkbox').checked = true;
            } else {
                row.classList.remove('bg-slate-800/50');
                row.querySelector('.app-checkbox').checked = false;
            }
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
        updateAiButtonState();
    }

    // --- AI: Check Button State ---
    function updateAiButtonState() {
        // (Giu nguyen nhu cu)
        if (!btnStartAi) return;
        
        const hasSelectedApps = selectedAppIds.size > 0;
        const checkedSites = document.querySelectorAll('.site-checkbox:checked');
        const hasSelectedSites = checkedSites.length > 0;
        const hasKey = aiOpenAiKey && aiOpenAiKey.value.trim().length > 0;

        if (hasSelectedApps && hasSelectedSites && hasKey) {
            btnStartAi.disabled = false;
            btnStartAi.classList.remove('bg-slate-800', 'text-slate-500', 'border-slate-700', 'cursor-not-allowed');
            btnStartAi.classList.add('bg-gradient-to-r', 'from-purple-600', 'to-indigo-600', 'text-white', 'hover:shadow-lg', 'hover:shadow-purple-900/30', 'border-transparent', 'transform', 'active:scale-95', 'cursor-pointer');
        } else {
            btnStartAi.disabled = true;
            btnStartAi.classList.add('bg-slate-800', 'text-slate-500', 'border-slate-700', 'cursor-not-allowed');
            btnStartAi.classList.remove('bg-gradient-to-r', 'from-purple-600', 'to-indigo-600', 'text-white', 'hover:shadow-lg', 'hover:shadow-purple-900/30', 'border-transparent', 'transform', 'active:scale-95', 'cursor-pointer');
        }
    }

    // --- AI: Reset UI ---
    function resetAiUi() {
        // (Giu nguyen nhu cu)
        btnStartAi.classList.remove('hidden');
        btnStartAi.disabled = false;
        btnStartAi.innerHTML = `<div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center group-hover:scale-110 transition-transform"><i class="ri-play-fill text-lg"></i></div><span class="tracking-wide">BẮT ĐẦU</span>`;
        updateAiButtonState(); 
        btnStopAi.classList.add('hidden');
        aiProgressContainer.classList.add('hidden', 'opacity-0', 'translate-y-[-10px]');
        
        if(aiConcurrency) aiConcurrency.disabled = false;
        if(aiDelay) aiDelay.disabled = false;
        if(aiOpenAiKey) aiOpenAiKey.disabled = false;
        if(aiDemoMode) aiDemoMode.disabled = false;
        
        siteCheckboxes.forEach(cb => cb.disabled = false);
    }

    // --- Settings: Save/Load ---
    // (Giu nguyen loadSettings, saveSettings)
    function loadSettings() {
        if(aiOpenAiKey) {
            const savedKey = localStorage.getItem('ai_openai_key');
            if(savedKey) aiOpenAiKey.value = savedKey;
        }
        if(aiConcurrency) {
            const savedThreads = localStorage.getItem('ai_concurrency');
            if(savedThreads) aiConcurrency.value = savedThreads;
        }
        if(aiDelay) {
            const savedDelay = localStorage.getItem('ai_delay');
            if(savedDelay) aiDelay.value = savedDelay;
        }
    }

    function saveSettings() {
        if(aiOpenAiKey) localStorage.setItem('ai_openai_key', aiOpenAiKey.value);
        if(aiConcurrency) localStorage.setItem('ai_concurrency', aiConcurrency.value);
        if(aiDelay) localStorage.setItem('ai_delay', aiDelay.value);
    }

    // --- AI Result Modal (Demo) ---
    // (Giu nguyen showAiResultModal, closeAiResultModal)
    function showAiResultModal(appName, results) {
        if (!results || results.length === 0) return;
        aiResultAppName.textContent = `App: ${appName}`;
        let tabButtonsHtml = '';
        let tabContentsHtml = '';
        results.forEach((res, index) => {
            const isActive = index === 0;
            const tabId = `tab-${index}`;
            tabButtonsHtml += `
                <button class="tab-btn w-full text-left px-4 py-3 text-sm font-medium border-l-2 transition-all flex items-center justify-between group ${isActive ? 'border-emerald-500 bg-slate-800 text-emerald-400' : 'border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}" data-target="${tabId}">
                    <span class="truncate mr-2">${res.siteName}</span>
                    ${res.error ? '<i class="ri-error-warning-fill text-red-500"></i>' : '<i class="ri-check-double-line text-emerald-500 opacity-0 group-hover:opacity-50 ' + (isActive ? 'opacity-100' : '') + '"></i>'}
                </button>
            `;
            tabContentsHtml += `
                <div id="${tabId}" class="tab-pane space-y-6 ${isActive ? '' : 'hidden'} animate-fade-in">
                    ${res.error 
                        ? `<div class="p-4 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-sm"><i class="ri-error-warning-line mr-2"></i>${res.error}</div>`
                        : `
                        <div class="space-y-2">
                            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><i class="ri-prompt-line text-purple-400"></i> Prompt</label>
                            <div class="bg-slate-900/50 p-4 rounded-lg border border-slate-800/80 group hover:border-purple-500/30 transition-colors"><pre class="text-slate-400 font-mono text-xs whitespace-pre-wrap leading-relaxed select-text">${res.prompt}</pre></div>
                        </div>
                        <div class="border-t border-slate-800"></div>
                        <div class="space-y-2">
                            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><i class="ri-file-text-line text-emerald-400"></i> Kết quả AI</label>
                            <div class="bg-slate-900/50 p-4 rounded-lg border border-slate-800/80 group hover:border-emerald-500/30 transition-colors"><pre class="result-content text-emerald-100 font-mono text-sm whitespace-pre-wrap leading-relaxed select-text">${res.content}</pre></div>
                        </div>
                        `
                    }
                </div>
            `;
        });
        aiResultTabs.innerHTML = tabButtonsHtml;
        aiResultTabContent.innerHTML = tabContentsHtml;
        const tabs = aiResultTabs.querySelectorAll('.tab-btn');
        const panes = aiResultTabContent.querySelectorAll('.tab-pane');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => {
                    t.classList.remove('border-emerald-500', 'bg-slate-800', 'text-emerald-400');
                    t.classList.add('border-transparent', 'text-slate-400');
                    t.querySelector('i.ri-check-double-line')?.classList.add('opacity-0');
                });
                panes.forEach(p => p.classList.add('hidden'));
                tab.classList.remove('border-transparent', 'text-slate-400');
                tab.classList.add('border-emerald-500', 'bg-slate-800', 'text-emerald-400');
                tab.querySelector('i.ri-check-double-line')?.classList.remove('opacity-0');
                const targetId = tab.dataset.target;
                document.getElementById(targetId).classList.remove('hidden');
            });
        });
        aiResultModal.classList.remove('hidden');
    }

    function closeAiResultModal() {
        aiResultModal.classList.add('hidden');
    }

    // +++ MOI: Show Posted Details Modal +++
    function showPostedDetails(appId) {
        const app = itemsOnPage.find(a => a.appId === appId);
        if(!app) return;
        const appData = getSafeAppData(app);
        
        const postedIds = new Set(appData.postedSiteIds);
        
        const postedListEl = document.getElementById('list-posted');
        const unpostedListEl = document.getElementById('list-unposted');
        const countPostedEl = document.getElementById('count-posted');
        const countUnpostedEl = document.getElementById('count-unposted');
        
        let postedHtml = '';
        let unpostedHtml = '';
        let pCount = 0;
        let uCount = 0;

        globalWpSites.forEach(site => {
            if (postedIds.has(site.id)) {
                pCount++;
                postedHtml += `<div class="flex items-center text-sm text-emerald-300 p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                    <i class="ri-checkbox-circle-fill mr-2 text-emerald-500"></i> ${site.siteName}
                </div>`;
            } else {
                uCount++;
                unpostedHtml += `<div class="flex items-center text-sm text-slate-400 p-1.5 rounded bg-slate-700/30 border border-slate-700/50">
                    <i class="ri-checkbox-blank-circle-line mr-2 text-slate-600"></i> ${site.siteName}
                </div>`;
            }
        });

        if (pCount === 0) postedHtml = '<p class="text-xs text-slate-500 italic pl-1">Chưa đăng bài nào.</p>';
        if (uCount === 0) unpostedHtml = '<p class="text-xs text-slate-500 italic pl-1">Đã phủ sóng toàn bộ!</p>';

        postedListEl.innerHTML = postedHtml;
        unpostedListEl.innerHTML = unpostedHtml;
        countPostedEl.textContent = pCount;
        countUnpostedEl.textContent = uCount;

        postedDetailsModal.classList.remove('hidden');
    }

    function closePostedDetailsModal() {
        postedDetailsModal.classList.add('hidden');
    }
    // +++ END +++


    // ==========================================
    // 3. ACTION HANDLER (DELETE / RESTORE)
    // ==========================================
    async function performAction(actionType, appIds) {
        // (Giu nguyen performAction nhu cu)
        let endpoint, method, confirmTitle, confirmButtonText, confirmButtonColor;
        const count = isSelectingAllDb ? totalItemsInDb : appIds.length;

        switch(actionType) {
            case 'delete': 
                endpoint = '/api/apps'; method = 'DELETE'; 
                confirmTitle = `Vứt ${count} app?`; confirmButtonColor = '#dc2626'; confirmButtonText = 'Xoá'; 
                break;
            case 'restore': 
                endpoint = '/api/apps/restore'; method = 'POST'; 
                confirmTitle = `Khôi phục ${count} app?`; confirmButtonColor = '#10b981'; confirmButtonText = 'Khôi phục'; 
                break;
            case 'force_delete': 
                endpoint = '/api/apps/permanent'; method = 'DELETE'; 
                confirmTitle = `XOÁ VĨNH VIỄN ${count} app?`; confirmButtonColor = '#dc2626'; confirmButtonText = 'Xoá vĩnh viễn'; 
                break;
        }

        const res = await Swal.fire({ 
            title: confirmTitle, icon: 'warning', showCancelButton: true, 
            confirmButtonText, confirmButtonColor, background: '#1e293b', color: '#e2e8f0' 
        });

        if (!res.isConfirmed) return;

        Swal.fire({ title: 'Đang xử lý...', didOpen: () => Swal.showLoading(), background: '#1e293b', color: '#e2e8f0' });

        try {
            const payload = {
                appIds: isSelectingAllDb ? null : appIds,
                [actionType === 'restore' ? 'restoreAll' : 'deleteAll']: isSelectingAllDb,
                search: (isSelectingAllDb && searchTerm) ? searchTerm : null
            };
            const response = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error((await response.json()).message);
            Swal.fire({ title: 'Xong!', icon: 'success', timer: 1000, showConfirmButton: false, background: '#1e293b', color: '#e2e8f0' });
            setTimeout(() => window.location.reload(), 1000);
        } catch (err) {
            Swal.fire({ title: 'Lỗi', text: err.message, icon: 'error', background: '#1e293b', color: '#e2e8f0' });
        }
    }


    // ==========================================
    // 4. GAN SU KIEN (EVENT LISTENERS)
    // ==========================================

    // -- Load Settings Init --
    loadSettings();

    // -- Settings Change Events --
    if(aiOpenAiKey) {
        aiOpenAiKey.addEventListener('input', updateAiButtonState);
        aiOpenAiKey.addEventListener('change', saveSettings);
    }
    if(aiConcurrency) aiConcurrency.addEventListener('change', saveSettings);
    if(aiDelay) aiDelay.addEventListener('change', saveSettings);

    // -- Site Checkboxes --
    siteCheckboxes.forEach(cb => {
        cb.addEventListener('change', updateAiButtonState);
    });

    // -- Select All Sites --
    if(btnSelectAllSites) {
        btnSelectAllSites.addEventListener('click', () => {
            const allChecked = Array.from(siteCheckboxes).every(cb => cb.checked);
            siteCheckboxes.forEach(cb => cb.checked = !allChecked);
            btnSelectAllSites.textContent = !allChecked ? "Bỏ chọn hết" : "Chọn tất cả";
            updateAiButtonState();
        });
    }

    // -- Start AI Button --
    if (btnStartAi) {
        btnStartAi.addEventListener('click', async () => {
            const isDemo = aiDemoMode.checked;
            
            // UI Loading
            btnStartAi.classList.add('hidden');
            if (!isDemo) {
                btnStopAi.classList.remove('hidden');
                aiProgressContainer.classList.remove('hidden');
                aiProgressContainer.classList.remove('opacity-0', 'translate-y-[-10px]');
                aiStatusText.innerHTML = `<i class="ri-loader-4-line animate-spin mr-2 text-purple-400"></i> Đang khởi tạo...`;
            } else {
                // Demo Loading: Show button but disabled with spinner
                btnStartAi.classList.remove('hidden'); 
                btnStartAi.disabled = true;
                btnStartAi.innerHTML = `<div class="w-full flex justify-center"><i class="ri-loader-4-line animate-spin text-xl"></i></div>`;
            }
            
            // Disable Inputs
            if(aiConcurrency) aiConcurrency.disabled = true;
            if(aiDelay) aiDelay.disabled = true;
            if(aiOpenAiKey) aiOpenAiKey.disabled = true;
            if(aiDemoMode) aiDemoMode.disabled = true;
            siteCheckboxes.forEach(cb => cb.disabled = true);

            // Payload
            const selectedSiteIds = Array.from(document.querySelectorAll('.site-checkbox:checked')).map(cb => cb.value);
            const payload = {
                appIds: Array.from(selectedAppIds),
                siteIds: selectedSiteIds,
                openAiKey: aiOpenAiKey.value,
                concurrency: aiConcurrency.value,
                delay: aiDelay.value,
                isDemo: isDemo
            };

            try {
                const res = await fetch('/api/ai/start', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                
                if(!res.ok) throw new Error(data.message);
                
                if (data.isDemo) {
                    showAiResultModal(data.appName, data.results);
                    resetAiUi();
                } else {
                    aiStatusText.innerHTML = `<i class="ri-robot-2-line animate-pulse mr-2 text-emerald-400"></i> AI đang viết bài...`;
                }

            } catch (err) {
                Swal.fire({ icon: 'error', title: 'Lỗi', text: err.message, background: '#1e293b', color: '#e2e8f0' });
                resetAiUi();
            }
        });
    }

    // -- Stop AI Button --
    if (btnStopAi) {
        btnStopAi.addEventListener('click', async () => {
            if(!confirm('Dừng tác vụ hiện tại?')) return;
            try { await fetch('/api/ai/stop', { method: 'POST' }); } catch(e) {}
            resetAiUi();
        });
    }

    // -- Modal Events --
    if(aiResultCloseBtn) aiResultCloseBtn.addEventListener('click', closeAiResultModal);
    if(aiResultBackdrop) aiResultBackdrop.addEventListener('click', closeAiResultModal);
    if(aiResultCopyBtn) {
        aiResultCopyBtn.addEventListener('click', () => {
            const activePane = aiResultTabContent.querySelector('.tab-pane:not(.hidden)');
            if(!activePane) return;
            const contentPre = activePane.querySelector('.result-content');
            if(!contentPre) return;
            navigator.clipboard.writeText(contentPre.textContent).then(() => {
                const orgHtml = aiResultCopyBtn.innerHTML;
                aiResultCopyBtn.innerHTML = '<i class="ri-check-line text-lg"></i> <span>Đã Copy!</span>';
                aiResultCopyBtn.classList.add('bg-emerald-600', 'border-emerald-500');
                aiResultCopyBtn.classList.remove('bg-purple-600', 'border-purple-500/50');
                setTimeout(() => {
                    aiResultCopyBtn.innerHTML = orgHtml;
                    aiResultCopyBtn.classList.remove('bg-emerald-600', 'border-emerald-500');
                    aiResultCopyBtn.classList.add('bg-purple-600', 'border-purple-500/50');
                }, 2000);
            });
        });
    }

    // +++ MOI: Posted Details Modal Events +++
    if(postedDetailsCloseBtn) postedDetailsCloseBtn.addEventListener('click', closePostedDetailsModal);
    if(postedDetailsBackdrop) postedDetailsBackdrop.addEventListener('click', closePostedDetailsModal);
    // +++ END +++

    // -- Socket Listener --
    if(socket) {
        socket.on('ai_job:done', (stats) => {
            resetAiUi();
            Swal.fire({
                title: 'Hoàn tất!',
                html: `Đã chạy xong Job!<br>Success: <b class="text-green-500">${stats.success}</b> | Fail: <b class="text-red-500">${stats.failed}</b> | Skipped: <b class="text-yellow-500">${stats.skipped}</b>`,
                icon: 'success',
                background: '#1e293b',
                color: '#e2e8f0',
                confirmButtonColor: '#10b981'
            });
        });
    }

    // -- Table Delegation --
    tableBody.addEventListener('click', (e) => {
        const target = e.target;
        if (target.closest('.app-title-link')) {
            e.preventDefault();
            const row = target.closest('tr');
            const appId = row.dataset.appId;
            const app = itemsOnPage.find(a => a.appId === appId);
            if (app && window.showAppDetailModal) window.showAppDetailModal(getSafeAppData(app));
            return;
        }
        
        // +++ MOI: Handle Click Show Posted Details +++
        const btnPosted = target.closest('.btn-show-posted');
        if (btnPosted) {
            e.preventDefault();
            e.stopPropagation(); // Tranh click nham vao row
            showPostedDetails(btnPosted.dataset.appId);
            return;
        }
        // +++ END +++

        const row = target.closest('tr');
        if (!row) return;
        if (target.closest('.btn-delete-single')) performAction('delete', [row.dataset.appId]);
        if (target.closest('.btn-restore-single')) performAction('restore', [row.dataset.appId]);
        if (target.closest('.btn-force-delete-single')) performAction('force_delete', [row.dataset.appId]);
    });

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

    if (btnDeleteSelected) btnDeleteSelected.onclick = () => performAction('delete', Array.from(selectedAppIds));
    if (btnRestoreSelected) btnRestoreSelected.onclick = () => performAction('restore', Array.from(selectedAppIds));
    if (btnForceDeleteSelected) btnForceDeleteSelected.onclick = () => performAction('force_delete', Array.from(selectedAppIds));

    // 5. INIT
    buildTable();
    updateAiButtonState(); 
});
/*
 * File: public/js/listManager.js
 * "Não" chung cho cả trang App List và Trash
 * Fix: Socket Listener for AI Job Completion
 */
document.addEventListener('DOMContentLoaded', () => {
    
    const socket = io(); // +++ DAM BAO SOCKET DUOC KHOI TAO +++

    const pageMode = document.body.dataset.pageMode;
    const searchTerm = document.body.dataset.searchTerm || '';

    if (pageMode !== 'list' && pageMode !== 'trash') return; 

    const tableBody = document.getElementById('app-table-body');
    const placeholder = document.getElementById('table-placeholder');
    const selectAllPageCheckbox = document.getElementById('select-all-page');
    const selectionControls = document.getElementById('selection-controls');
    const selectionCount = document.getElementById('selection-count');
    const btnSelectAllDb = document.getElementById('btn-select-all-db');

    // +++ AI Panel Elements +++
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
    
    // +++ Result Modal Elements +++
    const aiResultModal = document.getElementById('aiResultModal');
    const aiResultBackdrop = document.getElementById('aiResultBackdrop');
    const aiResultCloseBtn = document.getElementById('aiResultCloseBtn');
    const aiResultTabs = document.getElementById('ai-result-tabs');         
    const aiResultTabContent = document.getElementById('ai-result-tab-content'); 
    const aiResultAppName = document.getElementById('ai-result-app-name');
    const aiResultCopyBtn = document.getElementById('aiResultCopyBtn');

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

    // +++ LISTENER: JOB DONE (FIX LOI KET LOADING) +++
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

    // --- SELECT ALL SITES LOGIC ---
    if(btnSelectAllSites) {
        btnSelectAllSites.addEventListener('click', () => {
            const allChecked = Array.from(siteCheckboxes).every(cb => cb.checked);
            siteCheckboxes.forEach(cb => cb.checked = !allChecked);
            btnSelectAllSites.textContent = !allChecked ? "Bỏ chọn hết" : "Chọn tất cả";
            updateAiButtonState();
        });
    }

    // --- Helper Functions (Giu nguyen) ---
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

    // --- AI LOGIC: Check trang thai nut Start ---
    function updateAiButtonState() {
        if (!btnStartAi) return;
        
        const hasSelectedApps = selectedAppIds.size > 0;
        const checkedSites = document.querySelectorAll('.site-checkbox:checked');
        const hasSelectedSites = checkedSites.length > 0;
        const hasKey = aiOpenAiKey && aiOpenAiKey.value.trim().length > 0;

        if (hasSelectedApps && hasSelectedSites && hasKey) {
            btnStartAi.disabled = false;
            btnStartAi.classList.remove('bg-slate-800', 'text-slate-500', 'border-slate-700', 'cursor-not-allowed');
            btnStartAi.classList.add('bg-gradient-to-r', 'from-purple-600', 'to-indigo-600', 'text-white', 'hover:shadow-lg', 'hover:shadow-purple-900/30', 'border-transparent', 'transform', 'active:scale-95', 'cursor-pointer');
            
            btnStartAi.querySelector('span').textContent = "BẮT ĐẦU";
            const iconDiv = btnStartAi.querySelector('div');
            if(iconDiv) iconDiv.classList.replace('bg-slate-700', 'bg-white/20');
        } else {
            btnStartAi.disabled = true;
            btnStartAi.classList.add('bg-slate-800', 'text-slate-500', 'border-slate-700', 'cursor-not-allowed');
            btnStartAi.classList.remove('bg-gradient-to-r', 'from-purple-600', 'to-indigo-600', 'text-white', 'hover:shadow-lg', 'hover:shadow-purple-900/30', 'border-transparent', 'transform', 'active:scale-95', 'cursor-pointer');
            
            btnStartAi.querySelector('span').textContent = "BẮT ĐẦU";
            const iconDiv = btnStartAi.querySelector('div');
            if(iconDiv) iconDiv.classList.replace('bg-white/20', 'bg-slate-700');
        }
    }

    function updateSelectionControls() {
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

    loadSettings();

    if(aiOpenAiKey) {
        aiOpenAiKey.addEventListener('input', updateAiButtonState);
        aiOpenAiKey.addEventListener('change', saveSettings);
    }
    if(aiConcurrency) aiConcurrency.addEventListener('change', saveSettings);
    if(aiDelay) aiDelay.addEventListener('change', saveSettings);
    
    siteCheckboxes.forEach(cb => {
        cb.addEventListener('change', updateAiButtonState);
    });

    // Xu ly Nut Bam Start AI
    if (btnStartAi) {
        btnStartAi.addEventListener('click', async () => {
            const isDemo = aiDemoMode.checked;
            
            btnStartAi.classList.add('hidden');
            if (!isDemo) {
                btnStopAi.classList.remove('hidden');
                aiProgressContainer.classList.remove('hidden');
                aiProgressContainer.classList.remove('opacity-0', 'translate-y-[-10px]');
                aiStatusText.innerHTML = `<i class="ri-loader-4-line animate-spin mr-2 text-purple-400"></i> Đang khởi tạo...`;
            } else {
                btnStartAi.classList.remove('hidden'); 
                btnStartAi.disabled = true;
                btnStartAi.innerHTML = `<div class="w-full flex justify-center"><i class="ri-loader-4-line animate-spin text-xl"></i></div>`;
            }
            
            if(aiConcurrency) aiConcurrency.disabled = true;
            if(aiDelay) aiDelay.disabled = true;
            if(aiOpenAiKey) aiOpenAiKey.disabled = true;
            if(aiDemoMode) aiDemoMode.disabled = true;
            
            siteCheckboxes.forEach(cb => cb.disabled = true);

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
                Swal.fire({
                    icon: 'error',
                    title: 'Lỗi',
                    text: err.message,
                    background: '#1e293b',
                    color: '#e2e8f0'
                });
                resetAiUi();
            }
        });
    }

    function resetAiUi() {
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

    if (btnStopAi) {
        btnStopAi.addEventListener('click', async () => {
            if(!confirm('Dừng tác vụ hiện tại?')) return;
            try { await fetch('/api/ai/stop', { method: 'POST' }); } catch(e) {}
            resetAiUi();
        });
    }

    // --- Vertical Tab Logic ---
    function showAiResultModal(appName, results) {
        if (!results || results.length === 0) return;
        
        aiResultAppName.textContent = `App: ${appName}`;
        
        let tabButtonsHtml = '';
        let tabContentsHtml = '';
        
        results.forEach((res, index) => {
            const isActive = index === 0;
            const tabId = `tab-${index}`;
            
            // Vertical Tab Button
            tabButtonsHtml += `
                <button class="tab-btn w-full text-left px-4 py-3 text-sm font-medium border-l-2 transition-all flex items-center justify-between group ${isActive ? 'border-emerald-500 bg-slate-800 text-emerald-400' : 'border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}" data-target="${tabId}">
                    <span class="truncate mr-2">${res.siteName}</span>
                    ${res.error ? '<i class="ri-error-warning-fill text-red-500"></i>' : '<i class="ri-check-double-line text-emerald-500 opacity-0 group-hover:opacity-50 ' + (isActive ? 'opacity-100' : '') + '"></i>'}
                </button>
            `;
            
            // Content Pane
            tabContentsHtml += `
                <div id="${tabId}" class="tab-pane space-y-6 ${isActive ? '' : 'hidden'} animate-fade-in">
                    ${res.error 
                        ? `<div class="p-4 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-sm"><i class="ri-error-warning-line mr-2"></i>${res.error}</div>`
                        : `
                        <div class="space-y-2">
                            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><i class="ri-prompt-line text-purple-400"></i> Prompt</label>
                            <div class="bg-slate-900/50 p-4 rounded-lg border border-slate-800/80 group hover:border-purple-500/30 transition-colors"><pre class="text-slate-400 font-mono text-xs whitespace-pre-wrap leading-relaxed">${res.prompt}</pre></div>
                        </div>
                        <div class="border-t border-slate-800"></div>
                        <div class="space-y-2">
                            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><i class="ri-file-text-line text-emerald-400"></i> Kết quả AI</label>
                            <div class="bg-slate-900/50 p-4 rounded-lg border border-slate-800/80 group hover:border-emerald-500/30 transition-colors"><pre class="result-content text-emerald-100 font-mono text-sm whitespace-pre-wrap leading-relaxed">${res.content}</pre></div>
                        </div>
                        `
                    }
                </div>
            `;
        });
        
        aiResultTabs.innerHTML = tabButtonsHtml;
        aiResultTabContent.innerHTML = tabContentsHtml;
        
        // Click Event
        const tabs = aiResultTabs.querySelectorAll('.tab-btn');
        const panes = aiResultTabContent.querySelectorAll('.tab-pane');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Reset style
                tabs.forEach(t => {
                    t.classList.remove('border-emerald-500', 'bg-slate-800', 'text-emerald-400');
                    t.classList.add('border-transparent', 'text-slate-400');
                    t.querySelector('i.ri-check-double-line')?.classList.add('opacity-0');
                });
                panes.forEach(p => p.classList.add('hidden'));
                
                // Set Active
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

    // Events Delegation
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

    // Init
    buildTable();
    updateAiButtonState(); 
});
document.addEventListener('DOMContentLoaded', () => {

  // --- 1. Khoi tao Socket.IO Client ---
  const socket = io();

  // --- 2. Lay cac "linh kien" UI ---
  const scrapeBtn = document.getElementById('startScrapeBtn');
  const btnSpinner = document.getElementById('loading-spinner');
  const btnText = document.getElementById('btn-text');
  const btnIcon = document.getElementById('btn-icon'); 
  
  // Input chung
  const concurrencyEl = document.getElementById('concurrency');
  const delayEl = document.getElementById('delay');
  
  // +++ "DO" LAI LINH KIEN CHON CHE DO +++
  const btnModeById = document.getElementById('btn-mode-by-id');
  const btnModeByList = document.getElementById('btn-mode-by-list');
  
  const panelById = document.getElementById('panel-by-id');
  const panelByList = document.getElementById('panel-by-list');
  const appIdsListEl = document.getElementById('appIdsList');
  
  const listCategoryEl = document.getElementById('list-category');
  const listCollectionEl = document.getElementById('list-collection');
  const listNumEl = document.getElementById('list-num');
  
  // Linh kien Tab (nhu cu)
  const alertContainer = document.getElementById('alert-container');
  const tabQueue = document.getElementById('tab-queue');
  const tabSaved = document.getElementById('tab-saved');
  const panelQueue = document.getElementById('panel-queue');
  const panelSaved = document.getElementById('panel-saved');
  const queueTableBody = document.getElementById('app-table-body-queue');
  const queuePlaceholder = document.getElementById('table-placeholder-queue');
  const savedTableBody = document.getElementById('app-table-body-saved');
  const savedPlaceholder = document.getElementById('table-placeholder-saved');
  const queueCount = document.getElementById('queue-count');
  const savedCount = document.getElementById('saved-count');

  // Bien toan cuc
  let savedAppIds = new Set(initialSavedApps.map(app => app.appId));
  let currentScrapeMode = 'by_id'; // +++ BIEN LUU CHE DO HIEN TAI +++

  // --- 3. Dinh nghia cac ham "chuc nang" ---

  // (Cac ham showAlert, updateButtonState, checkJobStatus, updateTabCounts, buildSavedRow, buildInitialSavedTable, buildQueueTable deu giu nguyen)
  function showAlert(message, isError = false) { /* ... (Giu nguyen) ... */
    alertContainer.innerHTML = ''; if (!message) return;
    const t = isError ? { bg: 'bg-red-800/70', b: 'border-red-600/50', x: 'text-red-200', i: 'Toang!' } : { bg: 'bg-green-800/70', b: 'border-green-600/50', x: 'text-green-200', i: 'Ngon!' };
    alertContainer.innerHTML = `<div class="${t.bg} ${t.b} backdrop-blur-md ${t.x} px-4 py-3 rounded-lg relative ring-1 ring-white/10" role="alert"><strong class="font-bold">${t.i}</strong><span class="block sm:inline ml-2">${message}</span></div>`;
  }
  function updateButtonState(isRunning) { /* ... (Giu nguyen) ... */
    scrapeBtn.disabled = isRunning;
    btnText.textContent = isRunning ? 'Job đang chạy...' : 'Bắt đầu lấy dữ liệu';
    btnSpinner.classList.toggle('hidden', !isRunning);
    btnIcon.classList.toggle('hidden', isRunning);
  }
  async function checkJobStatus() { /* ... (Giu nguyen) ... */
     try { const r = await fetch('/api/scrape/status'), d = await r.json(); updateButtonState(d.isJobRunning); } catch (e) { updateButtonState(false); }
  }
  function updateTabCounts() { /* ... (Giu nguyen) ... */
    const queueLen = queueTableBody.rows.length;
    const savedLen = savedAppIds.size;
    queueCount.textContent = queueLen;
    savedCount.textContent = savedLen;
    queueCount.classList.toggle('hidden', queueLen === 0);
    savedCount.classList.toggle('hidden', savedLen === 0);
  }
  function buildSavedRow(app) { /* ... (Giu nguyen) ... */
    const row = document.createElement('tr'); row.setAttribute('data-app-id', app.appId);
    const appData = app.fullData;
    const typeLabel = app.appType === 'GAME'
      ? `<span class="inline-flex items-center rounded-md bg-purple-700/80 px-2 py-1 text-xs font-medium text-purple-200"><i class="ri-gamepad-line mr-1.5"></i>GAME</span>`
      : `<span class="inline-flex items-center rounded-md bg-sky-700/80 px-2 py-1 text-xs font-medium text-sky-200"><i class="ri-app-store-line mr-1.5"></i>APP</span>`;
    row.innerHTML = `
      <td class="py-3 pl-4 pr-3 text-sm sm:pl-6"><div class="flex items-center"><div class="h-10 w-10 flex-shrink-0"><img class="h-10 w-10 rounded-lg" src="${appData.icon}" alt=""></div><div class="ml-4"><div class="font-medium text-white">${appData.title}</div><div class="text-slate-400">${appData.appId}</div></div></div></td>
      <td class="px-3 py-4 text-sm">${typeLabel}</td>
      <td class="px-3 py-4 text-sm text-slate-400">${new Date(app.lastScrapedAt).toLocaleString()}</td>`;
    return row;
  }
  function buildInitialSavedTable() { /* ... (Giu nguyen) ... */
    savedTableBody.innerHTML = '';
    if (initialSavedApps.length === 0) { savedPlaceholder.classList.remove('hidden'); }
    else { savedPlaceholder.classList.add('hidden'); initialSavedApps.forEach(app => { savedTableBody.appendChild(buildSavedRow(app)); }); }
    updateTabCounts();
  }
  function buildQueueTable(appIds) { /* ... (Giu nguyen - Ham ve bang "Hang cho" 3 cot) ... */
    queueTableBody.innerHTML = '';
    if (appIds.length === 0) { queuePlaceholder.classList.remove('hidden');
    } else {
      queuePlaceholder.classList.add('hidden');
      appIds.forEach(appId => {
        const row = document.createElement('tr'); row.setAttribute('data-app-id', appId); row.classList.add('opacity-50');
        row.innerHTML = `
          <td class="py-3 pl-4 pr-3 text-sm sm:pl-6"><div class="flex items-center"><div class="h-10 w-10 flex-shrink-0 flex items-center justify-center bg-slate-700 rounded-lg text-slate-400"><i class="ri-time-line text-xl"></i></div><div class="ml-4"><div class="font-medium text-white">${appId}</div><div class="text-slate-400">...</div></div></div></td>
          <td class="px-3 py-4 text-sm"><span class="inline-flex items-center rounded-md bg-slate-700/80 px-2 py-1 text-xs font-medium text-slate-300">...</span></td>
          <td class="px-3 py-4 text-sm"><span class="inline-flex items-center rounded-md bg-slate-700/80 px-2 py-1 text-xs font-medium text-slate-300"><i class="ri-loader-3-line mr-1.5"></i>Đang chờ</span></td>`;
        queueTableBody.appendChild(row);
      });
    }
    updateTabCounts();
  }
  
  /**
   * +++ (CAP NHAT) Ham xu ly khi Bro bam nut "Bat Dau"
   * Se doc 'currentScrapeMode' thay vi 'radio.checked'
   */
  async function handleStartScrape() {
    showAlert(null); 
    
    // 1. Lay du lieu "chung"
    const concurrency = concurrencyEl.value;
    const delay = delayEl.value;
    const scrapeMode = currentScrapeMode; // <-- LAY TU BIEN TOAN CUC

    let payload = { concurrency, delay, scrapeMode };
    let allAppIds = [];

    // 2. Lay du lieu "rieng" theo che do
    if (scrapeMode === 'by_id') {
      const appIdsList = appIdsListEl.value;
      allAppIds = [...new Set(appIdsList.split('\n').map(id => id.trim()).filter(Boolean))];
      
      if (allAppIds.length === 0) {
        showAlert("Bro chua nhap App ID nao ca?", true);
        return;
      }
      payload.appIdsList = appIdsList; 
      
    } else { // scrapeMode === 'by_list'
      payload.category = listCategoryEl.value;
      payload.collection = listCollectionEl.value;
      payload.num = listNumEl.value;
    }

    // 3. Bat trang thai loading
    updateButtonState(true);
    if (scrapeMode === 'by_list') {
      buildQueueTable([]); 
      switchToTab('queue');
      queuePlaceholder.innerHTML = '<p class="text-yellow-400 p-8 text-center"><i class="ri-search-line text-4xl"></i><br>Đang tìm apps... Bro chờ tí.</p>';
      queuePlaceholder.classList.remove('hidden');
    }

    try {
      // 4. Goi API "ra lenh"
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) 
      });
      
      const result = await response.json(); 
      if (!response.ok) { throw new Error(result.message || 'Lỗi không xác định'); }

      // 5. Nhan list App ID tu backend tra ve
      const { appIds: returnedAppIds, message } = result;
      
      // Loc app moi
      const newAppIds = returnedAppIds.filter(id => !savedAppIds.has(id));

      if (newAppIds.length === 0) {
        showAlert("Tat ca app tim thay deu da co trong 'Da luu'.", false);
        updateButtonState(false); 
        queuePlaceholder.innerHTML = '<p class="text-slate-500 p-8 text-center"><i class="ri-inbox-line text-4xl"></i><br>Hàng chờ đang trống.</p>';
        return;
      }

      // 6. Ve bang "Hang Cho" voi cac app moi
      buildQueueTable(newAppIds);
      switchToTab('queue'); 
      showAlert(message, false);
      appIdsListEl.value = ''; 

    } catch (err) {
      showAlert(err.message, true);
      updateButtonState(false);
      queuePlaceholder.innerHTML = `<p class="text-red-400 p-8 text-center"><i class="ri-error-warning-line text-4xl"></i><br>${err.message}</p>`;
    }
  }

  // (Ham switchToTab giu nguyen)
  function switchToTab(tabName) {
    if (tabName === 'queue') {
      panelQueue.classList.remove('hidden');
      tabQueue.classList.add('text-emerald-400', 'border-emerald-500');
      tabQueue.classList.remove('text-slate-400', 'border-transparent', 'hover:text-slate-200', 'hover:border-slate-400');
      panelSaved.classList.add('hidden');
      tabSaved.classList.remove('text-emerald-400', 'border-emerald-500');
      tabSaved.classList.add('text-slate-400', 'border-transparent', 'hover:text-slate-200', 'hover:border-slate-400');
    } else {
      panelSaved.classList.remove('hidden');
      tabSaved.classList.add('text-emerald-400', 'border-emerald-500');
      tabSaved.classList.remove('text-slate-400', 'border-transparent', 'hover:text-slate-200', 'hover:border-slate-400');
      panelQueue.classList.add('hidden');
      tabQueue.classList.remove('text-emerald-400', 'border-emerald-500');
      tabQueue.classList.add('text-slate-400', 'border-transparent', 'hover:text-slate-200', 'hover:border-slate-400');
    }
  }

  /**
   * +++ (MOI) Ham xu ly an/hien panel va "active" nut che do
   */
  function setScrapeMode(mode) {
    currentScrapeMode = mode; // Cap nhat bien toan cuc

    if (mode === 'by_id') {
      // Hien panel ID
      panelById.classList.remove('hidden');
      panelByList.classList.add('hidden');
      
      // Active nut "Thu cong"
      btnModeById.classList.add('text-white', 'bg-emerald-500', 'shadow-md');
      btnModeById.classList.remove('text-slate-400', 'hover:bg-slate-800/50', 'hover:text-white');
      
      // Deactive nut "Tu dong"
      btnModeByList.classList.remove('text-white', 'bg-emerald-500', 'shadow-md');
      btnModeByList.classList.add('text-slate-400', 'hover:bg-slate-800/50', 'hover:text-white');

    } else { // mode === 'by_list'
      // Hien panel List
      panelById.classList.add('hidden');
      panelByList.classList.remove('hidden');

      // Active nut "Tu dong"
      btnModeByList.classList.add('text-white', 'bg-emerald-500', 'shadow-md');
      btnModeByList.classList.remove('text-slate-400', 'hover:bg-slate-800/50', 'hover:text-white');

      // Deactive nut "Thu cong"
      btnModeById.classList.remove('text-white', 'bg-emerald-500', 'shadow-md');
      btnModeById.classList.add('text-slate-400', 'hover:bg-slate-800/50', 'hover:text-white');
    }
  }

  // --- 4. Lang nghe cac "Tin Nhan" tu Server (Giu nguyen) ---
  
  socket.on('job:info', (message) => { /* ... (Giu nguyen) ... */
    showAlert(message, false);
  });
  socket.on('app:running', (data) => { /* ... (Giu nguyen) ... */
    const row = queueTableBody.querySelector(`tr[data-app-id="${data.appId}"]`);
    if (row) {
      row.classList.remove('opacity-50'); row.classList.add('bg-slate-800');
      row.cells[2].innerHTML = `<span class="inline-flex items-center rounded-md bg-blue-700/80 px-2 py-1 text-xs font-medium text-blue-200"><i class="ri-refresh-line animate-spin mr-1.5"></i>Đang xử lý...</span>`;
    }
  });
  socket.on('app:success', (data) => { /* ... (Giu nguyen) ... */
    const app = data.app;
    const rowInQueue = queueTableBody.querySelector(`tr[data-app-id="${app.appId}"]`);
    if (rowInQueue) { rowInQueue.remove(); }
    savedAppIds.add(app.appId); 
    let rowInSaved = savedTableBody.querySelector(`tr[data-app-id="${app.appId}"]`);
    const newSavedRow = buildSavedRow(app); 
    if (rowInSaved) { rowInSaved.replaceWith(newSavedRow); }
    else { savedTableBody.prepend(newSavedRow); }
    savedPlaceholder.classList.add('hidden');
    updateTabCounts();
  });
  socket.on('app:failed', (data) => { /* ... (Giu nguyen) ... */
    const row = queueTableBody.querySelector(`tr[data-app-id="${data.appId}"]`);
    if (row) {
      row.classList.remove('opacity-50'); row.classList.add('bg-red-900/30');
      row.cells[0].innerHTML = `<div class="flex items-center"><div class="h-10 w-10 flex-shrink-0 flex items-center justify-center bg-red-900/50 rounded-lg text-red-300"><i class="ri-error-warning-line text-xl"></i></div><div class="ml-4"><div class="font-medium text-white">${data.appId}</div><div class="text-red-400 text-xs truncate" title="${data.error}">Lỗi: ${data.error}</div></div></div>`;
      row.cells[1].innerHTML = `<span class="inline-flex items-center rounded-md bg-slate-700/80 px-2 py-1 text-xs font-medium text-slate-300">N/A</span>`;
      row.cells[2].innerHTML = `<span class="inline-flex items-center rounded-md bg-red-800/80 px-2 py-1 text-xs font-medium text-red-200"><i class="ri-close-line mr-1.5"></i>Thất bại</span>`;
    }
  });
  socket.on('job:done', (results) => { /* ... (Giu nguyen) ... */
    showAlert(`Job hoàn tất! Thành công: ${results.success}, Thất bại: ${results.failed}`, false);
    updateButtonState(false);
    updateTabCounts();
    queuePlaceholder.innerHTML = '<p class="text-slate-500 p-8 text-center"><i class="ri-inbox-line text-4xl"></i><br>Hàng chờ đang trống.</p>';
    if (queueTableBody.rows.length === 0) {
      queuePlaceholder.classList.remove('hidden');
    }
  });
  socket.on('job:error', (message) => { /* ... (Giu nguyen) ... */
    showAlert(message, true);
    updateButtonState(false);
  });
  socket.on('connect', () => { checkJobStatus(); });

  // --- 5. Gan su kien va chay ---
  scrapeBtn.addEventListener('click', handleStartScrape);
  tabQueue.addEventListener('click', () => switchToTab('queue'));
  tabSaved.addEventListener('click', () => switchToTab('saved'));
  
  // +++ GAN SU KIEN CHO NUT CHON CHE DO +++
  btnModeById.addEventListener('click', (e) => {
    e.preventDefault();
    setScrapeMode('by_id');
  });
  btnModeByList.addEventListener('click', (e) => {
    e.preventDefault();
    setScrapeMode('by_list');
  });

  // +++ CHAY LAN DAU +++
  buildInitialSavedTable(); 
  checkJobStatus(); 
  switchToTab('saved'); 
  setScrapeMode('by_id'); // Dat che do mac dinh la 'by_id'
});
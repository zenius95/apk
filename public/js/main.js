document.addEventListener('DOMContentLoaded', () => {

  // --- 1. Khoi tao Socket.IO Client ---
  // Socket van can de update "Hang cho"
  const socket = io();

  // --- 2. Lay cac "linh kien" UI (Chi cua trang Scrape) ---
  const scrapeBtn = document.getElementById('startScrapeBtn');
  if (!scrapeBtn) {
    // Neu khong tim thay nut scrape, day khong phai trang Scrape, thoat
    console.log("Khong phai trang Scrape, main.js thoat.");
    return; 
  }

  const btnSpinner = document.getElementById('loading-spinner');
  const btnText = document.getElementById('btn-text');
  const btnIcon = document.getElementById('btn-icon'); 
  
  // Input chung
  const concurrencyEl = document.getElementById('concurrency');
  const delayEl = document.getElementById('delay');
  
  // Linh kien chon che do
  const btnModeById = document.getElementById('btn-mode-by-id');
  const btnModeByList = document.getElementById('btn-mode-by-list');
  
  const panelById = document.getElementById('panel-by-id');
  const panelByList = document.getElementById('panel-by-list');
  const appIdsListEl = document.getElementById('appIdsList');
  
  const listCategoryEl = document.getElementById('list-category');
  const listCollectionEl = document.getElementById('list-collection');
  const listNumEl = document.getElementById('list-num');
  
  // Linh kien Tab (Chi con "Hang cho")
  const alertContainer = document.getElementById('alert-container');
  const tabQueue = document.getElementById('tab-queue');
  const panelQueue = document.getElementById('panel-queue');
  const queueTableBody = document.getElementById('app-table-body-queue');
  const queuePlaceholder = document.getElementById('table-placeholder-queue');
  const queueCount = document.getElementById('queue-count');

  // Bien toan cuc
  let currentScrapeMode = 'by_id'; // Bien luu che do hien tai

  // --- 3. Dinh nghia cac ham "chuc nang" ---

  function showAlert(message, isError = false) { 
    alertContainer.innerHTML = ''; if (!message) return;
    const t = isError ? { bg: 'bg-red-800/70', b: 'border-red-600/50', x: 'text-red-200', i: 'Toang!' } : { bg: 'bg-green-800/70', b: 'border-green-600/50', x: 'text-green-200', i: 'Ngon!' };
    alertContainer.innerHTML = `<div class="${t.bg} ${t.b} backdrop-blur-md ${t.x} px-4 py-3 rounded-lg relative ring-1 ring-white/10" role="alert"><strong class="font-bold">${t.i}</strong><span class="block sm:inline ml-2">${message}</span></div>`;
  }
  function updateButtonState(isRunning) { 
    if (!scrapeBtn) return;
    scrapeBtn.disabled = isRunning;
    btnText.textContent = isRunning ? 'Job đang chạy...' : 'Bắt đầu lấy dữ liệu';
    btnSpinner.classList.toggle('hidden', !isRunning);
    btnIcon.classList.toggle('hidden', isRunning);
  }
  async function checkJobStatus() { 
     try { const r = await fetch('/api/scrape/status'), d = await r.json(); updateButtonState(d.isJobRunning); } catch (e) { updateButtonState(false); }
  }

  // Chi cap nhat so luong "Hang cho"
  function updateTabCounts() {
    const queueLen = queueTableBody.rows.length;
    queueCount.textContent = queueLen;
    queueCount.classList.toggle('hidden', queueLen === 0);
  }

  // Ve bang "Hang cho" (3 cot)
  function buildQueueTable(appIds) { 
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
  
  async function handleStartScrape() {
    showAlert(null); 
    
    // 1. Lay du lieu "chung"
    const concurrency = concurrencyEl.value;
    const delay = delayEl.value;
    const scrapeMode = currentScrapeMode;

    let payload = { concurrency, delay, scrapeMode };
    let allAppIds = []; // Chi de kiem tra input, khong so sanh voi "da luu"

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

      // 5. Nhan list App ID (chi app MOI) tu backend tra ve
      const { appIds: newAppIds, message } = result;
      
      if (newAppIds.length === 0) {
        showAlert(message || "Khong co app moi de them.", false);
        updateButtonState(false); 
        queuePlaceholder.innerHTML = '<p class="text-slate-500 p-8 text-center"><i class="ri-inbox-line text-4xl"></i><br>Hàng chờ đang trống.</p>';
        return;
      }

      // 6. Ve bang "Hang Cho" voi cac app moi
      buildQueueTable(newAppIds);
      showAlert(message, false);
      appIdsListEl.value = ''; 

    } catch (err) {
      showAlert(err.message, true);
      updateButtonState(false);
      queuePlaceholder.innerHTML = `<p class="text-red-400 p-8 text-center"><i class="ri-error-warning-line text-4xl"></i><br>${err.message}</p>`;
    }
  }

  // Khong con ham switchToTab

  // Ham xu ly an/hien panel va "active" nut che do
  function setScrapeMode(mode) {
    currentScrapeMode = mode; // Cap nhat bien toan cuc

    if (mode === 'by_id') {
      panelById.classList.remove('hidden');
      panelByList.classList.add('hidden');
      btnModeById.classList.add('text-white', 'bg-emerald-500', 'shadow-md');
      btnModeById.classList.remove('text-slate-400', 'hover:bg-slate-800/50', 'hover:text-white');
      btnModeByList.classList.remove('text-white', 'bg-emerald-500', 'shadow-md');
      btnModeByList.classList.add('text-slate-400', 'hover:bg-slate-800/50', 'hover:text-white');
    } else { // mode === 'by_list'
      panelById.classList.add('hidden');
      panelByList.classList.remove('hidden');
      btnModeByList.classList.add('text-white', 'bg-emerald-500', 'shadow-md');
      btnModeByList.classList.remove('text-slate-400', 'hover:bg-slate-800/50', 'hover:text-white');
      btnModeById.classList.remove('text-white', 'bg-emerald-500', 'shadow-md');
      btnModeById.classList.add('text-slate-400', 'hover:bg-slate-800/50', 'hover:text-white');
    }
  }

  // --- 4. Lang nghe cac "Tin Nhan" tu Server ---
  
  socket.on('job:info', (message) => { 
    showAlert(message, false);
  });
  socket.on('app:running', (data) => { 
    const row = queueTableBody.querySelector(`tr[data-app-id="${data.appId}"]`);
    if (row) {
      row.classList.remove('opacity-50'); row.classList.add('bg-slate-800');
      row.cells[2].innerHTML = `<span class="inline-flex items-center rounded-md bg-blue-700/80 px-2 py-1 text-xs font-medium text-blue-200"><i class="ri-refresh-line animate-spin mr-1.5"></i>Đang xử lý...</span>`;
    }
  });

  // +++ app:success GIO CHI XOA ROW KHOI HANG CHO +++
  socket.on('app:success', (data) => {
    const rowInQueue = queueTableBody.querySelector(`tr[data-app-id="${data.app.appId}"]`);
    if (rowInQueue) { rowInQueue.remove(); }
    updateTabCounts(); // Cap nhat lai so luong "Hang cho"
    // Khong lam gi voi bang "Da luu" nua
  });

  socket.on('app:failed', (data) => { 
    const row = queueTableBody.querySelector(`tr[data-app-id="${data.appId}"]`);
    if (row) {
      row.classList.remove('opacity-50'); row.classList.add('bg-red-900/30');
      row.cells[0].innerHTML = `<div class="flex items-center"><div class="h-10 w-10 flex-shrink-0 flex items-center justify-center bg-red-900/50 rounded-lg text-red-300"><i class="ri-error-warning-line text-xl"></i></div><div class="ml-4"><div class="font-medium text-white">${data.appId}</div><div class="text-red-400 text-xs truncate" title="${data.error}">Lỗi: ${data.error}</div></div></div>`;
      row.cells[1].innerHTML = `<span class="inline-flex items-center rounded-md bg-slate-700/80 px-2 py-1 text-xs font-medium text-slate-300">N/A</span>`;
      row.cells[2].innerHTML = `<span class="inline-flex items-center rounded-md bg-red-800/80 px-2 py-1 text-xs font-medium text-red-200"><i class="ri-close-line mr-1.5"></i>Thất bại</span>`;
    }
  });
  
  socket.on('job:done', (results) => { 
    showAlert(`Job hoàn tất! Thành công: ${results.success}, Thất bại: ${results.failed}`, false);
    updateButtonState(false);
    updateTabCounts();
    queuePlaceholder.innerHTML = '<p class="text-slate-500 p-8 text-center"><i class="ri-inbox-line text-4xl"></i><br>Hàng chờ đang trống.</p>';
    if (queueTableBody.rows.length === 0) {
      queuePlaceholder.classList.remove('hidden');
    }
  });
  socket.on('job:error', (message) => { 
    showAlert(message, true);
    updateButtonState(false);
  });
  socket.on('connect', () => { checkJobStatus(); });

  // --- 5. Gan su kien va chay ---
  scrapeBtn.addEventListener('click', handleStartScrape);
  // Khong con listener cho tabSaved
  
  // Gan su kien cho nut chon che do
  btnModeById.addEventListener('click', (e) => {
    e.preventDefault();
    setScrapeMode('by_id');
  });
  btnModeByList.addEventListener('click', (e) => {
    e.preventDefault();
    setScrapeMode('by_list');
  });

  // +++ CHAY LAN DAU +++
  updateTabCounts(); // Chi update queue count
  checkJobStatus(); 
  setScrapeMode('by_id'); // Dat che do mac dinh la 'by_id'
});
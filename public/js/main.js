document.addEventListener('DOMContentLoaded', () => {

  // --- 1. Khoi tao Socket.IO Client ---
  const socket = io();
  console.log("Da ket noi Socket.IO voi server.");

  // --- 2. Lay cac "linh kien" UI ---
  const scrapeBtn = document.getElementById('startScrapeBtn');
  const btnSpinner = document.getElementById('loading-spinner');
  const btnText = document.getElementById('btn-text');
  
  const appIdsListEl = document.getElementById('appIdsList');
  const concurrencyEl = document.getElementById('concurrency');
  const delayEl = document.getElementById('delay');
  
  const alertContainer = document.getElementById('alert-container');
  const logTerminal = document.getElementById('log-terminal'); // +++ Lay cai terminal

  if (!scrapeBtn || !logTerminal) {
    console.warn("Thieu nut bam hoac khung log terminal!");
    return;
  }

  // --- 3. Dinh nghia cac ham "chuc nang" ---

  // (Ham showAlert van giu nguyen nhu cu)
  function showAlert(message, isError = false) {
    alertContainer.innerHTML = '';
    if (!message) return;
    const alertType = isError
      ? { bg: 'bg-red-800', border: 'border-red-600', text: 'text-red-200', title: 'Toang!' }
      : { bg: 'bg-green-800', border: 'border-green-600', text: 'text-green-200', title: 'Ngon!' };
    const alertHTML = `
      <div class="${alertType.bg} ${alertType.border} ${alertType.text} px-4 py-3 rounded-lg relative" role="alert">
        <strong class="font-bold">${alertType.title}</strong>
        <span class="block sm:inline">${message}</span>
      </div>`;
    alertContainer.innerHTML = alertHTML;
  }

  // (Ham updateButtonState van giu nguyen nhu cu)
  function updateButtonState(isRunning) {
    if (isRunning) {
      scrapeBtn.disabled = true;
      btnText.textContent = 'Job đang chạy...';
      btnSpinner.classList.remove('hidden');
    } else {
      scrapeBtn.disabled = false;
      btnText.textContent = 'Bắt đầu lấy dữ liệu';
      btnSpinner.classList.add('hidden');
    }
  }

  // (Ham checkJobStatus van giu nguyen nhu cu)
  async function checkJobStatus() {
    try {
      const response = await fetch('/api/scrape/status');
      const data = await response.json();
      updateButtonState(data.isJobRunning);
      if (data.isJobRunning) {
         // Neu mo lai trang ma job van chay, thi xoa log cu di
         logTerminal.innerHTML = '<p class="text-yellow-400">Phat hien job van dang chay. Dang tai lai log...</p>';
      }
    } catch (err) {
      updateButtonState(false);
    }
  }

  /**
   * +++ Ham "In Log" ra Terminal (NEW) +++
   * @param {string} message Noi dung log
   * @param {string} type Loai log (de to mau)
   */
  function appendLog(message, type = 'message') {
    const p = document.createElement('p');
    p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;

    // To mau cho "chuyen nghiep"
    switch (type) {
      case 'success':
        p.className = 'text-green-400';
        break;
      case 'error':
        p.className = 'text-red-400';
        break;
      case 'info':
        p.className = 'text-blue-400';
        break;
      default:
        p.className = 'text-gray-300';
    }

    logTerminal.appendChild(p);
    
    // Tu dong cuon xuong duoi cung
    logTerminal.scrollTop = logTerminal.scrollHeight;
  }
  
  /**
   * Ham xu ly khi Bro bam nut "Bat Dau" (Cap nhat)
   */
  async function handleStartScrape() {
    showAlert(null); // Xoa thong bao cu
    logTerminal.innerHTML = ''; // +++ Xoa sach log cu
    appendLog('Dang gui lenh den server...', 'info'); // +++ Log dau tien
    
    updateButtonState(true);

    const data = {
      appIdsList: appIdsListEl.value,
      concurrency: concurrencyEl.value,
      delay: delayEl.value
    };

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Lỗi không xác định');
      }

      // Thanh cong! (Hien thong bao xanh)
      showAlert(result.message, false);
      // Khong can mo khoa nut o day, socket se tu mo khi job xong
      appendLog('Server da chap nhan job. Bat dau chay...', 'success');

    } catch (err) {
      // That bai! (Hien thong bao do)
      showAlert(err.message, true);
      appendLog(`Loi khi bat dau job: ${err.message}`, 'error');
      updateButtonState(false); // Mo khoa nut neu job bi tu choi
    }
  }

  // --- 4. Lang nghe cac "Tin Nhan" tu Server (NEW) ---
  socket.on('log:message', (msg) => appendLog(msg, 'message'));
  socket.on('log:info', (msg) => appendLog(msg, 'info'));
  socket.on('log:success', (msg) => appendLog(msg, 'success'));
  socket.on('log:error', (msg) => appendLog(msg, 'error'));

  // Khi server bao job da xong
  socket.on('job:done', () => {
    appendLog('✅✅✅ JOB HOAN TAT! ✅✅✅', 'success');
    updateButtonState(false); // Mo khoa nut
  });
  
  // Khi server vua ket noi
  socket.on('connect', () => {
    checkJobStatus(); // Kiem tra lai status job
  });

  // --- 5. Gan su kien va chay ---
  scrapeBtn.addEventListener('click', handleStartScrape);
  checkJobStatus(); // Kiem tra status job ngay khi tai trang
  
  // Bo cai interval di, vi socket se bao job:done, khong can hoi moi 5s nua
  // setInterval(checkJobStatus, 5000); // <-- XOA DONG NAY
});
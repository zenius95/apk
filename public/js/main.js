document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- DOM ELEMENTS ---
    const scrapeBtn = document.getElementById('startScrapeBtn');
    if (!scrapeBtn) return;

    const stopBtn = document.getElementById('btn-stop-job');
    const terminalBody = document.getElementById('terminal-body');
    
    // Stats
    const statTotal = document.getElementById('stat-total');
    const statSuccess = document.getElementById('stat-success');
    const statFailed = document.getElementById('stat-failed');

    // Inputs (giu nguyen nhu cu)
    const concurrencyEl = document.getElementById('concurrency');
    const delayEl = document.getElementById('delay');
    // +++ MOI: Lay element Lang & Country +++
    const langEl = document.getElementById('scrape-lang');
    const countryEl = document.getElementById('scrape-country');

    const btnModeById = document.getElementById('btn-mode-by-id');
    const btnModeByList = document.getElementById('btn-mode-by-list');
    const panelById = document.getElementById('panel-by-id');
    const panelByList = document.getElementById('panel-by-list');
    const appIdsListEl = document.getElementById('appIdsList');
    const listCategoryEl = document.getElementById('list-category');
    const listCollectionEl = document.getElementById('list-collection');
    const listNumEl = document.getElementById('list-num');
    const alertContainer = document.getElementById('alert-container');

    let currentScrapeMode = 'by_id';

    // --- FUNCTIONS ---

    // Ham in log ra man hinh
    function appendLog(log) {
        // Xoa dong "Waiting..." neu co
        if (terminalBody.querySelector('.italic')) {
            terminalBody.innerHTML = '';
        }

        // 1. Kiem tra vi tri cuon TRUOC khi them phan tu moi
        // scrollHeight - scrollTop === clientHeight la dang o duoi cung.
        // Tru them 50px sai so cho chac an (lo Bro cuon gan toi noi).
        const isAtBottom = (terminalBody.scrollHeight - terminalBody.scrollTop - terminalBody.clientHeight) <= 50;

        const div = document.createElement('div');
        div.className = 'flex items-start space-x-2 border-b border-white/5 pb-0.5';
        
        // Mau sac dua theo Type (Giu nguyen nhu cu)
        let typeClass = 'text-slate-500';
        let msgClass = 'text-slate-300';

        if (log.type === 'INFO') { typeClass = 'text-blue-400'; msgClass = 'text-white font-bold'; }
        if (log.type === 'WARN') { typeClass = 'text-yellow-500'; msgClass = 'text-yellow-200'; }
        if (log.type === 'ERR' || log.type === 'mW_ERR') { typeClass = 'text-red-500'; msgClass = 'text-red-300'; }
        if (log.type === 'mW_OK') { typeClass = 'text-emerald-500'; msgClass = 'text-emerald-200'; }

        div.innerHTML = `
            <span class="text-slate-600 text-[10px] min-w-[60px]">${log.time}</span>
            <span class="${typeClass} font-bold text-[10px] min-w-[40px]">[${log.type}]</span>
            <span class="${msgClass} break-all">${log.message}</span>
        `;
        
        terminalBody.appendChild(div);
        
        // 2. Chi tu dong cuon neu Bro DANG O DUOI CUNG
        if (isAtBottom) {
            terminalBody.scrollTop = terminalBody.scrollHeight;
        }
    }

    // Cap nhat thong ke
    function updateStats(stats) {
        if(!stats) return;
        statTotal.textContent = stats.total || 0;
        statSuccess.textContent = stats.success || 0;
        statFailed.textContent = stats.failed || 0;
    }

    // Cap nhat UI trang thai
    function setRunningState(isRunning) {
        scrapeBtn.disabled = isRunning;
        scrapeBtn.classList.toggle('opacity-50', isRunning);
        scrapeBtn.innerHTML = isRunning 
            ? '<i class="ri-loader-4-line animate-spin text-2xl mr-2"></i> Job đang chạy...' 
            : '<i class="ri-play-fill text-2xl mr-2"></i> Bắt đầu lấy dữ liệu';
        
        // Hien/An nut Stop
        stopBtn.classList.toggle('hidden', !isRunning);
    }

    // --- API CALLS ---

    // Check status khi load trang
    async function checkStatus() {
        try {
            const res = await fetch('/api/scrape/status');
            const data = await res.json();
            
            setRunningState(data.isRunning);
            updateStats(data.stats);

            // LOAD LAI LOG CU
            if (data.logs && data.logs.length > 0) {
                terminalBody.innerHTML = ''; // Clear mac dinh
                data.logs.forEach(log => appendLog(log));
            }
        } catch (e) {
            console.error("Loi check status:", e);
        }
    }

    // Xu ly Start Job
    async function handleStart() {
        const concurrency = concurrencyEl.value;
        const delay = delayEl.value;
        // +++ UPDATE: Lay gia tri Lang & Country +++
        const lang = langEl ? langEl.value : 'en';
        const country = countryEl ? countryEl.value : 'us';

        let payload = { concurrency, delay, scrapeMode: currentScrapeMode, lang, country };

        if (currentScrapeMode === 'by_id') {
            payload.appIdsList = appIdsListEl.value;
            if (!payload.appIdsList) return alert('Nhập ID đi Bro');
        } else {
            payload.category = listCategoryEl.value;
            payload.collection = listCollectionEl.value;
            payload.num = listNumEl.value;
        }

        setRunningState(true);
        terminalBody.innerHTML = ''; // Clear terminal
        appendLog({ time: '...', type: 'INFO', message: `Đang gửi yêu cầu (Lang: ${lang}, Country: ${country})...` });

        try {
            const res = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            
            if (!res.ok) {
                appendLog({ time: '...', type: 'ERR', message: result.message });
                setRunningState(false);
            } else {
                // Job da bat dau, doi socket ban ve thoi
            }
        } catch (err) {
            setRunningState(false);
            appendLog({ time: '...', type: 'ERR', message: err.message });
        }
    }

    // Xu ly Stop Job
    async function handleStop() {
        if (!confirm('Bro chắc chắn muốn dừng chứ?')) return;
        
        stopBtn.disabled = true;
        stopBtn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i> Đang dừng...';
        
        try {
            await fetch('/api/scrape/stop', { method: 'POST' });
        } catch (e) {
            console.error(e);
        }
    }

    // --- SOCKET LISTENERS ---
    socket.on('job:log', (log) => {
        appendLog(log);
    });

    socket.on('job:update_stats', (stats) => {
        updateStats(stats);
    });

    socket.on('job:done', (stats) => {
        setRunningState(false);
        updateStats(stats);
        stopBtn.disabled = false;
        stopBtn.innerHTML = '<i class="ri-stop-circle-line mr-1"></i> DỪNG LẠI';
        alert('Job đã xong nha Bro!');
    });

    // --- EVENT BINDING ---
    scrapeBtn.addEventListener('click', handleStart);
    stopBtn.addEventListener('click', handleStop);
    
    // Tab switching logic (giu nguyen)
    btnModeById.addEventListener('click', () => {
        currentScrapeMode = 'by_id';
        panelById.classList.remove('hidden');
        panelByList.classList.add('hidden');
        // Toggle styles...
        btnModeById.classList.add('bg-emerald-500', 'text-white');
        btnModeById.classList.remove('text-slate-400');
        btnModeByList.classList.remove('bg-emerald-500', 'text-white');
        btnModeByList.classList.add('text-slate-400');
    });

    btnModeByList.addEventListener('click', () => {
        currentScrapeMode = 'by_list';
        panelById.classList.add('hidden');
        panelByList.classList.remove('hidden');
        // Toggle styles...
        btnModeByList.classList.add('bg-emerald-500', 'text-white');
        btnModeByList.classList.remove('text-slate-400');
        btnModeById.classList.remove('bg-emerald-500', 'text-white');
        btnModeById.classList.add('text-slate-400');
    });

    // INIT
    checkStatus();
});
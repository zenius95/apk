document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- DOM ELEMENTS ---
    const scrapeBtn = document.getElementById('startScrapeBtn');
    const stopBtn = document.getElementById('btn-stop-job');
    const terminalBody = document.getElementById('terminal-body');
    
    // Stats
    const statTotal = document.getElementById('stat-total');
    const statSuccess = document.getElementById('stat-success');
    const statFailed = document.getElementById('stat-failed');

    // Inputs
    const concurrencyEl = document.getElementById('concurrency');
    const delayEl = document.getElementById('delay');
    const langEl = document.getElementById('scrape-lang');
    const countryEl = document.getElementById('scrape-country');

    // Mode Buttons & Panels
    const btnModeById = document.getElementById('btn-mode-by-id');
    const btnModeByList = document.getElementById('btn-mode-by-list');
    const panelById = document.getElementById('panel-by-id');
    const panelByList = document.getElementById('panel-by-list');
    
    // Input Fields
    const appIdsListEl = document.getElementById('appIdsList');
    const listCategoryEl = document.getElementById('list-category');
    const listCollectionEl = document.getElementById('list-collection');
    const listNumEl = document.getElementById('list-num');
    
    let currentScrapeMode = 'by_id';
    
    // !!! QUAN TRỌNG: Cờ chặn lưu khi đang load !!!
    let isLoadingSettings = false;

    // --- FUNCTIONS ---

    function appendLog(log) {
        if (!terminalBody) return;
        if (terminalBody.querySelector('.italic')) terminalBody.innerHTML = '';

        const isAtBottom = (terminalBody.scrollHeight - terminalBody.scrollTop - terminalBody.clientHeight) <= 50;

        const div = document.createElement('div');
        div.className = 'flex items-start space-x-2 border-b border-white/5 pb-0.5';
        
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
        if (isAtBottom) terminalBody.scrollTop = terminalBody.scrollHeight;
    }

    function updateStats(stats) {
        if(!stats) return;
        if(statTotal) statTotal.textContent = stats.total || 0;
        if(statSuccess) statSuccess.textContent = stats.success || 0;
        if(statFailed) statFailed.textContent = stats.failed || 0;
    }

    function setRunningState(isRunning) {
        if(!scrapeBtn) return;
        scrapeBtn.disabled = isRunning;
        scrapeBtn.classList.toggle('opacity-50', isRunning);
        scrapeBtn.innerHTML = isRunning 
            ? '<i class="ri-loader-4-line animate-spin text-2xl mr-2"></i> Job đang chạy...' 
            : '<i class="ri-play-fill text-2xl mr-2"></i> Bắt đầu lấy dữ liệu';
        
        if(stopBtn) stopBtn.classList.toggle('hidden', !isRunning);
    }

    // ==========================================
    // +++ FIX LỖI: LƯU/TẢI CÀI ĐẶT +++
    // ==========================================

    function saveScrapeSettings() {
        // Nếu đang trong quá trình load thì KHÔNG được lưu (tránh ghi đè giá trị rỗng)
        if (isLoadingSettings) return;

        console.log("💾 Đang lưu settings...");
        
        if(langEl) localStorage.setItem('scrape_lang', langEl.value);
        if(countryEl) localStorage.setItem('scrape_country', countryEl.value);
        if(concurrencyEl) localStorage.setItem('scrape_concurrency', concurrencyEl.value);
        if(delayEl) localStorage.setItem('scrape_delay', delayEl.value);
        
        localStorage.setItem('scrape_mode', currentScrapeMode);
        
        if(appIdsListEl) localStorage.setItem('scrape_appIdsList', appIdsListEl.value);
        if(listCategoryEl) localStorage.setItem('scrape_category', listCategoryEl.value);
        if(listCollectionEl) localStorage.setItem('scrape_collection', listCollectionEl.value);
        if(listNumEl) localStorage.setItem('scrape_num', listNumEl.value);
    }

    function loadScrapeSettings() {
        // Bật cờ load lên
        isLoadingSettings = true;
        console.log("📥 Đang tải settings...");

        try {
            // 1. Load các ô Input trước
            if(langEl && localStorage.getItem('scrape_lang')) langEl.value = localStorage.getItem('scrape_lang');
            if(countryEl && localStorage.getItem('scrape_country')) countryEl.value = localStorage.getItem('scrape_country');
            if(concurrencyEl && localStorage.getItem('scrape_concurrency')) concurrencyEl.value = localStorage.getItem('scrape_concurrency');
            if(delayEl && localStorage.getItem('scrape_delay')) delayEl.value = localStorage.getItem('scrape_delay');

            if(appIdsListEl && localStorage.getItem('scrape_appIdsList')) appIdsListEl.value = localStorage.getItem('scrape_appIdsList');
            if(listCategoryEl && localStorage.getItem('scrape_category')) listCategoryEl.value = localStorage.getItem('scrape_category');
            if(listCollectionEl && localStorage.getItem('scrape_collection')) listCollectionEl.value = localStorage.getItem('scrape_collection');
            if(listNumEl && localStorage.getItem('scrape_num')) listNumEl.value = localStorage.getItem('scrape_num');

            // 2. Load Mode (Sau khi đã điền input xong)
            const savedMode = localStorage.getItem('scrape_mode');
            if (btnModeByList && btnModeById) {
                if (savedMode === 'by_list') {
                    btnModeByList.click(); // Gọi click để chuyển UI
                } else {
                    btnModeById.click();
                }
            }
        } catch (e) {
            console.error("Lỗi khi load settings:", e);
        } finally {
            // Tắt cờ load -> Cho phép lưu từ bây giờ
            isLoadingSettings = false;
        }
    }

    // --- API CALLS ---

    async function checkStatus() {
        try {
            const res = await fetch('/api/scrape/status');
            const data = await res.json();
            
            setRunningState(data.isRunning);
            updateStats(data.stats);

            if (data.logs && data.logs.length > 0 && terminalBody) {
                terminalBody.innerHTML = '';
                data.logs.forEach(log => appendLog(log));
            }
        } catch (e) { console.error(e); }
    }

    async function handleStart() {
        // Lưu lần cuối cho chắc
        saveScrapeSettings();

        const concurrency = concurrencyEl ? concurrencyEl.value : 5;
        const delay = delayEl ? delayEl.value : 1000;
        const lang = langEl ? langEl.value : 'en';
        const country = countryEl ? countryEl.value : 'us';

        let payload = { concurrency, delay, scrapeMode: currentScrapeMode, lang, country };

        if (currentScrapeMode === 'by_id') {
            payload.appIdsList = appIdsListEl ? appIdsListEl.value : '';
            if (!payload.appIdsList) return alert('Nhập ID đi Bro');
        } else {
            payload.category = listCategoryEl ? listCategoryEl.value : '';
            payload.collection = listCollectionEl ? listCollectionEl.value : '';
            payload.num = listNumEl ? listNumEl.value : 50;
        }

        setRunningState(true);
        if(terminalBody) terminalBody.innerHTML = ''; 
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
            }
        } catch (err) {
            setRunningState(false);
            appendLog({ time: '...', type: 'ERR', message: err.message });
        }
    }

    async function handleStop() {
        if (!confirm('Bro chắc chắn muốn dừng chứ?')) return;
        if(stopBtn) {
            stopBtn.disabled = true;
            stopBtn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i> Đang dừng...';
        }
        try { await fetch('/api/scrape/stop', { method: 'POST' }); } catch (e) {}
    }

    // --- SOCKET ---
    if(socket) {
        socket.on('job:log', (log) => appendLog(log));
        socket.on('job:update_stats', (stats) => updateStats(stats));
        socket.on('job:done', (stats) => {
            setRunningState(false);
            updateStats(stats);
            if(stopBtn) {
                stopBtn.disabled = false;
                stopBtn.innerHTML = '<i class="ri-stop-circle-line mr-1"></i> DỪNG LẠI';
            }
            alert('Job đã xong nha Bro!');
        });
    }

    // --- EVENTS ---
    if(scrapeBtn) scrapeBtn.addEventListener('click', handleStart);
    if(stopBtn) stopBtn.addEventListener('click', handleStop);
    
    // Tab switching
    if(btnModeById && btnModeByList && panelById && panelByList) {
        btnModeById.addEventListener('click', () => {
            currentScrapeMode = 'by_id';
            panelById.classList.remove('hidden');
            panelByList.classList.add('hidden');
            
            btnModeById.classList.add('bg-emerald-500', 'text-white');
            btnModeById.classList.remove('text-slate-400');
            btnModeByList.classList.remove('bg-emerald-500', 'text-white');
            btnModeByList.classList.add('text-slate-400');

            saveScrapeSettings(); 
        });

        btnModeByList.addEventListener('click', () => {
            currentScrapeMode = 'by_list';
            panelById.classList.add('hidden');
            panelByList.classList.remove('hidden');
            
            btnModeByList.classList.add('bg-emerald-500', 'text-white');
            btnModeByList.classList.remove('text-slate-400');
            btnModeById.classList.remove('bg-emerald-500', 'text-white');
            btnModeById.classList.add('text-slate-400');

            saveScrapeSettings(); 
        });
    }

    // Auto Save Events
    const allInputs = [
        langEl, countryEl, concurrencyEl, delayEl, 
        appIdsListEl, listCategoryEl, listCollectionEl, listNumEl
    ];
    allInputs.forEach(el => {
        if(el) {
            el.addEventListener('change', saveScrapeSettings);
            el.addEventListener('input', saveScrapeSettings); 
        }
    });

    // --- INIT ---
    // Gọi loadSettings NGAY, và dùng cờ isLoadingSettings để bảo vệ
    loadScrapeSettings();
    checkStatus();
});
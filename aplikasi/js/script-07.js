(function () {
    'use strict';

    const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

    function parseExcelNumber(value) {
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        const text = String(value == null ? '' : value).trim().replace(/rp/ig, '').replace(/\s/g, '');
        if (!text) return 0;
        const normalized = text.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
        const number = parseFloat(normalized);
        return Number.isFinite(number) ? number : 0;
    }

    function rowValue(row, names) {
        const keys = Object.keys(row);
        const normalize = value => String(value == null ? '' : value).toLowerCase().replace(/[\s_\-\/\\().%]/g, '');
        for (const name of names) {
            const wanted = normalize(name);
            const key = keys.find(item => normalize(item) === wanted || normalize(item).includes(wanted));
            if (key !== undefined) return row[key];
        }
        return '';
    }

    function parseImportedDate(value) {
        const now = new Date();
        if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
        const text = String(value == null ? '' : value).trim();
        let match = text.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})$/i);
        if (match) {
            const month = monthNames.findIndex(item => item.toLowerCase().startsWith(match[2].toLowerCase()));
            return new Date(Number(match[3]), month >= 0 ? month : 0, Number(match[1]));
        }
        match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
        if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
        return now;
    }

    function buildHistoryRows(rows) {
        return rows.map((row, index) => {
            const date = parseImportedDate(rowValue(row, ['Tanggal', 'Date']));
            const income = parseExcelNumber(rowValue(row, ['Pendapatan']));
            const cashout = parseExcelNumber(rowValue(row, ['Pengeluaran']));
            const expense = parseExcelNumber(rowValue(row, ['Total Belanja', 'Belanja']));
            const profitPercentage = parseExcelNumber(rowValue(row, ['Profit 10%', 'Profit Persen']));
            const profit = Math.max((income - cashout) * (profitPercentage / 100), 0);
            return {
                id: Date.now() + index,
                day: dayNames[date.getDay()],
                date: date.getDate(),
                monthIndex: date.getMonth(),
                month: monthNames[date.getMonth()],
                year: date.getFullYear(),
                time: String(rowValue(row, ['Waktu', 'Time']) || '00:00'),
                income,
                expense,
                cashout,
                profitPercentage,
                profit
            };
        }).filter(item => item.income || item.expense || item.cashout || item.profitPercentage);
    }

    function loadXlsx() {
        if (window.XLSX) return Promise.resolve(window.XLSX);
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
            script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error('Library Excel tidak tersedia.'));
            script.onerror = () => reject(new Error('Library Excel tidak dapat dimuat.'));
            document.head.appendChild(script);
        });
    }

    function backupAllHistoryToExcel() {
        loadXlsx().then(XLSX => {
            const monthNamesSort = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
            const rows = (Array.isArray(historyData) ? [...historyData] : []).sort((a, b) => {
                const aMonth = Number.isFinite(Number(a.monthIndex)) ? Number(a.monthIndex) : monthNamesSort.indexOf(a.month);
                const bMonth = Number.isFinite(Number(b.monthIndex)) ? Number(b.monthIndex) : monthNamesSort.indexOf(b.month);
                const aKey = (Number(a.year)||0) * 12 + (aMonth >= 0 ? aMonth : 0);
                const bKey = (Number(b.year)||0) * 12 + (bMonth >= 0 ? bMonth : 0);
                if (bKey !== aKey) return bKey - aKey;
                const aDate = Number(a.date)||0;
                const bDate = Number(b.date)||0;
                if (bDate !== aDate) return bDate - aDate;
                const aTime = String(a.time||'00:00');
                const bTime = String(b.time||'00:00');
                if (bTime !== aTime) return bTime.localeCompare(aTime);
                return (Number(b.id)||0) - (Number(a.id)||0);
            }).map(item => {
                const income = Number(item.income) || 0;
                const expense = Number(item.expense) || 0;
                const cashout = Number(item.cashout) || 0;
                const profitPercentage = item.profitPercentage !== undefined ? (parseFloat(item.profitPercentage) || 0) : 10;
                const profit = Math.max((income - cashout) * (profitPercentage / 100), 0);

                return {
                    'ID': item.id || '',
                    'Hari': item.day || '',
                    'Tanggal': `${item.date} ${item.month} ${item.year}`,
                    'Waktu': item.time || '00:00',
                    'Pendapatan': income,
                    'Total Belanja': expense,
                    'Pengeluaran': cashout,
                    'Profit (%)': profitPercentage,
                    'Profit/Keuntungan': profit
                };
            });

            if (!rows.length) {
                showModal('Export Gagal', 'Belum ada data History untuk diekspor.', 'fa-solid fa-circle-exclamation text-rose-600');
                return;
            }

            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.json_to_sheet(rows);
            worksheet['!cols'] = [
                { wch: 18 }, { wch: 12 }, { wch: 24 }, { wch: 12 },
                { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 22 }
            ];
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Backup History');
            XLSX.writeFile(workbook, `Rekapin_History_${new Date().getFullYear()}.xlsx`);
            showModal('Backup Berhasil', `${rows.length} data History berhasil dibackup ke Microsoft Excel.`);
        }).catch(error => showModal('Export Gagal', error.message, 'fa-solid fa-circle-xmark text-rose-600'));
    }

    function importBackupExcel(file) {
        if (!file) return;
        loadXlsx().then(async XLSX => {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const sheetName = workbook.SheetNames.find(name => name === 'Backup History') || workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const imported = buildHistoryRows(XLSX.utils.sheet_to_json(sheet, { defval: '' }));
            if (!imported.length) throw new Error('Tidak ada data History yang valid pada file backup Excel.');
            historyData = [...imported, ...(Array.isArray(historyData) ? historyData : [])];
            if (currentSessionUser && currentSessionUser.phone) {
                localStorage.setItem(`finance_history_desktop_${currentSessionUser.phone}`, JSON.stringify(historyData));
                if (typeof triggerDailyAutoBackup === 'function') triggerDailyAutoBackup();
            }
            populateHistoryFilters();
            renderHistory();
            renderReport();
            switchTab('history');
            showModal('Import Berhasil', `${imported.length} data backup berhasil ditambahkan ke History.`);
        }).catch(error => showModal('Import Gagal', error.message, 'fa-solid fa-circle-xmark text-rose-600'));
    }

    function bindHistoryIo() {
        bindHistoryFilter();
        const importButton = document.getElementById('history-io-import');
        const fileInput = document.getElementById('history-io-file');
        const exportButton = document.getElementById('history-io-export');
        if (importButton && fileInput && !importButton.dataset.finalHistoryIo) {
            const replacement = importButton.cloneNode(true);
            replacement.dataset.finalHistoryIo = '1';
            importButton.replaceWith(replacement);
            replacement.addEventListener('click', () => fileInput.click());
            fileInput.onchange = () => {
                importBackupExcel(fileInput.files && fileInput.files[0]);
                fileInput.value = '';
            };
        }
        if (exportButton && !exportButton.dataset.finalHistoryIo) {
            const replacement = exportButton.cloneNode(true);
            replacement.dataset.finalHistoryIo = '1';
            replacement.__bound = true;
            exportButton.replaceWith(replacement);
            replacement.addEventListener('click', backupAllHistoryToExcel);
        }
    }

    function updateKasbonFilter() {
        const wrap = document.getElementById('rekapinyu-kasbon-filter-wrap');
        const view = document.getElementById('view-kasbon');
        if (wrap && view) wrap.style.display = view.classList.contains('hidden') ? 'none' : 'flex';
    }

    function updateHistoryIo() {
        const panel = document.getElementById('history-io-floating');
        const view = document.getElementById('view-history');
        if (!panel || !view) return;
        const visible = !view.classList.contains('hidden');
        panel.classList.toggle('history-io-visible', visible);
        panel.classList.toggle('history-io-hidden', !visible);
        if (!visible) closeHistoryFilter();
    }

    function closeHistoryFilter() {
        const popup = document.getElementById('history-filter-popup');
        const button = document.getElementById('history-filter-button');
        if (!popup) return;
        popup.classList.remove('is-open');
        popup.setAttribute('aria-hidden','true');
        if (button) button.setAttribute('aria-expanded','false');
    }

    function bindHistoryFilter() {
        const button = document.getElementById('history-filter-button');
        const popup = document.getElementById('history-filter-popup');
        const close = document.getElementById('history-filter-close');
        const reset = document.getElementById('history-filter-reset');
        if (!button || !popup || button.dataset.bound) return;
        button.dataset.bound = '1';
        button.setAttribute('aria-expanded','false');

        button.addEventListener('click', event => {
            event.stopPropagation();
            const open = !popup.classList.contains('is-open');
            popup.classList.toggle('is-open', open);
            popup.setAttribute('aria-hidden', open ? 'false' : 'true');
            button.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        close?.addEventListener('click', closeHistoryFilter);
        reset?.addEventListener('click', () => {
            ['history-filter-search','history-filter-date','history-filter-month','history-filter-year'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            renderHistory();
        });
        popup.addEventListener('click', event => event.stopPropagation());
        document.addEventListener('click', event => {
            if (!event.target.closest('#history-filter-popup') && !event.target.closest('#history-filter-button')) {
                closeHistoryFilter();
            }
        });
    }

    function bindKasbonFilter() {
        const button = document.getElementById('rekapinyu-kasbon-filter-button');
        const menu = document.getElementById('rekapinyu-kasbon-filter-menu');
        if (!button || !menu || button.dataset.bound) return;
        button.dataset.bound = '1';
        button.addEventListener('click', event => { event.stopPropagation(); menu.classList.toggle('hidden'); });
        menu.addEventListener('click', event => {
            const option = event.target.closest('[data-kasbon-filter]');
            if (!option) return;
            const select = document.getElementById('filter-kasbon-status');
            if (select) { select.value = option.dataset.kasbonFilter; renderKasbonGrid(); }
            menu.classList.add('hidden');
        });
        document.addEventListener('click', event => {
            if (!event.target.closest('#rekapinyu-kasbon-filter-wrap')) menu.classList.add('hidden');
        });
    }

    function initFinalFilterIO() {
        bindHistoryIo();
        bindKasbonFilter();
        updateKasbonFilter();
        updateHistoryIo();
    }

    const originalSwitchTab = window.switchTab;
    if (typeof originalSwitchTab === 'function' && !originalSwitchTab.__finalFilterIoWrapped) {
        window.switchTab = function (tab) {
            const result = originalSwitchTab.apply(this, arguments);
            setTimeout(updateKasbonFilter, 0);
            setTimeout(updateHistoryIo, 0);
            return result;
        };
        window.switchTab.__finalFilterIoWrapped = true;
    }
    initFinalFilterIO();
    setInterval(init, 700);
})();

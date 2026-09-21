/* PATCH TAMBAHAN: Pengaturan kartu Backup Otomatis.
   Tidak mengubah fungsi asli; hanya menambahkan UI dan wrapper setelah fungsi asli. */
(function () {
  const originalBackupRender = window.renderBackupGrid;
  const originalDailyBackup = window.triggerDailyAutoBackup;

  function backupStorageKey() {
    return (typeof currentSessionUser !== 'undefined' && currentSessionUser && currentSessionUser.phone)
      ? `finance_backup_desktop_${currentSessionUser.phone}` : null;
  }
  function persistBackupData() {
    const key = backupStorageKey();
    if (key) { localStorage.setItem(key, JSON.stringify(backupOtomatisData)); window.__markDataPending?.('backup',backupOtomatisData); window.__requestDataCloudSync?.(); }
  }
  function closeBackupSettings() {
    document.querySelectorAll('.backup-settings-popup').forEach(m => m.classList.add('hidden'));
  }

  /* Pertahankan perubahan manual ketika backup otomatis berikutnya berjalan. */
  window.triggerDailyAutoBackup = function () {
    const oldValues = new Map((backupOtomatisData || []).map(b => [String(b.id), {
      customName: b.customName,
      manualDate: b.manualDate,
      manualDay: b.manualDay,
      manualDateNumber: b.manualDateNumber,
      manualMonthIndex: b.manualMonthIndex,
      manualMonth: b.manualMonth,
      manualYear: b.manualYear
    }]));
    const result = originalDailyBackup ? originalDailyBackup.apply(this, arguments) : undefined;

    const restoreManual = function () {
      (backupOtomatisData || []).forEach(b => {
        const old = oldValues.get(String(b.id));
        if (!old) return;
        if (old.customName !== undefined) b.customName = old.customName;
        if (old.manualDate) {
          b.manualDate = true;
          b.manualDay = old.manualDay;
          b.manualDateNumber = old.manualDateNumber;
          b.manualMonthIndex = old.manualMonthIndex;
          b.manualMonth = old.manualMonth;
          b.manualYear = old.manualYear;
          b.day = old.manualDay;
          b.date = old.manualDateNumber;
          b.monthIndex = old.manualMonthIndex;
          b.month = old.manualMonth;
          b.year = old.manualYear;
          b.dateKey = `${b.date}-${b.monthIndex}-${b.year}`;
        }
        if (b.customName) b.historyName = b.customName;
      });
      persistBackupData();
    };
    if (result && typeof result.then === 'function') return result.then(restoreManual);
    restoreManual();
    return result;
  };

  window.toggleBackupSettings = function (event, backupId) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const id = String(backupId);
    document.querySelectorAll('.backup-settings-popup').forEach(menu => {
      if (menu.dataset.backupId !== id) menu.classList.add('hidden');
    });
    const menu = document.querySelector(`.backup-settings-popup[data-backup-id="${CSS.escape(id)}"]`);
    if (menu) menu.classList.toggle('hidden');
  };

  /* EDIT: memakai modal edit History yang asli, bukan prompt. */
  window.editBackupDate = function (event, backupId) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    closeBackupSettings();

    const backup = backupOtomatisData.find(b => String(b.id) === String(backupId));
    if (!backup) return;

    const modal = document.getElementById('edit-modal');
    const modalTitle = document.getElementById('edit-modal-title');
    const modalBody = document.getElementById('edit-modal-body');
    const saveBtn = document.getElementById('save-edit-btn');
    if (!modal || !modalTitle || !modalBody || !saveBtn) return;

    const daysOptions = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const monthsOptions = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

    /* SAMA dengan struktur popup Edit Waktu & Tanggal pada History. */
    modalTitle.innerText = `Edit Waktu & Tanggal Backup (ID: ${String(backup.id).slice(-4)})`;
    modalBody.innerHTML = `
      <div>
        <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Hari</label>
        <select id="backup-edit-val-day" class="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold">
          ${daysOptions.map(d => `<option value="${d}" ${d === backup.day ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
      </div>
      <div class="grid grid-cols-3 gap-2">
        <div>
          <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Tanggal</label>
          <input type="number" id="backup-edit-val-date" min="1" max="31" value="${Number(backup.date) || 1}" class="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold">
        </div>
        <div>
          <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Bulan</label>
          <select id="backup-edit-val-month" class="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold">
            ${monthsOptions.map((m, idx) => `<option value="${m}" data-index="${idx}" ${m === backup.month ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Tahun</label>
          <input type="number" id="backup-edit-val-year" value="${Number(backup.year) || new Date().getFullYear()}" class="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold">
        </div>
      </div>
    `;

    saveBtn.onclick = function () {
      const day = document.getElementById('backup-edit-val-day').value;
      const date = parseInt(document.getElementById('backup-edit-val-date').value, 10);
      const monthSelect = document.getElementById('backup-edit-val-month');
      const month = monthSelect.value;
      const monthIndex = parseInt(monthSelect.options[monthSelect.selectedIndex].getAttribute('data-index'), 10);
      const year = parseInt(document.getElementById('backup-edit-val-year').value, 10);

      if (!day || !Number.isInteger(date) || date < 1 || date > 31 ||
          !month || !Number.isInteger(monthIndex) || !Number.isInteger(year) || year < 1900 || year > 9999) {
        showModal("Gagal", "Tanggal dan waktu backup tidak valid.", "fa-solid fa-circle-exclamation text-rose-600");
        return;
      }

      backup.manualDate = true;
      backup.manualDay = day;
      backup.manualDateNumber = date;
      backup.manualMonthIndex = monthIndex;
      backup.manualMonth = month;
      backup.manualYear = year;

      backup.day = day;
      backup.date = date;
      backup.monthIndex = monthIndex;
      backup.month = month;
      backup.year = year;
      backup.dateKey = `${date}-${monthIndex}-${year}`;
      if (!backup.customName) backup.historyName = `${day}, ${date} ${month} ${year}`;

      persistBackupData();
      closeEditModal();
      renderBackupGrid();
      showModal("Berhasil", "Tanggal dan waktu backup berhasil diperbarui.");
    };

    modal.classList.remove('hidden');
  };

  window.deleteBackupCard = function (event, backupId) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const backup = backupOtomatisData.find(b => String(b.id) === String(backupId));
    if (!backup) return;

    const label = backup.customName || backup.historyName || `${backup.day}, ${backup.date} ${backup.month} ${backup.year}`;
    if (!confirm(`Hapus data Backup "${label}"?\n\nData History utama tidak akan ikut terhapus.`)) return;

    backupOtomatisData = backupOtomatisData.filter(b => String(b.id) !== String(backupId));
    persistBackupData();
    closeBackupSettings();
    if (typeof populateBackupFilters === 'function') populateBackupFilters();
    renderBackupGrid();
    showModal("Berhasil", "Data Backup berhasil dihapus.");
  };

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.backup-settings-wrap')) closeBackupSettings();
  });

  /* Render ulang dengan fungsi asli, lalu tambahkan gear. */
  window.renderBackupGrid = function () {
    if (typeof originalBackupRender === 'function') originalBackupRender.apply(this, arguments);

    const container = document.getElementById('backup-grid');
    if (!container) return;

    /* Bersihkan patch UI lama jika ada agar tidak dobel. */
    container.querySelectorAll('.backup-settings-wrap').forEach(el => el.remove());

    const restoreButtons = Array.from(container.querySelectorAll('button[onclick*="restoreHistoryFromBackup("]'));
    restoreButtons.forEach(restoreBtn => {
      const match = restoreBtn.getAttribute('onclick')?.match(/restoreHistoryFromBackup\(([^)]+)\)/);
      if (!match) return;

      const backupId = String(match[1]).trim();
      const card = restoreBtn.closest('.bg-white');
      if (!card) return;

      const header = card.querySelector('.flex.items-center.justify-between.mb-3');
      if (!header) return;

      const oldStatus = header.querySelector('span.text-\\[10px\\]');
      const wrap = document.createElement('div');
      wrap.className = 'backup-settings-wrap relative ml-auto flex items-center gap-1';

      wrap.innerHTML = `
        <button type="button"
          onclick="toggleBackupSettings(event, ${backupId})"
          class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition"
          title="Pengaturan Backup" aria-label="Pengaturan Backup">
          <i class="fa-solid fa-gear text-xs"></i>
        </button>

        <div class="backup-settings-popup hidden absolute right-0 top-10 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 z-50"
             data-backup-id="${backupId}">
          <button type="button" onclick="editBackupDate(event, ${backupId})"
            class="w-full text-left px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
            <i class="fa-solid fa-calendar-days text-blue-500 w-4"></i>
            <span>Edit Waktu & Tanggal</span>
          </button>
          <button type="button" onclick="deleteBackupCard(event, ${backupId})"
            class="w-full text-left px-3 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2">
            <i class="fa-solid fa-trash-can text-rose-500 w-4"></i>
            <span>Hapus Data</span>
          </button>
        </div>
      `;

      if (oldStatus) oldStatus.remove();
      header.appendChild(wrap);

      const backup = backupOtomatisData.find(b => String(b.id) === backupId);
      const title = card.querySelector('h4');
      if (title && backup && backup.customName) title.textContent = backup.customName;
    });
  };
})();

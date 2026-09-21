let registeredUsers = JSON.parse(localStorage.getItem('finance_registered_users') || '[]');
        let currentSessionUser = JSON.parse(localStorage.getItem('finance_active_session') || 'null');

        let historyData = [];
        let pengeluaranData = [];
        let kasbonData = [];
        let backupOtomatisData = [];

        function loadUserData() {
            if (currentSessionUser && currentSessionUser.phone) {
                historyData = JSON.parse(localStorage.getItem(`finance_history_desktop_${currentSessionUser.phone}`) || '[]');
                pengeluaranData = JSON.parse(localStorage.getItem(`finance_pengeluaran_desktop_${currentSessionUser.phone}`) || '[]');
                kasbonData = JSON.parse(localStorage.getItem(`finance_kasbon_desktop_${currentSessionUser.phone}`) || '[]');
                backupOtomatisData = JSON.parse(localStorage.getItem(`finance_backup_desktop_${currentSessionUser.phone}`) || '[]');
            } else {
                historyData = [];
                pengeluaranData = [];
                kasbonData = [];
                backupOtomatisData = [];
            }
        }
        loadUserData();

        function triggerDailyAutoBackup(sourceHistoryId = null) {
            if (!currentSessionUser || !currentSessionUser.phone) return;
            const now = new Date();
            const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

            const dayName = days[now.getDay()];
            const dateNum = now.getDate();
            const monthIndex = now.getMonth();
            const monthName = months[monthIndex];
            const yearNum = now.getFullYear();
            const dateKey = `${dateNum}-${monthIndex}-${yearNum}`;

            /*
             * PATCH MINIMAL: Backup Otomatis tetap menggunakan mekanisme lama,
             * tetapi setiap backup sekarang mempunyai sourceHistoryId. Dengan ID
             * ini backup selalu mengikuti item History yang sama walaupun Hari,
             * Tanggal, Bulan, Tahun, atau nominalnya diedit dari History.
             */
            // Jika dipanggil setelah Input Data baru, cari backup berdasarkan ID input tersebut.
            // Dengan begitu setiap input baru mempunyai kartu backup sendiri.
            let existingBackup = sourceHistoryId != null
                ? backupOtomatisData.find(b => String(b.sourceHistoryId) === String(sourceHistoryId))
                : backupOtomatisData.find(b => b.dateKey === dateKey);

            if (!existingBackup && sourceHistoryId == null) {
                existingBackup = backupOtomatisData.find(b => {
                    const sourceId = b.sourceHistoryId;
                    return sourceId != null && historyData.some(h => String(h.id) === String(sourceId));
                });
            }

            if (!existingBackup) {
                const sourceHistory = sourceHistoryId != null
                    ? (historyData.find(h => String(h.id) === String(sourceHistoryId)) || null)
                    : (historyData.length ? historyData[0] : null);
                const newBackup = {
                    id: Date.now(),
                    dateKey: dateKey,
                    day: dayName,
                    date: dateNum,
                    monthIndex: monthIndex,
                    month: monthName,
                    year: yearNum,
                    sourceHistoryId: sourceHistory ? sourceHistory.id : null,
                    historySnapshot: JSON.parse(JSON.stringify(historyData))
                };
                backupOtomatisData.unshift(newBackup);
            } else {
                existingBackup.historySnapshot = JSON.parse(JSON.stringify(historyData));
                if (existingBackup.sourceHistoryId == null && historyData.length) {
                    existingBackup.sourceHistoryId = historyData[0].id;
                }
            }

            /*
             * Sinkronisasi dua arah dari History -> Backup.
             * Metadata kartu backup mengambil data langsung dari item History
             * yang menjadi sumbernya, bukan dari tanggal saat backup dibuat.
             */
            backupOtomatisData.forEach(backup => {
                backup.historySnapshot = JSON.parse(JSON.stringify(historyData));

                let source = null;
                if (backup.sourceHistoryId != null) {
                    source = historyData.find(h => String(h.id) === String(backup.sourceHistoryId)) || null;
                }

                /* Dukungan untuk backup lama yang belum mempunyai sourceHistoryId. */
                if (!source) {
                    const oldMonthIndex = Number.isFinite(Number(backup.monthIndex))
                        ? Number(backup.monthIndex)
                        : months.indexOf(backup.month);
                    source = historyData.find(h =>
                        Number(h.date) === Number(backup.date) &&
                        Number(h.year) === Number(backup.year) &&
                        Number(h.monthIndex) === oldMonthIndex
                    ) || null;
                    if (source) backup.sourceHistoryId = source.id;
                }

                if (source) {
                    const sourceMonthIndex = Number.isFinite(Number(source.monthIndex))
                        ? Number(source.monthIndex)
                        : months.indexOf(source.month);
                    backup.day = source.day || days[new Date(Number(source.year), sourceMonthIndex, Number(source.date)).getDay()];
                    backup.date = Number(source.date) || backup.date;
                    backup.monthIndex = sourceMonthIndex >= 0 ? sourceMonthIndex : backup.monthIndex;
                    backup.month = source.month || months[backup.monthIndex] || backup.month;
                    backup.year = Number(source.year) || backup.year;
                    backup.dateKey = `${backup.date}-${backup.monthIndex}-${backup.year}`;
                    backup.historyName = `${backup.day}, ${backup.date} ${backup.month} ${backup.year}`;
                    backup.sourceHistory = JSON.parse(JSON.stringify(source));
                }
            });

            localStorage.setItem(`finance_backup_desktop_${currentSessionUser.phone}`, JSON.stringify(backupOtomatisData));
        }
/* REKAPINYU AUTH RELOAD — SATU IMPLEMENTASI BARU
   Login tidak boleh tampil selama Firebase masih memulihkan sesi.
   Setelah Firebase selesai:
   - ada sesi Firebase -> langsung masuk aplikasi
   - tidak ada sesi -> baru tampilkan login
*/
function checkAuth() {
    const authContainer = document.getElementById('auth-container');
    if (!authContainer) return;

    if (window.__rekapinyuAuthBooting) {
        authContainer.classList.add('rk-auth-bootstrap');
        authContainer.classList.add('hidden');
        return;
    }

    authContainer.classList.remove('rk-auth-bootstrap');

    if (currentSessionUser) {
        authContainer.classList.add('hidden');
        const nameEl = document.getElementById('sidebar-user-name');
        if (nameEl) nameEl.innerText = currentSessionUser.name || '';
        updateUserAvatarUI();
        loadUserData();
    } else {
        authContainer.classList.remove('hidden');
        historyData = [];
        pengeluaranData = [];
        kasbonData = [];
        backupOtomatisData = [];
    }
}

/* Gate dimulai sebelum UI auth boleh tampil. */
window.__rekapinyuAuthBooting = true;

/* Jika cache sesi lokal masih ada, langsung siapkan state aplikasi.
   Firebase tetap menjadi sumber autentikasi dan akan mengonfirmasi sesi di observer. */
if (currentSessionUser && currentSessionUser.phone) {
    loadUserData();
}

function updateUserAvatarUI() {
            const avatarContainer = document.getElementById('sidebar-user-avatar-container');
            if (!avatarContainer || !currentSessionUser) return;

            if (currentSessionUser.photo) {
                avatarContainer.innerHTML = `<img src="${currentSessionUser.photo}" class="w-full h-full object-cover bg-slate-100" alt="Foto profil">`;
            } else {
                avatarContainer.innerHTML = `<i id="sidebar-user-avatar-icon" class="fa-solid fa-user"></i>`;
            }
        }

        function toggleAuthView(view) {
            const loginCard = document.getElementById('login-card');
            const registerCard = document.getElementById('register-card');
            if (view === 'register') {
                loginCard.classList.add('hidden');
                registerCard.classList.remove('hidden');
            } else {
                registerCard.classList.add('hidden');
                loginCard.classList.remove('hidden');
            }
        }

        function toggleProfileSettingMenu(event) {
            event.stopPropagation();
            const popup = document.getElementById('profile-setting-popup');
            popup.classList.toggle('hidden');
        }

        window.addEventListener('click', function(e) {
            if (!e.target.closest('.toggle-profile-setting-container')) {
                const popup = document.getElementById('profile-setting-popup');
                if (popup) popup.classList.add('hidden');
            }
        });

        function openProfileModal(type) {
            const popup = document.getElementById('profile-setting-popup');
            if (popup) popup.classList.add('hidden');

            const modal = document.getElementById('profile-modal');
            const titleEl = document.getElementById('profile-modal-title');
            const bodyEl = document.getElementById('profile-modal-body');
            const saveBtn = document.getElementById('save-profile-btn');

            if (!currentSessionUser) return;

            if (type === 'ganti-nama') {
                titleEl.innerText = "Ganti Nama Profil";
                bodyEl.innerHTML = `
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Nama Lengkap Baru</label>
                        <input type="text" id="input-new-name" value="${currentSessionUser.name}" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                    </div>
                `;
                saveBtn.onclick = function() {
                    const newName = document.getElementById('input-new-name').value.trim();
                    if (!newName) return;

                    currentSessionUser.name = newName;
                    updateUserInStorage();
                    document.getElementById('sidebar-user-name').innerText = newName;
                    closeProfileModal();
                    showModal("Berhasil", "Nama profil berhasil diperbarui.");
                };
            } else if (type === 'ganti-foto') {
                titleEl.innerText = "Ganti Foto Profil Manual";
                bodyEl.innerHTML = `
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Pilih File Gambar</label>
                        <input type="file" id="input-new-photo" accept="image/*" class="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100">
                    </div>
                `;
                saveBtn.onclick = function() {
                    const fileInput = document.getElementById('input-new-photo');
                    if (fileInput.files && fileInput.files[0]) {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            currentSessionUser.photo = e.target.result;
                            updateUserInStorage();
                            updateUserAvatarUI();
                            closeProfileModal();
                            showModal("Berhasil", "Foto profil berhasil diunggah dan diperbarui.");
                        };
                        reader.readAsDataURL(fileInput.files[0]);
                    } else {
                        showModal("Gagal", "Silakan pilih file gambar terlebih dahulu.", "fa-solid fa-circle-exclamation text-rose-600");
                    }
                };
            } else if (type === 'ganti-password') {
                titleEl.innerText = "Ganti Kata Sandi Login";
                bodyEl.innerHTML = `
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Kata Sandi Baru</label>
                        <input type="password" id="input-new-password" placeholder="••••••••" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                    </div>
                `;
                saveBtn.onclick = function() {
                    const newPass = document.getElementById('input-new-password').value;
                    if (!newPass) return;

                    currentSessionUser.password = newPass;
                    updateUserInStorage();
                    closeProfileModal();
                    showModal("Berhasil", "Kata sandi login berhasil diperbarui.");
                };
            }

            modal.classList.remove('hidden');
        }

        function closeProfileModal() {
            document.getElementById('profile-modal').classList.add('hidden');
        }

        function updateUserInStorage() {
            localStorage.setItem('finance_active_session', JSON.stringify(currentSessionUser));
            const index = registeredUsers.findIndex(u => u.phone === currentSessionUser.phone);
            if (index !== -1) {
                registeredUsers[index] = currentSessionUser;
                localStorage.setItem('finance_registered_users', JSON.stringify(registeredUsers));
            }
        }

        function formatRupiah(number) {
            return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
        }

        function parseNum(val) {
            if (!val) return 0;
            return parseFloat(val.toString().replace(/\./g, '')) || 0;
        }

        /* NOMINAL INPUT — SATU IMPLEMENTASI FINAL UNTUK SELURUH APLIKASI */
        const NOMINAL_INPUT_IDS = new Set([
            'income', 'expense', 'cashout', 'pengeluaran-nominal', 'kasbon-harga',
            'kasir-popup-paid', 'kasir-popup-discount',
            'pk3-cost', 'pk3-price', 'pk3-edit-cost', 'pk3-edit-price',
            'edit-val-income', 'edit-val-expense', 'edit-val-cashout'
        ]);
        const STOCK_INPUT_IDS = new Set(['pk3-stock', 'pk3-edit-stock']);

        function formatNominalInput(input) {
            if (!(input instanceof HTMLInputElement) || !NOMINAL_INPUT_IDS.has(input.id)) return;
            const raw = String(input.value || '');
            const cursor = typeof input.selectionStart === 'number' ? input.selectionStart : raw.length;
            const digitsBeforeCursor = (raw.slice(0, cursor).match(/\d/g) || []).length;
            const digits = raw.replace(/\D/g, '');
            const formatted = digits ? Number(digits).toLocaleString('id-ID') : '';
            input.value = formatted;

            if (document.activeElement === input && typeof input.setSelectionRange === 'function') {
                let position = 0;
                let seen = 0;
                while (position < formatted.length && seen < digitsBeforeCursor) {
                    if (/\d/.test(formatted[position])) seen++;
                    position++;
                }
                input.setSelectionRange(position, position);
            }
        }

        function updateLiveProfit() {
            const val = parseNum(document.getElementById('income').value);
            const cashoutVal = parseNum(document.getElementById('cashout').value);
            const profitPct = parseFloat(document.getElementById('profit-percentage').value) || 0;
            const profit = (val - cashoutVal) * (profitPct / 100);
            profitDisplay.innerText = formatRupiah(profit > 0 ? profit : 0);
        }

        document.addEventListener('input', (event) => {
            const input = event.target;
            if (!(input instanceof HTMLInputElement)) return;

            if (NOMINAL_INPUT_IDS.has(input.id)) {
                formatNominalInput(input);
                if (input.id === 'income' || input.id === 'expense' || input.id === 'cashout') {
                    updateLiveProfit();
                }
            } else if (STOCK_INPUT_IDS.has(input.id)) {
                input.value = input.value.replace(/\D/g, '');
            }

            if (input.id === 'kasir-search') {
                kasirLastAddedProductId = null;
                renderKasirProducts();
            }

            if (input.id === 'profit-percentage') {
                updateLiveProfit();
            }
        });

        function updateHeaderDate() {
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const dateStr = new Date().toLocaleDateString('id-ID', options);
            document.getElementById('current-date-header').innerText = dateStr;
        }
        updateHeaderDate();

        // Foto sampul toko: fitur tambahan yang berdiri sendiri dan tidak mengubah fungsi data lainnya.
        (function initShopCoverPhoto() {
            const coverInput = document.getElementById('shop-cover-input');
            const coverFrame = document.getElementById('shop-cover-frame');
            const coverImage = document.getElementById('shop-cover-image');
            const coverPlaceholder = document.getElementById('shop-cover-placeholder');
            const saveButton = document.getElementById('shop-cover-save');
            const editHint = document.getElementById('shop-cover-edit-hint');
            if (!coverInput || !coverFrame || !coverImage || !coverPlaceholder || !saveButton) return;

            let coverX = 50;
            let coverY = 50;
            let coverSaved = true;
            let coverEditingUnsaved = false;
            let dragging = false;
            let startPointerX = 0;
            let startPointerY = 0;
            let startCoverX = 50;
            let startCoverY = 50;

            const storageKey = () => {
                try {
                    return (typeof currentSessionUser !== 'undefined' && currentSessionUser)
                        ? `finance_shop_cover_${currentSessionUser.phone}`
                        : 'finance_shop_cover_guest';
                } catch (e) {
                    return 'finance_shop_cover_guest';
                }
            };

            function setObjectPosition() {
                coverImage.style.objectPosition = `${coverX}% ${coverY}%`;
            }

            function setEditorState(show) {
                coverSaved = !show;
                coverEditingUnsaved = !!show;
                window.__shopCoverEditingUnsaved = !!show;
                saveButton.classList.toggle('hidden', !show);
                editHint.classList.toggle('hidden', !show);
                coverFrame.classList.toggle('cursor-move', show);
            }

            function renderShopCover(data, editing) {
                let src = '', x = 50, y = 50;
                if (typeof data === 'string') src = data;
                else if (data) { src = data.src || ''; x = Number.isFinite(Number(data.x)) ? Number(data.x) : 50; y = Number.isFinite(Number(data.y)) ? Number(data.y) : 50; }
                coverX = Math.max(0, Math.min(100, x));
                coverY = Math.max(0, Math.min(100, y));
                if (src) {
                    coverImage.src = src;
                    coverImage.classList.remove('hidden');
                    coverPlaceholder.classList.add('hidden');
                    setObjectPosition();
                } else {
                    coverImage.removeAttribute('src');
                    coverImage.classList.add('hidden');
                    coverPlaceholder.classList.remove('hidden');
                    coverImage.style.objectPosition = '50% 50%';
                }
                setEditorState(!!editing);
            }

            function loadShopCover() {
                try {
                    const raw = localStorage.getItem(storageKey());
                    if (!raw) { renderShopCover('', false); return; }
                    let data;
                    try { data = JSON.parse(raw); } catch (e) { data = {src: raw, x: 50, y: 50}; }
                    renderShopCover(data, false);
                } catch (e) { renderShopCover('', false); }
            }

            coverFrame.addEventListener('click', function (e) {
                if (coverSaved && !e.target.closest('#shop-cover-save')) {
                    coverInput.click();
                }
            });

            coverInput.addEventListener('change', function () {
                const file = this.files && this.files[0];
                if (!file || !file.type.startsWith('image/')) return;
                const reader = new FileReader();
                reader.onload = function (event) {
                    // Kompres ukuran foto sebelum masuk localStorage agar foto landscape/beresolusi besar
                    // tidak gagal disimpan karena batas kapasitas localStorage.
                    const tempImage = new Image();
                    tempImage.onload = function () {
                        const maxWidth = 1600;
                        const maxHeight = 1200;
                        const scale = Math.min(1, maxWidth / tempImage.naturalWidth, maxHeight / tempImage.naturalHeight);
                        const canvas = document.createElement('canvas');
                        canvas.width = Math.max(1, Math.round(tempImage.naturalWidth * scale));
                        canvas.height = Math.max(1, Math.round(tempImage.naturalHeight * scale));
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return;
                        ctx.drawImage(tempImage, 0, 0, canvas.width, canvas.height);
                        const compressedSrc = canvas.toDataURL('image/jpeg', 0.82);
                        coverX = 50; coverY = 50;
                        renderShopCover({src: compressedSrc, x: coverX, y: coverY}, true);
                    };
                    tempImage.onerror = function () {
                        // Fallback untuk format gambar yang tidak dapat dikonversi browser.
                        coverX = 50; coverY = 50;
                        renderShopCover({src: event.target.result, x: coverX, y: coverY}, true);
                    };
                    tempImage.src = event.target.result;
                };
                reader.readAsDataURL(file);
                this.value = '';
            });

            coverFrame.addEventListener('pointerdown', function (e) {
                if (e.target.closest('#shop-cover-save') || coverSaved || coverImage.classList.contains('hidden')) return;
                dragging = true;
                coverFrame.setPointerCapture(e.pointerId);
                startPointerX = e.clientX;
                startPointerY = e.clientY;
                startCoverX = coverX;
                startCoverY = coverY;
                e.preventDefault();
            });

            coverFrame.addEventListener('pointermove', function (e) {
                if (!dragging) return;
                const rect = coverFrame.getBoundingClientRect();
                // Geser foto dengan mouse/touch. Dibuat terbalik agar foto bergerak mengikuti arah geseran.
                coverX = Math.max(0, Math.min(100, startCoverX - ((e.clientX - startPointerX) / rect.width) * 100));
                coverY = Math.max(0, Math.min(100, startCoverY - ((e.clientY - startPointerY) / rect.height) * 100));
                setObjectPosition();
            });

            function stopDrag() { dragging = false; }
            coverFrame.addEventListener('pointerup', stopDrag);
            coverFrame.addEventListener('pointercancel', stopDrag);
            coverFrame.addEventListener('lostpointercapture', stopDrag);

            // Tombol Simpan dibuat sebagai handler langsung agar tidak tertangkap event frame/drag lain.
            saveButton.onclick = function (e) {
                e.preventDefault();
                e.stopPropagation();
                window.saveShopCoverPhoto();
                return false;
            };

            window.saveShopCoverPhoto = async function (options = {}) {
                try {
                    const src = coverImage.getAttribute('src') || coverImage.src || '';
                    if (!src || coverImage.classList.contains('hidden')) return false;
                    const data = {
                        src: src,
                        x: Math.max(0, Math.min(100, Number(coverX) || 50)),
                        y: Math.max(0, Math.min(100, Number(coverY) || 50))
                    };
                    const phone = (typeof currentSessionUser !== 'undefined' && currentSessionUser) ? phoneOf(currentSessionUser.phone) : '';
                    // Simpan posisi + preview lokal terlebih dahulu agar tombol Simpan selalu berhasil.
                    localStorage.setItem(storageKey(), JSON.stringify(data));
                    coverX = data.x; coverY = data.y; setObjectPosition(); setEditorState(false);
                    const pending = window.__shopCoverPendingFile || null;
                    window.__shopCoverPendingFile=null;

                    // Upload Firebase dilakukan di belakang layar agar tombol Simpan langsung selesai.
                    if (!options.localOnly && auth.currentUser && pending) {
                        try {
                            const r=ref(storage,`users/${auth.currentUser.uid}/shop-cover`);
                            await uploadBytes(r,pending,{contentType:pending.type,cacheControl:'public,max-age=31536000'});
                            const url=await getDownloadURL(r);
                            const cloudData={src:url,x:data.x,y:data.y};
                            if(phone)localStorage.setItem(`finance_shop_cover_${phone}`,JSON.stringify(cloudData));
                            try{await setDoc(dref(auth.currentUser.uid),{shopCover:url,updatedAt:serverTimestamp()},{merge:true});}catch(dbErr){console.warn('URL sampul tersimpan di Storage, Firestore belum menerima.',dbErr)}
                            renderShopCover(cloudData,false);
                        } catch(storageErr) {
                            console.warn('Sampul tersimpan lokal; Firebase Storage belum mengizinkan upload.',storageErr);
                        }
                    } else if (auth.currentUser && pending) {
                        // Tetap sinkronkan cloud tanpa menahan hasil klik.
                        Promise.resolve().then(async()=>{
                            try {
                                const r=ref(storage,`users/${auth.currentUser.uid}/shop-cover`);
                                await uploadBytes(r,pending,{contentType:pending.type,cacheControl:'public,max-age=31536000'});
                                const url=await getDownloadURL(r);
                                const cloudData={src:url,x:data.x,y:data.y};
                                if(phone)localStorage.setItem(`finance_shop_cover_${phone}`,JSON.stringify(cloudData));
                                try{await setDoc(dref(auth.currentUser.uid),{shopCover:url,updatedAt:serverTimestamp()},{merge:true});}catch(dbErr){console.warn('URL sampul tersimpan di Storage, Firestore belum menerima.',dbErr)}
                                renderShopCover(cloudData,false);
                            } catch(storageErr) { console.warn('Sinkronisasi sampul Firebase gagal; versi lokal tetap tersimpan.',storageErr); }
                        });
                    }
                    if(!options.localOnly) notify('Berhasil','Foto sampul berhasil disimpan.');
                    return true;
                } catch (e) {
                    console.warn('Foto sampul toko tidak dapat disimpan:', e);
                    notify('Gagal','Foto sampul tidak dapat disimpan.','fa-solid fa-circle-xmark text-rose-600');
                    return false;
                }
            };
            window.__shopCoverEditingUnsaved = false;
            window.__setShopCoverPreview = function(src,file){
                if(!src)return false;
                window.__shopCoverPendingFile=file||null;
                renderShopCover({src:src,x:50,y:50},true);
                return true;
            };
            loadShopCover();
        })();

        window.refreshShopCoverPhoto = function () {
            if (window.__shopCoverEditingUnsaved) return;
            const input = document.getElementById('shop-cover-input');
            const image = document.getElementById('shop-cover-image');
            const placeholder = document.getElementById('shop-cover-placeholder');
            const saveButton = document.getElementById('shop-cover-save');
            const editHint = document.getElementById('shop-cover-edit-hint');
            if (!input || !image || !placeholder) return;
            const key = currentSessionUser ? `finance_shop_cover_${currentSessionUser.phone}` : 'finance_shop_cover_guest';
            try {
                const raw = localStorage.getItem(key) || '';
                if (raw) {
                    let data;
                    try { data = JSON.parse(raw); } catch (e) { data = {src: raw, x: 50, y: 50}; }
                    image.src = data.src || '';
                    image.style.objectPosition = `${Number.isFinite(Number(data.x)) ? Number(data.x) : 50}% ${Number.isFinite(Number(data.y)) ? Number(data.y) : 50}%`;
                    image.classList.remove('hidden');
                    placeholder.classList.add('hidden');
                    if (saveButton) saveButton.classList.add('hidden');
                    if (editHint) editHint.classList.add('hidden');
                    const frame = document.getElementById('shop-cover-frame');
                    if (frame) frame.classList.remove('cursor-move');
                    window.__shopCoverEditingUnsaved = false;
                } else {
                    image.removeAttribute('src');
                    image.classList.add('hidden');
                    placeholder.classList.remove('hidden');
                    if (saveButton) saveButton.classList.add('hidden');
                    if (editHint) editHint.classList.add('hidden');
                    const frame = document.getElementById('shop-cover-frame');
                    if (frame) frame.classList.remove('cursor-move');
                    window.__shopCoverEditingUnsaved = false;
                }
            } catch (e) {}
        };
        const profitDisplay = document.getElementById('profit-display');

        function switchTab(tab) {
const views = ['input', 'pengeluaran', 'kasbon', 'kasir', 'produk-kasir', 'laporan-kasir', 'history', 'report', 'backup', 'activity', 'settings'];
            const titles = {
                input: { title: 'Form Input Keuangan Harian', subtitle: 'Catat pendapatan, belanja, dan pengeluaran harian dengan cepat & akurat.' },
                pengeluaran: { title: 'Manajemen Pengeluaran', subtitle: 'Catat rincian pembayaran atau pengeluaran secara terpisah.' },
                kasbon: { title: 'Manajemen Kasbon Pelanggan', subtitle: 'Catat kasbon dan status pembayaran pelanggan secara transparan.' },
                kasir: { title: 'Kasir', subtitle: 'Menu kasir untuk transaksi penjualan.' },
                'produk-kasir': { title: 'Produk Kasir', subtitle: 'Kelola produk yang langsung digunakan di menu Kasir.' },
                'laporan-kasir': { title: 'Laporan Kasir', subtitle: 'Ringkasan transaksi penjualan dari menu Kasir.' },
                history: { title: 'Riwayat Rekapitulasi Realtime', subtitle: 'Semua riwayat entri data harian lengkap.' },
                report: { title: 'Laporan Rekapitulasi Bulanan', subtitle: 'Akumulasi total pendapatan, belanja, pengeluaran, dan profit bulanan.' },
                backup: { title: 'Backup Otomatis Harian', subtitle: 'Pulihkan riwayat data history jika terjadi kehilangan data.' },
                activity: { title: 'Aktifitas', subtitle: 'History aktifitas penggunaan aplikasi secara realtime.' },
                settings: { title: 'Setting', subtitle: 'Atur informasi yang tampil pada struk kasir.' }
            };

            const icons = {
                input: 'fa-pen-to-square',
                pengeluaran: 'fa-money-bill-transfer',
                kasbon: 'fa-hand-holding-dollar',
                kasir: 'fa-cash-register',
                'produk-kasir': 'fa-boxes-stacked',
                'laporan-kasir': 'fa-file-invoice-dollar',
                history: 'fa-clock-rotate-left',
                report: 'fa-chart-line',
                backup: 'fa-cloud-arrow-up',
                activity: 'fa-list-check',
                settings: 'fa-gear'
            };

            const pengeluaranStickyContainer = document.getElementById('pengeluaran-sticky-container');
            const kasbonStickyContainer = document.getElementById('kasbon-sticky-container');
            const backupStickyContainer = document.getElementById('backup-sticky-container');
            const produkKasirDataTools = document.getElementById('pk3-data-tools');

            views.forEach(v => {
                const viewEl = document.getElementById(`view-${v}`);
                if (viewEl) viewEl.classList.add('hidden');
                
                const deskNav = document.getElementById(`nav-${v}`);
                const iconEl = document.getElementById(`icon-${v}`);
                if (deskNav && iconEl) {
                    const iconClass = icons[v];
                    if (v === tab) {
                        if (v === 'kasbon') {
                            const wrapper = document.getElementById('nav-kasbon-wrapper');
                            if (wrapper) wrapper.className = "flex items-center w-full rounded-xl text-sm font-semibold text-white bg-blue-600/85 group relative";
                            deskNav.className = "flex-1 flex items-center gap-3 px-3 py-2.5 text-left truncate";
                            deskNav.innerHTML = `
    <span class="sidebar-icon-overlay" id="icon-kasbon" aria-hidden="true"><i class="fa-solid ${iconClass}" aria-hidden="true"></i><i class="fa-solid ${iconClass}" aria-hidden="true"></i></span>
    <span class="sidebar-text truncate">Kasbon</span>
                            `;
                        } else {
                            deskNav.className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600/85 group relative";
                            deskNav.innerHTML = `
                                <span class="sidebar-icon-overlay" id="icon-${v}" aria-hidden="true"><i class="fa-solid ${iconClass}" aria-hidden="true"></i><i class="fa-solid ${iconClass}" aria-hidden="true"></i></span>
                                <span class="sidebar-text truncate">${deskNav.querySelector('.sidebar-text')?.innerText || deskNav.getAttribute('title') || ''}</span>
                            `;
                        }
                    } else {
                        if (v === 'kasbon') {
                            const wrapper = document.getElementById('nav-kasbon-wrapper');
                            if (wrapper) wrapper.className = "flex items-center w-full rounded-xl text-sm font-medium group relative";
                            deskNav.className = "flex-1 flex items-center gap-3 px-3 py-2.5 text-left truncate";
                            deskNav.innerHTML = `
                                <span class="sidebar-icon-overlay" id="icon-kasbon" aria-hidden="true"><i class="fa-solid ${iconClass}" aria-hidden="true"></i><i class="fa-solid ${iconClass}" aria-hidden="true"></i></span>
                                <span class="sidebar-text truncate">Kasbon</span>
                            `;
                        } else {
                            deskNav.className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium group relative";
                            deskNav.innerHTML = `
                                <span class="sidebar-icon-overlay" id="icon-${v}" aria-hidden="true"><i class="fa-solid ${iconClass}" aria-hidden="true"></i><i class="fa-solid ${iconClass}" aria-hidden="true"></i></span>
                                <span class="sidebar-text truncate">${deskNav.querySelector('.sidebar-text')?.innerText || deskNav.getAttribute('title') || ''}</span>
                            `;
                        }
                    }
                }

                const mobNav = document.getElementById(`nav-mobile-${v}`);
                if (mobNav) {
                    if (v === tab) {
                        mobNav.className = "flex flex-col items-center py-1 px-3 text-emerald-600 transition";
                        mobNav.querySelector('span').className = "text-[11px] font-semibold";
                    } else {
                        mobNav.className = "flex flex-col items-center py-1 px-3 text-slate-400 hover:text-slate-600 transition";
                        mobNav.querySelector('span').className = "text-[11px] font-medium";
                    }
                }
            });

            if (tab === 'laporan-kasir' && typeof window.__renderLaporanKasir === 'function') window.__renderLaporanKasir();


            document.getElementById(`view-${tab}`).classList.remove('hidden');
            document.getElementById('page-title-header').innerText = titles[tab].title;
            document.getElementById('page-subtitle-header').innerText = titles[tab].subtitle;

            if (pengeluaranStickyContainer) pengeluaranStickyContainer.classList.add('hidden');
            if (kasbonStickyContainer) kasbonStickyContainer.classList.add('hidden');
            if (produkKasirDataTools) produkKasirDataTools.classList.add('hidden');
            if (backupStickyContainer) backupStickyContainer.classList.add('hidden');
            // Kasir tidak menggunakan sticky filter umum.
            if (tab === 'kasir' && typeof window.__initKasirViews === 'function') {
                window.__initKasirViews();
            }
            if (tab === 'produk-kasir' && typeof window.__initProdukKasir === 'function') {
                window.__initProdukKasir();
            }
            if (tab === 'settings') {
                loadKasirReceiptSettings();
            }
            if (tab === 'produk-kasir' && produkKasirDataTools) {
                produkKasirDataTools.classList.remove('hidden');
            }

            if (tab === 'pengeluaran') {
                if (pengeluaranStickyContainer) pengeluaranStickyContainer.classList.remove('hidden');
            } else if (tab === 'kasbon') {
                if (kasbonStickyContainer) kasbonStickyContainer.classList.remove('hidden');
            } else if (tab === 'backup') {
                if (backupStickyContainer) backupStickyContainer.classList.remove('hidden');
            }

            if (tab === 'input' || tab === 'backup' || tab === 'laporan-kasir' || tab === 'settings') {
                if (tab === 'backup') {
                    populateBackupFilters();
                    renderBackupGrid();
                }
            } else if (tab === 'kasir') {
            } else {
                if (tab === 'history' && window.matchMedia('(max-width:767px)').matches) {
                    } else {
                }
                if (tab === 'pengeluaran') {
                    populatePengeluaranFilters();
                    renderPengeluaranGrid();
                } else if (tab === 'kasbon') {
                    renderKasbonGrid();
                    // Desktop: sembunyikan filter sticky Lunas/Belum Lunas yang melayang di bawah.
                    // Mobile tetap mempertahankan filter kasbon yang sudah ada.
                    if (window.matchMedia('(min-width:768px)').matches) {
                            } else {
                        }
                } else if (tab === 'history') {
                    populateHistoryFilters();
                    renderHistory();
                } else if (tab === 'report') {
                    populateReportFilters();
                    renderReport();
                }
            }
        }

        function renderBackupGrid() {
            const container = document.getElementById('backup-grid');
            if (!container) return;

            loadUserData();

            const searchEl = document.getElementById('filter-backup-search');
            const dateEl = document.getElementById('filter-backup-date');
            const monthEl = document.getElementById('filter-backup-month');
            const yearEl = document.getElementById('filter-backup-year');
            const search = searchEl ? searchEl.value.trim().toLowerCase() : '';
            const fDate = dateEl ? dateEl.value : '';
            const fMonth = monthEl ? monthEl.value : '';
            const fYear = yearEl ? yearEl.value : '';

            let filtered = backupOtomatisData.filter(backup => {
                const text = `${backup.day || ''} ${backup.date || ''} ${backup.month || ''} ${backup.year || ''}`.toLowerCase();
                const matchSearch = !search || text.includes(search);
                const matchDate = !fDate || String(backup.date) === String(fDate);
                const matchMonth = !fMonth || String(backup.month) === String(fMonth);
                const matchYear = !fYear || String(backup.year) === String(fYear);
                return matchSearch && matchDate && matchMonth && matchYear;
            });

            // Backup selalu ditampilkan dari tanggal terbaru ke terlama.
            // Gunakan daftar bulan lokal agar tidak bergantung pada variabel dari script lain.
            const backupMonthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
            filtered.sort((a,b) => {
                const aMonth = Number.isFinite(Number(a.monthIndex)) ? Number(a.monthIndex) : backupMonthNames.indexOf(a.month);
                const bMonth = Number.isFinite(Number(b.monthIndex)) ? Number(b.monthIndex) : backupMonthNames.indexOf(b.month);
                const ad = new Date(Number(a.year)||0, aMonth >= 0 ? aMonth : 0, Number(a.date)||1).getTime();
                const bd = new Date(Number(b.year)||0, bMonth >= 0 ? bMonth : 0, Number(b.date)||1).getTime();
                return bd - ad || (Number(b.id)||0) - (Number(a.id)||0);
            });

            if (backupOtomatisData.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full text-center py-16 bg-white rounded-2xl shadow-lg border border-dashed border-slate-200 text-slate-400">
                        <i class="fa-solid fa-cloud-arrow-down text-4xl mb-3 text-slate-300"></i>
                        <p class="text-sm font-medium">Belum ada data backup otomatis.</p>
                        <p class="text-xs text-slate-400 mt-1">Data backup otomatis akan tercatat saat Anda menambahkan transaksi.</p>
                    </div>`;
                return;
            }

            if (!filtered.length) {
                container.innerHTML = `
                    <div class="col-span-full text-center py-16 bg-white rounded-2xl shadow-lg border border-dashed border-slate-200 text-slate-400">
                        <i class="fa-solid fa-filter-circle-xmark text-4xl mb-3 text-slate-300"></i>
                        <p class="text-sm font-medium">Tidak ada backup yang sesuai filter.</p>
                    </div>`;
                return;
            }

            container.innerHTML = filtered.map(backup => {
                return `
                    <div class="bg-white p-6 rounded-2xl shadow-lg border border-slate-200/80 flex flex-col justify-between space-y-4 hover:shadow-xl transition">
                        <div>
                            <div class="flex items-center justify-between mb-3">
                                <span class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-bold">
                                    <i class="fa-solid fa-database"></i>
                                </span>
                                <span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Backup Aktif</span>
                            </div>
                            <h4 class="font-extrabold text-slate-800 text-base">${backup.historyName || `${backup.day}, ${backup.date} ${backup.month} ${backup.year}`}</h4>
                            <p class="text-xs text-slate-500 mt-1">Total riwayat tersimpan: ${backup.historySnapshot.length} item data</p>
                            ${backup.sourceHistory ? `
                            <div class="grid grid-cols-2 gap-2 mt-3">
                                <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                    <div class="text-[10px] text-slate-500 font-semibold">Pendapatan</div>
                                    <div class="text-xs font-extrabold text-emerald-600">${formatRupiah(backup.sourceHistory.income || 0)}</div>
                                </div>
                                <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                    <div class="text-[10px] text-slate-500 font-semibold">Total Belanja</div>
                                    <div class="text-xs font-extrabold text-slate-800">${formatRupiah(backup.sourceHistory.expense || 0)}</div>
                                </div>
                                <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                    <div class="text-[10px] text-slate-500 font-semibold">Pengeluaran</div>
                                    <div class="text-xs font-extrabold text-rose-600">${formatRupiah(backup.sourceHistory.cashout || 0)}</div>
                                </div>
                                <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                    <div class="text-[10px] text-slate-500 font-semibold">Profit (${backup.sourceHistory.profitPercentage !== undefined ? backup.sourceHistory.profitPercentage : 10}%)</div>
                                    <div class="text-xs font-extrabold text-amber-600">${formatRupiah(backup.sourceHistory.profit || 0)}</div>
                                </div>
                            </div>` : ''}
                        </div>
                        <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
                            <span class="text-[11px] font-semibold text-slate-400">Pulihkan jika history hilang</span>
                            <button onclick="restoreHistoryFromBackup(${backup.id})" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer">
                                <i class="fa-solid fa-rotate-left"></i> Pulihkan
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function restoreHistoryFromBackup(backupId) {
            const backup = backupOtomatisData.find(b => b.id === backupId);
            if (!backup) return;

            historyData = JSON.parse(JSON.stringify(backup.historySnapshot));
            if (currentSessionUser && currentSessionUser.phone) {
                localStorage.setItem(`finance_history_desktop_${currentSessionUser.phone}`, JSON.stringify(historyData));
            }

            showModal("Pemulihan Berhasil", `Data history pada tanggal ${backup.date} ${backup.month} ${backup.year} berhasil dipulihkan secara utuh!`);
            switchTab('history');
        }

        function populateBackupFilters() {
            const dateSelect = document.getElementById('filter-backup-date');
            const monthSelect = document.getElementById('filter-backup-month');
            const yearSelect = document.getElementById('filter-backup-year');
            if (!dateSelect || !monthSelect || !yearSelect) return;

            const currentDate = dateSelect.value;
            const currentMonth = monthSelect.value;
            const currentYear = yearSelect.value;
            const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

            dateSelect.innerHTML = '<option value="">Tgl</option>' + Array.from({length:31},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('');
            monthSelect.innerHTML = '<option value="">Bulan</option>' + months.map(m=>`<option value="${m}">${m}</option>`).join('');

            const years = [...new Set(backupOtomatisData.map(b=>Number(b.year)).filter(y=>y))].sort((a,b)=>b-a);
            if (!years.length) {
                const currentYearNow = new Date().getFullYear();
                for(let y=2000;y<=2030;y++) years.push(y);
                years.sort((a,b)=>b-a);
            }
            yearSelect.innerHTML = '<option value="">Tahun</option>' + years.map(y=>`<option value="${y}">${y}</option>`).join('');

            dateSelect.value = currentDate;
            monthSelect.value = currentMonth;
            yearSelect.value = currentYear;
        }

        function showModal(title, message, iconClass = "fa-solid fa-circle-check") {
            document.getElementById('modal-title').innerText = title;
            document.getElementById('modal-message').innerText = message;
            document.getElementById('modal-icon').innerHTML = `<i class="${iconClass}"></i>`;
            document.getElementById('custom-modal').classList.remove('hidden');
        }
        function closeModal() {
            document.getElementById('custom-modal').classList.add('hidden');
        }

        function toggleEditMenu(id) {
            const menu = document.getElementById(`edit-menu-${id}`);
            document.querySelectorAll('[id^="edit-menu-"]').forEach(el => {
                if(el.id !== `edit-menu-${id}`) el.classList.add('hidden');
            });
            menu.classList.toggle('hidden');
        }

        window.addEventListener('click', function(e) {
            if (!e.target.closest('.toggle-edit-container')) {
                document.querySelectorAll('[id^="edit-menu-"]').forEach(el => {
                    el.classList.add('hidden');
                });
            }
        });

        function openEditSubMenu(id, type) {
            document.getElementById(`edit-menu-${id}`).classList.add('hidden');
            const item = historyData.find(d => d.id === id);
            if(!item) return;

            const modal = document.getElementById('edit-modal');
            const modalTitle = document.getElementById('edit-modal-title');
            const modalBody = document.getElementById('edit-modal-body');
            const saveBtn = document.getElementById('save-edit-btn');

            if (type === 'nominal') {
                modalTitle.innerText = `Edit Nominal (ID: ${item.id.toString().slice(-4)})`;
                modalBody.innerHTML = `
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Pendapatan</label>
                        <input type="text" id="edit-val-income" value="${item.income.toLocaleString('id-ID')}" class="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold">
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Total Belanja</label>
                        <input type="text" id="edit-val-expense" value="${(item.expense || 0).toLocaleString('id-ID')}" class="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold">
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Pengeluaran</label>
                        <input type="text" id="edit-val-cashout" value="${(item.cashout || 0).toLocaleString('id-ID')}" class="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold">
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Profit Persen (%)</label>
                        <input type="number" step="0.01" id="edit-val-profit-pct" value="${item.profitPercentage !== undefined ? item.profitPercentage : 10}" class="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold">
                    </div>
                `;
                saveBtn.onclick = function() {
                    item.income = parseNum(document.getElementById('edit-val-income').value);
                    item.expense = parseNum(document.getElementById('edit-val-expense').value);
                    item.cashout = parseNum(document.getElementById('edit-val-cashout').value);
                    item.profitPercentage = parseFloat(document.getElementById('edit-val-profit-pct').value) || 10;
                    // Samakan hitungan profit History dengan Form Input Data Harian.
                    item.profit = Math.max((item.income - item.cashout) * (item.profitPercentage / 100), 0);
                    saveAndRefreshHistory();
                    closeEditModal();
                    showModal("Berhasil", "Nominal dan profit persen transaksi berhasil diperbarui.");
                };
            } else if (type === 'datetime') {
                const daysOptions = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                const monthsOptions = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

                modalTitle.innerText = `Edit Waktu & Tanggal (ID: ${item.id.toString().slice(-4)})`;
                modalBody.innerHTML = `
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Hari</label>
                        <select id="edit-val-day" class="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold">
                            ${daysOptions.map(d => `<option value="${d}" ${d === item.day ? 'selected' : ''}>${d}</option>`).join('')}
                        </select>
                    </div>
                    <div class="grid grid-cols-3 gap-2">
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Tanggal</label>
                            <input type="number" id="edit-val-date" min="1" max="31" value="${item.date}" class="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold">
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Bulan</label>
                            <select id="edit-val-month" class="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold">
                                ${monthsOptions.map((m, idx) => `<option value="${m}" data-index="${idx}" ${m === item.month ? 'selected' : ''}>${m}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Tahun</label>
                            <input type="number" id="edit-val-year" value="${item.year}" class="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold">
                        </div>
                    </div>
                `;
                saveBtn.onclick = function() {
                    item.day = document.getElementById('edit-val-day').value;
                    item.date = parseInt(document.getElementById('edit-val-date').value) || item.date;
                    const monthSelect = document.getElementById('edit-val-month');
                    item.month = monthSelect.value;
                    item.monthIndex = parseInt(monthSelect.options[monthSelect.selectedIndex].getAttribute('data-index'));
                    item.year = parseInt(document.getElementById('edit-val-year').value) || item.year;

                    saveAndRefreshHistory();
                    closeEditModal();
                    showModal("Berhasil", "Tanggal dan waktu transaksi berhasil diperbarui.");
                };
            }

            modal.classList.remove('hidden');
        }

        function closeEditModal() {
            document.getElementById('edit-modal').classList.add('hidden');
        }

        function deleteHistoryItem(id) {
            const item = historyData.find(d => d.id === id);
            if (!item) return;

            const ok = confirm(`Hapus data History ${item.date} ${item.month} ${item.year} dengan ID #${item.id.toString().slice(-4)}?`);
            if (!ok) return;

            historyData = historyData.filter(d => d.id !== id);
            if (currentSessionUser && currentSessionUser.phone) {
                localStorage.setItem(`finance_history_desktop_${currentSessionUser.phone}`, JSON.stringify(historyData));
                window.__markDataPending?.('history',historyData);
                triggerDailyAutoBackup();
                window.__markDataPending?.('backup',backupOtomatisData);
                window.__requestDataCloudSync?.();
            }
            populateHistoryFilters();
            renderHistory();
            showModal("Berhasil", "Data History berhasil dihapus.");
        }

        function saveAndRefreshHistory() {
            if (currentSessionUser && currentSessionUser.phone) {
                localStorage.setItem(`finance_history_desktop_${currentSessionUser.phone}`, JSON.stringify(historyData));
                window.__markDataPending?.('history',historyData);
                triggerDailyAutoBackup();
                window.__markDataPending?.('backup',backupOtomatisData);
                window.__requestDataCloudSync?.();
            }
            renderHistory();
        }

        document.getElementById('pengeluaran-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const nama = document.getElementById('pengeluaran-nama').value.trim();
            const nominal = parseNum(document.getElementById('pengeluaran-nominal').value);

            const now = new Date();
            const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

            const newItem = {
                id: Date.now(),
                day: days[now.getDay()],
                date: now.getDate(),
                monthIndex: now.getMonth(),
                month: months[now.getMonth()],
                year: now.getFullYear(),
                time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                nama: nama,
                nominal: nominal
            };

            pengeluaranData.unshift(newItem);
            if (currentSessionUser && currentSessionUser.phone) {
                localStorage.setItem(`finance_pengeluaran_desktop_${currentSessionUser.phone}`, JSON.stringify(pengeluaranData));
                window.__markDataPending?.('pengeluaran',[newItem]);
                window.__requestDataCloudSync?.();
            }

            document.getElementById('pengeluaran-form').reset();
            populatePengeluaranFilters();
            renderPengeluaranGrid();
            if (typeof window.renderMobileAdminSummary === 'function') window.renderMobileAdminSummary();
            showModal("Berhasil", "Data pengeluaran berhasil disimpan.");
            setTimeout(() => { try { closeModal(); } catch (err) {} }, 1600);
        });

        document.getElementById('kasbon-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const nama = document.getElementById('kasbon-nama').value.trim();
            const produk = document.getElementById('kasbon-produk').value.trim();
            const harga = parseNum(document.getElementById('kasbon-harga').value);

            const now = new Date();
            const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

            const currentTimeMillis = now.getTime();
            const dayName = days[now.getDay()];
            const dateNum = now.getDate();
            const monthName = months[now.getMonth()];
            const yearNum = now.getFullYear();

            let targetGroup = kasbonData.find(group => {
                const sameName = group.namaPelanggan.trim().toLowerCase() === nama.toLowerCase();
                return sameName && !group.isLunas;
            });

            if (targetGroup) {
                targetGroup.items.push({ produk, harga });
                targetGroup.total += harga;
            } else {
                const newGroup = {
                    id: currentTimeMillis,
                    timestamp: currentTimeMillis,
                    day: dayName,
                    date: dateNum,
                    month: monthName,
                    year: yearNum,
                    time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                    namaPelanggan: nama,
                    items: [{ produk, harga }],
                    total: harga,
                    isLunas: false
                };
                kasbonData.unshift(newGroup);
            }

            if (currentSessionUser && currentSessionUser.phone) {
                localStorage.setItem(`finance_kasbon_desktop_${currentSessionUser.phone}`, JSON.stringify(kasbonData));
                window.__markDataPending?.('kasbon',kasbonData);
                window.__requestDataCloudSync?.();
            }

            document.getElementById('kasbon-form').reset();
            renderKasbonGrid();
            if (typeof window.renderMobileAdminSummary === 'function') window.renderMobileAdminSummary();
            showModal("Berhasil", "Data kasbon berhasil disimpan.");
            setTimeout(() => { try { closeModal(); } catch (err) {} }, 1600);
        });

        function toggleLunasKasbon(id) {
            const item = kasbonData.find(d => d.id === id);
            if(item) {
                item.isLunas = !item.isLunas;
                if (currentSessionUser && currentSessionUser.phone) {
                    localStorage.setItem(`finance_kasbon_desktop_${currentSessionUser.phone}`, JSON.stringify(kasbonData));
                }
                renderKasbonGrid();
            }
        }

        function editNamaPelangganKasbon(id) {
            const item = kasbonData.find(d => d.id === id);
            if (!item) return;

            const modal = document.getElementById('edit-modal');
            const modalTitle = document.getElementById('edit-modal-title');
            const modalBody = document.getElementById('edit-modal-body');
            const saveBtn = document.getElementById('save-edit-btn');

            modalTitle.innerText = "Ganti Nama Pelanggan";
            modalBody.innerHTML = `
                <div>
                    <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Nama Pelanggan Baru</label>
                    <input type="text" id="edit-val-nama-pelanggan" value="${item.namaPelanggan}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                </div>
            `;

            saveBtn.onclick = function() {
                const newName = document.getElementById('edit-val-nama-pelanggan').value.trim();
                if (!newName) return;

                item.namaPelanggan = newName;
                if (currentSessionUser && currentSessionUser.phone) {
                    localStorage.setItem(`finance_kasbon_desktop_${currentSessionUser.phone}`, JSON.stringify(kasbonData));
                }
                closeEditModal();
                renderKasbonGrid();
                showModal("Berhasil", "Nama pelanggan berhasil diperbarui.");
            };

            modal.classList.remove('hidden');
        }

        function populatePengeluaranFilters() {
            const dateSelect = document.getElementById('filter-pengeluaran-date');
            const monthSelect = document.getElementById('filter-pengeluaran-month');
            const yearSelect = document.getElementById('filter-pengeluaran-year');
            
            if(!dateSelect || !monthSelect || !yearSelect) return;

            const currentSelectedDate = dateSelect.value;
            const currentSelectedMonth = monthSelect.value;
            const currentSelectedYear = yearSelect.value;

            const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

            let datesHtml = '<option value="">Semua Tgl</option>';
            for(let i=1; i<=31; i++) {
                datesHtml += `<option value="${i}">${i}</option>`;
            }

            let monthsHtml = '<option value="">Semua Bln</option>';
            months.forEach(m => {
                monthsHtml += `<option value="${m}">${m}</option>`;
            });

            let yearsHtml = '<option value="">Semua Thn</option>';
            for(let y=2000; y<=2030; y++) {
                yearsHtml += `<option value="${y}">${y}</option>`;
            }

            dateSelect.innerHTML = datesHtml;
            monthSelect.innerHTML = monthsHtml;
            yearSelect.innerHTML = yearsHtml;

            dateSelect.value = currentSelectedDate;
            monthSelect.value = currentSelectedMonth;
            yearSelect.value = currentSelectedYear;
        }

        function renderPengeluaranGrid() {
            const container = document.getElementById('pengeluaran-grid');
            if (!container) return;

            const fDateEl = document.getElementById('filter-pengeluaran-date');
            const fMonthEl = document.getElementById('filter-pengeluaran-month');
            const fYearEl = document.getElementById('filter-pengeluaran-year');

            const fDate = fDateEl ? fDateEl.value : "";
            const fMonth = fMonthEl ? fMonthEl.value : "";
            const fYear = fYearEl ? fYearEl.value : "";

            let filtered = pengeluaranData.filter(item => {
                let matchDate = fDate === "" || item.date.toString() === fDate;
                let matchMonth = fMonth === "" || item.month === fMonth;
                let matchYear = fYear === "" || item.year.toString() === fYear;
                return matchDate && matchMonth && matchYear;
            });

            if (filtered.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full text-center py-12 bg-white rounded-2xl shadow-lg border border-dashed border-slate-200 text-slate-400">
                        <i class="fa-solid fa-receipt text-3xl mb-2 text-slate-300"></i>
                        <p class="text-xs font-medium">Belum ada riwayat pengeluaran yang sesuai filter.</p>
                    </div>`;
                return;
            }

            const groups = {};
            filtered.forEach(item => {
                const groupKey = `${item.day}, ${item.date} ${item.month} ${item.year}`;
                if (!groups[groupKey]) {
                    groups[groupKey] = [];
                }
                groups[groupKey].push(item);
            });

            container.innerHTML = Object.entries(groups).map(([dateHeader, items]) => {
                const totalNominalGroup = items.reduce((sum, curr) => sum + curr.nominal, 0);

                return `
                    <div class="bg-white p-6 rounded-2xl shadow-lg border border-slate-200/85 space-y-4">
                        <div class="border-b border-slate-100 pb-3 flex justify-between items-center">
                            <h3 class="font-bold text-slate-800 text-sm flex items-center gap-2">
                                <i class="fa-regular fa-calendar-days text-emerald-600"></i> ${dateHeader}
                            </h3>
                            <span class="text-[10px] bg-rose-50 text-rose-700 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Total: ${formatRupiah(totalNominalGroup)}</span>
                        </div>

                        <div class="space-y-3">
                            ${items.map(item => `
                                <div class="bg-slate-50/80 p-4 rounded-xl border border-slate-100 flex items-center justify-between gap-4">
                                    <div>
                                        <span class="text-[10px] text-slate-400 font-semibold block mb-0.5">Pukul ${item.time}</span>
                                        <h4 class="font-bold text-slate-800 text-sm">${item.nama}</h4>
                                    </div>
                                    <div class="text-right">
                                        <span class="text-xs text-slate-500 block mb-0.5">Nominal</span>
                                        <span class="text-sm font-extrabold text-rose-600">${formatRupiah(item.nominal)}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        }

        function renderKasbonGrid() {
            const container = document.getElementById('kasbon-grid');
            if (!container) return;

            const fStatusEl = document.getElementById('filter-kasbon-status');
            const fNamaEl = document.getElementById('filter-kasbon-nama');
            const fStatus = fStatusEl ? fStatusEl.value : "";
            const fNama = fNamaEl ? fNamaEl.value.trim().toLowerCase() : "";

            let filtered = kasbonData.filter(item => {
                let matchStatus = true;
                if (fStatus === "lunas") {
                    matchStatus = item.isLunas === true;
                } else if (fStatus === "belum_lunas") {
                    matchStatus = item.isLunas === false;
                }

                let matchNama = true;
                if (fNama !== "") {
                    matchNama = item.namaPelanggan.toLowerCase().includes(fNama);
                }

                return matchStatus && matchNama;
            });

            if (filtered.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full text-center py-12 bg-white rounded-2xl shadow-lg border border-dashed border-slate-200 text-slate-400">
                        <i class="fa-solid fa-book-bookmark text-3xl mb-2 text-slate-300"></i>
                        <p class="text-xs font-medium">Belum ada riwayat kasbon yang sesuai filter.</p>
                    </div>`;
                return;
            }

            container.innerHTML = filtered.map(group => {
                return `
                    <div class="bg-white p-5 md:p-6 rounded-2xl shadow-lg border border-slate-200/85 space-y-4 relative overflow-hidden">
                        <div class="border-b border-slate-100 pb-3 flex justify-between items-center">
                            <div>
                                <span class="text-[10px] text-slate-400 font-semibold block mb-0.5">${group.day}, ${group.date} ${group.month} ${group.year} - ${group.time}</span>
                                <h3 class="font-bold text-slate-800 text-base flex items-center gap-2">
                                    <i class="fa-solid fa-user text-emerald-600"></i> ${group.namaPelanggan}
                                </h3>
                            </div>
                            <span class="text-[11px] bg-emerald-50 text-emerald-700 font-bold px-3 py-1 rounded-full uppercase tracking-wider">Total: ${formatRupiah(group.total)}</span>
                        </div>

                        ${group.isLunas ? `
                            <div class="flex items-center">
                                <span class="text-xs font-black text-emerald-600 border-2 border-emerald-600 px-3 py-1 rounded-lg tracking-wider uppercase shadow-sm inline-block bg-emerald-50/80">
                                    <i class="fa-solid fa-check mr-1"></i> LUNAS
                                </span>
                            </div>
                        ` : ''}

                        <div class="space-y-2">
                            ${group.items.map(sub => `
                                <div class="bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex items-center justify-between gap-4">
                                    <div class="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                        <i class="fa-solid fa-box text-slate-400"></i> ${sub.produk}
                                    </div>
                                    <div class="text-right text-xs font-extrabold text-slate-800">
                                        ${formatRupiah(sub.harga)}
                                    </div>
                                </div>
                            `).join('')}
                        </div>

                        <!-- TOMBOL TOGGLE SUDAH BAYAR DAN GANTI NAMA (DIBUAT FLEX WRAP & AMAN DARI TABRAKAN SAAT SCROLL) -->
                        <div class="kasbon-action-row pt-2 flex flex-wrap items-center justify-end gap-2 relative z-10">
                            <button onclick="editNamaPelangganKasbon(${group.id})" class="px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200">
                                <i class="fa-solid fa-pen-to-square text-amber-500"></i> Ganti Nama
                            </button>
                            ${!group.isLunas ? `
                                <button onclick="toggleLunasKasbon(${group.id})" class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md bg-emerald-600 text-white hover:bg-emerald-700">
                                    <i class="fa-solid fa-check"></i> Sudah Bayar
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }

        document.getElementById('finance-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const income = parseNum(document.getElementById('income').value);
            const expense = parseNum(document.getElementById('expense').value);
            const cashout = parseNum(document.getElementById('cashout').value);
            const profitPercentage = parseFloat(document.getElementById('profit-percentage').value) || 0;
            
            const profit = (income - cashout) * (profitPercentage / 100);

            const now = new Date();
            const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

            const newEntry = {
                id: Date.now(),
                day: days[now.getDay()],
                date: now.getDate(),
                monthIndex: now.getMonth(),
                month: months[now.getMonth()],
                year: now.getFullYear(),
                time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                income: income,
                expense: expense,
                cashout: cashout,
                profitPercentage: profitPercentage,
                profit: profit > 0 ? profit : 0
            };

            historyData.unshift(newEntry);
            if (currentSessionUser && currentSessionUser.phone) {
                localStorage.setItem(`finance_history_desktop_${currentSessionUser.phone}`, JSON.stringify(historyData));
                window.__markDataPending?.('history',[newEntry]);
                triggerDailyAutoBackup(newEntry.id);
                window.__markDataPending?.('backup',backupOtomatisData);
                window.__requestDataCloudSync?.();
            }

            document.getElementById('finance-form').reset();
            document.getElementById('profit-percentage').value = "10";
            profitDisplay.innerText = "Rp 0";

            // PATCH FOKUS: setelah input tersimpan, semua tampilan turunan langsung diperbarui.
            populateHistoryFilters();
            renderHistory();
            populateReportFilters();
            renderReport();
            populateBackupFilters();
            renderBackupGrid();
            if (typeof window.renderMobileAdminSummary === 'function') window.renderMobileAdminSummary();
            showModal("Sukses Disimpan", "Data keuangan harian berhasil ditambahkan ke riwayat secara realtime.");
        });

        function populateHistoryFilters() {
            const dateSelect = document.getElementById('history-filter-date');
            const monthSelect = document.getElementById('history-filter-month');
            const yearSelect = document.getElementById('history-filter-year');
            
            if(!dateSelect || !monthSelect || !yearSelect) return;

            const currentSelectedDate = dateSelect.value;
            const currentSelectedMonth = monthSelect.value;
            const currentSelectedYear = yearSelect.value;

            const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

            let datesHtml = '<option value="">Semua Tgl</option>';
            for(let i=1; i<=31; i++) {
                datesHtml += `<option value="${i}">${i}</option>`;
            }

            let monthsHtml = '<option value="">Semua Bln</option>';
            months.forEach(m => {
                monthsHtml += `<option value="${m}">${m}</option>`;
            });

            let yearsHtml = '<option value="">Semua Thn</option>';
            for(let y=2000; y<=2030; y++) {
                yearsHtml += `<option value="${y}">${y}</option>`;
            }

            dateSelect.innerHTML = datesHtml;
            monthSelect.innerHTML = monthsHtml;
            yearSelect.innerHTML = yearsHtml;

            dateSelect.value = currentSelectedDate;
            monthSelect.value = currentSelectedMonth;
            yearSelect.value = currentSelectedYear;
        }

        // RENDER HISTORY DENGAN ICON (BEARISH, BULLISH, PROFIT)
        function renderHistory() {
            const container = document.getElementById('history-grid');
            if (!container) return;

            const searchEl = document.getElementById('history-filter-search');
            const fDateEl = document.getElementById('history-filter-date');
            const fMonthEl = document.getElementById('history-filter-month');
            const fYearEl = document.getElementById('history-filter-year');

            const fSearch = searchEl ? searchEl.value.trim().toLowerCase() : "";
            const fDate = fDateEl ? fDateEl.value : "";
            const fMonth = fMonthEl ? fMonthEl.value : "";
            const fYear = fYearEl ? fYearEl.value : "";

            // Pastikan profit History selalu mengikuti rumus pada Form Input Data Harian.
            historyData.forEach(item => {
                const income = Number(item.income) || 0;
                const cashout = Number(item.cashout) || 0;
                const pct = item.profitPercentage !== undefined ? (parseFloat(item.profitPercentage) || 0) : 10;
                item.profitPercentage = pct;
                item.profit = Math.max((income - cashout) * (pct / 100), 0);
            });

            let filtered = historyData.filter(item => {
                const text = `${item.day || ''} ${item.date || ''} ${item.month || ''} ${item.year || ''}`.toLowerCase();
                let matchSearch = !fSearch || text.includes(fSearch);
                let matchDate = fDate === "" || item.date.toString() === fDate;
                let matchMonth = fMonth === "" || item.month === fMonth;
                let matchYear = fYear === "" || item.year.toString() === fYear;
                return matchSearch && matchDate && matchMonth && matchYear;
            });

            // Satu-satunya aturan urutan History: input terbaru selalu di posisi paling atas.
            // Data baru disimpan dengan ID Date.now(), sehingga ID terbesar adalah input terbaru.
            filtered.sort((a, b) => Number(b.id) - Number(a.id));

            if (filtered.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full text-center py-16 bg-white rounded-2xl shadow-lg border border-dashed border-slate-200 text-slate-400">
                        <i class="fa-solid fa-clock-rotate-left text-4xl mb-3 text-slate-300"></i>
                        <p class="text-sm font-medium">Belum ada riwayat transaksi yang tercatat.</p>
                    </div>`;
                return;
            }

            container.innerHTML = filtered.map(item => {
                return `
                    <div class="w-full max-w-[1100px] bg-white p-6 rounded-2xl shadow-lg border border-slate-200/85 space-y-4 relative">
                        <div class="border-b border-slate-100 pb-3 flex justify-between items-center">
                            <div>
                                <span class="text-[10px] text-slate-400 font-semibold block mb-0.5">ID: #${item.id.toString().slice(-4)} • Pukul ${item.time}</span>
                                <h3 class="font-bold text-slate-800 text-base flex items-center gap-2">
                                    <i class="fa-regular fa-calendar-days text-emerald-600"></i> ${item.day}, ${item.date} ${item.month} ${item.year}
                                </h3>
                            </div>
                            <div class="relative toggle-edit-container">
                                <button onclick="toggleEditMenu(${item.id})" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5">
                                    <i class="fa-solid fa-pen-to-square text-emerald-600"></i> Edit
                                </button>
                                <div id="edit-menu-${item.id}" class="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 hidden z-30">
                                    <button onclick="openEditSubMenu(${item.id}, 'nominal')" class="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2">
                                        <i class="fa-solid fa-coins text-emerald-600 w-4"></i> Edit Nominal
                                    </button>
                                    <button onclick="openEditSubMenu(${item.id}, 'datetime')" class="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2">
                                        <i class="fa-solid fa-calendar text-blue-600 w-4"></i> Edit Tanggal & Waktu
                                    </button>
                                    <button onclick="deleteHistoryItem(${item.id})" class="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-2">
                                        <i class="fa-solid fa-trash text-rose-600 w-4"></i> Hapus
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <!-- Bullish / Pendapatan Naik -->
                            <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div class="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold mb-1">
                                    <i class="fa-solid fa-arrow-trend-up text-emerald-600"></i> Pendapatan
                                </div>
                                <div class="text-sm font-extrabold text-emerald-600">${formatRupiah(item.income)}</div>
                            </div>
                            <!-- Belanja -->
                            <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div class="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold mb-1">
                                    <i class="fa-solid fa-bag-shopping text-blue-600"></i> Total Belanja
                                </div>
                                <div class="text-sm font-extrabold text-slate-800">${formatRupiah(item.expense || 0)}</div>
                            </div>
                            <!-- Bearish / Pengeluaran Turun -->
                            <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div class="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold mb-1">
                                    <i class="fa-solid fa-arrow-trend-down text-rose-600"></i> Pengeluaran
                                </div>
                                <div class="text-sm font-extrabold text-rose-600">${formatRupiah(item.cashout || 0)}</div>
                            </div>
                            <!-- Profit Keuntungan -->
                            <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div class="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold mb-1">
                                    <i class="fa-solid fa-wallet text-amber-600"></i> Profit/Keuntungan (${item.profitPercentage !== undefined ? item.profitPercentage : 10}%)
                                </div>
                                <div class="text-sm font-extrabold text-amber-600">${formatRupiah(item.profit || 0)}</div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function populateReportFilters() {
            const dateSelect = document.getElementById('filter-report-date');
            const monthSelect = document.getElementById('filter-report-month');
            const yearSelect = document.getElementById('filter-report-year');
            
            if(!dateSelect || !monthSelect || !yearSelect) return;

            const currentSelectedDate = dateSelect.value;
            const currentSelectedMonth = monthSelect.value;
            const currentSelectedYear = yearSelect.value;

            const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

            let datesHtml = '<option value="">Semua Tgl (1-31)</option>';
            for(let i=1; i<=31; i++) {
                datesHtml += `<option value="${i}">${i}</option>`;
            }

            let monthsHtml = '<option value="">Semua Bln</option>';
            months.forEach(m => {
                monthsHtml += `<option value="${m}">${m}</option>`;
            });

            let yearsHtml = '<option value="">Semua Thn</option>';
            for(let y=2000; y<=2030; y++) {
                yearsHtml += `<option value="${y}">${y}</option>`;
            }

            dateSelect.innerHTML = datesHtml;
            monthSelect.innerHTML = monthsHtml;
            yearSelect.innerHTML = yearsHtml;

            dateSelect.value = currentSelectedDate;
            monthSelect.value = currentSelectedMonth;
            yearSelect.value = currentSelectedYear;
        }

        // RENDER LAPORAN PER BULAN & TAHUN.
        // Default: semua kombinasi Bulan + Tahun yang tersedia di History.
        // Jika filter tanggal/bulan/tahun dipilih, data tetap diringkas sesuai filter aktif.
        function renderReport() {
            const container = document.getElementById('report-grid');
            if (!container) return;

            const fDateEl = document.getElementById('filter-report-date');
            const fMonthEl = document.getElementById('filter-report-month');
            const fYearEl = document.getElementById('filter-report-year');

            const fDate = fDateEl ? fDateEl.value : "";
            const fMonth = fMonthEl ? fMonthEl.value : "";
            const fYear = fYearEl ? fYearEl.value : "";

            let filtered = historyData.filter(item => {
                let matchDate = fDate === "" || item.date.toString() === fDate;
                let matchMonth = fMonth === "" || item.month === fMonth;
                let matchYear = fYear === "" || item.year.toString() === fYear;
                return matchDate && matchMonth && matchYear;
            });

            if (filtered.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full text-center py-16 bg-white rounded-2xl shadow-lg border border-dashed border-slate-200 text-slate-400">
                        <i class="fa-solid fa-chart-pie text-4xl mb-3 text-slate-300"></i>
                        <p class="text-sm font-medium">Belum ada data laporan yang dapat direkap.</p>
                    </div>`;
                return;
            }

            const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

            // Kelompokkan berdasarkan Bulan + Tahun.
            const groups = {};
            filtered.forEach(item => {
                const monthIndex = Number.isInteger(item.monthIndex)
                    ? item.monthIndex
                    : months.indexOf(item.month);
                const monthName = item.month || months[monthIndex] || '';
                const year = item.year;
                const key = `${year}-${String(monthIndex >= 0 ? monthIndex : 99).padStart(2, '0')}`;

                if (!groups[key]) {
                    groups[key] = {
                        monthIndex,
                        month: monthName,
                        year,
                        items: []
                    };
                }
                groups[key].items.push(item);
            });

            const sortedGroups = Object.values(groups).sort((a, b) => {
                const yearA = Number(a.year) || 0;
                const yearB = Number(b.year) || 0;
                if (yearA !== yearB) return yearB - yearA;
                return (b.monthIndex ?? 99) - (a.monthIndex ?? 99);
            });

            container.innerHTML = sortedGroups.map(group => {
                const items = group.items;
                const totalIncome = items.reduce((s, i) => s + (Number(i.income) || 0), 0);
                const totalExpense = items.reduce((s, i) => s + (Number(i.expense) || 0), 0);
                const totalCashout = items.reduce((s, i) => s + (Number(i.cashout) || 0), 0);
                const totalProfit = items.reduce((s, i) => s + (Number(i.profit) || 0), 0);

                const safeMonth = String(group.month).replace(/'/g, "\\'");
                const safeYear = String(group.year).replace(/'/g, "\\'");

                return `
                    <div class="bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-slate-200/85 space-y-6">
                        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
                            <div>
                                <h3 class="font-bold text-slate-800 text-base">Rekap ${group.month} ${group.year}</h3>
                                <p class="text-xs text-slate-400 mt-0.5">Rekap berdasarkan data History pada ${group.month} ${group.year}${fDate ? `, tanggal ${fDate}` : ''}</p>
                            </div>
                            <button onclick="openPdfModal('${fDate}', '${safeMonth}', '${safeYear}')" class="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer">
                                <i class="fa-solid fa-file-pdf"></i> View di PDF
                            </button>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                <div>
                                    <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
                                        <i class="fa-solid fa-arrow-trend-up text-emerald-600 text-base"></i> Total Pendapatan
                                    </div>
                                    <div class="text-lg font-extrabold text-emerald-600">${formatRupiah(totalIncome)}</div>
                                </div>
                                <span class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                                    <i class="fa-solid fa-wallet"></i>
                                </span>
                            </div>

                            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                <div>
                                    <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
                                        <i class="fa-solid fa-bag-shopping text-blue-600 text-base"></i> Total Belanja
                                    </div>
                                    <div class="text-lg font-extrabold text-slate-800">${formatRupiah(totalExpense)}</div>
                                </div>
                                <span class="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                                    <i class="fa-solid fa-cart-shopping"></i>
                                </span>
                            </div>

                            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                <div>
                                    <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
                                        <i class="fa-solid fa-arrow-trend-down text-rose-600 text-base"></i> Total Pengeluaran
                                    </div>
                                    <div class="text-lg font-extrabold text-rose-600">${formatRupiah(totalCashout)}</div>
                                </div>
                                <span class="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                                    <i class="fa-solid fa-receipt"></i>
                                </span>
                            </div>

                            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                <div>
                                    <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
                                        <i class="fa-solid fa-sack-dollar text-amber-600 text-base"></i> Total Keuntungan Bersih
                                    </div>
                                    <div class="text-lg font-extrabold text-amber-600">${formatRupiah(totalProfit)}</div>
                                </div>
                                <span class="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
                                    <i class="fa-solid fa-chart-line"></i>
                                </span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // FUNGSI MODAL VIEW PDF DENGAN DATA HISTORY TANGGAL 1-31
        function openPdfModal(fDate, fMonth, fYear) {
            const modal = document.getElementById('pdf-modal');
            const contentBody = document.getElementById('pdf-content-body');

            let filtered = historyData.filter(item => {
                let matchDate = fDate === "" || item.date.toString() === fDate;
                let matchMonth = fMonth === "" || item.month === fMonth;
                let matchYear = fYear === "" || item.year.toString() === fYear;
                return matchDate && matchMonth && matchYear;
            });

            const totalIncome = filtered.reduce((s, i) => s + i.income, 0);
            const totalExpense = filtered.reduce((s, i) => s + (i.expense || 0), 0);
            const totalCashout = filtered.reduce((s, i) => s + (i.cashout || 0), 0);
            const totalProfit = filtered.reduce((s, i) => s + (i.profit || 0), 0);

            contentBody.innerHTML = `
                <div class="bg-white p-6 rounded-2xl shadow border border-slate-200 space-y-6">
                    <div class="text-center border-b pb-4">
                        <h2 class="font-extrabold text-slate-800 text-lg">LAPORAN KEUANGAN REKAPINYU</h2>
                        <p class="text-xs text-slate-500 mt-1">Data History Dari Tanggal 1 s/d 31</p>
                        <p class="text-[11px] text-slate-400 mt-0.5">Data Realtime: ${fMonth || 'Semua Bulan'}, ${fYear || 'Semua Tahun'}</p>
                    </div>

                    <!-- Ringkasan Total -->
                    <div class="grid grid-cols-2 gap-3 text-xs">
                        <div class="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                            <span class="text-emerald-700 font-semibold block">Total Pendapatan:</span>
                            <span class="font-bold text-emerald-800 text-sm">${formatRupiah(totalIncome)}</span>
                        </div>
                        <div class="p-3 bg-blue-50 rounded-xl border border-blue-100">
                            <span class="text-blue-700 font-semibold block">Total Belanja:</span>
                            <span class="font-bold text-blue-800 text-sm">${formatRupiah(totalExpense)}</span>
                        </div>
                        <div class="p-3 bg-rose-50 rounded-xl border border-rose-100">
                            <span class="text-rose-700 font-semibold block">Total Pengeluaran:</span>
                            <span class="font-bold text-rose-800 text-sm">${formatRupiah(totalCashout)}</span>
                        </div>
                        <div class="p-3 bg-amber-50 rounded-xl border border-amber-100">
                            <span class="text-amber-700 font-semibold block">Total Profit:</span>
                            <span class="font-bold text-amber-800 text-sm">${formatRupiah(totalProfit)}</span>
                        </div>
                    </div>

                    <!-- Tabel Rincian Data History Tanggal 1-31 -->
                    <div>
                        <h4 class="font-bold text-slate-800 text-xs uppercase tracking-wide mb-3">Rincian Data History Harian</h4>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr class="bg-slate-100 text-slate-600 border-b">
                                        <th class="p-2.5 font-bold">Tanggal</th>
                                        <th class="p-2.5 font-bold">Pendapatan</th>
                                        <th class="p-2.5 font-bold">Belanja</th>
                                        <th class="p-2.5 font-bold">Pengeluaran</th>
                                        <th class="p-2.5 font-bold">Profit</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                    ${filtered.map(item => `
                                        <tr>
                                            <td class="p-2.5 font-medium text-slate-700">${item.date} ${item.month} ${item.year}</td>
                                            <td class="p-2.5 text-emerald-600 font-semibold">${formatRupiah(item.income)}</td>
                                            <td class="p-2.5 text-slate-800 font-semibold">${formatRupiah(item.expense || 0)}</td>
                                            <td class="p-2.5 text-rose-600 font-semibold">${formatRupiah(item.cashout || 0)}</td>
                                            <td class="p-2.5 text-amber-600 font-semibold">${formatRupiah(item.profit || 0)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            modal.classList.remove('hidden');
        }

        function closePdfModal() {
            document.getElementById('pdf-modal').classList.add('hidden');
        }

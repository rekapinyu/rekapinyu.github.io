(function(){
  let kasirProducts=[];
  let kasirCart=[];
  let kasirTransactions=[];

  function kasirUserKey(name){
    const phone=(typeof currentSessionUser!=='undefined' && currentSessionUser && currentSessionUser.phone) ? currentSessionUser.phone : 'guest';
    return 'finance_kasir_'+name+'_'+phone;
  }
  function loadKasirStore(){
    try{kasirProducts=JSON.parse(localStorage.getItem(kasirUserKey('products'))||'[]');if(!Array.isArray(kasirProducts))kasirProducts=[]}catch(e){kasirProducts=[]}
    try{kasirTransactions=JSON.parse(localStorage.getItem(kasirUserKey('transactions'))||'[]');if(!Array.isArray(kasirTransactions))kasirTransactions=[]}catch(e){kasirTransactions=[]}
  }
  function saveKasirStore(){
    localStorage.setItem(kasirUserKey('products'),JSON.stringify(kasirProducts));
    localStorage.setItem(kasirUserKey('transactions'),JSON.stringify(kasirTransactions));
    try{window.__rekapinyuSaveCloudData?.();}catch(e){}
  }
  function rupiah(n){return 'Rp '+(Number(n)||0).toLocaleString('id-ID')}
  function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

  function productBarcodes(p){const arr=Array.isArray(p?.barcodes)?p.barcodes:(p?.barcode?[String(p.barcode)]:[]);return [...new Set(arr.map(v=>String(v||'').trim()).filter(Boolean))]}
  function findKasirProductByBarcode(value){const q=String(value||'').trim().toLowerCase();if(!q)return null;return kasirProducts.find(p=>productBarcodes(p).some(b=>b.toLowerCase()===q))||null}
  function productSearchText(p){return `${p.name||''} ${p.category||''} ${productBarcodes(p).join(' ')}`.toLowerCase()}
  function renderKasirProducts(){
    const grid=document.getElementById('kasir-product-grid'); if(!grid)return;
    const search=(document.getElementById('kasir-search')?.value||'').trim().toLowerCase();
    const list=kasirProducts.filter(p=>{const q=!search||productSearchText(p).includes(search);return q});
    if(!list.length){grid.innerHTML='<div class="kasir-empty"><i class="fa-solid fa-box-open"></i><strong>Belum ada produk</strong><span>Belum ada produk yang tersedia untuk kasir.</span></div>';return}
    grid.innerHTML=list.map(p=>{const profit=(Number(p.price)||0)-(Number(p.cost??p.grosir)||0);return `<button type="button" class="kasir-product-card" data-add-product="${p.id}"><div class="kasir-product-photo">${p.photo?`<img src="${esc(p.photo)}" alt="${esc(p.name)}">`:'<i class="fa-solid fa-image"></i>'}</div><div class="kasir-product-info"><strong>${esc(p.name)}</strong><div class="kasir-product-stats"><div class="kasir-product-stat"><span>Harga HPP</span><strong>${rupiah(p.cost??p.grosir)}</strong></div><div class="kasir-product-stat"><span>Profit</span><strong>${rupiah(profit)}</strong></div></div><span class="kasir-product-sale">${rupiah(p.price)}</span></div></button>`}).join('');
  }

  function renderCart(){
    const list=document.getElementById('kasir-cart-list'); if(!list)return;
    const count=kasirCart.reduce((a,x)=>a+x.qty,0); const total=kasirCart.reduce((a,x)=>a+x.qty*x.price,0);
    document.getElementById('kasir-cart-count').textContent=count+' Item';
    document.getElementById('kasir-total-products').textContent=rupiah(total);
    if(!kasirCart.length){list.innerHTML='<div class="kasir-cart-empty"><i class="fa-solid fa-cart-shopping"></i><strong>Keranjang masih kosong</strong><span>Tambahkan produk dari kotak sebelah kiri.</span></div>'}
    else list.innerHTML=kasirCart.map(x=>`<div class="kasir-cart-item" data-kasir-cart-item>${x.photo?`<img class="kasir-cart-thumb" src="${x.photo}" alt="">`:`<div class="kasir-cart-thumb"></div>`}<div><strong>${esc(x.name)}</strong><small>${rupiah(x.price)} × ${x.qty} = ${rupiah(x.price*x.qty)}</small></div><div class="kasir-qty"><button type="button" data-cart-dec="${x.id}">−</button><span>${x.qty}</span><button type="button" data-cart-inc="${x.id}">+</button></div></div>`).join('');
    updateChange();
  }
  function updateChange(){
    const total=kasirCart.reduce((a,x)=>a+x.qty*x.price,0); const paid=Number((document.getElementById('kasir-payment')?.value||'').replace(/[^0-9]/g,''))||0;
    const el=document.getElementById('kasir-change'); if(el)el.textContent=rupiah(Math.max(0,paid-total));
  }
  function renderTransactions(){
    const count=document.getElementById('kasir-transaction-count'), list=document.getElementById('kasir-transaction-list');
    const omzet=kasirTransactions.reduce((a,t)=>a+(Number(t.total)||0),0), paid=kasirTransactions.reduce((a,t)=>a+(Number(t.paid)||0),0);
    if(count)count.textContent=kasirTransactions.length+' transaksi';
    const o=document.getElementById('kasir-stat-omzet'),p=document.getElementById('kasir-stat-paid'),c=document.getElementById('kasir-stat-count');
    if(o)o.textContent=rupiah(omzet); if(p)p.textContent=rupiah(paid); if(c)c.textContent=kasirTransactions.length;

    if(!list)return;
    if(!kasirTransactions.length){
      list.innerHTML='<div class="kasir-empty" style="min-height:90px"><span>Belum ada transaksi kasir.</span></div>';
      return;
    }

    const months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const days=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

    function getTransactionDate(t){
      const n=Number(t.id);
      if(Number.isFinite(n) && n>0){
        const d=new Date(n);
        if(!Number.isNaN(d.getTime()))return d;
      }
      const text=String(t.date||'').trim();
      const m=text.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
      if(m){
        let y=Number(m[3]); if(y<100)y+=2000;
        const d=new Date(y,Number(m[2])-1,Number(m[1]));
        if(!Number.isNaN(d.getTime()))return d;
      }
      return new Date(0);
    }

    const groups={};
    kasirTransactions.forEach(t=>{
      const d=getTransactionDate(t);
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if(!groups[key])groups[key]={date:d,items:[]};
      groups[key].items.push(t);
    });

    const ordered=Object.values(groups).sort((a,b)=>b.date-a.date);
    list.innerHTML=`<div class="kasir-daily-grid">${ordered.map(g=>{
      g.items.sort((a,b)=>(Number(b.id)||0)-(Number(a.id)||0));
      const dayTotal=g.items.reduce((sum,t)=>sum+(Number(t.total)||0),0);
      const dayItems=g.items.reduce((sum,t)=>sum+(Number(t.items)||0),0);
      return `<div class="kasir-daily-card">
        <div class="kasir-daily-head">
          <div>
            <strong>${days[g.date.getDay()]}, ${g.date.getDate()} ${months[g.date.getMonth()]} ${g.date.getFullYear()}</strong>
            <span>${g.items.length} transaksi • ${dayItems} item</span>
          </div>
          <b>${rupiah(dayTotal)}</b>
        </div>
        <div class="kasir-daily-rows">
          ${g.items.map(t=>{
            const text=String(t.date||'');
            const tm=text.match(/(\d{1,2}[:.]\d{2}(?:[:.]\d{2})?)/);
            const time=tm?tm[1]:'';
            return `<div class="kasir-daily-row"><span>${time?esc(time):'Transaksi'} • ${Number(t.items)||0} item</span><strong>${rupiah(t.total)}</strong><button type="button" class="kasir-transaction-delete-toggle" data-delete-transaction="${t.id}" title="Hapus transaksi" aria-label="Hapus transaksi"><i class="fa-solid fa-trash-can"></i></button></div>`;
          }).join('')}
        </div>
      </div>`;
    }).join('')}</div>`;
  }

  function addKasirProductToCart(p){
    const id=String(p.id);
    const index=kasirCart.findIndex(x=>String(x.id)===id);
    if(index!==-1){
      const x=kasirCart.splice(index,1)[0];
      x.qty++;
      kasirCart.unshift(x);
    }else{
      kasirCart.unshift({...p,qty:1});
    }
  }
function initKasirViews(){
    loadKasirStore(); kasirProducts=kasirProducts.map(p=>({...p,barcodes:productBarcodes(p),barcode:productBarcodes(p)[0]||''})); renderKasirProducts(); renderCart(); renderTransactions();
  }

  function saveKasirTransaction(paymentData){
    const total=kasirCart.reduce((a,x)=>a+x.qty*x.price,0);
    const discount=Math.max(0,Number(String(paymentData?.discount||'').replace(/[^0-9]/g,''))||0);
    const paid=Math.max(0,Number(String(paymentData?.paid||'').replace(/[^0-9]/g,''))||0);
    const finalTotal=Math.max(0,total-discount);
    if(!kasirCart.length){showModal('Gagal','Keranjang masih kosong.','fa-solid fa-circle-exclamation text-rose-600');return false}
    if(paid<finalTotal){showModal('Gagal','Uang diterima masih kurang.','fa-solid fa-circle-exclamation text-rose-600');return false}
    kasirTransactions.push({id:Date.now(),date:new Date().toLocaleString('id-ID'),items:kasirCart.reduce((a,x)=>a+x.qty,0),total:finalTotal,paid,change:paid-finalTotal,discount,itemsDetail:kasirCart.map(x=>({id:String(x.id),name:String(x.name||''),qty:Number(x.qty)||1,price:Number(x.price)||0,cost:Number(x.cost??x.grosir)||0,photo:String(x.photo||'')}))});
    saveKasirStore();
    kasirCart=[];
    renderCart(); renderTransactions(); try{window.__renderLaporanKasir?.()}catch(e){}
    return true;
  }

  /* KEMBALIAN KASIR — SATU IMPLEMENTASI BARU, SATU SUMBER PERHITUNGAN */
  function updateKasirPaymentSummary(){
    const total=kasirCart.reduce((sum,item)=>sum+(Number(item.qty)||0)*(Number(item.price)||0),0);
    const discount=Math.min(total,Number(String(document.getElementById('kasir-popup-discount')?.value||'').replace(/\D/g,''))||0);
    const paid=Number(String(document.getElementById('kasir-popup-paid')?.value||'').replace(/\D/g,''))||0;
    const finalTotal=Math.max(0,total-discount);
    const change=Math.max(0,paid-finalTotal);
    const totalEl=document.getElementById('kasir-popup-total');
    const changeEl=document.getElementById('kasir-popup-change');
    if(totalEl)totalEl.textContent=rupiah(finalTotal);
    if(changeEl)changeEl.textContent=rupiah(change);
    return {total,discount,paid,finalTotal,change};
  }
  document.addEventListener('input',e=>{
    const id=e.target?.id;
    if(id!=='kasir-popup-paid'&&id!=='kasir-popup-discount')return;
    updateKasirPaymentSummary();
    renderKasirReceiptPreview();
  });
  /* KASIR BLUETOOTH — IMPLEMENTASI TUNGGAL. Implementasi lama dihapus seluruhnya. */
  const kasirBluetooth={device:null,characteristic:null,connecting:false};
  const kasirBluetoothServices=[
    '0000ffe0-0000-1000-8000-00805f9b34fb',
    '0000ffe5-0000-1000-8000-00805f9b34fb',
    '0000fff0-0000-1000-8000-00805f9b34fb',
    '000018f0-0000-1000-8000-00805f9b34fb',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    '49535343-8841-43f4-a8d4-ecbe34729bb3',
    '0000ae30-0000-1000-8000-00805f9b34fb'
  ];

  function updateKasirBluetoothUi(state='disconnected',message='Koneksi Bluetooth terputus'){
    const button=document.getElementById('kasir-refresh-btn');
    const status=document.getElementById('kasir-payment-bluetooth-status');
    const printButton=document.getElementById('kasir-save-print-btn');
    const connected=state==='connected';
    const connecting=state==='connecting';
    if(button){
      button.classList.toggle('is-bluetooth-connected',connected);
      button.classList.toggle('is-bluetooth-connecting',connecting);
      button.style.color=connected?'#16a34a':connecting?'#2563eb':'#dc2626';
      button.title=connected?'Printer Bluetooth tersambung':'Hubungkan printer Bluetooth';
      button.setAttribute('aria-label',button.title);
      const icon=button.querySelector('i');
      if(icon)icon.className='fa-brands fa-bluetooth-b';
    }
    if(status){
      status.classList.toggle('is-connected',connected);
      status.classList.toggle('is-connecting',connecting);
      status.innerHTML=`<i class="fa-brands fa-bluetooth-b"></i><span>${esc(message)}</span>`;
    }
    if(printButton){
      printButton.disabled=!connected;
      printButton.title=connected?'Simpan transaksi dan cetak melalui printer Bluetooth':'Sambungkan printer Bluetooth terlebih dahulu';
    }
  }

  function kasirBluetoothDisconnect(){
    const device=kasirBluetooth.device;
    kasirBluetooth.characteristic=null;
    kasirBluetooth.device=null;
    try{if(device?.gatt?.connected)device.gatt.disconnect()}catch(e){}
    updateKasirBluetoothUi('disconnected','Koneksi Bluetooth terputus');
  }

  async function findKasirBluetoothCharacteristic(server){
    const services=[];
    try{
      const exposed=await server.getPrimaryServices();
      exposed.forEach(service=>services.push(service));
    }catch(e){}
    for(const uuid of kasirBluetoothServices){
      if(services.some(service=>service.uuid===uuid))continue;
      try{services.push(await server.getPrimaryService(uuid))}catch(e){}
    }
    for(const service of services){
      try{
        const chars=await service.getCharacteristics();
        const writable=chars.find(c=>c.properties?.writeWithoutResponse||c.properties?.write);
        if(writable)return writable;
      }catch(e){}
    }
    return null;
  }

  async function connectKasirBluetoothPrinter(){
    if(kasirBluetooth.connecting)return;
    if(!navigator.bluetooth){
      showModal('Bluetooth Tidak Didukung','Browser ini tidak mendukung Web Bluetooth. Gunakan Chrome atau Edge pada perangkat yang mendukung Bluetooth.','fa-brands fa-bluetooth-b text-rose-600');
      return;
    }
    kasirBluetooth.connecting=true;
    updateKasirBluetoothUi('connecting','Mencari printer Bluetooth...');
    try{
      if(kasirBluetooth.device?.gatt?.connected)kasirBluetooth.device.gatt.disconnect();
      const device=await navigator.bluetooth.requestDevice({
        acceptAllDevices:true,
        optionalServices:kasirBluetoothServices
      });
      kasirBluetooth.device=device;
      device.addEventListener('gattserverdisconnected',()=>{
        kasirBluetooth.characteristic=null;
        updateKasirBluetoothUi('disconnected','Koneksi Bluetooth terputus');
      },{once:false});
      if(!device.gatt)throw new Error('Perangkat Bluetooth tidak menyediakan koneksi GATT.');
      const server=await device.gatt.connect();
      const characteristic=await findKasirBluetoothCharacteristic(server);
      if(!characteristic){
        kasirBluetooth.characteristic=null;
        updateKasirBluetoothUi('connected','Printer Bluetooth tersambung');
        showModal('Bluetooth Tersambung','Printer sudah tersambung, tetapi layanan cetak Bluetooth tidak tersedia melalui Web Bluetooth pada perangkat ini.','fa-brands fa-bluetooth-b text-amber-500');
        return;
      }
      kasirBluetooth.characteristic=characteristic;
      updateKasirBluetoothUi('connected','Printer Bluetooth tersambung');
      showModal('Berhasil','Printer Bluetooth tersambung dan siap mencetak.','fa-brands fa-bluetooth-b text-emerald-600');
    }catch(err){
      kasirBluetooth.characteristic=null;
      kasirBluetooth.device=null;
      updateKasirBluetoothUi('disconnected','Koneksi Bluetooth terputus');
      if(err?.name!=='NotFoundError'){
        showModal('Bluetooth Gagal',err?.message||'Printer Bluetooth tidak dapat disambungkan.','fa-brands fa-bluetooth-b text-rose-600');
      }
    }finally{
      kasirBluetooth.connecting=false;
      if(kasirBluetooth.device?.gatt?.connected)updateKasirBluetoothUi(kasirBluetooth.characteristic?'connected':'connected','Printer Bluetooth tersambung');
    }
  }

  function kasirReceiptInvoiceKey(){
    const phone=(typeof currentSessionUser!=='undefined' && currentSessionUser && currentSessionUser.phone) ? currentSessionUser.phone : 'guest';
    return 'finance_kasir_invoice_counter_'+phone;
  }
  function getKasirReceiptInvoiceId(){
    const current=Number(localStorage.getItem(kasirReceiptInvoiceKey())||'0')||0;
    return `INV${String(current+1).padStart(2,'0')}`;
  }
  function commitKasirReceiptInvoiceId(){
    const current=Number(localStorage.getItem(kasirReceiptInvoiceKey())||'0')||0;
    localStorage.setItem(kasirReceiptInvoiceKey(),String(current+1));
  }
  function kasirReceiptSettingsKey(){
    const phone=(typeof currentSessionUser!=='undefined' && currentSessionUser && currentSessionUser.phone) ? String(currentSessionUser.phone).replace(/\D/g,'') : 'guest';
    return `finance_kasir_receipt_settings_${phone||'guest'}`;
  }
  function getKasirReceiptSettings(){
    const user=(typeof currentSessionUser!=='undefined' && currentSessionUser) ? currentSessionUser : {};
    const defaults={
      name:String(user.shopName||user.storeName||user.tokoName||user.name||'').trim(),
      address:String(user.shopAddress||user.address||user.alamat||'').trim(),
      phone:String(user.phone||'').trim(),
      footer:'Keterangan'
    };
    try{
      const saved=JSON.parse(localStorage.getItem(kasirReceiptSettingsKey())||'null');
      if(saved&&typeof saved==='object')return {
        name:String(saved.name??defaults.name).trim(),
        address:String(saved.address??defaults.address).trim(),
        phone:String(saved.phone??defaults.phone).trim(),
        footer:String(saved.footer??defaults.footer).trim()
      };
    }catch(e){}
    return defaults;
  }
  function loadKasirReceiptSettings(){
    const settings=getKasirReceiptSettings();
    const name=document.getElementById('receipt-setting-store-name');
    const address=document.getElementById('receipt-setting-store-address');
    const phone=document.getElementById('receipt-setting-store-phone');
    const footer=document.getElementById('receipt-setting-footer');
    if(name)name.value=settings.name;
    if(address)address.value=settings.address;
    if(phone)phone.value=settings.phone;
    if(footer)footer.value=settings.footer;
  }
  function saveKasirReceiptSettings(){
    const settings={
      name:String(document.getElementById('receipt-setting-store-name')?.value||'').trim(),
      address:String(document.getElementById('receipt-setting-store-address')?.value||'').trim(),
      phone:String(document.getElementById('receipt-setting-store-phone')?.value||'').trim(),
      footer:String(document.getElementById('receipt-setting-footer')?.value||'').trim()
    };
    localStorage.setItem(kasirReceiptSettingsKey(),JSON.stringify(settings));
    return settings;
  }
  function getKasirReceiptStoreInfo(){
    const settings=getKasirReceiptSettings();
    return {name:settings.name||'TOKO',address:settings.address||'-',phone:settings.phone||'-',footer:settings.footer||'Keterangan'};
  }
  function getKasirReceiptDate(){
    const now=new Date();
    const days=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const date=`${days[now.getDay()]}, ${String(now.getDate()).padStart(2,'0')} ${months[now.getMonth()]} ${now.getFullYear()}`;
    const time=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    return `${date}, ${time}`;
  }
  function buildKasirEscPosReceipt(){
    const total=kasirCart.reduce((a,x)=>a+x.qty*x.price,0);
    const discount=Math.min(total,Number(String(document.getElementById('kasir-popup-discount')?.value||'').replace(/[^0-9]/g,''))||0);
    const paid=Number(String(document.getElementById('kasir-popup-paid')?.value||'').replace(/[^0-9]/g,''))||0;
    const finalTotal=Math.max(0,total-discount);
    const change=Math.max(0,paid-finalTotal);
    const info=getKasirReceiptStoreInfo();
    const invoiceId=window.__kasirCurrentInvoiceId||getKasirReceiptInvoiceId();
    const clean=v=>String(v??'').replace(/[^\x20-\x7E\n]/g,'');
    const line=(left,right,width=32)=>{left=clean(left);right=clean(right);const spaces=Math.max(1,width-left.length-right.length);return left+' '.repeat(spaces)+right};
    const separator='--------------------------------\n';
    let out='\x1B\x40';
    out+='\x1B\x61\x01';
    out+='\x1B\x21\x18'+clean(info.name).toUpperCase()+'\x1B\x21\x00\n';
    out+='\x1B\x21\x10'+clean(info.address).toLowerCase()+'\x1B\x21\x00\n';
    out+='\x1B\x21\x10'+clean(info.phone).toLowerCase()+'\x1B\x21\x00\n';
    out+='\x1B\x61\x00';
    out+=separator;
    out+=`ID Struk : ${invoiceId}\n`;
    out+=`${getKasirReceiptDate()}\n`;
    out+=separator;
    kasirCart.forEach(x=>{
      out+=clean(x.name).slice(0,32)+'\n';
      out+=line(`${x.qty} x ${rupiah(x.price)}`,rupiah(x.qty*x.price),32)+'\n';
    });
    out+=separator;
    out+=line('Total',rupiah(finalTotal),32)+'\n';
    out+=line('Uang Diterima',rupiah(paid),32)+'\n';
    out+=line('Diskon',rupiah(discount),32)+'\n';
    out+=line('Kembalian',rupiah(change),32)+'\n';
    out+=separator;
    out+=clean(info.footer||'Keterangan')+'\n';
    out+='\n\n';
    return new TextEncoder().encode(out+'\x1D\x56\x00');
  }

  async function printKasirReceiptBluetooth(){
    const characteristic=kasirBluetooth.characteristic;
    if(!kasirBluetooth.device?.gatt?.connected||!characteristic){
      throw new Error('Printer Bluetooth belum siap untuk mencetak.');
    }
    const data=buildKasirEscPosReceipt();
    const chunkSize=180;
    for(let i=0;i<data.length;i+=chunkSize){
      const chunk=data.slice(i,i+chunkSize);
      if(characteristic.properties?.writeWithoutResponse&&characteristic.writeValueWithoutResponse)await characteristic.writeValueWithoutResponse(chunk);
      else if(characteristic.writeValue)await characteristic.writeValue(chunk);
      else throw new Error('Karakteristik printer tidak mendukung penulisan data.');
      await new Promise(resolve=>setTimeout(resolve,25));
    }
  }

  updateKasirBluetoothUi('disconnected','Koneksi Bluetooth terputus');

  document.addEventListener('click',e=>{
    if(e.target.closest('#kasir-refresh-btn')){e.preventDefault();connectKasirBluetoothPrinter();return}
  });

  function renderKasirReceiptPreview(){
    const total=kasirCart.reduce((a,x)=>a+x.qty*x.price,0);
    const discount=Math.min(total,Number(String(document.getElementById('kasir-popup-discount')?.value||'').replace(/[^0-9]/g,''))||0);
    const paid=Number(String(document.getElementById('kasir-popup-paid')?.value||'').replace(/[^0-9]/g,''))||0;
    const finalTotal=Math.max(0,total-discount);
    const preview=document.getElementById('kasir-receipt-preview');
    if(!preview)return;
    const info=getKasirReceiptStoreInfo();
    const invoiceId=window.__kasirCurrentInvoiceId||getKasirReceiptInvoiceId();
    preview.innerHTML=`<div class="kasir-receipt-header"><strong>${esc(info.name).toUpperCase()}</strong><br><span>${esc(info.address).toLowerCase()}</span><br><span>${esc(info.phone).toLowerCase()}</span></div>
      <div style="border-top:1px dashed #111;margin:6px 0"></div>
      <div>ID Struk : ${esc(invoiceId)}</div>
      <div>${esc(getKasirReceiptDate())}</div>
      <div style="border-top:1px dashed #111;margin:6px 0"></div>
      ${kasirCart.map(x=>`<div style="margin-bottom:4px"><div>${esc(x.name)}</div><div class="r-row"><span>${x.qty} x ${rupiah(x.price)}</span><span>${rupiah(x.qty*x.price)}</span></div></div>`).join('')}
      <div style="border-top:1px dashed #111;margin:6px 0"></div>
      <div class="r-row"><strong>Total</strong><strong>${rupiah(finalTotal)}</strong></div>
      <div class="r-row"><span>Uang Diterima</span><span>${rupiah(paid)}</span></div>
      <div class="r-row"><span>Diskon</span><span>${rupiah(discount)}</span></div>
      <div class="r-row"><span>Kembalian</span><span>${rupiah(Math.max(0,paid-finalTotal))}</span></div>
      <div style="border-top:1px dashed #111;margin:6px 0"></div>
      <div>${esc(info.footer||'Keterangan')}</div>`;
  }
  document.addEventListener('submit',e=>{
    if(e.target.id!=='receipt-settings-form')return;
    e.preventDefault();
    saveKasirReceiptSettings();
    renderKasirReceiptPreview();
    notify('Berhasil Disimpan','Pengaturan struk berhasil disimpan.','fa-solid fa-circle-check text-emerald-600');
  });

  function openKasirPaymentPopup(){
    if(!kasirCart.length){showModal('Gagal','Keranjang masih kosong.','fa-solid fa-circle-exclamation text-rose-600');return}
    const popup=document.getElementById('kasir-payment-popup');
    const paid=document.getElementById('kasir-popup-paid');
    const discount=document.getElementById('kasir-popup-discount');
    if(paid)paid.value='';
    if(discount)discount.value='';
    window.__kasirCurrentInvoiceId=getKasirReceiptInvoiceId();
    renderKasirReceiptPreview();
    updateKasirPaymentSummary();
    popup?.classList.add('is-open');
    popup?.setAttribute('aria-hidden','false');
    updateKasirBluetoothUi(kasirBluetooth.device?.gatt?.connected?'connected':'disconnected',kasirBluetooth.device?.gatt?.connected?'Printer Bluetooth tersambung':'Koneksi Bluetooth terputus');
    setTimeout(()=>paid?.focus(),50);
  }
  function closeKasirPaymentPopup(){
    const popup=document.getElementById('kasir-payment-popup');
    popup?.classList.remove('is-open');
    popup?.setAttribute('aria-hidden','true');
  }
  async function saveAndPrintKasirPayment(){
    if(!kasirCart.length)return;
    updateKasirPaymentSummary();
    const paid=document.getElementById('kasir-popup-paid')?.value||'';
    const discount=document.getElementById('kasir-popup-discount')?.value||'';
    const total=kasirCart.reduce((a,x)=>a+x.qty*x.price,0);
    const finalTotal=Math.max(0,total-(Number(String(discount).replace(/[^0-9]/g,''))||0));
    if((Number(String(paid).replace(/[^0-9]/g,''))||0)<finalTotal){
      showModal('Gagal','Uang diterima masih kurang.','fa-solid fa-circle-exclamation text-rose-600');
      return;
    }
    if(!kasirBluetooth.device?.gatt?.connected||!kasirBluetooth.characteristic){
      showModal('Printer Belum Tersambung','Sambungkan printer Bluetooth terlebih dahulu sebelum menekan Simpan dan Cetak.','fa-brands fa-bluetooth-b text-rose-600');
      updateKasirBluetoothUi('disconnected','Koneksi Bluetooth terputus');
      return;
    }
    renderKasirReceiptPreview();
    try{
      await printKasirReceiptBluetooth();
    }catch(err){
      updateKasirBluetoothUi('disconnected','Koneksi Bluetooth terputus');
      showModal('Cetak Gagal',err?.message||'Struk tidak dapat dikirim ke printer Bluetooth.','fa-brands fa-bluetooth-b text-rose-600');
      return;
    }
    commitKasirReceiptInvoiceId();
    const saved=saveKasirTransaction({paid,discount});
    if(!saved)return;
    window.__kasirCurrentInvoiceId=null;
    closeKasirPaymentPopup();
    showModal('Berhasil','Transaksi berhasil disimpan dan struk telah dikirim ke printer Bluetooth.','fa-brands fa-bluetooth-b text-emerald-600');
  }

  function focusKasirSearch(){
    const input=document.getElementById('kasir-search');
    if(!input)return;
    input.focus();
    input.select();
  }

  /* KASIR SUGGEST + CART KEYBOARD + BARCODE BOX/DOT — SATU IMPLEMENTASI */
  let kasirSuggestIndex=-1;
  let kasirLastAddedProductId=null;
  let kasirCartSelectedIndex=-1;
  let kasirQtyKeyBuffer='';
  let kasirQtyKeyTimer=null;

  function getKasirSuggestionBox(){
    const input=document.getElementById('kasir-search');
    if(!input)return null;
    let box=document.getElementById('kasir-search-suggestions');
    if(!box){
      box=document.createElement('div');
      box.id='kasir-search-suggestions';
      box.setAttribute('role','listbox');
      const wrap=input.closest('.kasir-search-wrap');
      if(wrap){wrap.style.position='relative';wrap.appendChild(box)}
    }
    return box;
  }

  function renderKasirSuggestions(){
    const input=document.getElementById('kasir-search');
    const box=getKasirSuggestionBox();
    if(!input||!box)return;
    const q=String(input.value||'').trim().toLowerCase();
    kasirSuggestIndex=-1;
    if(!q){box.hidden=true;box.innerHTML='';return}
    const matches=kasirProducts.filter(p=>{
      const name=String(p.name||'').toLowerCase();
      const barcode=productBarcodes(p).join(' ').toLowerCase();
      return name.includes(q)||barcode.includes(q);
    }).slice(0,8);
    if(!matches.length){box.hidden=true;box.innerHTML='';return}
    box.innerHTML=matches.map((p,i)=>`<button type="button" class="kasir-suggestion-item" data-kasir-suggest="${esc(p.id)}" data-kasir-suggest-index="${i}" role="option" aria-selected="false"><strong>${esc(p.name)}</strong><span>${rupiah(p.price)}${productBarcodes(p).length?' • '+esc(productBarcodes(p).join(', ')):''}</span></button>`).join('');
    box.hidden=false;
  }

  function setKasirSuggestionSelection(index){
    const box=document.getElementById('kasir-search-suggestions');
    if(!box||box.hidden)return;
    const items=[...box.querySelectorAll('[data-kasir-suggest]')];
    if(!items.length)return;
    kasirSuggestIndex=Math.max(0,Math.min(index,items.length-1));
    items.forEach((item,i)=>item.setAttribute('aria-selected',i===kasirSuggestIndex?'true':'false'));
    items[kasirSuggestIndex]?.scrollIntoView({block:'nearest'});
  }

  function closeKasirSuggestions(){
    const box=document.getElementById('kasir-search-suggestions');
    if(box){box.hidden=true;box.innerHTML='';}
    kasirSuggestIndex=-1;
  }

  function updateKasirCartSelection(){
    const items=[...document.querySelectorAll('#kasir-cart-list [data-kasir-cart-item]')];
    items.forEach((item,i)=>{
      const selected=i===kasirCartSelectedIndex;
      item.classList.toggle('kasir-cart-key-selected',selected);
      item.setAttribute('aria-selected',selected?'true':'false');
      if(selected)item.scrollIntoView({block:'nearest',inline:'nearest'});
    });
  }

  /* KASIR BARCODE SCANNER + MULTI-BARCODE — SATU IMPLEMENTASI */
  let kasirBarcodeStream=null;
  let kasirBarcodeDetector=null;
  let kasirBarcodeScanFrame=0;
  let kasirBarcodeScanning=false;
  function setKasirBarcodeIndicator(active){const dot=document.getElementById('kasir-barcode-scan-dot');if(dot)dot.classList.toggle('is-scanning',!!active)}
  function closeKasirBarcodeScanner(){
    kasirBarcodeScanning=false;setKasirBarcodeIndicator(false);cancelAnimationFrame(kasirBarcodeScanFrame);
    if(kasirBarcodeStream){kasirBarcodeStream.getTracks().forEach(t=>t.stop());kasirBarcodeStream=null}
    const modal=document.getElementById('kasir-barcode-scanner');if(modal)modal.remove();
  }
  function addScannedKasirBarcode(code){
    const input=document.getElementById('kasir-barcode');if(!input)return;
    input.value=String(code||'').trim();
    const p=findKasirProductByBarcode(input.value);
    if(p){addKasirProductToCart(p);resetKasirSearchAndSelectCart(p.id);input.value='';}
  }
  async function startKasirBarcodeScanner(){
    if(kasirBarcodeScanning)return;
    if(!navigator.mediaDevices?.getUserMedia){if(typeof showModal==='function')showModal('Scanner Tidak Didukung','Browser ini tidak menyediakan akses kamera.');return}
    if(!('BarcodeDetector' in window)){if(typeof showModal==='function')showModal('Scanner Tidak Didukung','Browser ini belum mendukung BarcodeDetector. Gunakan Chrome/Edge versi terbaru.');return}
    try{
      kasirBarcodeScanning=true;setKasirBarcodeIndicator(true);
      const modal=document.createElement('div');modal.id='kasir-barcode-scanner';modal.className='kasir-barcode-scanner';modal.innerHTML='<div class="kasir-barcode-scanner-card"><div class="kasir-barcode-scanner-head"><strong>Scan Barcode</strong><button type="button" id="kasir-barcode-scanner-close">×</button></div><div class="kasir-barcode-camera-wrap"><video id="kasir-barcode-video" autoplay playsinline muted></video><span class="kasir-barcode-target"></span></div><p>Arahkan barcode ke kamera. Scanner aktif selama kotak ini terbuka.</p></div>';document.body.appendChild(modal);
      document.getElementById('kasir-barcode-scanner-close')?.addEventListener('click',closeKasirBarcodeScanner);
      kasirBarcodeStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
      const video=document.getElementById('kasir-barcode-video');if(!video)throw new Error('Kamera scanner tidak tersedia.');video.srcObject=kasirBarcodeStream;await video.play();
      kasirBarcodeDetector=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128','code_39','code_93','itf','codabar','qr_code']});
      const scan=async()=>{if(!kasirBarcodeScanning||!video||video.readyState<2)return;try{const codes=await kasirBarcodeDetector.detect(video);const code=codes?.[0]?.rawValue;if(code){addScannedKasirBarcode(code);closeKasirBarcodeScanner();return}}catch{}kasirBarcodeScanFrame=requestAnimationFrame(scan)};
      kasirBarcodeScanFrame=requestAnimationFrame(scan);
    }catch(err){closeKasirBarcodeScanner();if(err?.name!=='NotAllowedError'&&typeof showModal==='function')showModal('Scanner Gagal',err?.message||'Kamera barcode tidak dapat diaktifkan.');}
  }
  function resetKasirSearchAndSelectCart(id){
    const input=document.getElementById('kasir-search');
    const barcodeInput=document.getElementById('kasir-barcode');
    if(input)input.value='';
    if(barcodeInput)barcodeInput.value='';
    closeKasirSuggestions();
    kasirLastAddedProductId=String(id);
    kasirCartSelectedIndex=Math.max(0,kasirCart.findIndex(v=>String(v.id)===String(id)));
    renderCart();
    renderKasirProducts();
    requestAnimationFrame(updateKasirCartSelection);
  }

  function applyKasirKeyboardQty(){
    if(kasirQtyKeyTimer){clearTimeout(kasirQtyKeyTimer);kasirQtyKeyTimer=null}
    if(!kasirQtyKeyBuffer)return;
    const items=[...document.querySelectorAll('#kasir-cart-list [data-kasir-cart-item]')];
    if(kasirCartSelectedIndex<0||kasirCartSelectedIndex>=items.length){kasirQtyKeyBuffer='';return}
    const selected=kasirCart[kasirCartSelectedIndex];
    const qty=Math.max(0,Number(kasirQtyKeyBuffer)||0);
    kasirQtyKeyBuffer='';
    if(!selected)return;
    if(qty<=0){
      kasirCart.splice(kasirCartSelectedIndex,1);
      kasirCartSelectedIndex=Math.min(kasirCartSelectedIndex,kasirCart.length-1);
    }else selected.qty=qty;
    renderCart();
    requestAnimationFrame(updateKasirCartSelection);
  }

  // Input pencarian: produk + suggest selalu hidup kembali dalam satu jalur.
  const kasirBarcodeDot=document.getElementById('kasir-barcode-scan-dot');
  kasirBarcodeDot?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();startKasirBarcodeScanner()});
  kasirBarcodeDot?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();startKasirBarcodeScanner()}});
  document.getElementById('kasir-barcode')?.addEventListener('click',()=>{startKasirBarcodeScanner()});
  document.getElementById('kasir-barcode')?.addEventListener('input',()=>{
    const value=String(document.getElementById('kasir-barcode')?.value||'').trim();
    if(value){
      const p=findKasirProductByBarcode(value);
      if(p){addKasirProductToCart(p);resetKasirSearchAndSelectCart(p.id);}
    }
  });
  document.getElementById('kasir-search')?.addEventListener('input',()=>{
    kasirLastAddedProductId=null;
    renderKasirProducts();
    renderKasirSuggestions();
  });

  // Hover suggest dan hover keranjang menggunakan state yang sama dengan keyboard.
  document.addEventListener('mouseover',e=>{
    const suggestion=e.target.closest('#kasir-search-suggestions [data-kasir-suggest]');
    if(suggestion){
      const items=[...document.querySelectorAll('#kasir-search-suggestions [data-kasir-suggest]')];
      setKasirSuggestionSelection(items.indexOf(suggestion));
      return;
    }
    const item=e.target.closest('#kasir-cart-list [data-kasir-cart-item]');
    if(item){
      const items=[...document.querySelectorAll('#kasir-cart-list [data-kasir-cart-item]')];
      kasirCartSelectedIndex=items.indexOf(item);
      updateKasirCartSelection();
    }
  });

  // Semua klik Kasir yang berkaitan dengan suggest/keranjang tetap satu jalur.
  document.addEventListener('click',e=>{
    const suggestion=e.target.closest('#kasir-search-suggestions [data-kasir-suggest]');
    if(suggestion){
      const id=String(suggestion.dataset.kasirSuggest||'');
      const p=kasirProducts.find(x=>String(x.id)===id);
      if(p){addKasirProductToCart(p);resetKasirSearchAndSelectCart(id);}
      return;
    }
    const add=e.target.closest('[data-add-product]');
    if(add){
      const id=String(add.dataset.addProduct||'');
      const p=kasirProducts.find(x=>String(x.id)===id);
      if(p){addKasirProductToCart(p);resetKasirSearchAndSelectCart(id);}
      return;
    }
    const inc=e.target.closest('#kasir-cart-list .kasir-qty [data-cart-inc]');
    if(inc){
      e.preventDefault();e.stopPropagation();
      const id=String(inc.dataset.cartInc||'');
      const x=kasirCart.find(v=>String(v.id)===id);
      if(x){x.qty++;kasirCartSelectedIndex=Math.max(0,kasirCart.findIndex(v=>String(v.id)===id));renderCart();updateKasirCartSelection();}
      return;
    }
    const dec=e.target.closest('#kasir-cart-list .kasir-qty [data-cart-dec]');
    if(dec){
      e.preventDefault();e.stopPropagation();
      const id=String(dec.dataset.cartDec||'');
      const i=kasirCart.findIndex(v=>String(v.id)===id);
      if(i>-1){kasirCart[i].qty--;if(kasirCart[i].qty<=0){kasirCart.splice(i,1);kasirCartSelectedIndex=Math.min(kasirCartSelectedIndex,kasirCart.length-1);}else kasirCartSelectedIndex=i;}
      renderCart();updateKasirCartSelection();
      return;
    }
    if(e.target.closest('#kasir-payment-close')){closeKasirPaymentPopup();return}
    if(e.target.id==='kasir-payment-popup'&&!e.target.closest('.kasir-payment-dialog')){closeKasirPaymentPopup();return}
    if(e.target.closest('#kasir-save-print-btn')){saveAndPrintKasirPayment();return}
    if(e.target.closest('#kasir-cancel-btn')){kasirCart=[];kasirCartSelectedIndex=-1;renderCart();return}
    if(e.target.closest('#kasir-save-btn')){openKasirPaymentPopup();return}
  });

  // Keyboard: suggest memakai Atas/Bawah; setelah produk ditambah dengan mouse,
  // Atas/Bawah langsung mengakses item keranjang tanpa harus klik keranjang lagi.
  document.addEventListener('keydown',e=>{
    const active=e.target;
    const isTyping=!!active&&(active.tagName==='INPUT'||active.tagName==='TEXTAREA'||active.isContentEditable);
    const paymentPopup=document.getElementById('kasir-payment-popup');
    if(paymentPopup?.classList.contains('is-open')){
      if(e.key==='Enter'&&(active?.id==='kasir-popup-paid'||active?.id==='kasir-popup-discount'||active===paymentPopup)){e.preventDefault();saveAndPrintKasirPayment();return}
      if(e.key==='Escape'){e.preventDefault();closeKasirPaymentPopup();return}
    }
    if((e.key==='`'||e.key==='~')&&!isTyping){e.preventDefault();focusKasirSearch();return}

    if(active?.id==='kasir-search'){
      const box=document.getElementById('kasir-search-suggestions');
      const items=box?[...box.querySelectorAll('[data-kasir-suggest]')]:[];
      if(items.length&&(e.key==='ArrowDown'||e.key==='ArrowUp')){
        e.preventDefault();
        setKasirSuggestionSelection(e.key==='ArrowDown'?kasirSuggestIndex+1:kasirSuggestIndex-1);
        return;
      }
      if(e.key==='Enter'&&items.length){
        e.preventDefault();
        const chosen=items[kasirSuggestIndex>=0?kasirSuggestIndex:0];
        if(chosen)chosen.click();
        return;
      }
    }

    // Jangan mengambil tombol Atas/Bawah dari input nominal/field lain.
    if(isTyping&&active?.id!=='kasir-search')return;

    const cartItems=[...document.querySelectorAll('#kasir-cart-list [data-kasir-cart-item]')];
    if(cartItems.length&&(e.key==='ArrowDown'||e.key==='ArrowUp')){
      e.preventDefault();
      if(kasirCartSelectedIndex<0)kasirCartSelectedIndex=e.key==='ArrowDown'?0:cartItems.length-1;
      else kasirCartSelectedIndex=e.key==='ArrowDown'?Math.min(kasirCartSelectedIndex+1,cartItems.length-1):Math.max(kasirCartSelectedIndex-1,0);
      updateKasirCartSelection();
      return;
    }
    if(cartItems.length&&(e.key==='ArrowRight'||e.key==='ArrowLeft')&&kasirCartSelectedIndex>=0){
      const selected=kasirCart[kasirCartSelectedIndex];
      if(selected){
        e.preventDefault();
        if(e.key==='ArrowRight')selected.qty++;
        else{selected.qty--;if(selected.qty<=0){kasirCart.splice(kasirCartSelectedIndex,1);kasirCartSelectedIndex=Math.min(kasirCartSelectedIndex,kasirCart.length-1);}}
        renderCart();
        requestAnimationFrame(updateKasirCartSelection);
        return;
      }
    }
    if(/^[0-9]$/.test(e.key)&&!isTyping&&kasirCartSelectedIndex>=0&&kasirCartSelectedIndex<cartItems.length){
      e.preventDefault();
      kasirQtyKeyBuffer+=e.key;
      if(kasirQtyKeyTimer)clearTimeout(kasirQtyKeyTimer);
      kasirQtyKeyTimer=setTimeout(applyKasirKeyboardQty,1000);
    }
  });

  window.__initKasirViews=initKasirViews;
})();

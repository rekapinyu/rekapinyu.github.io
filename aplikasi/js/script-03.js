(function(){
  'use strict';

  let xlsxLoading=null;

  function ensureXLSX(){
    if(typeof window.XLSX!=='undefined') return Promise.resolve(window.XLSX);
    if(xlsxLoading) return xlsxLoading;
    const urls=[
      'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
      'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
      'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'
    ];
    xlsxLoading=new Promise((resolve,reject)=>{
      let i=0;
      const load=()=>{
        if(typeof window.XLSX!=='undefined'){resolve(window.XLSX);return}
        if(i>=urls.length){reject(new Error('Library Excel tidak dapat dimuat. Pastikan koneksi internet aktif.'));return}
        const sc=document.createElement('script');
        sc.src=urls[i++];
        sc.async=true;
        sc.onload=()=>typeof window.XLSX!=='undefined'?resolve(window.XLSX):load();
        sc.onerror=load;
        document.head.appendChild(sc);
      };
      load();
    }).catch(err=>{xlsxLoading=null;throw err});
    return xlsxLoading;
  }

  function updateFloating(){const panel=document.getElementById('history-io-floating'),history=document.getElementById('view-history');if(!panel||!history)return;panel.style.display=history.classList.contains('hidden')?'none':'flex'}
  function initHistoryIO(){
    updateFloating();
    if(typeof window.switchTab==='function'&&!window.switchTab.__historyIOWrapped){
      const originalSwitch=window.switchTab;
      function sw(tab){const r=originalSwitch.apply(this,arguments);setTimeout(updateFloating,0);return r}
      sw.__historyIOWrapped=true;window.switchTab=sw;
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initHistoryIO);else initHistoryIO();
  setInterval(()=>{init();updateFloating()},700);
})();

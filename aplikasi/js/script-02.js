(function(){
      function formatMobileAdminCurrency(value){
        const n=Number(value)||0;
        return 'Rp ' + n.toLocaleString('id-ID');
      }
      function renderMobileAdminSummary(){
        if(!window.matchMedia('(max-width:767px)').matches)return;
        const incomeEl=document.getElementById('mobile-admin-income');
        const expenseEl=document.getElementById('mobile-admin-expense');
        const profitEl=document.getElementById('mobile-admin-profit');
        const storeNameEl=document.getElementById('mobile-admin-store-name');
        if(!incomeEl||!expenseEl||!profitEl)return;
        if(storeNameEl)storeNameEl.textContent=(currentSessionUser&&currentSessionUser.name)||'ADMIN';
        const data=Array.isArray(historyData)?historyData:[];
        const now=new Date();
        const todayDate=now.getDate();
        const todayMonth=now.getMonth();
        const todayYear=now.getFullYear();
        const today= data.find(item=>Number(item.date)===todayDate && Number(item.monthIndex)===todayMonth && Number(item.year)===todayYear);
        const latest=today || data[0] || null;
        incomeEl.textContent=formatMobileAdminCurrency(latest?.income);
        expenseEl.textContent=formatMobileAdminCurrency(latest?.expense);
        profitEl.textContent=formatMobileAdminCurrency(latest?.profit);
      }
            (function(){let mode="daily";function rp(n){return "Rp "+(Number(n)||0).toLocaleString("id-ID")}function kasir(){let t=[],p=[];try{let ph=(typeof currentSessionUser!=="undefined"&&currentSessionUser&&currentSessionUser.phone)?currentSessionUser.phone:"guest";t=JSON.parse(localStorage.getItem("finance_kasir_transactions_"+ph)||"[]");p=JSON.parse(localStorage.getItem("finance_kasir_products_"+ph)||"[]")}catch(e){}let pm={};p.forEach(x=>pm[String(x.id)]=x);let omzet=t.reduce((a,x)=>a+(Number(x.total)||0),0),profit=0; t.forEach(x=>{let items=Array.isArray(x.cart)?x.cart:(Array.isArray(x.itemsDetail)?x.itemsDetail:null);if(items)profit+=items.reduce((s,i)=>{let q=Number(i.qty)||1, pr=Number(i.price)||0, c=Number((pm[String(i.id)]||i).cost??i.hpp)||0;return s+Math.max(pr-c,0)*q},0)});return{omzet,profit,count:t.length}}function setMode(m){mode=m==="kasir"?"kasir":"daily";let a=document.getElementById("mobile-admin-card-income-label"),b=document.getElementById("mobile-admin-card-expense-label"),c=document.getElementById("mobile-admin-card-profit-label"),x=document.getElementById("mobile-admin-income"),y=document.getElementById("mobile-admin-expense"),z=document.getElementById("mobile-admin-profit"),sub=document.querySelector(".mobile-admin-subtitle");if(mode==="kasir"){let s=kasir();if(a)a.textContent="Pendapatan Kasir";if(b)b.textContent="Total Laba/Profit";if(c)c.textContent="Total transaksi";if(x)x.textContent=rp(s.omzet);if(y)y.textContent=rp(s.profit);if(z)z.textContent=s.count;if(sub)sub.textContent="Ringkasan pendapatan kasir"}else{if(a)a.textContent="Pendapatan";if(b)b.textContent="Total Belanja";if(c)c.textContent="Total Profit";if(sub)sub.textContent="Ringkasan input terbaru hari ini";if(typeof renderMobileAdminSummary==="function")renderMobileAdminSummary()}}function close(){let p=document.getElementById("mobile-admin-income-chooser");if(p)p.remove()}function open(){close();let b=document.getElementById("mobile-admin-settings-button");if(!b)return;let p=document.createElement("div");p.id="mobile-admin-income-chooser";p.className="mobile-admin-income-chooser";p.innerHTML="<button type=\"button\" data-mobile-admin-mode=\"kasir\"><i class=\"fa-solid fa-cash-register\"></i><span>Pendapatan Kasir</span></button><button type=\"button\" data-mobile-admin-mode=\"daily\"><i class=\"fa-solid fa-calendar-day\"></i><span>Pendapatan Harian</span></button>";document.body.appendChild(p);let r=b.getBoundingClientRect();p.style.top=Math.min(innerHeight-120,r.bottom+8)+"px";p.style.right=Math.max(8,innerWidth-r.right)+"px";p.querySelectorAll("[data-mobile-admin-mode]").forEach(q=>q.onclick=()=>{setMode(q.dataset.mobileAdminMode);close()});setTimeout(()=>{let f=e=>{if(!p.contains(e.target)&&e.target!==b){close();document.removeEventListener("click",f)}};document.addEventListener("click",f)},0)}function initMobileAdminIncomeChooser(){let b=document.getElementById("mobile-admin-settings-button");if(!b||b.dataset.bound)return;b.dataset.bound="1";b.onclick=e=>{e.stopPropagation();open()};setMode("daily")}window.__mobileAdminSetMode=setMode;document.addEventListener("DOMContentLoaded",initMobileAdminIncomeChooser);setTimeout(initMobileAdminIncomeChooser,300)})();
      function syncMobileProfileButton(){
                const button=document.getElementById('mobile-profile-button');
                if(!button)return;
                const photo=currentSessionUser&&currentSessionUser.photo;
                button.innerHTML=photo?`<img src="${photo}" alt="Foto profil">`:'<i class="fa-solid fa-user"></i>';
            }
            window.toggleMobileProfileMenu=function(e){if(e)e.stopPropagation();const menu=document.getElementById('mobile-profile-menu');if(menu)menu.classList.toggle('hidden')};
            window.closeMobileProfileMenu=function(){const menu=document.getElementById('mobile-profile-menu');if(menu)menu.classList.add('hidden')};
      window.renderMobileAdminSummary=renderMobileAdminSummary;
      const originalSwitchTab=window.switchTab;
      function active(id){['nav-mobile-home','nav-mobile-input','nav-mobile-history'].forEach(x=>{const e=document.getElementById(x);if(!e)return;const a=x===id;e.className=a?'flex flex-col items-center justify-center py-2 px-4 text-emerald-600 transition':'flex flex-col items-center justify-center py-2 px-4 text-slate-400 transition';const t=e.querySelector('span');if(t)t.className=a?'text-[11px] font-semibold':'text-[11px] font-medium'})}
    function home(){if(!window.matchMedia('(max-width:767px)').matches)return;['input','pengeluaran','kasbon','history','report','backup'].forEach(v=>{const e=document.getElementById('view-'+v);if(e)e.classList.add('hidden')});['pengeluaran-sticky-container','kasbon-sticky-container','backup-sticky-container'].forEach(id=>{const e=document.getElementById(id);if(e)e.classList.add('hidden')});const h=document.getElementById('mobile-home-view');if(h)h.classList.remove('hidden');const t=document.getElementById('page-title-header'),s=document.getElementById('page-subtitle-header');if(t)t.innerText='Beranda';if(s)s.innerText='Pilih menu yang ingin Anda gunakan.';active('nav-mobile-home');renderMobileAdminSummary()}
      window.switchTab=function(tab){if(tab==='home'){if(window.matchMedia('(max-width:767px)').matches)home();else originalSwitchTab('input');return}originalSwitchTab(tab);if(window.matchMedia('(max-width:767px)').matches){active(tab==='input'?'nav-mobile-input':tab==='history'?'nav-mobile-history':'nav-mobile-home');const h=document.getElementById('mobile-home-view');if(h)h.classList.add('hidden')}};
    document.addEventListener('click',e=>{const m=document.getElementById('mobile-profile-menu'),b=document.getElementById('mobile-profile-menu-container');if(m&&b&&!b.contains(e.target))m.classList.add('hidden')});
    function initMobileHome(){if(window.matchMedia('(max-width:767px)').matches){home();renderMobileAdminSummary();syncMobileProfileButton()}};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initMobileHome);else initMobileHome();
    })();

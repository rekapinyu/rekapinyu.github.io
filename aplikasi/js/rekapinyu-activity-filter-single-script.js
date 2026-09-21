(function(){
  'use strict';
  const filter=document.getElementById('rekapinyu-activity-filter');
  const view=document.getElementById('view-activity');
  if(!filter||!view)return;
  const search=document.getElementById('rk-activity-search');
  const date=document.getElementById('rk-activity-date');
  const month=document.getElementById('rk-activity-month');
  const year=document.getElementById('rk-activity-year');
  const state={search:'',date:'',month:'',year:''};
  for(let i=1;i<=30;i++)date.insertAdjacentHTML('beforeend',`<option value="${i}">${i}</option>`);
  for(let i=0;i<12;i++){const n=String(i+1).padStart(2,'0');month.insertAdjacentHTML('beforeend',`<option value="${n}">${new Date(2000,i,1).toLocaleDateString('id-ID',{month:'long'})}</option>`);}
  function readData(){
    try{
      const u=window.currentSessionUser;
      const phone=u&&u.phone?String(u.phone).replace(/\D/g,''):'';
      const raw=localStorage.getItem(phone?`finance_activity_desktop_${phone}`:'finance_activity_guest');
      const data=raw?JSON.parse(raw):[];
      return Array.isArray(data)?data:[];
    }catch(e){return [];}
  }
  function activityInfo(item){
    const d=new Date(item?.timestamp||item?.dateTime||Date.now());
    if(Number.isNaN(d.getTime()))return null;
    return {day:String(d.getDate()),month:String(d.getMonth()+1).padStart(2,'0'),year:String(d.getFullYear())};
  }
  function refreshYears(){
    const values=[...new Set(readData().map(activityInfo).filter(Boolean).map(x=>x.year))].sort((a,b)=>b.localeCompare(a));
    const current=state.year;
    year.innerHTML='<option value="">Tahun</option>'+values.map(v=>`<option value="${v}">${v}</option>`).join('');
    year.value=values.includes(current)?current:'';
    state.year=year.value;
  }
  function refresh(){
    const active=!view.classList.contains('hidden');
    filter.classList.toggle('hidden',!active);
    filter.classList.toggle('rk-activity-filter-visible',active);
    if(!active)return;
    refreshYears();
  }
  function notifyActivityRenderer(){
    window.__rekapinyuActivityFilterState={...state};
    if(typeof window.__rekapinyuRefreshActivities==='function')window.__rekapinyuRefreshActivities();
  }
  search.addEventListener('input',()=>{state.search=search.value||'';notifyActivityRenderer();});
  date.addEventListener('change',()=>{state.date=date.value||'';notifyActivityRenderer();});
  month.addEventListener('change',()=>{state.month=month.value||'';notifyActivityRenderer();});
  year.addEventListener('change',()=>{state.year=year.value||'';notifyActivityRenderer();});
  const observer=new MutationObserver(refresh);
  observer.observe(view,{attributes:true,attributeFilter:['class']});
  refresh();
  setInterval(()=>{if(!view.classList.contains('hidden'))refreshYears();},1500);
})();

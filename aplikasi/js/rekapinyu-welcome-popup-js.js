(function(){
  const popupId='rekapinyu-welcome-popup';
  let lastSession='';
  function openPopup(){const p=document.getElementById(popupId);if(!p)return;p.classList.add('is-open');p.setAttribute('aria-hidden','false')}
  function closePopup(){const p=document.getElementById(popupId);if(!p)return;p.classList.remove('is-open');p.setAttribute('aria-hidden','true')}
  function sessionKey(){try{return currentSessionUser&&currentSessionUser.phone?String(currentSessionUser.phone):''}catch(e){return ''}}
  function check(){const key=sessionKey();if(key&&key!==lastSession){lastSession=key;openPopup()}else if(!key){lastSession='';closePopup()}}
  document.addEventListener('DOMContentLoaded',function(){document.getElementById('rw-close')?.addEventListener('click',closePopup);document.getElementById(popupId)?.addEventListener('click',e=>{if(e.target.id===popupId)closePopup()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closePopup()});check();setInterval(check,300)})
})();

(function(){
  'use strict';
  const btn=document.getElementById('sidebar-refresh-btn');
  if(!btn || btn.dataset.reloadStabilityBound==='1') return;
  btn.dataset.reloadStabilityBound='1';
  btn.addEventListener('click',function(e){
    e.preventDefault();
    window.location.reload();
  });
})();

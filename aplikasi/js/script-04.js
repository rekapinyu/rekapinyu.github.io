(function(){
    const originalLoadUserData = window.loadUserData;
    if (typeof originalLoadUserData === 'function' && !originalLoadUserData.__shopCoverWrapped) {
        window.loadUserData = function(){
            const result = originalLoadUserData.apply(this, arguments);
            if (typeof window.refreshShopCoverPhoto === 'function' && !window.__shopCoverEditingUnsaved) setTimeout(window.refreshShopCoverPhoto, 0);
            return result;
        };
        window.loadUserData.__shopCoverWrapped = true;
    }
})();

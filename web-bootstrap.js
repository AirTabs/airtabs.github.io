(() => {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
        const appRootUrl = new URL('../', window.location.href);
        const swUrl = new URL('sw.js', appRootUrl);
        navigator.serviceWorker.register(swUrl.toString(), { scope: appRootUrl.pathname }).catch(() => {});
    });
})();

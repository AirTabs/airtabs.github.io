(() => {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.getRegistrations()
            .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
            .catch(() => {});

        if ('caches' in window) {
            caches.keys()
                .then((keys) => Promise.all(keys
                    .filter((key) => key.startsWith('airtab-web-'))
                    .map((key) => caches.delete(key))))
                .catch(() => {});
        }
    });
})();

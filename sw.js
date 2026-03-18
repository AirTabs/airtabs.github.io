self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys().catch(() => []);
            await Promise.all(
                keys
                    .filter((key) => key.startsWith('airtab-web-'))
                    .map((key) => caches.delete(key))
            ).catch(() => {});
            await self.registration.unregister().catch(() => {});
        })()
    );
});

self.addEventListener('fetch', (event) => {
    return;
});

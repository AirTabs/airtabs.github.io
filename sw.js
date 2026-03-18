const CACHE_VERSION = 'airtab-web-v2';
const APP_SHELL = [
    './',
    './index.html',
    './options/',
    './options/index.html',
    './options.html',
    './script.js',
    './options.js',
    './i18n.js',
    './preload.js',
    './web-bootstrap.js',
    './manifest.webmanifest',
    './folder-closed.svg',
    './folder-opened.svg',
    './icons/icon-16.png',
    './icons/icon-24.png',
    './icons/icon-32.png',
    './icons/icon-48.png',
    './icons/icon-128.png',
    './oauth/dropbox-callback.html'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(APP_SHELL))
            .catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys
                .filter((key) => key !== CACHE_VERSION)
                .map((key) => caches.delete(key))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const requestUrl = new URL(request.url);
    if (requestUrl.origin !== self.location.origin) return;

    event.respondWith(
        caches.match(request).then((cached) => {
            const networkFetch = fetch(request)
                .then((response) => {
                    if (response && response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
                    }
                    return response;
                })
                .catch(() => cached);

            return cached || networkFetch;
        })
    );
});

const VERSION = '1.2.1'; // Aumente a versão quando atualizar os arquivos
const CACHE_NAME = 'MultiTimeTracker-cache-v1';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './scripts.js',
    './manifest.json',
    './images/icon-192x192.png',
    './images/icon-512x512.png'
];

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames.filter(function (cacheName) {
                    return cacheName !== CACHE_NAME;
                }).map(function (cacheName) {
                    return caches.delete(cacheName);
                })
            ).then(function () {
                return caches.open(CACHE_NAME);
            }).then(function (cache) {
                return cache.addAll(urlsToCache);
            });
        })
    );
});

self.addEventListener('fetch', function (event) {
    event.respondWith(
        caches.match(event.request)
            .then(function (response) {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});
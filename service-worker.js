const VERSION = '1.0.1';
const CACHE_NAME = 'meus-cronometros-cache-v1';
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
        caches.open(CACHE_NAME)
            .then(function (cache) {
                return cache.addAll(urlsToCache);
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
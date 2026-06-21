/**
 * Vial — Service Worker for offline PWA functionality
 */

const CACHE_NAME = "vial-cache-v5";
const ASSETS = [
  "index.html",
  "styles.css",
  "app.js",
  "manifest.json",
  "icon-192.png",
  "icon-512.png"
];

// Install Service Worker and cache all essential client resources
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("Caching local assets...");
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate and clean up old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch asset: try cache first, fallback to network
self.addEventListener("fetch", event => {
  // Only intercept HTTP/S requests (ignores chrome-extension or file-level assets)
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Fetch background update to keep cache fresh
        fetch(event.request).then(networkResponse => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
          }
        }).catch(err => console.log("Offline mode: using cached resource."));
        
        return cachedResponse;
      }
      
      return fetch(event.request);
    })
  );
});

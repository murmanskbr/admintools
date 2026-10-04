var CACHE_NAME = "br-admin-cleanup-v1";

self.addEventListener("install", function (event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    Promise.resolve()
      .then(function () {
        if (!self.caches) return Promise.resolve();
        return caches.keys().then(function (keys) {
          return Promise.all(
            keys.map(function (key) {
              return caches.delete(key);
            })
          );
        });
      })
      .then(function () {
        return self.registration.unregister();
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});

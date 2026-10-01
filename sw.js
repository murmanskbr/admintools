var CACHE_NAME = "br-admin-v3";

var APP_FILES = [
    "./",
    "./index.html",
    "./manifest.json",
    "./css/styles.css?v=3",
    "./js/app.js?v=3"
];

self.addEventListener(
    "install",
    function (event) {
        event.waitUntil(
            caches.open(CACHE_NAME)
                .then(function (cache) {
                    return cache.addAll(APP_FILES);
                })
                .then(function () {
                    return self.skipWaiting();
                })
        );
    }
);

self.addEventListener(
    "activate",
    function (event) {
        event.waitUntil(
            caches.keys()
                .then(function (keys) {
                    return Promise.all(
                        keys.map(function (key) {
                            if (key !== CACHE_NAME) {
                                return caches.delete(key);
                            }

                            return null;
                        })
                    );
                })
                .then(function () {
                    return self.clients.claim();
                })
        );
    }
);

self.addEventListener(
    "fetch",
    function (event) {
        if (event.request.method !== "GET") {
            return;
        }

        event.respondWith(
            caches.match(event.request)
                .then(function (cachedResponse) {
                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    return fetch(event.request)
                        .then(function (networkResponse) {

                            if (
                                !networkResponse ||
                                networkResponse.status !== 200 ||
                                networkResponse.type !== "basic"
                            ) {
                                return networkResponse;
                            }

                            var responseClone =
                                networkResponse.clone();

                            caches.open(CACHE_NAME)
                                .then(function (cache) {
                                    cache.put(
                                        event.request,
                                        responseClone
                                    );
                                });

                            return networkResponse;
                        })
                        .catch(function () {
                            return caches.match("./index.html");
                        });
                })
        );
    }
);
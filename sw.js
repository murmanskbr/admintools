self.addEventListener("push", function (event) {
  var data = {};

  try {
    data = event.data
      ? event.data.json()
      : {};
  } catch (_) {
    data = {
      title: "Black Russia — Мурманск",
      body: event.data
        ? event.data.text()
        : ""
    };
  }

  var title = String(
    data.title ||
      "Black Russia — Мурманск"
  );

  var body = String(
    data.body || ""
  );

  var appIcon = new URL(
    "favicon.svg",
    self.registration.scope
  ).href;

  var notificationOptions = {
    body: body,
    icon: appIcon,
    badge: appIcon,
    tag: String(
      data.tag ||
        "br-admin-notification"
    ),
    renotify: false,
    data: {
      url: String(
        data.url || ""
      )
    }
  };

  event.waitUntil(
    self.registration.showNotification(
      title,
      notificationOptions
    )
  );
});

self.addEventListener(
  "notificationclick",
  function (event) {
    event.notification.close();

    var rawUrl = String(
      event.notification &&
      event.notification.data &&
      event.notification.data.url
        ? event.notification.data.url
        : ""
    ).trim();

    var scopeUrl = new URL(self.registration.scope);
    var fallbackUrl = new URL(
      "pages/notifications.html",
      self.registration.scope
    );
    var targetUrl = fallbackUrl.href;

    if (rawUrl) {
      try {
        var parsedTarget = new URL(rawUrl, self.registration.scope);
        // Push payloads may navigate only within this site's service-worker scope.
        if (
          parsedTarget.protocol === "https:" &&
          parsedTarget.origin === scopeUrl.origin &&
          parsedTarget.pathname.indexOf(scopeUrl.pathname) === 0
        ) {
          targetUrl = parsedTarget.href;
        }
      } catch (_) {
        targetUrl = fallbackUrl.href;
      }
    }

    event.waitUntil(
      self.clients
        .matchAll({
          type: "window",
          includeUncontrolled: true
        })
        .then(function (clientList) {
          for (
            var i = 0;
            i < clientList.length;
            i += 1
          ) {
            var client = clientList[i];

            try {
              var clientUrl =
                new URL(client.url);

              var target =
                new URL(targetUrl);

              if (
                clientUrl.origin === target.origin &&
                clientUrl.pathname === target.pathname
              ) {
                return client.focus();
              }
            } catch (_) {}
          }

          if (
            self.clients.openWindow
          ) {
            return self.clients.openWindow(
              targetUrl
            );
          }

          return null;
        })
    );
  }
);

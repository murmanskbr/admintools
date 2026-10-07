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

  var notificationOptions = {
    body: body,
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

    var targetUrl = rawUrl
      ? new URL(
          rawUrl,
          self.registration.scope
        ).href
      : new URL(
          "pages/notifications.html",
          self.registration.scope
        ).href;

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

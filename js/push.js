(function () {
  "use strict";

  function serviceWorkerUrl() {
    return new URL(
      document.body && document.body.dataset.page
        ? "../sw.js"
        : "sw.js",
      location.href
    ).href;
  }

  function isSupported() {
    return !!(
      window.isSecureContext &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }

  function permission() {
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission;
  }

  function base64UrlToUint8Array(value) {
    var padding = "=".repeat(
      (4 - (String(value || "").length % 4)) % 4
    );

    var base64 = (
      String(value || "") + padding
    )
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    var raw = window.atob(base64);
    var output = new Uint8Array(raw.length);

    for (var i = 0; i < raw.length; i += 1) {
      output[i] = raw.charCodeAt(i);
    }

    return output;
  }

  function deviceType() {
    var ua = String(
      navigator.userAgent || ""
    ).toLowerCase();

    return /android|iphone|ipad|ipod|mobile/.test(ua)
      ? "phone"
      : "computer";
  }

  function serializeSubscription(subscription) {
    if (!subscription) return null;

    var json = subscription.toJSON
      ? subscription.toJSON()
      : null;

    var endpoint = String(
      subscription.endpoint ||
        (json && json.endpoint) ||
        ""
    ).trim();

    var keys = (
      json &&
      json.keys
    ) || {};

    if (
      !endpoint ||
      !keys.p256dh ||
      !keys.auth
    ) {
      throw new Error(
        "Некорректная push-подписка браузера."
      );
    }

    return {
      endpoint: endpoint,
      keys: {
        p256dh: String(keys.p256dh),
        auth: String(keys.auth)
      },
      expirationTime:
        subscription.expirationTime || null,
      deviceType: deviceType(),
      userAgent: String(
        navigator.userAgent || ""
      ).slice(0, 1000)
    };
  }

  async function ensureServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      throw new Error(
        "Браузер не поддерживает Service Worker."
      );
    }

    var registration =
      await navigator.serviceWorker.register(
        serviceWorkerUrl(),
        { updateViaCache: "none" }
      );

    await navigator.serviceWorker.ready;

    return registration;
  }

  async function currentSubscription() {
    if (!isSupported()) return null;

    var registration =
      await ensureServiceWorker();

    return registration.pushManager.getSubscription();
  }

  async function status(token) {
    var localSubscription = null;

    if (isSupported()) {
      try {
        localSubscription =
          await currentSubscription();
      } catch (error) {
        console.warn(
          "[BR AdminTools] Не удалось получить push-подписку:",
          error
        );
      }
    }

    var server = null;

    try {
      if (localSubscription) {
        await window.BR_API.pushSubscribe(
          token,
          Object.assign(
            serializeSubscription(localSubscription),
            { sync: true }
          )
        );
      }

      server =
        await window.BR_API.pushStatus(token);
    } catch (error) {
      console.warn(
        "[BR AdminTools] Не удалось синхронизировать статус push:",
        error
      );
    }

    return {
      supported: isSupported(),
      permission: permission(),
      localEnabled: !!localSubscription,
      serverEnabled: !!(
        server &&
        server.enabled
      ),
      serverCount:
        server &&
        Number.isFinite(Number(server.count))
          ? Number(server.count)
          : 0
    };
  }

  async function sync(token) {
    if (!isSupported()) {
      return {
        supported: false,
        enabled: false
      };
    }

    var subscription =
      await currentSubscription();

    if (!subscription) {
      var emptyStatus =
        await window.BR_API.pushStatus(token);

      return {
        supported: true,
        enabled: false,
        serverCount:
          Number(emptyStatus.count || 0)
      };
    }

    await window.BR_API.pushSubscribe(
      token,
      serializeSubscription(subscription)
    );

    var serverStatus =
      await window.BR_API.pushStatus(token);

    return {
      supported: true,
      enabled: true,
      serverCount:
        Number(serverStatus.count || 0)
    };
  }

  async function enable(token) {
    if (!isSupported()) {
      var unsupportedError = new Error(
        "Push-уведомления не поддерживаются этим браузером или устройством."
      );
      unsupportedError.code = "PUSH_UNSUPPORTED";
      throw unsupportedError;
    }

    if (permission() === "denied") {
      var deniedError = new Error(
        "Уведомления запрещены в настройках браузера. Разрешите их для этого сайта и повторите попытку."
      );
      deniedError.code = "PUSH_PERMISSION_DENIED";
      throw deniedError;
    }

    var currentPermission = permission();

    if (currentPermission !== "granted") {
      currentPermission =
        await Notification.requestPermission();
    }

    if (currentPermission !== "granted") {
      var permissionError = new Error(
        "Разрешение на push-уведомления не предоставлено."
      );
      permissionError.code = "PUSH_PERMISSION_DENIED";
      throw permissionError;
    }

    var registration =
      await ensureServiceWorker();

    var config =
      await window.BR_API.pushConfig(token);

    var publicKey = String(
      config &&
      config.public_key
        ? config.public_key
        : ""
    ).trim();

    if (!publicKey) {
      var configError = new Error(
        "Push-уведомления пока не настроены на сервере."
      );
      configError.code = "PUSH_NOT_CONFIGURED";
      throw configError;
    }

    var subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription =
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            base64UrlToUint8Array(publicKey)
        });
    }

    await window.BR_API.pushSubscribe(
      token,
      serializeSubscription(subscription)
    );

    return {
      supported: true,
      enabled: true,
      permission: currentPermission,
      subscription: subscription
    };
  }

  async function disable(token) {
    var subscription = null;

    if (isSupported()) {
      try {
        subscription = await currentSubscription();
      } catch (error) {
        console.warn(
          "[BR AdminTools] Не удалось получить текущую push-подписку перед отключением:",
          error
        );
      }
    }

    var endpoint = subscription
      ? String(subscription.endpoint || "").trim()
      : "";

    if (subscription) {
      try {
        await subscription.unsubscribe();
      } catch (error) {
        console.warn(
          "[BR AdminTools] Браузер не подтвердил удаление push-подписки:",
          error
        );
      }
    }

    if (endpoint) {
      await window.BR_API.pushUnsubscribe(
        token,
        endpoint
      );
    }

    return {
      supported: isSupported(),
      enabled: false
    };
  }

  window.BRPush = {
    isSupported: isSupported,
    permission: permission,
    ensureServiceWorker: ensureServiceWorker,
    currentSubscription: currentSubscription,
    serializeSubscription: serializeSubscription,
    status: status,
    sync: sync,
    enable: enable,
    disable: disable
  };
})();

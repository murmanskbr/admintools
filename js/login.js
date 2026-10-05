(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var root = document.getElementById("app");
    root.innerHTML =
      '<main class="login-page"><section class="login-card">' +
        '<div class="login-brand"><div class="login-logo">BR</div><div><b>BLACK RUSSIA</b><small>Мурманск • Admin Panel</small></div></div>' +
        '<h1>Авторизация</h1><p>Войдите в панель администрации сервера.</p>' +
        '<form class="login-form" id="loginForm">' +
          '<label>Логин</label><input class="login-input" id="login" autocomplete="username" required>' +
          '<label>Пароль</label><div class="password-wrap"><input class="login-input" id="password" type="password" autocomplete="current-password" required>' +
          '<button class="password-eye" id="passwordEye" type="button">◉</button></div>' +
          '<div class="login-error" id="loginError"></div><button class="login-submit" id="loginSubmit" type="submit">Войти</button>' +
        '</form>' +
      '</section></main>';

    var password = document.getElementById("password");
    document.getElementById("passwordEye").onclick = function () {
      password.type = password.type === "password" ? "text" : "password";
    };

    document.getElementById("loginForm").onsubmit = async function (event) {
      event.preventDefault();

      var submit = document.getElementById("loginSubmit");
      var error = document.getElementById("loginError");
      submit.disabled = true;
      submit.textContent = "Проверка...";
      error.textContent = "";

      try {
        var result = await window.BR_API.login(
          document.getElementById("login").value.trim(),
          password.value
        );

        var user = {
          id: result.admin.id,
          login: result.admin.login,
          nickname: result.admin.nickname,
          position: result.admin.position,
          role: result.admin.role,
          theme: result.admin.theme || "dark",
          token: result.token
        };

        var expires = new Date(result.expires_at).getTime();
        if (!Number.isFinite(expires)) expires = Date.now() + 86400000;

        var lastActivityAt = result.session && result.session.last_activity_at
          ? new Date(result.session.last_activity_at).getTime()
          : Date.now();
        window.BRApp.saveSession(user, expires, true, lastActivityAt);

        // Before opening the panel, remove any legacy service worker/cache.
        // This prevents an old cached page.js from showing a blank screen.
        try {
          if ("serviceWorker" in navigator) {
            var registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(function (registration) {
              return registration.unregister().catch(function () { return false; });
            }));
          }

          if ("caches" in window) {
            var cacheKeys = await caches.keys();
            await Promise.all(cacheKeys.map(function (key) {
              return caches.delete(key);
            }));
          }
        } catch (cacheError) {
          console.warn("[BR AdminTools] Не удалось полностью очистить старый web-cache:", cacheError);
        }

        location.replace("pages/dashboard.html");
      } catch (e) {
        console.warn(
          "[BR AdminTools] Ошибка авторизации:",
          {
            code: e && e.code ? e.code : "LOGIN_ERROR",
            message: e && e.message ? e.message : "Ошибка сервера.",
            status: e && e.status ? e.status : null,
            error: e
          }
        );

        error.textContent =
          e && e.message
            ? e.message
            : "Не удалось выполнить вход.";

        submit.disabled = false;
        submit.textContent = "Войти";
      }
    };
  });
})();
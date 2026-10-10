(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var root = document.getElementById("app");
    root.innerHTML =
      '<main class="login-page"><section class="login-card">' +
        '<div class="login-brand"><img class="login-logo" src="favicon.svg" alt="Логотип Black Russia" width="44" height="44"><div><b>BLACK RUSSIA</b><small>Мурманск • Admin Panel</small></div></div>' +
        '<h1>Авторизация</h1><p>Войдите в панель администрации сервера.</p>' +
        '<form class="login-form" id="loginForm">' +
          '<label for="login">Логин</label><input class="login-input" id="login" name="username" autocomplete="username" required>' +
          '<label for="password">Пароль</label><div class="password-wrap"><input class="login-input" id="password" name="password" type="password" autocomplete="current-password" required>' +
          '<button class="password-eye" id="passwordEye" type="button" aria-label="Показать или скрыть пароль">◉</button></div>' +
          '<div class="login-error" id="loginError"></div>' +
          '<button class="login-submit" id="loginSubmit" type="submit">Войти</button>' +
          '<button class="login-save-data" id="saveLoginData" type="button">Сохранить данные</button>' +
          '<button class="login-clear-data" id="clearLoginData" type="button" hidden>Удалить сохранённые данные</button>' +
          '<div class="login-save-status" id="loginSaveStatus" aria-live="polite"></div>' +
          '<p class="login-save-hint">Данные хранятся в этом браузере без шифрования. Используйте только на личном устройстве.</p>' +
        '</form>' +
      '</section></main>';

    var savedCredentialsKey = "br_saved_credentials_v1";
    var loginInput = document.getElementById("login");
    var password = document.getElementById("password");
    var saveStatus = document.getElementById("loginSaveStatus");
    var saveButton = document.getElementById("saveLoginData");
    var clearSavedButton = document.getElementById("clearLoginData");

    function setSaveStatus(message, isError) {
      saveStatus.textContent = message || "";
      saveStatus.classList.toggle("is-error", !!isError);
      saveStatus.classList.toggle("is-success", !!message && !isError);
    }

    function setSavedControls(isSaved) {
      clearSavedButton.hidden = !isSaved;
    }

    function loadSavedCredentials() {
      try {
        var raw = localStorage.getItem(savedCredentialsKey);
        if (!raw) return;

        var saved = JSON.parse(raw);
        if (
          !saved ||
          typeof saved.login !== "string" ||
          typeof saved.password !== "string" ||
          !saved.login ||
          !saved.password
        ) {
          localStorage.removeItem(savedCredentialsKey);
          return;
        }

        loginInput.value = saved.login;
        password.value = saved.password;
        setSavedControls(true);
        setSaveStatus("Сохранённые данные загружены.", false);
      } catch (storageError) {
        console.warn("[BR AdminTools] Не удалось прочитать сохранённые данные входа:", storageError);
      }
    }

    document.getElementById("passwordEye").onclick = function () {
      password.type = password.type === "password" ? "text" : "password";
    };

    saveButton.onclick = function () {
      var loginValue = loginInput.value.trim();
      var passwordValue = password.value;

      if (!loginValue || !passwordValue) {
        setSaveStatus("Сначала заполните логин и пароль.", true);
        if (!loginValue) loginInput.focus();
        else password.focus();
        return;
      }

      try {
        localStorage.setItem(savedCredentialsKey, JSON.stringify({
          login: loginValue,
          password: passwordValue
        }));
        setSavedControls(true);
        setSaveStatus("Логин и пароль сохранены на этом устройстве.", false);
      } catch (storageError) {
        console.warn("[BR AdminTools] Не удалось сохранить данные входа:", storageError);
        setSaveStatus("Браузер не разрешил сохранить данные.", true);
      }
    };

    clearSavedButton.onclick = function () {
      try {
        localStorage.removeItem(savedCredentialsKey);
        setSavedControls(false);
        setSaveStatus("Сохранённые данные удалены.", false);
      } catch (storageError) {
        console.warn("[BR AdminTools] Не удалось удалить сохранённые данные:", storageError);
        setSaveStatus("Не удалось удалить сохранённые данные.", true);
      }
    };

    loadSavedCredentials();

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

        // Keep service workers registered: the push notification worker
        // must remain active after login. Cache-busted asset URLs force new scripts.
        try {
          if ("caches" in window) {
            var cacheKeys = await caches.keys();
            await Promise.all(cacheKeys.map(function (key) {
              return caches.delete(key);
            }));
          }
        } catch (cacheError) {
          console.warn("[BR AdminTools] Не удалось очистить старый web-cache:", cacheError);
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
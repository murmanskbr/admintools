(function () {
  "use strict";

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function sessionUser() {
    if (!window.BRApp || typeof window.BRApp.getSession !== "function") {
      return null;
    }

    var session = window.BRApp.getSession();
    return session && session.user
      ? session.user
      : null;
  }

  function showStatus(root, message, ok) {
    if (!root) return;

    root.hidden = false;
    root.className =
      "settings-status " +
      (ok ? "settings-status-ok" : "settings-status-error");
    root.textContent = message;
  }


  function insertPersonalCard(user) {
    if (!user) return;
    if (document.getElementById("pushPersonalSettingsCard")) return;

    var grid = document.querySelector(".settings-grid");
    if (!grid) return;

    var card = document.createElement("section");
    card.className = "box settings-card personal-push-settings";
    card.id = "pushPersonalSettingsCard";
    card.innerHTML =
      '<div class="settings-card-head">' +
        '<div><small>УВЕДОМЛЕНИЯ</small><h2>Push-уведомления</h2></div>' +
        '<span>Настройка действует только на этом устройстве.</span>' +
      '</div>' +
      '<p class="muted">Включите Push, чтобы получать важные уведомления администрации, даже когда сайт закрыт. Для телефона и компьютера настройка выполняется отдельно.</p>' +
      '<div class="push-personal-head">' +
        '<div><b id="pushPersonalStatusText">Проверка состояния…</b><small id="pushPersonalDeviceText" class="muted"></small></div>' +
        '<span id="pushPersonalStatusBadge" class="badge badge-gray">Проверка</span>' +
      '</div>' +
      '<div class="form-actions">' +
        '<button class="button button-primary" id="togglePersonalPush" type="button" disabled>Проверка…</button>' +
        '<button class="button button-secondary" id="refreshPersonalPush" type="button">Обновить</button>' +
      '</div>' +
      '<div id="personalPushMessage" class="settings-status" hidden></div>';

    grid.appendChild(card);

    var button = document.getElementById("togglePersonalPush");
    var refresh = document.getElementById("refreshPersonalPush");
    var statusText = document.getElementById("pushPersonalStatusText");
    var deviceText = document.getElementById("pushPersonalDeviceText");
    var badge = document.getElementById("pushPersonalStatusBadge");
    var message = document.getElementById("personalPushMessage");
    var currentStatus = null;
    var busy = false;

    function statusMessage(text, ok) {
      if (!message) return;
      message.hidden = !text;
      message.className = "settings-status " + (ok ? "settings-status-ok" : "settings-status-error");
      message.textContent = text || "";
    }

    function renderStatus(value) {
      currentStatus = value || {};
      var supported = !!currentStatus.supported;
      var permission = String(currentStatus.permission || "unsupported");
      var enabled = !!currentStatus.localEnabled;
      var browserSubscribed = !!currentStatus.browserSubscribed;

      if (!supported || permission === "unsupported") {
        statusText.textContent = "Этот браузер не поддерживает Push";
        badge.textContent = "Недоступно";
        badge.className = "badge badge-gray";
        button.disabled = true;
        button.textContent = "Недоступно";
      } else if (permission === "denied") {
        statusText.textContent = "Разрешение запрещено в браузере";
        badge.textContent = "Нет разрешения";
        badge.className = "badge badge-red";
        button.disabled = true;
        button.textContent = "Разрешить в браузере";
      } else if (enabled) {
        statusText.textContent = "Push включены на этом устройстве";
        badge.textContent = "✓ Включены";
        badge.className = "badge badge-green";
        button.disabled = false;
        button.textContent = "Выключить Push";
      } else {
        statusText.textContent = browserSubscribed
          ? "Подписка найдена — требуется синхронизация"
          : "Push выключены на этом устройстве";
        badge.textContent = browserSubscribed ? "Требуется синхронизация" : "Выключены";
        badge.className = "badge badge-gray";
        button.disabled = false;
        button.textContent = "Включить Push";
      }

      deviceText.textContent = currentStatus.serverCount
        ? "Активных устройств в аккаунте: " + currentStatus.serverCount
        : "Подписка будет сохранена отдельно для этого устройства.";
    }

    async function loadStatus() {
      if (busy) return;
      busy = true;
      button.disabled = true;
      refresh.disabled = true;
      button.textContent = "Проверка…";
      statusMessage("", true);

      try {
        if (!window.BRPush || typeof window.BRPush.status !== "function") {
          throw new Error("Модуль Push не загрузился. Обновите страницу.");
        }
        var value = await window.BRPush.status(user.token);
        renderStatus(value);
      } catch (error) {
        statusText.textContent = "Не удалось проверить состояние Push";
        badge.textContent = "Ошибка";
        badge.className = "badge badge-red";
        button.disabled = true;
        button.textContent = "Состояние недоступно";
        statusMessage(error.message || "Не удалось загрузить состояние Push. Нажмите «Обновить».", false);
      } finally {
        busy = false;
        refresh.disabled = false;
      }
    }

    button.onclick = async function () {
      if (busy) return;
      busy = true;
      button.disabled = true;
      refresh.disabled = true;
      button.textContent = "Обновление…";
      statusMessage("", true);

      try {
        if (!window.BRPush) throw new Error("Модуль Push не загрузился. Обновите страницу.");
        if (currentStatus && currentStatus.localEnabled) {
          await window.BRPush.disable(user.token);
          statusMessage("Push отключены на этом устройстве.", true);
        } else {
          await window.BRPush.enable(user.token);
          statusMessage("Push успешно включены на этом устройстве.", true);
        }
        var value = await window.BRPush.status(user.token);
        renderStatus(value);
      } catch (error) {
        statusMessage(error.message || "Не удалось изменить настройку Push.", false);
        button.disabled = false;
        button.textContent = currentStatus && currentStatus.localEnabled
          ? "Выключить Push"
          : "Повторить";
      } finally {
        busy = false;
        refresh.disabled = false;
      }
    };

    refresh.onclick = loadStatus;
    loadStatus();
  }

  function insertCard(user) {
    if (!user || user.role !== "management") return;
    if (document.getElementById("pushProjectConfigCard")) return;

    var grid = document.querySelector(".settings-grid");
    if (!grid) return;

    var card = document.createElement("section");
    card.className =
      "box settings-card settings-push-config-card";
    card.id = "pushProjectConfigCard";

    card.innerHTML =
      '<div class="settings-card-head">' +
        '<div><small>СИСТЕМА PUSH</small><h2>Настройка push-уведомлений</h2></div>' +
        '<span>Ключи задаются один раз для всего проекта и используются всеми администраторами.</span>' +
      '</div>' +

      '<div class="push-setup-guide">' +
        '<div class="push-setup-step"><span>1</span><div><b>Сгенерируйте пару VAPID-ключей</b><p>Устанавливать дополнительные программы не нужно. Откройте <a href="https://allthedamn.tools/vapid-key-generator/" target="_blank" rel="noopener noreferrer">браузерный генератор VAPID-ключей</a> и нажмите Generate VAPID Keys.</p></div></div>' +
        '<div class="push-setup-step"><span>2</span><div><b>Скопируйте результат</b><p>Из результата возьмите <b>Public Key</b> и <b>Private Key</b>. Новую пару нужно создавать только один раз для этого проекта. Приватный ключ никому не передавайте.</p></div></div>' +
        '<div class="push-setup-step"><span>3</span><div><b>Заполните поля ниже</b><p>Публичный ключ вставьте в первое поле, приватный — во второе. Публичный ключ используется сайтом, приватный хранится на сервере и после сохранения обратно не показывается.</p></div></div>' +
        '<div class="push-setup-step"><span>4</span><div><b>Сохраните настройки</b><p>После этого администраторы смогут самостоятельно включить push в своих настройках на Android и Windows.</p></div></div>' +
      '</div>' +

      '<form id="pushProjectConfigForm">' +
        '<div class="form-grid">' +
          '<div class="form-field form-full">' +
            '<label for="pushProjectPublicKey">Публичный VAPID-ключ</label>' +
            '<textarea id="pushProjectPublicKey" class="form-textarea" rows="3" maxlength="1024" autocomplete="off" spellcheck="false" required placeholder="Вставьте значение Public Key"></textarea>' +
          '</div>' +
          '<div class="form-field form-full">' +
            '<label for="pushProjectPrivateKey">Приватный VAPID-ключ</label>' +
            '<input id="pushProjectPrivateKey" class="form-input" type="password" maxlength="1024" autocomplete="new-password" placeholder="Вставьте значение Private Key (при первой настройке)">' +
          '</div>' +
        '</div>' +
        '<p class="settings-hint">После сохранения приватный ключ очищается из поля. При обычном сохранении его можно оставить пустым — будет использовано уже сохранённое значение.</p>' +
        '<div class="form-actions">' +
          '<button class="button button-primary" id="pushProjectConfigSubmit" type="submit">Сохранить VAPID-настройки</button>' +
        '</div>' +
      '</form>' +
      '<div id="pushProjectConfigStatus" class="settings-status" hidden></div>';

    grid.appendChild(card);

    var form = document.getElementById("pushProjectConfigForm");
    var publicKey = document.getElementById("pushProjectPublicKey");
    var privateKey = document.getElementById("pushProjectPrivateKey");
    var submit = document.getElementById("pushProjectConfigSubmit");
    var status = document.getElementById("pushProjectConfigStatus");

    async function load() {
      try {
        var result = await window.BR_API.pushConfigGet(user.token);

        publicKey.value =
          result && result.public_key
            ? result.public_key
            : "";

        if (result && result.configured) {
          showStatus(
            status,
            "VAPID-настройки сохранены. Система готова принимать push-подписки.",
            true
          );
        } else {
          showStatus(
            status,
            "VAPID-настройки ещё не сохранены.",
            false
          );
        }
      } catch (error) {
        showStatus(
          status,
          error.message || "Не удалось загрузить настройки push.",
          false
        );
      }
    }

    form.onsubmit = async function (event) {
      event.preventDefault();

      var publicValue = publicKey.value.trim();
      var privateValue = privateKey.value.trim();

      if (!publicValue) {
        showStatus(
          status,
          "Укажите публичный VAPID-ключ.",
          false
        );
        publicKey.focus();
        return;
      }

      submit.disabled = true;
      submit.textContent = "Сохранение…";

      try {
        await window.BR_API.pushConfigUpdate(
          user.token,
          {
            public_key: publicValue,
            private_key: privateValue
          }
        );

        privateKey.value = "";

        showStatus(
          status,
          "VAPID-настройки сохранены. Теперь администраторы могут включать push на своих устройствах.",
          true
        );
      } catch (error) {
        showStatus(
          status,
          error.message || "Не удалось сохранить VAPID-настройки.",
          false
        );
      } finally {
        submit.disabled = false;
        submit.textContent = "Сохранить VAPID-настройки";
      }
    };

    load();
  }


  function insertManagementRosterCard(user) {
    if (!user || user.role !== "management") return;

    var root = document.getElementById("managementPushRosterRoot");
    if (!root || root.dataset.initialized === "1") return;
    root.dataset.initialized = "1";
    root.innerHTML = '<div class="empty">Загрузка подписок…</div>';

    function render(result) {
      var list = Array.isArray(result && result.administrators) ? result.administrators.slice() : [];
      var enabled = list.filter(function (item) { return !!item.enabled; }).length;
      list.sort(function (a, b) {
        return String(a.nickname || "").localeCompare(String(b.nickname || ""), "ru");
      });

      var rows = list.length ? list.map(function (item) {
        var devices = Array.isArray(item.devices) ? item.devices.map(function (device) {
          return device === "phone" ? "Android" : device === "computer" ? "Windows / ПК" : device;
        }) : [];
        var status = (item.permission === "denied" || item.permission_granted === false)
          ? '<span class="badge badge-red">Нет разрешения</span>'
          : item.enabled
            ? '<span class="badge badge-green">✓ Включены</span>'
            : '<span class="badge badge-gray">Выключены</span>';
        return '<tr data-push-nickname="' + esc(String(item.nickname || "").toLowerCase()) + '" data-push-enabled="' + (item.enabled ? "yes" : "no") + '">' +
          '<td><b>' + esc(item.nickname || "—") + '</b></td>' +
          '<td>' + esc(item.position || "—") + '</td>' +
          '<td>' + status + '</td>' +
          '<td>' + esc(String(devices.length)) + '</td></tr>';
      }).join("") : '<tr><td colspan="4">Активных аккаунтов нет.</td></tr>';

      root.innerHTML =
        '<div class="page-toolbar push-status-head"><div><span class="badge badge-blue">Включено ' + esc(String(enabled)) + ' из ' + esc(String(list.length)) + '</span></div>' +
        '<button class="button button-secondary" id="refreshPushRoster" type="button">Обновить</button></div>' +
        '<div class="push-roster-filters"><input id="pushRosterSearch" class="form-input" type="search" placeholder="Поиск по никнейму" aria-label="Поиск по никнейму">' +
        '<div class="push-status-chips" role="group" aria-label="Push-статус"><button type="button" class="notification-chip is-active" data-push-filter="">Все</button><button type="button" class="notification-chip" data-push-filter="yes">Включены</button><button type="button" class="notification-chip" data-push-filter="no">Выключены</button></div></div>' +
        '<div class="table-box push-status-table-box"><table id="pushRosterTable"><thead><tr><th>Никнейм</th><th>Должность</th><th>Push</th><th>Устройства</th></tr></thead><tbody>' + rows + '</tbody></table></div>';

      function applyFilter() {
        var query = document.getElementById("pushRosterSearch").value.trim().toLowerCase();
        var selected = root.querySelector("[data-push-filter].is-active");
        var status = selected ? selected.dataset.pushFilter : "";
        root.querySelectorAll("#pushRosterTable tbody tr[data-push-nickname]").forEach(function (row) {
          row.style.display = (!query || row.dataset.pushNickname.indexOf(query) !== -1) &&
            (!status || row.dataset.pushEnabled === status) ? "" : "none";
        });
      }

      document.getElementById("pushRosterSearch").addEventListener("input", applyFilter);
      root.querySelectorAll("[data-push-filter]").forEach(function (chip) {
        chip.onclick = function () {
          root.querySelectorAll("[data-push-filter]").forEach(function (item) {
            item.classList.toggle("is-active", item === chip);
          });
          applyFilter();
        };
      });

      var refresh = document.getElementById("refreshPushRoster");
      if (refresh) refresh.onclick = load;
    }

    async function load() {
      var refresh = document.getElementById("refreshPushRoster");
      if (refresh) {
        refresh.disabled = true;
        refresh.textContent = "Обновление…";
      }
      try {
        var result = await window.BR_API.pushStatusAll(user.token);
        render(result || {});
      } catch (error) {
        root.innerHTML = '<div class="empty">' + esc(error.message || "Не удалось загрузить подписки администрации.") + '</div>';
      } finally {
        refresh = document.getElementById("refreshPushRoster");
        if (refresh) {
          refresh.disabled = false;
          refresh.textContent = "Обновить";
        }
      }
    }

    load();
  }

  function boot() {
    var user = sessionUser();
    if (!user) return;

    window.setTimeout(function () {
      if (document.querySelector(".settings-grid")) {
        insertPersonalCard(user);
        if (user.role === "management") insertCard(user);
      }
      if (user.role === "management") insertManagementRosterCard(user);
    }, 0);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

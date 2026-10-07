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

  function insertCard(user) {
    if (!user || user.role !== "management") return;
    if (document.getElementById("pushProjectConfigCard")) return;

    var grid = document.querySelector(".settings-grid");
    if (!grid) return;

    var cards = grid.querySelectorAll(".settings-card");
    var anchor = cards.length > 1
      ? cards[1]
      : cards[0];

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
        '<div class="push-setup-step"><span>1</span><div><b>Сгенерируйте пару VAPID-ключей</b><p>На компьютере с установленным Node.js выполните:</p><code>npx web-push generate-vapid-keys --json</code></div></div>' +
        '<div class="push-setup-step"><span>2</span><div><b>Скопируйте результат</b><p>Из результата возьмите <b>publicKey</b> и <b>privateKey</b>. Новую пару нужно создавать только один раз для этого проекта.</p></div></div>' +
        '<div class="push-setup-step"><span>3</span><div><b>Заполните поля ниже</b><p>Публичный ключ используется клиентом. Приватный ключ хранится на сервере и после сохранения обратно не показывается.</p></div></div>' +
        '<div class="push-setup-step"><span>4</span><div><b>Сохраните настройки</b><p>После этого администраторы смогут самостоятельно включить push в своих настройках на Android и Windows.</p></div></div>' +
      '</div>' +

      '<form id="pushProjectConfigForm">' +
        '<div class="form-grid">' +
          '<div class="form-field form-full">' +
            '<label for="pushProjectPublicKey">Публичный VAPID-ключ</label>' +
            '<textarea id="pushProjectPublicKey" class="form-textarea" rows="3" maxlength="1024" autocomplete="off" spellcheck="false" required placeholder="Вставьте значение publicKey"></textarea>' +
          '</div>' +
          '<div class="form-field form-full">' +
            '<label for="pushProjectPrivateKey">Приватный VAPID-ключ</label>' +
            '<input id="pushProjectPrivateKey" class="form-input" type="password" maxlength="1024" autocomplete="new-password" placeholder="Вставьте значение privateKey (при первой настройке)">' +
          '</div>' +
        '</div>' +
        '<p class="settings-hint">После сохранения приватный ключ очищается из поля. При обычном сохранении его можно оставить пустым — будет использовано уже сохранённое значение.</p>' +
        '<div class="form-actions">' +
          '<button class="button button-primary" id="pushProjectConfigSubmit" type="submit">Сохранить VAPID-настройки</button>' +
        '</div>' +
      '</form>' +
      '<div id="pushProjectConfigStatus" class="settings-status" hidden></div>';

    if (anchor && anchor.nextSibling) {
      grid.insertBefore(card, anchor.nextSibling);
    } else {
      grid.appendChild(card);
    }

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

  function boot() {
    var user = sessionUser();

    if (user && user.role === "management") {
      window.setTimeout(function () {
        insertCard(user);
      }, 0);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

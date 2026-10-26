(function () {
  "use strict";

  var E = window.BRApp.esc;

  function dateTime(value) {
    if (!value) return "—";
    var d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("ru-RU");
  }

  function generalStatus(status) {
    return String(status || "") === "answered"
      ? '<span class="badge badge-green">Отвечено</span>'
      : '<span class="badge badge-yellow">⏳ На рассмотрении</span>';
  }

  function typeLabel(value) {
    var v = String(value || "").toLowerCase();
    if (v === "complaint") return "Жалоба";
    if (v === "suggestion") return "Предложение";
    return v === "question" ? "Вопрос" : "Обращение";
  }

  function boot() {
    var session = window.BRApp.getSession();
    if (!session || !session.user) {
      window.BRApp.clearSession();
      location.replace(new URL("../index.html", location.href).href);
      return;
    }

    window.BRApp.init({
      managementOnly: true,
      title: "Обращения администрации",
      subtitle: "Вопросы, жалобы и предложения состава",

      render: function () {
        return '<div class="page-toolbar">' +
          '<div><small>ОБРАТНАЯ СВЯЗЬ</small><b>Обращения администраторов</b><p class="muted">Вопросы, жалобы и предложения. Заявки на неактив находятся в разделе «Нормативы».</p></div>' +
          '<button class="button button-secondary" id="generalRequestsRefresh" type="button">↻ Обновить</button>' +
          '</div>' +
          '<div class="stats-toolbar-actions" style="margin-bottom:14px">' +
            '<button class="small-button is-active" id="generalAll" type="button">Все</button>' +
            '<button class="small-button" id="generalPending" type="button">На рассмотрении</button>' +
            '<button class="small-button" id="generalAnswered" type="button">Отвеченные</button>' +
          '</div>' +
          '<div id="generalRoot"><div class="box"><div class="empty">Загрузка обращений...</div></div></div>';
      },

      bind: function () {
        var generalList = [];
        var generalFilter = "";
        var root = document.getElementById("generalRoot");
        var refresh = document.getElementById("generalRequestsRefresh");
        var generalButtons = [
          document.getElementById("generalAll"),
          document.getElementById("generalPending"),
          document.getElementById("generalAnswered")
        ];
        var generalValues = ["", "pending", "answered"];

        function sessionToken() {
          var current = window.BRApp.getSession();
          if (!current || !current.user || !current.user.token) {
            throw new Error("Сессия истекла. Войдите в панель заново.");
          }
          return current.user.token;
        }

        function setButtons(active) {
          generalButtons.forEach(function (button) {
            if (button) button.classList.toggle("is-active", button === active);
          });
        }

        function renderGeneral() {
          if (!root) return;
          var pendingCount = generalList.filter(function (x) { return x.status === "pending"; }).length;
          if (generalButtons[1]) generalButtons[1].textContent = "На рассмотрении" + (pendingCount ? " " + pendingCount : "");
          var filtered = generalFilter
            ? generalList.filter(function (x) { return x.status === generalFilter; })
            : generalList.slice();
          filtered.sort(function (a, b) {
            return Number(b.status === "pending") - Number(a.status === "pending");
          });

          if (!filtered.length) {
            root.innerHTML = '<div class="box"><div class="empty">Обращений по выбранному фильтру нет.</div></div>';
            return;
          }

          var rows = filtered.map(function (item) {
            var id = Number(item.id || item.request_id || 0);
            var action = item.status === "pending" || item.status === "answered"
              ? '<div class="form-field"><label for="generalReply' + E(id) + '">Ответ руководства</label><textarea class="form-textarea" id="generalReply' + E(id) + '" maxlength="1000" placeholder="Напишите ответ администратору">' + E(item.management_comment || "") + '</textarea></div><button class="button button-primary" type="button" data-general-reply="' + E(id) + '">Отправить ответ</button>'
              : '<span class="muted">' + E("Рассмотрено" + (item.commented_at ? " · " + dateTime(item.commented_at) : "")) + '</span>';

            return '<tr class="' + (String(item.status || "") === "answered" ? "card-ok" : "card-wait") + '">' +
              '<td><span class="request-card-title">' + E(item.nickname || item.admin_nickname || "—") + '</span></td>' +
              '<td>' + E(typeLabel(item.request_type)) + '</td>' +
              '<td><div>' + E(item.message || "—") + '</div><small class="muted">' + E(dateTime(item.created_at)) + '</small></td>' +
              '<td>' + generalStatus(item.status) + '</td>' +
              '<td>' + E(item.management_comment || "—") + '</td>' +
              '<td>' + action + '</td>' +
            '</tr>';
          }).join("");

          root.innerHTML = '<div class="box table-box"><table>' +
            '<thead><tr><th>Никнейм</th><th>Тип</th><th>Обращение</th><th>Статус</th><th>Ответ руководства</th><th>Действие</th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table></div>';

          root.querySelectorAll("[data-general-reply]").forEach(function (button) {
            button.onclick = async function () {
              var id = Number(button.dataset.generalReply);
              var field = document.getElementById("generalReply" + id);
              var comment = field ? field.value.trim() : "";
              if (!comment) {
                await siteDialog({title:"Нужен ответ",description:"Введите ответ перед отправкой."});
                return;
              }
              button.disabled = true;
              button.textContent = "Отправка…";
              try {
                await window.BR_API.generalRequestReply(sessionToken(), id, comment);
                await siteDialog({title:"Ответ отправлен",description:"Комментарий сохранён."});
                await load(true);
              } catch (error) {
                await siteDialog({title:"Ошибка",description:error.message || "Не удалось отправить ответ."});
                button.disabled = false;
                button.textContent = "Отправить ответ";
              }
            };
          });
        }

        function cachedLoad(force) {
          var current = window.BRApp.getSession();
          var cacheKey = "br_cache_v1:" + current.user.id + ":requestsAllGeneral";
          var saved = null;
          try { saved = JSON.parse(sessionStorage.getItem(cacheKey) || "null"); } catch (_) {}
          if (saved && Array.isArray(saved.data)) {
            generalList = saved.data;
            renderGeneral();
            if (!force && Date.now() - saved.time < 300000) return Promise.resolve();
          }
          return Promise.resolve().then(function () {
            return window.BR_API.generalRequestsAll(sessionToken(), "");
          }).then(function (result) {
            generalList = Array.isArray(result && result.requests) ? result.requests : [];
            try { sessionStorage.setItem(cacheKey, JSON.stringify({time:Date.now(),data:generalList})); } catch (_) {}
            renderGeneral();
          });
        }

        async function load(force) {
          if (refresh) { refresh.disabled = true; refresh.textContent = "Загрузка…"; }
          try {
            await cachedLoad(!!force);
          } catch (error) {
            root.innerHTML = '<div class="box"><div class="empty">' + E(error.message || "Не удалось загрузить обращения с сервера.") + '</div></div>';
          } finally {
            if (refresh) { refresh.disabled = false; refresh.textContent = "↻ Обновить"; }
          }
        }

        function siteDialog(options) {
          return new Promise(function (resolve) {
            var backdrop = document.createElement("div");
            backdrop.className = "modal-backdrop";
            backdrop.innerHTML = '<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="requestDialogTitle" style="width:min(440px,100%)">' +
              '<div class="modal-head"><h2 id="requestDialogTitle">' + E(options.title) + '</h2><button type="button" class="modal-close" data-cancel aria-label="Закрыть">×</button></div>' +
              '<p class="muted">' + E(options.description || "") + '</p>' +
              '<div class="form-actions" style="justify-content:flex-end;margin-top:16px"><button type="button" class="button button-primary" data-confirm>Понятно</button></div></div>';
            document.body.appendChild(backdrop);
            var previous = document.activeElement;
            function close() {
              document.removeEventListener("keydown", onKey);
              backdrop.remove();
              if (previous && previous.focus) previous.focus();
              resolve();
            }
            function onKey(e) { if (e.key === "Escape") close(); }
            document.addEventListener("keydown", onKey);
            backdrop.querySelectorAll("[data-cancel], [data-confirm]").forEach(function (button) { button.onclick = close; });
            backdrop.onclick = function (e) { if (e.target === backdrop) close(); };
            backdrop.querySelector("[data-confirm]").focus();
          });
        }

        generalButtons.forEach(function (button, index) {
          if (button) button.onclick = function () {
            generalFilter = generalValues[index];
            setButtons(button);
            renderGeneral();
          };
        });

        if (refresh) refresh.onclick = function () { load(true); };
        load(false);

        window.addEventListener("br:remote-data-changed", function (event) {
          var action = event && event.detail ? event.detail.action : "";
          if (["general_request_create", "general_request_reply", "access_manage"].indexOf(action) === -1) return;
          load(true);
        });

        window.addEventListener("br:refresh-visible-data", function () {
          if (document.visibilityState === "hidden") return;
          load(false);
        });
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
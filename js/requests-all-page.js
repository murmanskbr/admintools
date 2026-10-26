
(function () {
  "use strict";

  var E = window.BRApp.esc;

  function dateOnly(value) {
    if (!value) return "—";
    var d = new Date(String(value) + "T00:00:00");
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("ru-RU");
  }

  function dateTime(value) {
    if (!value) return "—";
    var d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("ru-RU");
  }

  function inactiveStatus(status) {
    var map = {
      pending: ["На рассмотрении", "badge-yellow"],
      approved: ["Одобрено", "badge-green"],
      rejected: ["Отклонено", "badge-red"]
    };
    var x = map[String(status || "")] || ["Неизвестно", ""];
    return '<span class="badge ' + x[1] + '">' + ({approved:'✓ ',pending:'⏳ ',rejected:'✕ '}[String(status || '')] || '') + E(x[0]) + "</span>";
  }

  function generalStatus(status) {
    return String(status || "") === "answered"
      ? '<span class="badge badge-green">Отвечено</span>'
      : '<span class="badge badge-yellow">⏳ На рассмотрении</span>';
  }

  function typeLabel(value) {
    var v = String(value || "").toLowerCase();
    if (v === "group") return "Период";
    if (v === "single") return "Один день";
    if (v === "complaint") return "Жалоба";
    if (v === "suggestion") return "Предложение";
    return v === "question" ? "Вопрос" : "Одиночный";
  }

  function inactivePeriod(item) {
    var start = String(item && item.start_date || "");
    var end = String(item && item.end_date || "");
    if (!start) return "—";
    return start === end ? dateOnly(start) : dateOnly(start) + " — " + dateOnly(end);
  }

  function inactiveDuration(item) {
    var start = String(item && item.start_date || "").trim();
    var end = String(item && item.end_date || "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return "—";
    }

    var startMs = Date.parse(start + "T00:00:00Z");
    var endMs = Date.parse(end + "T00:00:00Z");

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
      return "—";
    }

    var days = Math.floor((endMs - startMs) / 86400000) + 1;

    if (days === 1) return "1 день";
    if (days >= 2 && days <= 4) return String(days) + " дня";
    return String(days) + " дней";
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
      subtitle: "Неактивы и обращения состава",

      render: function () {
        return '<div class="box">' +
          '<div class="stats-toolbar-actions">' +
            '<button class="button button-secondary is-active" id="managementInactiveTab" type="button">Неактивы</button>' +
            '<button class="button button-secondary" id="managementGeneralTab" type="button">Обращения</button>' +
          '</div>' +
        '</div>' +

        '<section id="managementInactiveSection">' +
          '<div class="page-toolbar">' +
            '<div><small>НЕАКТИВЫ</small><b>Заявки на неактив</b></div>' +
            '<div class="stats-toolbar-actions">' +
              '<button class="small-button is-active" id="inactiveAll" type="button">Все</button>' +
              '<button class="small-button" id="inactivePending" type="button">На рассмотрении</button>' +
              '<button class="small-button" id="inactiveApproved" type="button">Одобрены</button>' +
              '<button class="small-button" id="inactiveRejected" type="button">Отклонены</button>' +
            '</div>' +
          '</div>' +
          '<div id="inactiveRoot"><div class="box"><div class="empty">Загрузка заявок...</div></div></div>' +
        '</section>' +

        '<section id="managementGeneralSection" hidden>' +
          '<div class="page-toolbar">' +
            '<div><small>ОБРАЩЕНИЯ</small><b>Обращения администрации</b></div>' +
            '<div class="stats-toolbar-actions">' +
              '<button class="small-button is-active" id="generalAll" type="button">Все</button>' +
              '<button class="small-button" id="generalPending" type="button">На рассмотрении</button>' +
              '<button class="small-button" id="generalAnswered" type="button">Отвеченные</button>' +
            '</div>' +
          '</div>' +
          '<div id="generalRoot"><div class="box"><div class="empty">Загрузка обращений...</div></div></div>' +
        '</section>';
      },

      bind: function () {
        var inactiveList = [];
        var generalList = [];
        var inactiveFilter = "";
        var generalFilter = "";

        var inactiveSection = document.getElementById("managementInactiveSection");
        var generalSection = document.getElementById("managementGeneralSection");
        var inactiveTab = document.getElementById("managementInactiveTab");
        var generalTab = document.getElementById("managementGeneralTab");

        function sessionToken() {
          var current = window.BRApp.getSession();
          if (!current || !current.user || !current.user.token) {
            throw new Error("Сессия истекла. Войдите в панель заново.");
          }
          return current.user.token;
        }

        function setSection(name) {
          var showInactive = name !== "general";
          inactiveSection.hidden = !showInactive;
          generalSection.hidden = showInactive;
          inactiveTab.classList.toggle("is-active", showInactive);
          generalTab.classList.toggle("is-active", !showInactive);
        }

        function setButtons(buttons, active) {
          buttons.forEach(function (button) {
            if (button) button.classList.toggle("is-active", button === active);
          });
        }

        function renderInactive() {
          var root = document.getElementById("inactiveRoot");
          updateCounters();
          var filtered = inactiveFilter
            ? inactiveList.filter(function (x) { return x.status === inactiveFilter; })
            : inactiveList.slice();
          filtered.sort(pendingFirst);

          if (!filtered.length) {
            root.innerHTML = '<div class="box"><div class="empty">Заявок по выбранному фильтру нет.</div></div>';
            return;
          }

          var rows = filtered.map(function (item) {
            var action = item.status === "pending"
              ? '<div class="form-actions">' +
                  '<button class="small-button" type="button" data-inactive-approve="' + E(item.id) + '">Одобрить</button>' +
                  '<button class="small-button" type="button" data-inactive-reject="' + E(item.id) + '">Отклонить</button>' +
                '</div>'
              : '<span class="muted">' + E("Рассмотрено" + (item.reviewed_at ? " · " + dateTime(item.reviewed_at) : "")) + '</span>';

            return '<tr class="' + ({approved:'card-ok',pending:'card-wait',rejected:'card-bad'}[String(item.status || '')] || '') + '">' +
              '<td><span class="request-card-title">' + E(item.nickname || "—") + '</span><span class="request-mobile-status">' + inactiveStatus(item.status) + '</span></td>' +
              '<td>' + E(typeLabel(item.inactive_type)) + '</td>' +
              '<td>' + E(inactivePeriod(item)) + '</td>' +
              '<td><b>' + E(inactiveDuration(item)) + '</b></td>' +
              '<td>' + E(item.reason || "—") + '</td>' +
              '<td>' + inactiveStatus(item.status) + '</td>' +
              '<td>' + E(item.review_comment || "—") + '</td>' +
              '<td>' + action + '</td>' +
            '</tr>';
          }).join("");

          root.innerHTML = '<div class="box table-box"><table>' +
            '<thead><tr><th>Никнейм</th><th>Тип</th><th>Период</th><th>Дней</th><th>Причина</th><th>Статус</th><th>Комментарий</th><th>Действие</th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table></div>';

          root.querySelectorAll("[data-inactive-approve]").forEach(function (button) {
            button.onclick = function () { reviewInactive(Number(button.dataset.inactiveApprove), "approved"); };
          });

          root.querySelectorAll("[data-inactive-reject]").forEach(function (button) {
            button.onclick = function () { reviewInactive(Number(button.dataset.inactiveReject), "rejected"); };
          });
        }

        function renderGeneral() {
          var root = document.getElementById("generalRoot");
          updateCounters();
          var filtered = generalFilter
            ? generalList.filter(function (x) { return x.status === generalFilter; })
            : generalList.slice();
          filtered.sort(pendingFirst);

          if (!filtered.length) {
            root.innerHTML = '<div class="box"><div class="empty">Обращений по выбранному фильтру нет.</div></div>';
            return;
          }

          var rows = filtered.map(function (item) {
            var action = item.status === "pending"
              ? '<button class="small-button" type="button" data-general-reply="' + E(item.id) + '">Ответить</button>'
              : '<span class="muted">' + E("Рассмотрено" + (item.commented_at ? " · " + dateTime(item.commented_at) : "")) + '</span>';

            return '<tr class="' + (String(item.status || '') === 'answered' ? 'card-ok' : 'card-wait') + '">' +
              '<td><span class="request-card-title">' + E(item.nickname || "—") + '</span><span class="request-mobile-status">' + generalStatus(item.status) + '</span></td>' +
              '<td>' + E(typeLabel(item.request_type)) + '</td>' +
              '<td>' + E(item.message || "—") + '</td>' +
              '<td>' + generalStatus(item.status) + '</td>' +
              '<td>' + E(item.management_comment || "—") + '</td>' +
              '<td>' + action + '</td>' +
            '</tr>';
          }).join("");

          root.innerHTML = '<div class="box table-box"><table>' +
            '<thead><tr><th>Никнейм</th><th>Тип</th><th>Обращение</th><th>Статус</th><th>Комментарий руководства</th><th>Действие</th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table></div>';

          root.querySelectorAll("[data-general-reply]").forEach(function (button) {
            button.onclick = function () { replyGeneral(Number(button.dataset.generalReply)); };
          });
        }

        function pendingFirst(a, b) { return Number(b.status === "pending") - Number(a.status === "pending"); }
        function updateCounters() {
          var ip = inactiveList.filter(function(x){return x.status === "pending";}).length;
          var gp = generalList.filter(function(x){return x.status === "pending";}).length;
          inactiveTab.textContent = "Неактивы" + (ip ? " " + ip : "");
          generalTab.textContent = "Обращения" + (gp ? " " + gp : "");
          document.getElementById("inactivePending").textContent = "На рассмотрении " + ip;
          document.getElementById("generalPending").textContent = "На рассмотрении " + gp;
        }
        function cachedLoad(key, fetcher, apply, force) {
          var current = window.BRApp.getSession();
          var cacheKey = "br_cache_v1:" + current.user.id + ":" + key;
          var saved = null;
          try { saved = JSON.parse(sessionStorage.getItem(cacheKey) || "null"); } catch (_) {}
          if (!force && saved && Array.isArray(saved.data)) {
            apply(saved.data);
            if (Date.now() - saved.time < 300000) return Promise.resolve();
          }
          return Promise.resolve().then(fetcher).then(function(result) {
            var list = Array.isArray(result && result.requests) ? result.requests : [];
            try { sessionStorage.setItem(cacheKey, JSON.stringify({time:Date.now(),data:list})); } catch (_) {}
            apply(list);
          });
        }
        function loadInactive(force) {
          return cachedLoad("requestsAllInactive", function() {
            return window.BR_API.inactiveRequestsAll(sessionToken(), "");
          }, function(list) { inactiveList = list; renderInactive(); }, !!force).catch(function(error) {
            document.getElementById("inactiveRoot").innerHTML = '<div class="box"><div class="empty">' + E(error.message || "Не удалось загрузить заявки.") + '</div></div>';
          });
        }
        function loadGeneral(force) {
          return cachedLoad("requestsAllGeneral", function() {
            return window.BR_API.generalRequestsAll(sessionToken(), "");
          }, function(list) { generalList = list; renderGeneral(); }, !!force).catch(function(error) {
            document.getElementById("generalRoot").innerHTML = '<div class="box"><div class="empty">' + E(error.message || "Не удалось загрузить обращения.") + '</div></div>';
          });
        }
        function siteDialog(options) {
          return new Promise(function(resolve) {
            var backdrop = document.createElement("div");
            backdrop.className = "modal-backdrop";
            backdrop.innerHTML = '<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="requestDialogTitle" style="width:min(440px,100%)">' +
              '<div class="modal-head"><h2 id="requestDialogTitle">' + E(options.title) + '</h2><button type="button" class="modal-close" data-cancel aria-label="Закрыть">×</button></div>' +
              '<p class="muted">' + E(options.description || "") + '</p>' +
              (options.comment ? '<label for="requestDialogComment">Комментарий руководства</label><textarea id="requestDialogComment" maxlength="1000" rows="4" style="width:100%;box-sizing:border-box;resize:vertical" placeholder="До 1000 символов"></textarea><small class="muted" id="requestDialogCount">0 / 1000</small>' : '') +
              '<p id="requestDialogError" class="muted" role="alert"></p><div class="form-actions" style="justify-content:flex-end;margin-top:16px"><button type="button" class="button button-secondary" data-cancel>Отмена</button><button type="button" class="button" data-confirm>Подтвердить</button></div></div>';
            document.body.appendChild(backdrop);
            var field = backdrop.querySelector("textarea"), error = backdrop.querySelector("#requestDialogError");
            var previous = document.activeElement;
            function close(value) { document.removeEventListener("keydown", onKey); backdrop.remove(); if(previous && previous.focus) previous.focus(); resolve(value); }
            function onKey(e) { if(e.key === "Escape") close(null); }
            document.addEventListener("keydown", onKey);
            backdrop.querySelectorAll("[data-cancel]").forEach(function(button){button.onclick=function(){close(null);};});
            backdrop.onclick = function(e){if(e.target===backdrop) close(null);};
            if(field) { field.oninput=function(){backdrop.querySelector("#requestDialogCount").textContent=field.value.length+" / 1000";}; field.focus(); }
            else backdrop.querySelector("[data-confirm]").focus();
            backdrop.querySelector("[data-confirm]").onclick=function(){
              var value=field ? field.value.trim() : "";
              if(options.required && !value){error.textContent="Введите комментарий руководства.";field.focus();return;}
              close(value);
            };
          });
        }
        async function reviewInactive(id, status) {
          var comment = await siteDialog({title:status==="approved"?"Одобрить неактив?":"Отклонить неактив?",description:status==="approved"?"Период будет сохранён и автоматически учтён системой.":"Подтвердите отклонение заявки.",comment:true});
          if(comment===null) return;
          try {
            await window.BR_API.inactiveRequestReview(sessionToken(),id,status,comment);
            await siteDialog({title:status==="approved"?"Неактив одобрен":"Заявка отклонена",description:"Действие выполнено."});
            loadInactive(true);
          } catch(error) { await siteDialog({title:"Ошибка",description:error.message||"Не удалось обработать заявку."}); }
        }
        async function replyGeneral(id) {
          var comment = await siteDialog({title:"Ответить на обращение",description:"Повторно изменить комментарий нельзя.",comment:true,required:true});
          if(comment===null) return;
          try {
            await window.BR_API.generalRequestReply(sessionToken(),id,comment);
            await siteDialog({title:"Комментарий отправлен",description:"Повторно изменить его нельзя."});
            loadGeneral(true);
          } catch(error) { await siteDialog({title:"Ошибка",description:error.message||"Не удалось отправить комментарий."}); }
        }

        inactiveTab.onclick = function () { setSection("inactive"); };
        generalTab.onclick = function () { setSection("general"); };

        var inactiveButtons = [
          document.getElementById("inactiveAll"),
          document.getElementById("inactivePending"),
          document.getElementById("inactiveApproved"),
          document.getElementById("inactiveRejected")
        ];

        var inactiveValues = ["", "pending", "approved", "rejected"];
        inactiveButtons.forEach(function (button, index) {
          if (button) button.onclick = function () {
            inactiveFilter = inactiveValues[index];
            setButtons(inactiveButtons, button);
            renderInactive();
          };
        });

        var generalButtons = [
          document.getElementById("generalAll"),
          document.getElementById("generalPending"),
          document.getElementById("generalAnswered")
        ];

        var generalValues = ["", "pending", "answered"];
        generalButtons.forEach(function (button, index) {
          if (button) button.onclick = function () {
            generalFilter = generalValues[index];
            setButtons(generalButtons, button);
            renderGeneral();
          };
        });

        setSection("inactive");
        loadInactive();
        loadGeneral();

        window.addEventListener("br:remote-data-changed", function (event) {
          var action = event && event.detail ? event.detail.action : "";
          if ([
            "general_request_create",
            "general_request_reply",
            "inactive_request_create",
            "inactive_request_review",
            "access_manage"
          ].indexOf(action) === -1) {
            return;
          }

          loadInactive(true);
          loadGeneral(true);
        });

        window.addEventListener("br:refresh-visible-data", function () {
          if (document.visibilityState === "hidden") return;
          loadInactive();
          loadGeneral();
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

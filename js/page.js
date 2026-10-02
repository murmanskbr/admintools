(function () {
  "use strict";

  var E = window.BRApp.esc;

  function localList(key) {
    try {
      var data = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return [];
    }
  }

  function localObject(key) {
    try {
      var data = JSON.parse(localStorage.getItem(key) || "{}");
      return data && typeof data === "object" && !Array.isArray(data) ? data : {};
    } catch (_) {
      return {};
    }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function num(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    var match = String(value == null ? "" : value).match(/\d+(?:[.,]\d+)?/);
    return match ? Number(match[0].replace(",", ".")) : null;
  }

  function findMurmansk(data) {
    var list = Array.isArray(data) ? data :
      data && Array.isArray(data.servers) ? data.servers :
      data && Array.isArray(data.data) ? data.data :
      data && data.server ? [data.server] : [];

    for (var i = 0; i < list.length; i += 1) {
      var s = list[i] || {};
      if (String(s.sym_id || "").toLowerCase() === "server53" ||
          String(s.name || "").toLowerCase() === "murmansk") return s;
    }
    return null;
  }

  var ADMINS = [
    ["Nikita_Zvezda", "Руководство"],
    ["Test_Admin", "Модератор"],
    ["Alex_Murmansk", "Старший модератор"],
    ["Max_Admin", "Администратор"],
    ["Rus_Leader", "Следящий"]
  ];

  var POSITIONS = [
    "Младший модератор",
    "Модератор",
    "Старший модератор",
    "Администратор",
    "Старший администратор",
    "Следящий",
    "Старший следящий"
  ];

  var STAT_FIELDS = [
    ["Возраст", "age"],
    ["Доступ с ПК", "pc_access"],
    ["Должность", "position"],
    ["Уровни", "levels"],
    ["Баллы активности", "activity_points"],
    ["Неактивы", "inactives"],
    ["Страйки", "strikes"],
    ["Предупреждения", "warnings"],
    ["Баллы", "points"],
    ["Последнее повышение", "last_promotion"]
  ];

  function statCards(values) {
    return STAT_FIELDS.map(function (field) {
      var value = values[field[1]];
      return '<div class="card"><small>' + E(field[0]) + '</small><b>' +
        E(value == null || value === "" ? "—" : value) + '</b></div>';
    }).join("");
  }

  function dashboard(user) {
    return {
      title: user.role === "management" ? "Панель руководства" : "Главная",
      subtitle: "Рабочий стол администратора • сервер Мурманск",
      render: function () {
        var quickLinks = user.role === "management"
          ? '<a class="dashboard-action" href="../pages/statistics-all.html"><b>Статистика администрации</b><span>Сводные данные состава</span></a>' +
            '<a class="dashboard-action" href="../pages/admins.html"><b>Состав администрации</b><span>Список сотрудников</span></a>' +
            '<a class="dashboard-action" href="../pages/notifications.html"><b>Уведомления</b><span>Новости и сообщения</span></a>' +
            '<a class="dashboard-action" href="../pages/requests-all.html"><b>Обращения</b><span>Контроль обращений</span></a>'
          : '<a class="dashboard-action" href="../pages/profile.html"><b>Мой профиль</b><span>Данные аккаунта</span></a>' +
            '<a class="dashboard-action" href="../pages/statistics.html"><b>Моя статистика</b><span>Личные показатели</span></a>' +
            '<a class="dashboard-action" href="../pages/requests.html"><b>Мои обращения</b><span>Связь с руководством</span></a>' +
            '<a class="dashboard-action" href="../pages/normatives.html"><b>Нормативы</b><span>Подача и просмотр</span></a>';

        return '<div id="serverRoot"><div class="box"><div class="empty">Загрузка статистики сервера...</div></div></div>' +
          '<div class="dashboard-grid">' +
            '<div class="box dashboard-account">' +
              '<div class="dashboard-section-head"><div><small>ВАШ АККАУНТ</small><h2>' + E(user.nickname) + '</h2></div>' +
              '<span class="badge badge-green">Активен</span></div>' +
              '<div class="dashboard-account-grid">' +
                '<div><small>ДОЛЖНОСТЬ</small><b>' + E(user.position || "—") + '</b></div>' +
                '<div><small>РОЛЬ</small><b>' + E(user.role === "management" ? "Руководство" : "Администратор") + '</b></div>' +
              '</div>' +
            '</div>' +
            '<div class="box dashboard-links">' +
              '<div class="dashboard-section-head"><div><small>БЫСТРЫЙ ДОСТУП</small><h2>Разделы панели</h2></div></div>' +
              '<div class="dashboard-actions">' + quickLinks + '</div>' +
            '</div>' +
          '</div>';
      },
      load: async function () {
        var root = document.getElementById("serverRoot");
        try {
          var data = await window.BR_API.serverStats(user.token);
          var s = findMurmansk(data);
          if (!s) throw new Error("Сервер «Мурманск» не найден в ответе API.");

          var online = num(s.online);
          var max = num(s.max_online);
          var x2 = s.x2 === true || String(s.x2 || "").toLowerCase() === "x2" ? "X2" :
            s.x2 === false || String(s.x2 || "").toLowerCase() === "x1" ? "X1" : "—";
          var status = online == null ? "Оффлайн" : "Онлайн";

          root.innerHTML =
            '<div class="server-box">' +
              '<div class="server-box-head"><div><small>СТАТИСТИКА СЕРВЕРА</small><h2>Мурманск</h2></div>' +
              '<div class="server-box-actions">' +
                '<span class="server-status"><i style="background:' + (online != null ? "#36d47d" : "#8d96a7") + '"></i>' + status + '</span>' +
                '<button class="small-button server-refresh" id="serverRefresh" type="button">↻ Обновить</button>' +
              '</div></div>' +
              '<div class="server-stats-grid">' +
                '<div class="server-stat"><small>ОНЛАЙН</small><strong>' + E(online == null ? "—" : String(online) + (max != null ? " / " + max : "")) + '</strong><span>игроков онлайн</span></div>' +
                '<div class="server-stat"><small>X2</small><strong>' + E(x2) + '</strong><span>режим опыта</span></div>' +
                '<div class="server-stat"><small>СЕРВЕР</small><strong>Мурманск</strong><span>Black Russia</span></div>' +
                '<div class="server-stat"><small>СОСТОЯНИЕ</small><strong>' + status + '</strong><span>обновление по запросу</span></div>' +
              '</div>' +
              '<div class="server-updated" id="serverUpdated">Данные обновлены: ' + E(new Date().toLocaleTimeString("ru-RU", {hour:"2-digit",minute:"2-digit",second:"2-digit"})) + '</div>' +
            '</div>';

          var refresh = document.getElementById("serverRefresh");
          if (refresh) {
            refresh.onclick = function () {
              location.reload();
            };
          }
        } catch (error) {
          root.innerHTML =
            '<div class="box dashboard-error">' +
              '<div class="empty">' + E(error.message || "Не удалось загрузить статистику сервера.") + '</div>' +
              '<div class="dashboard-error-action"><button class="small-button server-refresh" id="serverRefresh" type="button">↻ Повторить</button></div>' +
            '</div>';
          var retry = document.getElementById("serverRefresh");
          if (retry) retry.onclick = function () { location.reload(); };
        }
      }
    };
  }

  function profile(user) {
    return {
      title: "Мой профиль",
      subtitle: "Данные текущего аккаунта",
      render: function () {
        return '<div class="box"><div class="form-grid">' +
          '<div class="form-field"><label>Никнейм</label><input class="profile-input" readonly value="' + E(user.nickname) + '"></div>' +
          '<div class="form-field"><label>Должность</label><input class="profile-input" readonly value="' + E(user.position || "—") + '"></div>' +
          '<div class="form-field"><label>Роль</label><input class="profile-input" readonly value="' + E(user.role === "management" ? "Руководство" : "Администратор") + '"></div>' +
        '</div></div>';
      }
    };
  }

  function admins() {
    return {
      title: "Состав администрации",
      subtitle: "Список никнеймов и должностей",
      render: function () {
        return '<div class="box table-box"><table><thead><tr><th>Никнейм</th><th>Должность</th></tr></thead><tbody>' +
          ADMINS.map(function (x) {
            return '<tr><td>' + E(x[0]) + '</td><td>' + E(x[1]) + '</td></tr>';
          }).join("") +
        '</tbody></table></div>';
      }
    };
  }

  function myStatistics() {
    return {
      title: "Моя статистика",
      subtitle: "Актуальные данные администратора",
      render: function () {
        return '<div id="statsRoot"><div class="box"><div class="empty">Загрузка статистики...</div></div></div>';
      },
      load: async function (user) {
        var root = document.getElementById("statsRoot");
        try {
          var result = await window.BR_API.myStatistics(user.token);
          var values = result.statistics && result.statistics.values || {};
          root.innerHTML = '<div class="cards">' + statCards(values) + '</div>' +
            '<div class="box spaced-box"><p>Данные загружены автоматически из Google Sheets.</p></div>';
        } catch (error) {
          root.innerHTML = '<div class="box"><div class="empty">' + E(error.message || "Не удалось загрузить статистику.") + '</div></div>';
        }
      }
    };
  }

  function allStatistics() {
    async function load(user) {
      var root = document.getElementById("allStatsRoot");
      var refresh = document.getElementById("allStatsRefresh");
      if (!root) return;

      if (refresh) {
        refresh.disabled = true;
        refresh.textContent = "Обновление…";
      }

      try {
        var result = await window.BR_API.allStatistics(user.token);
        var list = Array.isArray(result.statistics) ? result.statistics : [];
        var fields = [["Никнейм","nickname"],["Должность","position"],["Уровни","levels"],["Активность","activity_points"],["Баллы","points"],["Последнее повышение","last_promotion"]];
        var rows = list.length ? list.map(function (item) {
          var values = item.values || {};
          return '<tr>' + fields.map(function (f) {
            return '<td>' + E(values[f[1]] == null || values[f[1]] === "" ? "—" : values[f[1]]) + '</td>';
          }).join("") + '</tr>';
        }).join("") : '<tr><td colspan="6" class="table-empty">Данных нет.</td></tr>';

        root.innerHTML =
          '<div class="box table-box">' +
            '<div class="stats-table-head">' +
              '<div><small>СОСТАВ АДМИНИСТРАЦИИ</small><b>' + E(String(list.length)) + ' сотрудников</b></div>' +
              '<span class="muted">Источник: Google Sheets</span>' +
            '</div>' +
            '<table><thead><tr>' +
              fields.map(function (f) { return '<th>' + E(f[0]) + '</th>'; }).join("") +
            '</tr></thead><tbody>' + rows + '</tbody></table>' +
          '</div>';
      } catch (error) {
        root.innerHTML = '<div class="box"><div class="empty">' + E(error.message || "Не удалось загрузить статистику администрации.") + '</div></div>';
      } finally {
        if (refresh) {
          refresh.disabled = false;
          refresh.textContent = "↻ Обновить";
        }
      }
    }

    return {
      managementOnly: true,
      title: "Статистика администрации",
      subtitle: "Сводные данные администрации из Google Sheets",
      render: function () {
        return '<div class="page-toolbar">' +
          '<div><small>ОБЩАЯ СТАТИСТИКА</small><b>Данные состава администрации</b></div>' +
          '<button class="button button-secondary" id="allStatsRefresh" type="button">↻ Обновить</button>' +
        '</div>' +
        '<div id="allStatsRoot"><div class="box"><div class="empty">Загрузка статистики администрации...</div></div></div>';
      },
      bind: function (user) {
        var button = document.getElementById("allStatsRefresh");
        if (button) button.onclick = function () { load(user); };
      },
      load: load
    };
  }

  function notifications(user) {
    function targetLabel(value) {
      return {
        all: "Вся администрация",
        admin: "Администраторы",
        management: "Руководство"
      }[value] || value || "—";
    }

    return {
      title: "Уведомления",
      subtitle: "Новости, объявления и сообщения администрации",
      render: function () {
        var create = user.role === "management"
          ? '<div class="page-toolbar">' +
              '<div><small>УПРАВЛЕНИЕ</small><b>Центр уведомлений</b></div>' +
              '<button class="button button-primary" id="openNotificationForm" type="button">＋ Создать уведомление</button>' +
            '</div>' +
            '<div id="notificationCreateRoot" class="box compact-box notification-create-root" hidden>' +
              '<form id="notificationForm">' +
                '<div class="form-grid">' +
                  '<div class="form-field"><label>Заголовок</label><input id="nTitle" class="form-input" maxlength="120" required placeholder="Например: Изменение регламента"></div>' +
                  '<div class="form-field"><label>Получатели</label><select id="nTarget" class="form-select"><option value="all">Вся администрация</option><option value="admin">Только администраторы</option><option value="management">Только руководство</option></select></div>' +
                  '<div class="form-field"><label>Показывать до (необязательно)</label><input id="nExpires" class="form-input" type="datetime-local"></div>' +
                  '<div class="form-field form-full"><label>Текст уведомления</label><textarea id="nText" class="form-textarea" maxlength="5000" required placeholder="Текст сообщения для администрации"></textarea></div>' +
                '</div>' +
                '<div class="form-actions">' +
                  '<button class="button button-primary" type="submit">Опубликовать</button>' +
                  '<button class="button button-secondary" id="cancelNotification" type="button">Отмена</button>' +
                '</div>' +
              '</form>' +
            '</div>'
          : '';

        return create +
          '<div id="notificationsRoot"><div class="box"><div class="empty">Загрузка уведомлений...</div></div></div>';
      },
      bind: function () {
        var open = document.getElementById("openNotificationForm");
        var root = document.getElementById("notificationCreateRoot");
        var cancel = document.getElementById("cancelNotification");
        var form = document.getElementById("notificationForm");

        if (open && root) {
          open.onclick = function () {
            root.hidden = false;
            open.hidden = true;
            var title = document.getElementById("nTitle");
            if (title) title.focus();
          };
        }

        if (cancel && root && open) {
          cancel.onclick = function () {
            root.hidden = true;
            open.hidden = false;
          };
        }

        if (!form) return;

        form.onsubmit = async function (event) {
          event.preventDefault();

          var title = document.getElementById("nTitle").value.trim();
          var text = document.getElementById("nText").value.trim();
          var target = document.getElementById("nTarget").value;
          var expiresInput = document.getElementById("nExpires").value;
          var submit = form.querySelector("button[type=submit]");

          if (!title || !text) return;

          var expiresAt = "";
          if (expiresInput) {
            var expiration = new Date(expiresInput);
            if (!Number.isFinite(expiration.getTime())) {
              alert("Некорректная дата окончания уведомления.");
              return;
            }
            expiresAt = expiration.toISOString();
          }

          if (submit) {
            submit.disabled = true;
            submit.textContent = "Публикация…";
          }

          try {
            await window.BR_API.notificationCreate(
              user.token,
              title,
              text,
              target,
              expiresAt
            );
            form.reset();
            if (root && open) {
              root.hidden = true;
              open.hidden = false;
            }
            await loadNotifications();
          } catch (e) {
            alert(e.message || "Не удалось опубликовать уведомление.");
          } finally {
            if (submit) {
              submit.disabled = false;
              submit.textContent = "Опубликовать";
            }
          }
        };
      },
      load: async function () {
        await loadNotifications();
      }
    };

    async function loadNotifications() {
      var root = document.getElementById("notificationsRoot");
      if (!root) return;

      try {
        var result = await window.BR_API.notificationsList(user.token);
        var list = Array.isArray(result.notifications) ? result.notifications : [];
        var unread = list.filter(function (item) { return !item.is_read; }).length;

        if (!list.length) {
          root.innerHTML = '<div class="box"><div class="empty">Новых уведомлений нет.</div></div>';
          return;
        }

        var cards = list.map(function (item) {
          var cls = item.is_read ? "notification" : "notification unread";
          var readButton = item.is_read
            ? '<span class="badge badge-blue">Прочитано</span>'
            : '<button class="small-button" data-read-notification="' + E(item.id) + '">Прочитать</button>';

          var deleteButton = user.role === "management"
            ? '<button class="small-button notification-delete" data-delete-notification="' + E(item.id) + '">Удалить</button>'
            : '';

          return '<article class="' + cls + '">' +
            '<div class="notification-top">' +
              '<div><div class="notification-title">' + E(item.title) + '</div>' +
              '<div class="notification-meta">' + E(formatDateTime(item.created_at)) + ' • ' + E(targetLabel(item.target_role)) + '</div></div>' +
              '<div class="notification-actions">' + readButton + deleteButton + '</div>' +
            '</div>' +
            '<div class="notification-text">' + E(item.body) + '</div>' +
            (item.expires_at ? '<div class="notification-meta notification-expiry">До ' + E(formatDateTime(item.expires_at)) + '</div>' : '') +
          '</article>';
        }).join("");

        root.innerHTML =
          '<div class="notification-summary">' +
            '<div><small>ЦЕНТР УВЕДОМЛЕНИЙ</small><b>' + E(String(list.length)) + ' сообщений</b></div>' +
            '<span>' + E(String(unread)) + ' непрочитанных</span>' +
          '</div>' +
          '<div class="notification-list">' + cards + '</div>';

        document.querySelectorAll("[data-read-notification]").forEach(function (button) {
          button.onclick = async function () {
            button.disabled = true;
            try {
              await window.BR_API.notificationRead(user.token, Number(button.dataset.readNotification));
              await loadNotifications();
            } catch (e) {
              alert(e.message || "Не удалось отметить уведомление.");
              button.disabled = false;
            }
          };
        });

        document.querySelectorAll("[data-delete-notification]").forEach(function (button) {
          button.onclick = async function () {
            if (!confirm("Удалить это уведомление?")) return;
            button.disabled = true;
            try {
              await window.BR_API.notificationDelete(user.token, Number(button.dataset.deleteNotification));
              await loadNotifications();
            } catch (e) {
              alert(e.message || "Не удалось удалить уведомление.");
              button.disabled = false;
            }
          };
        });
      } catch (error) {
        root.innerHTML = '<div class="box"><div class="empty">' + E(error.message || "Не удалось загрузить уведомления.") + '</div></div>';
      }
    }
  }

  function requests(user) {
    return {
      title: "Мои обращения",
      subtitle: "Обращения к руководству",
      render: function () {
        var list = localList("br_requests").filter(function (item) {
          return item.nickname === user.nickname;
        });

        var rows = list.length ? list.map(function (item) {
          return '<tr><td>' + E(item.type) + '</td><td>' + E(item.date) + '</td><td>' +
            E(item.status) + '</td><td>' + E(item.text) + '</td></tr>';
        }).join("") : '<tr><td colspan="4">Обращений пока нет.</td></tr>';

        return '<div class="box"><form id="requestForm"><div class="form-grid">' +
          '<div class="form-field"><label>Тип обращения</label><select id="requestType" class="form-select"><option>Вопрос</option><option>Неактив</option><option>Жалоба</option><option>Предложение</option></select></div>' +
          '<div class="form-field form-full"><label>Текст</label><textarea id="requestText" class="form-textarea" required></textarea></div>' +
          '</div><button class="button button-primary" type="submit">Отправить обращение</button></form></div>' +
          '<div class="box table-box spaced-box"><table><thead><tr><th>Тип</th><th>Дата</th><th>Статус</th><th>Текст</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
      },
      bind: function () {
        document.getElementById("requestForm").onsubmit = function (event) {
          event.preventDefault();
          var list = localList("br_requests");
          list.unshift({
            nickname: user.nickname,
            type: document.getElementById("requestType").value,
            date: new Date().toLocaleDateString("ru-RU"),
            status: "На рассмотрении",
            text: document.getElementById("requestText").value.trim()
          });
          save("br_requests", list.slice(0, 200));
          location.reload();
        };
      }
    };
  }

  function requestsAll() {
    return {
      managementOnly: true,
      title: "Обращения администрации",
      subtitle: "Обзор обращений сотрудников",
      render: function () {
        var list = localList("br_requests");
        var rows = list.length ? list.map(function (item) {
          return '<tr><td>' + E(item.nickname) + '</td><td>' + E(item.type) + '</td><td>' +
            E(item.date) + '</td><td>' + E(item.status) + '</td><td>' + E(item.text) + '</td></tr>';
        }).join("") : '<tr><td colspan="5">Обращений нет.</td></tr>';

        return '<div class="box table-box"><table><thead><tr><th>Никнейм</th><th>Тип</th><th>Дата</th><th>Статус</th><th>Текст</th></tr></thead><tbody>' +
          rows + '</tbody></table></div>';
      }
    };
  }

  function formatDateTime(value) {
    if (!value) return "—";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function dateIso(offset) {
    var date = new Date();
    date.setDate(date.getDate() + (offset || 0));
    return date.getFullYear() + "-" +
      String(date.getMonth() + 1).padStart(2, "0") + "-" +
      String(date.getDate()).padStart(2, "0");
  }

  function normativeStatus(status) {
    var map = {
      pending: ["На проверке", "badge-yellow"],
      norm: ["Норма", "badge-green"],
      rework: ["Перенорма", "badge-blue"],
      no_norm: ["Нет нормы", "badge-red"],
      not_submitted: ["Не сдан", ""]
    };
    var value = map[status] || ["Неизвестно", ""];
    return '<span class="badge ' + value[1] + '">' + E(value[0]) + '</span>';
  }

  function normatives(user, all) {
    if (!all) {
      return {
        title: "Нормативы",
        subtitle: "Отправка норматива и история по датам",
        render: function () {
          return '<div class="box">' +
            '<form id="normForm">' +
              '<div class="form-grid">' +
                '<div class="form-field form-full"><label>Файлы норматива</label>' +
                  '<input id="normFile" class="form-input" type="file" accept="image/gif,image/png,image/jpeg,.gif,.png,.jpg,.jpeg" multiple required>' +
                  '<span class="field-hint">Можно выбрать несколько изображений. До 20 файлов, каждый до 10 МБ.</span>' +
                  '<div id="normPreview" class="norm-preview"></div>' +
                '</div>' +
                '<div class="form-field"><label>Дата норматива</label><input id="normDate" class="form-input" type="date" value="' + E(dateIso(0)) + '" required></div>' +
                '<div class="form-field"><label>Должность</label><input id="normPosition" class="form-input" value="' + E(user.position || "") + '"></div>' +
                '<div class="form-field form-full"><label>Комментарий / что выполнено</label><textarea id="normComment" class="form-textarea" placeholder="Например: недельная норма, вечерняя смена и т. п."></textarea></div>' +
              '</div>' +
              '<div class="form-actions"><button class="button button-primary" type="submit">Отправить норматив</button></div>' +
            '</form>' +
          '</div>' +
          '<div id="normRoot" class="spaced-box"><div class="box"><div class="empty">Загрузка истории...</div></div></div>' +
          '<div id="normativeModal"></div>';
        },
        bind: function () {
          var form = document.getElementById("normForm");
          var fileInput = document.getElementById("normFile");
          var preview = document.getElementById("normPreview");
          if (!form || !fileInput) return;

          fileInput.onchange = function () {
            var files = Array.from(fileInput.files || []);
            if (!preview) return;
            preview.innerHTML = files.map(function (file, index) {
              var url = URL.createObjectURL(file);
              return '<div class="norm-preview-item"><img src="' + url + '" alt=""><span>#' + (index + 1) + ' ' + E(file.name) + '</span></div>';
            }).join("");
          };

          form.onsubmit = async function (event) {
            event.preventDefault();
            var files = Array.from(fileInput.files || []);
            if (!files.length) {
              alert("Выберите хотя бы один файл.");
              return;
            }

            var button = form.querySelector("button[type=submit]");
            if (button) {
              button.disabled = true;
              button.textContent = "Загрузка…";
            }

            try {
              await window.BR_API.normativeUpload(
                user.token,
                files,
                document.getElementById("normDate").value,
                document.getElementById("normPosition").value,
                document.getElementById("normComment").value
              );
              alert("Норматив отправлен на проверку.");
              form.reset();
              document.getElementById("normDate").value = dateIso(0);
              if (preview) preview.innerHTML = "";
              location.reload();
            } catch (e) {
              alert(e.message || "Не удалось отправить норматив.");
            } finally {
              if (button) {
                button.disabled = false;
                button.textContent = "Отправить норматив";
              }
            }
          };
        },
        load: async function () {
          var root = document.getElementById("normRoot");
          if (!root) return;
          try {
            var result = await window.BR_API.normativesMine(user.token);
            var list = Array.isArray(result.normatives) ? result.normatives : [];

            var groups = {};
            list.forEach(function (item) {
              var key = item.submission_date || "—";
              if (!groups[key]) groups[key] = [];
              groups[key].push(item);
            });

            var html = Object.keys(groups).sort().reverse().map(function (date) {
              var rows = groups[date].map(function (item) {
                return '<tr>' +
                  '<td>#' + E(item.id) + '</td>' +
                  '<td>' + normativeStatus(item.status) + '</td>' +
                  '<td>' + E(item.file_count || 0) + '</td>' +
                  '<td>' + E(formatDateTime(item.created_at)) + '</td>' +
                  '<td>' + E(item.review_comment || "—") + '</td>' +
                  '<td><button class="small-button" data-own-norm="' + E(item.id) + '">Открыть</button></td>' +
                '</tr>';
              }).join("");

              return '<section class="date-section"><div class="date-section-head"><h2>' + E(date) + '</h2><span>' + E(new Date(date + "T00:00:00").toLocaleDateString("ru-RU", {weekday:"long", day:"numeric", month:"long", year:"numeric"})) + '</span></div>' +
                '<div class="box table-box"><table><thead><tr><th>№</th><th>Статус</th><th>Файлы</th><th>Отправлен</th><th>Решение</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
            }).join("");

            root.innerHTML = html || '<div class="box"><div class="empty">Нормативы ещё не отправлялись.</div></div>';

            document.querySelectorAll("[data-own-norm]").forEach(function (button) {
              button.onclick = function () {
                openNormativeModal({
                  token: user.token,
                  submissionId: Number(button.dataset.ownNorm),
                  management: false
                });
              };
            });
          } catch (error) {
            root.innerHTML = '<div class="box"><div class="empty">' + E(error.message || "Не удалось загрузить историю нормативов.") + '</div></div>';
          }
        }
      };
    }

    var selectedDate = dateIso(0);

    function loadDaily() {
      var root = document.getElementById("normRoot");
      var dateInput = document.getElementById("controlDate");
      if (dateInput) selectedDate = dateInput.value;
      return window.BR_API.normativesDaily(user.token, selectedDate).then(function (result) {
        var list = Array.isArray(result.administrators) ? result.administrators : [];

        var rows = list.map(function (item) {
          var action = item.status === "not_submitted"
            ? '<button class="small-button" data-mark-absence="' + E(item.admin_id) + '">Нет нормы</button>'
            : '<button class="small-button" data-open-admin-norm="' + E(item.submission_id || 0) + '" data-admin-id="' + E(item.admin_id) + '">Проверить</button>';

          return '<tr>' +
            '<td><button class="link-button" data-open-admin-norm="' + E(item.submission_id || 0) + '" data-admin-id="' + E(item.admin_id) + '">' + E(item.nickname) + '</button></td>' +
            '<td>' + E(item.position || "—") + '</td>' +
            '<td>' + normativeStatus(item.status) + '</td>' +
            '<td>' + E(item.file_count || 0) + '</td>' +
            '<td>' + E(formatDateTime(item.created_at)) + '</td>' +
            '<td>' + E(item.review_comment || "—") + '</td>' +
            '<td>' + action + '</td>' +
          '</tr>';
        }).join("");

        root.innerHTML =
          '<div class="box table-box"><div class="stats-table-head"><div><small>НОРМАТИВЫ ЗА ДАТУ</small><b>' +
          E(new Date(selectedDate + "T00:00:00").toLocaleDateString("ru-RU", {weekday:"long", day:"numeric", month:"long", year:"numeric"})) +
          '</b></div><span class="muted">' + E(String(list.length)) + ' администраторов</span></div>' +
          '<table><thead><tr><th>Никнейм</th><th>Должность</th><th>Статус</th><th>Файлы</th><th>Отправлен</th><th>Решение</th><th></th></tr></thead><tbody>' +
          (rows || '<tr><td colspan="7" class="table-empty">Активных администраторов нет.</td></tr>') +
          '</tbody></table></div>';

        document.querySelectorAll("[data-open-admin-norm]").forEach(function (button) {
          button.onclick = function () {
            openNormativeModal({
              token: user.token,
              submissionId: Number(button.dataset.openAdminNorm || 0),
              adminId: Number(button.dataset.adminId || 0),
              date: selectedDate,
              management: true
            });
          };
        });

        document.querySelectorAll("[data-mark-absence]").forEach(function (button) {
          button.onclick = async function () {
            if (!confirm("Отметить «Нет нормы» для этого администратора за " + selectedDate + "?")) return;
            button.disabled = true;
            try {
              await window.BR_API.normativeReview(
                user.token, 0, Number(button.dataset.markAbsence), selectedDate, "no_norm", "Норматив не сдан."
              );
              await loadDaily();
            } catch (e) {
              alert(e.message || "Не удалось выставить отсутствие норматива.");
              button.disabled = false;
            }
          };
        });
      }).catch(function (error) {
        root.innerHTML = '<div class="box"><div class="empty">' + E(error.message || "Не удалось загрузить нормативы.") + '</div></div>';
      });
    }

    function openNormativeModal(options) {
      var modalRoot = document.getElementById("normativeModal");
      if (!modalRoot) return;
      modalRoot.innerHTML = '<div class="modal-backdrop" id="normativeBackdrop"><div class="modal-card">' +
        '<div class="modal-head"><div><small>ПРОВЕРКА НОРМАТИВА</small><h2>Загрузка...</h2></div><button class="modal-close" id="normativeClose" type="button">×</button></div>' +
        '<div id="normativeDetailRoot"><div class="empty">Загрузка данных...</div></div>' +
      '</div></div>';

      document.getElementById("normativeClose").onclick = function () { modalRoot.innerHTML = ""; };

      window.BR_API.normativeDetail(
        options.token,
        options.submissionId,
        options.adminId,
        options.date
      ).then(function (result) {
        var s = result.submission;
        var title = s ? E(s.nickname) : E("Норматив не сдан");
        var meta = s ? "Дата норматива: " + E(s.submission_date) : "Дата норматива: " + E(options.date || "—");

        var files = Array.isArray(result.files) ? result.files : [];
        var images = files.map(function (file) {
          return '<a class="norm-image" href="' + E(file.url) + '" target="_blank" rel="noopener noreferrer"><img src="' + E(file.url) + '" alt="' + E(file.original_filename) + '"><span>' + E(file.original_filename) + '</span></a>';
        }).join("");

        var controls = options.management
          ? '<div class="review-panel">' +
              '<textarea id="reviewComment" class="form-textarea" placeholder="Комментарий проверки"></textarea>' +
              '<div class="review-actions">' +
                (s
                  ? '<button class="button button-secondary" data-review="rework">Перенорма</button>' +
                    '<button class="button button-primary" data-review="norm">Норма</button>'
                  : '') +
                '<button class="button button-danger" data-review="no_norm">Нет нормы</button>' +
              '</div>' +
            '</div>'
          : '<div class="notice">Результат проверки: ' + normativeStatus(result.status) + '</div>';

        document.getElementById("normativeDetailRoot").innerHTML =
          '<div class="detail-grid">' +
            '<div><small>КТО</small><b>' + title + '</b></div>' +
            '<div><small>ДАТА</small><b>' + meta + '</b></div>' +
            '<div><small>ДОЛЖНОСТЬ</small><b>' + E(s ? (s.position || "—") : "—") + '</b></div>' +
            '<div><small>ОТПРАВЛЕН</small><b>' + E(s ? formatDateTime(s.created_at) : "—") + '</b></div>' +
            '<div class="detail-full"><small>КОММЕНТАРИЙ</small><p>' + E(s ? (s.comment || "—") : "Администратор не отправил норматив за эту дату.") + '</p></div>' +
          '</div>' +
          '<div class="norm-images-title">Файлы норматива (' + E(files.length) + ')</div>' +
          '<div class="norm-images">' + (images || '<div class="empty">Изображения отсутствуют.</div>') + '</div>' +
          controls;

        if (options.management) {
          document.querySelectorAll("[data-review]").forEach(function (button) {
            button.onclick = async function () {
              var comment = document.getElementById("reviewComment").value.trim();
              button.disabled = true;
              try {
                await window.BR_API.normativeReview(
                  options.token,
                  options.submissionId,
                  options.adminId,
                  options.date,
                  button.dataset.review,
                  comment
                );
                modalRoot.innerHTML = "";
                if (document.body.getAttribute("data-page") === "normatives-all") {
                  await loadDaily();
                }
              } catch (e) {
                alert(e.message || "Не удалось сохранить решение.");
                button.disabled = false;
              }
            };
          });
        }
      }).catch(function (error) {
        document.getElementById("normativeDetailRoot").innerHTML =
          '<div class="empty">' + E(error.message || "Не удалось открыть норматив.") + '</div>';
      });
    }

    return {
      managementOnly: true,
      title: "Нормативы администрации",
      subtitle: "Контроль нормативов по датам",
      render: function () {
        return '<div class="page-toolbar normative-toolbar">' +
          '<div><small>ВЫСТАВЛЕНИЕ И ПРОВЕРКА</small><b>Контроль норматива за выбранную дату</b></div>' +
          '<div class="date-controls">' +
            '<button class="small-button" id="datePrev" type="button">←</button>' +
            '<input id="controlDate" class="form-input date-control" type="date" value="' + E(selectedDate) + '">' +
            '<button class="small-button" id="dateNext" type="button">→</button>' +
            '<button class="button button-secondary" id="dateToday" type="button">Сегодня</button>' +
            '<button class="button button-secondary" id="normDailyRefresh" type="button">↻ Обновить</button>' +
          '</div>' +
        '</div>' +
        '<div id="normRoot"><div class="box"><div class="empty">Загрузка...</div></div></div>' +
        '<div id="normativeModal"></div>';
      },
      bind: function () {
        var input = document.getElementById("controlDate");
        var prev = document.getElementById("datePrev");
        var next = document.getElementById("dateNext");
        var today = document.getElementById("dateToday");
        var refresh = document.getElementById("normDailyRefresh");

        function setDate(value) {
          selectedDate = value;
          if (input) input.value = value;
          loadDaily();
        }

        if (input) input.onchange = function () { setDate(input.value); };
        if (prev) prev.onclick = function () { setDate(dateIso(-1)); };
        if (next) next.onclick = function () { setDate(dateIso(1)); };
        if (today) today.onclick = function () { setDate(dateIso(0)); };
        if (refresh) refresh.onclick = loadDaily;
      },
      load: loadDaily
    };
  }

  function logs() {
    return {
      managementOnly: true,
      title: "Журнал действий",
      subtitle: "Серверный журнал Supabase",
      render: function () {
        return '<div id="logsRoot"><div class="box"><div class="empty">Загрузка журнала...</div></div></div>';
      },
      load: async function (user) {
        var root = document.getElementById("logsRoot");
        try {
          var result = await window.BR_API.auditLogs(user.token, 200);
          var list = Array.isArray(result.logs) ? result.logs : [];
          var rows = list.length ? list.map(function (x) {
            return '<tr><td>' + E(x.time) + '</td><td>' + E(x.nickname) + '</td><td>' +
              E(x.action) + '</td><td>' + E(x.page) + '</td><td>' + E(x.details) + '</td></tr>';
          }).join("") : '<tr><td colspan="5">Журнал пуст.</td></tr>';
          root.innerHTML = '<div class="box table-box"><table><thead><tr><th>Время</th><th>Никнейм</th><th>Действие</th><th>Раздел</th><th>Подробности</th></tr></thead><tbody>' +
            rows + '</tbody></table></div>';
        } catch (e) {
          root.innerHTML = '<div class="box"><div class="empty">' + E(e.message || "Не удалось загрузить журнал.") + '</div></div>';
        }
      }
    };
  }

  function rules() {
    return {
      title: "Регламент",
      subtitle: "Правила администрации",
      render: function () {
        return '<div class="two-column-table"><div class="box"><h2>Администраторы</h2><p>Соблюдение регламента, выполнение требований и корректная работа с обращениями и нормативами.</p></div>' +
          '<div class="box"><h2>Руководство</h2><p>Контроль состава администрации, обращений, нормативов и публикация уведомлений.</p></div></div>';
      }
    };
  }

  function access() {
    return {
      managementOnly: true,
      title: "Выдать доступ",
      subtitle: "Управление списком доступа",
      render: function () {
        return '<div class="box"><form id="accessForm"><div class="form-grid">' +
          '<div class="form-field form-full"><label>Никнейм</label><input id="accessNickname" class="form-input" required></div>' +
          '<div class="form-field form-full"><label>Пароль</label><input id="accessPassword" class="form-input" required></div>' +
          '<div class="form-field"><label>Роль</label><select id="accessRole" class="form-select"><option value="admin">Администратор</option><option value="management">Руководство</option></select></div>' +
          '<div class="form-field"><label>Должность</label><input id="accessPosition" class="form-input"></div>' +
          '</div><button class="button button-primary" type="submit">Сохранить</button></form></div>';
      },
      bind: function () {
        document.getElementById("accessForm").onsubmit = function (event) {
          event.preventDefault();
          var users = localObject("br_users");
          var nickname = document.getElementById("accessNickname").value.trim();
          users[nickname.toLowerCase()] = {
            login: nickname,
            password: document.getElementById("accessPassword").value,
            nickname: nickname,
            role: document.getElementById("accessRole").value,
            position: document.getElementById("accessPosition").value
          };
          save("br_users", users);
          alert("Данные сохранены.");
        };
      }
    };
  }

  var pages = {
    dashboard: dashboard,
    profile: profile,
    admins: admins,
    statistics: myStatistics,
    "statistics-all": allStatistics,
    notifications: notifications,
    requests: requests,
    "requests-all": requestsAll,
    normatives: function (u) { return normatives(u, false); },
    "normatives-all": function (u) { return normatives(u, true); },
    logs: logs,
    rules: rules,
    access: access
  };

  document.addEventListener("DOMContentLoaded", function () {
    var page = document.body.getAttribute("data-page") || "dashboard";
    var builder = pages[page] || dashboard;

    window.BRApp.init((function () {
      var session = window.BRApp.getSession();
      var config = builder(session.user);
      config.active = page;
      return config;
    })());
  });
})();
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
      subtitle: "Сервер Black Russia • Мурманск",
      render: function () {
        return '<div id="serverRoot"><div class="box"><div class="empty">Загрузка статистики сервера...</div></div></div>' +
          '<div class="cards">' +
          '<div class="card"><small>НИКНЕЙМ</small><b>' + E(user.nickname) + '</b></div>' +
          '<div class="card"><small>ДОЛЖНОСТЬ</small><b>' + E(user.position || "—") + '</b></div>' +
          '<div class="card"><small>РОЛЬ</small><b>' + E(user.role === "management" ? "Руководство" : "Администратор") + '</b></div>' +
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
              '<span class="server-status"><i style="background:' + (online != null ? "#36d47d" : "#8d96a7") + '"></i>' + status + '</span></div>' +
              '<div class="server-stats-grid">' +
                '<div class="server-stat"><small>ОНЛАЙН</small><strong>' + E(online == null ? "—" : String(online) + (max != null ? " / " + max : "")) + '</strong><span>игроков онлайн</span></div>' +
                '<div class="server-stat"><small>X2</small><strong>' + E(x2) + '</strong><span>режим опыта</span></div>' +
                '<div class="server-stat"><small>СЕРВЕР</small><strong>Мурманск</strong><span>Black Russia</span></div>' +
                '<div class="server-stat"><small>СОСТОЯНИЕ</small><strong>' + status + '</strong><span>загрузка автоматически</span></div>' +
              '</div>' +
            '</div>';
        } catch (error) {
          root.innerHTML = '<div class="box"><div class="empty">' + E(error.message || "Не удалось загрузить статистику сервера.") + '</div></div>';
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
    return {
      managementOnly: true,
      title: "Статистика администрации",
      subtitle: "Сводные данные администрации из Google Sheets",
      render: function () {
        return '<div id="allStatsRoot"><div class="box"><div class="empty">Загрузка статистики администрации...</div></div></div>';
      },
      load: async function (user) {
        var root = document.getElementById("allStatsRoot");
        try {
          var result = await window.BR_API.allStatistics(user.token);
          var list = Array.isArray(result.statistics) ? result.statistics : [];
          var fields = [["Никнейм","nickname"],["Должность","position"],["Уровни","levels"],["Активность","activity_points"],["Баллы","points"],["Последнее повышение","last_promotion"]];
          var rows = list.length ? list.map(function (item) {
            var values = item.values || {};
            return '<tr>' + fields.map(function (f) {
              return '<td>' + E(values[f[1]] == null || values[f[1]] === "" ? "—" : values[f[1]]) + '</td>';
            }).join("") + '</tr>';
          }).join("") : '<tr><td colspan="6">Данных нет.</td></tr>';

          root.innerHTML = '<div class="box table-box"><table><thead><tr>' +
            fields.map(function (f) { return '<th>' + E(f[0]) + '</th>'; }).join("") +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>';
        } catch (error) {
          root.innerHTML = '<div class="box"><div class="empty">' + E(error.message || "Не удалось загрузить статистику администрации.") + '</div></div>';
        }
      }
    };
  }

  function notifications(user) {
    return {
      title: "Уведомления",
      subtitle: "Новости и сообщения администрации",
      render: function () {
        var list = localList("br_notifications").filter(function (item) {
          return !item.expiresAt || item.expiresAt > Date.now();
        });

        var create = "";
        if (user.role === "management") {
          create = '<div class="box compact-box"><form id="notificationForm"><div class="form-grid">' +
            '<div class="form-field"><label>Заголовок</label><input id="nTitle" class="form-input" required></div>' +
            '<div class="form-field"><label>Получатели</label><select id="nTarget" class="form-select"><option value="all">Вся администрация</option><option value="admin">Администраторы</option><option value="management">Руководство</option></select></div>' +
            '<div class="form-field form-full"><label>Текст</label><textarea id="nText" class="form-textarea" required></textarea></div>' +
            '</div><button class="button button-primary" type="submit">Опубликовать</button></form></div>';
        }

        var cards = list.map(function (item) {
          return '<article class="notification"><div class="notification-title">' + E(item.title || "Уведомление") +
            '</div><div class="notification-meta">' + E(item.createdAt || "") + '</div><div class="notification-text">' +
            E(item.text || "") + '</div></article>';
        }).join("");

        return create + '<div class="notification-list">' +
          (cards || '<div class="empty">Новых уведомлений нет.</div>') + '</div>';
      },
      bind: function () {
        var form = document.getElementById("notificationForm");
        if (!form) return;
        form.onsubmit = function (event) {
          event.preventDefault();
          var list = localList("br_notifications");
          list.unshift({
            id: "n-" + Date.now(),
            title: document.getElementById("nTitle").value.trim(),
            text: document.getElementById("nText").value.trim(),
            target: document.getElementById("nTarget").value,
            createdAt: new Date().toLocaleString("ru-RU")
          });
          save("br_notifications", list.slice(0, 200));
          location.reload();
        };
      }
    };
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

  function normatives(user, all) {
    return {
      managementOnly: all,
      title: all ? "Нормативы администрации" : "Нормативы",
      subtitle: all ? "Общий архив нормативов" : "Подача и просмотр моих нормативов",
      render: function () {
        var upload = all ? "" :
          '<div class="box"><form id="normForm"><div class="form-grid">' +
          '<div class="form-field form-full"><label>Файл</label><input id="normFile" class="form-input" type="file" accept="image/gif,image/png,image/jpeg,.gif,.png,.jpg,.jpeg" required></div>' +
          '<div class="form-field"><label>За какое число</label><input id="normDate" class="form-input" type="date" required></div>' +
          '<div class="form-field"><label>Должность</label><input id="normPosition" class="form-input" value="' + E(user.position || "") + '"></div>' +
          '<div class="form-field form-full"><label>Комментарий</label><textarea id="normComment" class="form-textarea"></textarea></div>' +
          '</div><button class="button button-primary" type="submit">Сохранить норматив</button></form></div>';
        return upload + '<div id="normRoot" class="spaced-box"><div class="box"><div class="empty">Загрузка...</div></div></div>';
      },
      bind: function () {
        var form = document.getElementById("normForm");
        if (!form) return;
        form.onsubmit = async function (event) {
          event.preventDefault();
          var file = document.getElementById("normFile").files[0];
          if (!file) return;
          try {
            await window.BR_API.normativeUpload(
              user.token,
              file,
              document.getElementById("normDate").value,
              document.getElementById("normPosition").value,
              document.getElementById("normComment").value
            );
            location.reload();
          } catch (e) {
            alert(e.message || "Не удалось сохранить норматив.");
          }
        };
      },
      load: async function () {
        var root = document.getElementById("normRoot");
        try {
          var result = await window.BR_API.normativesList(user.token, all ? "all" : "mine");
          var list = Array.isArray(result.normatives) ? result.normatives : [];
          var rows = list.length ? list.map(function (item) {
            return '<tr><td>#' + E(item.id) + '</td>' +
              (all ? '<td>' + E(item.nickname || "—") + '</td>' : '') +
              '<td>' + E(item.submission_date || "—") + '</td><td>' + E(item.position || "—") + '</td>' +
              '<td>' + E(item.original_filename || "—") + '</td><td>' + E(item.comment || "—") + '</td>' +
              '<td><button class="small-button" data-open-norm="' + E(item.id) + '">Открыть</button></td></tr>';
          }).join("") : '<tr><td colspan="' + (all ? 7 : 6) + '">Нормативов нет.</td></tr>';

          root.innerHTML = '<div class="box table-box"><table><thead><tr><th>№</th>' +
            (all ? '<th>Никнейм</th>' : '') +
            '<th>Дата</th><th>Должность</th><th>Файл</th><th>Комментарий</th><th></th></tr></thead><tbody>' +
            rows + '</tbody></table></div>';

          document.querySelectorAll("[data-open-norm]").forEach(function (button) {
            button.onclick = async function () {
              try {
                var response = await window.BR_API.normativeUrl(user.token, Number(button.dataset.openNorm));
                if (response && response.url) window.open(response.url, "_blank", "noopener,noreferrer");
              } catch (e) {
                alert(e.message || "Не удалось открыть файл.");
              }
            };
          });
        } catch (error) {
          root.innerHTML = '<div class="box"><div class="empty">' + E(error.message || "Не удалось загрузить нормативы.") + '</div></div>';
        }
      }
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
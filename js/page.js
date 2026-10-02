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
    "Старший администратор"
  ];

  function positionSelect(id, name, value, extraClass) {
    var current = String(value == null ? "" : value).trim();
    var options = POSITIONS.slice();

    if (current && options.indexOf(current) === -1) {
      options.unshift(current);
    }

    return '<select id="' + E(id || "") + '" name="' + E(name || "") + '" class="form-select ' + E(extraClass || "") + '">' +
      '<option value="">Выберите должность</option>' +
      options.map(function (position) {
        return '<option value="' + E(position) + '"' + (position === current ? ' selected' : '') + '>' + E(position) + '</option>';
      }).join("") +
    '</select>';
  }

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

  function columnLetter(index) {
    var number = Number(index) + 1;
    var result = "";
    while (number > 0) {
      var remainder = (number - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      number = Math.floor((number - 1) / 26);
    }
    return result;
  }

  function googleRowPayload(result) {
    var source = result && (result.admin || result.statistics || result.values || result.row || result);
    if (result && Array.isArray(result.statistics) && result.statistics.length && result.statistics[0] && result.statistics[0].values) {
      source = result.statistics[0].values;
    }
    source = source || {};
    var headers = Array.isArray(source.headers) ? source.headers.slice() : [];
    var raw = Array.isArray(source.raw_row) ? source.raw_row.slice() : [];
    var rowNumber = Number(result && result.row_number ? result.row_number : source.row_number);
    if (!Number.isFinite(rowNumber)) rowNumber = 0;
    var count = Math.max(headers.length, raw.length);
    if (!headers.length && raw.length) {
      headers = raw.map(function (_, index) { return "Колонка " + columnLetter(index); });
    }
    while (headers.length < count) headers.push("Колонка " + columnLetter(headers.length));
    while (raw.length < count) raw.push("");
    return {headers:headers,raw:raw,rowNumber:rowNumber,count:count,firstColumn:count?columnLetter(0):"",lastColumn:count?columnLetter(count-1):""};
  }

  function googleRowTable(result, caption) {
    var data = googleRowPayload(result);
    if (!data.count) return '<div class="box"><div class="empty">В Google-таблице нет данных этой строки.</div></div>';
    var rangeText = data.rowNumber ? "Строка " + data.rowNumber + " • диапазон " + data.firstColumn + data.rowNumber + ":" + data.lastColumn + data.rowNumber : "Полная строка Google Sheets";
    var rows = data.headers.map(function (header, index) {
      return '<tr><td><b>' + E(columnLetter(index)) + '</b></td><td>' + E(header || "Без названия") + '</td><td>' + E(data.raw[index] == null || data.raw[index] === "" ? "—" : data.raw[index]) + '</td></tr>';
    }).join("");
    return '<div class="page-toolbar"><div><small>GOOGLE APPS SCRIPT</small><b>' + E(caption || "Полные данные строки") + '</b></div><span class="muted">' + E(rangeText) + '</span></div>' +
      '<div class="box table-box"><table class="google-row-table"><thead><tr><th>Колонка</th><th>Заголовок</th><th>Значение</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function googleStatisticsColumns(statistics) {
    for (var i = 0; i < statistics.length; i += 1) {
      var values = statistics[i] && statistics[i].values;
      if (values && Array.isArray(values.headers) && values.headers.length) return values.headers.slice();
    }
    return [];
  }

  function googleStatisticsRaw(item, count) {
    var values = item && item.values ? item.values : {};
    var raw = Array.isArray(values.raw_row) ? values.raw_row.slice() : [];
    while (raw.length < count) raw.push("");
    return raw;
  }

  function isGoogleNicknameHeader(header) {
    var value = String(header == null ? "" : header).trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
    return ["никнейм","ник","nickname","nick","логин","login"].indexOf(value) !== -1;
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
      subtitle: "Полные данные из реестра администрации Google Sheets",
      render: function () {
        return '<div id="profileRoot"><div class="box"><div class="empty">Поиск администратора в Google Sheets...</div></div></div>';
      },
      load: async function (user) {
        var root = document.getElementById("profileRoot");
        if (!root) return;
        try {
          var result = await window.BR_API.getStatisticsAdmin(user.token, user.nickname);
          root.innerHTML =
            '<div class="box"><div class="form-grid">' +
              '<div class="form-field"><label>Никнейм аккаунта</label><input class="profile-input" readonly value="' + E(user.nickname) + '"></div>' +
              '<div class="form-field"><label>Роль панели</label><input class="profile-input" readonly value="' + E(user.role === "management" ? "Руководство" : "Администратор") + '"></div>' +
            '</div></div>' +
            googleRowTable(result, "Профиль " + user.nickname);
        } catch (error) {
          if (error.code === "STATISTICS_NOT_FOUND") {
            root.innerHTML = '<div class="box"><div class="empty">Никнейм «' + E(user.nickname) + '» отсутствует в реестре Google Sheets. Данные профиля из таблицы не найдены.</div></div>';
            return;
          }
          root.innerHTML = '<div class="box"><div class="empty">' + E(error.message || "Не удалось загрузить профиль из Google Sheets.") + '</div></div>';
        }
      }
    };
  }

  function admins(user) {
    var currentUser = user;
    async function load() {
      var root = document.getElementById("adminsRoot");
      if (!root || !currentUser || !currentUser.token) return;
      root.innerHTML = '<div class="box"><div class="empty">Загрузка состава администрации через Google Apps Script...</div></div>';
      try {
        var result = await window.BR_API.adminsGoogleList(currentUser.token);
        var statistics = Array.isArray(result.statistics) ? result.statistics : [];
        var headers = Array.isArray(result.headers) ? result.headers : [];
        var rows = Array.isArray(result.rows) ? result.rows : [];
        var rowNumbers = Array.isArray(result.row_numbers) ? result.row_numbers : [];
        if (!headers.length && statistics.length && statistics[0] && statistics[0].values) headers = Array.isArray(statistics[0].values.headers) ? statistics[0].values.headers : [];
        if (!rows.length && statistics.length) rows = statistics.map(function (item) { return item && item.values && Array.isArray(item.values.raw_row) ? item.values.raw_row : []; });
        if (!headers.length) {
          root.innerHTML = '<div class="box"><div class="empty">В первом листе не найдены столбцы.</div></div>';
          return;
        }
        var updated = document.getElementById("adminsUpdated");
        if (updated) updated.textContent = "Обновлено: " + new Date().toLocaleString("ru-RU", {day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"});
        var headerCells = headers.map(function (header) { return '<th>' + E(russianAdminHeader(header)) + '</th>'; }).join("");
        var bodyRows = rows.map(function (row, rowIndex) {
          var rowNumber = Number(rowNumbers[rowIndex] || (statistics[rowIndex] && (statistics[rowIndex].row_number || (statistics[rowIndex].values && statistics[rowIndex].values.row_number))) || 0);
          return '<tr><td><b>' + E(rowNumber || "—") + '</b></td>' + headers.map(function (_, index) {
            return '<td>' + E(row && row[index] != null && row[index] !== "" ? row[index] : "—") + '</td>';
          }).join("") + '</tr>';
        }).join("");
        if (!bodyRows) bodyRows = '<tr><td colspan="' + (headers.length + 1) + '" class="table-empty">В таблице нет данных.</td></tr>';
        root.innerHTML = '<div class="box table-box"><div class="stats-table-head"><div><small>СОСТАВ АДМИНИСТРАЦИИ</small><b>' + E(String(rows.length)) + ' записей</b></div><span class="muted">Источник: Google Apps Script • Google Sheets</span></div><table id="adminsTable"><thead><tr><th>Строка</th>' + headerCells + '</tr></thead><tbody>' + bodyRows + '</tbody></table></div>';
        var search = document.getElementById("adminsSearch");
        if (search) search.oninput = function () {
          var query = search.value.trim().toLowerCase();
          document.querySelectorAll("#adminsTable tbody tr").forEach(function (tr) { if (!tr.querySelector("td")) return; tr.style.display = !query || tr.textContent.toLowerCase().indexOf(query) !== -1 ? "" : "none"; });
        };
      } catch (error) {
        root.innerHTML = '<div class="box"><div class="empty">' + E(error.message || "Не удалось загрузить состав администрации.") + '</div></div>';
      }
    }
    return {
      title: "Состав администрации",
      subtitle: "Полный состав из Google Apps Script",
      render: function () {
        return '<div class="page-toolbar admin-list-toolbar"><div><small>СОСТАВ АДМИНИСТРАЦИИ</small><b>Никнеймы, должности и актуальные данные</b></div><div class="admins-actions"><input id="adminsSearch" class="form-input admins-search" type="search" placeholder="Поиск по таблице"><button class="button button-secondary" id="adminsRefresh" type="button">↻ Обновить</button></div></div><div class="admins-source-row"><span>Источник: Google Apps Script • Google Sheets</span><span id="adminsUpdated">Обновлено: —</span></div><div id="adminsRoot"><div class="box"><div class="empty">Загрузка...</div></div></div>';
      },
      bind: function () {
        var refresh = document.getElementById("adminsRefresh");
        if (refresh) refresh.onclick = async function () {
          refresh.disabled = true; refresh.textContent = "Загрузка…";
          try { await load(); } finally { refresh.disabled = false; refresh.textContent = "↻ Обновить"; }
        };
      },
      load: load
    };
  }

  function myStatistics() {
    return {
      title: "Моя статистика",
      subtitle: "Полная строка администратора из Google Apps Script",
      render: function () {
        return '<div id="statsRoot"><div class="box"><div class="empty">Поиск администратора в Google Sheets...</div></div></div>';
      },
      load: async function (user) {
        var root = document.getElementById("statsRoot");
        if (!root) return;
        try {
          var result = await window.BR_API.myStatistics(user.token);
          root.innerHTML =
            '<div class="box"><div class="stats-table-head"><div><small>ЛИЧНАЯ СТАТИСТИКА</small><b>' + E(user.nickname) + '</b></div><span class="muted">Найдена строка администратора</span></div></div>' +
            googleRowTable(result, "Статистика " + user.nickname);
        } catch (error) {
          if (error.code === "STATISTICS_NOT_FOUND") {
            root.innerHTML = '<div class="box"><div class="empty">Никнейм «' + E(user.nickname) + '» отсутствует в реестре Google Sheets. Личная статистика не найдена.</div></div>';
            return;
          }
          root.innerHTML = '<div class="box"><div class="empty">' + E(error.message || "Не удалось загрузить личную статистику.") + '</div></div>';
        }
      }
    };
  }

  function allStatistics() {
    var selectedDate = dateIso(0);
    var lastData = [];
    var lastNormatives = [];

    var EDIT_FIELDS = [
      ["Никнейм", "nickname", "text"],
      ["Должность", "position", "text"],
      ["Возраст", "age", "text"],
      ["Доступ с ПК", "pc_access", "text"],
      ["Уровни", "levels", "text"],
      ["Баллы активности", "activity_points", "text"],
      ["Неактивы", "inactives", "text"],
      ["Страйки", "strikes", "text"],
      ["Предупреждения", "warnings", "text"],
      ["Баллы", "points", "text"],
      ["Последнее повышение", "last_promotion", "text"]
    ];

    var STATUS_LABELS = {
      norm: "Норма",
      rework: "Перенорма",
      no_norm: "Нет нормы",
      inactive: "Неактив",
      pending: "На проверке",
      not_submitted: "Не сдан"
    };

    function normMap() {
      var map = {};
      lastNormatives.forEach(function (item) {
        map[String(item.nickname || "").trim().toLowerCase()] = item;
      });
      return map;
    }

    function valueOf(item, key) {
      var values = item && item.values ? item.values : {};
      return values[key] != null ? values[key] : "";
    }

    function displayValue(value) {
      return value == null || value === "" ? "—" : value;
    }

    function isStatsColumnHeader(item) {
      var nickname = String(valueOf(item, "nickname") || item.nickname || "").trim().toLowerCase();
      var position = String(valueOf(item, "position") || item.position || "").trim().toLowerCase();

      if (nickname === "никнейм" || nickname === "nickname" || nickname === "nick") return true;
      return nickname === "ник" && position === "должность";
    }

    function isStatsSectionRow(item) {
      var nickname = String(valueOf(item, "nickname") || item.nickname || "").trim();
      if (!nickname || nickname.length < 3 || isStatsColumnHeader(item)) return false;

      var otherKeys = ["position","levels","activity_points","points","last_promotion","age","pc_access","inactives","strikes","warnings"];
      var hasOtherData = otherKeys.some(function (key) {
        var value = valueOf(item, key);
        return value != null && String(value).trim() !== "";
      });

      return !hasOtherData && nickname === nickname.toUpperCase();
    }

    function load(user) {
      var root = document.getElementById("allStatsRoot");
      var refresh = document.getElementById("allStatsRefresh");
      var dateInput = document.getElementById("allStatsDate");
      if (!root) return Promise.resolve();

      if (dateInput && dateInput.value) {
        selectedDate = dateInput.value;
      }

      if (refresh) {
        refresh.disabled = true;
        refresh.textContent = "Загрузка…";
      }

      return Promise.all([
        window.BR_API.allStatistics(user.token),
        window.BR_API.normativesDaily(user.token, selectedDate)
      ]).then(function (results) {
        var statisticsResult = results[0] || {};
        var normativesResult = results[1] || {};
        lastData = Array.isArray(statisticsResult.statistics) ? statisticsResult.statistics : [];
        lastNormatives = Array.isArray(normativesResult.administrators) ? normativesResult.administrators : [];

        renderTable(user);
      }).catch(function (error) {
        root.innerHTML = '<div class="box"><div class="empty">' +
          E(error.message || "Не удалось загрузить статистику администрации.") +
          '</div></div>';
      }).finally(function () {
        if (refresh) {
          refresh.disabled = false;
          refresh.textContent = "↻ Обновить";
        }
      });
    }

    function renderTable(user) {
      var root = document.getElementById("allStatsRoot");
      if (!root) return;
      var norms = normMap();
      var googleHeaders = googleStatisticsColumns(lastData);
      var googleCount = googleHeaders.length;

      var rows = lastData.map(function (item) {
        var nickname = String(valueOf(item, "nickname") || item.nickname || "").trim();
        if (!nickname || isStatsColumnHeader(item)) return "";
        if (isStatsSectionRow(item)) {
          return '<tr class="stats-section-row"><td colspan="' + (googleCount + 2) + '"><b>' + E(nickname) + '</b></td></tr>';
        }
        var norm = norms[nickname.toLowerCase()] || {};
        var status = norm.status || "not_submitted";
        var raw = googleStatisticsRaw(item, googleCount);
        var valuesCells = googleHeaders.map(function (header, index) {
          var value = displayValue(raw[index]);
          return '<td>' + (isGoogleNicknameHeader(header) ? '<b>' + E(value) + '</b>' : E(value)) + '</td>';
        }).join("");
        return '<tr>' + valuesCells +
          '<td class="stats-norm-cell"><span>' + normativeStatus(status) + '</span><div class="stats-norm-actions">' +
            '<button class="normative-icon-button normative-mark-norm" data-stat-norm="norm" data-nickname="' + E(nickname) + '" title="Норма" aria-label="Норма">✓</button>' +
            '<button class="normative-icon-button normative-mark-rework" data-stat-norm="rework" data-nickname="' + E(nickname) + '" title="Перенорма" aria-label="Перенорма">↻</button>' +
            '<button class="normative-icon-button normative-mark-no-norm" data-stat-norm="no_norm" data-nickname="' + E(nickname) + '" title="Нет нормы" aria-label="Нет нормы">✕</button>' +
            '<button class="normative-icon-button normative-mark-inactive" data-stat-norm="inactive" data-nickname="' + E(nickname) + '" title="Неактив" aria-label="Неактив">—</button>' +
          '</div></td>' +
          '<td class="admin-actions-cell"><div class="admin-menu-wrap"><button class="admin-menu-trigger" type="button" data-admin-menu="' + E(nickname) + '" title="Действия" aria-label="Действия">⋮</button><div class="admin-row-menu" data-admin-row-menu="' + E(nickname) + '"><button type="button" data-edit-admin="' + E(nickname) + '">Изменить</button></div></div></td></tr>';
      }).filter(Boolean).join("");

      var realRows = lastData.filter(function (item) {
        var nickname = String(valueOf(item, "nickname") || item.nickname || "").trim();
        return nickname && !isStatsColumnHeader(item) && !isStatsSectionRow(item);
      }).length;

      if (!rows) rows = '<tr><td colspan="' + (googleCount + 2) + '" class="table-empty">Данных администрации нет.</td></tr>';

      var headerCells = googleHeaders.map(function (header) { return '<th>' + E(russianAdminHeader(header)) + '</th>'; }).join("");
      root.innerHTML =
        '<div class="box table-box"><div class="stats-table-head"><div><small>ПОЛНАЯ СТАТИСТИКА ИЗ GOOGLE APPS SCRIPT</small><b>' + E(String(realRows)) + ' сотрудников</b></div><span class="muted">Дата норматива: ' + E(formatDateOnly(selectedDate)) + '</span></div>' +
        '<div class="admins-source-row"><span>Все столбцы строки Google Sheets</span><span>Источник: Google Apps Script</span></div>' +
        '<table id="allStatsTable"><thead><tr>' + headerCells + '<th>Норматив</th><th>Действия</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<div id="adminEditModal"></div>';

      document.querySelectorAll("[data-stat-norm]").forEach(function (button) {
        button.onclick = async function () {
          var nickname = button.dataset.nickname || "";
          var status = button.dataset.statNorm || "";
          var label = STATUS_LABELS[status] || status;
          if (!confirm("Выставить «" + label + "» для " + nickname + " за " + formatDateOnly(selectedDate) + "?")) return;
          button.disabled = true;
          try {
            await window.BR_API.normativeMark(user.token, nickname, selectedDate, status, "");
            await load(user);
          } catch (error) {
            alert(error.message || "Не удалось сохранить норматив.");
            button.disabled = false;
          }
        };
      });

      document.querySelectorAll("[data-admin-menu]").forEach(function (button) {
        button.onclick = function (event) {
          event.stopPropagation();
          var nickname = button.dataset.adminMenu || "";
          document.querySelectorAll(".admin-row-menu.open").forEach(function (menu) {
            if (menu.getAttribute("data-admin-row-menu") !== nickname) menu.classList.remove("open");
          });
          var menu = document.querySelector('[data-admin-row-menu="' + CSS.escape(nickname) + '"]');
          if (menu) menu.classList.toggle("open");
        };
      });

      document.querySelectorAll("[data-edit-admin]").forEach(function (button) {
        button.onclick = function () {
          var nickname = button.dataset.editAdmin || "";
          var item = lastData.find(function (entry) {
            return String(valueOf(entry, "nickname") || entry.nickname || "").trim().toLowerCase() === nickname.toLowerCase();
          });
          closeMenus();
          openEditModal(user, item || {values:{nickname:nickname}});
        };
      });
    }

    function closeMenus() {
      document.querySelectorAll(".admin-row-menu.open").forEach(function (menu) {
        menu.classList.remove("open");
      });
    }

    function openEditModal(user, item) {
      var root = document.getElementById("adminEditModal");
      if (!root) return;

      var nickname = String(valueOf(item, "nickname") || item.nickname || "").trim();
      var formFields = EDIT_FIELDS.map(function (field) {
        var value = valueOf(item, field[1]);

        if (field[1] === "position") {
          return '<div class="form-field">' +
            '<label>' + E(field[0]) + '</label>' +
            positionSelect("", field[1], value) +
          '</div>';
        }

        return '<div class="form-field">' +
          '<label>' + E(field[0]) + '</label>' +
          '<input class="form-input" name="' + E(field[1]) + '" type="' + E(field[2]) + '" value="' + E(value) + '">' +
        '</div>';
      }).join("");

      root.innerHTML =
        '<div class="modal-backdrop" id="adminEditBackdrop">' +
          '<div class="modal-card admin-edit-card">' +
            '<div class="modal-head">' +
              '<div><small>РЕДАКТИРОВАНИЕ АДМИНИСТРАТОРА</small><h2>' + E(nickname || "Администратор") + '</h2></div>' +
              '<button class="modal-close" id="adminEditClose" type="button">×</button>' +
            '</div>' +
            '<form id="adminEditForm">' +
              '<div class="form-grid">' + formFields + '</div>' +
              '<div class="form-actions admin-edit-actions">' +
                '<button class="button button-secondary" id="adminEditCancel" type="button">Отмена</button>' +
                '<button class="button button-primary" type="submit">Сохранить изменения</button>' +
              '</div>' +
              '<div class="field-hint admin-edit-hint">Дни и расчётные показатели не вводятся вручную — они рассчитываются системой.</div>' +
            '</form>' +
          '</div>' +
        '</div>';

      function close() {
        root.innerHTML = "";
      }

      document.getElementById("adminEditClose").onclick = close;
      document.getElementById("adminEditCancel").onclick = close;

      document.getElementById("adminEditForm").onsubmit = async function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        var changes = {};

        EDIT_FIELDS.forEach(function (field) {
          var input = form.querySelector('[name="' + CSS.escape(field[1]) + '"]');
          if (input) changes[field[1]] = input.value.trim();
        });

        var saveButton = form.querySelector('button[type="submit"]');
        if (saveButton) {
          saveButton.disabled = true;
          saveButton.textContent = "Сохранение…";
        }

        try {
          await window.BR_API.updateAdminStatistics(
            user.token,
            nickname,
            changes
          );
          close();
          await load(user);
        } catch (error) {
          alert(error.message || "Не удалось сохранить изменения администратора.");
          if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = "Сохранить изменения";
          }
        }
      };
    }

    return {
      managementOnly: true,
      title: "Статистика администрации",
      subtitle: "Интерактивный контроль состава, статистики и нормативов",
      render: function () {
        return '<div class="page-toolbar stats-all-toolbar">' +
          '<div><small>ОБЩАЯ СТАТИСТИКА</small><b>Состояние администрации и норматив за выбранную дату</b></div>' +
          '<div class="stats-toolbar-actions">' +
            '<button class="small-button" id="statsDatePrev" type="button">←</button>' +
            '<input id="allStatsDate" class="form-input date-control" type="date" value="' + E(selectedDate) + '">' +
            '<button class="small-button" id="statsDateNext" type="button">→</button>' +
            '<button class="button button-secondary" id="statsDateToday" type="button">Сегодня</button>' +
            '<button class="button button-secondary" id="allStatsRefresh" type="button">↻ Обновить</button>' +
          '</div>' +
        '</div>' +
        '<div id="allStatsRoot"><div class="box"><div class="empty">Загрузка статистики администрации...</div></div></div>';
      },
      bind: function (user) {
        var date = document.getElementById("allStatsDate");
        var prev = document.getElementById("statsDatePrev");
        var next = document.getElementById("statsDateNext");
        var today = document.getElementById("statsDateToday");
        var refresh = document.getElementById("allStatsRefresh");

        function setDate(value) {
          if (!value) return;
          selectedDate = value;
          if (date) date.value = value;
          load(user);
        }

        if (date) date.onchange = function () { setDate(date.value); };
        if (prev) prev.onclick = function () { setDate(dateIso(-1)); };
        if (next) next.onclick = function () { setDate(dateIso(1)); };
        if (today) today.onclick = function () { setDate(dateIso(0)); };
        if (refresh) refresh.onclick = function () { load(user); };

        document.addEventListener("click", function () {
          closeMenus();
        });
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

  function russianAdminHeader(value) {
    var key = String(value == null ? "" : value).trim();
    var normalized = key.toLowerCase().replace(/\s+/g, " ");
    var map = {"nickname":"Никнейм","nick":"Никнейм","name":"Имя","position":"Должность","role":"Роль","age":"Возраст","pc":"Доступ с ПК","pc access":"Доступ с ПК","levels":"Уровни","points":"Баллы","activity points":"Баллы активности","inactives":"Неактивы","strikes":"Страйки","warnings":"Предупреждения","last promotion":"Последнее повышение"};
    return map[normalized] || key || "Колонка";
  }

  function formatDateOnly(value) {
    if (!value) return "—";
    var date = new Date(String(value) + "T00:00:00");
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("ru-RU", {weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"});
  }

  function normativeStatus(status) {
    var map = {
      pending: ["На проверке", "badge-yellow"],
      norm: ["Норма", "badge-green"],
      rework: ["Перенорма", "badge-blue"],
      no_norm: ["Нет нормы", "badge-red"],
      inactive: ["Неактив", "badge-gray"],
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
                '<div class="form-field"><label>Должность</label>' +
  positionSelect("normPosition", "position", user.position || "") +
'</div>' +
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
                  '<td>' + (
                    item.id
                      ? '<button class="small-button" data-own-norm="' + E(item.id) + '">Открыть</button>'
                      : '<span class="muted">Результат зафиксирован</span>'
                  ) + '</td>' +
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
          var action = item.submission_id
            ? '<button class="small-button" data-open-admin-norm="' + E(item.submission_id) + '" data-admin-id="' + E(item.admin_id || 0) + '" data-admin-nickname="' + E(item.nickname) + '">Проверить</button>'
            : '<span class="muted">Нет файла</span>';

          return '<tr>' +
            '<td><button class="link-button" data-open-admin-norm="' + E(item.submission_id || 0) + '" data-admin-id="' + E(item.admin_id || 0) + '" data-admin-nickname="' + E(item.nickname) + '">' + E(item.nickname) + '</button></td>' +
            '<td>' + E(item.position || "—") + '</td>' +
            '<td>' + E(formatDateOnly(selectedDate)) + '</td>' +
            '<td>' + E(item.created_at ? formatDateTime(item.created_at) : "—") + '</td>' +
            '<td>' + normativeStatus(item.status) + '</td>' +
            '<td>' + E(item.file_count || 0) + '</td>' +
            '<td>' + E(item.review_comment || "—") + '</td>' +
            '<td>' + action + '</td>' +
          '</tr>';
        }).join("");

        var statusButtons =
          '<div class="normative-filters">' +
            '<button class="filter-button active" data-status-filter="all" type="button">Все</button>' +
            '<button class="filter-button" data-status-filter="not_submitted" type="button">Не сдали</button>' +
            '<button class="filter-button" data-status-filter="pending" type="button">На проверке</button>' +
            '<button class="filter-button" data-status-filter="norm" type="button">Норма</button>' +
            '<button class="filter-button" data-status-filter="rework" type="button">Перенорма</button>' +
            '<button class="filter-button" data-status-filter="no_norm" type="button">Нет нормы</button>' +
            '<button class="filter-button" data-status-filter="inactive" type="button">Неактив</button>' +
            '<input id="normativeSearch" class="form-input normative-search" type="search" placeholder="Поиск по никнейму">' +
          '</div>';

        root.innerHTML =
          '<div class="box table-box"><div class="stats-table-head"><div><small>НОРМАТИВЫ ЗА ДАТУ</small><b>' +
          E(formatDateOnly(selectedDate)) +
          '</b></div><span class="muted">' + E(String(list.length)) + ' администраторов</span></div>' +
          statusButtons +
          '<table id="normativeJournalTable"><thead><tr><th>Никнейм</th><th>Должность</th><th>Дата</th><th>Время</th><th>Статус</th><th>Файлы</th><th>Решение</th><th>Действия</th></tr></thead><tbody>' +
          (rows || '<tr><td colspan="8" class="table-empty">Администраторов в реестре нет.</td></tr>') +
          '</tbody></table></div>';

        var activeFilter = "all";
        var searchInput = document.getElementById("normativeSearch");

        function applyNormativeFilters() {
          var query = searchInput ? searchInput.value.trim().toLowerCase() : "";
          document.querySelectorAll("#normativeJournalTable tbody tr[data-normative-status]").forEach(function (row) {
            var status = row.getAttribute("data-normative-status") || "";
            var nickname = row.getAttribute("data-normative-nickname") || "";
            row.style.display =
              (activeFilter === "all" || status === activeFilter) &&
              (!query || nickname.indexOf(query) !== -1)
                ? ""
                : "none";
          });
        }

        // Mark rows after they are inserted so the filters do not need
        // to rebuild the whole table.
        document.querySelectorAll("#normativeJournalTable tbody tr").forEach(function (row, index) {
          var item = list[index];
          if (item) {
            row.setAttribute("data-normative-status", item.status || "not_submitted");
            row.setAttribute("data-normative-nickname", String(item.nickname || "").toLowerCase());
          }
        });

        document.querySelectorAll("[data-status-filter]").forEach(function (button) {
          button.onclick = function () {
            activeFilter = button.getAttribute("data-status-filter") || "all";
            document.querySelectorAll("[data-status-filter]").forEach(function (item) {
              item.classList.toggle("active", item === button);
            });
            applyNormativeFilters();
          };
        });

        if (searchInput) {
          searchInput.oninput = applyNormativeFilters;
        }

        document.querySelectorAll("[data-open-admin-norm]").forEach(function (button) {
          button.onclick = function () {
            openNormativeModal({
              token: user.token,
              submissionId: Number(button.dataset.openAdminNorm || 0),
              adminId: Number(button.dataset.adminId || 0),
              nickname: button.dataset.adminNickname || "",
              date: selectedDate,
              management: true
            });
          };
        });


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
                '<button class="button button-secondary" data-review="rework">Перенорма</button>' +
                '<button class="button button-primary" data-review="norm">Норма</button>' +
                '<button class="button button-danger" data-review="no_norm">Нет нормы</button>' +
                '<button class="button button-secondary" data-review="inactive">Неактив</button>' +
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
                await window.BR_API.normativeMark(
                  options.token,
                  options.nickname || (s && s.nickname) || "",
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

  function settings(user) {
    var lastSettings = {
      theme: user.theme || "dark",
      web_app_url: ""
    };

    function syncTheme(theme) {
      var value = String(theme || "dark").toLowerCase() === "light" ? "light" : "dark";
      window.BRApp.applyTheme(value);
      window.BRApp.updateSessionUser({ theme: value });
      lastSettings.theme = value;
    }

    function render() {
      var isManagement = user.role === "management";

      return '<div class="settings-grid">' +
        '<section class="box settings-card">' +
          '<div class="settings-card-head"><div><small>БЕЗОПАСНОСТЬ</small><h2>Пароль</h2></div><span>Изменение пароля аккаунта</span></div>' +
          '<form id="passwordSettingsForm">' +
            '<div class="form-grid">' +
              '<div class="form-field form-full"><label>Текущий пароль</label><input id="currentPassword" class="form-input" type="password" autocomplete="current-password" required></div>' +
              '<div class="form-field"><label>Новый пароль</label><input id="newPassword" class="form-input" type="password" autocomplete="new-password" minlength="6" required></div>' +
              '<div class="form-field"><label>Повторите новый пароль</label><input id="newPasswordConfirm" class="form-input" type="password" autocomplete="new-password" minlength="6" required></div>' +
            '</div>' +
            '<p class="settings-hint">Минимальная длина нового пароля — 6 символов.</p>' +
            '<div class="form-actions"><button class="button button-primary" id="passwordSettingsSubmit" type="submit">Изменить пароль</button></div>' +
          '</form>' +
        '</section>' +

        '<section class="box settings-card">' +
          '<div class="settings-card-head"><div><small>ВНЕШНИЙ ВИД</small><h2>Тема интерфейса</h2></div><span>Настройка сохраняется за аккаунтом</span></div>' +
          '<form id="themeSettingsForm">' +
            '<div class="theme-choice">' +
              '<label class="theme-option"><input type="radio" name="theme" value="dark"' + (lastSettings.theme === "dark" ? " checked" : "") + '><span><b>Тёмная</b><small>Стандартная тема панели</small></span></label>' +
              '<label class="theme-option"><input type="radio" name="theme" value="light"' + (lastSettings.theme === "light" ? " checked" : "") + '><span><b>Светлая</b><small>Светлый вариант интерфейса</small></span></label>' +
            '</div>' +
            '<div class="form-actions"><button class="button button-primary" type="submit">Сохранить тему</button></div>' +
          '</form>' +
        '</section>' +

        (isManagement
          ? '<section class="box settings-card settings-google-card">' +
              '<div class="settings-card-head"><div><small>GOOGLE APPS SCRIPT</small><h2>Web app URL</h2></div><span>Адрес веб-развёртывания</span></div>' +
              '<form id="googleUrlSettingsForm">' +
                '<div class="form-field"><label>URL Web app</label><input id="googleWebAppUrl" class="form-input" type="url" placeholder="https://script.google.com/macros/s/.../exec" autocomplete="off" value="' + E(lastSettings.web_app_url || "") + '"></div>' +
                '<p class="settings-hint">Ссылка сохраняется в Supabase и используется модулем статистики для запросов к Google Apps Script. Вставляйте URL веб-приложения, который заканчивается на <b>/exec</b>.</p>' +
                '<div class="form-actions"><button class="button button-primary" id="googleUrlSettingsSubmit" type="submit">Сохранить URL</button></div>' +
              '</form>' +
            '</section>'
          : "") +
      '</div>' +
      '<div id="settingsStatus" class="settings-status" hidden></div>';
    }

    function showStatus(message, ok) {
      var root = document.getElementById("settingsStatus");
      if (!root) return;
      root.hidden = false;
      root.className = "settings-status " + (ok ? "settings-status-ok" : "settings-status-error");
      root.textContent = message;
    }

    return {
      title: "Настройки",
      subtitle: "Безопасность, внешний вид и системные параметры аккаунта",
      render: render,
      bind: function () {
        var passwordForm = document.getElementById("passwordSettingsForm");
        var themeForm = document.getElementById("themeSettingsForm");
        var googleForm = document.getElementById("googleUrlSettingsForm");

        if (passwordForm) {
          passwordForm.onsubmit = async function (event) {
            event.preventDefault();

            var currentPassword = document.getElementById("currentPassword").value;
            var newPassword = document.getElementById("newPassword").value;
            var confirmPassword = document.getElementById("newPasswordConfirm").value;
            var button = document.getElementById("passwordSettingsSubmit");

            if (newPassword !== confirmPassword) {
              showStatus("Новые пароли не совпадают.", false);
              return;
            }

            if (newPassword.length < 6) {
              showStatus("Новый пароль должен содержать минимум 6 символов.", false);
              return;
            }

            button.disabled = true;
            button.textContent = "Сохранение…";

            try {
              await window.BR_API.settingsUpdate(user.token, {
                current_password: currentPassword,
                new_password: newPassword
              });
              passwordForm.reset();
              showStatus("Пароль успешно изменён.", true);
            } catch (error) {
              showStatus(error.message || "Не удалось изменить пароль.", false);
            } finally {
              button.disabled = false;
              button.textContent = "Изменить пароль";
            }
          };
        }

        if (themeForm) {
          themeForm.querySelectorAll('input[name="theme"]').forEach(function (input) {
            input.onchange = function () {
              syncTheme(input.value);
              showStatus("Предпросмотр темы применён. Нажмите «Сохранить тему», чтобы сохранить выбор.", true);
            };
          });

          themeForm.onsubmit = async function (event) {
            event.preventDefault();

            var checked = themeForm.querySelector('input[name="theme"]:checked');
            var theme = checked ? checked.value : "dark";
            var button = themeForm.querySelector("button[type=submit]");

            button.disabled = true;
            button.textContent = "Сохранение…";

            try {
              var result = await window.BR_API.settingsUpdate(user.token, { theme: theme });
              var savedTheme = result && result.settings && result.settings.theme
                ? result.settings.theme
                : theme;
              syncTheme(savedTheme);
              showStatus("Тема сохранена.", true);
            } catch (error) {
              showStatus(error.message || "Не удалось сохранить тему.", false);
            } finally {
              button.disabled = false;
              button.textContent = "Сохранить тему";
            }
          };
        }

        if (googleForm) {
          googleForm.onsubmit = async function (event) {
            event.preventDefault();

            var input = document.getElementById("googleWebAppUrl");
            var button = document.getElementById("googleUrlSettingsSubmit");
            var value = input.value.trim();

            button.disabled = true;
            button.textContent = "Сохранение…";

            try {
              var result = await window.BR_API.settingsUpdate(user.token, {
                web_app_url: value
              });
              var saved = result && result.settings ? result.settings.web_app_url : value;
              input.value = saved || "";
              lastSettings.web_app_url = saved || "";
              showStatus(saved ? "URL Google Apps Script сохранён в Supabase." : "URL очищен.", true);
            } catch (error) {
              showStatus(error.message || "Не удалось сохранить URL.", false);
            } finally {
              button.disabled = false;
              button.textContent = "Сохранить URL";
            }
          };
        }
      },
      load: async function () {
        try {
          var result = await window.BR_API.settingsGet(user.token);
          var settingsData = result && result.settings ? result.settings : {};
          var theme = settingsData.theme || user.theme || "dark";

          syncTheme(theme);

          var themeInput = document.querySelector('#themeSettingsForm input[name="theme"][value="' + E(theme) + '"]');
          if (themeInput) themeInput.checked = true;

          if (user.role === "management") {
            var urlInput = document.getElementById("googleWebAppUrl");
            if (urlInput) {
              urlInput.value = settingsData.web_app_url || "";
              lastSettings.web_app_url = settingsData.web_app_url || "";
            }
          }
        } catch (error) {
          showStatus(error.message || "Не удалось загрузить настройки.", false);
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
            return '<tr><td>' + E(formatDateTime(x.created_at || x.time)) + '</td><td>' + E(x.nickname) + '</td><td>' +
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
          '<div class="form-field"><label>Должность</label>' +
  positionSelect("accessPosition", "position", "") +
'</div>' +
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
    access: access,
    settings: settings
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
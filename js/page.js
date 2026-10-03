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

  function formatStatisticsCellValue(headerOrKey, value) {
    if (value == null || value === "") return "—";

    var key = String(headerOrKey == null ? "" : headerOrKey)
      .trim()
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/\s+/g, " ");

    var isDateField =
      key === "last_promotion" ||
      key === "последнее повышение" ||
      key === "дата заполнения" ||
      key === "дата";

    if (isDateField) {
      var text = String(value).trim();

      function formatParts(day, month, year) {
        return String(day).padStart(2, "0") + "." +
          String(month).padStart(2, "0") + "." +
          String(year);
      }

      // ISO: 2026-10-03, 2026-10-03T12:34:56...
      var iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:t|\s|$)/i);
      if (iso) {
        return formatParts(Number(iso[3]), Number(iso[2]), Number(iso[1]));
      }

      // Russian / common table formats: 3.10.2026, 03/10/2026, 3-10-2026.
      var dmy = text.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/);
      if (dmy) {
        return formatParts(Number(dmy[1]), Number(dmy[2]), Number(dmy[3]));
      }

      // Google Sheets / Excel serial date, when the source returns a number.
      var numericDate = Number(text);
      if (Number.isFinite(numericDate) && numericDate >= 20000 && numericDate <= 70000) {
        var serialDate = new Date(Date.UTC(1899, 11, 30) + Math.trunc(numericDate) * 86400000);
        return formatParts(
          serialDate.getUTCDate(),
          serialDate.getUTCMonth() + 1,
          serialDate.getUTCFullYear()
        );
      }

      var parsedDate = new Date(text);
      if (!Number.isNaN(parsedDate.getTime())) {
        return formatParts(
          parsedDate.getDate(),
          parsedDate.getMonth() + 1,
          parsedDate.getFullYear()
        );
      }
    }

    return value;
  }

  function statCards(values) {
    return STAT_FIELDS.map(function (field) {
      var value = formatStatisticsCellValue(field[1], values[field[1]]);
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
    function formatGoogleCellValue(header, value) {
      if (value == null || value === "") return "—";

      var key = String(header || "")
        .trim()
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/\s+/g, " ");

      var rawValue = String(value);

      if (
        key === "последнее повышение" ||
        key === "last promotion" ||
        key === "дата" ||
        key === "date"
      ) {
        var parsedDate = new Date(rawValue);

        if (!Number.isNaN(parsedDate.getTime())) {
          return parsedDate.toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
          });
        }
      }

      return rawValue;
    }

    var rows = data.headers.map(function (header, index) {
      var value = formatGoogleCellValue(header, data.raw[index]);

      return '<tr><td><b>' + E(columnLetter(index)) + '</b></td><td>' + E(header || "Без названия") + '</td><td>' + E(value) + '</td></tr>';
    }).join("");
    var mobileRows = data.headers.map(function (header, index) {
      var value = formatGoogleCellValue(header, data.raw[index]);

      return '<div class="mobile-data-card">' +
        '<div class="mobile-data-label">' + E(header || ("Колонка " + columnLetter(index))) + '</div>' +
        '<div class="mobile-data-value">' + E(value) + '</div>' +
      '</div>';
    }).join("");

    return '<div class="page-toolbar"><div><small>GOOGLE ТАБЛИЦА</small><b>' + E(caption || "Полные данные строки") + '</b></div><span class="muted">' + E(rangeText) + '</span></div>' +
      '<div class="box table-box google-row-desktop"><table class="google-row-table"><thead><tr><th>Колонка</th><th>Заголовок</th><th>Значение</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="mobile-data-list google-row-mobile">' + mobileRows + '</div>';
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
      subtitle: "Полные данные из реестра администрации",
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
      root.innerHTML = '<div class="box"><div class="empty">Загрузка состава администрации через Google Таблица...</div></div>';
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
        root.innerHTML = '<div class="box table-box"><div class="stats-table-head"><div><small>СОСТАВ АДМИНИСТРАЦИИ</small><b>' + E(String(rows.length)) + ' записей</b></div><span class="muted">Источник: Google Таблица • Google Sheets</span></div><table id="adminsTable"><thead><tr><th>Строка</th>' + headerCells + '</tr></thead><tbody>' + bodyRows + '</tbody></table></div>';
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
      subtitle: "Полный состав из Google Таблица",
      render: function () {
        return '<div class="page-toolbar admin-list-toolbar"><div><small>СОСТАВ АДМИНИСТРАЦИИ</small><b>Никнеймы, должности и актуальные данные</b></div><div class="admins-actions"><input id="adminsSearch" class="form-input admins-search" type="search" placeholder="Поиск по таблице"><button class="button button-secondary" id="adminsRefresh" type="button">↻ Обновить</button></div></div><div class="admins-source-row"><span>Источник: Google Таблица • Google Sheets</span><span id="adminsUpdated">Обновлено: —</span></div><div id="adminsRoot"><div class="box"><div class="empty">Загрузка...</div></div></div>';
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
      subtitle: "Полная строка администратора из Google Таблица",
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
    var statsSortMode = "seniority";
    var lastData = [];
    var lastNormatives = [];
    var lastMarks = [];

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
        var nickname = String(item.nickname || "").trim().toLowerCase();
        if (nickname) map[nickname] = item;
      });

      lastMarks.forEach(function (item) {
        var nickname = String(item.nickname || "").trim().toLowerCase();
        if (nickname) map[nickname] = item;
      });

      return map;
    }

    function normalizeHeaderKey(header) {
      var key = String(header == null ? "" : header)
        .trim()
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[_\-]+/g, " ")
        .replace(/\s+/g, " ");

      var compact = key.replace(/[^a-zа-я0-9]/gi, "");

      var map = {
        "никнейм":"nickname","ник":"nickname","nickname":"nickname","nick":"nickname","логин":"nickname","login":"nickname","username":"nickname",
        "возраст":"age","лет":"age","age":"age",
        "доступ с пк":"pc_access","доступ пк":"pc_access","доступ к пк":"pc_access","доступ к компьютеру":"pc_access","пк":"pc_access","pc access":"pc_access","pcaccess":"pc_access","pc":"pc_access",
        "должность":"position","позиция":"position","position":"position","rank":"position",
        "уровни":"levels","уровень":"levels","левел":"levels","lvl":"levels","level":"levels","levels":"levels",
        "баллы активности":"activity_points","очки активности":"activity_points","очки за активность":"activity_points","баллы за активность":"activity_points","активность":"activity_points","activity points":"activity_points","activitypoints":"activity_points","activity":"activity_points",
        "неактивы":"inactives","неактив":"inactives","неактивные":"inactives","неактивность":"inactives","inactive":"inactives","inactives":"inactives",
        "страйки":"strikes","страйк":"strikes","выговоры":"strikes","выговор":"strikes","strikes":"strikes","strike":"strikes",
        "предупреждения":"warnings","предупреждение":"warnings","варны":"warnings","варн":"warnings","warnings":"warnings","warning":"warnings",
        "баллы":"points","очки":"points","points":"points","score":"points",
        "последнее повышение":"last_promotion","дата последнего повышения":"last_promotion","повышение":"last_promotion","дата повышения":"last_promotion","last promotion":"last_promotion","last_promotion":"last_promotion","lastpromotion":"last_promotion",
        "дни на посте":"post_days","дни на посту":"post_days","дней на посте":"post_days","дней на посту":"post_days","дни на пост":"post_days","дни поста":"post_days","дней поста":"post_days","дни напасти":"post_days","дней напасти":"post_days","напасти":"post_days","напасту":"post_days","стаж на посте":"post_days","стаж на посту":"post_days","post days":"post_days","post day":"post_days","postdays":"post_days","days on post":"post_days","daysonpost":"post_days",
        "норматив":"normative","нормативы":"normative","норма":"normative","нормы":"normative","норм":"normative","статус норматива":"normative","результат норматива":"normative","norm":"normative","normative":"normative","normatives":"normative",
        "статус":"status","статус нормы":"status","статус норматива":"status","результат":"status","status":"status","result":"status",
        "дата":"date","дата норматива":"date","дата нормы":"date","день":"date","дата проверки":"date","дата сдачи":"date","date":"date","submission date":"date","submissiondate":"date",
        "комментарий":"comment","примечание":"comment","примечания":"comment","коммент":"comment","comment":"comment","comments":"comment","note":"comment"
      };

      if (map[key]) return map[key];

      if (compact.indexOf("ник") === 0 || compact.indexOf("nick") === 0 || compact.indexOf("username") === 0) return "nickname";
      if (compact.indexOf("возраст") !== -1 || compact === "age") return "age";
      if (compact.indexOf("доступ") !== -1 && (compact.indexOf("пк") !== -1 || compact.indexOf("комп") !== -1)) return "pc_access";
      if (compact.indexOf("долж") !== -1 || compact.indexOf("позици") !== -1 || compact === "position") return "position";
      if (compact.indexOf("уров") !== -1 || compact.indexOf("левел") !== -1 || compact === "lvl" || compact === "level") return "levels";
      if (compact.indexOf("актив") !== -1 && (compact.indexOf("балл") !== -1 || compact.indexOf("очк") !== -1 || compact === "activity")) return "activity_points";
      if (compact.indexOf("неактив") !== -1 || compact.indexOf("inactive") !== -1) return "inactives";
      if (compact.indexOf("выговор") !== -1 || compact.indexOf("страйк") !== -1 || compact.indexOf("strike") !== -1) return "strikes";
      if (compact.indexOf("предупреж") !== -1 || compact.indexOf("варн") !== -1 || compact.indexOf("warning") !== -1) return "warnings";
      if (compact.indexOf("балл") !== -1 || compact.indexOf("очк") !== -1 || compact === "points" || compact === "score") return "points";
      if (compact.indexOf("повыш") !== -1 || compact.indexOf("promotion") !== -1) return "last_promotion";
      if ((compact.indexOf("дни") !== -1 || compact.indexOf("дней") !== -1 || compact.indexOf("дня") !== -1) && (compact.indexOf("пост") !== -1 || compact.indexOf("напаст") !== -1)) return "post_days";
      if (compact === "напасти" || compact === "напасту" || compact.indexOf("postday") !== -1 || compact.indexOf("daysonpost") !== -1) return "post_days";
      if (compact.indexOf("норматив") !== -1 || compact.indexOf("нормат") !== -1 || compact === "норма" || compact === "норм" || compact === "norm") return "normative";
      if (compact.indexOf("статус") !== -1 || compact.indexOf("результат") !== -1 || compact === "status" || compact === "result") return "status";
      if (compact.indexOf("дата") !== -1 || compact.indexOf("date") !== -1) return "date";
      if (compact.indexOf("коммент") !== -1 || compact.indexOf("примеч") !== -1 || compact.indexOf("comment") !== -1 || compact.indexOf("note") !== -1) return "comment";

      return key;
    }

    function valueOf(item, key) {
      if (!item) return "";

      if (item[key] != null && item[key] !== "") {
        return item[key];
      }

      var values = item.values || {};

      if (values[key] != null && values[key] !== "") {
        return values[key];
      }

      var headers = Array.isArray(values.headers)
        ? values.headers
        : [];

      var raw = Array.isArray(values.raw_row)
        ? values.raw_row
        : [];

      for (var i = 0; i < headers.length; i += 1) {
        var mappedKey = normalizeHeaderKey(headers[i]);

        if (mappedKey === key) {
          return raw[i] != null ? raw[i] : "";
        }
      }

      return "";
    }

    function displayValue(value) {
      return value == null || value === "" ? "—" : value;
    }

    function showNormativeResult(message, type) {
      var existing = document.getElementById("normativeActionToast");
      if (existing) existing.remove();

      var toast = document.createElement("div");
      toast.id = "normativeActionToast";
      toast.className = "toast normative-action-toast " +
        (type === "success" ? "normative-toast-success" : "normative-toast-error");
      toast.textContent = message;
      document.body.appendChild(toast);

      window.setTimeout(function () {
        if (toast.parentNode) toast.remove();
      }, 4500);
    }

    function normativeErrorMessage(error) {
      var code = error && error.code ? error.code : "";

      var messages = {
        NORMATIVE_ADMIN_NOT_FOUND: "❌ Никнейм не найден ни на одном подходящем листе Google Sheets.",
        NORMATIVE_DATE_NOT_FOUND: "❌ Указанная дата не найдена ни на одном подходящем листе.",
        NORMATIVE_CELL_NOT_FOUND: "❌ Не удалось определить ячейку для норматива.",
        NORMATIVE_MARK_STATUS_REQUIRED: "❌ Передан неизвестный статус норматива.",
        APPS_SCRIPT_UNAUTHORIZED: "❌ Google Таблица отклонил запрос: проверь секрет.",
        APPS_SCRIPT_TIMEOUT: "❌ Google Таблица не ответил вовремя.",
        APPS_SCRIPT_HTTP_404: "❌ Google Таблица вернул 404. Проверь веб-развёртывание.",
        APPS_SCRIPT_HTTP_403: "❌ Google Таблица отклонил доступ к веб-приложению.",
        STATISTICS_DISABLED: "❌ Модуль статистики отключён.",
        FORBIDDEN: "❌ Недостаточно прав для выставления норматива."
      };

      return messages[code] ||
        (error && error.message) ||
        "❌ Не удалось сохранить норматив.";
    }

    function itemNickname(item) {
      var direct = String(
        valueOf(item, "nickname") ||
        item.nickname ||
        ""
      ).trim();

      if (direct) {
        return direct;
      }

      var values = item && item.values ? item.values : {};
      var headers = Array.isArray(values.headers) ? values.headers : [];
      var raw = Array.isArray(values.raw_row) ? values.raw_row : [];

      for (var i = 0; i < headers.length; i += 1) {
        if (isGoogleNicknameHeader(headers[i])) {
          return String(raw[i] == null ? "" : raw[i]).trim();
        }
      }

      return "";
    }

    function isStatsColumnHeader(item) {
      var nickname = itemNickname(item).toLowerCase();

      var values = item && item.values ? item.values : {};
      var headers = Array.isArray(values.headers) ? values.headers : [];
      var raw = Array.isArray(values.raw_row) ? values.raw_row : [];
      var position = "";

      for (var i = 0; i < headers.length; i += 1) {
        if (String(headers[i] || "").trim().toLowerCase() === "должность") {
          position = String(raw[i] == null ? "" : raw[i]).trim().toLowerCase();
          break;
        }
      }

      return (
        nickname === "никнейм" ||
        nickname === "nickname" ||
        nickname === "nick" ||
        (nickname === "ник" && position === "должность")
      );
    }

    function isStatsSectionRow(item) {
      var nickname = itemNickname(item);

      if (!nickname || nickname.length < 3 || isStatsColumnHeader(item)) {
        return false;
      }

      var values = item && item.values ? item.values : {};
      var headers = Array.isArray(values.headers) ? values.headers : [];
      var raw = Array.isArray(values.raw_row) ? values.raw_row : [];
      var nicknameIndex = -1;

      for (var i = 0; i < headers.length; i += 1) {
        if (isGoogleNicknameHeader(headers[i])) {
          nicknameIndex = i;
          break;
        }
      }

      var hasOtherData = false;

      for (var j = 0; j < raw.length; j += 1) {
        if (j === nicknameIndex) continue;
        if (String(raw[j] == null ? "" : raw[j]).trim() !== "") {
          hasOtherData = true;
          break;
        }
      }

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
        lastMarks = Array.isArray(normativesResult.marks) ? normativesResult.marks : [];

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

    var STATS_DISPLAY_COLUMNS = [
      ["nickname", "Никнейм"],
      ["age", "Возраст"],
      ["pc_access", "Доступ с ПК"],
      ["position", "Должность"],
      ["inactives", "Неактивы"],
      ["activity_points", "Баллы активности"],
      ["post_days", "Дни на посту"],
      ["strikes", "Страйки"],
      ["warnings", "Предупреждения"],
      ["points", "Баллы"],
      ["last_promotion", "Последнее повышение"]
    ];

    function normalizeStatsPosition(value) {
      return String(value == null ? "" : value)
        .trim()
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[.]+/g, " ")
        .replace(/[_\-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function statsPositionTitle(item) {
      var value = String(statDisplayValue(item, "position") || "").trim();
      return value === "—" ? "" : value;
    }

    function statsPositionScore(value) {
      var position = normalizeStatsPosition(value);
      if (!position) return 0;

      var compact = position.replace(/[^a-zа-я0-9]/gi, "");

      // Чем выше число, тем выше должность. Неизвестные должности получают 0.
      if (position.indexOf("руковод") !== -1) return 1000;
      if (position.indexOf("куратор") !== -1) return 980;
      if (position.indexOf("главн") !== -1 && (position.indexOf("админ") !== -1 || compact.indexOf("admin") !== -1)) return 960;

      var seniorController = position.indexOf("старш") !== -1 && (position.indexOf("следящ") !== -1 || position.indexOf("сидящ") !== -1);
      var controller = position.indexOf("следящ") !== -1 || position.indexOf("сидящ") !== -1;
      if (seniorController) return 940;
      if (controller) return 900;

      var seniorAdmin = position.indexOf("старш") !== -1 && position.indexOf("админ") !== -1;
      if (seniorAdmin || (compact.indexOf("стадмин") === 0)) return 850;
      if (position.indexOf("админ") !== -1 || compact.indexOf("admin") !== -1) return 800;

      var juniorModerator =
        position.indexOf("младш") !== -1 ||
        compact.indexOf("млмодер") !== -1 ||
        compact.indexOf("млмод") !== -1;

      var seniorModerator =
        position.indexOf("старш") !== -1 && position.indexOf("модер") !== -1 ||
        compact.indexOf("стмодер") !== -1 ||
        compact.indexOf("стмод") !== -1;

      if (seniorModerator) return 700;
      if (position.indexOf("модер") !== -1 && !juniorModerator) return 600;
      if (juniorModerator) return 500;

      return 0;
    }

    function statsPositionMeta(item) {
      var title = statsPositionTitle(item) || "Без должности";
      var key = normalizeStatsPosition(title);
      return {
        key: key || "__empty__",
        title: title,
        score: statsPositionScore(title)
      };
    }

    function statsName(item) {
      return itemNickname(item).trim();
    }

    function compareStatsText(a, b) {
      return String(a || "").localeCompare(
        String(b || ""),
        "ru",
        {sensitivity:"base", numeric:true}
      );
    }

    function sortStatsItems(items) {
      return items.map(function (item, originalIndex) {
        return {
          item: item,
          meta: statsPositionMeta(item),
          originalIndex: originalIndex
        };
      }).sort(function (a, b) {
        var result = 0;

        if (statsSortMode === "alphabet") {
          result = compareStatsText(statsName(a.item), statsName(b.item));
        } else if (statsSortMode === "position") {
          result = compareStatsText(a.meta.title, b.meta.title);
          if (result === 0) result = compareStatsText(statsName(a.item), statsName(b.item));
        } else {
          result = b.meta.score - a.meta.score;
          if (result === 0) result = compareStatsText(a.meta.title, b.meta.title);
          if (result === 0) result = compareStatsText(statsName(a.item), statsName(b.item));
        }

        return result === 0 ? a.originalIndex - b.originalIndex : result;
      });
    }

    function statsSortLabel() {
      return {
        seniority: "По старшинству",
        alphabet: "По алфавиту",
        position: "По должности"
      }[statsSortMode] || "По старшинству";
    }

    function statDisplayValue(item, key) {
      if (key === "nickname") return itemNickname(item) || "—";
      if (key === "normative") {
        var nickname = itemNickname(item);
        var map = normMap();
        return normativeStatus((map[nickname.toLowerCase()] || {}).status || "not_submitted");
      }

      var value = valueOf(item, key);

      if (key === "post_days" && (value == null || value === "")) {
        var values = item && item.values ? item.values : {};
        var headers = Array.isArray(values.headers) ? values.headers : [];
        var raw = Array.isArray(values.raw_row) ? values.raw_row : [];
        for (var i = 0; i < headers.length; i += 1) {
          if (normalizeHeaderKey(headers[i]) === "post_days") {
            value = raw[i];
            break;
          }
        }
      }

      return formatStatisticsCellValue(key, value);
    }

    function statsPositionGroup(item) {
      var position = String(statDisplayValue(item, "position") || "")
        .trim().toLowerCase().replace(/ё/g, "е").replace(/[.]/g, "").replace(/\s+/g, " ");

      if (!position) return { index: STATS_POSITION_GROUPS.length, key:"other", title:"Другие" };

      for (var i = 0; i < STATS_POSITION_GROUPS.length; i += 1) {
        var group = STATS_POSITION_GROUPS[i];
        for (var j = 0; j < group.match.length; j += 1) {
          var candidate = group.match[j].toLowerCase().replace(/ё/g, "е").replace(/[.]/g, "").replace(/\s+/g, " ").trim();
          if (position === candidate || position.indexOf(candidate) !== -1) {
            return { index:i, key:group.key, title:group.title };
          }
        }
      }

      if (position.indexOf("младш") !== -1 && position.indexOf("модер") !== -1) return { index:0, key:"junior_moderators", title:"Младшие модераторы" };
      if (position.indexOf("старш") !== -1 && position.indexOf("модер") !== -1) return { index:2, key:"senior_moderators", title:"Старшие модераторы" };
      if (position.indexOf("модер") !== -1) return { index:1, key:"moderators", title:"Модераторы" };
      if (position.indexOf("старш") !== -1 && position.indexOf("админ") !== -1) return { index:4, key:"senior_administrators", title:"Старшие администраторы" };
      if (position.indexOf("админ") !== -1) return { index:3, key:"administrators", title:"Администраторы" };
      if (position.indexOf("руковод") !== -1 || position.indexOf("следящ") !== -1 || position.indexOf("куратор") !== -1) return { index:5, key:"management", title:"Руководство" };

      return { index:STATS_POSITION_GROUPS.length, key:"other", title:"Другие" };
    }

    function sortStatsItemsByPosition(items) {
      return items.map(function (item, originalIndex) {
        return { item:item, group:statsPositionGroup(item), originalIndex:originalIndex };
      }).sort(function (a, b) {
        return a.group.index !== b.group.index
          ? a.group.index - b.group.index
          : a.originalIndex - b.originalIndex;
      });
    }

    function renderTable(user) {
      var root = document.getElementById("allStatsRoot");
      if (!root) return;

      var sortedItems = sortStatsItems(
        lastData.filter(function (item) {
          var nickname = itemNickname(item);
          return nickname && !isStatsColumnHeader(item);
        })
      );

      var columnCount = STATS_DISPLAY_COLUMNS.length + 2;
      var groupedRows = [];
      var previousGroupKey = null;
      var norms = normMap();

      sortedItems.forEach(function (entry) {
        var item = entry.item;
        var group = entry.group;
        var nickname = itemNickname(item);

        if (statsSortMode !== "alphabet" && entry.meta.key !== previousGroupKey) {
          groupedRows.push(
            '<tr class="stats-section-row">' +
              '<td colspan="' + columnCount + '">' +
                '<b>' + E(entry.meta.title) + '</b>' +
              '</td>' +
            '</tr>'
          );
          previousGroupKey = entry.meta.key;
        }

        var norm = norms[nickname.toLowerCase()] || {};
        var status = norm.status || "not_submitted";

        var cells = STATS_DISPLAY_COLUMNS.map(function (column) {
          var key = column[0];
          var label = column[1];
          var value = statDisplayValue(item, key);
          var className = key === "nickname" ? "stats-nickname-sticky" : "";

          return '<td class="' + className + '" data-stat-field="' + E(key) + '" data-stat-label="' + E(label) + '">' +
            (key === "nickname" ? '<b>' + E(value) + '</b>' : E(value)) +
          '</td>';
        }).join("");

        groupedRows.push(
          '<tr>' +
            cells +
            '<td class="stats-norm-cell"><span>' + normativeStatus(status) + '</span>' +
              '<div class="stats-norm-actions">' +
                '<button class="normative-icon-button normative-mark-norm" data-stat-norm="norm" data-nickname="' + E(nickname) + '" title="Норма" aria-label="Норма">✓</button>' +
                '<button class="normative-icon-button normative-mark-rework" data-stat-norm="rework" data-nickname="' + E(nickname) + '" title="Перенорма" aria-label="Перенорма">↻</button>' +
                '<button class="normative-icon-button normative-mark-no-norm" data-stat-norm="no_norm" data-nickname="' + E(nickname) + '" title="Нет нормы" aria-label="Нет нормы">✕</button>' +
                '<button class="normative-icon-button normative-mark-inactive" data-stat-norm="inactive" data-nickname="' + E(nickname) + '" title="Неактив" aria-label="Неактив">—</button>' +
              '</div>' +
            '</td>' +
            '<td class="admin-actions-cell"><button class="admin-edit-inline" type="button" data-edit-admin="' + E(nickname) + '">Изменить</button></td>' +
          '</tr>'
        );
      });

      var rows = groupedRows.join("");

      if (!rows) {
        rows = '<tr><td colspan="' + columnCount + '" class="table-empty">Данных администрации нет.</td></tr>';
      }

      var headerCells = STATS_DISPLAY_COLUMNS.map(function (column) {
        var key = column[0];
        var label = column[1];
        var classes = key === "nickname" ? "stats-nickname-sticky" : "";
        return '<th class="' + classes + '">' + E(label) + '</th>';
      }).join("");

      root.innerHTML =
        '<div class="box table-box">' +
          '<div class="stats-table-head"><div>' +
            '<small>ПОЛНАЯ СТАТИСТИКА АДМИНИСТРАЦИИ</small>' +
            '<b>' + E(String(sortedItems.length)) + ' сотрудников</b>' +
          '</div><span class="muted">Дата норматива: ' + E(formatDateOnly(selectedDate)) + '</span></div>' +
          '<div class="admins-source-row"><span>Сортировка: ' + E(statsSortLabel()) + ' • должности берутся из Google Таблицы</span><span>Источник: Google Таблица</span></div>' +
          '<table id="allStatsTable"><thead><tr>' +
            headerCells +
            '<th>Норматив</th><th>Действия</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table>' +
        '</div><div id="adminEditModal"></div>';

      document.querySelectorAll("#allStatsTable tbody tr").forEach(function (row) {
        row.addEventListener("click", function (event) {
          if (event.target.closest("button, a, input, select, textarea")) return;
          document.querySelectorAll("#allStatsTable tbody tr.stats-row-selected").forEach(function (selected) {
            selected.classList.remove("stats-row-selected");
          });
          if (!row.classList.contains("stats-section-row")) {
            row.classList.add("stats-row-selected");
          }
        });
      });

      document.querySelectorAll("[data-stat-norm]").forEach(function (button) {
        button.onclick = async function () {
          var nickname = button.dataset.nickname || "";
          var status = button.dataset.statNorm || "";
          var label = STATUS_LABELS[status] || status;
          if (!confirm("Выставить «" + label + "» для " + nickname + " за " + formatDateOnly(selectedDate) + "?")) return;
          button.disabled = true;
          try {
            var result = await window.BR_API.normativeMark(user.token, nickname, selectedDate, status, "");
            var google = result && result.google_sheet ? result.google_sheet : {};
            var cellText = google.cell ? " • ячейка " + google.cell : "";
            var postDaysText = google.post_days_updated ? " • Дни на посте: " + String(google.post_days_value) : "";
            showNormativeResult(
              "✅ " + label + " проставлена для " + nickname + " за " + formatDateOnly(selectedDate) + cellText + postDaysText,
              "success"
            );
            await load(user);
          } catch (error) {
            showNormativeResult(normativeErrorMessage(error), "error");
            button.disabled = false;
          }
        };
      });

      document.querySelectorAll("[data-edit-admin]").forEach(function (button) {
        button.onclick = function (event) {
          event.preventDefault();
          event.stopPropagation();

          var nickname = button.dataset.editAdmin || "";
          if (!nickname) return;

          closeMenus();

          var item = lastData.find(function (entry) {
            return itemNickname(entry).trim().toLowerCase() === nickname.trim().toLowerCase();
          });

          if (!item) {
            alert("Не удалось определить выбранного администратора в загруженной таблице.");
            return;
          }

          openEditModal(user, item);
        };
      });
    }

    function closeMenus() {
      document.querySelectorAll(".admin-row-menu.open").forEach(function (menu) {
        menu.classList.remove("open");
        menu.style.left = "";
        menu.style.top = "";
      });
    }

    function openEditModal(user, item) {
      var root = document.getElementById("adminEditModal");
      if (!root) return;

      var nickname = itemNickname(item).trim();

      if (!nickname) {
        alert("Не удалось определить выбранного администратора.");
        return;
      }

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
              '<div class="admin-edit-title"><small>РЕДАКТИРОВАНИЕ АДМИНИСТРАТОРА</small><h2>' + E(nickname || "Администратор") + '</h2><span>Данные из Google Sheets</span></div>' +
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
            '<label class="stats-sort-wrap"><span class="stats-sort-label">Сортировка</span><select id="statsSortMode" class="form-select stats-sort-select"><option value="seniority">По старшинству</option><option value="alphabet">По алфавиту</option><option value="position">По должности</option></select></label>' +
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
        var sort = document.getElementById("statsSortMode");
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
        if (sort) {
          sort.value = statsSortMode;
          sort.onchange = function () {
            statsSortMode = sort.value || "seniority";
            renderTable(user);
          };
        }
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

  function formatDateNumeric(value) {
    if (!value) return "—";
    var date = new Date(String(value) + "T00:00:00");
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("ru-RU", {
      day:"2-digit",
      month:"2-digit",
      year:"numeric"
    });
  }

  function formatDateOnly(value) {
    if (!value) return "—";
    var date = new Date(String(value) + "T00:00:00");
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("ru-RU", {
      weekday:"long",
      day:"2-digit",
      month:"2-digit",
      year:"numeric"
    });
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
                var reviewed = !!item.reviewed_at;
                var statusCell = reviewed
                  ? '<div class="normative-result-stack"><span class="badge badge-green">Проверено</span>' + normativeStatus(item.status) + '</div>'
                  : normativeStatus(item.status);

                return '<tr>' +
                  '<td>#' + E(item.id == null ? "—" : item.id) + '</td>' +
                  '<td>' + statusCell + '</td>' +
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

              var weekday = new Date(date + "T00:00:00").toLocaleDateString("ru-RU", {weekday:"long"});
              var mobileItems = groups[date].map(function (item) {
                var reviewed = !!item.reviewed_at;
                var status = normativeStatus(item.status);
                return '<article class="normative-mobile-card">' +
                  '<div class="normative-mobile-top">' +
                    '<span class="normative-mobile-index">#' + E(item.id == null ? "—" : item.id) + '</span>' +
                    '<span>' + (reviewed ? '<span class="badge badge-green">Проверено</span> ' : '') + status + '</span>' +
                  '</div>' +
                  '<div class="normative-mobile-meta">' +
                    '<div><small>Файлы</small><b>' + E(item.file_count || 0) + '</b></div>' +
                    '<div><small>Отправлен</small><b>' + E(formatDateTime(item.created_at)) + '</b></div>' +
                  '</div>' +
                  '<div class="normative-mobile-comment"><small>Решение</small><p>' + E(item.review_comment || "—") + '</p></div>' +
                  (item.id ? '<button class="button button-secondary normative-mobile-open" data-own-norm="' + E(item.id) + '">Открыть</button>' : '') +
                '</article>';
              }).join("");

              return '<section class="date-section"><div class="date-section-head"><div><h2>' + E(formatDateNumeric(date)) + '</h2><span>' + E(weekday) + '</span></div><span class="date-section-count">' + E(String(groups[date].length)) + ' ' + (groups[date].length === 1 ? 'норматив' : 'нормативов') + '</span></div>' +
                '<div class="box table-box normative-table-desktop"><table><thead><tr><th>№</th><th>Статус</th><th>Файлы</th><th>Отправлен</th><th>Решение</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
                '<div class="mobile-data-list normative-mobile-list">' + mobileItems + '</div></section>';
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
      return window.BR_API.normativesDailyLocal(user.token, selectedDate).then(function (result) {
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

        var currentStatus = s && s.status ? s.status : (result.status || "pending");
        var controls = options.management
          ? '<div class="review-panel">' +
              '<div class="review-current">Текущий результат: ' + normativeStatus(currentStatus) + '</div>' +
              '<textarea id="reviewComment" class="form-textarea" placeholder="Комментарий проверки"></textarea>' +
              '<div class="review-actions">' +
                '<button class="button button-secondary" data-review="rework">Перенорма</button>' +
                '<button class="button button-primary" data-review="norm">Норма</button>' +
                '<button class="button button-danger" data-review="no_norm">Нет нормы</button>' +
                '<button class="button button-secondary" data-review="inactive">Неактив</button>' +
              '</div>' +
            '</div>'
          : '<div class="notice">Результат проверки: ' + normativeStatus(currentStatus) + (s && s.reviewed_at ? '<br><small>Проверено: ' + E(formatDateTime(s.reviewed_at)) + '</small>' : '') + '</div>';

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
                var reviewResult = await window.BR_API.normativeReview(
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

  function settings(user) {
    var lastSettings = {
      theme: user.theme || "dark",
      web_app_url: "",
      googleUrlEditing: false,
      googleUrlLoaded: false
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
              '<div class="settings-card-head"><div><small>GOOGLE ТАБЛИЦА</small><h2>Web app URL</h2></div><span>Адрес активного веб-развёртывания Google Таблица</span></div>' +
              '<form id="googleUrlSettingsForm">' +
                '<div class="form-field"><label>URL Web app</label><input id="googleWebAppUrl" class="form-input settings-google-url-locked" type="url" placeholder="https://script.google.com/macros/s/.../exec" autocomplete="off" value="' + E(lastSettings.web_app_url || "") + '" disabled></div>' +
                '<p class="settings-hint">Сохранённый URL отображается только для просмотра. Нажмите «Заменить URL», чтобы разблокировать поле. После изменения нажмите «Сохранить».</p>' +
                '<div class="form-actions settings-google-actions">' +
                  '<button class="button button-primary" id="googleUrlSettingsSave" type="submit" disabled>Сохранить</button>' +
                  '<button class="button button-secondary" id="googleUrlSettingsReplace" type="button" disabled>Заменить URL</button>' +
                '</div>' +
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

    function setGoogleUrlView(editing) {
      var googleUrlInput = document.getElementById("googleWebAppUrl");
      var saveButton = document.getElementById("googleUrlSettingsSave");
      var replaceButton = document.getElementById("googleUrlSettingsReplace");

      lastSettings.googleUrlEditing = !!editing;

      if (!googleUrlInput || !saveButton || !replaceButton) return;

      if (!lastSettings.googleUrlLoaded) {
        googleUrlInput.disabled = true;
        googleUrlInput.classList.add("settings-google-url-locked");
        saveButton.disabled = true;
        replaceButton.disabled = true;
        saveButton.textContent = "Сохранить";
        replaceButton.textContent = "Заменить URL";
        return;
      }

      var hasSavedUrl = !!String(lastSettings.web_app_url || "").trim();

      if (lastSettings.googleUrlEditing) {
        googleUrlInput.disabled = false;
        googleUrlInput.classList.remove("settings-google-url-locked");

        saveButton.disabled = false;
        replaceButton.disabled = true;

        saveButton.textContent = "Сохранить";
        replaceButton.textContent = "Заменить URL";
      } else {
        googleUrlInput.disabled = true;
        googleUrlInput.classList.toggle("settings-google-url-locked", hasSavedUrl);

        saveButton.disabled = true;
        replaceButton.disabled = false;

        saveButton.textContent = "Сохранить";
        replaceButton.textContent = "Заменить URL";
      }
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
          var googleUrlInput = document.getElementById("googleWebAppUrl");
          var saveButton = document.getElementById("googleUrlSettingsSave");
          var replaceButton = document.getElementById("googleUrlSettingsReplace");

          replaceButton.onclick = function () {
            if (!lastSettings.googleUrlLoaded) return;

            setGoogleUrlView(true);
            googleUrlInput.focus();
            googleUrlInput.select();
          };

          googleForm.onsubmit = async function (event) {
            event.preventDefault();

            if (!lastSettings.googleUrlEditing) return;

            var value = googleUrlInput.value.trim();

            if (!value) {
              showStatus("Укажите URL Web App.", false);
              googleUrlInput.focus();
              return;
            }

            saveButton.disabled = true;
            replaceButton.disabled = true;
            saveButton.textContent = "Сохранение…";

            try {
              var result = await window.BR_API.settingsUpdate(user.token, {
                web_app_url: value
              });

              var saved = result && result.settings
                ? result.settings.web_app_url
                : value;

              googleUrlInput.value = saved || "";
              lastSettings.web_app_url = saved || "";

              showStatus(
                "URL Google Таблица сохранён в Supabase.",
                true
              );

              setGoogleUrlView(false);
            } catch (error) {
              showStatus(
                error.message || "Не удалось сохранить URL.",
                false
              );

              setGoogleUrlView(true);
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
              var savedWebAppUrl = settingsData.web_app_url || "";
              urlInput.value = savedWebAppUrl;
              lastSettings.web_app_url = savedWebAppUrl;
              lastSettings.googleUrlLoaded = true;
              lastSettings.googleUrlEditing = false;
              setGoogleUrlView(false);
            }
          }
        } catch (error) {
          if (user.role === "management") {
            lastSettings.googleUrlLoaded = true;
            lastSettings.web_app_url = "";
            lastSettings.googleUrlEditing = true;
            var failedUrlInput = document.getElementById("googleWebAppUrl");
            if (failedUrlInput) failedUrlInput.value = "";
            setGoogleUrlView(true);
          }
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

  function access(user) {
    var state = {
      candidates: [],
      accounts: []
    };

    function roleLabel(role) {
      return role === "management"
        ? "Руководство"
        : "Администратор";
    }

    function statusLabel(item) {
      if (item.blocked_at) {
        return '<span class="badge badge-red">Заблокирован</span>';
      }

      if (item.is_active) {
        return '<span class="badge badge-green">Активен</span>';
      }

      return '<span class="badge">Доступ удалён</span>';
    }

    function bindingLabel(item) {
      return item.device_bound
        ? '<span class="badge badge-blue">Привязано</span>'
        : '<span class="badge">Нет привязки</span>';
    }

    function generatePassword() {
      var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
      var length = 10;
      var bytes = new Uint8Array(length);

      if (window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(bytes);
      } else {
        for (var i = 0; i < length; i += 1) {
          bytes[i] = Math.floor(Math.random() * alphabet.length);
        }
      }

      var result = "";
      for (var j = 0; j < bytes.length; j += 1) {
        result += alphabet[bytes[j] % alphabet.length];
      }

      return result;
    }

    function setPassword(inputId) {
      var input = document.getElementById(inputId);
      if (!input) return;
      input.value = generatePassword();
      input.type = "text";
      input.focus();
      input.select();
    }

    function renderCredentials(result, targetId) {
      var root = document.getElementById(targetId);
      if (!root) return;

      var granted = Array.isArray(result && result.granted)
        ? result.granted
        : [];

      if (!granted.length) {
        root.hidden = true;
        root.innerHTML = "";
        return;
      }

      var password = granted[0].password || "—";

      var rows = granted.map(function (item) {
        return '<div class="access-credential-row">' +
          '<b>' + E(item.nickname) + '</b>' +
          '<span>' + E(roleLabel(item.role)) + '</span>' +
        '</div>';
      }).join("");

      root.hidden = false;
      root.innerHTML =
        '<div class="access-credentials-head">' +
          '<div><small>ДАННЫЕ ДОСТУПА</small><b>Доступ выдан</b></div>' +
          '<button class="small-button" id="' + targetId + 'Copy" type="button">Копировать</button>' +
        '</div>' +
        '<div class="access-password-result"><span>Пароль</span><code>' + E(password) + '</code></div>' +
        '<div class="access-credential-list">' + rows + '</div>' +
        '<p class="settings-hint">Пароль показывается здесь один раз. В базе хранится только его хэш.</p>';

      var copy = document.getElementById(targetId + "Copy");
      if (copy) {
        copy.onclick = async function () {
          var text = granted.map(function (item) {
            return item.nickname + ": " + item.password;
          }).join("\n");

          try {
            await navigator.clipboard.writeText(text);
            copy.textContent = "Скопировано";
          } catch (_) {
            copy.textContent = "Не удалось скопировать";
          }

          window.setTimeout(function () {
            copy.textContent = "Копировать";
          }, 1800);
        };
      }
    }

    async function loadAccounts(root) {
      if (!root) return;

      root.innerHTML =
        '<div class="box"><div class="empty">Загрузка выданных доступов...</div></div>';

      try {
        var result = await window.BR_API.accessList(user.token);

        state.accounts =
          Array.isArray(result.administrators)
            ? result.administrators
            : [];

        if (!state.accounts.length) {
          root.innerHTML =
            '<div class="box"><div class="empty">Выданных доступов пока нет.</div></div>';
          return;
        }

        var rows = state.accounts.map(function (item) {
          return '<tr>' +
            '<td><b>' + E(item.nickname || "—") + '</b><small class="table-secondary">' + E(item.login || "") + '</small></td>' +
            '<td>' + E(roleLabel(item.role)) + '</td>' +
            '<td>' + E(item.position || "—") + '</td>' +
            '<td>' + statusLabel(item) + '</td>' +
            '<td>' + bindingLabel(item) + '</td>' +
            '<td>' + E(item.last_login_ip || "—") + '</td>' +
            '<td>' + E(item.last_login_at ? formatDateTime(item.last_login_at) : "—") + '</td>' +
            '<td>' + E(String(item.active_sessions || 0)) + '</td>' +
            '<td class="access-actions-cell">' +
              '<div class="admin-menu-wrap access-menu-wrap">' +
                '<button class="admin-menu-trigger" type="button" data-access-menu="' + E(item.id) + '" title="Действия" aria-label="Действия">⋮</button>' +
                '<div class="admin-row-menu access-row-menu" data-access-row-menu="' + E(item.id) + '">' +
                  '<button type="button" data-access-action="details" data-admin-id="' + E(item.id) + '">Подробнее / изменить</button>' +
                  (item.device_bound ? '<button type="button" data-access-action="unbind" data-admin-id="' + E(item.id) + '">Сбросить привязку</button>' : '') +
                  (item.blocked_at
                    ? '<button type="button" data-access-action="unblock" data-admin-id="' + E(item.id) + '">Разблокировать</button>'
                    : '<button type="button" data-access-action="block" data-admin-id="' + E(item.id) + '">Заблокировать</button>') +
                  '<button type="button" data-access-action="remove" data-admin-id="' + E(item.id) + '" class="menu-danger">Удалить доступ</button>' +
                '</div>' +
              '</div>' +
            '</td>' +
          '</tr>';
        }).join("");

        root.innerHTML =
          '<div class="box table-box access-registry">' +
            '<div class="stats-table-head access-registry-head">' +
              '<div><small>РЕЕСТР ДОСТУПОВ</small><b>' + E(String(state.accounts.length)) + ' аккаунтов</b></div>' +
              '<span class="muted">IP и время берутся с сервера при входе</span>' +
            '</div>' +
            '<div class="admins-source-row"><span>Текущие доступы из Supabase</span><span>Привязка устройства • сессии</span></div>' +
            '<table id="accessRegistryTable"><thead><tr>' +
              '<th>Никнейм</th><th>Роль</th><th>Должность</th><th>Статус</th><th>Привязка</th><th>IP</th><th>Последний вход</th><th>Сессии</th><th>Действия</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table>' +
          '</div>';

        bindAccessMenus();
      } catch (error) {
        root.innerHTML =
          '<div class="box"><div class="empty">' +
          E(error.message || "Не удалось загрузить реестр доступов.") +
          '</div></div>';
      }
    }

    function positionMenu(button, menu) {
      var rect = button.getBoundingClientRect();
      var width = Math.max(menu.offsetWidth || 190, 190);
      var height = Math.max(menu.offsetHeight || 48, 48);
      var margin = 10;

      var left = rect.right - width;
      var top = rect.bottom + 6;

      if (left < margin) left = margin;
      if (left + width > window.innerWidth - margin) {
        left = window.innerWidth - width - margin;
      }

      if (top + height > window.innerHeight - margin) {
        top = rect.top - height - 6;
      }

      if (top < margin) top = margin;

      menu.style.left = Math.round(left) + "px";
      menu.style.top = Math.round(top) + "px";
    }

    function closeMenus() {
      document.querySelectorAll(".access-row-menu.open").forEach(function (menu) {
        menu.classList.remove("open");
        menu.style.left = "";
        menu.style.top = "";
      });
    }

    function bindAccessMenus() {
      document.querySelectorAll("[data-access-menu]").forEach(function (button) {
        button.onclick = function (event) {
          event.preventDefault();
          event.stopPropagation();

          var id = button.dataset.accessMenu || "";
          var menu = document.querySelector(
            '[data-access-row-menu="' + CSS.escape(id) + '"]'
          );

          if (!menu) return;

          var wasOpen = menu.classList.contains("open");
          closeMenus();

          if (!wasOpen) {
            menu.classList.add("open");
            positionMenu(button, menu);
          }
        };
      });

      document.querySelectorAll("[data-access-action]").forEach(function (button) {
        button.onclick = async function (event) {
          event.preventDefault();
          event.stopPropagation();

          var id = Number(button.dataset.adminId || 0);
          var action = button.dataset.accessAction || "";
          var item = state.accounts.find(function (entry) {
            return Number(entry.id) === id;
          });

          closeMenus();

          if (!item) return;

          if (action === "details") {
            openAccessEdit(item);
            return;
          }

          var messages = {
            unbind: "Сбросить привязку устройства у " + item.nickname + "?",
            block: "Заблокировать " + item.nickname + "?",
            unblock: "Разблокировать " + item.nickname + "?",
            remove: "Удалить доступ у " + item.nickname + "?"
          };

          if (!confirm(messages[action] || "Выполнить действие?")) {
            return;
          }

          button.disabled = true;

          try {
            var result = await window.BR_API.accessManage(
              user.token,
              {
                admin_id: id,
                operation: action
              }
            );

            showAccessStatus(
              result.message || "Изменения сохранены.",
              true
            );

            await loadAccounts(
              document.getElementById("accessRegistryRoot")
            );
          } catch (error) {
            showAccessStatus(
              error.message || "Не удалось выполнить действие.",
              false
            );
            button.disabled = false;
          }
        };
      });
    }

    function showAccessStatus(message, ok) {
      var root = document.getElementById("accessPageStatus");
      if (!root) return;

      root.hidden = false;
      root.className =
        "settings-status " +
        (ok ? "settings-status-ok" : "settings-status-error");
      root.textContent = message;

      window.setTimeout(function () {
        root.hidden = true;
      }, 4500);
    }

    function openAccessEdit(item) {
      var root = document.getElementById("accessModalRoot");
      if (!root) return;

      root.innerHTML =
        '<div class="modal-backdrop" id="accessEditBackdrop">' +
          '<div class="modal-card access-edit-card">' +
            '<div class="modal-head">' +
              '<div class="admin-edit-title"><small>УПРАВЛЕНИЕ ДОСТУПОМ</small><h2>' + E(item.nickname) + '</h2><span>Серверные данные аккаунта</span></div>' +
              '<button class="modal-close" id="accessEditClose" type="button">×</button>' +
            '</div>' +
            '<div class="access-details-grid">' +
              '<div><small>IP</small><b>' + E(item.last_login_ip || "—") + '</b></div>' +
              '<div><small>ПОСЛЕДНИЙ ВХОД</small><b>' + E(item.last_login_at ? formatDateTime(item.last_login_at) : "—") + '</b></div>' +
              '<div><small>ПРИВЯЗКА</small><b>' + (item.device_bound ? "Привязано" : "Не привязано") + '</b></div>' +
              '<div><small>АКТИВНЫЕ СЕССИИ</small><b>' + E(item.active_sessions || 0) + '</b></div>' +
            '</div>' +
            '<form id="accessEditForm">' +
              '<div class="form-grid">' +
                '<div class="form-field"><label>Роль</label><select id="accessEditRole" class="form-select"><option value="admin"' + (item.role === "admin" ? " selected" : "") + '>Администратор</option><option value="management"' + (item.role === "management" ? " selected" : "") + '>Руководство</option></select></div>' +
                '<div class="form-field"><label>Должность</label>' + positionSelect("accessEditPosition", "position", item.position || "") + '</div>' +
                '<div class="form-field form-full"><label>Новый пароль <span class="muted">необязательно</span></label><div class="access-password-field"><input id="accessEditPassword" class="form-input" type="text" autocomplete="new-password" placeholder="Оставьте пустым, чтобы не менять"><button id="accessEditGenerate" class="small-button" type="button">Сгенерировать</button></div></div>' +
              '</div>' +
              '<div class="form-actions admin-edit-actions">' +
                '<button class="button button-secondary" id="accessEditCancel" type="button">Отмена</button>' +
                '<button class="button button-primary" type="submit">Сохранить</button>' +
              '</div>' +
            '</form>' +
          '</div>' +
        '</div>';

      document.getElementById("accessEditClose").onclick = function () {
        root.innerHTML = "";
      };
      document.getElementById("accessEditCancel").onclick = function () {
        root.innerHTML = "";
      };
      document.getElementById("accessEditGenerate").onclick = function () {
        setPassword("accessEditPassword");
      };

      document.getElementById("accessEditForm").onsubmit = async function (event) {
        event.preventDefault();

        var saveButton = this.querySelector('button[type="submit"]');
        if (saveButton) {
          saveButton.disabled = true;
          saveButton.textContent = "Сохранение…";
        }

        try {
          var newPassword = document.getElementById("accessEditPassword").value.trim();

          await window.BR_API.accessManage(
            user.token,
            {
              admin_id: Number(item.id),
              operation: "update",
              role: document.getElementById("accessEditRole").value,
              position: document.getElementById("accessEditPosition").value,
              password: newPassword
            }
          );

          root.innerHTML = "";
          showAccessStatus("Данные доступа " + item.nickname + " изменены.", true);
          await loadAccounts(document.getElementById("accessRegistryRoot"));
        } catch (error) {
          showAccessStatus(
            error.message || "Не удалось изменить доступ.",
            false
          );

          if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = "Сохранить";
          }
        }
      };
    }

    function bindManualForm() {
      var form = document.getElementById("accessManualForm");
      if (!form) return;

      document.getElementById("accessManualGenerate").onclick = function () {
        setPassword("accessManualPassword");
      };

      form.onsubmit = async function (event) {
        event.preventDefault();

        var nickname = document.getElementById("accessManualNickname").value.trim();
        var password = document.getElementById("accessManualPassword").value.trim();

        if (!nickname) return;

        if (!password) {
          password = generatePassword();
          document.getElementById("accessManualPassword").value = password;
          document.getElementById("accessManualPassword").type = "text";
        }

        var button = form.querySelector('button[type="submit"]');
        if (button) {
          button.disabled = true;
          button.textContent = "Выдача…";
        }

        try {
          var result = await window.BR_API.accessGrant(
            user.token,
            {
              nickname: nickname,
              password: password,
              role: document.getElementById("accessManualRole").value,
              position: document.getElementById("accessManualPosition").value
            }
          );

          renderCredentials(result, "manualCredentials");
          form.reset();

          showAccessStatus(
            "Доступ выдан для " + nickname + ".",
            true
          );

          await loadAccounts(
            document.getElementById("accessRegistryRoot")
          );
        } catch (error) {
          showAccessStatus(
            error.message || "Не удалось выдать доступ.",
            false
          );
        } finally {
          if (button) {
            button.disabled = false;
            button.textContent = "Выдать доступ";
          }
        }
      };
    }

    async function loadCandidates() {
      var root = document.getElementById("accessCandidatesRoot");
      if (!root) return;

      root.hidden = false;
      root.innerHTML =
        '<div class="access-candidates-loading">Загрузка списка администраторов…</div>';

      try {
        var result =
          await window.BR_API.accessCandidates(
            user.token
          );

        state.candidates =
          Array.isArray(result.candidates)
            ? result.candidates
            : [];

        if (!state.candidates.length) {
          root.innerHTML =
            '<div class="access-candidates-empty">Все администраторы из Google Sheets уже имеют доступ или находятся в заблокированных.</div>';
          return;
        }

        root.innerHTML =
          '<div class="access-select-toolbar">' +
            '<label class="access-select-all"><input id="accessSelectAll" type="checkbox"> <span>Выбрать всех</span></label>' +
            '<span id="accessSelectedCount">0 выбрано</span>' +
          '</div>' +
          '<div class="access-candidate-grid">' +
            state.candidates.map(function (nickname, index) {
              return '<label class="access-candidate">' +
                '<input type="checkbox" data-candidate-index="' + index + '">' +
                '<span class="access-candidate-box"></span>' +
                '<b>' + E(nickname) + '</b>' +
              '</label>';
            }).join("") +
          '</div>';

        var count = document.getElementById("accessSelectedCount");
        var all = document.getElementById("accessSelectAll");

        function updateSelected() {
          var selected =
            Array.from(
              document.querySelectorAll("[data-candidate-index]:checked")
            );

          if (count) {
            count.textContent = selected.length + " выбрано";
          }
        }

        document.querySelectorAll("[data-candidate-index]").forEach(function (input) {
          input.onchange = updateSelected;
        });

        if (all) {
          all.onchange = function () {
            document.querySelectorAll("[data-candidate-index]").forEach(function (input) {
              input.checked = all.checked;
            });
            updateSelected();
          };
        }

      } catch (error) {
        root.innerHTML =
          '<div class="access-candidates-empty">' +
          E(error.message || "Не удалось загрузить список администраторов.") +
          '</div>';
      }
    }

    function bindBulkForm() {
      var form = document.getElementById("accessBulkForm");
      if (!form) return;

      document.getElementById("accessBulkGenerate").onclick = function () {
        setPassword("accessBulkPassword");
      };

      form.onsubmit = async function (event) {
        event.preventDefault();

        var selected = Array.from(
          document.querySelectorAll("[data-candidate-index]:checked")
        ).map(function (input) {
          return state.candidates[
            Number(input.dataset.candidateIndex)
          ];
        }).filter(Boolean);

        if (!selected.length) {
          showAccessStatus("Выберите хотя бы один никнейм.", false);
          return;
        }

        var password =
          document.getElementById("accessBulkPassword").value.trim();

        if (!password) {
          password = generatePassword();
          document.getElementById("accessBulkPassword").value = password;
        }

        var button = form.querySelector('button[type="submit"]');
        if (button) {
          button.disabled = true;
          button.textContent = "Выдача…";
        }

        try {
          var result = await window.BR_API.accessGrant(
            user.token,
            {
              nicknames: selected,
              password: password,
              role: document.getElementById("accessBulkRole").value,
              position: document.getElementById("accessBulkPosition").value
            }
          );

          renderCredentials(result, "bulkCredentials");
          showAccessStatus(
            "Доступ выдан для " + selected.length + " администраторов.",
            true
          );

          await loadCandidates();
          await loadAccounts(
            document.getElementById("accessRegistryRoot")
          );

        } catch (error) {
          showAccessStatus(
            error.message || "Не удалось выдать доступ.",
            false
          );
        } finally {
          if (button) {
            button.disabled = false;
            button.textContent = "Выдать доступ выбранным";
          }
        }
      };
    }

    return {
      managementOnly: true,
      title: "Выдать доступ",
      subtitle: "Ручная и массовая выдача доступа к панели",
      render: function () {
        return '<div class="access-page">' +
          '<div class="access-page-status settings-status" id="accessPageStatus" hidden></div>' +

          '<div class="access-grid">' +

            '<section class="box access-card">' +
              '<div class="access-card-head"><div><small>РУЧНАЯ ВЫДАЧА</small><h2>Новый доступ</h2></div><span>Укажите никнейм или сгенерируйте пароль автоматически</span></div>' +
              '<form id="accessManualForm">' +
                '<div class="form-grid">' +
                  '<div class="form-field form-full"><label>Никнейм</label><input id="accessManualNickname" class="form-input" required placeholder="Например: Nikita_Zvezda"></div>' +
                  '<div class="form-field"><label>Роль</label><select id="accessManualRole" class="form-select"><option value="admin">Администратор</option><option value="management">Руководство</option></select></div>' +
                  '<div class="form-field"><label>Должность</label>' + positionSelect("accessManualPosition", "position", "") + '</div>' +
                  '<div class="form-field form-full"><label>Пароль</label><div class="access-password-field"><input id="accessManualPassword" class="form-input" type="text" required autocomplete="new-password" placeholder="Сгенерируйте безопасный пароль"><button id="accessManualGenerate" class="small-button" type="button">Сгенерировать</button></div></div>' +
                '</div>' +
                '<div class="form-actions"><button class="button button-primary" type="submit">Выдать доступ</button></div>' +
              '</form>' +
              '<div id="manualCredentials" class="access-credentials" hidden></div>' +
            '</section>' +

            '<section class="box access-card">' +
              '<div class="access-card-head"><div><small>МАССОВАЯ ВЫДАЧА</small><h2>Найти администраторов</h2></div><button class="button button-secondary" id="loadAccessCandidates" type="button">Загрузить никнеймы</button></div>' +
              '<p class="access-description">Получаем список из Google Sheets, сравниваем его с Supabase и показываем только тех, у кого нет активного доступа.</p>' +
              '<div id="accessCandidatesRoot" class="access-candidates-root" hidden></div>' +
              '<form id="accessBulkForm" class="access-bulk-form">' +
                '<div class="form-grid">' +
                  '<div class="form-field"><label>Роль для выбранных</label><select id="accessBulkRole" class="form-select"><option value="admin">Администратор</option><option value="management">Руководство</option></select></div>' +
                  '<div class="form-field"><label>Должность</label>' + positionSelect("accessBulkPosition", "position", "") + '</div>' +
                  '<div class="form-field form-full"><label>Пароль для выбранных</label><div class="access-password-field"><input id="accessBulkPassword" class="form-input" type="text" autocomplete="new-password" placeholder="Один пароль для выбранных"><button id="accessBulkGenerate" class="small-button" type="button">Сгенерировать</button></div></div>' +
                '</div>' +
                '<div class="form-actions"><button class="button button-primary" type="submit">Выдать доступ выбранным</button></div>' +
              '</form>' +
              '<div id="bulkCredentials" class="access-credentials" hidden></div>' +
            '</section>' +

          '</div>' +

          '<div id="accessRegistryRoot" class="access-registry-root"></div>' +
          '<div id="accessModalRoot"></div>' +
        '</div>';
      },

      bind: function () {
        bindManualForm();
        bindBulkForm();

        document.getElementById("loadAccessCandidates").onclick =
          loadCandidates;

        loadAccounts(
          document.getElementById("accessRegistryRoot")
        );
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
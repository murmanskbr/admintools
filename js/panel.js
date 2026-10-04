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

  function save(key, value) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify(value)
      );
    } catch (error) {
      console.error(
        "[BR AdminTools] Не удалось сохранить локальные данные:",
        {
          key: key,
          error: error
        }
      );
      throw error;
    }
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
    function formatGoogleCellValue(_header, value) {
      // Google Sheets is the source of truth: do not parse, rename,
      // calculate, localize or otherwise alter the returned cell value.
      return value == null ? "" : String(value);
    }

    var rows = data.headers.map(function (header, index) {
      var value = formatGoogleCellValue(header, data.raw[index]);

      return '<tr><td>' + E(header || "Без названия") + '</td><td>' + E(value) + '</td></tr>';
    }).join("");
    var mobileRows = data.headers.map(function (header, index) {
      var value = formatGoogleCellValue(header, data.raw[index]);

      return '<div class="mobile-data-card">' +
        '<div class="mobile-data-label">' + E(header || ("Колонка " + columnLetter(index))) + '</div>' +
        '<div class="mobile-data-value">' + E(value) + '</div>' +
      '</div>';
    }).join("");

    return '<div class="page-toolbar"><div><small>GOOGLE ТАБЛИЦА</small><b>' + E(caption || "Полные данные строки") + '</b></div><span class="muted">' + E(rangeText) + '</span></div>' +
      '<div class="box table-box google-row-desktop"><table class="google-row-table"><thead><tr><th>Заголовок</th><th>Значение</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
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

  function normalizeAdminRosterText(value) {
    return String(value == null ? "" : value)
      .trim()
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[._-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Названия разделов Google Таблицы никогда не являются никнеймами.
  // Фильтр используется во всех местах, где из таблицы строятся списки администрации.
  function isAdminCategoryLabel(value) {
    var text = normalizeAdminRosterText(value);
    if (!text) return false;

    var compact = text.replace(/[^a-zа-я0-9]/gi, "");

    var exact = [
      "администратор",
      "администраторы",
      "старший администратор",
      "старшие администраторы",
      "модератор",
      "модераторы",
      "старший модератор",
      "старшие модераторы",
      "младший модератор",
      "младшие модераторы",
      "следящий",
      "следящие",
      "старший следящий",
      "старшие следящие",
      "старшие следящие за ап",
      "следящие за ап",
      "руководство",
      "куратор",
      "кураторы",
      "управление"
    ];

    if (exact.indexOf(text) !== -1) return true;

    var roleWord =
      text.indexOf("администратор") !== -1 ||
      text.indexOf("модератор") !== -1 ||
      text.indexOf("следящ") !== -1 ||
      text.indexOf("куратор") !== -1 ||
      text.indexOf("руковод") !== -1 ||
      text.indexOf("управлен") !== -1;

    // Категории обычно состоят из слов с пробелами. Никнеймы Black Russia
    // не должны превращаться в такие названия разделов.
    if (roleWord && /\s/.test(text)) return true;

    // Английские/смешанные названия разделов, если они когда-нибудь
    // придут из таблицы.
    if (
      compact === "admins" ||
      compact === "admin" ||
      compact === "moderators" ||
      compact === "moderator" ||
      compact === "seniormoderators" ||
      compact === "juniormoderators" ||
      compact === "senioradmins" ||
      compact === "superadmins"
    ) return true;

    return false;
  }

  function isGoogleCategoryRow(item) {
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

    var nickname = "";
    if (nicknameIndex >= 0) {
      nickname = String(raw[nicknameIndex] == null ? "" : raw[nicknameIndex]).trim();
    } else if (item && item.nickname != null) {
      nickname = String(item.nickname).trim();
    }

    if (!nickname || isAdminCategoryLabel(nickname)) return true;

    var nonEmptyCount = 0;
    for (var j = 0; j < raw.length; j += 1) {
      if (String(raw[j] == null ? "" : raw[j]).trim() !== "") {
        nonEmptyCount += 1;
        if (nonEmptyCount > 1) return false;
      }
    }

    // Одно заполненное поле + название роли = заголовок раздела, не админ.
    return nonEmptyCount === 1 && isAdminCategoryLabel(nickname);
  }

  function isValidAdminRosterItem(item) {
    var nickname = item && itemNicknameForRoster
      ? itemNicknameForRoster(item)
      : "";

    return !!nickname && !isAdminCategoryLabel(nickname) && !isGoogleCategoryRow(item);
  }

  function itemNicknameForRoster(item) {
    if (!item) return "";

    if (item.nickname != null && String(item.nickname).trim()) {
      return String(item.nickname).trim();
    }

    var values = item.values || {};
    var headers = Array.isArray(values.headers) ? values.headers : [];
    var raw = Array.isArray(values.raw_row) ? values.raw_row : [];

    for (var i = 0; i < headers.length; i += 1) {
      if (isGoogleNicknameHeader(headers[i])) {
        return String(raw[i] == null ? "" : raw[i]).trim();
      }
    }

    return "";
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
          var profileNickname = String(user.nickname || "").trim();
          var result = await window.BR_API.getStatisticsAdmin(user.token, profileNickname);
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

        // Убираем строки-заголовки разделов Google Таблицы из состава администрации.
        var filteredAdminRows = [];
        var filteredAdminRowNumbers = [];
        rows.forEach(function (row, index) {
          var sourceItem = statistics[index] || {
            values: {
              headers: headers,
              raw_row: row
            }
          };
          if (isGoogleCategoryRow(sourceItem)) return;
          filteredAdminRows.push(row);
          filteredAdminRowNumbers.push(rowNumbers[index] || (sourceItem.row_number || (sourceItem.values && sourceItem.values.row_number)) || 0);
        });
        rows = filteredAdminRows;
        rowNumbers = filteredAdminRowNumbers;

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

        root.innerHTML =
          '<div class="box"><div class="empty">Обновление статистики из Google Sheets...</div></div>';

        try {
          var result = await window.BR_API.myStatistics(user.token);
          root.innerHTML =
            '<div class="box"><div class="stats-table-head"><div><small>ЛИЧНАЯ СТАТИСТИКА</small><b>' + E(user.nickname) + '</b></div><span class="muted">Свежие данные из Google Sheets</span></div></div>' +
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

  function allStatistics(user) {
    var selectedDate = dateIso(0);
    var lastResult = null;

    // Сдвигаем именно выбранную дату, а не сегодняшнюю.
    // Иначе каждая стрелка считала шаг от текущего дня и пропускала даты.
    function shiftSelectedDate(days) {
      var parts = String(selectedDate || "").split("-");
      if (parts.length !== 3) return dateIso(days);

      var year = Number(parts[0]);
      var month = Number(parts[1]);
      var day = Number(parts[2]);

      if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        return dateIso(days);
      }

      var date = new Date(year, month - 1, day);
      if (Number.isNaN(date.getTime())) return dateIso(days);

      date.setDate(date.getDate() + days);

      return date.getFullYear() + "-" +
        String(date.getMonth() + 1).padStart(2, "0") + "-" +
        String(date.getDate()).padStart(2, "0");
    }
    var lastData = [];
    var lastHeaders = [];
    var lastNicknameIndex = -1;

    function normalizeHeader(header) {
      return String(header == null ? "" : header)
        .trim()
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[_\-]+/g, " ")
        .replace(/\s+/g, " ");
    }

    function findNicknameIndex(headers) {
      var aliases = [
        "никнейм", "ник", "nickname", "nick",
        "логин", "login", "username"
      ];

      for (var i = 0; i < headers.length; i += 1) {
        if (aliases.indexOf(normalizeHeader(headers[i])) !== -1) {
          return i;
        }
      }

      return -1;
    }

    var normativeToastTimer = null;

    function showNormativeResult(message, type) {
      var old = document.getElementById("brNormativeToast");
      if (old) old.remove();

      var toast = document.createElement("div");
      toast.id = "brNormativeToast";
      toast.className = "br-normative-toast " + (
        type === "success" ? "is-success" : "is-error"
      );

      toast.innerHTML =
        '<span class="br-normative-toast-icon">' +
        (type === "success" ? "✓" : "!") +
        '</span>' +
        '<span class="br-normative-toast-message">' +
        E(String(message || "")) +
        '</span>';

      document.body.appendChild(toast);

      window.clearTimeout(normativeToastTimer);
      window.requestAnimationFrame(function () {
        toast.classList.add("is-visible");
      });

      normativeToastTimer = window.setTimeout(function () {
        toast.classList.remove("is-visible");
        window.setTimeout(function () {
          if (toast.parentNode) toast.remove();
        }, 220);
      }, type === "success" ? 4200 : 5200);
    }

    function normativeErrorMessage(error) {
      var code = error && error.code ? String(error.code) : "";

      if (code === "GOOGLE_SCRIPT_NOT_FOUND") {
        return "Статус сохранён, но обновление таблицы не удалось: публичная ссылка Google Apps Script сейчас недоступна.";
      }

      if (code === "GOOGLE_SCRIPT_TIMEOUT" || code === "STATISTICS_TIMEOUT") {
        return "Статус сохранён, но Google Apps Script не ответил вовремя. Текущие данные оставлены на экране.";
      }

      if (code === "APPS_SCRIPT_UNAUTHORIZED") {
        return "Статус не удалось подтвердить: секрет Google Apps Script не совпадает.";
      }

      return String(
        error && error.message
          ? error.message
          : "Не удалось завершить операцию."
      );
    }

    function sourceData(result) {
      var headers = Array.isArray(result && result.headers)
        ? result.headers.slice()
        : [];

      var rows = Array.isArray(result && result.rows)
        ? result.rows.map(function (row) {
            return Array.isArray(row) ? row.slice() : [];
          })
        : [];

      var statistics = Array.isArray(result && result.statistics)
        ? result.statistics
        : [];

      if (!headers.length && statistics.length) {
        var firstValues = statistics[0] && statistics[0].values;
        if (firstValues && Array.isArray(firstValues.headers)) {
          headers = firstValues.headers.slice();
        }
      }

      if (!rows.length && statistics.length) {
        rows = statistics.map(function (item) {
          var values = item && item.values ? item.values : {};
          return Array.isArray(values.raw_row)
            ? values.raw_row.slice()
            : [];
        });
      }

      var count = headers.length;

      rows.forEach(function (row) {
        if (row.length > count) count = row.length;
      });

      while (headers.length < count) {
        headers.push("");
      }

      var sections = [];
      if (statistics.length) {
        var currentSection = "";
        statistics.forEach(function (item) {
          var title = item && item.section_title
            ? String(item.section_title).trim()
            : "";
          if (title && title !== currentSection) {
            sections.push({
              title: title,
              row_number: item.row_number || 0
            });
            currentSection = title;
          }
        });
      }

      if (!sections.length && result && Array.isArray(result.sections)) {
        sections = result.sections
          .map(function (section) {
            return {
              title: section && section.title
                ? String(section.title).trim()
                : "",
              row_number: section && section.row_number
                ? Number(section.row_number)
                : 0
            };
          })
          .filter(function (section) {
            return !!section.title;
          });
      }

      var nicknameIndex = findNicknameIndex(headers);
      var displayRecords = [];
      var pendingSection = "";

      function rowTextValues(row) {
        return row.map(function (value) {
          return rawCellValue(value).trim();
        }).filter(function (value) {
          return value !== "";
        });
      }

      function isHeaderLikeRow(row) {
        var values = rowTextValues(row);
        if (values.length < 3) return false;

        var known = 0;
        values.forEach(function (value) {
          var normalized = normalizeHeader(value);
          if (
            [
              "никнейм", "возраст", "доступ с пк", "должность",
              "неактивы", "баллы активности", "дни на посту",
              "страйки", "предупреждение", "предупреждения",
              "баллы", "последнее повышение"
            ].indexOf(normalized) >= 0
          ) {
            known += 1;
          }
        });

        return known >= 4;
      }

      function sectionTitleFromRow(row) {
        var values = rowTextValues(row);
        if (values.length !== 1) return "";

        var title = values[0];
        var normalized = normalizeHeader(title);

        if (
          normalized.indexOf("администрац") >= 0 ||
          normalized.indexOf("модератор") >= 0 ||
          normalized.indexOf("следящ") >= 0 ||
          normalized.indexOf("старш") >= 0
        ) {
          return title;
        }

        return "";
      }

      function isValidNickname(value) {
        var normalized = normalizeHeader(value);

        if (!normalized) return false;

        return [
          "никнейм", "ник", "nickname", "nick",
          "логин", "login", "username",
          "должность", "возраст", "доступ с пк",
          "неактивы", "баллы активности", "дни на посту",
          "страйки", "предупреждение", "предупреждения",
          "баллы", "последнее повышение"
        ].indexOf(normalized) < 0;
      }

      rows.forEach(function (row, rowIndex) {
        if (!Array.isArray(row) || !rowTextValues(row).length) {
          return;
        }

        var sectionTitle = sectionTitleFromRow(row);

        if (sectionTitle) {
          pendingSection = sectionTitle;
          return;
        }

        if (isHeaderLikeRow(row)) {
          return;
        }

        var nickname = nicknameIndex >= 0
          ? rawCellValue(row[nicknameIndex]).trim()
          : "";

        var nonEmptyCount = rowTextValues(row).length;

        if (
          !nickname ||
          !isValidNickname(nickname) ||
          nonEmptyCount < 2
        ) {
          return;
        }

        var sourceItem = statistics[rowIndex] || {};
        var effectiveSection = sourceItem && sourceItem.section_title
          ? String(sourceItem.section_title).trim()
          : pendingSection;

        displayRecords.push({
          row: row,
          sourceItem: sourceItem,
          originalIndex: rowIndex,
          sectionTitle: effectiveSection
        });

        pendingSection = "";
      });

      return {
        headers: headers,
        rows: rows,
        statistics: statistics,
        displayRecords: displayRecords,
        sections: sections,
        count: count
      };
    }

    function sourceRowNumber(result, rowIndex) {
      var statistics = Array.isArray(result && result.statistics)
        ? result.statistics
        : [];

      var item = statistics[rowIndex];

      var value = item && item.row_number != null
        ? item.row_number
        : result && Array.isArray(result.row_numbers)
          ? result.row_numbers[rowIndex]
          : 0;

      var rowNumber = Number(value);
      return Number.isFinite(rowNumber) ? rowNumber : 0;
    }

    function sourceNormativeHeaderIndex(headers) {
      var aliases = [
        "норматив", "нормативы", "норма", "нормы", "норм",
        "статус норматива", "результат норматива",
        "norm", "normative", "normatives"
      ];

      for (var i = 0; i < headers.length; i += 1) {
        if (aliases.indexOf(normalizeHeader(headers[i])) !== -1) {
          return i;
        }
      }

      return -1;
    }

    function externalGoogleNormative(data, nickname) {
      if (!data || !nickname) return "";

      var target = String(nickname).trim().toLowerCase();
      var date = String(selectedDate || "").trim();
      var nicknameKeys = ["nickname", "nick", "username", "login", "никнейм", "ник", "логин"];
      var valueKeys = ["normative_status", "status", "normative", "norm", "result", "value", "статус", "норматив", "норма", "результат"];
      var dateKeys = ["date", "selected_date", "normative_date", "дата", "дата норматива"];

      function getKey(object, keys) {
        if (!object || typeof object !== "object") return null;

        for (var i = 0; i < keys.length; i += 1) {
          if (Object.prototype.hasOwnProperty.call(object, keys[i])) {
            return object[keys[i]];
          }
        }

        var normalizedKeys = Object.keys(object);
        for (var j = 0; j < normalizedKeys.length; j += 1) {
          var normalizedObjectKey = normalizeHeader(normalizedKeys[j]);
          for (var k = 0; k < keys.length; k += 1) {
            if (normalizedObjectKey === normalizeHeader(keys[k])) {
              return object[normalizedKeys[j]];
            }
          }
        }

        return null;
      }

      function scan(value) {
        if (!value) return "";

        if (Array.isArray(value.marks)) {
          for (var m = 0; m < value.marks.length; m += 1) {
            var mark = value.marks[m];
            if (!mark || typeof mark !== "object") continue;

            var markNickname = getKey(mark, nicknameKeys);
            var markDate = getKey(mark, dateKeys);
            var markStatus = getKey(mark, valueKeys);
            var markBackground = getKey(mark, ["background", "color", "цвет"]);

            if (
              markNickname != null &&
              String(markNickname).trim().toLowerCase() === target &&
              (
                markDate == null ||
                String(markDate).trim() === "" ||
                normalizeNormativeDate(markDate) === normalizeNormativeDate(date)
              )
            ) {
              if (markStatus != null && String(markStatus).trim() !== "") {
                return String(markStatus);
              }

              var color = rawCellValue(markBackground).trim().toLowerCase();

              if (
                color === "#34d186" ||
                color === "#00ff00" ||
                color === "green"
              ) {
                return "Норма";
              }

              if (
                color === "#f6c344" ||
                color === "yellow" ||
                color === "orange"
              ) {
                return "Перенорма";
              }

              if (
                color === "#a7adb7" ||
                color === "gray" ||
                color === "grey"
              ) {
                return "Неактив";
              }

              return "";
            }
          }
        }

        if (Array.isArray(value)) {
          for (var i = 0; i < value.length; i += 1) {
            var found = scan(value[i]);
            if (found !== "") return found;
          }
          return "";
        }

        if (typeof value !== "object") return "";

        // Support a raw Google Sheets matrix: { headers: [...], rows: [...] }.
        if (Array.isArray(value.headers) && Array.isArray(value.rows)) {
          var headers = value.headers.map(function (header) {
            return String(header == null ? "" : header).trim();
          });

          var nickIndex = -1;
          var statusIndex = -1;
          var dateIndex = -1;

          for (var h = 0; h < headers.length; h += 1) {
            var normalized = normalizeHeader(headers[h]);
            if (
              nickIndex < 0 &&
              nicknameKeys.some(function (key) {
                return normalizeHeader(key) === normalized;
              })
            ) {
              nickIndex = h;
            }

            if (
              statusIndex < 0 &&
              valueKeys.some(function (key) {
                return normalizeHeader(key) === normalized;
              })
            ) {
              statusIndex = h;
            }

            if (
              dateIndex < 0 &&
              dateKeys.some(function (key) {
                return normalizeHeader(key) === normalized;
              })
            ) {
              dateIndex = h;
            }
          }

          if (nickIndex >= 0 && statusIndex >= 0) {
            for (var r = 0; r < value.rows.length; r += 1) {
              var matrixRow = Array.isArray(value.rows[r]) ? value.rows[r] : [];
              var matrixNickname = String(matrixRow[nickIndex] == null ? "" : matrixRow[nickIndex]).trim().toLowerCase();

              if (matrixNickname !== target) continue;

              if (dateIndex >= 0 && date) {
                var matrixDate = String(matrixRow[dateIndex] == null ? "" : matrixRow[dateIndex]).trim();
                if (
                  matrixDate &&
                  normalizeNormativeDate(matrixDate) !== normalizeNormativeDate(date)
                ) continue;
              }

              return String(matrixRow[statusIndex] == null ? "" : matrixRow[statusIndex]);
            }
          }
        }

        var nicknameValue = getKey(value, nicknameKeys);
        if (
          nicknameValue != null &&
          String(nicknameValue).trim().toLowerCase() === target
        ) {
          var dateValue = getKey(value, dateKeys);
          if (
            dateValue == null ||
            String(dateValue).trim() === "" ||
            String(dateValue).trim() === date
          ) {
            var direct = getKey(value, valueKeys);
            if (direct != null) return String(direct);
          }
        }

        var nestedKeys = ["normatives", "marks", "administrators", "rows", "data", "items", "results"];
        for (var j = 0; j < nestedKeys.length; j += 1) {
          if (value[nestedKeys[j]] != null) {
            var nested = scan(value[nestedKeys[j]]);
            if (nested !== "") return nested;
          }
        }

        if (Object.prototype.hasOwnProperty.call(value, nickname)) {
          var byNickname = value[nickname];
          if (typeof byNickname === "object" && byNickname !== null) {
            var byNicknameValue = getKey(byNickname, valueKeys);
            if (byNicknameValue != null) return String(byNicknameValue);
          } else if (byNickname != null) {
            return String(byNickname);
          }
        }

        return "";
      }

      return scan(data);
    }

    function rawCellValue(value) {
      return value == null ? "" : String(value);
    }

    function isSectionSourceRow(row, headers) {
      if (!Array.isArray(row) || !Array.isArray(headers)) return false;

      var nonEmpty = [];
      row.forEach(function (value, index) {
        var text = rawCellValue(value).trim();
        if (text) {
          nonEmpty.push({
            index: index,
            value: text
          });
        }
      });

      if (nonEmpty.length !== 1) return false;

      // A real section title in the source sheet is a single non-empty
      // cell while all statistic columns are empty.
      var title = nonEmpty[0].value;
      var normalizedTitle = normalizeHeader(title);

      if (
        sourceNormativeHeaderIndex(headers) === nonEmpty[0].index ||
        findNicknameIndex(headers) === nonEmpty[0].index
      ) {
        return false;
      }

      return (
        normalizedTitle.indexOf("администрац") >= 0 ||
        normalizedTitle.indexOf("модератор") >= 0 ||
        normalizedTitle.indexOf("следящ") >= 0 ||
        normalizedTitle.indexOf("старш") >= 0
      );
    }

    function normalizeNormativeDate(value) {
      var text = rawCellValue(value).trim();

      var match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (match) {
        return match[3] + "-" + match[2] + "-" + match[1];
      }

      var slash = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (slash) {
        return slash[3] + "-" + slash[2] + "-" + slash[1];
      }

      return text;
    }

    function approvedInactiveForSelectedDate(nickname) {
      if (!lastResult || !Array.isArray(lastResult.inactive_periods) || !nickname) {
        return false;
      }

      var targetNickname = normalizeHeader(nickname);

      return lastResult.inactive_periods.some(function (period) {
        if (!period) return false;

        var periodNickname = normalizeHeader(period.nickname);
        if (!periodNickname || periodNickname !== targetNickname) {
          return false;
        }

        var startDate = String(period.start_date || "").trim();
        var endDate = String(period.end_date || "").trim();
        var currentDate = String(selectedDate || "").trim();

        return (
          /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
          /^\d{4}-\d{2}-\d{2}$/.test(endDate) &&
          currentDate >= startDate &&
          currentDate <= endDate
        );
      });
    }

    function normativeDisplayStatus(normatives, nickname) {
      if (!nickname) return "";

      // Одобренный период неактива является источником истины для выбранной даты.
      // Он имеет приоритет над значением, пришедшим из недельной таблицы.
      if (approvedInactiveForSelectedDate(nickname)) {
        return "Неактив";
      }

      var value = externalGoogleNormative(
        normatives,
        nickname
      );

      if (value) {
        var normalized = normalizeHeader(value);

        if (normalized === "норма" || normalized === "norm" || normalized === "passed") {
          return "Норма";
        }

        if (normalized === "перенорма" || normalized === "rework") {
          return "Перенорма";
        }

        if (normalized === "неактив" || normalized === "inactive") {
          return "Неактив";
        }

        if (
          normalized === "нет нормы" ||
          normalized === "no norm" ||
          normalized === "no normative" ||
          normalized === "no_norm"
        ) {
          return "Нет нормы";
        }

        if (
          normalized === "не сдан" ||
          normalized === "не сдана" ||
          normalized === "not submitted" ||
          normalized === "not_submitted"
        ) {
          return "Не сдана";
        }

        if (
          normalized === "на проверке" ||
          normalized === "pending"
        ) {
          return "На проверке";
        }

        return String(value);
      }

      if (
        normatives &&
        (
          Array.isArray(normatives.marks) ||
          Array.isArray(normatives.rows)
        )
      ) {
        return "Не сдана";
      }

      return "";
    }

    function normativeStatusBadge(status) {
      if (!status) return "";

      var classes = {
        "Норма": "badge-green",
        "Перенорма": "badge-blue",
        "Неактив": "badge-gray",
        "Нет нормы": "badge-red",
        "Не сдан": ""
      };

      return '<span class="badge ' +
        (classes[status] || "") +
        '">' + E(status) + '</span>';
    }

    function renderTable() {
      var root = document.getElementById("allStatsRoot");
      if (!root) return;

      var data = sourceData(lastResult || {});
      lastHeaders = data.headers.slice();
      lastNicknameIndex = findNicknameIndex(lastHeaders);

      var normativeHeaderIndex = sourceNormativeHeaderIndex(lastHeaders);
      var hasSourceNormativeColumn = normativeHeaderIndex >= 0;

      var displayRecords = Array.isArray(data.displayRecords)
        ? data.displayRecords
        : data.rows.map(function (row, rowIndex) {
            return {
              row: row,
              sourceItem: data.statistics[rowIndex] || {},
              originalIndex: rowIndex,
              sectionTitle: ""
            };
          });

      lastData = displayRecords.map(function (record) {
        var row = record.row;
        var sourceItem = record.sourceItem || {};
        return {
          row_number: sourceItem.row_number != null
            ? Number(sourceItem.row_number)
            : sourceRowNumber(lastResult || {}, record.originalIndex),
          sheet_name: sourceItem.sheet_name || (lastResult && lastResult.source && lastResult.source.sheet_name) || "",
          section_title: record.sectionTitle || "",
          values: {
            headers: lastHeaders.slice(),
            raw_row: row.slice()
          }
        };
      });

      var headerCells = lastHeaders.map(function (header) {
        return '<th>' + E(header == null ? "" : header) + '</th>';
      }).join("");

      if (hasSourceNormativeColumn) {
        // The normative value already belongs to the Google Sheets source row.
        // Do not add or rewrite it.
      }

      var lastRenderedSection = "";
      var rows = displayRecords.map(function (record, displayIndex) {
        var row = record.row;
        var rowIndex = record.originalIndex;
        var sectionTitle = record.sectionTitle || "";

        var sectionRow = "";
        if (
          sectionTitle &&
          sectionTitle !== lastRenderedSection
        ) {
          lastRenderedSection = sectionTitle;
          sectionRow =
            '<tr class="stats-section-row"><td colspan="' +
            String(lastHeaders.length + 2) +
            '"><strong>' + E(sectionTitle) + '</strong></td></tr>';
        }

        var cells = lastHeaders.map(function (_, columnIndex) {
          var value = rawCellValue(row[columnIndex]);
          return '<td data-stat-column="' + columnIndex + '">' + E(value) + '</td>';
        }).join("");

        var nickname = lastNicknameIndex >= 0
          ? rawCellValue(row[lastNicknameIndex]).trim()
          : "";

        var actionButtons = nickname
          ? '<div class="stats-norm-actions">' +
              '<button class="normative-icon-button normative-mark-norm" data-stat-norm="norm" data-nickname="' + E(nickname) + '" title="Норма" aria-label="Норма">✓</button>' +
              '<button class="normative-icon-button normative-mark-rework" data-stat-norm="rework" data-nickname="' + E(nickname) + '" title="Перенорма" aria-label="Перенорма">↻</button>' +
              '<button class="normative-icon-button normative-mark-no-norm" data-stat-norm="no_norm" data-nickname="' + E(nickname) + '" title="Нет нормы" aria-label="Нет нормы">✕</button>' +
              '<button class="normative-icon-button normative-mark-inactive" data-stat-norm="inactive" data-nickname="' + E(nickname) + '" title="Неактив" aria-label="Неактив">—</button>' +
            '</div>'
          : "";

        var normativeStatus = normativeDisplayStatus(
          lastResult && lastResult.normatives,
          nickname
        );

        var normativeCell =
          '<td class="stats-norm-cell">' +
            '<span class="stats-norm-value">' +
              normativeStatusBadge(normativeStatus) +
            '</span>' +
            actionButtons +
          '</td>';

        var actionCell = nickname
          ? '<td class="admin-actions-cell"><button class="admin-edit-inline" type="button" data-edit-row-index="' + displayIndex + '">Изменить</button></td>'
          : '<td class="admin-actions-cell"></td>';

        return sectionRow + '<tr>' + cells + normativeCell + actionCell + '</tr>';
      }).join("");

      if (!rows) {
        rows = '<tr><td colspan="' + (lastHeaders.length + 2) + '" class="table-empty">В Google Таблице нет строк данных.</td></tr>';
      }

      root.innerHTML =
        '<div class="box table-box">' +
          '<div class="stats-table-head"><div>' +
            '<small>СТАТИСТИКА АДМИНИСТРАЦИИ</small>' +
            '<b>' + E(String(displayRecords.length)) + ' сотрудников</b>' +
          '</div><span class="muted">Источник: Google Таблица</span></div>' +
          '<div class="admins-source-row"><span>Отображаются значения и столбцы без подстановок сайта</span><span>' +
            E(lastResult && lastResult.source && lastResult.source.sheet_name ? lastResult.source.sheet_name : "Google Sheets") +
          '</span></div>' +
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
          row.classList.add("stats-row-selected");
        });
      });

      document.querySelectorAll("[data-stat-norm]").forEach(function (button) {
        button.onclick = async function () {
          var nickname = button.dataset.nickname || "";
          var status = button.dataset.statNorm || "";
          var labels = {
            norm: "Норма",
            rework: "Перенорма",
            no_norm: "Нет нормы",
            inactive: "Неактив"
          };
          if (!nickname) return;

          if (!confirm(
            "Выставить «" + (labels[status] || status) +
            "» для " + nickname +
            " за " + formatDateOnly(selectedDate) + "?"
          )) return;

          button.disabled = true;

          try {
            var result = await window.BR_API.normativeMark(
              user.token,
              nickname,
              selectedDate,
              status,
              ""
            );

            var google = result && result.google_sheet
              ? result.google_sheet
              : {};

            var details = [];
            if (google.cell) details.push("ячейка " + String(google.cell));
            if (google.post_days_updated) {
              details.push("Дни на посту: " + String(google.post_days_value));
            }
            if (google.inactives_updated) {
              details.push("Неактивы: " + String(google.inactives_value));
            }
            if (google.strikes_updated) {
              details.push("Страйки: " + String(google.strikes_value));
            }

            // normative_mark теперь возвращает свежий снимок Google Sheets
            // непосредственно в ответе. Поэтому второй запрос load() не нужен:
            // он только добавлял лишнюю задержку и мог заменить успешное
            // уведомление ошибкой повторного обновления.
            var hasFreshSnapshot =
              result &&
              Array.isArray(result.headers) &&
              Array.isArray(result.rows) &&
              Array.isArray(result.statistics);

            if (hasFreshSnapshot) {
              lastResult = result;
              renderTable();
            }

            var successMessage =
              "Статус «" + (labels[status] || status) +
              "» проставлен для " + nickname +
              " за " + formatDateOnly(selectedDate);

            if (details.length) {
              successMessage += " • " + details.join(" • ");
            }

            showNormativeResult(
              successMessage,
              "success"
            );

            // Для совместимости со старыми ответами без снимка таблицы
            // выполняем один обычный refresh как резервный путь.
            if (!hasFreshSnapshot) {
              try {
                await load(user, true);
              } catch (refreshError) {
                console.warn(
                  "[BR AdminTools] Статус сохранён, но резервное обновление статистики не удалось:",
                  refreshError
                );

                showNormativeResult(
                  "✅ " + (labels[status] || status) +
                  " проставлен для " + nickname +
                  ". Данные на экране не удалось обновить.",
                  "error"
                );
              }
            }
          } catch (error) {
            showNormativeResult(
              normativeErrorMessage(error),
              "error"
            );
            button.disabled = false;
          }
        };
      });

      document.querySelectorAll("[data-edit-row-index]").forEach(function (button) {
        button.onclick = function (event) {
          event.preventDefault();
          event.stopPropagation();

          var rowIndex = Number(button.dataset.editRowIndex);
          var item = lastData[rowIndex];

          if (!item) {
            alert("Выбранная строка больше не существует в загруженной таблице.");
            return;
          }

          openEditModal(user, item);
        };
      });
    }

    function openEditModal(user, item) {
      var root = document.getElementById("adminEditModal");
      if (!root) return;

      var values = item && item.values ? item.values : {};
      var headers = Array.isArray(values.headers) ? values.headers : [];
      var raw = Array.isArray(values.raw_row) ? values.raw_row : [];

      if (!headers.length) {
        alert("В Google Таблице не найдены заголовки столбцов.");
        return;
      }

      var fields = headers.map(function (header, index) {
        var title = rawCellValue(header);
        if (!title.trim()) return "";

        return '<div class="form-field">' +
          '<label>' + E(title) + '</label>' +
          '<input class="form-input" data-google-field-index="' + index + '" value="' +
            E(rawCellValue(raw[index])) + '">' +
        '</div>';
      }).join("");

      root.innerHTML =
        '<div class="modal-backdrop" id="adminEditBackdrop">' +
          '<div class="modal-card admin-edit-modal-card">' +
            '<div class="modal-head">' +
              '<div class="admin-edit-title"><small>GOOGLE ТАБЛИЦА</small><h2>Редактирование строки</h2><span>Изменяются только существующие столбцы</span></div>' +
              '<button class="modal-close" id="adminEditClose" type="button">×</button>' +
            '</div>' +
            '<form id="adminEditForm">' +
              '<div class="form-grid">' + fields + '</div>' +
              '<div class="form-actions admin-edit-actions">' +
                '<button class="button button-secondary" id="adminEditCancel" type="button">Отмена</button>' +
                '<button class="button button-primary" type="submit">Сохранить изменения</button>' +
              '</div>' +
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

        var changes = {};
        document.querySelectorAll("[data-google-field-index]").forEach(function (input) {
          var index = Number(input.dataset.googleFieldIndex);
          var header = rawCellValue(headers[index]).trim();
          if (!header) return;

          var currentValue = rawCellValue(raw[index]);
          var nextValue = String(input.value);

          if (nextValue !== currentValue) {
            changes[header] = nextValue;
          }
        });

        if (!Object.keys(changes).length) {
          close();
          return;
        }

        var saveButton = document.querySelector("#adminEditForm button[type=submit]");
        if (saveButton) {
          saveButton.disabled = true;
          saveButton.textContent = "Сохранение…";
        }

        try {
          await window.BR_API.updateAdminStatistics(
            user.token,
            lastNicknameIndex >= 0
              ? rawCellValue(raw[lastNicknameIndex]).trim()
              : "",
            changes
          );

          close();
          await load(user, true);
        } catch (error) {
          alert(error.message || "Не удалось сохранить изменения.");
          if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = "Сохранить изменения";
          }
        }
      };
    }

    function load(user, forceRefresh) {
      var root = document.getElementById("allStatsRoot");
      var refresh = document.getElementById("allStatsRefresh");
      var dateInput = document.getElementById("allStatsDate");
      if (!root) return Promise.resolve();

      if (dateInput && /^\d{4}-\d{2}-\d{2}$/.test(String(dateInput.value || ""))) {
        selectedDate = String(dateInput.value);
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(selectedDate || ""))) {
        selectedDate = dateIso(0);
        if (dateInput) dateInput.value = selectedDate;
      }

      if (refresh) {
        refresh.disabled = true;
        refresh.textContent = forceRefresh ? "Обновление…" : "Загрузка…";
      }

      var hasRenderedData =
        lastResult &&
        Array.isArray(lastResult.headers) &&
        Array.isArray(lastResult.rows);

      if (!hasRenderedData) {
        root.innerHTML =
          '<div class="box"><div class="empty">' +
          (forceRefresh
            ? "Получение актуальной статистики из Google Таблицы..."
            : "Загрузка актуальной статистики...") +
          '</div></div>';
      } else if (forceRefresh) {
        showNormativeResult(
          "Обновление статистики из Google Таблицы…",
          "success"
        );
      }

      return window.BR_API.allStatistics(
        user.token,
        selectedDate
      ).then(function (result) {
        lastResult = result || {};
        renderTable();
      }).catch(function (error) {
        console.error("[BR AdminTools] Ошибка общей статистики:", error);

        if (hasRenderedData) {
          showNormativeResult(
            "Не удалось обновить статистику. Текущие данные оставлены без изменений.",
            "error"
          );
          return;
        }

        lastResult = null;
        lastData = [];
        lastHeaders = [];
        lastNicknameIndex = -1;

        root.innerHTML =
          '<div class="box"><div class="empty">' +
          E(error.message || "Не удалось загрузить актуальную статистику из Google Таблицы.") +
          '</div></div>';
      }).finally(function () {
        if (refresh) {
          refresh.disabled = false;
          refresh.textContent = "↻ Обновить";
        }
      });
    }

    return {
      managementOnly: true,
      title: "Статистика администрации",
      subtitle: "Данные отображаются напрямую из Google Таблицы без локальных подстановок",
      render: function () {
        return '<div class="page-toolbar stats-all-toolbar">' +
          '<div><small>ОБЩАЯ СТАТИСТИКА</small><b>Google Таблица • исходные столбцы и значения</b></div>' +
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
          load(user, true);
        }

        if (date) date.onchange = function () { setDate(date.value); };
        if (prev) prev.onclick = function () { setDate(shiftSelectedDate(-1)); };
        if (next) next.onclick = function () { setDate(shiftSelectedDate(1)); };
        if (today) today.onclick = function () { setDate(dateIso(0)); };

        if (refresh) {
          refresh.onclick = function () {
            load(user, true);
          };
        }
      },
      load: load
    };
  }

  function gameActivity(user) {
    var refreshTimer = null;

    function stateLabel(state) {
      return state === "in_game" ? "В игре" : "Не в игре";
    }

    function stateClass(state) {
      return state === "in_game" ? "badge-green" : "badge-gray";
    }

    function eventLabel(state) {
      return state === "in_game" ? "Вошёл в игру" : "Вышел из игры";
    }

    function showToast(message, type) {
      var old = document.getElementById("brGameActivityToast");
      if (old) old.remove();

      var toast = document.createElement("div");
      toast.id = "brGameActivityToast";
      toast.className =
        "br-game-activity-toast " +
        (type === "success" ? "is-success" : "is-error");

      toast.innerHTML =
        '<span class="br-game-activity-toast-icon">' +
        (type === "success" ? "✓" : "!") +
        '</span><span>' +
        E(String(message || "")) +
        '</span>';

      document.body.appendChild(toast);

      window.requestAnimationFrame(function () {
        toast.classList.add("is-visible");
      });

      window.setTimeout(function () {
        toast.classList.remove("is-visible");
        window.setTimeout(function () {
          if (toast.parentNode) toast.remove();
        }, 220);
      }, type === "success" ? 3500 : 5000);
    }

    function render(root, mine, control, keepContent) {
      var mineState =
        mine && mine.state === "in_game"
          ? "in_game"
          : "out_game";

      var lastEvent =
        mine && mine.last_event
          ? mine.last_event
          : null;

      var summary =
        control && control.summary
          ? control.summary
          : {
              in_game: 0,
              total_active: 0,
              out_game: 0
            };

      var current =
        control && Array.isArray(control.current)
          ? control.current
          : [];

      var recent =
        control && Array.isArray(control.recent)
          ? control.recent
          : [];

      var currentRows = current.map(function (item) {
        var state =
          item && item.state === "in_game"
            ? "in_game"
            : "out_game";

        return (
          '<tr>' +
            '<td><b>' + E(item && item.nickname || "—") + '</b></td>' +
            '<td>' + E(item && item.position || "—") + '</td>' +
            '<td><span class="badge ' +
              stateClass(state) +
            '">' +
              E(stateLabel(state)) +
            '</span></td>' +
            '<td>' +
              E(item && item.last_event_at ? formatDateTime(item.last_event_at) : "—") +
            '</td>' +
          '</tr>'
        );
      }).join("");

      if (!currentRows) {
        currentRows =
          '<tr><td colspan="4" class="table-empty">Других активных пользователей нет.</td></tr>';
      }

      var recentRows = recent.map(function (item) {
        var state =
          item && item.status === "in_game"
            ? "in_game"
            : "out_game";

        return (
          '<tr>' +
            '<td>' +
              E(item && item.event_at ? formatDateTime(item.event_at) : "—") +
            '</td>' +
            '<td><b>' + E(item && item.nickname || "—") + '</b></td>' +
            '<td><span class="badge ' +
              stateClass(state) +
            '">' +
              E(eventLabel(state)) +
            '</span></td>' +
          '</tr>'
        );
      }).join("");

      if (!recentRows) {
        recentRows =
          '<tr><td colspan="3" class="table-empty">Событий пока нет.</td></tr>';
      }

      var html =
        '<div class="game-activity-grid">' +
          '<section class="box game-activity-card">' +
            '<div class="game-activity-head">' +
              '<div><small>ИГРОВОЙ СТАТУС</small><h2>Ваш статус в игре</h2></div>' +
              '<span class="badge ' +
                stateClass(mineState) +
              '">' +
                E(stateLabel(mineState)) +
              '</span>' +
            '</div>' +
            '<div class="game-activity-current">' +
              '<div class="game-activity-current-icon">' +
                (mineState === "in_game" ? "●" : "○") +
              '</div>' +
              '<div><strong>' +
                E(stateLabel(mineState)) +
                '</strong><span>' +
                (
                  lastEvent && lastEvent.event_at
                    ? "Последнее изменение: " + E(formatDateTime(lastEvent.event_at))
                    : "Вы ещё не отмечали вход или выход"
                ) +
              '</span></div>' +
            '</div>' +
            '<div class="game-activity-buttons">' +
              '<button class="button button-primary" id="gameEnterButton" type="button"' +
                (mineState === "in_game" ? " disabled" : "") +
                '>Вошёл в игру</button>' +
              '<button class="button button-secondary" id="gameExitButton" type="button"' +
                (mineState !== "in_game" ? " disabled" : "") +
                '>Вышел из игры</button>' +
            '</div>' +
            '<div class="game-activity-note">Нажмите кнопку только при фактическом входе или выходе из игры. Событие сохраняется в журнале.</div>' +
          '</section>' +

          '<div class="game-control-grid">' +
            '<div class="box game-online-card">' +
              '<small>СЕЙЧАС В ИГРЕ</small>' +
              '<strong>' + E(String(summary.in_game == null ? 0 : summary.in_game)) + '</strong>' +
              '<span>из ' + E(String(summary.total_active == null ? 0 : summary.total_active)) + ' остальных активных пользователей</span>' +
            '</div>' +
            '<div class="box game-online-card">' +
              '<small>НЕ В ИГРЕ</small>' +
              '<strong>' + E(String(summary.out_game == null ? 0 : summary.out_game)) + '</strong>' +
              '<span>последний зафиксированный статус</span>' +
            '</div>' +
            '<div class="box game-online-card">' +
              '<small>ПОСЛЕДНЕЕ ОБНОВЛЕНИЕ</small>' +
              '<strong>' + E(new Date().toLocaleTimeString("ru-RU", {hour:"2-digit",minute:"2-digit",second:"2-digit"})) + '</strong>' +
              '<span>данные из Supabase</span>' +
            '</div>' +
          '</div>' +

          '<div class="page-toolbar game-control-toolbar">' +
            '<div><small>КОНТРОЛЬ</small><b>Кто сейчас в игре</b></div>' +
            '<button class="button button-secondary" id="gameActivityRefresh" type="button">↻ Обновить</button>' +
          '</div>' +

          '<div class="box table-box game-activity-table-box">' +
            '<table class="game-activity-table"><thead><tr>' +
              '<th>Никнейм</th><th>Должность</th><th>Статус</th><th>Последнее изменение</th>' +
            '</tr></thead><tbody>' +
              currentRows +
            '</tbody></table>' +
          '</div>' +

          '<div class="page-toolbar game-control-toolbar">' +
            '<div><small>ЖУРНАЛ</small><b>Последние входы и выходы</b></div>' +
          '</div>' +

          '<div class="box table-box game-activity-table-box">' +
            '<table class="game-activity-table"><thead><tr>' +
              '<th>Время</th><th>Никнейм</th><th>Событие</th>' +
            '</tr></thead><tbody>' +
              recentRows +
            '</tbody></table>' +
          '</div>' +
        '</div>';

      if (!keepContent) {
        root.innerHTML = html;
      } else {
        root.innerHTML = html;
      }

      var state = mineState;

      function setButtons(disabled) {
        var enter = document.getElementById("gameEnterButton");
        var exit = document.getElementById("gameExitButton");

        if (enter) {
          enter.disabled = disabled || state === "in_game";
          enter.textContent = disabled ? "Сохранение…" : "Вошёл в игру";
        }

        if (exit) {
          exit.disabled = disabled || state !== "in_game";
          exit.textContent = disabled ? "Сохранение…" : "Вышел из игры";
        }
      }

      function setState(nextState) {
        setButtons(true);

        window.BR_API.gamePresenceSet(user.token, nextState)
          .then(function (result) {
            state =
              result && result.state
                ? result.state
                : nextState;

            showToast(
              "✅ " + eventLabel(state) + ". Статус сохранён.",
              "success"
            );

            return Promise.all([
              window.BR_API.gamePresenceMine(user.token),
              window.BR_API.gamePresenceControl(user.token, 200)
            ]);
          })
          .then(function (result) {
            render(
              root,
              result[0],
              result[1],
              false
            );
          })
          .catch(function (error) {
            showToast(
              error && error.message
                ? error.message
                : "Не удалось сохранить игровой статус.",
              "error"
            );
            setButtons(false);
          });
      }

      var enter = document.getElementById("gameEnterButton");
      var exit = document.getElementById("gameExitButton");

      if (enter) {
        enter.onclick = function () {
          setState("in_game");
        };
      }

      if (exit) {
        exit.onclick = function () {
          setState("out_game");
        };
      }

      var refresh = document.getElementById("gameActivityRefresh");
      if (refresh) {
        refresh.onclick = function () {
          load(root, false);
        };
      }
    }

    function load(root, silent) {
      if (!silent) {
        root.innerHTML =
          '<div class="box"><div class="empty">Загрузка контроля онлайна...</div></div>';
      }

      Promise.all([
        window.BR_API.gamePresenceMine(user.token),
        window.BR_API.gamePresenceControl(user.token, 200)
      ])
        .then(function (result) {
          render(root, result[0], result[1], silent);
        })
        .catch(function (error) {
          if (silent && root.innerHTML) {
            showToast(
              error && error.message
                ? error.message
                : "Не удалось обновить контроль онлайна.",
              "error"
            );
            return;
          }

          root.innerHTML =
            '<div class="box"><div class="empty">' +
              E(error && error.message
                ? error.message
                : "Не удалось загрузить контроль онлайна.") +
            '</div></div>';
        });
    }

    return {
      title: "Вход и контроль игры",
      subtitle: "Отметьте свой вход или выход и смотрите статус всех остальных пользователей с активным доступом",
      render: function () {
        return (
          '<div id="gameActivityRoot">' +
            '<div class="box"><div class="empty">Загрузка...</div></div>' +
          '</div>'
        );
      },
      bind: function () {
        var root = document.getElementById("gameActivityRoot");
        if (!root) return;

        if (refreshTimer) {
          window.clearInterval(refreshTimer);
          refreshTimer = null;
        }

        load(root, false);

        refreshTimer = window.setInterval(function () {
          var currentRoot = document.getElementById("gameActivityRoot");
          if (!currentRoot) return;
          load(currentRoot, true);
        }, 30000);
      }
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

  function requestStatusBadge(status) {
    var map = {
      pending: ["На рассмотрении", "badge-yellow"],
      approved: ["Одобрено", "badge-green"],
      rejected: ["Отклонено", "badge-red"]
    };
    var value = map[String(status || "").toLowerCase()] || ["Неизвестно", ""];
    return '<span class="badge ' + value[1] + '">' + E(value[0]) + '</span>';
  }

  function inactiveTypeLabel(value) {
    return String(value || "").toLowerCase() === "group"
      ? "Групповой"
      : "Одиночный";
  }

  function inactiveRequestPeriod(item) {
    var start = String(item && item.start_date || "");
    var end = String(item && item.end_date || "");
    if (!start) return "—";
    return start === end ? formatDateNumeric(start) : (
      formatDateNumeric(start) + " — " + formatDateNumeric(end)
    );
  }

  function requests(user) {
    var inactiveList = [];

    function renderInactiveRows() {
      var body = document.getElementById("inactiveRequestsMineRoot");
      if (!body) return;

      if (!inactiveList.length) {
        body.innerHTML = '<div class="box"><div class="empty">Заявок на неактив пока нет.</div></div>';
        return;
      }

      var rows = inactiveList.map(function (item) {
        return '<tr>' +
          '<td>' + E(inactiveTypeLabel(item.inactive_type)) + '</td>' +
          '<td>' + E(inactiveRequestPeriod(item)) + '</td>' +
          '<td>' + requestStatusBadge(item.status) + '</td>' +
          '<td>' + E(item.reason || "—") + '</td>' +
          '<td>' + E(item.review_comment || "—") + '</td>' +
        '</tr>';
      }).join("");

      body.innerHTML =
        '<div class="box table-box">' +
          '<table>' +
            '<thead><tr><th>Тип</th><th>Период</th><th>Статус</th><th>Причина</th><th>Комментарий руководства</th></tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>';
    }

    function loadInactiveRequests() {
      return window.BR_API.inactiveRequestsMine(user.token).then(function (result) {
        inactiveList = Array.isArray(result && result.requests)
          ? result.requests
          : [];
        renderInactiveRows();
      }).catch(function (error) {
        var body = document.getElementById("inactiveRequestsMineRoot");
        if (body) {
          body.innerHTML = '<div class="box"><div class="empty">' +
            E(error.message || "Не удалось загрузить заявки на неактив.") +
            '</div></div>';
        }
      });
    }

    function syncInactiveFields() {
      var type = document.getElementById("requestType");
      var fields = document.getElementById("inactiveRequestFields");
      var generic = document.getElementById("genericRequestFields");
      var inactive = type && type.value === "Неактив";
      var requestText = document.getElementById("requestText");

      if (fields) fields.hidden = !inactive;
      if (generic) generic.hidden = inactive;
      if (requestText) requestText.required = !inactive;

      var inactiveType = document.getElementById("inactiveRequestType");
      var endField = document.getElementById("inactiveEndField");

      if (inactiveType && endField) {
        endField.hidden = inactiveType.value !== "group";
      }

      var start = document.getElementById("inactiveStartDate");
      var end = document.getElementById("inactiveEndDate");

      if (start && end && (!end.value || end.value < start.value)) {
        end.value = start.value;
      }
    }

    return {
      title: "Мои обращения",
      subtitle: "Заявки руководству",
      render: function () {
        return '<div class="box">' +
          '<form id="requestForm">' +
            '<div class="form-grid">' +
              '<div class="form-field form-full"><label>Тип обращения</label>' +
                '<select id="requestType" class="form-select">' +
                  '<option>Вопрос</option>' +
                  '<option value="Неактив">Неактив</option>' +
                  '<option>Жалоба</option>' +
                  '<option>Предложение</option>' +
                '</select>' +
              '</div>' +

              '<div id="genericRequestFields" class="form-field form-full">' +
                '<label>Текст</label>' +
                '<textarea id="requestText" class="form-textarea" required placeholder="Опишите обращение"></textarea>' +
              '</div>' +

              '<div id="inactiveRequestFields" class="form-field form-full" hidden>' +
                '<div class="form-grid">' +
                  '<div class="form-field"><label>Тип неактива</label>' +
                    '<select id="inactiveRequestType" class="form-select">' +
                      '<option value="single">Одиночный — 1 день</option>' +
                      '<option value="group">Групповой — несколько дней</option>' +
                    '</select>' +
                  '</div>' +
                  '<div class="form-field"><label>Дата начала</label><input id="inactiveStartDate" class="form-input" type="date" value="' + dateIso(0) + '" required></div>' +
                  '<div id="inactiveEndField" class="form-field" hidden><label>Дата окончания</label><input id="inactiveEndDate" class="form-input" type="date" value="' + dateIso(0) + '"></div>' +
                  '<div class="form-field form-full"><label>Причина</label><textarea id="inactiveReason" class="form-textarea" placeholder="Почему нужен неактив"></textarea></div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="form-actions"><button class="button button-primary" type="submit">Отправить обращение</button></div>' +
          '</form>' +
        '</div>' +
        '<div class="page-toolbar"><div><small>НЕАКТИВЫ</small><b>Мои заявки на неактив</b></div></div>' +
        '<div id="inactiveRequestsMineRoot"><div class="box"><div class="empty">Загрузка заявок...</div></div></div>' +
        '<div class="box table-box spaced-box">' +
          '<table><thead><tr><th>Тип</th><th>Дата</th><th>Статус</th><th>Текст</th></tr></thead>' +
          '<tbody><tr><td colspan="4">Обычные обращения доступны в этом разделе и сохраняются отдельно.</td></tr></tbody></table>' +
        '</div>';
      },
      bind: function () {
        var form = document.getElementById("requestForm");
        var type = document.getElementById("requestType");
        var inactiveType = document.getElementById("inactiveRequestType");
        var start = document.getElementById("inactiveStartDate");
        var end = document.getElementById("inactiveEndDate");

        if (type) type.onchange = syncInactiveFields;
        if (inactiveType) inactiveType.onchange = syncInactiveFields;

        if (start) start.onchange = function () {
          if (inactiveType && inactiveType.value === "single") {
            if (end) end.value = start.value;
          } else if (end && (!end.value || end.value < start.value)) {
            end.value = start.value;
          }
        };

        syncInactiveFields();

        if (form) {
          form.onsubmit = async function (event) {
            event.preventDefault();

            var button = form.querySelector("button[type=submit]");
            if (button) {
              button.disabled = true;
              button.textContent = "Отправка…";
            }

            try {
              if (type && type.value === "Неактив") {
                var requestType = inactiveType ? inactiveType.value : "single";
                var startDate = start ? start.value : "";
                var endDate = requestType === "single"
                  ? startDate
                  : (end ? end.value : "");

                if (!startDate || !endDate) {
                  throw new Error("Укажите даты неактива.");
                }

                if (requestType === "group" && endDate < startDate) {
                  throw new Error("Дата окончания не может быть раньше даты начала.");
                }

                await window.BR_API.inactiveRequestCreate(
                  user.token,
                  requestType,
                  startDate,
                  endDate,
                  document.getElementById("inactiveReason").value.trim()
                );

                alert("Заявка на неактив отправлена руководству.");
                form.reset();

                if (start) start.value = dateIso(0);
                if (end) end.value = dateIso(0);

                syncInactiveFields();
                await loadInactiveRequests();
                return;
              }

              var list = localList("br_requests");
              list.unshift({
                nickname: user.nickname,
                type: type ? type.value : "Вопрос",
                date: new Date().toLocaleDateString("ru-RU"),
                status: "На рассмотрении",
                text: document.getElementById("requestText").value.trim()
              });

              save("br_requests", list.slice(0, 200));
              form.reset();
              syncInactiveFields();
              alert("Обращение отправлено.");
            } catch (error) {
              alert(error.message || "Не удалось отправить обращение.");
            } finally {
              if (button) {
                button.disabled = false;
                button.textContent = "Отправить обращение";
              }
            }
          };
        }

        loadInactiveRequests();
      }
    };
  }

  function requestsAll() {
    var list = [];
    var currentStatus = "";

    function render() {
      var root = document.getElementById("inactiveRequestsAllRoot");
      if (!root) return;

      var filtered = currentStatus
        ? list.filter(function (item) { return item.status === currentStatus; })
        : list.slice();

      if (!filtered.length) {
        root.innerHTML = '<div class="box"><div class="empty">Заявок по выбранному фильтру нет.</div></div>';
        return;
      }

      var rows = filtered.map(function (item) {
        var actions = item.status === "pending"
          ? '<div class="form-actions">' +
              '<button class="small-button" data-inactive-approve="' + E(item.id) + '">Одобрить</button>' +
              '<button class="small-button" data-inactive-reject="' + E(item.id) + '">Отклонить</button>' +
            '</div>'
          : '<span class="muted">' +
              (item.reviewed_at ? E(formatDateTime(item.reviewed_at)) : "Рассмотрено") +
            '</span>';

        return '<tr>' +
          '<td>' + E(item.nickname) + '</td>' +
          '<td>' + E(inactiveTypeLabel(item.inactive_type)) + '</td>' +
          '<td>' + E(inactiveRequestPeriod(item)) + '</td>' +
          '<td>' + E(item.reason || "—") + '</td>' +
          '<td>' + requestStatusBadge(item.status) + '</td>' +
          '<td>' + E(item.review_comment || "—") + '</td>' +
          '<td>' + actions + '</td>' +
        '</tr>';
      }).join("");

      root.innerHTML =
        '<div class="box table-box">' +
          '<table>' +
            '<thead><tr><th>Никнейм</th><th>Тип</th><th>Период</th><th>Причина</th><th>Статус</th><th>Комментарий</th><th>Действие</th></tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>';

      Array.from(root.querySelectorAll("[data-inactive-approve]")).forEach(function (button) {
        button.onclick = function () {
          review(Number(button.getAttribute("data-inactive-approve")), "approved");
        };
      });

      Array.from(root.querySelectorAll("[data-inactive-reject]")).forEach(function (button) {
        button.onclick = function () {
          review(Number(button.getAttribute("data-inactive-reject")), "rejected");
        };
      });
    }

    async function review(id, status) {
      var comment = "";

      if (status === "rejected") {
        comment = window.prompt("Причина отказа (необязательно):", "") || "";
      } else {
        var confirmText = window.confirm(
          "Одобрить этот неактив? После одобрения период будет сохранён и учтён системой."
        );
        if (!confirmText) return;
      }

      var button = document.querySelector(
        '[data-inactive-' + (status === "approved" ? "approve" : "reject") + '="' + id + '"]'
      );

      if (button) button.disabled = true;

      try {
        await window.BR_API.inactiveRequestReview(
          window.BRApp.getSession().user.token,
          id,
          status,
          comment
        );

        alert(status === "approved" ? "Неактив одобрен." : "Заявка отклонена.");
        await load();
      } catch (error) {
        alert(error.message || "Не удалось обработать заявку.");
        if (button) button.disabled = false;
      }
    }

    async function load() {
      var root = document.getElementById("inactiveRequestsAllRoot");
      if (root && !list.length) {
        root.innerHTML = '<div class="box"><div class="empty">Загрузка заявок...</div></div>';
      }

      try {
        var result = await window.BR_API.inactiveRequestsAll(
          window.BRApp.getSession().user.token,
          ""
        );

        list = Array.isArray(result && result.requests)
          ? result.requests
          : [];

        render();
      } catch (error) {
        if (root) {
          root.innerHTML = '<div class="box"><div class="empty">' +
            E(error.message || "Не удалось загрузить заявки.") +
            '</div></div>';
        }
      }
    }

    return {
      managementOnly: true,
      title: "Обращения администрации",
      subtitle: "Заявки на неактив от состава",
      render: function () {
        return '<div class="page-toolbar">' +
          '<div><small>ЗАЯВКИ</small><b>Неактивы</b></div>' +
          '<div class="stats-toolbar-actions">' +
            '<button class="small-button" id="inactiveFilterAll" type="button">Все</button>' +
            '<button class="small-button" id="inactiveFilterPending" type="button">На рассмотрении</button>' +
            '<button class="small-button" id="inactiveFilterApproved" type="button">Одобрены</button>' +
            '<button class="small-button" id="inactiveFilterRejected" type="button">Отклонены</button>' +
          '</div>' +
        '</div>' +
        '<div id="inactiveRequestsAllRoot"><div class="box"><div class="empty">Загрузка заявок...</div></div></div>';
      },
      bind: function () {
        var all = document.getElementById("inactiveFilterAll");
        var pending = document.getElementById("inactiveFilterPending");
        var approved = document.getElementById("inactiveFilterApproved");
        var rejected = document.getElementById("inactiveFilterRejected");

        if (all) all.onclick = function () { currentStatus = ""; render(); };
        if (pending) pending.onclick = function () { currentStatus = "pending"; render(); };
        if (approved) approved.onclick = function () { currentStatus = "approved"; render(); };
        if (rejected) rejected.onclick = function () { currentStatus = "rejected"; render(); };

        load();
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
        console.error(
          "[BR AdminTools] Ошибка открытия норматива:",
          error
        );
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
            ? result.candidates.filter(function (nickname) {
                return !!String(nickname == null ? "" : nickname).trim() &&
                  !isAdminCategoryLabel(nickname);
              })
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
    "game-activity": gameActivity,
    rules: rules,
    access: access,
    settings: settings
  };

  function bootPage() {
    var page = document.body.getAttribute("data-page") || "dashboard";
    var builder = pages[page] || dashboard;
    var session = window.BRApp.getSession();

    if (!session || !session.user) {
      window.BRApp.clearSession();
      location.replace(new URL("../index.html", location.href).href);
      return;
    }

    var config = builder(session.user);
    config.active = page;
    window.BRApp.init(config);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootPage, { once: true });
  } else {
    bootPage();
  }
})();
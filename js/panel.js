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


  function cacheSkeleton(lines) {
    var count = Math.max(4, Math.min(10, Number(lines) || 6));
    var bars = [];
    for (var i = 0; i < count; i += 1) bars.push('<i class="cache-skeleton-line' + (i % 4 === 0 ? ' is-wide' : i % 4 === 1 ? ' is-medium' : '') + '" aria-hidden="true"></i>');
    return '<div class="box cache-skeleton" role="status" aria-label="Загрузка данных"><span class="sr-only">Загрузка данных</span>' + bars.join('') + '</div>';
  }

  function cachedPageLoad(user, key, fetcher, render, opts) {
    opts = opts || {};
    var storageKey = "br_cache_v1:" + user.id + ":" + key;
    var saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(storageKey) || "null"); } catch (_) {}
    var valid = !!(saved && typeof saved.t === "number" && saved.data != null);
    var old = valid ? saved.data : null;
    var root = document.getElementById(opts.root);
    var refresh = opts.refreshId ? document.getElementById(opts.refreshId) : null;
    var force = !!opts.force;
    function isCurrent() { return typeof opts.isCurrent !== "function" || opts.isCurrent(); }
    function stamp(t) {
      if (!opts.stampId) return;
      var label = document.getElementById(opts.stampId);
      if (!label) return;
      label.setAttribute("data-cache-timestamp", String(t));
      label.title = new Date(t).toLocaleString("ru-RU");
      label.textContent = "Обновлено " + Math.max(0, Math.floor((Date.now() - t) / 60000)) + " мин назад";
      if (!window.__brCacheStampTimer) {
        window.__brCacheStampTimer = window.setInterval(function () {
          document.querySelectorAll("[data-cache-timestamp]").forEach(function (item) {
            var savedAt = Number(item.getAttribute("data-cache-timestamp"));
            if (Number.isFinite(savedAt)) item.textContent = "Обновлено " + Math.max(0, Math.floor((Date.now() - savedAt) / 60000)) + " мин назад";
          });
        }, 60000);
      }
    }
    if (valid) {
      if (!force && isCurrent()) render(old);
      stamp(saved.t);
    } else if (root && isCurrent()) {
      root.innerHTML = cacheSkeleton(opts.skeletonLines || 6);
    }
    if (valid && !force && Date.now() - saved.t < 300000) return Promise.resolve(old);
    if (force && refresh) {
      refresh.disabled = true;
      refresh.textContent = "Обновление…";
    }
    return Promise.resolve().then(fetcher).then(function (data) {
      var changed = !valid || JSON.stringify(data) !== JSON.stringify(old);
      if (changed && isCurrent()) render(data);
      try { sessionStorage.setItem(storageKey, JSON.stringify({t:Date.now(),data:data})); } catch (_) {}
      if (isCurrent()) stamp(Date.now());
      return data;
    }).catch(function (error) {
      if (valid) {
        if (isCurrent()) stamp(saved.t);
        if (typeof opts.onError === "function") opts.onError(error, true);
        return old;
      }
      if (root && isCurrent()) {
        if (typeof opts.onError === "function") opts.onError(error, false);
        else root.innerHTML = '<div class="box"><div class="empty">' + E(error && error.message ? error.message : "Не удалось загрузить данные.") + '</div></div>';
      }
      if (opts.throwOnError) throw error;
      return null;
    }).finally(function () {
      if (force && refresh) { refresh.disabled = false; refresh.textContent = opts.refreshLabel || "↻ Обновить"; }
    });
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
    "Главный администратор",
    "Основной заместитель главного администратора",
    "Заместитель главного администратора",
    "Ст. След. за АП",
    "Куратор администрации",
    "Заместитель Куратора администрации",
    "Куратор агентов поддержки",
    "Заместитель Куратора агентов поддержки",
    "Куратор организаций",
    "Заместитель Куратора организаций",
    "Старший администратор",
    "Старший следящий",
    "Администратор",
    "Старший модератор",
    "Модератор",
    "Следящий",
    "Младший модератор"
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
    if (!data.count) return '<div class="box"><div class="empty">Нет данных для отображения.</div></div>';
    function formatGoogleCellValue(_header, value) {
      return value == null ? "" : String(value);
    }

    var rows = data.headers.map(function (header, index) {
      var value = formatGoogleCellValue(header, data.raw[index]);
      return '<tr><td>' + E(header || "Без названия") + '</td><td>' + E(value) + '</td></tr>';
    }).join("");

    var mobileRows = data.headers.map(function (header, index) {
      var value = formatGoogleCellValue(header, data.raw[index]);
      return '<div class="mobile-data-card">' +
        '<div class="mobile-data-label">' + E(header || "Без названия") + '</div>' +
        '<div class="mobile-data-value">' + E(value) + '</div>' +
      '</div>';
    }).join("");

    return '<div class="page-toolbar"><div><b>' + E(caption || "Данные профиля") + '</b></div></div>' +
      '<div class="box table-box google-row-desktop"><table class="google-row-table"><thead><tr><th>Показатель</th><th>Значение</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
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
            '<a class="dashboard-action" href="../pages/access.html"><b>Выдать доступ</b><span>Управление доступом к панели</span></a>' +
            '<a class="dashboard-action" href="../pages/notifications.html"><b>Уведомления</b><svg class="dashboard-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V11h4v9M10 20V4h4v16M16 20v-7h4v7M3 20h18"/></svg><span>Новости и сообщения</span></a>' +
            '<a class="dashboard-action" href="../pages/requests-all.html"><b>Обращения</b><span>Контроль обращений</span></a>'
          : '<a class="dashboard-action" href="../pages/profile.html"><b>Мой профиль</b><svg class="dashboard-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>Данные аккаунта</span></a>' +
            '<a class="dashboard-action" href="../pages/requests.html"><b>Мои обращения</b><svg class="dashboard-action-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="m8 12 3 3 5-6"/></svg><span>Связь с руководством</span></a>' +
            '<a class="dashboard-action" href="../pages/normatives.html"><b>Нормативы</b><svg class="dashboard-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span>Подача и просмотр</span></a>' + '<a class="dashboard-action" href="../pages/notifications.html"><b>Уведомления</b><svg class="dashboard-action-icon" viewBox="0 0 24 24" aria-hidden="true">undefined</svg><span>Новости и сообщения</span></a>';

        var managementNotice = user.role === "management"
          ? '<details class="box dashboard-performance" style="margin-top:14px;padding:16px 18px;line-height:1.6">' +
              '<summary>От чего зависит скорость работы</summary>' +
              '<p style="margin:0 0 8px">Скорость ответа зависит от качества интернет-соединения пользователя, загрузки устройства и браузера, состояния серверной базы данных и внешних сервисов.</p>' +
              '<p style="margin:0 0 8px">При отправке нормативов время зависит также от количества и размера изображений. Нестабильный интернет и большие файлы могут замедлить загрузку.</p>' +
              '<p style="margin:0 0 8px">Если запрос долго выполняется, дождитесь сообщения о результате. Не отправляйте ту же форму повторно сразу: операция могла сохраниться, даже если ответ не успел прийти. После этого обновите список или проверьте, появилась ли запись.</p>' +
              '<p style="margin:0">При повторяющихся задержках запишите время, раздел панели и действие, при котором возникла проблема, и передайте сведения ответственному за сайт.</p>' +
            '</details>'
          : '';

        return '<div id="serverRoot"><div class="box"><div class="empty">Загрузка статистики сервера...</div></div></div>' +
          '<div class="dashboard-grid">' +
            '<div class="box dashboard-account card-ok">' +
              '<div class="dashboard-section-head"><div><small>ВАШ АККАУНТ</small><h2>' + E(user.nickname) + '</h2></div>' +
              '<span class="badge badge-green">✓ Активен</span></div>' +
              '<div class="dashboard-account-grid">' +
                '<div><small>ДОЛЖНОСТЬ</small><b>' + E(user.position || "—") + '</b></div>' +
                '<div><small>РОЛЬ</small><b>' + E(user.role === "management" ? "Руководство" : "Администратор") + '</b></div>' +
                '<div><small>ПОСЛЕДНИЙ ВХОД</small><b>' + E(user.last_login_at ? formatDateTime(user.last_login_at) : "—") + '</b></div>' +
                '<div class="dashboard-normative-today"><small>НОРМАТИВ СЕГОДНЯ</small><b id="dashboardNormativeToday"><span class="badge badge-yellow">Проверяем…</span></b></div>' +
              '</div>' +
            '</div>' +
            '<div class="box dashboard-links">' +
              '<div class="dashboard-section-head"><div><small>БЫСТРЫЙ ДОСТУП</small><h2>Разделы панели</h2></div></div>' +
              '<div class="dashboard-actions">' + quickLinks + '</div>' +
            '</div>' +
          '</div>' + managementNotice;
      },
      load: async function () {
        var root = document.getElementById("serverRoot");
        var key = "br_cache_v1:" + user.id + ":serverStats";
        var cached = null;
        try { cached = JSON.parse(sessionStorage.getItem(key) || "null"); } catch (_) {}
        var valid = cached && typeof cached.t === "number" && cached.data != null;
        function renderServer(data, t) {
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
                '<button class="small-button server-refresh" id="serverRefresh" type="button" aria-label="Обновить" title="Обновить">⟳</button>' +
              '</div></div>' +
              '<div class="server-stats-grid">' +
                '<div class="server-stat"><small>ИГРОКИ</small><strong>' + E(online == null ? "—" : String(online) + (max != null ? " / " + max : "")) + '</strong><span>игроков онлайн</span></div>' +
                '<div class="server-stat"><small>ОПЫТ</small><strong>' + E(x2) + '</strong><span>режим опыта</span></div>' +
                '<div class="server-stat"><small>СЕРВЕР</small><strong>№ 53</strong><span>Black Russia</span></div>' +
                '<div class="server-stat server-stat-updated"><small>ОБНОВЛЕНО</small><strong id="serverUpdatedTile">—</strong><span>с последнего обновления</span></div>' +
              '</div>' +
              '<div class="server-updated" id="serverUpdated">Данные обновлены: ' + E(new Date(t).toLocaleTimeString("ru-RU", {hour:"2-digit",minute:"2-digit",second:"2-digit"})) + '</div>' +
            '</div>';

          var refresh = document.getElementById("serverRefresh");
          if (refresh) {
            refresh.onclick = function () {
              loadServer(true);
            };
          }

          var updated = document.getElementById("serverUpdated");
          if (updated) updated.textContent = "Обновлено " + Math.max(0, Math.floor((Date.now() - t) / 60000)) + " мин назад";
        }
        async function loadServer(force) {
          if (valid && !force) renderServer(cached.data, cached.t);
          if (valid && !force && Date.now() - cached.t < 300000) return;
          try {
            var data = await window.BR_API.serverStats(user.token);
            if (!valid || JSON.stringify(data) !== JSON.stringify(cached.data)) renderServer(data, Date.now());
            else {
              var updated = document.getElementById("serverUpdated");
              if (updated) updated.textContent = "Обновлено 0 мин назад";
            }
            cached = {t:Date.now(),data:data}; valid = true;
            try { sessionStorage.setItem(key, JSON.stringify(cached)); } catch (_) {}
          } catch (error) {
            if (valid) return;
            root.innerHTML = '<div class="box dashboard-error"><div class="empty">Не удалось загрузить статистику сервера.</div><div class="dashboard-error-action"><button class="small-button server-refresh" id="serverRefresh" type="button">↻ Повторить</button></div></div>';
            var retry = document.getElementById("serverRefresh");
            if (retry) retry.onclick = function () { loadServer(true); };
          }
        }
        await loadServer(false);
      }
    };
  }





  function profile(user) {
    function renderProfile(result, pageUser) {
      var root = document.getElementById("profileRoot");
      if (!root) return;
      root.innerHTML =
        '<div class="box"><div class="form-grid">' +
          '<div class="form-field"><label>Никнейм аккаунта</label><input class="profile-input" readonly value="' + E(pageUser.nickname) + '"></div>' +
          '<div class="form-field"><label>Роль панели</label><input class="profile-input" readonly value="' + E(pageUser.role === "management" ? "Руководство" : "Администратор") + '"></div>' +
        '</div></div>' +
        googleRowTable(result, "Профиль " + pageUser.nickname);
    }
    function loadProfile(loadUser, forceRefresh) {
      var pageUser = loadUser || user;
      var root = document.getElementById("profileRoot");
      if (!root || !pageUser) return Promise.resolve(null);
      var nickname = String(pageUser.nickname || "").trim();
      return cachedPageLoad(pageUser, "profile:" + nickname.toLowerCase(), function () {
        return window.BR_API.getStatisticsAdmin(pageUser.token, nickname);
      }, function (result) { renderProfile(result, pageUser); }, {
        root: "profileRoot", stampId: "profileUpdated", refreshId: "profileRefresh",
        force: !!forceRefresh, throwOnError: true,
        onError: function (error, hasCache) {
          if (!hasCache && root) {
            root.innerHTML = error && error.code === "STATISTICS_NOT_FOUND"
              ? '<div class="box"><div class="empty">Никнейм «' + E(pageUser.nickname) + '» отсутствует в данных. Профиль не найден.</div></div>'
              : '<div class="box"><div class="empty">' + E(error && error.message ? error.message : "Не удалось загрузить профиль.") + '</div></div>';
          }
        }
      }).catch(function () { return null; });
    }
    return {
      title: "Мой профиль",
      subtitle: "Полные данные из реестра администрации",
      render: function () {
        return '<div class="profile-cache-toolbar"><div class="cache-page-tools"><small id="profileUpdated" class="cache-updated-at muted">Обновлено —</small><button class="button button-secondary" id="profileRefresh" type="button">↻ Обновить</button></div></div>' +
          '<div id="profileRoot">' + cacheSkeleton(6) + '</div>';
      },
      bind: function () {
        var refresh = document.getElementById("profileRefresh");
        if (refresh) refresh.onclick = function () { loadProfile(user, true); };
      },
      load: loadProfile
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
        var nicknameIndex = headers.findIndex(function (h) { return /^(никнейм|ник|nickname|nick|username|логин)$/i.test(String(h || "").trim()); });
        var positionIndex = headers.findIndex(function (h) { return /должност|position/i.test(String(h || "")); });
        var roster = rows.map(function (row, i) { return { row: row, number: rowNumbers[i], nickname: nicknameIndex >= 0 ? String(row[nicknameIndex] || "") : "", position: positionIndex >= 0 ? String(row[positionIndex] || "") : "" }; });
        function rosterRank(item) { var rank = POSITIONS.findIndex(function (p) { return p.toLowerCase() === item.position.trim().toLowerCase(); }); return rank < 0 ? 999 : rank; }
        roster.sort(function (a,b) { return rosterRank(a) - rosterRank(b) || a.nickname.localeCompare(b.nickname, "ru"); });
        rows = roster.map(function (item) { return item.row; });
        rowNumbers = roster.map(function (item) { return item.number; });

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
        root.innerHTML = '<div class="box table-box"><div class="stats-table-head"><div><small>СОСТАВ АДМИНИСТРАЦИИ</small><b>' + E(String(rows.length)) + ' записей</b></div><span class="muted">Актуальные данные</span></div><table id="adminsTable"><thead><tr><th>Строка</th>' + headerCells + '</tr></thead><tbody>' + bodyRows + '</tbody></table></div>';
        var rosterPosition = document.getElementById("adminsPosition");
        var rosterSort = document.getElementById("adminsSort");
        if (rosterPosition) {
          rosterPosition.innerHTML = '<option value="">Все должности</option>' + Array.from(new Set(roster.map(function (item) { return item.position.trim(); }).filter(Boolean))).sort(function (a,b) {
            var ar = POSITIONS.findIndex(function (p) { return p.toLowerCase() === a.toLowerCase(); });
            var br = POSITIONS.findIndex(function (p) { return p.toLowerCase() === b.toLowerCase(); });
            return (ar < 0 ? 999 : ar) - (br < 0 ? 999 : br);
          }).map(function (p) { return '<option value="' + E(p) + '">' + E(p) + '</option>'; }).join('');
        }
        document.querySelectorAll("#adminsTable tbody tr").forEach(function (tr, i) {
          if (roster[i]) {
            tr.dataset.rosterNickname = roster[i].nickname.toLowerCase();
            tr.dataset.rosterPosition = roster[i].position;
            tr.dataset.rosterNumber = String(roster[i].number || "");
          }
        });
        var search = document.getElementById("adminsSearch");
        function filterRoster() {
          var query = search ? search.value.trim().toLowerCase() : "";
          var position = rosterPosition ? rosterPosition.value : "";
          document.querySelectorAll("#adminsTable tbody tr[data-roster-nickname]").forEach(function (tr) {
            tr.style.display = (!query || tr.dataset.rosterNickname.indexOf(query) !== -1) && (!position || tr.dataset.rosterPosition === position) ? "" : "none";
          });
        }
        if (search) search.oninput = filterRoster;
        if (rosterPosition) rosterPosition.onchange = filterRoster;
        if (rosterSort) rosterSort.onchange = function () {
          var mode = this.value, tbody = document.querySelector("#adminsTable tbody");
          var items = Array.from(tbody.querySelectorAll("tr[data-roster-nickname]"));
          items.sort(function (a,b) {
            if (mode === "nickname" || mode === "nickname_desc") {
              var diff = a.dataset.rosterNickname.localeCompare(b.dataset.rosterNickname, "ru");
              return mode === "nickname_desc" ? -diff : diff;
            }
            var ar = POSITIONS.findIndex(function (p) { return p.toLowerCase() === a.dataset.rosterPosition.toLowerCase(); });
            var br = POSITIONS.findIndex(function (p) { return p.toLowerCase() === b.dataset.rosterPosition.toLowerCase(); });
            var diffRank = (ar < 0 ? 999 : ar) - (br < 0 ? 999 : br);
            return (mode === "position_asc" ? -diffRank : diffRank) || a.dataset.rosterNickname.localeCompare(b.dataset.rosterNickname, "ru");
          });
          items.forEach(function (item) { tbody.appendChild(item); });
        };
      } catch (error) {
        root.innerHTML = '<div class="box"><div class="empty">' + E(error.message || "Не удалось загрузить состав администрации.") + '</div></div>';
      }
    }
    return {
      managementOnly: true,
      title: "Состав администрации",
      subtitle: "Полный состав из Google Таблица",
      render: function () {
        return '<div class="page-toolbar admin-list-toolbar"><div><small>СОСТАВ АДМИНИСТРАЦИИ</small><b>Никнеймы, должности и актуальные данные</b></div><div class="admins-actions"><input id="adminsSearch" class="form-input admins-search" type="search" placeholder="Поиск по никнейму"><select id="adminsPosition" class="form-select" aria-label="Фильтр должности"><option value="">Все должности</option></select><select id="adminsSort" class="form-select" aria-label="Сортировка"><option value="position">Должность: старшие сначала</option><option value="position_asc">Должность: младшие сначала</option><option value="nickname">Никнейм: А–Я</option><option value="nickname_desc">Никнейм: Я–А</option></select><button class="button button-secondary" id="adminsRefresh" type="button">↻ Обновить</button></div></div><div class="admins-source-row"><span id="adminsUpdated">Обновлено: —</span></div><div id="adminsRoot"><div class="box"><div class="empty">Загрузка...</div></div></div>';
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
        return '<div id="statsRoot"><div class="box"><div class="empty">Поиск администратора...</div></div></div>';
      },
      load: async function (user) {
        var root = document.getElementById("statsRoot");
        if (!root) return;

        root.innerHTML =
          '<div class="box"><div class="empty">Обновление статистики...</div></div>';

        try {
          var result = await window.BR_API.myStatistics(user.token);
          root.innerHTML =
            '<div class="box"><div class="stats-table-head"><div><small>ЛИЧНАЯ СТАТИСТИКА</small><b>' + E(user.nickname) + '</b></div><span class="muted">Актуальные данные</span></div></div>' +
            googleRowTable(result, "Статистика " + user.nickname);
        } catch (error) {
          if (error.code === "STATISTICS_NOT_FOUND") {
            root.innerHTML = '<div class="box"><div class="empty">Никнейм «' + E(user.nickname) + '» отсутствует в данных. Личная статистика не найдена.</div></div>';
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
    // Раньше стрелки брали dateIso(±1), из-за чего каждый клик
    // перескакивал относительно сегодняшнего дня и пропускал даты.
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
        return "Статус сохранён, но данные не удалось обновить.";
      }

      if (code === "GOOGLE_SCRIPT_TIMEOUT" || code === "STATISTICS_TIMEOUT") {
        return "Статус сохранён, но данные не поступили вовремя. Текущие данные оставлены на экране.";
      }

      if (code === "APPS_SCRIPT_UNAUTHORIZED") {
        return "Статус не удалось подтвердить. Попробуйте ещё раз.";
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

    function normativeDisplayStatus(normatives, nickname) {
      if (!nickname) return "";

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
        "Не сдан": "badge-red", "Не сдана": "badge-red", "На проверке": "badge-yellow"
      };

      return '<span class="badge ' +
        (classes[status] || "") +
        '">' + ({'Норма':'✓ ','На проверке':'⏳ ','Не сдана':'✕ ','Не сдан':'✕ ','Нет нормы':'✕ '}[status] || '') + E(status) + '</span>';
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
        return '<th' + (lastHeaders.indexOf(header) === lastNicknameIndex ? ' class="stats-nickname-sticky"' : '') + '>' + E(header == null ? "" : header) + '</th>';
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
          return '<td data-stat-column="' + columnIndex + '" data-mobile-label="' + E(lastHeaders[columnIndex] || '') + '"' + (columnIndex === lastNicknameIndex ? ' class="stats-nickname-sticky"' : '') + '>' + E(value) + '</td>';
        }).join("");

        var nickname = lastNicknameIndex >= 0
          ? rawCellValue(row[lastNicknameIndex]).trim()
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
          '</td>';

        var actionCell = nickname
          ? '<td class="admin-actions-cell"><button class="admin-edit-inline" type="button" data-edit-row-index="' + displayIndex + '">Изменить</button></td>'
          : '<td class="admin-actions-cell"></td>';

        return sectionRow + '<tr>' + cells + normativeCell + actionCell + '</tr>';
      }).join("");

      if (!rows) {
        rows = '<tr><td colspan="' + (lastHeaders.length + 2) + '" class="table-empty">Нет строк данных.</td></tr>';
      }

      root.innerHTML =
        '<div class="box table-box">' +
          '<div class="stats-table-head"><div>' +
            '<small>СТАТИСТИКА АДМИНИСТРАЦИИ</small>' +
            '<b>' + E(String(displayRecords.length)) + ' сотрудников</b>' +
          '</div><span class="muted">Актуальные данные</span></div>' +
          
          '<table id="allStatsTable"><thead><tr>' +
            headerCells +
            '<th>Норматив</th><th>Действия</th>' +
          '</tr></thead><tbody>' + (rows || '<tr><td colspan="7" class="table-empty">По заданным фильтрам никого не найдено.</td></tr>') + '</tbody></table>' +
        '</div><div id="adminEditModal"></div>';

      // Компактные раскрывающиеся карточки для мобильной версии.
      (function buildMobileStatsCards() {
        var table = document.getElementById("allStatsTable");
        if (!table || !table.tHead || !table.tBodies.length) return;
        var container = table.parentElement;
        var oldCards = container.querySelector(".stats-mobile-list");
        if (oldCards) oldCards.remove();

        var headers = Array.prototype.map.call(table.tHead.rows[0].cells, function (cell) {
          return (cell.textContent || "").trim();
        });
        function norm(value) {
          return String(value || "").trim().toLowerCase().replace(/ё/g, "е").replace(/\\s+/g, " ");
        }
        var compactFields = [
          "возраст", "доступ с пк", "неактивы", "баллы активности",
          "дни на посту", "страйки", "предупреждения", "предупреждение",
          "баллы", "последнее повышение"
        ];
        var fullWidthFields = ["должность", "норматив", "действия"];
        var list = document.createElement("div");
        list.className = "stats-mobile-list";

        Array.prototype.forEach.call(table.tBodies[0].rows, function (row) {
          if (row.classList.contains("stats-section-row")) {
            var section = document.createElement("div");
            section.className = "stats-mobile-section";
            section.textContent = row.textContent.trim();
            list.appendChild(section);
            return;
          }
          var cells = Array.prototype.slice.call(row.cells);
          if (!cells.length || row.querySelector(".table-empty")) return;

          var card = document.createElement("article");
          card.className = "stats-mobile-card is-collapsed";
          var normCell = cells[cells.length - 2];
          var normBadge = normCell && normCell.querySelector(".badge");
          if (normBadge) card.classList.add(normBadge.classList.contains("badge-green") ? "card-ok" : normBadge.classList.contains("badge-yellow") ? "card-wait" : normBadge.classList.contains("badge-red") ? "card-bad" : "");
          var titleIndex = lastNicknameIndex >= 0 ? lastNicknameIndex : 0;
          var title = document.createElement("button");
          title.type = "button";
          title.className = "stats-mobile-card-title";
          title.setAttribute("aria-expanded", "false");
          title.innerHTML = '<span class="stats-mobile-title-text"></span><span class="stats-mobile-chevron" aria-hidden="true">⌄</span>';
          title.querySelector(".stats-mobile-title-text").textContent =
            (cells[titleIndex] && cells[titleIndex].textContent.trim()) || "Сотрудник";
          card.appendChild(title);

          var details = document.createElement("div");
          details.className = "stats-mobile-card-details";
          var positionValue = "";
          var normativeValue = "";
          cells.forEach(function (cell, index) {
            if (index === titleIndex) return;
            var labelText = headers[index] || ("Столбец " + (index + 1));
            cell.setAttribute("data-mobile-label", labelText);
            var labelNorm = norm(labelText);
            var valueText = (cell.textContent || "").trim();
            if (!valueText && !cell.querySelector("button,a,input,select")) return;

            var field = document.createElement("div");
            field.className = "stats-mobile-card-field";
            if (compactFields.indexOf(labelNorm) !== -1) field.classList.add("is-compact");
            if (fullWidthFields.indexOf(labelNorm) !== -1) field.classList.add("is-full");
            if (labelNorm === "должность") positionValue = valueText;
            if (labelNorm === "норматив") normativeValue = valueText;
            var label = document.createElement("span");
            label.className = "stats-mobile-card-label";
            label.textContent = labelText;
            var value = document.createElement("div");
            value.className = "stats-mobile-card-value";
            value.innerHTML = cell.innerHTML;
            field.appendChild(label);
            field.appendChild(value);
            details.appendChild(field);
          });

          // В свернутом состоянии остаются должность и норматив; действия и прочие поля раскрываются.
          card.appendChild(details);
          card.dataset.position = positionValue;
          card.dataset.normative = normativeValue;
          function applyCollapsedSummary() {
            details.querySelectorAll(".stats-mobile-card-field").forEach(function (field) {
              var label = norm(field.querySelector(".stats-mobile-card-label") && field.querySelector(".stats-mobile-card-label").textContent);
              field.hidden = card.classList.contains("is-collapsed") &&
                label !== "должность" && label !== "норматив";
            });
            title.setAttribute("aria-expanded", card.classList.contains("is-collapsed") ? "false" : "true");
            var chevron = title.querySelector(".stats-mobile-chevron");
            if (chevron) chevron.textContent = card.classList.contains("is-collapsed") ? "⌄" : "⌃";
          }
          title.addEventListener("click", function () {
            card.classList.toggle("is-collapsed");
            applyCollapsedSummary();
          });
          applyCollapsedSummary();
          list.appendChild(card);
        });
        container.appendChild(list);
      })();

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

            try {
              if (hasFreshSnapshot) {
                var cacheKey = "br_cache_v1:" + user.id + ":statisticsAll:" + selectedDate;
                try { sessionStorage.setItem(cacheKey, JSON.stringify({t:Date.now(),data:result})); } catch (_) {}
              }
              await load(user, true);
            } catch (refreshError) {
              console.warn("[BR AdminTools] Статус сохранён, но статистику не удалось синхронизировать:", refreshError);
              showNormativeResult("✅ " + (labels[status] || status) + " проставлен для " + nickname + ". Данные на экране не удалось обновить.", "error");
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
              '<div class="admin-edit-title"><small>ДАННЫЕ</small><h2>Редактирование строки</h2><span>Изменяются только существующие столбцы</span></div>' +
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
      var dateInput = document.getElementById("allStatsDate");
      if (!root) return Promise.resolve(null);
      if (dateInput && /^\d{4}-\d{2}-\d{2}$/.test(String(dateInput.value || ""))) selectedDate = String(dateInput.value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(selectedDate || ""))) {
        selectedDate = dateIso(0);
        if (dateInput) dateInput.value = selectedDate;
      }
      var requestedDate = selectedDate;
      var requestedUser = user || window.BRApp.session && window.BRApp.session.user;
      if (!requestedUser) return Promise.resolve(null);
      return cachedPageLoad(requestedUser, "statisticsAll:" + requestedDate, function () {
        return window.BR_API.allStatistics(requestedUser.token, requestedDate);
      }, function (result) {
        lastResult = result || {};
        renderTable();
      }, {
        root: "allStatsRoot", stampId: "allStatsUpdated", refreshId: "allStatsRefresh",
        force: !!forceRefresh, throwOnError: true,
        isCurrent: function () { return selectedDate === requestedDate; },
        onError: function (error, hasCache) {
          if (hasCache) showNormativeResult("Не удалось обновить статистику. Сохранённые данные оставлены на экране.", "error");
          else {
            lastResult = null; lastData = []; lastHeaders = []; lastNicknameIndex = -1;
            if (root) root.innerHTML = '<div class="box"><div class="empty">' + E(error.message || "Не удалось загрузить актуальную статистику из Google Таблицы.") + '</div></div>';
          }
        }
      }).catch(function () { return null; });
    }

    return {
      managementOnly: true,
      title: "Статистика администрации",
      subtitle: "Актуальные данные без локальных подстановок",
      render: function () {
        return '<div class="page-toolbar stats-all-toolbar">' +
          '<div><small>ОБЩАЯ СТАТИСТИКА</small><b>Google Таблица • исходные столбцы и значения</b></div>' +
          '<div class="stats-toolbar-actions">' +
            '<button class="small-button" id="statsDatePrev" type="button">←</button>' +
            '<input id="allStatsDate" class="form-input date-control" type="date" value="' + E(selectedDate) + '">' +
            '<button class="small-button" id="statsDateNext" type="button">→</button>' +
            '<div class="stats-date-actions"><button class="button button-secondary" id="statsDateToday" type="button">Сегодня</button>' +
            '<div class="cache-page-tools"><small id="allStatsUpdated" class="cache-updated-at muted">Обновлено —</small><button class="button button-secondary" id="allStatsRefresh" type="button">↻ Обновить</button></div></div>' +
          '</div>' +
        '</div>' +
        '<div id="allStatsRoot">' + cacheSkeleton(7) + '</div>';
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
          load(user, false);
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
    var isManagement = user && user.role === "management";

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

    function render(root, mine, control) {
      var mineState =
        mine && mine.state === "in_game"
          ? "in_game"
          : "out_game";

      var lastEvent =
        mine && mine.last_event
          ? mine.last_event
          : null;

      var history =
        mine && Array.isArray(mine.history)
          ? mine.history
          : [];

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

      var historyRows = history.map(function (item) {
        var state =
          item && item.status === "in_game"
            ? "in_game"
            : "out_game";

        return (
          '<tr>' +
            '<td>' +
              E(item && item.event_at ? formatDateTime(item.event_at) : "—") +
            '</td>' +
            '<td><span class="badge ' +
              stateClass(state) +
            '">' +
              E(eventLabel(state)) +
            '</span></td>' +
          '</tr>'
        );
      }).join("");

      if (!historyRows) {
        historyRows =
          '<tr><td colspan="2" class="table-empty">История пока пуста.</td></tr>';
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

      var personalHtml =
        '<div class="page-toolbar game-control-toolbar">' +
          '<div><small>МОЯ ИСТОРИЯ</small><b>Входы и выходы</b></div>' +
        '</div>' +
        '<div class="box table-box game-activity-table-box">' +
          '<table class="game-activity-table"><thead><tr>' +
            '<th>Время</th><th>Событие</th>' +
          '</tr></thead><tbody>' +
            historyRows +
          '</tbody></table>' +
        '</div>';

      var managementHtml =
        '<div class="game-control-grid">' +
          '<div class="box game-online-card">' +
            '<small>СЕЙЧАС В ИГРЕ</small>' +
            '<strong>' + E(String(summary.in_game == null ? 0 : summary.in_game)) + '</strong>' +
            '<span>из ' + E(String(summary.total_active == null ? 0 : summary.total_active)) + ' активных пользователей</span>' +
          '</div>' +
          '<div class="box game-online-card">' +
            '<small>НЕ В ИГРЕ</small>' +
            '<strong>' + E(String(summary.out_game == null ? 0 : summary.out_game)) + '</strong>' +
            '<span>последний зафиксированный статус</span>' +
          '</div>' +
          '<div class="box game-online-card">' +
            '<small>ПОСЛЕДНЕЕ ОБНОВЛЕНИЕ</small>' +
            '<strong>' + E(new Date().toLocaleTimeString("ru-RU", {hour:"2-digit",minute:"2-digit",second:"2-digit"})) + '</strong>' +
            '<span>данные системы</span>' +
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
        '</div>';

      var managementStatusCard =
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
        '</section>';

      var personalButtons =
        '<div class="box game-activity-personal-actions">' +
          '<div class="game-activity-buttons">' +
            '<button class="button button-primary" id="gameEnterButton" type="button"' +
              (mineState === "in_game" ? " disabled" : "") +
              '>Вошёл в игру</button>' +
            '<button class="button button-secondary" id="gameExitButton" type="button"' +
              (mineState !== "in_game" ? " disabled" : "") +
              '>Вышел из игры</button>' +
          '</div>' +
        '</div>';

      var html =
        '<div class="game-activity-grid">' +
          (isManagement ? managementStatusCard + managementHtml : personalButtons + personalHtml) +
        '</div>';

      root.innerHTML = html;

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

      function refreshAfterChange() {
        if (isManagement) {
          return Promise.all([
            window.BR_API.gamePresenceMine(user.token),
            window.BR_API.gamePresenceControl(user.token, 200)
          ]);
        }

        return window.BR_API.gamePresenceMine(user.token).then(function (result) {
          return [result, null];
        });
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

            return refreshAfterChange();
          })
          .then(function (result) {
            render(
              root,
              result[0],
              result[1]
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

      var request = isManagement
        ? Promise.all([
            window.BR_API.gamePresenceMine(user.token),
            window.BR_API.gamePresenceControl(user.token, 200)
          ])
        : window.BR_API.gamePresenceMine(user.token).then(function (result) {
            return [result, null];
          });

      request
        .then(function (result) {
          render(root, result[0], result[1]);
        })
        .catch(function (error) {
          if (silent && root.innerHTML) {
            showToast(
              error && error.message
                ? error.message
                : "Не удалось обновить историю входа в игру.",
              "error"
            );
            return;
          }

          root.innerHTML =
            '<div class="box"><div class="empty">' +
              E(error && error.message
                ? error.message
                : "Не удалось загрузить историю входа в игру.") +
            '</div></div>';
        });
    }

    return {
      title: "Вход и контроль игры",
      subtitle: isManagement
        ? "Отметьте свой вход или выход и контролируйте статус остальных пользователей"
        : "Отметьте свой вход или выход и просматривайте только свою историю",
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

        // Загружаем историю только после явного действия пользователя.
        window.addEventListener("br:manual-refresh", function (event) {
          if (!event || !event.detail || event.detail.page !== "game-activity") return;
          load(root, false);
        });
      }
    };
  }



  function notifications(user) {
    function cachedLoad(key, fetcher, render, opts) {
      opts = opts || {};
      var storageKey = "br_cache_v1:" + user.id + ":" + key;
      var saved = null;
      try { saved = JSON.parse(sessionStorage.getItem(storageKey) || "null"); } catch (_) {}
      var valid = saved && typeof saved.t === "number" && saved.data != null;
      var old = valid ? saved.data : null;
      var root = document.getElementById(opts.root);
      function stamp(t) {
        if (!root) return;
        var label = root.querySelector(".cache-updated-at");
        if (!label) {
          label = document.createElement("small");
          label.className = "cache-updated-at muted";
          root.insertBefore(label, root.firstChild);
        }
        label.textContent = "Обновлено " + Math.max(0, Math.floor((Date.now() - t) / 60000)) + " мин назад";
      }
      if (valid && !opts.force) { render(old); stamp(saved.t); }
      if (!valid && root) root.innerHTML = '<div class="box"><div class="empty"><span aria-hidden="true">▰ ▰ ▰</span><span class="sr-only">Загрузка</span></div></div>';
      if (valid && !opts.force && Date.now() - saved.t < 300000) return Promise.resolve(old);
      return Promise.resolve().then(fetcher).then(function (data) {
        if (!valid || JSON.stringify(data) !== JSON.stringify(old)) render(data);
        try { sessionStorage.setItem(storageKey, JSON.stringify({t:Date.now(),data:data})); } catch (_) {}
        stamp(Date.now());
        return data;
      }).catch(function (error) {
        if (!valid && root) root.innerHTML = '<div class="box"><div class="empty">' + E(error.message || "Не удалось загрузить данные.") + '</div></div>';
        return null;
      });
    }
    async function refreshAll(force) {
      var jobs = [loadNotifications(force)];
      if (user.role === "management") jobs.push(loadPushStatusAll(force), loadEvents(force));
      await Promise.all(jobs);
    }
    function targetLabel(value) {
      return {
        all: "Вся администрация",
        admin: "Администраторы",
        management: "Руководство"
      }[value] || value || "—";
    }

    function moscowDateTime(value) {
      if (!value) return "—";
      var date = new Date(value);
      if (!Number.isFinite(date.getTime())) return "—";
      return date.toLocaleString("ru-RU", {
        timeZone: "Europe/Moscow",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    }

    function moscowInputValue(offsetMinutes) {
      var date = new Date(Date.now() + Number(offsetMinutes || 0) * 60000);
      var parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Moscow",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).formatToParts(date);
      var map = {};
      parts.forEach(function (part) {
        map[part.type] = part.value;
      });
      return map.year + "-" + map.month + "-" + map.day + "T" + map.hour + ":" + map.minute;
    }

    function parseMoscowInput(value) {
      var raw = String(value || "").trim();
      if (!raw) return null;
      var date = new Date(raw + ":00+03:00");
      return Number.isFinite(date.getTime()) ? date : null;
    }

    function reminderLabel(value) {
      return {
        1440: "за 24 часа",
        180: "за 3 часа",
        30: "за 30 минут"
      }[Number(value)] || ("за " + value + " мин.");
    }

    return {
      title: "Уведомления",
      subtitle: "Новости, объявления и умные напоминания администрации",
      render: function () {
        var createControls = user.role === "management"
          ? '<div class="page-toolbar">' +
              '<div><small>УПРАВЛЕНИЕ</small><b>Центр уведомлений</b><span class="muted">Мероприятия автоматически напомнят участникам о сборе.</span></div>' +
              '<div class="page-toolbar-actions">' +
                '<button class="button button-secondary" id="openNotificationForm" type="button">＋ Уведомление</button>' +
                '<button class="button button-primary" id="openEventForm" type="button">＋ Создать сбор</button>' +
              '</div>' +
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
            '</div>' +
            '<div id="eventCreateRoot" class="box compact-box notification-create-root event-create-root" hidden>' +
              '<form id="eventForm">' +
                '<div class="form-grid">' +
                  '<div class="form-field"><label>Название сбора</label><input id="eTitle" class="form-input" maxlength="160" required placeholder="Например: Общий сбор администрации"></div>' +
                  '<div class="form-field"><label>Получатели</label><select id="eTarget" class="form-select"><option value="all">Вся администрация</option><option value="admin">Только администраторы</option><option value="management">Только руководство</option></select></div>' +
                  '<div class="form-field form-full"><label>Дата и время (МСК)</label><input id="eAt" class="form-input" type="datetime-local" required></div>' +
                  '<div class="form-field form-full"><label>Задание / описание <span class="muted">необязательно</span></label><textarea id="eText" class="form-textarea" maxlength="5000" placeholder="Что нужно подготовить или сделать на сборе"></textarea></div>' +
                  '<div class="form-field form-full"><label>Напоминания</label>' +
                    '<div class="event-reminder-options">' +
                      '<label class="event-reminder-option"><input id="eReminder24" type="checkbox" value="1440" checked><span>За 24 часа</span></label>' +
                      '<label class="event-reminder-option"><input id="eReminder3" type="checkbox" value="180" checked><span>За 3 часа</span></label>' +
                      '<label class="event-reminder-option"><input id="eReminder30" type="checkbox" value="30" checked><span>За 30 минут</span></label>' +
                    '</div>' +
                    '<span class="field-hint">Напоминание появится в личном кабинете выбранных получателей.</span>' +
                  '</div>' +
                '</div>' +
                '<div class="form-actions">' +
                  '<button class="button button-primary" type="submit">Создать сбор</button>' +
                  '<button class="button button-secondary" id="cancelEvent" type="button">Отмена</button>' +
                '</div>' +
              '</form>' +
            '</div>'
          : '';

        return '<div class="page-toolbar"><div><small>ОБНОВЛЕНИЯ</small><b>Уведомления</b></div><button class="button button-secondary" id="notificationsRefresh" type="button">⟳ Обновить</button></div>' + createControls +
          (user.role === "management"
            ? '<div id="pushStatusRoot" class="push-status-root"><div class="box"><div class="empty">Загрузка статуса push-подписок...</div></div></div>'
            : '') +
          '<div id="notificationsRoot"><div class="box"><div class="empty">Загрузка уведомлений...</div></div></div>' +
          (user.role === "management"
            ? '<div id="eventsRoot" class="events-root"><div class="box"><div class="empty">Загрузка мероприятий...</div></div></div>'
            : '');
      },
      bind: function () {
        var refresh = document.getElementById("notificationsRefresh");
        if (refresh) refresh.onclick = async function () {
          refresh.disabled = true;
          refresh.innerHTML = '<span class="notification-refresh-icon" aria-hidden="true">⟳</span> Обновление…';
          refresh.classList.add("is-loading");
          try { await refreshAll(true); } finally {
            refresh.disabled = false;
            refresh.classList.remove("is-loading");
            refresh.textContent = "⟳ Обновить";
          }
        };
        var open = document.getElementById("openNotificationForm");
        var root = document.getElementById("notificationCreateRoot");
        var cancel = document.getElementById("cancelNotification");
        var form = document.getElementById("notificationForm");

        var openEvent = document.getElementById("openEventForm");
        var eventRoot = document.getElementById("eventCreateRoot");
        var cancelEvent = document.getElementById("cancelEvent");
        var eventForm = document.getElementById("eventForm");
        var eventAt = document.getElementById("eAt");

        if (eventAt) {
          eventAt.min = moscowInputValue(60);
          eventAt.value = moscowInputValue(120);
        }

        if (open && root) {
          open.onclick = function () {
            if (eventRoot) eventRoot.hidden = true;
            root.hidden = false;
            open.hidden = true;
            if (openEvent) openEvent.hidden = false;
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

        if (openEvent && eventRoot) {
          openEvent.onclick = function () {
            if (root) root.hidden = true;
            if (open) open.hidden = false;
            eventRoot.hidden = false;
            openEvent.hidden = true;
            if (eventAt) {
              eventAt.min = moscowInputValue(30);
              if (!eventAt.value) eventAt.value = moscowInputValue(120);
            }
            var title = document.getElementById("eTitle");
            if (title) title.focus();
          };
        }

        if (cancelEvent && eventRoot && openEvent) {
          cancelEvent.onclick = function () {
            eventRoot.hidden = true;
            openEvent.hidden = false;
          };
        }

        if (form) {
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
              await refreshAll(true);
            } catch (e) {
              alert(e.message || "Не удалось опубликовать уведомление.");
            } finally {
              if (submit) {
                submit.disabled = false;
                submit.textContent = "Опубликовать";
              }
            }
          };
        }

        if (eventForm) {
          eventForm.onsubmit = async function (event) {
            event.preventDefault();

            var title = document.getElementById("eTitle").value.trim();
            var text = document.getElementById("eText").value.trim();
            var target = document.getElementById("eTarget").value;
            var parsedEventAt = parseMoscowInput(document.getElementById("eAt").value);
            var reminderOffsets = [];

            ["eReminder24", "eReminder3", "eReminder30"].forEach(function (id) {
              var checkbox = document.getElementById(id);
              if (checkbox && checkbox.checked) reminderOffsets.push(Number(checkbox.value));
            });

            if (!title || !parsedEventAt) {
              alert("Укажите название и корректное время сбора.");
              return;
            }

            if (!reminderOffsets.length) {
              alert("Выберите хотя бы одно напоминание.");
              return;
            }

            var submit = eventForm.querySelector("button[type=submit]");
            if (submit) {
              submit.disabled = true;
              submit.textContent = "Создание…";
            }

            try {
              await window.BR_API.eventCreate(
                user.token,
                title,
                text,
                parsedEventAt.toISOString(),
                target,
                reminderOffsets
              );

              eventForm.reset();
              ["eReminder24", "eReminder3", "eReminder30"].forEach(function (id) {
                var checkbox = document.getElementById(id);
                if (checkbox) checkbox.checked = true;
              });
              if (eventAt) {
                eventAt.min = moscowInputValue(30);
                eventAt.value = moscowInputValue(120);
              }
              if (eventRoot && openEvent) {
                eventRoot.hidden = true;
                openEvent.hidden = false;
              }
              await refreshAll(true);
            } catch (e) {
              alert(e.message || "Не удалось создать сбор.");
            } finally {
              if (submit) {
                submit.disabled = false;
                submit.textContent = "Создать сбор";
              }
            }
          };
        }
      },
      load: async function () { await refreshAll(false); }
    };

    async function loadPushStatusAll(force) {
      var root = document.getElementById("pushStatusRoot");
      if (!root || user.role !== "management") return;

      function renderResult(result) {
        var list = Array.isArray(result.administrators)
          ? result.administrators
          : [];

        var enabled = list.filter(function (item) {
          return !!item.enabled;
        }).length;

        list.sort(function (a, b) {
          var ar = POSITIONS.findIndex(function (p) { return p.toLowerCase() === String(a.position || "").trim().toLowerCase(); });
          var br = POSITIONS.findIndex(function (p) { return p.toLowerCase() === String(b.position || "").trim().toLowerCase(); });
          return (ar < 0 ? 999 : ar) - (br < 0 ? 999 : br) ||
            String(a.nickname || "").localeCompare(String(b.nickname || ""), "ru");
        });

        var rows = list.length
          ? list.map(function (item) {
              var devices = Array.isArray(item.devices)
                ? item.devices.map(function (device) {
                    return device === "phone"
                      ? "Android"
                      : device === "computer"
                        ? "Windows / ПК"
                        : device;
                  })
                : [];

              var status = item.enabled
                ? '<span class="badge badge-green">Включены</span>'
                : '<span class="badge badge-gray">Выключены</span>';

              return '<tr data-push-nickname="' + E(String(item.nickname || "").toLowerCase()) + '" data-push-position="' + E(item.position || "") + '" data-push-enabled="' + (item.enabled ? 'yes' : 'no') + '">' +
                '<td><b>' + E(item.nickname) + '</b></td>' +
                '<td>' + E(item.position || "—") + '</td>' +
                '<td>' + status + '</td>' +
                '<td>' + E(devices.length ? devices.join(" • ") : "—") + '</td>' +
              '</tr>';
            }).join("")
          : '<tr><td colspan="4">Активных аккаунтов нет.</td></tr>';

        root.innerHTML =
          '<div class="page-toolbar push-status-head">' +
            '<div><small>СОСТОЯНИЕ PUSH</small><b>Подписки администрации</b><span class="muted">Подписка хранится отдельно для каждого устройства.</span></div>' +
            '<div class="push-status-head-actions">' +
              '<span class="badge badge-blue">' + E(String(enabled)) + ' из ' + E(String(list.length)) + ' подключили</span>' +
              '<button class="button button-secondary" id="refreshPushStatus" type="button">Обновить</button>' +
            '</div>' +
          '</div>' +
          '<div class="box table-box push-status-table-box">' +
            '<div class="push-roster-filters">' +
              '<input id="pushRosterSearch" class="form-input" type="search" placeholder="Поиск по никнейму" aria-label="Поиск по никнейму">' +
              '<select id="pushRosterPosition" class="form-select" aria-label="Должность"><option value="">Все должности</option>' + Array.from(new Set(list.map(function (item) { return String(item.position || "").trim(); }).filter(Boolean))).map(function (position) { return '<option value="' + E(position) + '">' + E(position) + '</option>'; }).join('') + '</select>' +
              '<select id="pushRosterStatus" class="form-select" aria-label="Push-статус"><option value="">Любой Push-статус</option><option value="yes">Включены</option><option value="no">Выключены</option></select>' +
              '<select id="pushRosterSort" class="form-select" aria-label="Сортировка"><option value="position">Должность: старшие сначала</option><option value="nickname">Никнейм: А–Я</option><option value="nickname_desc">Никнейм: Я–А</option></select>' +
            '</div>' +
            '<table id="pushRosterTable">' +
              '<thead><tr><th>Никнейм</th><th>Должность</th><th>Push</th><th>Устройства</th></tr></thead>' +
              '<tbody>' + rows + '</tbody>' +
            '</table>' +
          '</div>';

        function applyPushRoster() {
          var query = document.getElementById("pushRosterSearch").value.trim().toLowerCase();
          var position = document.getElementById("pushRosterPosition").value;
          var status = document.getElementById("pushRosterStatus").value;
          document.querySelectorAll("#pushRosterTable tbody tr[data-push-nickname]").forEach(function (row) {
            row.style.display = (!query || row.dataset.pushNickname.indexOf(query) !== -1) &&
              (!position || row.dataset.pushPosition === position) &&
              (!status || row.dataset.pushEnabled === status) ? "" : "none";
          });
        }
        ["pushRosterSearch", "pushRosterPosition", "pushRosterStatus"].forEach(function (id) {
          document.getElementById(id).addEventListener(id === "pushRosterSearch" ? "input" : "change", applyPushRoster);
        });
        document.getElementById("pushRosterSort").onchange = function () {
          var mode = this.value;
          var tbody = document.querySelector("#pushRosterTable tbody");
          var rows = Array.from(tbody.querySelectorAll("tr[data-push-nickname]"));
          rows.sort(function (a, b) {
            if (mode === "nickname" || mode === "nickname_desc") {
              var nameDiff = a.dataset.pushNickname.localeCompare(b.dataset.pushNickname, "ru");
              return mode === "nickname_desc" ? -nameDiff : nameDiff;
            }
            var ar = POSITIONS.findIndex(function (p) { return p.toLowerCase() === a.dataset.pushPosition.toLowerCase(); });
            var br = POSITIONS.findIndex(function (p) { return p.toLowerCase() === b.dataset.pushPosition.toLowerCase(); });
            return (ar < 0 ? 999 : ar) - (br < 0 ? 999 : br) || a.dataset.pushNickname.localeCompare(b.dataset.pushNickname, "ru");
          });
          rows.forEach(function (row) { tbody.appendChild(row); });
        };

        var refresh = document.getElementById("refreshPushStatus");
        if (refresh) {
          refresh.onclick = async function () {
            refresh.disabled = true;
            refresh.textContent = "Обновление…";
            try {
              await loadPushStatusAll(true);
            } finally {
              refresh.disabled = false;
            }
          };
        }
      }
      return cachedLoad('pushStatusAll', function () { return window.BR_API.pushStatusAll(user.token); }, renderResult, {root:'pushStatusRoot',force:!!force});
    }

    async function loadNotifications(force) {
      var root = document.getElementById("notificationsRoot");
      if (!root) return;

      function renderResult(result) {
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
              await refreshAll(true);
              window.dispatchEvent(new Event("br:notifications-updated"));
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
              await refreshAll(true);
            } catch (e) {
              alert(e.message || "Не удалось удалить уведомление.");
              button.disabled = false;
            }
          };
        });
      }
      return cachedLoad('notificationsList', function () { return window.BR_API.notificationsList(user.token); }, renderResult, {root:'notificationsRoot',force:!!force});
    }

    async function loadEvents(force) {
      var root = document.getElementById("eventsRoot");
      if (!root) return;

      function renderResult(result) {
        var list = Array.isArray(result.events) ? result.events : [];

        if (!list.length) {
          root.innerHTML = '<div class="page-toolbar event-list-head"><div><small>МЕРОПРИЯТИЯ</small><b>Запланированных сборов нет</b></div></div>';
          return;
        }

        var cards = list.map(function (item) {
          var cancelled = !!item.cancelled_at;
          var reminderText = Array.isArray(item.reminder_offsets)
            ? item.reminder_offsets.map(reminderLabel).join(" • ")
            : "—";
          var action = cancelled
            ? '<span class="badge">Отменено</span>'
            : '<button class="small-button notification-delete" data-cancel-event="' + E(item.id) + '">Отменить</button>';

          return '<article class="event-card' + (cancelled ? ' event-card-cancelled' : '') + '">' +
            '<div class="event-card-head">' +
              '<div><small>СБОР</small><h3>' + E(item.title) + '</h3>' +
              '<div class="notification-meta">' + E(moscowDateTime(item.event_at)) + ' МСК • ' + E(targetLabel(item.target_role)) + '</div></div>' +
              '<div class="notification-actions">' + action + '</div>' +
            '</div>' +
            (item.body ? '<div class="notification-text">' + E(item.body) + '</div>' : '') +
            '<div class="event-card-reminders"><span>Напоминания: ' + E(reminderText) + '</span></div>' +
          '</article>';
        }).join("");

        root.innerHTML =
          '<div class="page-toolbar event-list-head"><div><small>МЕРОПРИЯТИЯ</small><b>Сборы и расписание</b></div><span class="muted">' + E(String(list.length)) + ' мероприятий</span></div>' +
          '<div class="event-list">' + cards + '</div>';

        document.querySelectorAll("[data-cancel-event]").forEach(function (button) {
          button.onclick = async function () {
            if (!confirm("Отменить этот сбор?")) return;
            button.disabled = true;
            try {
              await window.BR_API.eventDelete(user.token, Number(button.dataset.cancelEvent));
              await refreshAll(true);
            } catch (e) {
              alert(e.message || "Не удалось отменить сбор.");
              button.disabled = false;
            }
          };
        });
      }
      return cachedLoad('eventsList', function () { return window.BR_API.eventsList(user.token); }, renderResult, {root:'eventsRoot',force:!!force});
    }
  }

  function requestModal(title, message) {
    return new Promise(function(resolve) {
      var node=document.createElement("div"); node.className="modal-backdrop";
      node.innerHTML='<div class="modal-card" role="dialog" aria-modal="true" style="width:min(420px,100%)"><div class="modal-head"><h2>'+E(title)+'</h2><button type="button" class="modal-close" data-close>×</button></div><p>'+E(message)+'</p><div class="form-actions"><button type="button" class="button button-primary" data-close>Понятно</button></div></div>';
      document.body.appendChild(node);
      function close(){node.remove();resolve();}
      node.querySelectorAll("[data-close]").forEach(function(x){x.onclick=close;});
      node.onclick=function(e){if(e.target===node)close();};
      node.querySelector("[data-close]").focus();
    });
  }
  function ownCachedLoad(user,key,fetcher,render,force) {
    var k="br_cache_v1:"+user.id+":"+key, saved=null;
    try{saved=JSON.parse(sessionStorage.getItem(k)||"null");}catch(_){}
    if(saved&&saved.data) render(saved.data);
    if(!force&&saved&&Date.now()-saved.t<300000)return Promise.resolve(saved.data);
    return Promise.resolve().then(fetcher).then(function(data){
      try{sessionStorage.setItem(k,JSON.stringify({t:Date.now(),data:data}));}catch(_){}
      render(data);return data;
    });
  }
  function ownRequestStatus(status) {
    var v=String(status||"pending");
    return '<span class="badge '+(v==="approved"||v==="answered"?"badge-green":v==="rejected"||v==="cancelled"?"badge-red":"badge-yellow")+'">'+E(({approved:"✓ Одобрено",answered:"✓ Отвечено",rejected:"✕ Отклонено",cancelled:"✕ Отозвано",pending:"⏳ На рассмотрении"})[v]||v)+'</span>';
  }
  function requests(user) {
    return {
      title:"Мои обращения",subtitle:"Обращения к руководству",
      render:function(){return '<div class="box"><form id="generalForm"><div class="form-grid"><div class="form-field"><label>Тип обращения</label><select id="generalType" class="form-select"><option value="question">Вопрос</option><option value="complaint">Жалоба</option><option value="suggestion">Предложение</option></select></div><div class="form-field form-full"><label>Текст обращения</label><textarea id="generalMessage" class="form-textarea" required></textarea></div></div><button class="button button-primary" type="submit">Отправить руководству</button></form></div><div class="box spaced-box"><h2>Мои обращения</h2><div id="generalMineRoot" class="empty">Загрузка...</div></div>';},
      bind:function(){
        var root=document.getElementById("generalMineRoot"),form=document.getElementById("generalForm");
        function load(force){return ownCachedLoad(user,"generalRequestsMine",function(){return window.BR_API.generalRequestsMine(user.token);},function(result){
          var list=Array.isArray(result&&result.requests)?result.requests:[];
          root.innerHTML=list.length?list.map(function(x){return '<article class="box spaced-box"><b>'+E(({question:"Вопрос",complaint:"Жалоба",suggestion:"Предложение"})[x.request_type]||x.request_type)+'</b> '+ownRequestStatus(x.status)+'<p>'+E(x.message||"—")+'</p><small>'+E(formatDateTime(x.created_at))+'</small><p><b>Ответ руководства:</b> '+E(x.management_comment||"—")+'</p></article>';}).join(""):'<div class="empty">Обращений пока нет.</div>';
        },force).catch(function(e){requestModal("Ошибка",e.message||"Не удалось загрузить обращения.");});}
        form.onsubmit=async function(e){e.preventDefault();var button=form.querySelector('[type="submit"]'),message=document.getElementById("generalMessage").value.trim();if(!message){await requestModal("Комментарий","Введите текст обращения.");return;}button.disabled=true;
          try{await window.BR_API.generalRequestCreate(user.token,document.getElementById("generalType").value,message);form.reset();await load(true);await requestModal("Готово","Обращение отправлено руководству.");}
          catch(err){await requestModal("Ошибка",err.message||"Не удалось отправить обращение.");}finally{button.disabled=false;}
        };
        load(false);
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

  function dateIso(offset, baseValue) {
    var date;
    var base = String(baseValue || "").trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(base)) {
      date = new Date(base + "T12:00:00");
    } else {
      date = new Date();
    }

    if (Number.isNaN(date.getTime())) {
      date = new Date();
    }

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

    function renderDailyResult(result, renderDate) {
      var root = document.getElementById("normRoot");
      if (!root) return result;
      result = result || {};
        var list = Array.isArray(result.administrators) ? result.administrators.slice() : [];

        // Сначала руководители по иерархии должностей, затем никнейм.
        var positionRank = {};
        POSITIONS.forEach(function (position, index) {
          positionRank[String(position).trim().toLowerCase()] = index;
        });
        list.sort(function (a, b) {
          var aRank = Object.prototype.hasOwnProperty.call(positionRank, String(a.position || "").trim().toLowerCase())
            ? positionRank[String(a.position || "").trim().toLowerCase()]
            : POSITIONS.length + 1;
          var bRank = Object.prototype.hasOwnProperty.call(positionRank, String(b.position || "").trim().toLowerCase())
            ? positionRank[String(b.position || "").trim().toLowerCase()]
            : POSITIONS.length + 1;
          if (aRank !== bRank) return aRank - bRank;
          return String(a.nickname || "").localeCompare(String(b.nickname || ""), "ru");
        });

        var rows = list.map(function (item) {
          var action = item.submission_id
            ? '<button class="small-button" data-open-admin-norm="' + E(item.submission_id) + '" data-admin-id="' + E(item.admin_id || 0) + '" data-admin-nickname="' + E(item.nickname) + '">Проверить</button>'
            : '<span class="muted">Нет файла</span>';

          return '<tr data-admin-id="' + E(item.admin_id || 0) + '">' +
            '<td><button class="link-button" data-open-admin-norm="' + E(item.submission_id || 0) + '" data-admin-id="' + E(item.admin_id || 0) + '" data-admin-nickname="' + E(item.nickname) + '">' + E(item.nickname) + '</button></td>' +
            '<td>' + E(item.position || "—") + '</td>' +
            '<td>' + E(formatDateOnly(renderDate)) + '</td>' +
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
            '<select id="normativePosition" class="form-select" aria-label="Фильтр должности"><option value="">Все должности</option>' + Array.from(new Set(list.map(function (item) { return String(item.position || "").trim(); }).filter(Boolean))).sort(function (a, b) { var ar=POSITIONS.indexOf(a), br=POSITIONS.indexOf(b); return (ar < 0 ? 999 : ar)-(br < 0 ? 999 : br); }).map(function (p) { return '<option value="' + E(p) + '">' + E(p) + '</option>'; }).join('') + '</select>' +
            '<select id="normativeSort" class="form-select" aria-label="Сортировка"><option value="position">По должности</option><option value="nickname">Никнейм: А–Я</option><option value="nickname_desc">Никнейм: Я–А</option></select>' +
          '</div>';

        root.innerHTML =
          '<div class="box table-box"><div class="stats-table-head"><div><small>НОРМАТИВЫ ЗА ДАТУ</small><b>' +
          E(formatDateOnly(renderDate)) +
          '</b></div><span class="muted">' + E(String(list.length)) + ' аккаунтов с доступом</span></div>' +
          '<div class="admins-source-row"><span>Текущие активные доступы</span><span>Синхронизация со списком доступа к сайту</span></div>' +
          statusButtons +
          '<table id="normativeJournalTable"><thead><tr><th>Никнейм</th><th>Должность</th><th>Дата</th><th>Время</th><th>Статус</th><th>Файлы</th><th>Решение</th><th>Действия</th></tr></thead><tbody>' +
          (rows || '<tr><td colspan="8" class="table-empty">Администраторов в реестре нет.</td></tr>') +
          '</tbody></table></div>';

        var activeFilter = "all";
        var searchInput = document.getElementById("normativeSearch");
        var positionInput = document.getElementById("normativePosition");
        var sortInput = document.getElementById("normativeSort");

        function applyNormativeFilters() {
          var query = searchInput ? searchInput.value.trim().toLowerCase() : "";
          document.querySelectorAll("#normativeJournalTable tbody tr[data-normative-status]").forEach(function (row) {
            var status = row.getAttribute("data-normative-status") || "";
            var nickname = row.getAttribute("data-normative-nickname") || "";
            row.style.display =
              (activeFilter === "all" || status === activeFilter) &&
              (!query || nickname.indexOf(query) !== -1) &&
              (!positionInput.value || row.getAttribute("data-normative-position") === positionInput.value)
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
            row.setAttribute("data-normative-position", String(item.position || ""));
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
        positionInput.onchange = applyNormativeFilters;
        sortInput.onchange = function () {
          var tbody = document.querySelector("#normativeJournalTable tbody");
          var rows = Array.from(tbody.querySelectorAll("tr[data-normative-nickname]"));
          rows.sort(function (a, b) {
            var mode = sortInput.value;
            if (mode !== "position") {
              var order = a.getAttribute("data-normative-nickname").localeCompare(b.getAttribute("data-normative-nickname"), "ru");
              return mode === "nickname_desc" ? -order : order;
            }
            var ar = POSITIONS.indexOf(a.getAttribute("data-normative-position"));
            var br = POSITIONS.indexOf(b.getAttribute("data-normative-position"));
            return (ar < 0 ? 999 : ar) - (br < 0 ? 999 : br) || a.getAttribute("data-normative-nickname").localeCompare(b.getAttribute("data-normative-nickname"), "ru");
          });
          rows.forEach(function (row) { tbody.appendChild(row); });
        };

        document.querySelectorAll("[data-open-admin-norm]").forEach(function (button) {
          button.onclick = function () {
            openNormativeModal({
              token: user.token,
              submissionId: Number(button.dataset.openAdminNorm || 0),
              adminId: Number(button.dataset.adminId || 0),
              nickname: button.dataset.adminNickname || "",
              date: renderDate,
              management: true
            });
          };
        });

        root.setAttribute(
          "data-updated-at",
          new Date().toISOString()
        );
        root.setAttribute("aria-busy", "false");
        return result;
    }

    function loadDaily(forceRefresh) {
      // The app loader passes the session user as its first argument.
      if (forceRefresh && typeof forceRefresh === "object") forceRefresh = false;
      var root = document.getElementById("normRoot");
      var dateInput = document.getElementById("controlDate");
      if (!root) return Promise.resolve(null);
      if (dateInput && dateInput.value) selectedDate = dateInput.value;
      var requestedDate = selectedDate;
      root.setAttribute("aria-busy", "true");
      return cachedPageLoad(user, "normativesAll:" + requestedDate, function () {
        return window.BR_API.normativesDailyLocal(user.token, requestedDate);
      }, function (result) { renderDailyResult(result, requestedDate); }, {
        root: "normRoot", stampId: "normDailyUpdated",
        force: !!forceRefresh, throwOnError: true,
        isCurrent: function () { return selectedDate === requestedDate; },
        onError: function (error, hasCache) {
          if (!hasCache && root && selectedDate === requestedDate) {
            root.innerHTML = '<div class="box"><div class="empty">' + E(error && error.message ? error.message : "Не удалось обновить нормативы.") + '</div></div>';
          }
        }
      }).finally(function () {
        if (selectedDate === requestedDate) root.setAttribute("aria-busy", "false");
      });
    }

    function openNormativeModal(options) {
      var modalRoot = document.getElementById("normativeModal");
      if (!modalRoot) return;

      var fallbackNickname = String(options.nickname || "").trim() || "Администратор";
      modalRoot.innerHTML = '<div class="modal-backdrop" id="normativeBackdrop"><div class="modal-card">' +
        '<div class="modal-head"><div><small>ПРОВЕРКА НОРМАТИВА</small><h2>' + E(fallbackNickname) + '</h2></div><button class="modal-close" id="normativeClose" type="button">×</button></div>' +
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
        var actualNickname = s
          ? String(s.nickname || "").trim()
          : fallbackNickname;
        var title = E(actualNickname || "Администратор");
        var meta = s ? "Дата норматива: " + E(s.submission_date) : "Дата норматива: " + E(options.date || "—");

        var modalTitle = document.querySelector("#normativeBackdrop .modal-head h2");
        if (modalTitle) {
          modalTitle.textContent = actualNickname || "Администратор";
        }

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
                '<button class="button button-secondary" type="button" data-review="rework"' + (!s ? ' disabled' : '') + '>Перенорма</button>' +
                '<button class="button button-primary" type="button" data-review="norm"' + (!s ? ' disabled' : '') + '>Норма</button>' +
                '<button class="button button-danger" type="button" data-review="no_norm">Нет нормы</button>' +
                '<button class="button button-secondary" type="button" data-review="inactive"' + (!s ? ' disabled' : '') + '>Неактив</button>' +
              '</div>' +
              (!s ? '<small class="muted">Норматив за эту дату не отправлен. Можно зафиксировать результат «Нет нормы».</small>' : '') +
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
            button.onclick = async function (event) {
              if (event) {
                event.preventDefault();
                event.stopPropagation();
              }

              var commentInput = document.getElementById("reviewComment");
              var comment = commentInput ? commentInput.value.trim() : "";
              var reviewStatus = button.getAttribute("data-review") || "";

              if (!reviewStatus) {
                alert("Не выбран результат проверки.");
                return;
              }

              button.disabled = true;

              var reviewButtons = document.querySelectorAll("[data-review]");
              reviewButtons.forEach(function (item) {
                item.disabled = true;
              });

              try {
                var reviewResult = await window.BR_API.normativeReview(
                  options.token,
                  options.submissionId,
                  options.adminId,
                  options.date,
                  reviewStatus,
                  comment
                );

                // Показываем сохранённый результат сразу в текущей строке.
                // Повторная загрузка списка ниже служит синхронизацией,
                // а не единственным способом обновить интерфейс.
                var savedStatus =
                  reviewResult && reviewResult.status
                    ? String(reviewResult.status)
                    : reviewStatus;

                var targetRow = document.querySelector(
                  '#normativeJournalTable tbody tr[data-admin-id="' +
                    String(options.adminId || 0) +
                    '"]'
                );

                if (targetRow) {
                  var cells = targetRow.children;

                  if (cells[4]) {
                    cells[4].innerHTML = normativeStatus(savedStatus);
                  }

                  if (cells[6]) {
                    cells[6].textContent = comment || "—";
                  }

                  targetRow.setAttribute("data-normative-status", savedStatus);
                }

                modalRoot.innerHTML = "";

                if (document.body.getAttribute("data-page") === "normatives-all") {
                  try {
                    await loadDaily(true);
                  } catch (refreshError) {
                    console.warn(
                      "[BR AdminTools] Статус сохранён, но список нормативов не удалось синхронизировать:",
                      refreshError
                    );
                  }
                }
              } catch (e) {
                alert(e.message || "Не удалось сохранить решение.");

                reviewButtons.forEach(function (item) {
                  item.disabled = false;
                });
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
            '<div class="date-picker-nav">' +
              '<button class="small-button" id="datePrev" type="button">←</button>' +
              '<input id="controlDate" class="form-input date-control" type="date" value="' + E(selectedDate) + '">' +
              '<button class="small-button" id="dateNext" type="button">→</button>' +
            '</div>' +
            '<div class="date-actions">' +
              '<button class="button button-secondary" id="dateToday" type="button">Сегодня</button>' +
              '<div class="cache-page-tools"><small id="normDailyUpdated" class="cache-updated-at muted">Обновлено —</small><button class="button button-secondary" id="normDailyRefresh" type="button">↻ Обновить</button></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div id="normRoot">' + cacheSkeleton(6) + '</div>' +
        '<div id="normativeModal"></div>';
      },
      bind: function () {
        var input = document.getElementById("controlDate");
        var prev = document.getElementById("datePrev");
        var next = document.getElementById("dateNext");
        var today = document.getElementById("dateToday");
        var refresh = document.getElementById("normDailyRefresh");

        async function refreshDaily(showAlert, forceRefresh) {
          if (refresh) {
            refresh.disabled = true;
            refresh.textContent = "Загрузка…";
          }

          try {
            await loadDaily(!!forceRefresh);
          } catch (error) {
            console.error("[BR AdminTools] Ошибка обновления нормативов:", error);
            if (showAlert) {
              alert(
                error && error.message
                  ? error.message
                  : "Не удалось обновить нормативы."
              );
            }
          } finally {
            if (refresh) {
              refresh.disabled = false;
              refresh.textContent = "↻ Обновить";
            }
          }
        }

        function setDate(value) {
          selectedDate = value;
          if (input) input.value = value;
          refreshDaily(false, false);
        }

        if (input) input.onchange = function () { setDate(input.value); };
        if (prev) prev.onclick = function () { setDate(dateIso(-1, selectedDate)); };
        if (next) next.onclick = function () { setDate(dateIso(1, selectedDate)); };
        if (today) today.onclick = function () { setDate(dateIso(0)); };
        if (refresh) refresh.onclick = function () { refreshDaily(true, true); };
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
              '<div class="form-field form-full"><label>Текущий пароль</label><div class="access-password-field"><input id="currentPassword" class="form-input" type="password" autocomplete="current-password" required><button type="button" class="small-button password-toggle" data-password-toggle="currentPassword" aria-label="Показать пароль" title="Показать пароль" aria-pressed="false"></button></div></div>' +
              '<div class="form-field"><label>Новый пароль</label><div class="access-password-field"><input id="newPassword" class="form-input" type="password" autocomplete="new-password" minlength="8" required><button type="button" class="small-button password-toggle" data-password-toggle="newPassword" aria-label="Показать пароль" title="Показать пароль" aria-pressed="false"></button></div></div>' +
              '<div class="form-field"><label>Повторите новый пароль</label><div class="access-password-field"><input id="newPasswordConfirm" class="form-input" type="password" autocomplete="new-password" minlength="8" required><button type="button" class="small-button password-toggle" data-password-toggle="newPasswordConfirm" aria-label="Показать пароль" title="Показать пароль" aria-pressed="false"></button></div></div>' +
            '</div>' +
            '<p class="settings-hint">Минимум 8 символов: заглавная и строчная латинские буквы (A–Z, a–z), цифра (0–9) и специальный символ (например, ! или @). После смены пароля все устройства выйдут из аккаунта.</p>' +
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
              '<div class="settings-card-head"><div><small>ДАННЫЕ</small><h2>Web app URL</h2></div><span>Адрес активного веб-развёртывания Google Таблица</span></div>' +
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
          passwordForm.querySelectorAll("[data-password-toggle]").forEach(function (toggle) {
            toggle.onclick = function () {
              var input = document.getElementById(
                toggle.getAttribute("data-password-toggle")
              );
              if (!input) return;

              var show = input.type === "password";
              input.type = show ? "text" : "password";
              toggle.setAttribute("aria-pressed", show ? "true" : "false");
              toggle.setAttribute("aria-label", show ? "Скрыть пароль" : "Показать пароль");
              toggle.classList.toggle("is-visible", show);
            };
          });

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

            if (newPassword.length < 8) {
              showStatus("Новый пароль должен содержать минимум 8 символов.", false);
              return;
            }

            if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
              showStatus("Добавьте строчную и заглавную латинские буквы, цифру и специальный символ.", false);
              return;
            }
            if (newPassword === currentPassword) {
              showStatus("Новый пароль должен отличаться от текущего.", false);
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
              window.BRApp.clearSession();
              window.alert("Пароль изменён. Все активные сессии завершены. Войдите заново с новым паролем.");
              location.replace(new URL("../index.html", location.href).href);
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
                "Настройки сохранены.",
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
    var state = {
      nickname: "",
      action: "",
      date: "",
      severity: "all",
      visible: 20
    };

    var actions = {
      access_candidates: "Действие: access_candidates",
      access_list: "Действие: access_list",
      settings_get: "Действие: settings_get",
      notifications_list: "Действие: notifications_list",
      push_config: "Действие: push_config",
      push_config_get: "Действие: push_config_get",
      push_status: "Действие: push_status",
      notification_read: "Действие: notification_read",
      events_list: "Действие: events_list",
      general_requests_mine: "Действие: general_requests_mine",
      general_requests_all: "Действие: general_requests_all",
      inactive_requests_mine: "Действие: inactive_requests_mine",
      inactive_requests_all: "Действие: inactive_requests_all",
      inactive_request_overlap_check: "Действие: inactive_request_overlap_check",
      inactive_periods_range: "Действие: inactive_periods_range",
      normatives_list: "Действие: normatives_list",
      normatives_all: "Действие: normatives_all",
      normatives_mine: "Действие: normatives_mine",
      normative_detail: "Действие: normative_detail",
      normative_url: "Действие: normative_url",
      game_presence_mine: "Действие: game_presence_mine",
      game_presence_control: "Действие: game_presence_control",
      server_stats: "Действие: server_stats",
      page_view: "Открытие раздела",
      login: "Вход в систему",
      logout: "Выход из системы",
      auth: "Авторизация",
      access: "Доступ",
      grant: "Выдача доступа",
      revoke: "Отзыв доступа",
      access_grant: "Выдача доступа",
      access_update: "Изменение доступа",
      access_unbind: "Сброс привязки",
      access_block: "Блокировка доступа",
      access_unblock: "Разблокировка доступа",
      access_remove: "Удаление доступа",
      remove: "Удаление",
      update: "Изменение",
      edit: "Редактирование",
      create: "Создание",
      delete: "Удаление",
      block: "Блокировка",
      unblock: "Разблокировка",
      unbind: "Сброс привязки",
      game_login: "Вход в игру",
      game_logout: "Выход из игры",
      game_enter: "Вход в игру",
      game_exit: "Выход из игры",
      admins_list: "Просмотр администрации",
      create_admins: "Создание аккаунтов",
      settings_update: "Изменение настроек",
      normative_created: "Отправка норматива",
      normative_review: "Проверка норматива",
      inactive_request_created: "Подача заявки на неактив",
      inactive_request_approved: "Одобрение неактива",
      inactive_request_rejected: "Отклонение неактива",
      notification_created: "Создание уведомления",
      notification_deleted: "Удаление уведомления",
      push_status_list: "Просмотр push-подписок",
      push_config_updated: "Изменение настроек push",
      push_subscribed: "Подключение push-уведомлений",
      push_unsubscribed: "Отключение push-уведомлений",
      push_status: "Проверка push-подписки",
      push_status_all: "Просмотр push-подписок",
      access_reset_sessions: "Сброс сессий администратора",
      admin_request_created: "Создание обращения",
      admin_request_replied: "Ответ на обращение",
      game_enter: "Вход в игру",
      game_exit: "Выход из игры",
      normatives_daily: "Просмотр нормативов",
      normative_mark: "Проставка норматива",
      audit_logs: "Просмотр журнала",
      audit_logs_clear: "Очистка журнала"
    };

    var pages = {
      auth: "Авторизация",
      login: "Авторизация",
      dashboard: "Главная",
      profile: "Мой профиль",
      access: "Выдать доступ",
      admins: "Администраторы",
      notifications: "Уведомления",
      normatives: "Нормативы",
      "normatives-all": "Проставка нормативов",
      requests: "Мои обращения",
      "statistics-all": "Статистика администрации",
      "requests-all": "Обращения администрации",
      "game-activity": "Вход в игру",
      logs: "Журнал действий",
      rules: "Регламент",
      settings: "Настройки"
    };

    var details = {
      "Login successful": "Авторизация выполнена",
      "Authentication successful": "Авторизация выполнена",
      "Logout successful": "Выход из системы выполнен",
      "Logged out": "Выход из системы выполнен",
      "Access granted": "Доступ выдан",
      "Access revoked": "Доступ отозван",
      "Access removed": "Доступ удалён",
      "Account blocked": "Аккаунт заблокирован",
      "Account unblocked": "Аккаунт разблокирован",
      "Device unbound": "Привязка устройства сброшена"
    };

    function formatAuditDetails(value) {
      var raw = String(value == null ? "" : value).trim();
      var accessUpdate = raw.match(/^измен[её]н\s+доступ\s*:?\s*(.+)$/i);

      if (accessUpdate && accessUpdate[1]) {
        // Никнейм выводится целиком, без удаления символов или пробелов из имени.
        var nickname = accessUpdate[1].trim();
        return "Доступ изменён: " + nickname;
      }

      return details[raw] || raw || "—";
    }

    var actionOptions = Object.keys(actions)
      .filter(function (key, index, list) {
        return list.indexOf(key) === index;
      })
      .sort(function (a, b) {
        return (actions[a] || a).localeCompare(actions[b] || b, "ru");
      });

    function criticality(action) {
      var key = String(action || "").toLowerCase();

      if ([
        "access_block",
        "access_remove",
        "settings_update",
        "create_admins"
      ].indexOf(key) !== -1) {
        return {
          key: "critical",
          label: "Критическая",
          className: "badge-red"
        };
      }

      if ([
        "access_grant",
        "access_update",
        "access_unbind",
        "access_unblock",
        "inactive_request_created",
        "inactive_request_approved",
        "inactive_request_rejected",
        "normative_created",
        "normative_review",
        "notification_created",
        "notification_deleted"
      ].indexOf(key) !== -1) {
        return {
          key: "important",
          label: "Важная",
          className: "badge-yellow"
        };
      }

      return {
        key: "normal",
        label: "Обычная",
        className: "badge-gray"
      };
    }

    function rangeForDate(value) {
      var text = String(value || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return {
          from: "",
          to: ""
        };
      }

      var start = new Date(text + "T00:00:00");
      var end = new Date(start.getTime() + 86400000);

      return {
        from: start.toISOString(),
        to: end.toISOString()
      };
    }

    function renderTable(root, list) {
      var filtered = list.filter(function (item) { return state.severity === "all" || (item.criticality || criticality(item.action).key) === state.severity; });
      var rows = filtered.length
        ? filtered.slice(0, state.visible).map(function (x) {
            var actionKey = String(x.action || "").toLowerCase();
            var pageKey = String(x.page || "").toLowerCase();
            var detailKey = String(x.details || "");
            var level = criticality(actionKey);

            if (
              x.criticality === "critical" ||
              x.criticality === "important" ||
              x.criticality === "normal"
            ) {
              level = criticality(actionKey);
              level.key = x.criticality;

              if (x.criticality === "critical") {
                level.label = "Критическая";
                level.className = "badge-red";
              } else if (x.criticality === "important") {
                level.label = "Важная";
                level.className = "badge-yellow";
              } else {
                level.label = "Обычная";
                level.className = "badge-gray";
              }
            }

            return '<tr><td>' +
              E(formatDateTime(x.created_at || x.time)) +
              '</td><td>' +
              E(x.nickname || "—") +
              '</td><td>' +
              E(actions[actionKey] || x.action || "—") +
              '</td><td>' +
              '<span class="badge ' + level.className + '">' +
                E(level.label) +
              '</span>' +
              '</td><td>' +
              E(pages[pageKey] || x.page || "—") +
              '</td><td>' +
              E(formatAuditDetails(x.details)) +
              '</td></tr>';
          }).join("")
        : '<tr><td colspan="6" class="table-empty">По заданным фильтрам записи не найдены.</td></tr>';

      root.innerHTML =
        '<div class="box table-box">' +
          '<table>' +
            '<thead><tr>' +
              '<th>Время</th>' +
              '<th>Никнейм</th>' +
              '<th>Действие</th>' +
              '<th>Критичность</th>' +
              '<th>Раздел</th>' +
              '<th>Подробности</th>' +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' + (filtered.length > state.visible ? '<button type="button" class="button button-secondary logs-more" id="logsShowMore">Показать ещё</button>' : '');
      var more = document.getElementById("logsShowMore");
      if (more) more.onclick = function () { state.visible += 20; renderTable(root, list); };
    }

    return {
      managementOnly: true,
      title: "Журнал действий",
      subtitle: "История действий администрации с фильтрацией и уровнем критичности",
      render: function () {
        var options = actionOptions.map(function (key) {
          return '<option value="' + E(key) + '">' +
            E(actions[key]) +
            '</option>';
        }).join("");

        return '<div class="box logs-filter-box">' +
          '<form id="logsFilterForm" class="logs-filter-form">' +
            '<div class="form-field">' +
              '<label for="logsNickname">По никнейму</label>' +
              '<input id="logsNickname" class="form-input" type="search" placeholder="Введите никнейм">' +
            '</div>' +
            '<div class="form-field">' +
              '<label for="logsAction">По действию</label>' +
              '<select id="logsAction" class="form-select">' +
                '<option value="">Все действия</option>' +
                options +
              '</select>' +
            '</div>' +
            '<div class="form-field">' +
              '<label for="logsDate">Любая дата</label>' +
              '<input id="logsDate" class="form-input" type="date">' +
            '</div>' +
            '<div class="logs-severity-chips" aria-label="Критичность"><button type="button" data-log-severity="all" class="active">Все</button><button type="button" data-log-severity="normal">Обычная</button><button type="button" data-log-severity="important">Важная</button><button type="button" data-log-severity="critical">Критическая</button></div>' +
            '<div class="logs-filter-actions">' +
              '<button class="button button-primary" type="submit">Найти</button>' +
              '<button class="button button-secondary" id="logsFilterReset" type="button">Сбросить</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
        '<div id="logsRoot"><div class="box"><div class="empty">Загрузка журнала...</div></div></div>' +
        '<div class="box logs-cleanup-box">' +
          '<div class="logs-cleanup-head">' +
            '<div><small>ОЧИСТКА</small><b>Удаление старых записей</b></div>' +
            '<span>Действие доступно только руководству</span>' +
          '</div>' +
          '<div class="logs-cleanup-controls">' +
            '<div class="form-field">' +
              '<label for="logsCleanupPeriod">Период</label>' +
              '<select id="logsCleanupPeriod" class="form-select">' +
                '<option value="older_7_days">За последние 7 дней</option>' +
                '<option value="older_30_days">За последние 30 дней</option>' +
                '<option value="older_180_days" selected>За последние 6 месяцев</option>' +
                '<option value="all">Весь журнал</option>' +
              '</select>' +
            '</div>' +
            '<button class="button button-danger" id="logsCleanupButton" type="button">Очистить журнал</button>' +
          '</div>' +
        '</div>';
      },
      bind: function (user) {
        var form = document.getElementById("logsFilterForm");
        var nicknameInput = document.getElementById("logsNickname");
        var actionInput = document.getElementById("logsAction");
        var dateInput = document.getElementById("logsDate");
        var reset = document.getElementById("logsFilterReset");
        var cleanupPeriod = document.getElementById("logsCleanupPeriod");
        var cleanupButton = document.getElementById("logsCleanupButton");

        document.querySelectorAll("[data-log-severity]").forEach(function (chip) {
          chip.onclick = function () {
            state.severity = chip.dataset.logSeverity;
            state.visible = 20;
            document.querySelectorAll("[data-log-severity]").forEach(function (other) { other.classList.toggle("active", other === chip); });
            load(user, false);
          };
        });
        if (cleanupButton) {
          cleanupButton.onclick = async function () {
            var period = cleanupPeriod
              ? cleanupPeriod.value
              : "older_180_days";

            var labels = {
              older_7_days: "все записи за последние 7 дней",
              older_30_days: "все записи за последние 30 дней",
              older_180_days: "все записи за последние 6 месяцев",
              all: "весь журнал действий"
            };

            var description =
              labels[period] || "выбранные записи";

            var confirmed = window.confirm(
              "Внимание! Будут удалены " +
              description +
              ".\n\nПродолжить?"
            );

            if (!confirmed) return;

            cleanupButton.disabled = true;
            cleanupButton.textContent = "Очистка…";

            try {
              var result = await window.BR_API.auditLogsClear(
                user.token,
                period
              );

              var deleted = Number(
                result && result.deleted_count
                  ? result.deleted_count
                  : 0
              );

              window.alert(
                deleted
                  ? "Журнал очищен. Удалено записей: " + deleted
                  : "За выбранный период записей нет."
              );

              await load(user, false);
            } catch (error) {
              window.alert(
                error && error.message
                  ? error.message
                  : "Не удалось очистить журнал."
              );
            } finally {
              cleanupButton.disabled = false;
              cleanupButton.textContent = "Очистить журнал";
            }
          };
        }

        if (form) {
          form.onsubmit = function (event) {
            event.preventDefault();

            state.nickname = nicknameInput ? nicknameInput.value.trim() : "";
            state.action = actionInput ? actionInput.value.trim() : "";
            state.date = dateInput ? dateInput.value.trim() : "";
            state.visible = 20;

            load(user, false);
          };
        }

        if (reset) {
          reset.onclick = function () {
            state.nickname = "";
            state.action = "";
            state.date = "";

            if (nicknameInput) nicknameInput.value = "";
            if (actionInput) actionInput.value = "";
            if (dateInput) dateInput.value = "";

            load(user, false);
          };
        }
      },
      load: async function (user) {
        var root = document.getElementById("logsRoot");
        if (!root) return;

        try {
          var range = rangeForDate(state.date);

          var result = await window.BR_API.auditLogs(
            user.token,
            500,
            {
              nickname: state.nickname,
              action: state.action,
              created_from: range.from,
              created_to: range.to
            }
          );

          var list = Array.isArray(result.logs)
            ? result.logs
            : [];

          renderTable(root, list);
        } catch (e) {
          root.innerHTML =
            '<div class="box"><div class="empty">' +
              E(e.message || "Не удалось загрузить журнал.") +
            '</div></div>';
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
        return '<span class="badge badge-red">✕ Заблокирован</span>';
      }

      if (item.is_active) {
        return '<span class="badge badge-green">Активен</span>';
      }

      return '<span class="badge">Доступ удалён</span>';
    }

    // Иерархия должностей: от младшего модератора к главному администратору.
    function accessPositionRank(position) {
      var text = String(position || "")
        .trim()
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[().,;:]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!text) return 999;
      if (text.indexOf("основной заместитель главного администратора") >= 0) return 15.5;
      if (text.indexOf("главный администратор") >= 0 && text.indexOf("заместитель") < 0) return 16;
      if (text.indexOf("заместитель главного администратора") >= 0 || text.indexOf("зам. главного администратора") >= 0) return 14;
      if (text.indexOf("куратор администрации") >= 0) {
        return text.indexOf("заместитель") >= 0 || text.indexOf("зам.") >= 0 ? 12 : 13;
      }
      if (text.indexOf("куратор агентов поддержки") >= 0) {
        return text.indexOf("заместитель") >= 0 || text.indexOf("зам.") >= 0 ? 10 : 11;
      }
      if (text.indexOf("куратор организаций") >= 0) {
        return text.indexOf("заместитель") >= 0 || text.indexOf("зам.") >= 0 ? 8 : 9;
      }
      if (text.indexOf("старший следящий") >= 0 || text.indexOf("ст. след") >= 0) return 6;
      if (text.indexOf("старший администратор") >= 0) return 7;
      if (text.indexOf("старший модератор") >= 0) return 4;
      if (text.indexOf("младший модератор") >= 0) return 1;
      if (text === "следящий" || text.indexOf(" следящий") >= 0) return 2;
      if (text.indexOf("модератор") >= 0) return 3;
      if (text === "администратор" || text.indexOf(" администратор") >= 0) return 5;
      return 999;
    }

    function sortAccessAccounts(list, mode) {
      var items = Array.isArray(list) ? list.slice() : [];
      items.sort(function (a, b) {
        if (mode === "nickname" || mode === "nickname_desc") {
          var comparison = String(a.nickname || "").localeCompare(String(b.nickname || ""), "ru", { sensitivity: "base" });
          return mode === "nickname_desc" ? -comparison : comparison;
        }
        if (mode === "last_login") return new Date(b.last_login_at || 0) - new Date(a.last_login_at || 0);
        var rankA = accessPositionRank(a.position);
        var rankB = accessPositionRank(b.position);
        if (rankA !== rankB) return mode === "position_asc" ? rankA - rankB : rankB - rankA;
        var positionCompare = String(a.position || "").localeCompare(String(b.position || ""), "ru", { sensitivity: "base" });
        if (positionCompare !== 0) return positionCompare;
        return String(a.nickname || "").localeCompare(String(b.nickname || ""), "ru", { sensitivity: "base" });
      });
      return items;
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

      var rows = granted.map(function (item, index) {
        return '<div class="access-credential-row"><b>' + E(item.nickname) + '</b>' +
          '<code>' + E(item.password || "") + '</code>' +
          '<button class="small-button" data-copy-credential="' + index + '" type="button">Копировать</button></div>';
      }).join("");
      root.hidden = false;
      root.innerHTML =
        '<div class="access-credentials-head"><div><small>ДАННЫЕ ДОСТУПА</small><b>Создано: ' + granted.length + '</b></div>' +
        '<button class="small-button" id="' + targetId + 'Copy" type="button">Копировать всё</button></div>' +
        '<div class="access-credential-list">' + rows + '</div>' +
        '<p class="settings-hint">Скопируйте пароли сейчас: повторно получить их из базы нельзя, хранятся только хеши.</p>';
      root.querySelectorAll("[data-copy-credential]").forEach(function (button) {
        button.onclick = async function () {
          var item = granted[Number(button.dataset.copyCredential)];
          try { await navigator.clipboard.writeText(item.nickname + ": " + item.password); button.textContent = "Скопировано"; }
          catch (_) { button.textContent = "Ошибка копирования"; }
        };
      });

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

        var selected = new Set();
        function bindBulkRegistry() {
          var selector = root.querySelector("#accessSelectVisible");
          var positionSelect = root.querySelector("#accessBatchPosition");
          var apply = root.querySelector("#accessBatchApply");
          var remove = root.querySelector("#accessBatchRemove");
          var clear = root.querySelector("#accessBatchClear");
          var count = root.querySelector("#accessRegistryCount");
          var toolbar = root.querySelector("#accessBatchToolbar");
          function visibleInputs() {
            return Array.from(root.querySelectorAll("[data-access-select]")).filter(function (input) {
              var row = input.closest("tr");
              return row && !row.hidden && row.style.display !== "none";
            });
          }
          function refresh() {
            var inputs = visibleInputs(), checked = inputs.filter(function (input) { return input.checked; }).length;
            inputs.forEach(function (input) { var row = input.closest("tr"); if (row) row.classList.toggle("is-selected", input.checked); });
            count.textContent = selected.size ? selected.size + " из " + state.accounts.length + " аккаунтов выбрано" : state.accounts.length + " аккаунтов";
            toolbar.hidden = selected.size === 0;
            selector.checked = inputs.length > 0 && checked === inputs.length;
            selector.indeterminate = checked > 0 && checked < inputs.length;
            apply.disabled = selected.size === 0 || !positionSelect.value;
            remove.disabled = clear.disabled = selected.size === 0;
          }
          root.querySelectorAll("[data-access-select]").forEach(function (input) {
            input.onchange = function () {
              var id = Number(input.dataset.accessSelect);
              if (input.checked) selected.add(id); else selected.delete(id);
              refresh();
            };
          });
          selector.onchange = function () {
            visibleInputs().forEach(function (input) {
              input.checked = selector.checked;
              var id = Number(input.dataset.accessSelect);
              if (input.checked) selected.add(id); else selected.delete(id);
            });
            refresh();
          };
          clear.onclick = function () {
            selected.clear();
            root.querySelectorAll("[data-access-select]").forEach(function (input) { input.checked = false; });
            refresh();
          };
          positionSelect.onchange = refresh;
          ["accessRegistrySearch", "accessRegistryPosition"].forEach(function (id) {
            var el = root.querySelector("#" + id);
            if (!el) return;
            el.addEventListener(id === "accessRegistrySearch" ? "input" : "change", refresh);
          });
          async function run(operation) {
            var targets = state.accounts.filter(function (item) { return selected.has(Number(item.id)); });
            if (!targets.length) return;
            if (operation === "remove") {
              if (!window.confirm("Полностью удалить доступ и связанные данные " + targets.length + " аккаунтов? Действие необратимо.\\n\\n" + targets.map(function (item) { return item.nickname; }).join(", "))) return;
            } else if (!positionSelect.value) return;
            apply.disabled = remove.disabled = clear.disabled = true;
            apply.textContent = remove.textContent = "Обработка…";
            var ok = 0, failures = [];
            for (var i = 0; i < targets.length; i += 1) {
              var item = targets[i];
              try {
                await window.BR_API.accessManage(user.token, operation === "remove"
                  ? { admin_id: Number(item.id), operation: "remove" }
                  : { admin_id: Number(item.id), operation: "update", role: item.role, position: positionSelect.value, password: "" });
                ok += 1;
                selected.delete(Number(item.id));
              } catch (error) {
                failures.push(item.nickname + ": " + (error.message || "Ошибка"));
              }
            }
            showAccessStatus("Успешно: " + ok + " из " + targets.length + (failures.length ? ". Не удалось: " + failures.join("; ") : "."), failures.length === 0);
            await loadAccounts(root);
          }
          apply.onclick = function () { run("update"); };
          remove.onclick = function () { run("remove"); };
          refresh();
        }
        function renderAccessRegistry(mode, query, positionFilter) {
          mode = mode || "position";
          query = query || "";
          positionFilter = positionFilter || "";
          var positions = Array.from(new Set(state.accounts.map(function (item) { return String(item.position || "").trim(); }).filter(Boolean))).sort(function (a, b) { return accessPositionRank(b) - accessPositionRank(a) || a.localeCompare(b, "ru"); });
          var sortedAccounts = sortAccessAccounts(
            state.accounts.filter(function (item) { return (!query || String(item.nickname || "").toLowerCase().indexOf(query.toLowerCase()) >= 0 || String(item.login || "").toLowerCase().indexOf(query.toLowerCase()) >= 0) && (!positionFilter || item.position === positionFilter); }),
            mode
          );

          var rows = sortedAccounts.map(function (item) {
            return '<tr class="' + (item.blocked_at ? 'card-bad' : item.is_active ? 'card-ok' : '') + (selected.has(Number(item.id)) ? ' is-selected' : '') + '">' +
              '<td class="access-select-cell access-select-desktop"></td>' +
              '<td class="access-account-main" data-label="Никнейм"><div class="access-account-top"><label class="access-inline-check"><input class="access-card-check" type="checkbox" data-access-select="' + E(item.id) + '" aria-label="Выбрать ' + E(item.nickname || "аккаунт") + '"' + (selected.has(Number(item.id)) ? ' checked' : '') + '></label><b class="access-card-nick" title="' + E(item.nickname || "—") + '">' + E(item.nickname || "—") + '</b></div></td>' +
              '<td class="access-account-extra" data-label="Роль">' + E(roleLabel(item.role)) + '</td>' +
              '<td class="access-account-extra" data-label="Должность">' + E(item.position || "—") + '</td>' +
              '<td class="access-account-extra access-status-cell" data-label="Статус">' + statusLabel(item) + '</td>' +
              '<td class="access-account-extra" data-label="IP">' + E(item.last_login_ip || "—") + '</td>' +
              '<td class="access-account-extra" data-label="Последний вход">' + E(item.last_login_at ? formatDateTime(item.last_login_at) : "—") + '</td>' +
              '<td class="access-actions-cell" data-label="Действия"><div class="admin-menu-wrap access-menu-wrap">' +
              '<button class="admin-menu-trigger" type="button" data-access-menu="' + E(item.id) + '" title="Действия" aria-label="Действия">⋮</button>' +
              '<div class="admin-row-menu access-row-menu" data-access-row-menu="' + E(item.id) + '">' +
              '<button type="button" data-access-action="details" data-admin-id="' + E(item.id) + '">Подробнее / изменить</button>' +
              '<button type="button" data-access-action="reset_sessions" data-admin-id="' + E(item.id) + '">Сбросить все сессии</button>' +
              (item.blocked_at ? '<button type="button" data-access-action="unblock" data-admin-id="' + E(item.id) + '">Разблокировать</button>' : '<button type="button" data-access-action="block" data-admin-id="' + E(item.id) + '">Заблокировать</button>') +
              '<button type="button" data-access-action="remove" data-admin-id="' + E(item.id) + '" class="menu-danger">Удалить доступ</button>' +
              '</div></div></td></tr>';
          }).join("");

          root.innerHTML =
            '<div class="box table-box access-registry">' +
              '<div class="stats-table-head access-registry-head">' +
                '<div><small>РЕЕСТР ДОСТУПОВ</small><b id="accessRegistryCount">' + E(String(state.accounts.length)) + ' аккаунтов</b></div>' +
                '<div class="access-registry-toolbar">' +
                  '<input id="accessRegistrySearch" class="form-input" type="search" placeholder="Поиск по никнейму или логину" aria-label="Поиск администратора" value="' + E(query) + '">' +
                  '<select id="accessRegistryPosition" class="form-select" aria-label="Фильтр должности"><option value="">Все должности</option>' + positions.map(function (p) { return '<option value="' + E(p) + '"' + (p === positionFilter ? ' selected' : '') + '>' + E(p) + '</option>'; }).join('') + '</select>' +
                  '<div class="access-sort-control"><span class="muted">Сортировка</span>' +
                  '<select id="accessRegistrySort" class="form-select access-registry-sort" aria-label="Сортировка реестра доступов">' +
                    '<option value="position"' + (mode === "position" ? " selected" : "") + '>Должность: старшие сначала</option>' +
                    '<option value="position_asc"' + (mode === "position_asc" ? " selected" : "") + '>Должность: младшие сначала</option>' +
                    '<option value="nickname"' + (mode === "nickname" ? " selected" : "") + '>Никнейм: А–Я</option>' +
                    '<option value="nickname_desc"' + (mode === "nickname_desc" ? " selected" : "") + '>Никнейм: Я–А</option>' +
                    '<option value="last_login"' + (mode === "last_login" ? " selected" : "") + '>Последний вход</option>' +
                  '</select></div>' +
                '</div>' +
              '</div>' +
              '' +
              '<div class="access-batch-toolbar" id="accessBatchToolbar" hidden>' +
              '<select id="accessBatchPosition" class="form-select" aria-label="Новая должность"><option value="">Новая должность</option>' + POSITIONS.map(function (p) { return '<option value="' + E(p) + '">' + E(p) + '</option>'; }).join("") + '</select>' +
              '<button id="accessBatchApply" class="button button-secondary" type="button" disabled>Изменить должность</button>' +
              '<button id="accessBatchRemove" class="button" type="button" disabled>Удалить доступ выбранным</button>' +
              '<button id="accessBatchClear" class="small-button" type="button" disabled>Снять выбор</button></div>' +
            '<table id="accessRegistryTable"><thead><tr>' +
                '<th class="access-select-cell"><input id="accessSelectVisible" type="checkbox" aria-label="Выбрать все видимые аккаунты"></th><th>Никнейм</th><th>Роль</th><th>Должность</th><th>Статус</th><th>IP</th><th>Последний вход</th><th>Действия</th>' +
              '</tr></thead><tbody>' + rows + '</tbody></table>' +
            '</div>';

          bindAccessMenus();
          bindBulkRegistry();

          var sortSelect = document.getElementById("accessRegistrySort");
          if (sortSelect) {
            sortSelect.onchange = function () {
              renderAccessRegistry(sortSelect.value, document.getElementById("accessRegistrySearch").value, document.getElementById("accessRegistryPosition").value);
            };
          }
          document.getElementById("accessRegistrySearch").oninput = function () { var position = this.selectionStart; renderAccessRegistry(mode, this.value, document.getElementById("accessRegistryPosition").value); var next = document.getElementById("accessRegistrySearch"); next.focus(); next.setSelectionRange(position, position); };
          document.getElementById("accessRegistryPosition").onchange = function () { renderAccessRegistry(mode, document.getElementById("accessRegistrySearch").value, this.value); };
        }

        renderAccessRegistry("position");


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

      menu.style.setProperty("left", Math.round(left) + "px", "important");
      menu.style.setProperty("top", Math.round(top) + "px", "important");
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
            reset_sessions: "Завершить все активные сессии аккаунта «" + item.nickname + "»?\n\nНа всех устройствах потребуется повторный вход. Пароль и привязка устройства не изменятся.",
            block: "Заблокировать " + item.nickname + "?",
            unblock: "Разблокировать " + item.nickname + "?",
            remove: "Полностью удалить " + item.nickname + "?\n\nБудут удалены аккаунт и его история в панели: нормативы, обращения, неактивы, игровая активность, push-подписки, отправленные им уведомления и связанные данные. Восстановить это действие нельзя."
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
              '<div class="admin-edit-title"><small>УПРАВЛЕНИЕ ДОСТУПОМ</small><h2>' + E(item.nickname) + '</h2><span>Данные аккаунта</span></div>' +
              '<button class="modal-close" id="accessEditClose" type="button">×</button>' +
            '</div>' +
            '<div class="access-details-grid">' +
              '<div><small>IP</small><b>' + E(item.last_login_ip || "—") + '</b></div>' +
              '<div><small>ПОСЛЕДНИЙ ВХОД</small><b>' + E(item.last_login_at ? formatDateTime(item.last_login_at) : "—") + '</b></div>' +

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
      var list = document.getElementById("accessManualNames");
      var add = document.getElementById("accessManualAdd");
      if (!form || !list || !add) return;

      function addRow(value) {
        if (list.querySelectorAll(".access-manual-name").length >= 30) return;
        var row = document.createElement("div");
        row.className = "access-manual-row";
        var input = document.createElement("input");
        input.className = "form-input access-manual-name";
        input.type = "text";
        input.maxLength = 32;
        input.autocomplete = "off";
        input.placeholder = "Никнейм администратора";
        input.setAttribute("aria-label", "Никнейм администратора");
        input.value = value || "";
        var remove = document.createElement("button");
        remove.type = "button";
        remove.className = "small-button";
        remove.textContent = "Удалить";
        remove.onclick = function () { row.remove(); updateRows(); };
        row.appendChild(input);
        row.appendChild(remove);
        list.appendChild(row);
        updateRows();
        input.focus();
      }
      function updateRows() {
        var rows = list.querySelectorAll(".access-manual-row");
        rows.forEach(function (row, index) {
          row.querySelector("input").setAttribute("aria-label", "Никнейм администратора " + (index + 1));
          row.querySelector("button").hidden = rows.length === 1;
        });
        add.disabled = rows.length >= 30;
      }
      add.onclick = function () { addRow(""); };
      addRow("");

      form.onsubmit = async function (event) {
        event.preventDefault();
        var nicknames = Array.from(list.querySelectorAll(".access-manual-name")).map(function (input) { return input.value.trim(); });
        if (nicknames.some(function (name) { return !/^[A-Za-z0-9_]{3,32}$/.test(name); })) {
          showAccessStatus("Каждый никнейм: 3–32 символа, латинские буквы, цифры и подчёркивание. Пустых строк быть не должно.", false);
          return;
        }
        if (new Set(nicknames.map(function (name) { return name.toLowerCase(); })).size !== nicknames.length) {
          showAccessStatus("В списке есть повторяющиеся никнеймы.", false);
          return;
        }
        var button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        button.textContent = "Создание…";
        try {
          var result = await window.BR_API.accessGrant(user.token, {
            nicknames: nicknames,
            individual_passwords: true,
            role: document.getElementById("accessManualRole").value,
            position: document.getElementById("accessManualPosition").value
          });
          renderCredentials(result, "manualCredentials");
          list.innerHTML = "";
          addRow("");
          showAccessStatus("Создано аккаунтов: " + nicknames.length + ". Скопируйте отдельные пароли из блока ниже.", true);
          await loadAccounts(document.getElementById("accessRegistryRoot"));
        } catch (error) {
          showAccessStatus(error.message || "Не удалось создать доступы.", false);
        } finally {
          button.disabled = false;
          button.textContent = "Создать доступы";
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
            '<div class="access-candidates-empty">Все администраторы уже имеют доступ или находятся в заблокированных.</div>';
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
                  '<div class="form-field form-full"><label>Никнеймы (до 30)</label><div id="accessManualNames" class="access-manual-names"></div><button id="accessManualAdd" class="small-button" type="button">+ Добавить администратора</button></div>' +
                  '<div class="form-field"><label>Роль</label><select id="accessManualRole" class="form-select"><option value="admin">Администратор</option><option value="management">Руководство</option></select></div>' +
                  '<div class="form-field"><label>Должность</label>' + positionSelect("accessManualPosition", "position", "") + '</div>' +
                  '<p class="settings-hint">Каждому администратору сервер создаст отдельный случайный пароль. Пароли показываются только после создания.</p>' +
                '</div>' +
                '<div class="form-actions"><button class="button button-primary" type="submit">Создать доступы</button></div>' +
              '</form>' +
              '<div id="manualCredentials" class="access-credentials" hidden></div>' +
            '</section>' +

            '<section class="box access-card">' +
              '<div class="access-card-head"><div><small>МАССОВАЯ ВЫДАЧА</small><h2>Найти администраторов</h2></div><button class="button button-secondary" id="loadAccessCandidates" type="button">Загрузить никнеймы</button></div>' +
              '<p class="access-description">Получаем актуальный список и показываем только тех, у кого нет активного доступа.</p>' +
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

        window.addEventListener("br:remote-data-changed", function (event) {
          var action = event && event.detail ? event.detail.action : "";
          if (["access_grant", "access_manage"].indexOf(action) === -1) {
            return;
          }

          loadAccounts(
            document.getElementById("accessRegistryRoot")
          );
        });

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
(function () {
  "use strict";

  var COOKIE = "br_session";
  var REMEMBER_DAYS = 365;
  var STATS_CACHE_KEY = "br_all_stats_cache_v1";
  var notificationBadgeTimer = null;

  var NAV = {
    dashboard: ["pages/dashboard.html", "⌂", "Главная"],
    profile: ["pages/profile.html", "◉", "Мой профиль"],
    notifications: ["pages/notifications.html", "!", "Уведомления"],
    "game-activity": ["pages/game-activity.html", "◉", "Вход в игру"],
    normatives: ["pages/normatives.html", "↑", "Нормативы"],
    requests: ["pages/requests.html", "✦", "Мои обращения"],
    statistics: ["pages/statistics.html", "▥", "Моя статистика"],
    access: ["pages/access.html", "⚿", "Выдать доступ"],
    "admin-management": ["pages/admin-management.html", "♙", "Создание / удаление администратора"],
    "statistics-all": ["pages/statistics-all.html", "▥", "Статистика администрации"],
    "normatives-all": ["pages/normatives-all.html", "↑", "Проставка нормативов"],
    "requests-all": ["pages/requests-all.html", "✦", "Обращения администрации"],
    logs: ["pages/logs.html", "◷", "Журнал действий"],
    rules: ["pages/rules.html", "☷", "Регламент"],
    settings: ["pages/settings.html", "⚙", "Настройки"]
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function cookie(name) {
    var prefix = name + "=";
    var items = document.cookie ? document.cookie.split(";") : [];
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i].trim();
      if (item.indexOf(prefix) === 0) return decodeURIComponent(item.slice(prefix.length));
    }
    return null;
  }

  function saveCookie(name, value, maxAge) {
    document.cookie = name + "=" + encodeURIComponent(value) +
      "; Max-Age=" + maxAge + "; Path=/; Secure; SameSite=Lax";
  }

  function clearStorage() {
    try { localStorage.removeItem("br_session"); } catch (_) {}
    try { sessionStorage.removeItem("br_session"); } catch (_) {}
    try { sessionStorage.removeItem(STATS_CACHE_KEY); } catch (_) {}
    document.cookie = COOKIE + "=; Max-Age=0; Path=/; Secure; SameSite=Lax";
  }

  function isPageReload() {
    try {
      var entries = performance.getEntriesByType
        ? performance.getEntriesByType("navigation")
        : [];
      if (entries && entries.length && entries[0]) {
        return entries[0].type === "reload";
      }
    } catch (_) {}

    try {
      return !!performance.navigation &&
        performance.navigation.type === 1;
    } catch (_) {
      return false;
    }
  }

  function clearReloadCaches() {
    if (!isPageReload()) return;

    try { sessionStorage.removeItem(STATS_CACHE_KEY); } catch (_) {}
    try { sessionStorage.removeItem("br_statistics_cache"); } catch (_) {}
    try { sessionStorage.removeItem("br_all_statistics_cache"); } catch (_) {}
  }

  function getSession() {
    var raw = cookie(COOKIE);

    try {
      if (!raw) raw = sessionStorage.getItem("br_session");
    } catch (_) {}

    try {
      if (!raw) raw = localStorage.getItem("br_session");
    } catch (_) {}

    if (!raw) return null;

    try {
      var session = JSON.parse(raw);
      var expires = Number(session.expires);
      if (!session.user || !session.user.token || !Number.isFinite(expires) || expires <= Date.now()) {
        clearStorage();
        return null;
      }


      return session;
    } catch (_) {
      clearStorage();
      return null;
    }
  }

  function persistSession(session) {
    var data = JSON.stringify(session);

    try { localStorage.removeItem("br_session"); } catch (_) {}
    try { sessionStorage.removeItem("br_session"); } catch (_) {}

    try {
      document.cookie = COOKIE + "=; Max-Age=0; Path=/; Secure; SameSite=Lax";
    } catch (_) {}

    saveCookie(COOKIE, data, REMEMBER_DAYS * 86400);
  }

  function saveSession(user, expires, remember, lastActivityAt) {
    var activityAt = Number(lastActivityAt);
    if (!Number.isFinite(activityAt)) activityAt = Date.now();

    var session = {
      user: user,
      token: user.token,
      expires: expires,
      remember: true
    };

    try { localStorage.removeItem("br_session"); } catch (_) {}
    try { sessionStorage.removeItem("br_session"); } catch (_) {}

    persistSession(session);
  }


  function goToLogin() {
    clearStorage();
    if (timer) clearInterval(timer);
    timer = null;

    var loginUrl = new URL(
      document.body && document.body.dataset.page
        ? "../index.html"
        : "index.html",
      location.href
    ).href;

    location.replace(loginUrl);
  }

  function logout() {
    goToLogin();
  }

  function prepareMobileTables(root) {
    var scope = root || document;
    if (!scope || typeof scope.querySelectorAll !== "function") return;

    scope.querySelectorAll("#app .table-box table").forEach(function (table) {
      var tableBox = table.closest(".table-box");

      if (
        table.id === "allStatsTable" ||
        table.classList.contains("google-row-table") ||
        table.classList.contains("normative-table-desktop")
      ) {
        table.removeAttribute("data-mobile-cards");
        if (tableBox) {
          tableBox.removeAttribute("data-mobile-cards-container");
        }
        return;
      }

      table.setAttribute("data-mobile-cards", "true");
      if (tableBox) {
        tableBox.setAttribute("data-mobile-cards-container", "true");
      }

      var headerCells = table.querySelectorAll("thead th");
      if (!headerCells.length) return;

      var headers = Array.from(headerCells).map(function (cell) {
        return String(cell.textContent || "").trim();
      });

      table.querySelectorAll("tbody tr").forEach(function (row) {
        if (row.classList.contains("stats-section-row")) return;

        Array.from(row.children).forEach(function (cell, index) {
          if (cell.tagName !== "TD") return;

          var label = headers[index] || "Данные";
          if (!cell.getAttribute("data-mobile-label")) {
            cell.setAttribute("data-mobile-label", label);
          }
        });
      });
    });
  }

  function watchMobileTables() {
    prepareMobileTables(document);

    if (!window.MutationObserver || !document.body) return;

    var observer = new MutationObserver(function () {
      prepareMobileTables(document);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function applyTheme(theme) {
    var value = String(theme || "dark").toLowerCase() === "light" ? "light" : "dark";
    document.documentElement.classList.toggle("theme-light", value === "light");
    var themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute("content", value === "light" ? "#ffffff" : "#080a0f");
    try { localStorage.setItem("br_theme", value); } catch (_) {}
    return value;
  }

  function updateSessionUser(patch) {
    var session = getSession();
    if (!session || !session.user) return null;

    session.user = Object.assign({}, session.user, patch || {});
    persistSession(session);
    return session.user;
  }

  function management(user) {
    return !!user && user.role === "management";
  }

  function link(page) {
    var item = NAV[page];
    if (!item) {
      console.warn("[BR AdminTools] Пропущен неизвестный пункт меню:", page);
      return "";
    }

    var current = location.pathname.split("/").pop();
    var active = current === item[0].replace("pages/", "") ? " active" : "";
    var target = item[0];
    if (page === "admin-management") {
      target += "?v=20261004-2315";
    }

    var label = esc(item[2]);
    var badge = "";

    if (page === "notifications") {
      label =
        '<span class="side-link-label">' +
        label +
        "</span>";
      badge =
        '<span class="notification-menu-badge" id="notificationMenuBadge" aria-hidden="true"></span>';
    }

    return '<a class="side-link' + active + '" href="../' + target + '">' +
      "<span>" + item[1] + "</span>" + label + badge + "</a>";
  }

  function refreshNotificationBadge(token) {
    var badge = document.getElementById("notificationMenuBadge");

    if (!badge || !window.BR_API || typeof window.BR_API.notificationsList !== "function") {
      return Promise.resolve();
    }

    badge.classList.remove("is-visible");
    badge.setAttribute("aria-hidden", "true");

    return window.BR_API.notificationsList(token)
      .then(function (result) {
        var list =
          result && Array.isArray(result.notifications)
            ? result.notifications
            : [];

        var hasUnread = list.some(function (item) {
          return !item.is_read;
        });

        badge.classList.toggle("is-visible", hasUnread);
        badge.setAttribute("aria-hidden", hasUnread ? "false" : "true");
      })
      .catch(function (error) {
        console.warn(
          "[BR AdminTools] Не удалось обновить индикатор уведомлений:",
          error
        );
      });
  }

  function shell(user, title, subtitle, body) {
    var menu = management(user)
      ? '<div class="section-title">УПРАВЛЕНИЕ</div>' +
        link("access") + link("statistics-all") + link("admin-management") +
        link("notifications") + link("normatives-all") + link("requests-all") +
        '<div class="section-title">КОНТРОЛЬ</div>' + link("game-activity") + link("logs") + link("rules") +
        '<div class="section-title">СИСТЕМА</div>' + link("settings")
      : link("notifications") + link("normatives") + link("requests") +
        link("game-activity") + link("rules") +
        '<div class="section-title">СИСТЕМА</div>' + link("settings");

    return '<div class="panel">' +
      '<aside class="sidebar" id="sidebar">' +
        '<div class="brand"><div class="brand-logo">BR</div><div><b>BLACK RUSSIA</b><small>Мурманск • Admin Panel</small></div></div>' +
        '<div class="sidebar-menu">' +
          '<div class="section-title">ПАНЕЛЬ</div>' +
          link("dashboard") + link("profile") + menu +
        '</div>' +
        '<div class="sidebar-bottom">' +
          '<div class="user-mini"><div class="avatar">' +
            esc(String(user.nickname || "BR").slice(0, 2).toUpperCase()) +
          '</div><div><b>' + esc(user.nickname) + '</b><small>' +
            esc(user.position || "") + '</small></div></div>' +
          '<button class="logout" id="logout" type="button">Выйти</button>' +
        '</div>' +
      '</aside>' +
      '<div class="mobile-menu-backdrop" id="mobileMenuBackdrop" aria-hidden="true"></div>' +
      '<main class="main">' +
        '<header class="top"><button class="mobile-menu" id="mobileMenu" type="button" aria-label="Открыть меню">☰</button>' +
          '<span>АДМИНИСТРАЦИЯ • МУРМАНСК</span><div class="top-right"></div>' +
        '</header>' +
        '<section class="content"><div class="head"><h1>' + esc(title) + '</h1><p>' +
          esc(subtitle || "") + '</p></div>' + body + '</section>' +
        '<div class="watermark" aria-hidden="true"><div class="watermark-mark"><strong>BR</strong><span>' +
          esc(user.nickname) + '</span><small>BLACK RUSSIA • МУРМАНСК</small></div></div>' +
      '</main>' +
    '</div>';
  }

  function clearLegacyAppCache() {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      registrations.forEach(function (registration) {
        registration.unregister().catch(function () {});
      });
    }).catch(function () {});

    if (!("caches" in window)) return;

    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return /^br-admin/i.test(key);
          })
          .map(function (key) {
            return caches.delete(key);
          })
      );
    }).catch(function () {});
  }

  function init(options) {
    var root = document.getElementById("app");

    if (!root) return;

    clearLegacyAppCache();

    // При полноценном F5 / Ctrl+R его очищаем, чтобы страница получила
    // действительно свежие данные.
    clearReloadCaches();

    var session = getSession();

    // При обновлении страницы сохраняем текущий маршрут.
    // Авторизованная сессия хранится независимо от URL страницы,
    // поэтому обычный F5 не должен отправлять пользователя на вход.
    if (!session) {
      goToLogin();
      return;
    }

    applyTheme(session.user.theme || "dark");

    // API requests also report an expired server-side session.
    // There is no local idle/session countdown on the panel.
    window.addEventListener("br:session-expired", function (event) {
      console.error(
        "[BR AdminTools] Сервер завершил сессию:",
        {
          code: event && event.detail ? event.detail.code : "unknown",
          page: document.body && document.body.dataset.page
            ? document.body.dataset.page
            : "unknown"
        }
      );
      goToLogin();
    }, { once: true });

    if (options.managementOnly && !management(session.user)) {
      location.href = "../pages/dashboard.html";
      return;
    }

    root.innerHTML = shell(
      session.user,
      options.title,
      options.subtitle,
      options.render ? options.render(session.user) : ""
    );

    refreshNotificationBadge(session.user.token);

    if (notificationBadgeTimer) {
      clearInterval(notificationBadgeTimer);
    }

    notificationBadgeTimer = setInterval(function () {
      if (document.visibilityState === "hidden") return;
      var current = getSession();
      if (!current || !current.user || !current.user.token) {
        return;
      }
      refreshNotificationBadge(current.user.token);
    }, 20000);

    window.addEventListener("br:notifications-updated", function () {
      refreshNotificationBadge(session.user.token);
    });

    var logoutButton = document.getElementById("logout");
    if (logoutButton) logoutButton.onclick = logout;

    watchMobileTables();

    var menu = document.getElementById("mobileMenu");
    var sidebar = document.getElementById("sidebar");
    var menuBackdrop = document.getElementById("mobileMenuBackdrop");

    function setMobileMenu(open) {
      if (!menu || !sidebar) return;

      sidebar.classList.toggle("open", open);
      document.body.classList.toggle("mobile-menu-open", open);

      if (menuBackdrop) {
        menuBackdrop.classList.toggle("open", open);
        menuBackdrop.setAttribute("aria-hidden", open ? "false" : "true");
      }

      menu.textContent = open ? "×" : "☰";
      menu.setAttribute(
        "aria-label",
        open ? "Закрыть меню" : "Открыть меню"
      );
    }

    if (menu && sidebar) {
      menu.onclick = function (event) {
        event.preventDefault();
        event.stopPropagation();
        setMobileMenu(!sidebar.classList.contains("open"));
      };
    }

    if (menuBackdrop) {
      menuBackdrop.onclick = function () {
        setMobileMenu(false);
      };
    }

    if (sidebar) {
      sidebar.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
          setMobileMenu(false);
        });
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        setMobileMenu(false);
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 800) {
        setMobileMenu(false);
      }
    });


    if (options.bind) {
      try {
        options.bind(session.user);
      } catch (error) {
        console.error(
          "[BR AdminTools] Ошибка привязки обработчиков страницы:",
          error
        );
        throw error;
      }
    }


    function loadPageData() {
      if (!options.load) return Promise.resolve();

      return Promise.resolve(
        options.load(session.user, true)
      ).catch(function (error) {
        console.error(
          "[BR AdminTools] Ошибка загрузки страницы:",
          {
            page: options.active || document.body.getAttribute("data-page") || "unknown",
            code: error && error.code ? error.code : "PAGE_LOAD_ERROR",
            status: error && error.status ? error.status : null,
            message: error && error.message ? error.message : String(error),
            details: error && error.details ? error.details : null,
            error: error
          }
        );
      });
    }

    loadPageData();

    // A cached mobile page must never restore a stale menu lock.
    document.body.classList.remove("mobile-menu-open");

    window.addEventListener("pageshow", function (event) {
      if (!event.persisted) return;

      var currentSession = getSession();

      if (!currentSession) {
        goToLogin();
        return;
      }

      loadPageData();
    });
  }

  window.addEventListener("error", function (event) {
    console.error(
      "[BR AdminTools] Необработанная ошибка JavaScript:",
      {
        message: event && event.message,
        source: event && event.filename,
        line: event && event.lineno,
        column: event && event.colno,
        error: event && event.error
      }
    );
  });

  window.addEventListener("unhandledrejection", function (event) {
    console.error(
      "[BR AdminTools] Необработанное отклонение Promise:",
      event && event.reason
    );
  });

  window.BRApp = {
    esc: esc,
    getSession: getSession,
    saveSession: saveSession,
    clearSession: clearStorage,
    logout: logout,
    isManagement: management,
    applyTheme: applyTheme,
    updateSessionUser: updateSessionUser,
    init: init
  };
})();

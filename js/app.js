(function () {
    "use strict";

    var app = document.getElementById("app");
    var state = { user: null, page: "dashboard", file: null };
    var SESSION_MS = 3 * 60 * 1000;
    var sessionExpires = 0;
    var timerId = null;

    var USERS = {
        admin: { password: "admin123", nickname: "Nikita_Zvezda", position: "Руководство", role: "management" },
        test: { password: "test123", nickname: "Test_Admin", position: "Модератор", role: "admin" }
    };

    var ADMINS = [
        { nickname: "Nikita_Zvezda", position: "Руководство" },
        { nickname: "Test_Admin", position: "Модератор" },
        { nickname: "Alex_Murmansk", position: "Старший модератор" },
        { nickname: "Max_Admin", position: "Администратор" },
        { nickname: "Rus_Leader", position: "Следящий" }
    ];

    var POSITIONS = [
        "Младший модератор",
        "Модератор",
        "Старший модератор",
        "Администратор",
        "Старший администратор",
        "Следящий",
        "Старший следящий",
        "Следящий за силовыми организациями",
        "Старший следящий за силовыми организациями"
    ];

    function esc(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function storageGet(key, fallback) {
        try { var value = localStorage.getItem(key); return value === null ? fallback : value; } catch (e) { return fallback; }
    }

    function storageSet(key, value) {
        try { localStorage.setItem(key, value); } catch (e) {}
    }

    function getNormatives() {
        try {
            var data = JSON.parse(storageGet("br_normatives", "[]"));
            return Array.isArray(data) ? data : [];
        } catch (e) { return []; }
    }

    function saveNormative(item) {
        var list = getNormatives();
        list.unshift(item);
        storageSet("br_normatives", JSON.stringify(list.slice(0, 50)));
    }

    function showToast(text) {
        var old = document.querySelector(".toast");
        if (old) old.remove();
        var el = document.createElement("div");
        el.className = "toast";
        el.textContent = text;
        document.body.appendChild(el);
        setTimeout(function () { if (el.parentNode) el.remove(); }, 2500);
    }

    function resetSession() {
        if (!state.user) return;
        sessionExpires = Date.now() + SESSION_MS;
        storageSet("br_session", JSON.stringify({ user: state.user, expires: sessionExpires }));
        updateSessionUi();
    }

    function logout() {
        state.user = null;
        sessionExpires = 0;
        storageSet("br_session", "");
        if (timerId) clearInterval(timerId);
        timerId = null;
        render();
    }

    function restoreSession() {
        try {
            var saved = JSON.parse(storageGet("br_session", ""));
            if (saved && saved.user && saved.expires > Date.now()) {
                state.user = saved.user;
                sessionExpires = saved.expires;
                startTimer();
                return true;
            }
        } catch (e) {}
        return false;
    }

    function startTimer() {
        if (timerId) clearInterval(timerId);
        timerId = setInterval(function () {
            if (!state.user) return;
            if (Date.now() >= sessionExpires) {
                showToast("Сессия истекла");
                logout();
                return;
            }
            updateSessionUi();
        }, 1000);
        updateSessionUi();
    }

    function updateSessionUi() {
        var el = document.getElementById("sessionTimer");
        if (!el || !state.user) return;
        var seconds = Math.max(0, Math.ceil((sessionExpires - Date.now()) / 1000));
        var minutes = Math.floor(seconds / 60);
        var rest = String(seconds % 60).padStart(2, "0");
        el.textContent = "Сессия: " + minutes + ":" + rest;
    }

    ["click", "keydown", "touchstart", "pointerdown", "scroll"].forEach(function (eventName) {
        document.addEventListener(eventName, function () {
            if (state.user) resetSession();
        }, { passive: true });
    });

    function login(login, password) {
        var account = USERS[login.trim().toLowerCase()];
        if (!account || account.password !== password) return false;
        state.user = { nickname: account.nickname, position: account.position, role: account.role };
        state.page = "dashboard";
        resetSession();
        startTimer();
        render();
        return true;
    }

    function nav(page) {
        if (page === "normatives" && state.user.role === "management") {
            showToast("Руководству отправка нормативов не требуется");
            return;
        }
        state.page = page;
        render();
    }

    function renderLogin() {
        app.innerHTML = '<div class="login-page"><div class="login-card"><div class="login-brand"><div class="logo">BR</div><div class="brand-text"><strong>BLACK RUSSIA</strong><span>Мурманск • Admin Panel</span></div></div><h1>Авторизация</h1><p>Войдите в панель администрации сервера.</p><form class="login-form" id="loginForm"><div class="field"><label>Логин</label><input id="login" autocomplete="username" required></div><div class="field"><label>Пароль</label><input id="password" type="password" autocomplete="current-password" required></div><div id="loginError" class="error"></div><button class="button button-primary" type="submit">Войти</button></form></div></div>';
        document.getElementById("loginForm").addEventListener("submit", function (e) {
            e.preventDefault();
            var ok = login(document.getElementById("login").value, document.getElementById("password").value);
            if (!ok) document.getElementById("loginError").textContent = "Неверный логин или пароль";
        });
    }

    function navButton(page, icon, text) {
        var active = state.page === page ? " active" : "";
        return '<button class="nav-button' + active + '" data-page="' + page + '"><span class="nav-icon">' + icon + '</span><span>' + text + '</span></button>';
    }

    function renderSidebar() {
        var management = state.user.role === "management";
        return '<aside class="sidebar"><div class="brand"><div class="logo">BR</div><div class="brand-text"><strong>BLACK RUSSIA</strong><span>Мурманск • Admin Panel</span></div></div><nav class="nav"><div class="nav-section">ПАНЕЛЬ</div>' +
            navButton("dashboard", "⌂", "Главная") +
            navButton("profile", "◉", "Мой профиль") +
            (management ? navButton("admins", "♟", "Состав администрации") : navButton("normatives", "↑", "Нормативы")) +
            (management ? navButton("normatives-all", "▣", "Нормативы") : "") +
            '</nav><div class="sidebar-bottom"><div class="profile"><div class="avatar">' + esc(state.user.nickname.slice(0, 2).toUpperCase()) + '</div><div class="profile-text"><strong>' + esc(state.user.nickname) + '</strong><span>' + esc(state.user.position) + '</span></div></div><button class="button button-danger" id="logoutButton" style="width:100%;margin-top:8px">Выйти</button></div></aside>';
    }

    function renderTopbar() {
        return '<header class="topbar"><div class="topbar-left"><button class="button button-icon mobile-menu-button" id="menuButton">☰</button><span class="topbar-title">АДМИНИСТРАЦИЯ • МУРМАНСК</span></div><div class="topbar-right"><span id="sessionTimer" class="topbar-title"></span></div></header>';
    }

    function pageHead(title, subtitle) {
        return '<div class="page-head"><div class="page-head-main"><h1>' + esc(title) + '</h1><p>' + esc(subtitle) + '</p></div></div>';
    }

    function watermark() {
        return '<div class="watermark" aria-hidden="true">' + esc(state.user.nickname) + '</div>';
    }

    function dashboard() {
        return pageHead("Добро пожаловать", "Личный кабинет администрации Black Russia • Мурманск") +
            '<div class="grid stats-grid"><div class="stat-card"><span class="stat-label">НИКНЕЙМ</span><strong class="stat-value">' + esc(state.user.nickname) + '</strong></div><div class="stat-card"><span class="stat-label">ДОЛЖНОСТЬ</span><strong class="stat-value">' + esc(state.user.position) + '</strong></div><div class="stat-card"><span class="stat-label">СТАТИСТИКА</span><strong class="stat-value">Временно отключена</strong></div><div class="stat-card"><span class="stat-label">СЕССИЯ</span><strong class="stat-value" id="sessionCard">3:00</strong></div></div><div class="grid split-grid"><div class="card"><div class="card-head"><h2>Доступ</h2><span>' + (state.user.role === "management" ? "Руководство" : "Администратор") + '</span></div><div class="notice">Статистика временно отключена. Сейчас в панели используются только никнейм и должность из локального списка администрации.</div></div><div class="card"><div class="card-head"><h2>Безопасность</h2><span>Сессия</span></div><p style="color:var(--muted);font-size:11px;line-height:1.6;margin:0">Таймер автоматически продлевается при активности. При отсутствии активности в течение 3 минут произойдёт выход из аккаунта.</p></div></div>';
    }

    function profile() {
        return pageHead("Мой профиль", "Данные текущего администратора") + '<div class="card"><div class="form-grid"><div class="field"><label>Никнейм</label><input value="' + esc(state.user.nickname) + '" readonly></div><div class="field"><label>Должность</label><input value="' + esc(state.user.position) + '" readonly></div></div></div>';
    }

    function normatives() {
        var history = getNormatives().filter(function (x) { return x.nickname === state.user.nickname; });
        var rows = history.length ? history.map(function (x) { return '<tr><td>' + esc(x.date) + '</td><td>' + esc(x.position) + '</td><td>' + esc(x.file) + '</td><td>' + esc(x.comment || "—") + '</td></tr>'; }).join("") : '<tr><td colspan="4">Нормативы пока не отправлялись.</td></tr>';
        return pageHead("Нормативы", "Отправка файла с датой, должностью и комментарием") + '<div class="card"><form id="normativeForm"><div class="form-grid"><div class="field field-full"><label>Файл</label><div class="file-box"><input id="normativeFile" type="file" required><div id="fileInfo" class="file-info">Файл не выбран</div></div></div><div class="field"><label>Дата</label><input id="normativeDate" type="date" required value="' + new Date().toISOString().slice(0, 10) + '"></div><div class="field"><label>Должность</label><select id="normativePosition">' + POSITIONS.map(function (p) { return '<option>' + esc(p) + '</option>'; }).join("") + '</select></div><div class="field field-full"><label>Комментарий</label><textarea id="normativeComment" placeholder="Комментарий к нормативу"></textarea></div></div><div style="margin-top:15px"><button class="button button-primary" type="submit">Сохранить норматив</button></div></form></div><div class="card" style="margin-top:15px"><div class="card-head"><h2>Мои нормативы</h2><span>локально</span></div><div class="table-wrapper"><table><thead><tr><th>Дата</th><th>Должность</th><th>Файл</th><th>Комментарий</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    function admins() {
        return pageHead("Состав администрации", "Публичный список никнеймов и должностей") + '<div class="card"><div class="table-wrapper"><table><thead><tr><th>Никнейм</th><th>Должность</th></tr></thead><tbody>' + ADMINS.map(function (a) { return '<tr><td>' + esc(a.nickname) + '</td><td>' + esc(a.position) + '</td></tr>'; }).join("") + '</tbody></table></div></div>';
    }

    function normativeAll() {
        var list = getNormatives();
        var rows = list.length ? list.map(function (x) { return '<tr><td>' + esc(x.nickname) + '</td><td>' + esc(x.date) + '</td><td>' + esc(x.position) + '</td><td>' + esc(x.file) + '</td><td>' + esc(x.comment || "—") + '</td></tr>'; }).join("") : '<tr><td colspan="5">Отправленных нормативов нет.</td></tr>';
        return pageHead("Нормативы администрации", "Локальный журнал отправленных нормативов") + '<div class="card"><div class="table-wrapper"><table><thead><tr><th>Никнейм</th><th>Дата</th><th>Должность</th><th>Файл</th><th>Комментарий</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    function pageContent() {
        if (state.page === "profile") return profile();
        if (state.page === "normatives") return normatives();
        if (state.page === "admins") return admins();
        if (state.page === "normatives-all") return normativeAll();
        return dashboard();
    }

    function render() {
        if (!state.user) { renderLogin(); return; }
        app.innerHTML = '<div class="app">' + renderSidebar() + '<main class="main">' + renderTopbar() + '<section class="content">' + pageContent() + '</section></main>' + watermark() + '</div>';
        bindEvents();
        updateSessionUi();
    }

    function bindEvents() {
        document.querySelectorAll("[data-page]").forEach(function (button) {
            button.addEventListener("click", function () { nav(button.getAttribute("data-page")); });
        });
        var logoutButton = document.getElementById("logoutButton");
        if (logoutButton) logoutButton.addEventListener("click", logout);
        var menuButton = document.getElementById("menuButton");
        if (menuButton) menuButton.addEventListener("click", function () { document.querySelector(".sidebar").classList.toggle("mobile-open"); });
        var form = document.getElementById("normativeForm");
        if (form) {
            var fileInput = document.getElementById("normativeFile");
            fileInput.addEventListener("change", function () {
                var file = fileInput.files[0];
                document.getElementById("fileInfo").textContent = file ? file.name + " • " + Math.ceil(file.size / 1024) + " КБ" : "Файл не выбран";
            });
            form.addEventListener("submit", function (e) {
                e.preventDefault();
                var file = fileInput.files[0];
                if (!file) return;
                saveNormative({ nickname: state.user.nickname, date: document.getElementById("normativeDate").value, position: document.getElementById("normativePosition").value, comment: document.getElementById("normativeComment").value.trim(), file: file.name });
                showToast("Норматив сохранён локально");
                form.reset();
                render();
            });
        }
    }

    if (!restoreSession()) render();
})();

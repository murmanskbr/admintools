(function () {
    "use strict";

    var app = document.getElementById("app");
    var SESSION_MS = 180000;
    var timer = null;
    var expires = 0;
    var state = { user: null, page: "dashboard" };

    var USERS = {
        admin: { password: "Admin2026!", nickname: "Nikita_Zvezda", position: "Руководство", role: "management" },
        test: { password: "Test2026!", nickname: "Test_Admin", position: "Модератор", role: "admin" }
    };

    var ADMINS = [
        { nickname: "Nikita_Zvezda", position: "Руководство" },
        { nickname: "Test_Admin", position: "Модератор" },
        { nickname: "Alex_Murmansk", position: "Старший модератор" },
        { nickname: "Max_Admin", position: "Администратор" },
        { nickname: "Rus_Leader", position: "Следящий" }
    ];

    var POSITIONS = ["Младший модератор", "Модератор", "Старший модератор", "Администратор", "Старший администратор", "Следящий", "Старший следящий", "Следящий за силовыми организациями", "Старший следящий за силовыми организациями"];

    function esc(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function getStorage(key, fallback) {
        try {
            var value = localStorage.getItem(key);
            return value === null ? fallback : value;
        } catch (e) {
            return fallback;
        }
    }

    function setStorage(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {}
    }

    function getNormatives() {
        try {
            var value = JSON.parse(getStorage("br_normatives", "[]"));
            return Array.isArray(value) ? value : [];
        } catch (e) {
            return [];
        }
    }

    function showToast(text) {
        var old = document.querySelector(".toast");
        if (old) old.remove();
        var toast = document.createElement("div");
        toast.className = "toast";
        toast.textContent = text;
        document.body.appendChild(toast);
        setTimeout(function () {
            if (toast.parentNode) toast.remove();
        }, 2200);
    }

    function saveSession() {
        setStorage("br_session", JSON.stringify({ user: state.user, expires: expires }));
    }

    function resetSession() {
        if (!state.user) return;
        expires = Date.now() + SESSION_MS;
        saveSession();
        updateTimer();
    }

    function updateTimer() {
        if (!state.user) return;
        var seconds = Math.max(0, Math.ceil((expires - Date.now()) / 1000));
        var minutes = Math.floor(seconds / 60);
        var rest = String(seconds % 60).padStart(2, "0");
        var timerElement = document.getElementById("sessionTimer");
        var cardElement = document.getElementById("sessionCard");
        if (timerElement) timerElement.textContent = "Сессия: " + minutes + ":" + rest;
        if (cardElement) cardElement.textContent = minutes + ":" + rest;
    }

    function startTimer() {
        if (timer) clearInterval(timer);
        timer = setInterval(function () {
            if (!state.user) return;
            if (Date.now() >= expires) {
                logout();
                return;
            }
            updateTimer();
        }, 1000);
        updateTimer();
    }

    function logout() {
        state.user = null;
        state.page = "dashboard";
        expires = 0;
        setStorage("br_session", "");
        if (timer) clearInterval(timer);
        timer = null;
        render();
    }

    function login(loginValue, passwordValue) {
        var loginKey = String(loginValue || "").trim().toLowerCase();
        var account = USERS[loginKey];
        if (!account || account.password !== String(passwordValue || "")) return false;
        state.user = {
            nickname: account.nickname,
            position: account.position,
            role: account.role
        };
        state.page = "dashboard";
        expires = Date.now() + SESSION_MS;
        saveSession();
        startTimer();
        render();
        return true;
    }

    function restoreSession() {
        try {
            var saved = JSON.parse(getStorage("br_session", ""));
            if (!saved || !saved.user || !saved.expires || saved.expires <= Date.now()) return false;
            state.user = saved.user;
            expires = saved.expires;
            startTimer();
            return true;
        } catch (e) {
            return false;
        }
    }

    function activity() {
        if (state.user) resetSession();
    }

    ["click", "keydown", "touchstart", "pointerdown", "scroll"].forEach(function (eventName) {
        document.addEventListener(eventName, activity, { passive: true });
    });

    var eyeOpen = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.8"></circle></svg>';
    var eyeClosed = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"></path><path d="M10.6 5.2A10.7 10.7 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.1 3.7M6.2 6.2C3.8 8.2 2.5 12 2.5 12s3.5 6 9.5 6c1.5 0 2.8-.4 4-1"></path><path d="M9.9 9.9a2.8 2.8 0 0 0 4.2 4.2"></path></svg>';

    function renderLogin() {
        app.innerHTML = '<div class="login-page"><div class="login-card"><div class="login-brand"><div class="logo">BR</div><div class="brand-text"><strong>BLACK RUSSIA</strong><span>Мурманск • Admin Panel</span></div></div><h1>Авторизация</h1><p>Войдите в панель администрации сервера.</p><form class="login-form" id="loginForm"><div class="field"><label>Логин</label><input id="login" autocomplete="username" required></div><div class="field"><label>Пароль</label><div class="password-box"><input id="password" type="password" autocomplete="current-password" required><button type="button" id="passwordToggle" class="password-eye" aria-label="Показать пароль" title="Показать пароль">' + eyeOpen + '</button></div></div><div id="loginError" class="error"></div><button class="button button-primary" type="submit">Войти</button><div class="demo-credentials"><strong>Тестовые данные</strong><span>admin / Admin2026!</span><span>test / Test2026!</span></div></form></div></div>';

        var password = document.getElementById("password");
        var toggle = document.getElementById("passwordToggle");
        var form = document.getElementById("loginForm");

        toggle.addEventListener("click", function () {
            var visible = password.type === "text";
            password.type = visible ? "password" : "text";
            toggle.innerHTML = visible ? eyeOpen : eyeClosed;
            toggle.setAttribute("aria-label", visible ? "Показать пароль" : "Скрыть пароль");
        });

        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var success = login(document.getElementById("login").value, password.value);
            if (!success) {
                document.getElementById("loginError").textContent = "Неверный логин или пароль";
            }
        });
    }

    function navButton(page, icon, text) {
        return '<button class="nav-button' + (state.page === page ? " active" : "") + '" data-page="' + page + '"><span class="nav-icon">' + icon + '</span><span>' + text + '</span></button>';
    }

    function renderSidebar() {
        var management = state.user.role === "management";
        return '<aside class="sidebar"><div class="brand"><div class="logo">BR</div><div class="brand-text"><strong>BLACK RUSSIA</strong><span>Мурманск • Admin Panel</span></div></div><nav class="nav"><div class="nav-section">ПАНЕЛЬ</div>' + navButton("dashboard", "⌂", "Главная") + navButton("profile", "◉", "Мой профиль") + (management ? navButton("admins", "♟", "Состав администрации") : navButton("normatives", "↑", "Нормативы")) + (management ? navButton("normatives-all", "▣", "Нормативы") : "") + '</nav><div class="sidebar-bottom"><div class="profile"><div class="avatar">' + esc(state.user.nickname.substring(0, 2).toUpperCase()) + '</div><div class="profile-text"><strong>' + esc(state.user.nickname) + '</strong><span>' + esc(state.user.position) + '</span></div></div><button class="button button-danger" id="logoutButton" style="width:100%;margin-top:8px">Выйти</button></div></aside>';
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
        return pageHead("Добро пожаловать", "Личный кабинет администрации Black Russia • Мурманск") + '<div class="grid stats-grid"><div class="stat-card"><span class="stat-label">НИКНЕЙМ</span><strong class="stat-value">' + esc(state.user.nickname) + '</strong></div><div class="stat-card"><span class="stat-label">ДОЛЖНОСТЬ</span><strong class="stat-value">' + esc(state.user.position) + '</strong></div><div class="stat-card"><span class="stat-label">СТАТИСТИКА</span><strong class="stat-value">Временно отключена</strong></div><div class="stat-card"><span class="stat-label">СЕССИЯ</span><strong class="stat-value" id="sessionCard">3:00</strong></div></div><div class="grid split-grid"><div class="card"><div class="card-head"><h2>Доступ</h2><span>' + (state.user.role === "management" ? "Руководство" : "Администратор") + '</span></div><div class="notice">Статистика временно отключена. Сейчас используются только никнейм и должность.</div></div><div class="card"><div class="card-head"><h2>Безопасность</h2><span>Сессия</span></div><p style="color:var(--muted);font-size:11px;line-height:1.6;margin:0">Таймер автоматически продлевается при активности. При отсутствии активности в течение 3 минут произойдёт выход.</p></div></div>';
    }

    function profile() {
        return pageHead("Мой профиль", "Данные текущего администратора") + '<div class="card"><div class="form-grid"><div class="field"><label>Никнейм</label><input value="' + esc(state.user.nickname) + '" readonly></div><div class="field"><label>Должность</label><input value="' + esc(state.user.position) + '" readonly></div></div></div>';
    }

    function normatives() {
        var history = getNormatives().filter(function (item) { return item.nickname === state.user.nickname; });
        var rows = history.length ? history.map(function (item) { return '<tr><td>' + esc(item.date) + '</td><td>' + esc(item.position) + '</td><td>' + esc(item.file) + '</td><td>' + esc(item.comment || "—") + '</td></tr>'; }).join("") : '<tr><td colspan="4">Нормативы пока не отправлялись.</td></tr>';
        return pageHead("Нормативы", "Отправка файла с датой, должностью и комментарием") + '<div class="card"><form id="normativeForm"><div class="form-grid"><div class="field field-full"><label>Файл</label><div class="file-box"><input id="normativeFile" type="file" required><div id="fileInfo" class="file-info">Файл не выбран</div></div></div><div class="field"><label>Дата</label><input id="normativeDate" type="date" required></div><div class="field"><label>Должность</label><select id="normativePosition">' + POSITIONS.map(function (position) { return '<option>' + esc(position) + '</option>'; }).join("") + '</select></div><div class="field field-full"><label>Комментарий</label><textarea id="normativeComment" placeholder="Комментарий к нормативу"></textarea></div></div><div style="margin-top:15px"><button class="button button-primary" type="submit">Сохранить норматив</button></div></form></div><div class="card" style="margin-top:15px"><div class="card-head"><h2>Мои нормативы</h2><span>локально</span></div><div class="table-wrapper"><table><thead><tr><th>Дата</th><th>Должность</th><th>Файл</th><th>Комментарий</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    function admins() {
        return pageHead("Состав администрации", "Публичный список никнеймов и должностей") + '<div class="card"><div class="table-wrapper"><table><thead><tr><th>Никнейм</th><th>Должность</th></tr></thead><tbody>' + ADMINS.map(function (admin) { return '<tr><td>' + esc(admin.nickname) + '</td><td>' + esc(admin.position) + '</td></tr>'; }).join("") + '</tbody></table></div></div>';
    }

    function normativeAll() {
        var list = getNormatives();
        var rows = list.length ? list.map(function (item) { return '<tr><td>' + esc(item.nickname) + '</td><td>' + esc(item.date) + '</td><td>' + esc(item.position) + '</td><td>' + esc(item.file) + '</td><td>' + esc(item.comment || "—") + '</td></tr>'; }).join("") : '<tr><td colspan="5">Отправленных нормативов нет.</td></tr>';
        return pageHead("Нормативы администрации", "Локальный журнал отправленных нормативов") + '<div class="card"><div class="table-wrapper"><table><thead><tr><th>Никнейм</th><th>Дата</th><th>Должность</th><th>Файл</th><th>Комментарий</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    function content() {
        if (state.page === "profile") return profile();
        if (state.page === "normatives") return normatives();
        if (state.page === "admins") return admins();
        if (state.page === "normatives-all") return normativeAll();
        return dashboard();
    }

    function bind() {
        document.querySelectorAll("[data-page]").forEach(function (button) {
            button.addEventListener("click", function () {
                state.page = button.getAttribute("data-page");
                render();
            });
        });

        var logoutButton = document.getElementById("logoutButton");
        if (logoutButton) logoutButton.addEventListener("click", logout);

        var menuButton = document.getElementById("menuButton");
        if (menuButton) menuButton.addEventListener("click", function () {
            var sidebar = document.querySelector(".sidebar");
            if (sidebar) sidebar.classList.toggle("mobile-open");
        });

        var form = document.getElementById("normativeForm");
        if (!form) return;

        var fileInput = document.getElementById("normativeFile");
        fileInput.addEventListener("change", function () {
            var file = fileInput.files[0];
            document.getElementById("fileInfo").textContent = file ? file.name : "Файл не выбран";
        });

        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var file = fileInput.files[0];
            if (!file) return;
            var list = getNormatives();
            list.unshift({
                nickname: state.user.nickname,
                date: document.getElementById("normativeDate").value,
                position: document.getElementById("normativePosition").value,
                file: file.name,
                comment: document.getElementById("normativeComment").value.trim()
            });
            setStorage("br_normatives", JSON.stringify(list.slice(0, 50)));
            showToast("Норматив сохранён локально");
            render();
        });
    }

    function render() {
        if (!state.user) {
            renderLogin();
            return;
        }

        app.innerHTML = '<div class="app">' + renderSidebar() + '<main class="main">' + renderTopbar() + '<section class="content">' + content() + '</section></main>' + watermark() + '</div>';
        bind();
        updateTimer();
    }

    window.addEventListener("error", function (event) {
        if (!state.user) return;
        app.innerHTML = '<div class="login-page"><div class="login-card"><h1>Ошибка панели</h1><p>Произошла ошибка при загрузке панели. Обновите страницу.</p><button class="button button-primary" onclick="location.reload()">Обновить</button></div></div>';
        console.error(event.error || event.message);
    });

    if (!restoreSession()) render();
})();
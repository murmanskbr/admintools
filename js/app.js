(function () {
    "use strict";

    var app = document.getElementById("app");
    var SESSION_MS = 180000;
    var timer = null;
    var state = { user: null, expires: 0, page: "dashboard" };

    var USERS = {
        admin: { password: "Admin2026!", nickname: "Nikita_Zvezda", position: "Руководство", role: "management" },
        test: { password: "Test2026!", nickname: "Test_Admin", position: "Модератор", role: "admin" }
    };

    var ADMINS = [
        ["Nikita_Zvezda", "Руководство"],
        ["Test_Admin", "Модератор"],
        ["Alex_Murmansk", "Старший модератор"],
        ["Max_Admin", "Администратор"],
        ["Rus_Leader", "Следящий"]
    ];

    function esc(v) {
        return String(v == null ? "" : v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
    }

    function storage(key, value) {
        try {
            if (value === undefined) return localStorage.getItem(key);
            if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
        } catch (e) {}
    }

    function saveSession() {
        storage("br_session", JSON.stringify({ user: state.user, expires: state.expires }));
    }

    function loadSession() {
        try {
            var data = JSON.parse(storage("br_session") || "null");
            if (!data || !data.user || data.expires <= Date.now()) return false;
            state.user = data.user;
            state.expires = data.expires;
            startTimer();
            return true;
        } catch (e) { return false; }
    }

    function renewSession() {
        if (!state.user) return;
        state.expires = Date.now() + SESSION_MS;
        saveSession();
        updateTimer();
    }

    function startTimer() {
        if (timer) clearInterval(timer);
        timer = setInterval(function () {
            if (!state.user) return;
            if (Date.now() >= state.expires) return logout();
            updateTimer();
        }, 1000);
        updateTimer();
    }

    function updateTimer() {
        if (!state.user) return;
        var seconds = Math.max(0, Math.ceil((state.expires - Date.now()) / 1000));
        var text = Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
        var top = document.getElementById("sessionTimer");
        var card = document.getElementById("sessionCard");
        if (top) top.textContent = "Сессия " + text;
        if (card) card.textContent = text;
    }

    function logout() {
        state.user = null;
        state.expires = 0;
        state.page = "dashboard";
        storage("br_session", null);
        if (timer) clearInterval(timer);
        timer = null;
        render();
    }

    ["click", "keydown", "touchstart", "pointerdown", "scroll"].forEach(function (name) {
        document.addEventListener(name, function () { if (state.user) renewSession(); }, { passive: true });
    });

    function login(loginValue, passwordValue) {
        var key = String(loginValue || "").trim().toLowerCase();
        var account = USERS[key];
        if (!account || account.password !== String(passwordValue || "")) return false;
        state.user = { nickname: account.nickname, position: account.position, role: account.role };
        state.page = "dashboard";
        renewSession();
        startTimer();
        render();
        return true;
    }

    function eye(hidden) {
        return hidden ? '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 5.2A10.8 10.8 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.1 3.7M6.2 6.2C3.8 8.3 2.5 12 2.5 12s3.5 6 9.5 6c1.5 0 2.8-.4 4-1"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.8"/></svg>';
    }

    function renderLogin() {
        app.innerHTML = '<main class="login-page"><section class="login-card"><div class="login-brand"><div class="login-logo">BR</div><div><b>BLACK RUSSIA</b><small>Мурманск • Admin Panel</small></div></div><h1>Авторизация</h1><p>Войдите в панель администрации сервера.</p><form id="loginForm"><label>Логин</label><input id="login" autocomplete="username" required><label>Пароль</label><div class="password-wrap"><input id="password" type="password" autocomplete="current-password" required><button id="eye" type="button" aria-label="Показать пароль">' + eye(false) + '</button></div><div id="loginError" class="login-error"></div><button class="login-submit" type="submit">Войти</button><div class="demo"><b>Тестовые данные</b><span>admin / Admin2026!</span><span>test / Test2026!</span></div></form></section></main>';
        var password = document.getElementById("password");
        var eyeButton = document.getElementById("eye");
        eyeButton.onclick = function () {
            var visible = password.type === "text";
            password.type = visible ? "password" : "text";
            eyeButton.innerHTML = eye(!visible);
            eyeButton.setAttribute("aria-label", visible ? "Показать пароль" : "Скрыть пароль");
        };
        document.getElementById("loginForm").onsubmit = function (e) {
            e.preventDefault();
            if (!login(document.getElementById("login").value, password.value)) document.getElementById("loginError").textContent = "Неверный логин или пароль";
        };
    }

    function nav(page, icon, text) {
        return '<button class="side-link ' + (state.page === page ? 'active' : '') + '" data-page="' + page + '"><span>' + icon + '</span>' + text + '</button>';
    }

    function layout(body) {
        var management = state.user.role === "management";
        return '<div class="panel"><aside class="sidebar"><div class="brand"><div class="brand-logo">BR</div><div><b>BLACK RUSSIA</b><small>Мурманск • Admin Panel</small></div></div><div class="section-title">ПАНЕЛЬ</div>' + nav("dashboard", "⌂", "Главная") + nav("profile", "◉", "Мой профиль") + (management ? nav("admins", "♟", "Состав администрации") : nav("normatives", "↑", "Нормативы")) + (management ? nav("normatives-all", "▣", "Нормативы") : "") + '<div class="sidebar-bottom"><div class="user-mini"><div class="avatar">' + esc(state.user.nickname.slice(0,2).toUpperCase()) + '</div><div><b>' + esc(state.user.nickname) + '</b><small>' + esc(state.user.position) + '</small></div></div><button id="logout" class="logout">Выйти</button></div></aside><main class="main"><header class="top"><button id="mobileMenu" class="mobile-menu">☰</button><span>АДМИНИСТРАЦИЯ • МУРМАНСК</span><span id="sessionTimer">Сессия 3:00</span></header><section class="content">' + body + '</section><div class="watermark">' + esc(state.user.nickname) + '</div></main></div>';
    }

    function head(title, subtitle) { return '<div class="head"><h1>' + esc(title) + '</h1><p>' + esc(subtitle) + '</p></div>'; }

    function dashboard() {
        return head("Добро пожаловать", "Личный кабинет администрации Black Russia • Мурманск") + '<div class="cards"><div class="card"><small>НИКНЕЙМ</small><b>' + esc(state.user.nickname) + '</b></div><div class="card"><small>ДОЛЖНОСТЬ</small><b>' + esc(state.user.position) + '</b></div><div class="card"><small>СТАТИСТИКА</small><b>Временно отключена</b></div><div class="card"><small>СЕССИЯ</small><b id="sessionCard">3:00</b></div></div><div class="columns"><div class="box"><h2>Доступ</h2><p>Уровень доступа: <b>' + (state.user.role === "management" ? "Руководство" : "Администратор") + '</b></p><p>Сейчас используются никнейм и должность. Модуль статистики временно отключён.</p></div><div class="box"><h2>Безопасность</h2><p>Сессия длится 3 минуты и автоматически продлевается при активности.</p></div></div>';
    }

    function profile() { return head("Мой профиль", "Данные текущего администратора") + '<div class="box form-box"><label>Никнейм<input value="' + esc(state.user.nickname) + '" readonly></label><label>Должность<input value="' + esc(state.user.position) + '" readonly></label></div>'; }

    function admins() {
        return head("Состав администрации", "Публичный список никнеймов и должностей") + '<div class="box table-box"><table><thead><tr><th>Никнейм</th><th>Должность</th></tr></thead><tbody>' + ADMINS.map(function (a) { return '<tr><td>' + esc(a[0]) + '</td><td>' + esc(a[1]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    }

    function normatives() {
        var list = [];
        try { list = JSON.parse(storage("br_normatives") || "[]"); } catch (e) { list = []; }
        if (!Array.isArray(list)) list = [];
        list = list.filter(function (x) { return x.nickname === state.user.nickname; });
        return head("Нормативы", "Локальная отправка нормативов") + '<div class="box"><form id="normForm"><label>Файл<input id="file" type="file" required></label><label>Дата<input id="date" type="date" required></label><label>Комментарий<textarea id="comment"></textarea></label><button class="primary">Сохранить норматив</button></form></div><div class="box table-box" style="margin-top:16px"><h2>Мои нормативы</h2><table><thead><tr><th>Дата</th><th>Файл</th><th>Комментарий</th></tr></thead><tbody>' + (list.length ? list.map(function (x) { return '<tr><td>' + esc(x.date) + '</td><td>' + esc(x.file) + '</td><td>' + esc(x.comment || '—') + '</td></tr>'; }).join('') : '<tr><td colspan="3">Нормативов пока нет.</td></tr>') + '</tbody></table></div>';
    }

    function allNormatives() { return head("Нормативы администрации", "Локальный журнал отправленных нормативов") + '<div class="box"><p>Раздел руководства. Данные сохраняются локально в браузере.</p></div>'; }

    function page() {
        if (state.page === "profile") return profile();
        if (state.page === "admins") return admins();
        if (state.page === "normatives") return normatives();
        if (state.page === "normatives-all") return allNormatives();
        return dashboard();
    }

    function bind() {
        document.querySelectorAll("[data-page]").forEach(function (button) { button.onclick = function () { state.page = button.getAttribute("data-page"); render(); }; });
        var logoutButton = document.getElementById("logout");
        if (logoutButton) logoutButton.onclick = logout;
        var mobile = document.getElementById("mobileMenu");
        if (mobile) mobile.onclick = function () { document.querySelector(".sidebar").classList.toggle("open"); };
        var form = document.getElementById("normForm");
        if (form) form.onsubmit = function (e) {
            e.preventDefault();
            var data = [];
            try { data = JSON.parse(storage("br_normatives") || "[]"); } catch (x) { data = []; }
            if (!Array.isArray(data)) data = [];
            var file = document.getElementById("file").files[0];
            data.unshift({ nickname: state.user.nickname, date: document.getElementById("date").value, file: file ? file.name : "", comment: document.getElementById("comment").value });
            storage("br_normatives", JSON.stringify(data));
            render();
        };
    }

    function styles() {
        return '<style>:root{--bg:#080a0f;--panel:#10131a;--line:#252a35;--muted:#8992a2;--text:#fff;--red:#ff3048}*{box-sizing:border-box}body{margin:0;background:var(--bg)}.login-page{min-height:100vh;display:grid;place-items:center;padding:24px;background:var(--bg);color:#fff;font-family:Arial,sans-serif}.login-card{width:min(100%,390px);padding:30px;border:1px solid var(--line);border-radius:18px;background:var(--panel);box-shadow:0 25px 70px #0008}.login-brand{display:flex;align-items:center;gap:12px;margin-bottom:34px}.login-logo,.brand-logo{width:40px;height:40px;border-radius:11px;background:var(--red);display:grid;place-items:center;font-weight:800}.login-brand b,.brand b{display:block;font-size:13px}.login-brand small,.brand small{display:block;color:var(--muted);font-size:9px;margin-top:3px}.login-card h1{font-size:25px;margin:0 0 7px}.login-card>p{font-size:11px;color:var(--muted);margin:0 0 25px}.login-card label{display:block;font-size:10px;color:#9aa3b3;margin:0 0 7px}.login-card input{width:100%;height:44px;box-sizing:border-box;border:1px solid #2a303d;border-radius:9px;background:#151922;color:#fff;padding:0 13px;outline:none;margin-bottom:17px}.password-wrap{position:relative}.password-wrap input{padding-right:48px}.password-wrap button{position:absolute;right:4px;top:0;width:40px;height:44px;border:0;background:transparent;color:#8992a2;cursor:pointer}.password-wrap svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.login-submit{width:100%;height:44px;border:0;border-radius:9px;background:var(--red);color:#fff;font-weight:700;cursor:pointer}.login-error{min-height:17px;color:#ff596b;font-size:10px}.demo{margin-top:18px;padding:12px;border-radius:9px;background:#151922;color:#8992a2;font-size:10px;line-height:1.7}.demo b,.demo span{display:block}.demo b{color:#fff}.panel{min-height:100vh;background:var(--bg);color:var(--text);font-family:Arial,sans-serif;display:flex}.sidebar{width:245px;min-height:100vh;background:#0d1016;border-right:1px solid var(--line);padding:22px;display:flex;flex-direction:column;flex-shrink:0}.brand{display:flex;align-items:center;gap:10px;margin-bottom:35px}.section-title{color:#697181;font-size:9px;margin-bottom:9px}.side-link{width:100%;height:40px;margin-bottom:5px;border:0;border-radius:8px;background:transparent;color:#9da5b4;text-align:left;padding:0 12px;cursor:pointer;font-size:11px}.side-link span{display:inline-block;width:24px}.side-link:hover,.side-link.active{background:#181c25;color:#fff}.side-link.active{box-shadow:inset 2px 0 var(--red)}.sidebar-bottom{margin-top:auto}.user-mini{display:flex;align-items:center;gap:9px;padding:10px 0}.avatar{width:34px;height:34px;border-radius:50%;background:#202532;display:grid;place-items:center;font-size:10px;font-weight:700}.user-mini b,.user-mini small{display:block}.user-mini b{font-size:10px}.user-mini small{font-size:8px;color:var(--muted);margin-top:3px}.logout{width:100%;height:38px;border:1px solid #3a2026;border-radius:8px;background:#171117;color:#ff6476;cursor:pointer}.main{position:relative;flex:1;min-width:0}.top{height:64px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:15px;padding:0 30px;color:#8992a2;font-size:10px}.top span:last-child{margin-left:auto}.mobile-menu{display:none}.content{padding:34px;max-width:1200px;margin:auto}.head{margin-bottom:25px}.head h1{font-size:28px;margin:0 0 6px}.head p{color:var(--muted);font-size:11px;margin:0}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.card,.box{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px}.card small{display:block;color:#737d8e;font-size:9px;margin-bottom:10px}.card b{font-size:14px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.box h2{font-size:14px;margin:0 0 12px}.box p{font-size:11px;color:var(--muted);line-height:1.6}.form-box{max-width:700px;display:grid;grid-template-columns:1fr 1fr;gap:16px}.box label{display:block;color:#9aa3b3;font-size:10px}.box input,.box textarea{width:100%;margin-top:7px;background:#151922;border:1px solid #2a303d;border-radius:8px;color:#fff;padding:11px;outline:0}.box textarea{min-height:100px}.primary{margin-top:16px;background:var(--red);color:#fff;border:0;border-radius:8px;padding:12px 18px;cursor:pointer}.table-box{overflow:auto}.table-box table{width:100%;border-collapse:collapse;font-size:10px}.table-box th,.table-box td{text-align:left;padding:12px;border-bottom:1px solid var(--line)}.table-box th{color:#737d8e}.watermark{position:fixed;right:18px;bottom:12px;color:#fff2;font-size:10px;pointer-events:none}@media(max-width:800px){.sidebar{position:fixed;z-index:10;left:-260px;transition:.2s}.sidebar.open{left:0}.mobile-menu{display:block;background:none;border:0;color:#fff;font-size:20px}.top{padding:0 16px}.content{padding:22px 16px}.cards{grid-template-columns:1fr 1fr}.columns{grid-template-columns:1fr}.form-box{grid-template-columns:1fr}}@media(max-width:480px){.cards{grid-template-columns:1fr}.head h1{font-size:23px}.top{font-size:8px}}</style>';
    }

    function render() {
        if (!state.user) { app.innerHTML = styles(); renderLogin(); return; }
        app.innerHTML = styles() + layout(page());
        bind();
        updateTimer();
    }

    if (!loadSession()) render();
})();

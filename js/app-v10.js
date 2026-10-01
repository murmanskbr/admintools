(function () {
    "use strict";

    var app = document.getElementById("app");

    if (!app) {
        console.error("[BR AdminTools] #app не найден");
        return;
    }

    var SESSION_MS = 180000;
    var timer = null;
    var lastActivity = 0;

    var state = {
        user: null,
        expires: 0,
        page: "dashboard"
    };

    var USERS = {
        admin: {
            password: "Admin2026!",
            nickname: "Nikita_Zvezda",
            position: "Руководство",
            role: "management"
        },
        test: {
            password: "Test2026!",
            nickname: "Test_Admin",
            position: "Модератор",
            role: "admin"
        }
    };

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

    function getJSON(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            if (raw === null) {
                return fallback;
            }

            var value = JSON.parse(raw);
            return value == null ? fallback : value;
        } catch (error) {
            console.error("[BR AdminTools] JSON error:", key, error);
            return fallback;
        }
    }

    function setJSON(key, value) {
        try {
            localStorage.setItem(
                key,
                JSON.stringify(value)
            );
        } catch (error) {
            console.error("[BR AdminTools] Storage write error:", error);
        }
    }

    function removeStorage(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error("[BR AdminTools] Storage remove error:", key, error);
        }
    }

    function addLog(action, details) {
        var logs =
            getJSON(
                "br_logs",
                []
            );

        if (!Array.isArray(logs)) {
            logs = [];
        }

        logs.unshift({
            time:
                new Date().toISOString(),

            nickname:
                state.user
                    ? state.user.nickname
                    : "guest",

            action:
                action,

            details:
                details || ""
        });

        setJSON(
            "br_logs",
            logs.slice(
                0,
                300
            )
        );

        console.info(
            "[BR AdminTools]",
            action,
            details || ""
        );
    }

    function saveSession() {
        if (!state.user) {
            return;
        }

        setJSON(
            "br_session",
            {
                user:
                    state.user,

                expires:
                    state.expires
            }
        );
    }

    function restoreSession() {
        var session =
            getJSON(
                "br_session",
                null
            );

        if (
            !session ||
            !session.user ||
            !session.expires ||
            session.expires <=
                Date.now()
        ) {
            removeStorage(
                "br_session"
            );

            return false;
        }

        state.user =
            session.user;

        state.expires =
            session.expires;

        startTimer();

        console.info(
            "[BR AdminTools] Сессия восстановлена"
        );

        return true;
    }

    function renewSession() {
        if (!state.user) {
            return;
        }

        state.expires =
            Date.now() +
            SESSION_MS;

        saveSession();

        updateTimer();
    }

    function updateTimer() {
        if (!state.user) {
            return;
        }

        var seconds =
            Math.max(
                0,
                Math.ceil(
                    (
                        state.expires -
                        Date.now()
                    ) /
                    1000
                )
            );

        var minutes =
            Math.floor(
                seconds / 60
            );

        var rest =
            String(
                seconds % 60
            ).padStart(
                2,
                "0"
            );

        var text =
            minutes +
            ":" +
            rest;

        var top =
            document.getElementById(
                "sessionTimer"
            );

        var card =
            document.getElementById(
                "sessionCard"
            );

        if (top) {
            top.textContent =
                "Сессия " +
                text;
        }

        if (card) {
            card.textContent =
                text;
        }
    }

    function startTimer() {
        if (timer) {
            clearInterval(
                timer
            );
        }

        timer =
            setInterval(
                function () {
                    if (!state.user) {
                        return;
                    }

                    if (
                        Date.now() >=
                        state.expires
                    ) {
                        addLog(
                            "session_expired",
                            "Автоматический выход после 3 минут бездействия"
                        );

                        logout(
                            true
                        );

                        return;
                    }

                    updateTimer();
                },
                1000
            );

        updateTimer();
    }

    function stopTimer() {
        if (timer) {
            clearInterval(
                timer
            );
        }

        timer = null;
    }

    function logout(expired) {
        if (state.user && !expired) {
            addLog(
                "logout",
                "Ручной выход"
            );
        }

        state.user = null;
        state.expires = 0;
        state.page = "dashboard";

        removeStorage(
            "br_session"
        );

        stopTimer();

        render();
    }

    function activity() {
        if (!state.user) {
            return;
        }

        var now =
            Date.now();

        if (
            now -
            lastActivity <
            500
        ) {
            return;
        }

        lastActivity =
            now;

        renewSession();
    }

    [
        "click",
        "keydown",
        "touchstart",
        "pointerdown",
        "scroll"
    ].forEach(
        function (
            eventName
        ) {
            document.addEventListener(
                eventName,
                activity,
                {
                    passive: true
                }
            );
        }
    );

    function eyeIcon(closed) {
        if (closed) {
            return (
                '<svg viewBox="0 0 24 24">' +
                    '<path d="M3 3l18 18"/>' +
                    '<path d="M10.6 5.2A10.8 10.8 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.1 3.7"/>' +
                    '<path d="M6.2 6.2C3.8 8.3 2.5 12 2.5 12s3.5 6 9.5 6c1.5 0 2.8-.4 4-1"/>' +
                '</svg>'
            );
        }

        return (
            '<svg viewBox="0 0 24 24">' +
                '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/>' +
                '<circle cx="12" cy="12" r="2.8"/>' +
            '</svg>'
        );
    }

    function renderLogin() {
        app.innerHTML =
            '<main class="login-page">' +
                '<section class="login-card">' +

                    '<div class="login-brand">' +

                        '<div class="login-logo">' +
                            'BR' +
                        '</div>' +

                        '<div>' +
                            '<b>BLACK RUSSIA</b>' +
                            '<small>Мурманск • Admin Panel</small>' +
                        '</div>' +

                    '</div>' +

                    '<h1>Авторизация</h1>' +

                    '<p>' +
                        'Войдите в панель администрации сервера.' +
                    '</p>' +

                    '<form class="login-form" id="loginForm">' +

                        '<label for="login">' +
                            'Логин' +
                        '</label>' +

                        '<input ' +
                            'id="login" ' +
                            'autocomplete="username" ' +
                            'spellcheck="false" ' +
                            'required' +
                        '>' +

                        '<label for="password">' +
                            'Пароль' +
                        '</label>' +

                        '<div class="password-wrap">' +

                            '<input ' +
                                'id="password" ' +
                                'type="password" ' +
                                'autocomplete="current-password" ' +
                                'required' +
                            '>' +

                            '<button ' +
                                'class="password-eye" ' +
                                'id="passwordEye" ' +
                                'type="button" ' +
                                'aria-label="Показать пароль" ' +
                                'title="Показать пароль"' +
                            '>' +

                                eyeIcon(false) +

                            '</button>' +

                        '</div>' +

                        '<div ' +
                            'id="loginError" ' +
                            'class="login-error"' +
                        '></div>' +

                        '<button ' +
                            'class="login-submit" ' +
                            'type="submit"' +
                        '>' +
                            'Войти' +
                        '</button>' +

                        '<div class="demo">' +
                            '<b>Тестовые данные</b>' +
                            '<span>admin / Admin2026! — руководство</span>' +
                            '<span>test / Test2026! — администратор</span>' +
                        '</div>' +

                    '</form>' +

                '</section>' +
            '</main>';

        var password =
            document.getElementById(
                "password"
            );

        var eye =
            document.getElementById(
                "passwordEye"
            );

        eye.onclick =
            function () {
                var hidden =
                    password.type ===
                    "password";

                password.type =
                    hidden
                        ? "text"
                        : "password";

                eye.innerHTML =
                    eyeIcon(
                        !hidden
                    );

                eye.setAttribute(
                    "aria-label",
                    hidden
                        ? "Скрыть пароль"
                        : "Показать пароль"
                );

                eye.setAttribute(
                    "title",
                    hidden
                        ? "Скрыть пароль"
                        : "Показать пароль"
                );
            };

        document
            .getElementById(
                "loginForm"
            )
            .addEventListener(
                "submit",
                function (
                    event
                ) {
                    event.preventDefault();

                    var loginValue =
                        document
                            .getElementById(
                                "login"
                            )
                            .value
                            .trim();

                    var account =
                        USERS[
                            loginValue
                                .toLowerCase()
                        ];

                    var valid =
                        account &&
                        account.password ===
                            password.value;

                    var error =
                        document.getElementById(
                            "loginError"
                        );

                    if (!valid) {
                        error.textContent =
                            "Неверный логин или пароль";

                        console.warn(
                            "[BR AdminTools] Неуспешная авторизация",
                            {
                                login:
                                    loginValue
                            }
                        );

                        return;
                    }

                    state.user = {
                        nickname:
                            account.nickname,

                        position:
                            account.position,

                        role:
                            account.role
                    };

                    state.expires =
                        Date.now() +
                        SESSION_MS;

                    state.page =
                        "dashboard";

                    saveSession();

                    addLog(
                        "login",
                        "Вход в панель"
                    );

                    startTimer();

                    render();
                }
            );
    }

    function nav(
        page,
        icon,
        text
    ) {
        return (
            '<button ' +
                'class="side-link ' +
                (
                    state.page ===
                    page
                        ? "active"
                        : ""
                ) +
                '" ' +
                'data-page="' +
                esc(page) +
            '">' +

                '<span>' +
                    icon +
                '</span>' +

                esc(text) +

            '</button>'
        );
    }

    function layout(body) {
        var management =
            state.user.role ===
            "management";

        var regularLinks =
            nav(
                "normatives",
                "↑",
                "Нормативы"
            ) +

            nav(
                "requests",
                "✦",
                "Мои обращения"
            ) +

            nav(
                "rules",
                "☷",
                "Регламент"
            );

        var managementLinks =
            nav(
                "admins",
                "♟",
                "Состав администрации"
            ) +

            nav(
                "normatives-all",
                "▣",
                "Нормативы"
            ) +

            nav(
                "requests-all",
                "✦",
                "Обращения"
            ) +

            nav(
                "rules",
                "☷",
                "Регламент"
            ) +

            nav(
                "logs",
                "◷",
                "Журнал действий"
            ) +

            nav(
                "access",
                "⚿",
                "Управление доступом"
            );

        return (
            '<div class="panel">' +

                '<aside class="sidebar" id="sidebar">' +

                    '<div class="brand">' +
                        '<div class="brand-logo">BR</div>' +

                        '<div>' +
                            '<b>BLACK RUSSIA</b>' +
                            '<small>Мурманск • Admin Panel</small>' +
                        '</div>' +

                    '</div>' +

                    '<div class="section-title">' +
                        'ПАНЕЛЬ' +
                    '</div>' +

                    nav(
                        "dashboard",
                        "⌂",
                        "Главная"
                    ) +

                    nav(
                        "profile",
                        "◉",
                        "Мой профиль"
                    ) +

                    (
                        management
                            ? managementLinks
                            : regularLinks +
                              nav(
                                  "admins",
                                  "♟",
                                  "Администрация"
                              )
                    ) +

                    '<div class="sidebar-bottom">' +

                        '<div class="user-mini">' +

                            '<div class="avatar">' +
                                esc(
                                    state.user.nickname
                                        .slice(
                                            0,
                                            2
                                        )
                                        .toUpperCase()
                                ) +
                            '</div>' +

                            '<div>' +

                                '<b>' +
                                    esc(
                                        state.user.nickname
                                    ) +
                                '</b>' +

                                '<small>' +
                                    esc(
                                        state.user.position
                                    ) +
                                '</small>' +

                            '</div>' +

                        '</div>' +

                        '<button ' +
                            'id="logout" ' +
                            'class="logout"' +
                        '>' +
                            'Выйти' +
                        '</button>' +

                    '</div>' +

                '</aside>' +

                '<main class="main">' +

                    '<header class="top">' +

                        '<button ' +
                            'id="mobileMenu" ' +
                            'class="mobile-menu"' +
                            'aria-label="Открыть меню"' +
                        '>' +
                            '☰' +
                        '</button>' +

                        '<span>' +
                            'АДМИНИСТРАЦИЯ • МУРМАНСК' +
                        '</span>' +

                        '<div class="top-right">' +

                            '<span ' +
                                'id="sessionTimer"' +
                            '>' +
                                'Сессия 3:00' +
                            '</span>' +

                        '</div>' +

                    '</header>' +

                    '<section class="content">' +
                        body +
                    '</section>' +

                    '<div class="watermark">' +
                        esc(
                            state.user.nickname
                        ) +
                    '</div>' +

                '</main>' +

            '</div>'
        );
    }

    function head(
        title,
        subtitle
    ) {
        return (
            '<div class="head">' +
                '<div>' +

                    '<h1>' +
                        esc(title) +
                    '</h1>' +

                    '<p>' +
                        esc(subtitle) +
                    '</p>' +

                '</div>' +
            '</div>'
        );
    }

    function dashboard() {
        var management =
            state.user.role ===
            "management";

        return (
            head(
                management
                    ? "Панель руководства"
                    : "Добро пожаловать",

                management
                    ? "Рабочая панель руководства администрации"
                    : "Личный кабинет администрации Black Russia • Мурманск"
            ) +

            '<div class="cards">' +

                '<div class="card">' +
                    '<small>НИКНЕЙМ</small>' +
                    '<b>' +
                        esc(
                            state.user.nickname
                        ) +
                    '</b>' +
                '</div>' +

                '<div class="card">' +
                    '<small>ДОЛЖНОСТЬ</small>' +
                    '<b>' +
                        esc(
                            state.user.position
                        ) +
                    '</b>' +
                '</div>' +

                '<div class="card">' +
                    '<small>СТАТИСТИКА</small>' +
                    '<b>' +
                        'Временно отключена' +
                    '</b>' +
                '</div>' +

                '<div class="card">' +
                    '<small>СЕССИЯ</small>' +
                    '<b id="sessionCard">' +
                        '3:00' +
                    '</b>' +
                '</div>' +

            '</div>' +

            '<div class="columns">' +

                '<div class="box">' +

                    '<h2>' +
                        (
                            management
                                ? "Разделы руководства"
                                : "Доступные разделы"
                        ) +
                    '</h2>' +

                    '<p>' +
                        (
                            management
                                ? "Состав администрации, нормативы, обращения, регламент, журнал действий и управление доступом."
                                : "Нормативы, обращения, регламент и публичный состав администрации."
                        ) +
                    '</p>' +

                '</div>' +

                '<div class="box">' +

                    '<h2>' +
                        'Безопасность' +
                    '</h2>' +

                    '<p>' +
                        'Сессия длится 3 минуты и продлевается при активности пользователя.' +
                    '</p>' +

                    '<p>' +
                        'На странице отображается водяной знак с никнеймом аккаунта.' +
                    '</p>' +

                '</div>' +

            '</div>'
        );
    }

    function profile() {
        return (
            head(
                "Мой профиль",
                "Никнейм и должность текущего аккаунта"
            ) +

            '<div class="box form-box">' +

                '<div class="form-field">' +
                    '<label>Никнейм</label>' +
                    '<input ' +
                        'class="profile-input" ' +
                        'value="' +
                        esc(
                            state.user.nickname
                        ) +
                        '" ' +
                        'readonly' +
                    '>' +
                '</div>' +

                '<div class="form-field">' +
                    '<label>Должность</label>' +
                    '<input ' +
                        'class="profile-input" ' +
                        'value="' +
                        esc(
                            state.user.position
                        ) +
                        '" ' +
                        'readonly' +
                    '>' +
                '</div>' +

            '</div>'
        );
    }

    function adminsPage() {
        var rows =
            ADMINS
                .map(
                    function (
                        item
                    ) {
                        return (
                            '<tr>' +
                                '<td>' +
                                    esc(
                                        item[0]
                                    ) +
                                '</td>' +

                                '<td>' +
                                    esc(
                                        item[1]
                                    ) +
                                '</td>' +
                            '</tr>'
                        );
                    }
                )
                .join("");

        return (
            head(
                "Состав администрации",
                "Публичный список никнеймов и должностей"
            ) +

            '<div class="box table-box">' +

                '<table>' +

                    '<thead>' +
                        '<tr>' +
                            '<th>Никнейм</th>' +
                            '<th>Должность</th>' +
                        '</tr>' +
                    '</thead>' +

                    '<tbody>' +
                        rows +
                    '</tbody>' +

                '</table>' +

            '</div>'
        );
    }

    function getNormatives() {
        var data =
            getJSON(
                "br_normatives",
                []
            );

        return Array.isArray(data)
            ? data
            : [];
    }

    function normativeFormPage() {
        var list =
            getNormatives()
                .filter(
                    function (
                        item
                    ) {
                        return (
                            item.nickname ===
                            state.user.nickname
                        );
                    }
                );

        var rows =
            list.length
                ? list
                    .map(
                        function (
                            item
                        ) {
                            return (
                                '<tr>' +
                                    '<td>' +
                                        esc(
                                            item.date
                                        ) +
                                    '</td>' +

                                    '<td>' +
                                        esc(
                                            item.position
                                        ) +
                                    '</td>' +

                                    '<td>' +
                                        esc(
                                            item.file
                                        ) +
                                    '</td>' +

                                    '<td>' +
                                        esc(
                                            item.comment ||
                                            "—"
                                        ) +
                                    '</td>' +
                                '</tr>'
                            );
                        }
                    )
                    .join("")
                : (
                    '<tr>' +
                        '<td colspan="4">' +
                            'Нормативов пока нет.' +
                        '</td>' +
                    '</tr>'
                );

        return (
            head(
                "Нормативы",
                "Отправка и локальная история нормативов"
            ) +

            '<div class="box">' +

                '<form id="normForm">' +

                    '<div class="form-grid">' +

                        '<div class="form-field form-full">' +
                            '<label>Файл</label>' +
                            '<input ' +
                                'id="file" ' +
                                'type="file" ' +
                                'required' +
                            '>' +
                        '</div>' +

                        '<div class="form-field">' +
                            '<label>Дата</label>' +
                            '<input ' +
                                'id="date" ' +
                                'type="date" ' +
                                'required' +
                            '>' +
                        '</div>' +

                        '<div class="form-field">' +
                            '<label>Должность</label>' +
                            '<select id="normPosition">' +

                                POSITIONS
                                    .map(
                                        function (
                                            position
                                        ) {
                                            return (
                                                '<option ' +
                                                    (
                                                        position ===
                                                        state.user.position
                                                            ? "selected"
                                                            : ""
                                                    ) +
                                                '>' +
                                                    esc(
                                                        position
                                                    ) +
                                                '</option>'
                                            );
                                        }
                                    )
                                    .join("") +

                            '</select>' +
                        '</div>' +

                        '<div class="form-field form-full">' +
                            '<label>Комментарий</label>' +
                            '<textarea ' +
                                'id="comment" ' +
                                'placeholder="Комментарий к нормативу"' +
                            '></textarea>' +
                        '</div>' +

                    '</div>' +

                    '<button ' +
                        'class="primary" ' +
                        'type="submit"' +
                    '>' +
                        'Сохранить норматив' +
                    '</button>' +

                '</form>' +

            '</div>' +

            '<div ' +
                'class="box table-box" ' +
                'style="margin-top:16px"' +
            '>' +

                '<div class="card-head">' +
                    '<h2>Мои нормативы</h2>' +
                    '<span>локально</span>' +
                '</div>' +

                '<table>' +

                    '<thead>' +
                        '<tr>' +
                            '<th>Дата</th>' +
                            '<th>Должность</th>' +
                            '<th>Файл</th>' +
                            '<th>Комментарий</th>' +
                        '</tr>' +
                    '</thead>' +

                    '<tbody>' +
                        rows +
                    '</tbody>' +

                '</table>' +

            '</div>'
        );
    }

    function normativeAllPage() {
        var list =
            getNormatives();

        var rows =
            list.length
                ? list
                    .map(
                        function (
                            item
                        ) {
                            return (
                                '<tr>' +
                                    '<td>' +
                                        esc(
                                            item.nickname
                                        ) +
                                    '</td>' +

                                    '<td>' +
                                        esc(
                                            item.date
                                        ) +
                                    '</td>' +

                                    '<td>' +
                                        esc(
                                            item.position
                                        ) +
                                    '</td>' +

                                    '<td>' +
                                        esc(
                                            item.file
                                        ) +
                                    '</td>' +

                                    '<td>' +
                                        esc(
                                            item.comment ||
                                            "—"
                                        ) +
                                    '</td>' +

                                '</tr>'
                            );
                        }
                    )
                    .join("")
                : (
                    '<tr>' +
                        '<td colspan="5">' +
                            'Нормативов нет.' +
                        '</td>' +
                    '</tr>'
                );

        return (
            head(
                "Нормативы администрации",
                "Обзор локального журнала нормативов"
            ) +

            '<div class="box">' +

                '<div class="notice">' +
                    'Пока нормативы хранятся локально в браузере. Для общего журнала между устройствами подключим серверную часть.' +
                '</div>' +

            '</div>' +

            '<div class="box table-box" style="margin-top:16px">' +

                '<table>' +

                    '<thead>' +
                        '<tr>' +
                            '<th>Никнейм</th>' +
                            '<th>Дата</th>' +
                            '<th>Должность</th>' +
                            '<th>Файл</th>' +
                            '<th>Комментарий</th>' +
                        '</tr>' +
                    '</thead>' +

                    '<tbody>' +
                        rows +
                    '</tbody>' +

                '</table>' +

            '</div>'
        );
    }

    function getRequests() {
        var data =
            getJSON(
                "br_requests",
                []
            );

        return Array.isArray(data)
            ? data
            : [];
    }

    function requestsPage() {
        var list =
            getRequests()
                .filter(
                    function (
                        item
                    ) {
                        return (
                            item.nickname ===
                            state.user.nickname
                        );
                    }
                );

        var rows =
            list.length
                ? list
                    .map(
                        function (
                            item
                        ) {
                            return (
                                '<tr>' +
                                    '<td>' +
                                        esc(
                                            item.type
                                        ) +
                                    '</td>' +

                                    '<td>' +
                                        esc(
                                            item.date
                                        ) +
                                    '</td>' +

                                    '<td>' +
                                        esc(
                                            item.status
                                        ) +
                                    '</td>' +

                                    '<td>' +
                                        esc(
                                            item.text
                                        ) +
                                    '</td>' +
                                '</tr>'
                            );
                        }
                    )
                    .join("")
                : (
                    '<tr>' +
                        '<td colspan="4">' +
                            'Обращений пока нет.' +
                        '</td>' +
                    '</tr>'
                );

        return (
            head(
                "Мои обращения",
                "Обращения к руководству"
            ) +

            '<div class="box">' +

                '<form id="requestForm">' +

                    '<div class="form-grid">' +

                        '<div class="form-field">' +
                            '<label>Тип обращения</label>' +

                            '<select id="requestType">' +
                                '<option>Вопрос</option>' +
                                '<option>Неактив</option>' +
                                '<option>Жалоба</option>' +
                                '<option>Предложение</option>' +
                            '</select>' +

                        '</div>' +

                        '<div class="form-field form-full">' +
                            '<label>Текст</label>' +

                            '<textarea ' +
                                'id="requestText" ' +
                                'required ' +
                                'placeholder="Опишите обращение"' +
                            '></textarea>' +

                        '</div>' +

                    '</div>' +

                    '<button ' +
                        'class="primary" ' +
                        'type="submit"' +
                    '>' +
                        'Отправить обращение' +
                    '</button>' +

                '</form>' +

            '</div>' +

            '<div class="box table-box" style="margin-top:16px">' +

                '<table>' +

                    '<thead>' +
                        '<tr>' +
                            '<th>Тип</th>' +
                            '<th>Дата</th>' +
                            '<th>Статус</th>' +
                            '<th>Текст</th>' +
                        '</tr>' +
                    '</thead>' +

                    '<tbody>' +
                        rows +
                    '</tbody>' +

                '</table>' +

            '</div>'
        );
    }

    function requestsAllPage() {
        var list =
            getRequests();

        var rows =
            list.length
                ? list
                    .map(
                        function (
                            item
                        ) {
                            return (
                                '<tr>' +

                                    '<td>' +
                                        esc(
                                            item.nickname
                                        ) +
                                    '</td>' +

                                    '<td>' +
                                        esc(
                                            item.type
                                        ) +
                                    '</td>' +

                                    '<td>' +
                                        esc(
                                            item.date
                                        ) +
                                    '</td>' +

                                    '<td>' +
                                        esc(
                                            item.status
                                        ) +
                                    '</td>' +

                                    '<td>' +
                                        esc(
                                            item.text
                                        ) +
                                    '</td>' +

                                '</tr>'
                            );
                        }
                    )
                    .join("")
                : (
                    '<tr>' +
                        '<td colspan="5">' +
                            'Обращений нет.' +
                        '</td>' +
                    '</tr>'
                );

        return (
            head(
                "Обращения администрации",
                "Обзор обращений сотрудников"
            ) +

            '<div class="box table-box">' +

                '<table>' +

                    '<thead>' +
                        '<tr>' +
                            '<th>Никнейм</th>' +
                            '<th>Тип</th>' +
                            '<th>Дата</th>' +
                            '<th>Статус</th>' +
                            '<th>Текст</th>' +
                        '</tr>' +
                    '</thead>' +

                    '<tbody>' +
                        rows +
                    '</tbody>' +

                '</table>' +

            '</div>'
        );
    }

    function rulesPage() {
        return (
            head(
                "Регламент",
                "Общие правила администрации"
            ) +

            '<div class="columns">' +

                '<div class="box">' +

                    '<h2>Администраторы</h2>' +

                    '<p>' +
                        'Соблюдение установленных правил, требований и порядка работы администрации.' +
                    '</p>' +

                    '<p>' +
                        'Все нормативы и обращения должны оформляться через соответствующие разделы панели.' +
                    '</p>' +

                '</div>' +

                '<div class="box">' +

                    '<h2>Руководство</h2>' +

                    '<p>' +
                        'Контроль состава администрации, обращений и рабочих процессов.' +
                    '</p>' +

                    '<p>' +
                        'Статистический модуль пока отключён.' +
                    '</p>' +

                '</div>' +

            '</div>'
        );
    }

    function logsPage() {
        var logs =
            getJSON(
                "br_logs",
                []
            );

        if (!Array.isArray(logs)) {
            logs = [];
        }

        var rows =
            logs.length
                ? logs
                    .map(
                        function (
                            item
                        ) {
                            var date =
                                new Date(
                                    item.time
                                );

                            return (
                                '<tr>' +

                                    '<td>' +
                                        esc(
                                            isNaN(
                                                date.getTime()
                                            )
                                                ? item.time
                                                : date.toLocaleString(
                                                    "ru-RU"
                                                )
                                        ) +
                                    '</td>' +

                                    '<td>' +
                                        esc(
                                            item.nickname
                                        ) +
                                    '</td>' +

                                    '<td>' +
                                        esc(
                                            item.action
                                        ) +
                                    '</td>' +

                                    '<td>' +
                                        esc(
                                            item.details
                                        ) +
                                    '</td>' +

                                '</tr>'
                            );
                        }
                    )
                    .join("")
                : (
                    '<tr>' +
                        '<td colspan="4">' +
                            'Журнал пока пуст.' +
                        '</td>' +
                    '</tr>'
                );

        return (
            head(
                "Журнал действий",
                "Локальная история действий панели"
            ) +

            '<div class="box table-box">' +

                '<table>' +

                    '<thead>' +
                        '<tr>' +
                            '<th>Время</th>' +
                            '<th>Никнейм</th>' +
                            '<th>Действие</th>' +
                            '<th>Подробности</th>' +
                        '</tr>' +
                    '</thead>' +

                    '<tbody>' +
                        rows +
                    '</tbody>' +

                '</table>' +

            '</div>'
        );
    }

    function accessPage() {
        var rows =
            Object.keys(
                USERS
            )
            .map(
                function (
                    login
                ) {
                    var item =
                        USERS[
                            login
                        ];

                    return (
                        '<tr>' +

                            '<td>' +
                                esc(
                                    login
                                ) +
                            '</td>' +

                            '<td>' +
                                (
                                    item.role ===
                                    "management"
                                        ? "Руководство"
                                        : "Администратор"
                                ) +
                            '</td>' +

                            '<td>' +
                                esc(
                                    item.nickname
                                ) +
                            '</td>' +

                            '<td>' +
                                esc(
                                    item.position
                                ) +
                            '</td>' +

                        '</tr>'
                    );
                }
            )
            .join("");

        return (
            head(
                "Управление доступом",
                "Текущая тестовая конфигурация ролей"
            ) +

            '<div class="box">' +

                '<div class="notice">' +
                    'Эта версия использует локальные тестовые аккаунты. После подключения серверной части аккаунты и роли будут храниться на сервере.' +
                '</div>' +

            '</div>' +

            '<div class="box table-box" style="margin-top:16px">' +

                '<table>' +

                    '<thead>' +
                        '<tr>' +
                            '<th>Логин</th>' +
                            '<th>Роль</th>' +
                            '<th>Никнейм</th>' +
                            '<th>Должность</th>' +
                        '</tr>' +
                    '</thead>' +

                    '<tbody>' +
                        rows +
                    '</tbody>' +

                '</table>' +

            '</div>'
        );
    }

    function pageContent() {
        switch (
            state.page
        ) {
            case "profile":
                return profile();

            case "admins":
                return adminsPage();

            case "normatives":
                return state.user.role ===
                    "management"
                        ? normativeAllPage()
                        : normativeFormPage();

            case "normatives-all":
                return normativeAllPage();

            case "requests":
                return requestsPage();

            case "requests-all":
                return requestsAllPage();

            case "rules":
                return rulesPage();

            case "logs":
                return logsPage();

            case "access":
                return accessPage();

            default:
                return dashboard();
        }
    }

    function bind() {
        document
            .querySelectorAll(
                "[data-page]"
            )
            .forEach(
                function (
                    button
                ) {
                    button.onclick =
                        function () {
                            var page =
                                button.getAttribute(
                                    "data-page"
                                );

                            state.page =
                                page;

                            addLog(
                                "navigation",
                                page
                            );

                            closeMobileMenu();
                            render();
                        };
                }
            );

        var logoutButton =
            document.getElementById(
                "logout"
            );

        if (logoutButton) {
            logoutButton.onclick =
                function () {
                    logout(
                        false
                    );
                };
        }

        var mobileButton =
            document.getElementById(
                "mobileMenu"
            );

        if (mobileButton) {
            mobileButton.onclick =
                function () {
                    var sidebar =
                        document.getElementById(
                            "sidebar"
                        );

                    if (sidebar) {
                        sidebar.classList.toggle(
                            "open"
                        );
                    }
                };
        }

        var normForm =
            document.getElementById(
                "normForm"
            );

        if (normForm) {
            normForm.onsubmit =
                function (
                    event
                ) {
                    event.preventDefault();

                    var file =
                        document.getElementById(
                            "file"
                        ).files[0];

                    var date =
                        document.getElementById(
                            "date"
                        ).value;

                    var position =
                        document.getElementById(
                            "normPosition"
                        ).value;

                    var comment =
                        document.getElementById(
                            "comment"
                        ).value.trim();

                    if (!file || !date) {
                        return;
                    }

                    var list =
                        getNormatives();

                    list.unshift({
                        nickname:
                            state.user.nickname,

                        date:
                            date,

                        position:
                            position,

                        file:
                            file.name,

                        comment:
                            comment,

                        createdAt:
                            new Date().toISOString()
                    });

                    setJSON(
                        "br_normatives",
                        list.slice(
                            0,
                            200
                        )
                    );

                    addLog(
                        "normative_created",
                        file.name
                    );

                    render();
                };
        }

        var requestForm =
            document.getElementById(
                "requestForm"
            );

        if (requestForm) {
            requestForm.onsubmit =
                function (
                    event
                ) {
                    event.preventDefault();

                    var text =
                        document.getElementById(
                            "requestText"
                        ).value.trim();

                    if (!text) {
                        return;
                    }

                    var list =
                        getRequests();

                    var type =
                        document.getElementById(
                            "requestType"
                        ).value;

                    list.unshift({
                        nickname:
                            state.user.nickname,

                        type:
                            type,

                        date:
                            new Date()
                                .toLocaleDateString(
                                    "ru-RU"
                                ),

                        status:
                            "На рассмотрении",

                        text:
                            text,

                        createdAt:
                            new Date().toISOString()
                    });

                    setJSON(
                        "br_requests",
                        list.slice(
                            0,
                            200
                        )
                    );

                    addLog(
                        "request_created",
                        type
                    );

                    render();
                };
        }
    }

    function closeMobileMenu() {
        var sidebar =
            document.getElementById(
                "sidebar"
            );

        if (sidebar) {
            sidebar.classList.remove(
                "open"
            );
        }
    }

    function render() {
        try {
            if (!state.user) {
                renderLogin();

                console.info(
                    "[BR AdminTools] Форма авторизации отрисована"
                );

                return;
            }

            if (
                state.user.role !==
                "management"
            ) {
                if (
                    state.page ===
                    "logs" ||
                    state.page ===
                    "access" ||
                    state.page ===
                    "requests-all" ||
                    state.page ===
                    "normatives-all"
                ) {
                    state.page =
                        "dashboard";
                }
            }

            app.innerHTML =
                layout(
                    pageContent()
                );

            bind();
            updateTimer();

            console.info(
                "[BR AdminTools] Панель отрисована. Раздел:",
                state.page,
                "Роль:",
                state.user.role
            );
        } catch (error) {
            console.error(
                "[BR AdminTools] Ошибка отрисовки:",
                error
            );

            app.innerHTML =
                '<main class="login-page">' +
                    '<section class="login-card">' +
                        '<h1>Ошибка приложения</h1>' +
                        '<p>Откройте F12 → Console и найдите сообщения с префиксом [BR AdminTools].</p>' +
                        '<button class="login-submit" id="errorReload">Перезагрузить</button>' +
                    '</section>' +
                '</main>';

            document
                .getElementById(
                    "errorReload"
                )
                ?.addEventListener(
                    "click",
                    function () {
                        location.reload();
                    }
                );
        }
    }

    window.BR_ADMIN_DEBUG = {
        state:
            function () {
                return JSON.parse(
                    JSON.stringify(
                        state
                    )
                );
            },

        clearSession:
            function () {
                removeStorage(
                    "br_session"
                );

                state.user =
                    null;

                state.expires =
                    0;

                stopTimer();

                render();
            },

        clearLocalData:
            function () {
                removeStorage(
                    "br_normatives"
                );

                removeStorage(
                    "br_requests"
                );

                removeStorage(
                    "br_logs"
                );

                console.info(
                    "[BR AdminTools] Локальные данные очищены"
                );
            },

        users:
            function () {
                return Object.keys(
                    USERS
                );
            }
    };

    try {
        if (
            restoreSession()
        ) {
            render();
        } else {
            render();
        }
    } catch (error) {
        console.error(
            "[BR AdminTools] Критическая ошибка запуска:",
            error
        );

        app.innerHTML =
            '<main class="login-page">' +
                '<section class="login-card">' +
                    '<h1>Критическая ошибка</h1>' +
                    '<p>Откройте F12 → Console и передайте сообщения с [BR AdminTools].</p>' +
                '</section>' +
            '</main>';
    }
})();
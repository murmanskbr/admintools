(function () {
    "use strict";

    var app = document.getElementById("app");

    if (!app) {
        console.error("[BR AdminTools] #app не найден");
        return;
    }

    var SESSION_MS = 180000;
    var REMEMBER_COOKIE = "br_session";
    var REMEMBER_DAYS = 30;
    var timer = null;
    var lastActivity = 0;

    var SERVER_INFO = {
        name: "Мурманск",
        online: null,
        status: "Ожидание API",
        color: "#8d96a7",
        x2: null,
        maxPlayers: null,
        updatedAt: null
    };

    var state = {
        user: null,
        expires: 0,
        remember: false,
        page: "dashboard",
        auditLogs: [],
        auditLogsLoaded: false,
        auditLogsLoading: false
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

    var NOTIFICATION_TYPES = [
        ["notice", "Обычное"],
        ["important", "Важное"],
        ["meeting", "Собрание"],
        ["emergency", "Чрезвычайная ситуация"],
        ["announcement", "Объявление"]
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

            return value == null
                ? fallback
                : value;
        } catch (error) {
            console.error(
                "[BR AdminTools] JSON error:",
                key,
                error
            );

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
            console.error(
                "[BR AdminTools] Storage write error:",
                key,
                error
            );
        }
    }

    function removeStorage(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error(
                "[BR AdminTools] Storage remove error:",
                key,
                error
            );
        }
    }

    function getCookie(name) {
        var prefix =
            name + "=";

        var cookies =
            document.cookie
                ? document.cookie.split(";")
                : [];

        for (
            var i = 0;
            i < cookies.length;
            i += 1
        ) {
            var item =
                cookies[i].trim();

            if (
                item.indexOf(prefix) === 0
            ) {
                return decodeURIComponent(
                    item.slice(
                        prefix.length
                    )
                );
            }
        }

        return null;
    }

    function setCookie(
        name,
        value,
        maxAge
    ) {
        document.cookie =
            name +
            "=" +
            encodeURIComponent(
                value
            ) +
            "; Max-Age=" +
            String(
                maxAge
            ) +
            "; Path=/; Secure; SameSite=Lax";
    }

    function removeCookie(name) {
        document.cookie =
            name +
            "=; Max-Age=0; Path=/; Secure; SameSite=Lax";
    }

    function getSessionPayload() {
        var cookieValue =
            getCookie(
                REMEMBER_COOKIE
            );

        if (cookieValue) {
            try {
                return JSON.parse(
                    cookieValue
                );
            } catch (error) {
                console.warn(
                    "[BR AdminTools] Некорректная cookie-сессия",
                    error
                );

                removeCookie(
                    REMEMBER_COOKIE
                );
            }
        }

        try {
            var sessionValue =
                sessionStorage.getItem(
                    "br_session"
                );

            if (sessionValue) {
                return JSON.parse(
                    sessionValue
                );
            }
        } catch (error) {
            console.warn(
                "[BR AdminTools] Ошибка чтения sessionStorage:",
                error
            );
        }

        // Совместимость со старой версией frontend.
        return getJSON(
            "br_session",
            null
        );
    }

    function clearSessionStorage() {
        removeStorage(
            "br_session"
        );

        try {
            sessionStorage.removeItem(
                "br_session"
            );
        } catch (error) {
            console.warn(
                "[BR AdminTools] Session storage cleanup error:",
                error
            );
        }

        removeCookie(
            REMEMBER_COOKIE
        );
    }

    function getUsers() {
        var extra =
            getJSON(
                "br_users",
                {}
            );

        if (
            !extra ||
            typeof extra !== "object" ||
            Array.isArray(extra)
        ) {
            extra = {};
        }

        return extra;
    }

    function saveUsers(users) {
        setJSON(
            "br_users",
            users || {}
        );
    }

    function getAdmins() {
        var users =
            getUsers();

        var result =
            ADMINS.slice();

        Object.keys(users)
            .forEach(
                function (
                    login
                ) {
                    var item =
                        users[login];

                    var exists =
                        result.some(
                            function (
                                admin
                            ) {
                                return (
                                    admin[0] ===
                                    item.nickname
                                );
                            }
                        );

                    if (!exists) {
                        result.push([
                            item.nickname,
                            item.position
                        ]);
                    }
                }
            );

        return result;
    }

    function addLog(action, details) {
        var timestamp =
            new Date().toISOString();

        var nickname =
            state.user
                ? state.user.nickname
                : "guest";

        var logItem = {
            time:
                timestamp,

            nickname:
                nickname,

            action:
                action,

            details:
                details || "",

            page:
                state.page || ""
        };

        var logs =
            getJSON(
                "br_logs",
                []
            );

        if (!Array.isArray(logs)) {
            logs = [];
        }

        logs.unshift(
            logItem
        );

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

        var token =
            state.user
                ? state.user.token
                : null;

        if (
            token &&
            window.BR_API &&
            typeof window.BR_API.auditLog ===
                "function"
        ) {
            window.BR_API
                .auditLog(
                    token,
                    action,
                    details || "",
                    state.page || ""
                )
                .then(
                    function () {
                        console.info(
                            "[BR AdminTools] Действие записано в Supabase:",
                            action
                        );
                    }
                )
                .catch(
                    function (error) {
                        console.warn(
                            "[BR AdminTools] Не удалось записать действие в Supabase:",
                            error
                        );
                    }
                );
        }
    }

    async function loadAuditLogs() {
        if (
            !state.user ||
            state.user.role !==
                "management"
        ) {
            return;
        }

        if (
            state.auditLogsLoading
        ) {
            return;
        }

        if (
            !window.BR_API ||
            typeof window.BR_API.auditLogs !==
                "function"
        ) {
            return;
        }

        state.auditLogsLoading =
            true;

        try {
            var result =
                await window.BR_API
                    .auditLogs(
                        state.user.token,
                        200
                    );

            if (
                result &&
                Array.isArray(
                    result.logs
                )
            ) {
                state.auditLogs =
                    result.logs;
            }

            state.auditLogsLoaded =
                true;

            if (
                state.page ===
                "logs"
            ) {
                render();
            }

        } catch (error) {
            console.warn(
                "[BR AdminTools] Не удалось загрузить журнал из Supabase:",
                error
            );

            state.auditLogsLoaded =
                true;

        } finally {
            state.auditLogsLoading =
                false;
        }
    }

    function saveSession() {
        if (!state.user) {
            return;
        }

        var session = {
            user:
                state.user,

            token:
                state.user.token,

            expires:
                state.expires,

            remember:
                state.remember === true
        };

        removeStorage(
            "br_session"
        );

        try {
            sessionStorage.removeItem(
                "br_session"
            );
        } catch (error) {
            console.warn(
                "[BR AdminTools] Session storage cleanup error:",
                error
            );
        }

        if (state.remember) {
            setCookie(
                REMEMBER_COOKIE,
                JSON.stringify(session),
                REMEMBER_DAYS *
                    24 *
                    60 *
                    60
            );

            return;
        }

        try {
            sessionStorage.setItem(
                "br_session",
                JSON.stringify(session)
            );
        } catch (error) {
            console.error(
                "[BR AdminTools] Session storage write error:",
                error
            );
        }
    }

    function restoreSession() {
        var session =
            getSessionPayload();

        if (
            !session ||
            !session.user
        ) {
            clearSessionStorage();

            return false;
        }

        if (
            session.remember === true &&
            getCookie(
                REMEMBER_COOKIE
            )
        ) {
            state.remember = true;
            state.user =
                session.user;

            state.expires =
                Date.now() +
                SESSION_MS;

            startTimer();
            saveSession();

            return true;
        }

        if (
            !session.expires ||
            session.expires <=
                Date.now()
        ) {
            clearSessionStorage();

            return false;
        }

        state.remember =
            session.remember === true;

        state.user =
            session.user;

        state.expires =
            session.expires;

        startTimer();

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
                    ) / 1000
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

        var timerElement =
            document.getElementById(
                "sessionTimer"
            );

        var cardElement =
            document.getElementById(
                "sessionCard"
            );

        if (timerElement) {
            timerElement.textContent =
                "Сессия " +
                text;
        }

        if (cardElement) {
            cardElement.textContent =
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
                            "Автоматический выход"
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

    function logout(expired) {
        if (
            state.user &&
            !expired
        ) {
            addLog(
                "logout",
                "Ручной выход"
            );
        }

        state.user = null;
        state.expires = 0;
        state.remember = false;
        state.page = "dashboard";

        clearSessionStorage();

        if (timer) {
            clearInterval(
                timer
            );
        }

        timer = null;

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
                    passive:
                        true
                }
            );
        }
    );

    function eyeIcon(hidden) {
        if (hidden) {
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
                        '<div class="login-logo">BR</div>' +
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

                        '<label for="login">Логин</label>' +

                        '<input ' +
                            'class="login-input" ' +
                            'id="login" ' +
                            'autocomplete="username" ' +
                            'spellcheck="false" ' +
                            'required' +
                        '>' +

                        '<label for="password">Пароль</label>' +

                        '<div class="password-wrap">' +

                            '<input ' +
                                'class="login-input" ' +
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

                        '<div class="remember-row">' +
                            '<label class="remember-label">' +
                                '<input ' +
                                    'id="rememberMe" ' +
                                    'type="checkbox" ' +
                                    'class="remember-checkbox"' +
                                '>' +
                                '<span>Запомнить меня</span>' +
                            '</label>' +
                            '<small>Сохранять вход на этом устройстве</small>' +
                        '</div>' +

                        '<div id="loginError" class="login-error"></div>' +

                        '<button ' +
                            'class="login-submit" ' +
                            'type="submit"' +
                        '>' +
                            'Войти' +
                        '</button>' +

                        

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

                    var error =
                        document.getElementById(
                            "loginError"
                        );

                    var rememberMe =
                        document.getElementById(
                            "rememberMe"
                        );

                    state.remember =
                        rememberMe
                            ? rememberMe.checked
                            : false;

                    error.textContent = "";

                    error.className =
                        "login-error";

                    var submit =
                        document.querySelector(
                            ".login-submit"
                        );

                    if (submit) {
                        submit.disabled = true;
                        submit.textContent =
                            "Проверка...";
                    }

                    window.BR_API
                        .login(
                            document
                                .getElementById(
                                    "login"
                                )
                                .value
                                .trim(),
                            password.value,
                            state.remember
                        )
                        .then(
                            function (
                                result
                            ) {
                                state.user = {
                                    id:
                                        result.admin.id,
                                    login:
                                        result.admin.login,
                                    nickname:
                                        result.admin.nickname,
                                    position:
                                        result.admin.position,
                                    role:
                                        result.admin.role,
                                    token:
                                        result.token
                                };

                                var expiresAt =
                                    new Date(
                                        result.expires_at
                                    ).getTime();

                                state.expires =
                                    Number.isFinite(
                                        expiresAt
                                    )
                                        ? expiresAt
                                        : Date.now() +
                                          SESSION_MS;

                                state.page =
                                    "dashboard";

                                saveSession();

                                addLog(
                                    "login",
                                    "Успешный вход через сервер"
                                );

                                startTimer();
                                render();
                            }
                        )
                        .catch(
                            function (
                                loginError
                            ) {
                                console.warn(
                                    "[BR AdminTools] Ошибка авторизации:",
                                    loginError
                                );

                                error.textContent =
                                    loginError.message ||
                                    "Ошибка сервера.";

                                error.className =
                                    loginError.kind ===
                                    "credentials"
                                        ? "login-error login-error-auth"
                                        : "login-error login-error-server";

                                if (submit) {
                                    submit.disabled = false;
                                    submit.textContent =
                                        "Войти";
                                }
                            }
                        );
                }
            );
    }

    function generatePassword(length) {
        var size = length || 12;
        var upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        var lower = "abcdefghijkmnopqrstuvwxyz";
        var digits = "23456789";
        var symbols = "!@#$%&*";
        var all = upper + lower + digits + symbols;

        function randomIndex(max) {
            if (
                window.crypto &&
                crypto.getRandomValues
            ) {
                var array =
                    new Uint32Array(1);

                crypto.getRandomValues(array);

                return array[0] % max;
            }

            return Math.floor(
                Math.random() * max
            );
        }

        var result = [
            upper[randomIndex(upper.length)],
            lower[randomIndex(lower.length)],
            digits[randomIndex(digits.length)],
            symbols[randomIndex(symbols.length)]
        ];

        while (result.length < size) {
            result.push(
                all[randomIndex(all.length)]
            );
        }

        for (
            var i = result.length - 1;
            i > 0;
            i -= 1
        ) {
            var j =
                randomIndex(i + 1);

            var tmp = result[i];
            result[i] = result[j];
            result[j] = tmp;
        }

        return result.join("");
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

        var managementLinks =
            '<div class="section-title">УПРАВЛЕНИЕ</div>' +

            nav(
                "access",
                "⚿",
                "Выдать доступ"
            ) +

            nav(
                "admins",
                "♟",
                "Состав администрации"
            ) +

            nav(
                "notifications",
                "!",
                "Уведомления"
            ) +

            nav(
                "normatives-all",
                "↑",
                "Нормативы"
            ) +

            nav(
                "requests-all",
                "✦",
                "Обращения"
            ) +

            '<div class="section-title">КОНТРОЛЬ</div>' +

            nav(
                "logs",
                "◷",
                "Журнал действий"
            ) +

            nav(
                "rules",
                "☷",
                "Регламент"
            );

        var regularLinks =
            nav(
                "notifications",
                "!",
                "Уведомления"
            ) +

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
                "admins",
                "♟",
                "Состав администрации"
            ) +

            nav(
                "rules",
                "☷",
                "Регламент"
            );

        return (
            '<div class="panel">' +

                '<aside ' +
                    'class="sidebar" ' +
                    'id="sidebar"' +
                '>' +

                    '<div class="brand">' +

                        '<div class="brand-logo">' +
                            'BR' +
                        '</div>' +

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
                            : regularLinks
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
                            'class="logout" ' +
                            'id="logout"' +
                        '>' +
                            'Выйти' +
                        '</button>' +

                    '</div>' +

                '</aside>' +

                '<main class="main">' +

                    '<header class="top">' +

                        '<button ' +
                            'class="mobile-menu" ' +
                            'id="mobileMenu"' +
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

                    '<div class="watermark" aria-hidden="true">' +
                        '<div class="watermark-mark">' +
                            '<strong>BR</strong>' +
                            '<span>' +
                                esc(state.user.nickname) +
                            '</span>' +
                            '<small>BLACK RUSSIA • МУРМАНСК</small>' +
                        '</div>' +
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
                '<h1>' +
                    esc(title) +
                '</h1>' +
                '<p>' +
                    esc(subtitle) +
                '</p>' +
            '</div>'
        );
    }

    function findServerByName(value) {
        if (!value) {
            return null;
        }

        var queue = [
            {
                value: value,
                parent: null,
                key: ""
            }
        ];

        while (queue.length) {
            var item =
                queue.shift();

            if (
                item.value &&
                typeof item.value === "object"
            ) {
                var keys =
                    Object.keys(
                        item.value
                    );

                for (
                    var i = 0;
                    i < keys.length;
                    i += 1
                ) {
                    var key =
                        keys[i];

                    var valueItem =
                        item.value[key];

                    if (
                        typeof valueItem === "string" &&
                        valueItem
                            .toLowerCase()
                            .indexOf("мурманск") !== -1
                    ) {
                        return {
                            object:
                                item.value,
                            key:
                                key,
                            name:
                                valueItem
                        };
                    }

                    if (
                        valueItem &&
                        typeof valueItem === "object"
                    ) {
                        queue.push({
                            value:
                                valueItem,
                            parent:
                                item.value,
                            key:
                                key
                        });
                    }
                }
            }
        }

        return null;
    }

    function getByKeys(object, keys) {
        if (
            !object ||
            typeof object !== "object"
        ) {
            return undefined;
        }

        for (
            var i = 0;
            i < keys.length;
            i += 1
        ) {
            var key =
                keys[i];

            if (
                Object.prototype.hasOwnProperty.call(
                    object,
                    key
                )
            ) {
                return object[key];
            }
        }

        return undefined;
    }

    function toOnlineValue(value) {
        if (
            typeof value === "number" &&
            Number.isFinite(value)
        ) {
            return value;
        }

        if (
            typeof value === "string" &&
            value.trim() !== ""
        ) {
            var parsed =
                Number(
                    value.replace(
                        ",",
                        "."
                    )
                );

            if (
                Number.isFinite(parsed)
            ) {
                return parsed;
            }

            var match =
                value.match(
                    /\d+/
                );

            if (match) {
                return Number(
                    match[0]
                );
            }
        }

        if (
            value &&
            typeof value === "object"
        ) {
            return toOnlineValue(
                getByKeys(
                    value,
                    [
                        "online",
                        "current",
                        "count",
                        "players",
                        "current_players"
                    ]
                )
            );
        }

        return null;
    }

    function normalizeColor(value) {
        if (
            typeof value !== "string"
        ) {
            return null;
        }

        var input =
            value.trim();

        if (
            /^[0-9a-fA-F]{6}$/.test(
                input
            )
        ) {
            return "#" + input;
        }

        if (
            /^#[0-9a-fA-F]{6}$/.test(
                input
            )
        ) {
            return input;
        }

        if (
            /^#[0-9a-fA-F]{3}$/.test(
                input
            )
        ) {
            return input;
        }

        return null;
    }

    function parseX2(value) {
        if (
            typeof value === "boolean"
        ) {
            return value;
        }

        if (
            typeof value === "number"
        ) {
            return value >= 2;
        }

        if (
            typeof value === "string"
        ) {
            var normalized =
                value
                    .trim()
                    .toLowerCase();

            if (
                normalized === "x2" ||
                normalized === "2x" ||
                normalized === "true" ||
                normalized === "да" ||
                normalized === "yes"
            ) {
                return true;
            }

            if (
                normalized === "false" ||
                normalized === "нет" ||
                normalized === "no" ||
                normalized === "x1" ||
                normalized === "1x"
            ) {
                return false;
            }

            var numberMatch =
                normalized.match(
                    /(?:x|×)\s*(\d+(?:\.\d+)?)/
                );

            if (numberMatch) {
                return Number(
                    numberMatch[1]
                ) >= 2;
            }
        }

        return null;
    }

    function parseServerObject(server) {
        var color =
            normalizeColor(
                server.color
            );

        return {
            id:
                server.id,

            sym_id:
                server.sym_id,

            name:
                String(
                    server.name ||
                    "MURMANSK"
                ),

            url:
                String(
                    server.url ||
                    "murmansk.blackrussia.online"
                ),

            online:
                toOnlineValue(
                    server.online
                ),

            maxPlayers:
                toOnlineValue(
                    server.max_online
                ),

            color:
                color ||
                "#8d96a7",

            x2:
                parseX2(
                    server.x2
                ),

            status:
                server.online != null
                    ? "Онлайн"
                    : "Оффлайн",

            publishStatus:
                String(
                    server.publish_status ||
                    ""
                )
        };
    }

    function getServerList(payload) {
        if (Array.isArray(payload)) {
            return payload;
        }

        if (
            payload &&
            typeof payload === "object"
        ) {
            var candidates = [
                payload.servers,
                payload.data,
                payload.result,
                payload.gameservers
            ];

            for (
                var i = 0;
                i < candidates.length;
                i += 1
            ) {
                if (
                    Array.isArray(
                        candidates[i]
                    )
                ) {
                    return candidates[i];
                }
            }

            if (
                payload.server &&
                typeof payload.server === "object"
            ) {
                return [
                    payload.server
                ];
            }

            if (
                payload.sym_id ||
                payload.name
            ) {
                return [payload];
            }
        }

        return [];
    }

    function findMurmanskServer(payload) {
        var servers =
            getServerList(payload);

        for (
            var i = 0;
            i < servers.length;
            i += 1
        ) {
            var server =
                servers[i];

            if (
                !server ||
                typeof server !== "object"
            ) {
                continue;
            }

            var symId =
                String(
                    server.sym_id || ""
                )
                    .trim()
                    .toLowerCase();

            var name =
                String(
                    server.name || ""
                )
                    .trim()
                    .toLowerCase();

            if (
                symId === "server53" ||
                name === "murmansk"
            ) {
                return parseServerObject(
                    server
                );
            }
        }

        return null;
    }

    function applyServerInfo(data) {
        SERVER_INFO.name =
            data && data.name
                ? data.name
                : "Мурманск";

        SERVER_INFO.online =
            data
                ? data.online
                : null;

        SERVER_INFO.status =
            data && data.status
                ? data.status
                : (
                    data &&
                    data.online != null
                        ? "Онлайн"
                        : "Данные получены"
                );

        SERVER_INFO.color =
            data && data.color
                ? data.color
                : (
                    data &&
                    data.online != null
                        ? "#36d47d"
                        : "#8d96a7"
                );

        SERVER_INFO.x2 =
            data
                ? data.x2
                : null;

        SERVER_INFO.maxPlayers =
            data
                ? data.maxPlayers
                : null;

        SERVER_INFO.updatedAt =
            new Date()
                .toISOString();
    }

    function updateServerStatsView() {
        var onlineElement =
            document.getElementById(
                "serverOnline"
            );

        var x2Element =
            document.getElementById(
                "serverX2"
            );

        var statusElement =
            document.getElementById(
                "serverStatus"
            );

        var stateElement =
            document.getElementById(
                "serverState"
            );

        var updatedElement =
            document.getElementById(
                "serverUpdated"
            );

        var nameElement =
            document.getElementById(
                "serverName"
            );

        var shortNameElement =
            document.getElementById(
                "serverNameShort"
            );

        var dotElement =
            document.getElementById(
                "serverStatusDot"
            );

        var boxElement =
            document.getElementById(
                "serverBox"
            );

        var refreshButton =
            document.getElementById(
                "serverRefresh"
            );

        var onlineText =
            SERVER_INFO.online == null
                ? "—"
                : String(
                    SERVER_INFO.online
                );

        if (
            SERVER_INFO.maxPlayers != null
        ) {
            onlineText +=
                " / " +
                String(
                    SERVER_INFO.maxPlayers
                );
        }

        if (onlineElement) {
            onlineElement.textContent =
                onlineText;
        }

        if (x2Element) {
            x2Element.textContent =
                SERVER_INFO.x2 === true
                    ? "X2"
                    : (
                        SERVER_INFO.x2 === false
                            ? "X1"
                            : "—"
                    );
        }

        if (statusElement) {
            statusElement.textContent =
                SERVER_INFO.status;
        }

        if (stateElement) {
            stateElement.textContent =
                SERVER_INFO.status;
        }

        if (nameElement) {
            nameElement.textContent =
                SERVER_INFO.name;
        }

        if (shortNameElement) {
            shortNameElement.textContent =
                SERVER_INFO.name;
        }

        if (updatedElement) {
            updatedElement.textContent =
                SERVER_INFO.updatedAt
                    ? (
                        "Обновлено " +
                        new Date(
                            SERVER_INFO.updatedAt
                        ).toLocaleTimeString(
                            "ru-RU",
                            {
                                hour: "2-digit",
                                minute: "2-digit"
                            }
                        )
                    )
                    : "Данные ещё не получены";
        }

        if (dotElement) {
            dotElement.style.background =
                SERVER_INFO.color;

            dotElement.style.boxShadow =
                "0 0 0 4px " +
                SERVER_INFO.color +
                "22";
        }

        if (boxElement) {
            boxElement.style.setProperty(
                "--server-color",
                SERVER_INFO.color
            );
        }

        if (refreshButton) {
            refreshButton.disabled =
                false;

            refreshButton.textContent =
                "Обновить";
        }
    }

    async function loadServerStats() {
        var refreshButton =
            document.getElementById(
                "serverRefresh"
            );

        if (refreshButton) {
            refreshButton.disabled =
                true;

            refreshButton.textContent =
                "Обновление...";
        }

        try {
            var payload =
                await window.BR_API.serverStats(
                    state.user
                        ? state.user.token
                        : null
                );

            var server =
                findMurmanskServer(
                    payload
                );

            if (!server) {
                throw new Error(
                    "Сервер «Мурманск» не найден в ответе API."
                );
            }

            applyServerInfo(
                server
            );

            console.info(
                "[BR AdminTools] Статистика Мурманска обновлена:",
                server
            );

            updateServerStatsView();

        } catch (error) {
            console.error(
                "[BR AdminTools] Ошибка получения статистики Мурманска:",
                error
            );

            SERVER_INFO.status =
                error.message ||
                "Ошибка API";

            SERVER_INFO.color =
                "#ff6979";

            SERVER_INFO.updatedAt =
                new Date()
                    .toISOString();

            updateServerStatsView();

            var statusElement =
                document.getElementById(
                    "serverStatus"
                );

            if (statusElement) {
                statusElement.textContent =
                    "Ошибка API";
            }

            var stateElement =
                document.getElementById(
                    "serverState"
                );

            if (stateElement) {
                stateElement.textContent =
                    error.message ||
                    "Ошибка API";
            }
        }
    }

    function renderServerStats() {
        var color =
            /^#[0-9a-fA-F]{6,8}$/.test(
                String(
                    SERVER_INFO.color || ""
                )
            )
                ? SERVER_INFO.color
                : "#8d96a7";

        var online =
            SERVER_INFO.online == null
                ? "—"
                : String(
                    SERVER_INFO.online
                );

        if (
            SERVER_INFO.maxPlayers != null
        ) {
            online +=
                " / " +
                String(
                    SERVER_INFO.maxPlayers
                );
        }

        var x2 =
            SERVER_INFO.x2 === true
                ? "X2"
                : (
                    SERVER_INFO.x2 === false
                        ? "X1"
                        : "—"
                );

        var status =
            SERVER_INFO.status ||
            "Ожидание API";

        var updatedAt =
            SERVER_INFO.updatedAt;

        var timeText =
            updatedAt
                ? (
                    "Обновлено " +
                    new Date(
                        updatedAt
                    ).toLocaleTimeString(
                        "ru-RU",
                        {
                            hour: "2-digit",
                            minute: "2-digit"
                        }
                    )
                )
                : "Данные ещё не получены";

        return (
            '<div class="server-box" id="serverBox" style="--server-color:' +
                color +
            '">' +

                '<div class="server-box-head">' +

                    '<div>' +
                        '<small>СТАТИСТИКА СЕРВЕРА</small>' +
                        '<h2 id="serverName">' +
                            esc(
                                SERVER_INFO.name
                            ) +
                        '</h2>' +
                    '</div>' +

                    '<div class="server-box-actions">' +
                        '<span class="server-status">' +
                            '<i id="serverStatusDot"></i>' +
                            '<span id="serverStatus">' +
                                esc(status) +
                            '</span>' +
                        '</span>' +

                        '<button ' +
                            'class="button button-secondary server-refresh" ' +
                            'id="serverRefresh" ' +
                            'type="button"' +
                        '>' +
                            'Обновить' +
                        '</button>' +

                    '</div>' +

                '</div>' +

                '<div class="server-stats-grid">' +

                    '<div class="server-stat">' +
                        '<small>ОНЛАЙН</small>' +
                        '<strong id="serverOnline">' +
                            esc(online) +
                        '</strong>' +
                        '<span>игроков онлайн</span>' +
                    '</div>' +

                    '<div class="server-stat">' +
                        '<small>X2</small>' +
                        '<strong id="serverX2">' +
                            x2 +
                        '</strong>' +
                        '<span>режим опыта</span>' +
                    '</div>' +

                    '<div class="server-stat">' +
                        '<small>СЕРВЕР</small>' +
                        '<strong id="serverNameShort">' +
                            esc(
                                SERVER_INFO.name
                            ) +
                        '</strong>' +
                        '<span>Black Russia</span>' +
                    '</div>' +

                    '<div class="server-stat">' +
                        '<small>СОСТОЯНИЕ</small>' +
                        '<strong id="serverState">' +
                            esc(status) +
                        '</strong>' +
                        '<span id="serverUpdated">' +
                            esc(timeText) +
                        '</span>' +
                    '</div>' +

                '</div>' +

            '</div>'
        );
    }

    function dashboardPage() {
        var management =
            state.user.role ===
            "management";

        var notifications =
            getNotificationsForUser(
                state.user
            );

        var unread =
            notifications.filter(
                function (
                    item
                ) {
                    return !isRead(
                        item.id
                    );
                }
            ).length;

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
                    '<small>УВЕДОМЛЕНИЯ</small>' +
                    '<b>' +
                        unread +
                    ' непрочитанных</b>' +
                '</div>' +

                '<div class="card">' +
                    '<small>СЕССИЯ</small>' +
                    '<b id="sessionCard">3:00</b>' +
                '</div>' +

            '</div>' +

            renderServerStats() +

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
                                ? "Выдать доступ, состав администрации, уведомления, нормативы, обращения, журнал действий и регламент."
                                : "Уведомления, нормативы, обращения, состав администрации и регламент."
                        ) +
                    '</p>' +

                    '<button ' +
                        'class="button button-primary" ' +
                        'data-page="notifications"' +
                    '>' +
                        'Открыть уведомления' +
                    '</button>' +

                '</div>' +

                '<div class="box">' +

                    '<h2>' +
                        'Безопасность' +
                    '</h2>' +

                    '<p>' +
                        'Сессия длится 3 минуты и автоматически продлевается при активности.' +
                    '</p>' +

                    '<p>' +
                        'Водяной знак показывает никнейм текущего пользователя.' +
                    '</p>' +

                '</div>' +

            '</div>'
        );
    }

    function profilePage() {
        return (
            head(
                "Мой профиль",
                "Основные данные текущего аккаунта"
            ) +

            '<div class="box">' +

                '<div class="form-grid">' +

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

                '</div>' +

            '</div>'
        );
    }

    function adminsPage() {
        var rows =
            getAdmins()
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
                                        esc(item.date) +
                                    '</td>' +
                                    '<td>' +
                                        esc(item.position) +
                                    '</td>' +
                                    '<td>' +
                                        esc(item.file) +
                                    '</td>' +
                                    '<td>' +
                                        esc(item.comment || "—") +
                                    '</td>' +
                                '</tr>'
                            );
                        }
                    )
                    .join("")
                : '<tr><td colspan="4">Нормативов пока нет.</td></tr>';

        return (
            head(
                "Нормативы",
                "Отправка норматива"
            ) +

            '<div class="box">' +

                '<form id="normForm">' +

                    '<div class="form-grid">' +

                        '<div class="form-field form-full">' +
                            '<label>Файл</label>' +
                            '<input id="file" class="form-input" type="file" required>' +
                        '</div>' +

                        '<div class="form-field">' +
                            '<label>За какое число</label>' +
                            '<input id="date" class="form-input" type="date" required>' +
                        '</div>' +

                        '<div class="form-field">' +
                            '<label>Должность</label>' +

                            '<select id="normPosition" class="form-select">' +
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
                                                esc(position) +
                                                '</option>'
                                            );
                                        }
                                    )
                                    .join("") +
                            '</select>' +

                        '</div>' +

                        '<div class="form-field form-full">' +
                            '<label>Комментарий</label>' +
                            '<textarea id="comment" class="form-textarea"></textarea>' +
                        '</div>' +

                    '</div>' +

                    '<button class="button button-primary" type="submit">' +
                        'Сохранить норматив' +
                    '</button>' +

                '</form>' +

            '</div>' +

            '<div class="box table-box spaced-box">' +

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
                                        esc(item.nickname) +
                                    '</td>' +
                                    '<td>' +
                                        esc(item.date) +
                                    '</td>' +
                                    '<td>' +
                                        esc(item.position) +
                                    '</td>' +
                                    '<td>' +
                                        esc(item.file) +
                                    '</td>' +
                                    '<td>' +
                                        esc(item.comment || "—") +
                                    '</td>' +
                                '</tr>'
                            );
                        }
                    )
                    .join("")
                : '<tr><td colspan="5">Нормативов нет.</td></tr>';

        return (
            head(
                "Нормативы администрации",
                "Обзор нормативов"
            ) +

            '<div class="box">' +
                '<div class="notice">' +
                    'Временная версия хранит записи локально. В следующей версии этот раздел будет общим для всех устройств.' +
                '</div>' +
            '</div>' +

            '<div class="box table-box spaced-box">' +

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
                ? list.map(
                    function (
                        item
                    ) {
                        return (
                            '<tr>' +
                                '<td>' +
                                    esc(item.type) +
                                '</td>' +
                                '<td>' +
                                    esc(item.date) +
                                '</td>' +
                                '<td>' +
                                    esc(item.status) +
                                '</td>' +
                                '<td>' +
                                    esc(item.text) +
                                '</td>' +
                            '</tr>'
                        );
                    }
                ).join("")
                : '<tr><td colspan="4">Обращений пока нет.</td></tr>';

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
                            '<select id="requestType" class="form-select">' +
                                '<option>Вопрос</option>' +
                                '<option>Неактив</option>' +
                                '<option>Жалоба</option>' +
                                '<option>Предложение</option>' +
                            '</select>' +
                        '</div>' +

                        '<div class="form-field form-full">' +
                            '<label>Текст обращения</label>' +
                            '<textarea id="requestText" class="form-textarea" required></textarea>' +
                        '</div>' +

                    '</div>' +

                    '<button class="button button-primary" type="submit">' +
                        'Отправить обращение' +
                    '</button>' +

                '</form>' +

            '</div>' +

            '<div class="box table-box spaced-box">' +

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
                ? list.map(
                    function (
                        item
                    ) {
                        return (
                            '<tr>' +
                                '<td>' +
                                    esc(item.nickname) +
                                '</td>' +
                                '<td>' +
                                    esc(item.type) +
                                '</td>' +
                                '<td>' +
                                    esc(item.date) +
                                '</td>' +
                                '<td>' +
                                    esc(item.status) +
                                '</td>' +
                                '<td>' +
                                    esc(item.text) +
                                '</td>' +
                            '</tr>'
                        );
                    }
                ).join("")
                : '<tr><td colspan="5">Обращений нет.</td></tr>';

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

    function getNotifications() {
        var data =
            getJSON(
                "br_notifications",
                []
            );

        return Array.isArray(data)
            ? data
            : [];
    }

    function getNotificationsForUser(user) {
        return getNotifications()
            .filter(
                function (
                    item
                ) {
                    if (
                        item.expiresAt &&
                        item.expiresAt <
                            Date.now()
                    ) {
                        return false;
                    }

                    if (
                        item.target ===
                        "all"
                    ) {
                        return true;
                    }

                    if (
                        item.target ===
                        "management"
                    ) {
                        return (
                            user.role ===
                            "management"
                        );
                    }

                    if (
                        item.target ===
                        "admin"
                    ) {
                        return (
                            user.role ===
                            "admin"
                        );
                    }

                    if (
                        item.target ===
                        "nickname"
                    ) {
                        return (
                            item.nickname ===
                            user.nickname
                        );
                    }

                    return true;
                }
            );
    }

    function getReadIds() {
        var ids =
            getJSON(
                "br_read_notifications_" +
                state.user.nickname,
                []
            );

        return Array.isArray(ids)
            ? ids
            : [];
    }

    function isRead(id) {
        return getReadIds()
            .indexOf(id) !== -1;
    }

    function markRead(id) {
        var ids =
            getReadIds();

        if (
            ids.indexOf(id) ===
            -1
        ) {
            ids.push(id);
        }

        setJSON(
            "br_read_notifications_" +
            state.user.nickname,
            ids
        );
    }

    function notificationsPage() {
        var list =
            getNotificationsForUser(
                state.user
            );

        var cards =
            list.length
                ? list.map(
                    function (
                        item
                    ) {
                        var read =
                            isRead(
                                item.id
                            );

                        return (
                            '<article class="notification ' +
                                (
                                    read
                                        ? ""
                                        : "unread"
                                ) +
                            '">' +

                                '<div class="notification-top">' +

                                    '<div>' +

                                        '<div class="notification-title">' +
                                            esc(
                                                item.title
                                            ) +
                                        '</div>' +

                                        '<div class="notification-meta">' +
                                            esc(
                                                item.typeName
                                            ) +
                                            ' • ' +
                                            esc(
                                                item.createdAt
                                            ) +
                                        '</div>' +

                                    '</div>' +

                                    '<span class="badge ' +
                                        (
                                            item.type ===
                                            "emergency"
                                                ? "badge-red"
                                                : item.type ===
                                                  "important"
                                                    ? "badge-yellow"
                                                    : "badge-blue"
                                        ) +
                                    '">' +
                                        (
                                            read
                                                ? "Прочитано"
                                                : "Новое"
                                        ) +
                                    '</span>' +

                                '</div>' +

                                '<div class="notification-text">' +
                                    esc(
                                        item.text
                                    ) +
                                '</div>' +

                                (
                                    read
                                        ? ""
                                        : (
                                            '<div class="notification-actions">' +

                                                '<button ' +
                                                    'class="small-button" ' +
                                                    'data-read-notification="' +
                                                    esc(item.id) +
                                                '">' +
                                                    'Отметить прочитанным' +
                                                '</button>' +

                                            '</div>'
                                        )
                                ) +

                            '</article>'
                        );
                    }
                ).join("")
                : '<div class="empty">Новых уведомлений нет.</div>';

        return (
            head(
                "Уведомления",
                state.user.role === "management"
                    ? "Создание и просмотр уведомлений"
                    : "Новости и важные сообщения администрации"
            ) +

            (
                state.user.role ===
                "management"
                    ? (
                        '<div class="box compact-box">' +

                            '<form id="notificationForm">' +

                                '<div class="form-grid">' +

                                    '<div class="form-field">' +
                                        '<label>Заголовок</label>' +
                                        '<input id="notificationTitle" class="form-input" required>' +
                                    '</div>' +

                                    '<div class="form-field">' +
                                        '<label>Тип</label>' +
                                        '<select id="notificationType" class="form-select">' +
                                            NOTIFICATION_TYPES
                                                .map(
                                                    function (
                                                        pair
                                                    ) {
                                                        return (
                                                            '<option value="' +
                                                                pair[0] +
                                                            '">' +
                                                                pair[1] +
                                                            '</option>'
                                                        );
                                                    }
                                                )
                                                .join("") +
                                        '</select>' +
                                    '</div>' +

                                    '<div class="form-field form-full">' +
                                        '<label>Текст</label>' +
                                        '<textarea id="notificationText" class="form-textarea" required></textarea>' +
                                    '</div>' +

                                    '<div class="form-field">' +
                                        '<label>Получатели</label>' +
                                        '<select id="notificationTarget" class="form-select">' +
                                            '<option value="all">Вся администрация</option>' +
                                            '<option value="admin">Обычные администраторы</option>' +
                                            '<option value="management">Руководство</option>' +
                                        '</select>' +
                                    '</div>' +

                                    '<div class="form-field">' +
                                        '<label>Срок действия</label>' +
                                        '<input id="notificationExpires" class="form-input" type="datetime-local">' +
                                    '</div>' +

                                '</div>' +

                                '<button class="button button-primary" type="submit">' +
                                    'Опубликовать уведомление' +
                                '</button>' +

                            '</form>' +

                        '</div>'
                    )
                    : ""
            ) +

            '<div class="notification-list">' +
                cards +
            '</div>'
        );
    }

    function rulesPage() {
        return (
            head(
                "Регламент",
                "Правила администрации"
            ) +

            '<div class="two-column-table">' +

                '<div class="box">' +

                    '<h2>Администраторы</h2>' +

                    '<p>' +
                        'Соблюдение регламента, выполнение требований и корректная работа с обращениями и нормативами.' +
                    '</p>' +

                '</div>' +

                '<div class="box">' +

                    '<h2>Руководство</h2>' +

                    '<p>' +
                        'Контроль состава администрации, обращений, нормативов и публикация уведомлений.' +
                    '</p>' +

                '</div>' +

            '</div>'
        );
    }

    function auditPageName(page) {
        var names = {
            dashboard: "Главная",
            profile: "Профиль",
            admins: "Администрация",
            normatives: "Нормативы",
            "normatives-all": "Все нормативы",
            requests: "Мои обращения",
            "requests-all": "Все обращения",
            notifications: "Уведомления",
            rules: "Регламент",
            logs: "Журнал действий",
            access: "Управление доступом"
        };

        return (
            names[page] ||
            page ||
            "—"
        );
    }

    function auditActionName(action) {
        var names = {
            login: "Вход в систему",
            logout: "Выход из системы",
            session_expired: "Сессия завершилась",
            navigation: "Переход по разделу",
            notification_created: "Создание уведомления",
            notification_read: "Прочтение уведомления",
            normative_created: "Подача норматива",
            request_created: "Создание обращения",
            access_granted: "Выдача доступа",
            server_stats_refresh: "Обновление статистики сервера",
            audit_logs_refresh: "Обновление журнала действий"
        };

        return (
            names[action] ||
            action ||
            "Действие"
        );
    }

    function auditDetails(item) {
        var action =
            String(
                item.action ||
                ""
            );

        if (
            action === "navigation"
        ) {
            return (
                "Перешёл в раздел «" +
                auditPageName(
                    item.details
                ) +
                "»"
            );
        }

        if (
            action === "notification_created"
        ) {
            return (
                "Создал уведомление: «" +
                String(
                    item.details ||
                    ""
                ) +
                "»"
            );
        }

        if (
            action === "notification_read"
        ) {
            return (
                "Прочитал уведомление №" +
                String(
                    item.details ||
                    ""
                )
            );
        }

        if (
            action === "normative_created"
        ) {
            return (
                "Подал норматив: " +
                String(
                    item.details ||
                    ""
                )
            );
        }

        if (
            action === "request_created"
        ) {
            return "Создал новое обращение";
        }

        if (
            action === "access_granted"
        ) {
            return (
                "Выдал доступ: " +
                String(
                    item.details ||
                    ""
                )
            );
        }

        if (
            action === "server_stats_refresh"
        ) {
            return "Обновил статистику Мурманска";
        }

        if (
            action === "audit_logs_refresh"
        ) {
            return "Обновил журнал действий";
        }

        return (
            String(
                item.details ||
                "Без дополнительных сведений"
            )
        );
    }

    function logsPage() {
        var logs =
            Array.isArray(
                state.auditLogs
            )
                ? state.auditLogs
                : [];

        var isLoaded =
            state.auditLogsLoaded === true;

        var rows =
            logs.length
                ? logs.map(
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
                                        auditActionName(
                                            item.action
                                        )
                                    ) +
                                '</td>' +

                                '<td>' +
                                    esc(
                                        auditPageName(
                                            item.page
                                        )
                                    ) +
                                '</td>' +

                                '<td>' +
                                    esc(
                                        auditDetails(
                                            item
                                        )
                                    ) +
                                '</td>' +

                            '</tr>'
                        );
                    }
                ).join("")
                : (
                    isLoaded
                        ? '<tr><td colspan="5">Журнал пока пуст.</td></tr>'
                        : '<tr><td colspan="5">Загрузка журнала...</td></tr>'
                );

        return (
            head(
                "Журнал действий",
                "Серверный журнал Supabase для руководства"
            ) +

            '<div class="box table-box">' +

                '<div class="server-box-actions">' +
                    '<button class="button button-secondary" id="refreshAuditLogs" type="button">' +
                        'Обновить журнал' +
                    '</button>' +
                '</div>' +

                '<table>' +

                    '<thead>' +
                        '<tr>' +
                            '<th>Время</th>' +
                            '<th>Никнейм</th>' +
                            '<th>Действие</th>' +
                            '<th>Раздел</th>' +
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
        var users =
            getUsers();

        var rows =
            Object.keys(users)
                .map(
                    function (login) {
                        var item =
                            users[login];

                        return (
                            '<tr>' +
                                '<td>' +
                                    esc(
                                        item.nickname ||
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
                                        item.position ||
                                        "—"
                                    ) +
                                '</td>' +
                            '</tr>'
                        );
                    }
                )
                .join("");

        return (
            head(
                "Выдать доступ",
                "Создание учётной записи администратора"
            ) +

            '<div class="box">' +

                '<form id="accessForm">' +

                    '<div class="form-grid">' +

                        '<div class="form-field form-full">' +
                            '<label for="accessNickname">Никнейм</label>' +
                            '<input id="accessNickname" class="form-input" autocomplete="off" spellcheck="false" required>' +
                            '<div class="field-hint">Логин будет автоматически совпадать с никнеймом.</div>' +
                        '</div>' +

                        '<div class="form-field form-full">' +
                            '<label for="accessPassword">Пароль</label>' +

                            '<div class="input-action-wrap">' +

                                '<input ' +
                                    'id="accessPassword" ' +
                                    'class="form-input" ' +
                                    'type="text" ' +
                                    'autocomplete="new-password" ' +
                                    'required' +
                                '>' +

                                '<button ' +
                                    'class="button button-secondary input-action-button" ' +
                                    'id="generateAccessPassword" ' +
                                    'type="button"' +
                                '>' +
                                    'Сгенерировать' +
                                '</button>' +

                            '</div>' +

                            '<div class="field-hint">Пароль можно сгенерировать автоматически или указать вручную.</div>' +
                        '</div>' +

                        '<div class="form-field">' +
                            '<label for="accessRole">Роль</label>' +
                            '<select id="accessRole" class="form-select">' +
                                '<option value="admin">Обычный администратор</option>' +
                                '<option value="management">Руководство</option>' +
                            '</select>' +
                        '</div>' +

                        '<div class="form-field">' +
                            '<label for="accessPosition">Должность</label>' +
                            '<select id="accessPosition" class="form-select">' +
                                POSITIONS
                                    .map(
                                        function (position) {
                                            return (
                                                '<option>' +
                                                    esc(position) +
                                                '</option>'
                                            );
                                        }
                                    )
                                    .join("") +
                            '</select>' +
                        '</div>' +

                    '</div>' +

                    '<div class="form-actions">' +
                        '<button class="button button-primary" type="submit">' +
                            'Выдать доступ' +
                        '</button>' +
                    '</div>' +

                '</form>' +

            '</div>' +

            '<div class="box table-box access-table-box">' +

                '<table>' +

                    '<thead>' +
                        '<tr>' +
                            '<th>Никнейм</th>' +
                            '<th>Роль</th>' +
                            '<th>Должность</th>' +
                        '</tr>' +
                    '</thead>' +

                    '<tbody>' +
                        (
                            rows ||
                            '<tr><td colspan="3" class="table-empty">Доступы пока не выданы.</td></tr>'
                        ) +
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
                return profilePage();

            case "admins":
                return adminsPage();

            case "normatives":
                return normativeFormPage();

            case "normatives-all":
                return normativeAllPage();

            case "requests":
                return requestsPage();

            case "requests-all":
                return requestsAllPage();

            case "notifications":
                return notificationsPage();

            case "rules":
                return rulesPage();

            case "logs":
                return logsPage();

            case "access":
                return accessPage();

            default:
                return dashboardPage();
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
                            var target =
                                button.getAttribute(
                                    "data-page"
                                );

                            state.page =
                                target;

                            if (
                                target ===
                                "logs"
                            ) {
                                state.auditLogsLoaded =
                                    false;
                            }

                            closeMobileMenu();

                            addLog(
                                "navigation",
                                target
                            );

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

        var serverRefresh =
            document.getElementById(
                "serverRefresh"
            );

        if (serverRefresh) {
            serverRefresh.onclick =
                function () {
                    addLog(
                        "server_stats_refresh",
                        "Обновление статистики Мурманска"
                    );

                    loadServerStats();
                };
        }

        if (
            state.page ===
            "dashboard"
        ) {
            loadServerStats();
        }

        if (
            state.page ===
            "logs" &&
            state.user &&
            state.user.role ===
                "management" &&
            !state.auditLogsLoaded
        ) {
            loadAuditLogs();
        }

        var refreshAuditLogs =
            document.getElementById(
                "refreshAuditLogs"
            );

        if (
            refreshAuditLogs
        ) {
            refreshAuditLogs.onclick =
                function () {
                    addLog(
                        "audit_logs_refresh",
                        "Обновление журнала действий"
                    );

                    state.auditLogsLoaded =
                        false;

                    state.auditLogs =
                        [];

                    refreshAuditLogs.disabled =
                        true;

                    refreshAuditLogs.textContent =
                        "Обновление...";

                    render();
                };
        }

        var notificationForm =
            document.getElementById(
                "notificationForm"
            );

        if (notificationForm) {
            notificationForm.onsubmit =
                function (
                    event
                ) {
                    event.preventDefault();

                    var title =
                        document.getElementById(
                            "notificationTitle"
                        ).value.trim();

                    var textValue =
                        document.getElementById(
                            "notificationText"
                        ).value.trim();

                    if (
                        !title ||
                        !textValue
                    ) {
                        return;
                    }

                    var type =
                        document.getElementById(
                            "notificationType"
                        ).value;

                    var typeName =
                        NOTIFICATION_TYPES
                            .find(
                                function (
                                    pair
                                ) {
                                    return (
                                        pair[0] ===
                                        type
                                    );
                                }
                            )[1];

                    var expiresValue =
                        document.getElementById(
                            "notificationExpires"
                        ).value;

                    var expiresAt =
                        expiresValue
                            ? new Date(
                                expiresValue
                            ).getTime()
                            : null;

                    var notifications =
                        getNotifications();

                    notifications.unshift({
                        id:
                            "n-" +
                            Date.now(),

                        title:
                            title,

                        type:
                            type,

                        typeName:
                            typeName,

                        text:
                            textValue,

                        target:
                            document.getElementById(
                                "notificationTarget"
                            ).value,

                        createdAt:
                            new Date()
                                .toLocaleString(
                                    "ru-RU"
                                ),

                        expiresAt:
                            expiresAt
                    });

                    setJSON(
                        "br_notifications",
                        notifications.slice(
                            0,
                            200
                        )
                    );

                    addLog(
                        "notification_created",
                        title
                    );

                    render();
                };
        }

        document
            .querySelectorAll(
                "[data-read-notification]"
            )
            .forEach(
                function (
                    button
                ) {
                    button.onclick =
                        function () {
                            markRead(
                                button.getAttribute(
                                    "data-read-notification"
                                )
                            );

                            addLog(
                                "notification_read",
                                button.getAttribute(
                                    "data-read-notification"
                                )
                            );

                            render();
                        };
                }
            );

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
                            document.getElementById(
                                "normPosition"
                            ).value,

                        file:
                            file.name,

                        comment:
                            document.getElementById(
                                "comment"
                            ).value,

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

                    var textValue =
                        document.getElementById(
                            "requestText"
                        ).value.trim();

                    if (!textValue) {
                        return;
                    }

                    var list =
                        getRequests();

                    list.unshift({
                        nickname:
                            state.user.nickname,

                        type:
                            document.getElementById(
                                "requestType"
                            ).value,

                        date:
                            new Date()
                                .toLocaleDateString(
                                    "ru-RU"
                                ),

                        status:
                            "На рассмотрении",

                        text:
                            textValue,

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
                        "Новое обращение"
                    );

                    render();
                };
        }

        var accessForm =
            document.getElementById(
                "accessForm"
            );

        var accessNickname =
            document.getElementById(
                "accessNickname"
            );

        var accessPassword =
            document.getElementById(
                "accessPassword"
            );

        var generatePasswordButton =
            document.getElementById(
                "generateAccessPassword"
            );

        if (
            generatePasswordButton &&
            accessPassword
        ) {
            generatePasswordButton.onclick =
                function () {
                    accessPassword.value =
                        generatePassword(12);

                    accessPassword.focus();
                    accessPassword.select();
                };
        }

        if (accessForm) {
            accessForm.onsubmit =
                function (event) {
                    event.preventDefault();

                    var nickname =
                        accessNickname
                            ? accessNickname.value.trim()
                            : "";

                    var password =
                        accessPassword
                            ? accessPassword.value
                            : "";

                    var role =
                        document.getElementById(
                            "accessRole"
                        ).value;

                    var position =
                        document.getElementById(
                            "accessPosition"
                        ).value;

                    if (
                        !nickname ||
                        !password
                    ) {
                        return;
                    }

                    var login =
                        nickname
                            .toLowerCase();

                    var users =
                        getUsers();

                    users[login] = {
                        login:
                            nickname,

                        password:
                            password,

                        nickname:
                            nickname,

                        position:
                            position,

                        role:
                            role
                    };

                    saveUsers(
                        users
                    );

                    addLog(
                        "access_granted",
                        nickname
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
                    "[BR AdminTools] Авторизация отрисована"
                );

                return;
            }

            if (
                state.user.role !==
                "management"
            ) {
                if (
                    [
                        "normatives-all",
                        "requests-all",
                        "logs",
                        "access"
                    ].indexOf(
                        state.page
                    ) !== -1
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
                "[BR AdminTools] Раздел:",
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
                        '<p>Откройте F12 → Console. Ищите сообщения [BR AdminTools].</p>' +
                        '<button class="login-submit" id="reloadApp">' +
                            'Перезагрузить' +
                        '</button>' +
                    '</section>' +
                '</main>';

            var reload =
                document.getElementById(
                    "reloadApp"
                );

            if (reload) {
                reload.onclick =
                    function () {
                        location.reload();
                    };
            }
        }
    }

    window.BR_SERVER_STATS = {
        get:
            function () {
                return JSON.parse(
                    JSON.stringify(
                        SERVER_INFO
                    )
                );
            },

        update:
            function (data) {
                if (
                    !data ||
                    typeof data !== "object"
                ) {
                    return;
                }

                if (
                    data.name !== undefined
                ) {
                    SERVER_INFO.name =
                        String(
                            data.name
                        );
                }

                if (
                    data.online !== undefined
                ) {
                    SERVER_INFO.online =
                        data.online == null
                            ? null
                            : Number(
                                data.online
                            );
                }

                if (
                    data.status !== undefined
                ) {
                    SERVER_INFO.status =
                        String(
                            data.status
                        );
                }

                if (
                    data.color !== undefined &&
                    /^#[0-9a-fA-F]{6}$/.test(
                        String(
                            data.color
                        )
                    )
                ) {
                    SERVER_INFO.color =
                        String(
                            data.color
                        );
                }

                if (
                    data.updatedAt !== undefined
                ) {
                    SERVER_INFO.updatedAt =
                        data.updatedAt;
                } else {
                    SERVER_INFO.updatedAt =
                        new Date().toISOString();
                }

                var nameElement =
                    document.getElementById(
                        "serverName"
                    );

                var shortNameElement =
                    document.getElementById(
                        "serverNameShort"
                    );

                var onlineElement =
                    document.getElementById(
                        "serverOnline"
                    );

                var statusElement =
                    document.getElementById(
                        "serverStatus"
                    );

                var stateElement =
                    document.getElementById(
                        "serverState"
                    );

                var updatedElement =
                    document.getElementById(
                        "serverUpdated"
                    );

                var dotElement =
                    document.getElementById(
                        "serverStatusDot"
                    );

                if (nameElement) {
                    nameElement.textContent =
                        SERVER_INFO.name;
                }

                if (shortNameElement) {
                    shortNameElement.textContent =
                        SERVER_INFO.name;
                }

                if (onlineElement) {
                    onlineElement.textContent =
                        SERVER_INFO.online == null
                            ? "—"
                            : String(
                                SERVER_INFO.online
                            );
                }

                if (statusElement) {
                    statusElement.textContent =
                        SERVER_INFO.status;
                }

                if (stateElement) {
                    stateElement.textContent =
                        SERVER_INFO.status;
                }

                if (updatedElement) {
                    updatedElement.textContent =
                        SERVER_INFO.updatedAt
                            ? (
                                "Обновлено " +
                                new Date(
                                    SERVER_INFO.updatedAt
                                ).toLocaleTimeString(
                                    "ru-RU",
                                    {
                                        hour: "2-digit",
                                        minute: "2-digit"
                                    }
                                )
                            )
                            : "Данные ещё не получены";
                }

                if (dotElement) {
                    dotElement.style.background =
                        SERVER_INFO.color;
                    dotElement.style.boxShadow =
                        "0 0 0 4px " +
                        SERVER_INFO.color +
                        "22";
                }
            }
    };

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

                state.user = null;
                state.expires = 0;

                if (timer) {
                    clearInterval(
                        timer
                    );
                }

                timer = null;

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
                    "br_notifications"
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
                    getUsers()
                );
            }
    };

    try {
        if (!restoreSession()) {
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
                    '<p>Откройте F12 → Console и найдите [BR AdminTools].</p>' +
                '</section>' +
            '</main>';
    }
})();
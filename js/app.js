(function () {
    "use strict";

    var app = document.getElementById("app");
    var root = document.documentElement;
    var themeColor = document.getElementById("themeColor");

    var state = {
        user: null,
        page: "dashboard",
        selectedFile: null,
        modal: null
    };

    var DEMO_USERS = {
        admin: {
            password: "admin123",
            nickname: "Nikita_Zvezda",
            role: "management",
            roleName: "Руководство сервера"
        },
        test: {
            password: "test123",
            nickname: "Test_Admin",
            role: "admin",
            roleName: "Обычный администратор"
        }
    };

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

    var LOCAL_STATS = {
        nickname: "Test_Admin",
        position: "Модератор",
        daysOnPost: 47,
        answers: 126,
        calls: 91,
        punishments: 84,
        warnings: 3,
        level: 5
    };

    var MANAGEMENT_ADMINS = [
        {
            nickname: "Nikita_Zvezda",
            position: "Руководство",
            days: 512,
            status: "Активен"
        },
        {
            nickname: "Test_Admin",
            position: "Модератор",
            days: 47,
            status: "Активен"
        },
        {
            nickname: "Alex_Murmansk",
            position: "Старший модератор",
            days: 122,
            status: "Неактив"
        },
        {
            nickname: "Max_Admin",
            position: "Администратор",
            days: 211,
            status: "Активен"
        },
        {
            nickname: "Rus_Leader",
            position: "Следящий",
            days: 301,
            status: "Активен"
        }
    ];

    var LOCAL_REQUESTS = [
        {
            id: 105,
            nickname: "Test_Admin",
            type: "Неактив",
            date: "25.08.2026",
            status: "На рассмотрении",
            text: "Прошу предоставить неактив до 30.08.2026."
        },
        {
            id: 104,
            nickname: "Alex_Murmansk",
            type: "Повышение",
            date: "24.08.2026",
            status: "Принято",
            text: "Прошу рассмотреть повышение."
        },
        {
            id: 103,
            nickname: "Max_Admin",
            type: "Другое",
            date: "23.08.2026",
            status: "Отклонено",
            text: "Обращение к руководству."
        }
    ];

    var LOCAL_PROMOTIONS = [
        {
            nickname: "Test_Admin",
            from: "Модератор",
            to: "Старший модератор",
            date: "25.08.2026",
            status: "На рассмотрении",
            answers: 2310,
            punishments: 1102,
            warnings: 18
        },
        {
            nickname: "Alex_Murmansk",
            from: "Старший модератор",
            to: "Администратор",
            date: "24.08.2026",
            status: "Принято",
            answers: 4120,
            punishments: 1940,
            warnings: 22
        }
    ];

    var LOCAL_LOGS = [
        {
            date: "25.08.2026 14:22",
            user: "Nikita_Zvezda",
            action: "Вход в панель"
        },
        {
            date: "25.08.2026 14:20",
            user: "Nikita_Zvezda",
            action: "Открыт раздел нормативов"
        },
        {
            date: "25.08.2026 13:57",
            user: "Test_Admin",
            action: "Отправлен норматив"
        }
    ];

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function safeStorageGet(key, fallback) {
        try {
            var value = localStorage.getItem(key);

            return value === null
                ? fallback
                : value;
        } catch (error) {
            return fallback;
        }
    }

    function safeStorageSet(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            return false;
        }
    }

    function getTheme() {
        var saved = safeStorageGet(
            "br_theme",
            ""
        );

        if (
            saved === "light" ||
            saved === "dark"
        ) {
            return saved;
        }

        if (
            window.matchMedia &&
            window.matchMedia(
                "(prefers-color-scheme: light)"
            ).matches
        ) {
            return "light";
        }

        return "dark";
    }

    function applyTheme(theme) {
        var finalTheme =
            theme === "light"
                ? "light"
                : "dark";

        root.setAttribute(
            "data-theme",
            finalTheme
        );

        safeStorageSet(
            "br_theme",
            finalTheme
        );

        if (themeColor) {
            themeColor.setAttribute(
                "content",
                finalTheme === "light"
                    ? "#f4f6f9"
                    : "#080a0f"
            );
        }
    }

    function toggleTheme() {
        var current =
            root.getAttribute("data-theme") ||
            "dark";

        applyTheme(
            current === "dark"
                ? "light"
                : "dark"
        );

        render();
    }

    function getHistory() {
        try {
            var data =
                safeStorageGet(
                    "br_normatives",
                    "[]"
                );

            var parsed =
                JSON.parse(data);

            return Array.isArray(parsed)
                ? parsed
                : [];
        } catch (error) {
            return [];
        }
    }

    function saveHistory(item) {
        var history = getHistory();

        history.unshift(item);

        safeStorageSet(
            "br_normatives",
            JSON.stringify(
                history.slice(0, 30)
            )
        );
    }

    function getToday() {
        var date = new Date();

        var year =
            date.getFullYear();

        var month =
            String(
                date.getMonth() + 1
            ).padStart(2, "0");

        var day =
            String(
                date.getDate()
            ).padStart(2, "0");

        return (
            year +
            "-" +
            month +
            "-" +
            day
        );
    }

    function formatDate(value) {
        if (!value) {
            return "—";
        }

        var parts =
            String(value).split("-");

        if (parts.length !== 3) {
            return value;
        }

        return (
            parts[2] +
            "." +
            parts[1] +
            "." +
            parts[0]
        );
    }

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes)) {
            return "0 Б";
        }

        if (bytes < 1024) {
            return bytes + " Б";
        }

        if (bytes < 1024 * 1024) {
            return (
                (bytes / 1024).toFixed(1) +
                " КБ"
            );
        }

        return (
            (bytes / 1024 / 1024).toFixed(2) +
            " МБ"
        );
    }

    function showToast(message) {
        var existing =
            document.querySelector(
                ".toast"
            );

        if (existing) {
            existing.remove();
        }

        var toast =
            document.createElement("div");

        toast.className = "toast";
        toast.textContent = message;

        document.body.appendChild(toast);

        window.setTimeout(
            function () {
                if (toast.parentNode) {
                    toast.remove();
                }
            },
            2600
        );
    }

    function canOpenPage(page) {
        if (!state.user) {
            return false;
        }

        var managementPages = [
            "management",
            "admins",
            "all",
            "logs",
            "normatives-all",
            "requests-all",
            "promotions"
        ];

        if (
            managementPages.indexOf(page) !== -1 &&
            state.user.role !== "management"
        ) {
            return false;
        }

        if (
            page === "normatives" &&
            state.user.role === "management"
        ) {
            return false;
        }

        return true;
    }

    function navigate(page) {
        if (!canOpenPage(page)) {
            showToast(
                "У вас нет доступа к этому разделу"
            );

            return;
        }

        state.page = page;
        state.modal = null;

        closeMobileMenu();
        render();
    }

    function openModal(title, html) {
        state.modal = {
            title: title,
            html: html
        };

        renderModal();
    }

    function closeModal() {
        state.modal = null;
        renderModal();
    }

    function renderModal() {
        var old =
            document.querySelector(
                ".modal-root"
            );

        if (old) {
            old.remove();
        }

        if (!state.modal) {
            document.body.style.overflow = "";
            return;
        }

        document.body.style.overflow = "hidden";

        var rootElement =
            document.createElement("div");

        rootElement.className =
            "modal-root open";

        rootElement.innerHTML =
            '<div class="modal-backdrop" data-action="close-modal"></div>' +
            '<div class="modal" role="dialog" aria-modal="true">' +
                '<div class="modal-head">' +
                    '<h2>' +
                        escapeHtml(
                            state.modal.title
                        ) +
                    '</h2>' +
                    '<button class="modal-close" type="button" data-action="close-modal" aria-label="Закрыть">×</button>' +
                '</div>' +
                state.modal.html +
            '</div>';

        document.body.appendChild(
            rootElement
        );

        var modal =
            rootElement.querySelector(
                ".modal"
            );

        if (modal) {
            window.setTimeout(
                function () {
                    var focusable =
                        modal.querySelector(
                            "button, input, textarea, select"
                        );

                    if (focusable) {
                        focusable.focus();
                    }
                },
                0
            );
        }
    }

    function renderLogin() {
        app.innerHTML =
            '<div class="login-page">' +
                '<div class="login-card">' +

                    '<div class="login-brand">' +
                        '<div class="logo">BR</div>' +
                        '<div class="brand-text">' +
                            '<strong>BLACK RUSSIA</strong>' +
                            '<span>Мурманск • Admin Panel</span>' +
                        '</div>' +
                    '</div>' +

                    '<h1>Авторизация</h1>' +

                    '<p>' +
                        'Войдите в панель администрации сервера.' +
                    '</p>' +

                    '<form class="login-form" id="loginForm" novalidate>' +

                        '<div class="field">' +
                            '<label for="loginInput">Логин</label>' +
                            '<input ' +
                                'id="loginInput" ' +
                                'type="text" ' +
                                'autocomplete="username" ' +
                                'autocapitalize="none" ' +
                                'spellcheck="false" ' +
                                'required ' +
                                'enterkeyhint="next"' +
                            '>' +
                        '</div>' +

                        '<div class="field">' +
                            '<label for="passwordInput">Пароль</label>' +
                            '<input ' +
                                'id="passwordInput" ' +
                                'type="password" ' +
                                'autocomplete="current-password" ' +
                                'required ' +
                                'enterkeyhint="done"' +
                            '>' +
                        '</div>' +

                        '<div id="loginError" class="error"></div>' +

                        '<button ' +
                            'class="button button-primary" ' +
                            'type="submit"' +
                        '>' +
                            'Войти' +
                        '</button>' +

                    '</form>' +

                    '<div class="demo-accounts">' +
                        '<strong>Руководство:</strong> admin / admin123' +
                        '<br>' +
                        '<strong>Администратор:</strong> test / test123' +
                    '</div>' +

                '</div>' +
            '</div>';

        var form =
            document.getElementById(
                "loginForm"
            );

        if (!form) {
            return;
        }

        form.addEventListener(
            "submit",
            function (event) {
                event.preventDefault();

                var login =
                    document
                        .getElementById(
                            "loginInput"
                        )
                        .value
                        .trim()
                        .toLowerCase();

                var password =
                    document
                        .getElementById(
                            "passwordInput"
                        )
                        .value;

                var error =
                    document.getElementById(
                        "loginError"
                    );

                if (!login || !password) {
                    error.textContent =
                        "Заполните логин и пароль";

                    return;
                }

                var account =
                    DEMO_USERS[login];

                if (!account) {
                    error.textContent =
                        "Пользователь не найден";

                    return;
                }

                if (
                    account.password !==
                    password
                ) {
                    error.textContent =
                        "Неверный пароль";

                    return;
                }

                state.user = {
                    nickname:
                        account.nickname,
                    role:
                        account.role,
                    roleName:
                        account.roleName
                };

                state.page =
                    "dashboard";

                state.selectedFile =
                    null;

                safeStorageSet(
                    "br_session",
                    JSON.stringify(
                        state.user
                    )
                );

                showToast(
                    "Вход выполнен"
                );

                render();
            }
        );
    }

    function restoreSession() {
        try {
            var saved =
                safeStorageGet(
                    "br_session",
                    ""
                );

            if (!saved) {
                return;
            }

            var user =
                JSON.parse(saved);

            if (
                !user ||
                !user.nickname ||
                !user.role
            ) {
                return;
            }

            state.user = user;
        } catch (error) {
            state.user = null;
        }
    }

    function logout() {
        state.user = null;
        state.page = "dashboard";
        state.selectedFile = null;

        safeStorageSet(
            "br_session",
            ""
        );

        closeMobileMenu();
        closeModal();

        render();
    }

    function navButton(page, icon, title) {
        var active =
            state.page === page
                ? " active"
                : "";

        return (
            '<button ' +
                'class="nav-button' +
                active +
                '" ' +
                'type="button" ' +
                'data-page="' +
                escapeHtml(page) +
                '"' +
            '>' +
                '<span class="nav-icon">' +
                    icon +
                '</span>' +
                '<span>' +
                    escapeHtml(title) +
                '</span>' +
            '</button>'
        );
    }

    function renderSidebar() {
        var management =
            state.user.role ===
            "management";

        var html =
            '<div class="brand">' +
                '<div class="logo">BR</div>' +
                '<div class="brand-text">' +
                    '<strong>BLACK RUSSIA</strong>' +
                    '<span>Мурманск • Admin</span>' +
                '</div>' +
            '</div>' +

            '<nav class="nav">' +

                navButton(
                    "dashboard",
                    "⌂",
                    "Главная"
                ) +

                navButton(
                    "statistics",
                    "▥",
                    "Моя статистика"
                );

        if (!management) {
            html +=
                navButton(
                    "normatives",
                    "▤",
                    "Нормативы"
                );
        }

        html +=
            navButton(
                "requests",
                "✦",
                "Мои обращения"
            ) +

            navButton(
                "rules",
                "☷",
                "Регламент"
            );

        if (management) {
            html +=
                '<div class="nav-section">' +
                    'РУКОВОДСТВО' +
                '</div>' +

                navButton(
                    "normatives-all",
                    "◫",
                    "Все нормативы"
                ) +

                navButton(
                    "requests-all",
                    "✧",
                    "Все обращения"
                ) +

                navButton(
                    "admins",
                    "♙",
                    "Состав администрации"
                ) +

                navButton(
                    "promotions",
                    "↗",
                    "Повышения"
                ) +

                navButton(
                    "management",
                    "◈",
                    "Статистика администрации"
                ) +

                navButton(
                    "all",
                    "◉",
                    "Общая статистика"
                ) +

                navButton(
                    "logs",
                    "◷",
                    "Журнал действий"
                );
        }

        html +=
            '</nav>' +

            '<div class="sidebar-bottom">' +
                '<div class="profile">' +
                    '<div class="avatar">' +
                        escapeHtml(
                            state.user.nickname
                                .charAt(0)
                                .toUpperCase()
                        ) +
                    '</div>' +

                    '<div class="profile-text">' +
                        '<strong>' +
                            escapeHtml(
                                state.user.nickname
                            ) +
                        '</strong>' +

                        '<span>' +
                            escapeHtml(
                                state.user.roleName
                            ) +
                        '</span>' +
                    '</div>' +
                '</div>' +
            '</div>';

        return html;
    }

    function renderShell() {
        app.innerHTML =
            '<div class="app">' +

                '<aside ' +
                    'class="sidebar" ' +
                    'id="sidebar"' +
                    'aria-label="Основная навигация"' +
                '>' +
                    renderSidebar() +
                '</aside>' +

                '<div ' +
                    'class="mobile-backdrop" ' +
                    'id="mobileBackdrop" ' +
                    'data-action="close-menu"' +
                '></div>' +

                '<main class="main">' +

                    '<header class="topbar">' +

                        '<div class="topbar-left">' +

                            '<button ' +
                                'class="button button-icon mobile-menu-button" ' +
                                'type="button" ' +
                                'data-action="toggle-menu" ' +
                                'aria-label="Открыть меню"' +
                            '>' +
                                '☰' +
                            '</button>' +

                            '<span class="topbar-title">' +
                                'BLACK RUSSIA / МУРМАНСК' +
                            '</span>' +

                        '</div>' +

                        '<div class="topbar-right">' +

                            '<button ' +
                                'class="button button-icon theme-button" ' +
                                'type="button" ' +
                                'data-action="theme" ' +
                                'aria-label="Сменить тему"' +
                                'title="Сменить тему"' +
                            '>' +
                                (
                                    root.getAttribute(
                                        "data-theme"
                                    ) === "light"
                                        ? "☾"
                                        : "☀"
                                ) +
                            '</button>' +

                            '<button ' +
                                'class="button" ' +
                                'type="button" ' +
                                'data-action="logout"' +
                            '>' +
                                'Выйти' +
                            '</button>' +

                        '</div>' +

                    '</header>' +

                    '<section ' +
                        'class="content" ' +
                        'id="content"' +
                    '></section>' +

                '</main>' +

            '</div>';
    }

    function statCard(
        label,
        value,
        change
    ) {
        return (
            '<div class="stat-card">' +
                '<div class="stat-label">' +
                    escapeHtml(label) +
                '</div>' +
                '<strong class="stat-value">' +
                    escapeHtml(value) +
                '</strong>' +
                (
                    change
                        ? '<div class="stat-change">' +
                            escapeHtml(change) +
                          '</div>'
                        : ""
                ) +
            '</div>'
        );
    }

    function pageHead(
        title,
        text,
        actions
    ) {
        return (
            '<div class="page-head">' +

                '<div class="page-head-main">' +
                    '<h1>' +
                        escapeHtml(title) +
                    '</h1>' +

                    '<p>' +
                        escapeHtml(text) +
                    '</p>' +
                '</div>' +

                (
                    actions
                        ? '<div class="actions">' +
                            actions +
                          '</div>'
                        : ""
                ) +

            '</div>'
        );
    }

    function dashboardManagement() {
        return (
            pageHead(
                "Панель руководства",
                "Обзор состояния администрации Мурманска",
                ""
            ) +

            '<div class="grid stats-grid">' +

                statCard(
                    "Администраторов",
                    "62",
                    "+4 за месяц"
                ) +

                statCard(
                    "Активны сегодня",
                    "47",
                    "75,8% состава"
                ) +

                statCard(
                    "На рассмотрении",
                    "17",
                    "нормативы и обращения"
                ) +

                statCard(
                    "Повышения",
                    "3",
                    "ожидают решения"
                ) +

            '</div>' +

            '<div class="grid split-grid">' +

                '<div class="card">' +

                    '<div class="card-head">' +
                        '<h2>Последние нормативы</h2>' +
                        '<span>сегодня</span>' +
                    '</div>' +

                    renderRecentNormatives() +

                '</div>' +

                '<div class="card">' +

                    '<div class="card-head">' +
                        '<h2>Последние обращения</h2>' +
                    '</div>' +

                    renderRequestsPreview() +

                '</div>' +

            '</div>' +

            '<div class="card history">' +

                '<div class="card-head">' +
                    '<h2>Последние действия</h2>' +
                '</div>' +

                renderLogsPreview() +

            '</div>'
        );
    }

    function dashboardAdmin() {
        return (
            pageHead(
                "Добро пожаловать",
                "Твоя персональная панель администратора",
                ""
            ) +

            '<div class="grid stats-grid">' +

                statCard(
                    "Никнейм",
                    LOCAL_STATS.nickname,
                    ""
                ) +

                statCard(
                    "Должность",
                    LOCAL_STATS.position,
                    ""
                ) +

                statCard(
                    "Дней на посту",
                    String(
                        LOCAL_STATS.daysOnPost
                    ),
                    ""
                ) +

                statCard(
                    "Ответов",
                    String(
                        LOCAL_STATS.answers
                    ),
                    ""
                ) +

            '</div>' +

            '<div class="grid split-grid">' +

                '<div class="card">' +

                    '<div class="card-head">' +
                        '<h2>Быстрые действия</h2>' +
                    '</div>' +

                    '<div class="actions">' +

                        '<button ' +
                            'class="button button-primary" ' +
                            'type="button" ' +
                            'data-page="normatives"' +
                        '>' +
                            'Отправить норматив' +
                        '</button>' +

                        '<button ' +
                            'class="button" ' +
                            'type="button" ' +
                            'data-action="new-request"' +
                        '>' +
                            'Новое обращение' +
                        '</button>' +

                    '</div>' +

                '</div>' +

                '<div class="card">' +

                    '<div class="card-head">' +
                        '<h2>Статус аккаунта</h2>' +
                    '</div>' +

                    '<div class="notice">' +
                        'Аккаунт активен. Данные пока работают в демонстрационном локальном режиме.' +
                    '</div>' +

                '</div>' +

            '</div>'
        );
    }

    function renderRecentNormatives() {
        var history =
            getHistory();

        var rows = "";

        if (history.length === 0) {
            rows =
                '<tr>' +
                    '<td colspan="5">' +
                        '<div class="empty">' +
                            'Локальных нормативов пока нет' +
                        '</div>' +
                    '</td>' +
                '</tr>';
        } else {
            history
                .slice(0, 5)
                .forEach(
                    function (item) {
                        rows +=
                            '<tr ' +
                                'class="table-clickable" ' +
                                'data-action="normative-detail" ' +
                                'data-index="' +
                                    escapeHtml(
                                        String(
                                            history.indexOf(
                                                item
                                            )
                                        )
                                    ) +
                            '">' +

                                '<td>' +
                                    escapeHtml(
                                        formatDate(
                                            item.date
                                        )
                                    ) +
                                '</td>' +

                                '<td>' +
                                    escapeHtml(
                                        item.nickname
                                    ) +
                                '</td>' +

                                '<td>' +
                                    escapeHtml(
                                        item.position
                                    ) +
                                '</td>' +

                                '<td>' +
                                    escapeHtml(
                                        item.fileName
                                    ) +
                                '</td>' +

                                '<td>' +
                                    '<span class="badge badge-success">' +
                                        'Получен' +
                                    '</span>' +
                                '</td>' +

                            '</tr>';
                    }
                );
        }

        return (
            '<div class="table-wrapper">' +
                '<table>' +
                    '<thead>' +
                        '<tr>' +
                            '<th>Дата</th>' +
                            '<th>Никнейм</th>' +
                            '<th>Должность</th>' +
                            '<th>Файл</th>' +
                            '<th>Статус</th>' +
                        '</tr>' +
                    '</thead>' +
                    '<tbody>' +
                        rows +
                    '</tbody>' +
                '</table>' +
            '</div>'
        );
    }

    function renderRequestsPreview() {
        var rows = "";

        LOCAL_REQUESTS
            .slice(0, 5)
            .forEach(
                function (item) {
                    rows +=
                        '<tr ' +
                            'class="table-clickable" ' +
                            'data-action="request-detail" ' +
                            'data-id="' +
                                escapeHtml(
                                    String(
                                        item.id
                                    )
                                ) +
                        '">' +

                            '<td>' +
                                "#" +
                                item.id +
                            '</td>' +

                            '<td>' +
                                escapeHtml(
                                    item.nickname
                                ) +
                            '</td>' +

                            '<td>' +
                                escapeHtml(
                                    item.type
                                ) +
                            '</td>' +

                            '<td>' +
                                statusBadge(
                                    item.status
                                ) +
                            '</td>' +

                        '</tr>';
                }
            );

        return (
            '<div class="table-wrapper">' +
                '<table>' +
                    '<thead>' +
                        '<tr>' +
                            '<th>№</th>' +
                            '<th>Администратор</th>' +
                            '<th>Тип</th>' +
                            '<th>Статус</th>' +
                        '</tr>' +
                    '</thead>' +
                    '<tbody>' +
                        rows +
                    '</tbody>' +
                '</table>' +
            '</div>'
        );
    }

    function renderLogsPreview() {
        var html = "";

        LOCAL_LOGS
            .slice(0, 5)
            .forEach(
                function (item) {
                    html +=
                        '<div class="activity-item">' +
                            '<i class="activity-dot blue"></i>' +
                            '<div class="activity-content">' +
                                '<strong>' +
                                    escapeHtml(
                                        item.user
                                    ) +
                                '</strong>' +
                                '<p>' +
                                    escapeHtml(
                                        item.action
                                    ) +
                                    " • " +
                                    escapeHtml(
                                        item.date
                                    ) +
                                '</p>' +
                            '</div>' +
                        '</div>';
                }
            );

        return (
            '<div class="activity">' +
                html +
            '</div>'
        );
    }

    function statisticsPage() {
        var management =
            state.user.role ===
            "management";

        return (
            pageHead(
                "Моя статистика",
                "Персональные показатели",
                ""
            ) +

            '<div class="grid stats-grid">' +

                statCard(
                    "Никнейм",
                    state.user.nickname,
                    ""
                ) +

                statCard(
                    "Должность",
                    management
                        ? "Руководство"
                        : LOCAL_STATS.position,
                    ""
                ) +

                statCard(
                    "Дни на посту",
                    management
                        ? "—"
                        : String(
                            LOCAL_STATS.daysOnPost
                        ),
                    ""
                ) +

                statCard(
                    "Ответов",
                    management
                        ? "—"
                        : String(
                            LOCAL_STATS.answers
                        ),
                    ""
                ) +

            '</div>' +

            '<div class="card history">' +

                '<div class="card-head">' +
                    '<h2>Дополнительные показатели</h2>' +
                    '<span>локально</span>' +
                '</div>' +

                '<div class="detail-grid">' +

                    detailItem(
                        "Вызовы",
                        management
                            ? "—"
                            : LOCAL_STATS.calls
                    ) +

                    detailItem(
                        "Наказания",
                        management
                            ? "—"
                            : LOCAL_STATS.punishments
                    ) +

                    detailItem(
                        "Предупреждения",
                        management
                            ? "—"
                            : LOCAL_STATS.warnings
                    ) +

                    detailItem(
                        "Уровень",
                        management
                            ? "—"
                            : LOCAL_STATS.level
                    ) +

                '</div>' +

            '</div>'
        );
    }

    function detailItem(label, value) {
        return (
            '<div class="detail-item">' +
                '<span>' +
                    escapeHtml(label) +
                '</span>' +
                '<strong>' +
                    escapeHtml(value) +
                '</strong>' +
            '</div>'
        );
    }

    function normativesPage() {
        if (state.user.role === "management") {
            return (
                pageHead(
                    "Нормативы",
                    "Раздел недоступен для отправки руководством",
                    ""
                ) +
                '<div class="card">' +
                    '<div class="notice">' +
                        'Для руководства доступен раздел «Все нормативы».' +
                    '</div>' +
                '</div>'
            );
        }

        var history =
            getHistory();

        var rows = "";

        history.forEach(
            function (item, index) {
                rows +=
                    '<tr>' +

                        '<td>' +
                            escapeHtml(
                                formatDate(
                                    item.date
                                )
                            ) +
                        '</td>' +

                        '<td>' +
                            escapeHtml(
                                item.position
                            ) +
                        '</td>' +

                        '<td>' +
                            escapeHtml(
                                item.fileName
                            ) +
                        '</td>' +

                        '<td>' +
                            escapeHtml(
                                item.comment ||
                                "—"
                            ) +
                        '</td>' +

                        '<td>' +
                            '<span class="badge badge-success">' +
                                'Локально' +
                            '</span>' +
                        '</td>' +

                    '</tr>';
            }
        );

        if (!rows) {
            rows =
                '<tr>' +
                    '<td colspan="5">' +
                        '<div class="empty">' +
                            'Отправок пока нет' +
                        '</div>' +
                    '</td>' +
                '</tr>';
        }

        var options = "";

        POSITIONS.forEach(
            function (position) {
                options +=
                    '<option value="' +
                        escapeHtml(position) +
                    '">' +
                        escapeHtml(position) +
                    '</option>';
            }
        );

        return (
            pageHead(
                "Нормативы",
                "Отправка нормативного файла",
                ""
            ) +

            '<div class="card">' +

                '<div class="form-grid">' +

                    '<div class="field field-full">' +
                        '<label for="normativeFile">' +
                            'Файл' +
                        '</label>' +

                        '<div class="file-box">' +

                            '<input ' +
                                'id="normativeFile" ' +
                                'type="file" ' +
                                'accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.zip" ' +
                            '>' +

                            '<div ' +
                                'class="file-info" ' +
                                'id="fileInfo"' +
                            '>' +
                                'Файл не выбран' +
                            '</div>' +

                        '</div>' +

                    '</div>' +

                    '<div class="field">' +
                        '<label for="normativeDate">' +
                            'Дата' +
                        '</label>' +

                        '<input ' +
                            'id="normativeDate" ' +
                            'type="date" ' +
                            'value="' +
                                getToday() +
                            '"' +
                        '>' +
                    '</div>' +

                    '<div class="field">' +
                        '<label for="normativePosition">' +
                            'Должность' +
                        '</label>' +

                        '<select id="normativePosition">' +
                            options +
                        '</select>' +
                    '</div>' +

                    '<div class="field">' +
                        '<label for="normativeAnswers">' +
                            'Количество ответов' +
                        '</label>' +

                        '<input ' +
                            'id="normativeAnswers" ' +
                            'type="number" ' +
                            'min="0" ' +
                            'inputmode="numeric" ' +
                            'placeholder="0"' +
                        '>' +
                    '</div>' +

                    '<div class="field">' +
                        '<label for="normativePunishments">' +
                            'Количество наказаний' +
                        '</label>' +

                        '<input ' +
                            'id="normativePunishments" ' +
                            'type="number" ' +
                            'min="0" ' +
                            'inputmode="numeric" ' +
                            'placeholder="0"' +
                        '>' +
                    '</div>' +

                    '<div class="field">' +
                        '<label for="normativeWarnings">' +
                            'Предупреждения' +
                        '</label>' +

                        '<input ' +
                            'id="normativeWarnings" ' +
                            'type="number" ' +
                            'min="0" ' +
                            'inputmode="numeric" ' +
                            'placeholder="0"' +
                        '>' +
                    '</div>' +

                    '<div class="field">' +
                        '<label for="normativeCalls">' +
                            'Вызовы' +
                        '</label>' +

                        '<input ' +
                            'id="normativeCalls" ' +
                            'type="number" ' +
                            'min="0" ' +
                            'inputmode="numeric" ' +
                            'placeholder="0"' +
                        '>' +
                    '</div>' +

                    '<div class="field field-full">' +
                        '<label for="normativeComment">' +
                            'Комментарий' +
                        '</label>' +

                        '<textarea ' +
                            'id="normativeComment" ' +
                            'placeholder="Введите комментарий"' +
                        '></textarea>' +
                    '</div>' +

                '</div>' +

                '<div class="actions" style="margin-top:15px">' +

                    '<button ' +
                        'class="button button-primary" ' +
                        'type="button" ' +
                        'data-action="send-normative"' +
                    '>' +
                        'Отправить норматив' +
                    '</button>' +

                '</div>' +

            '</div>' +

            '<div class="card history">' +

                '<div class="card-head">' +
                    '<h2>История отправок</h2>' +
                    '<span>локально</span>' +
                '</div>' +

                '<div class="table-wrapper">' +
                    '<table>' +
                        '<thead>' +
                            '<tr>' +
                                '<th>Дата</th>' +
                                '<th>Должность</th>' +
                                '<th>Файл</th>' +
                                '<th>Комментарий</th>' +
                                '<th>Статус</th>' +
                            '</tr>' +
                        '</thead>' +

                        '<tbody>' +
                            rows +
                        '</tbody>' +
                    '</table>' +
                '</div>' +

            '</div>'
        );
    }

    function requestsPage() {
        var requests =
            LOCAL_REQUESTS.filter(
                function (item) {
                    return (
                        item.nickname ===
                        state.user.nickname
                    );
                }
            );

        var rows = "";

        requests.forEach(
            function (item) {
                rows +=
                    '<tr>' +

                        '<td>#' +
                            escapeHtml(
                                item.id
                            ) +
                        '</td>' +

                        '<td>' +
                            escapeHtml(
                                item.type
                            ) +
                        '</td>' +

                        '<td>' +
                            escapeHtml(
                                item.date
                            ) +
                        '</td>' +

                        '<td>' +
                            statusBadge(
                                item.status
                            ) +
                        '</td>' +

                        '<td>' +
                            '<button ' +
                                'class="button" ' +
                                'type="button" ' +
                                'data-action="request-detail" ' +
                                'data-id="' +
                                    escapeHtml(
                                        String(
                                            item.id
                                        )
                                    ) +
                            '">' +
                                'Открыть' +
                            '</button>' +
                        '</td>' +

                    '</tr>';
            }
        );

        if (!rows) {
            rows =
                '<tr>' +
                    '<td colspan="5">' +
                        '<div class="empty">' +
                            'У вас пока нет обращений' +
                        '</div>' +
                    '</td>' +
                '</tr>';
        }

        return (
            pageHead(
                "Мои обращения",
                "Ваши обращения к руководству",
                '<button class="button button-primary" type="button" data-action="new-request">+ Новое обращение</button>'
            ) +

            '<div class="card">' +

                '<div class="table-wrapper">' +

                    '<table>' +

                        '<thead>' +
                            '<tr>' +
                                '<th>№</th>' +
                                '<th>Тип</th>' +
                                '<th>Дата</th>' +
                                '<th>Статус</th>' +
                                '<th></th>' +
                            '</tr>' +
                        '</thead>' +

                        '<tbody>' +
                            rows +
                        '</tbody>' +

                    '</table>' +

                '</div>' +

            '</div>'
        );
    }

    function rulesPage() {
        return (
            pageHead(
                "Регламент",
                "Правила и требования администрации",
                ""
            ) +

            '<div class="grid">' +

                '<div class="card">' +

                    '<div class="card-head">' +
                        '<h2>Обязанности администратора</h2>' +
                    '</div>' +

                    '<div class="notice">' +
                        'Обработка обращений, соблюдение регламента, корректное применение наказаний и выполнение установленных нормативов.' +
                    '</div>' +

                '</div>' +

                '<div class="card">' +

                    '<div class="card-head">' +
                        '<h2>Нормативы</h2>' +
                    '</div>' +

                    '<div class="notice">' +
                        'Нормативные отчёты должны содержать достоверные показатели и соответствующий файл.' +
                    '</div>' +

                '</div>' +

                '<div class="card">' +

                    '<div class="card-head">' +
                        '<h2>Обращения</h2>' +
                    '</div>' +

                    '<div class="notice">' +
                        'Все обращения должны содержать понятное описание ситуации и необходимые данные.' +
                    '</div>' +

                '</div>' +

            '</div>'
        );
    }

    function allNormativesPage() {
        var history =
            getHistory();

        var rows = "";

        history.forEach(
            function (item, index) {
                rows +=
                    '<tr ' +
                        'class="table-clickable" ' +
                        'data-action="normative-detail" ' +
                        'data-index="' +
                            escapeHtml(
                                String(index)
                            ) +
                    '">' +

                        '<td>' +
                            escapeHtml(
                                formatDate(
                                    item.date
                                )
                            ) +
                        '</td>' +

                        '<td>' +
                            escapeHtml(
                                item.nickname
                            ) +
                        '</td>' +

                        '<td>' +
                            escapeHtml(
                                item.position
                            ) +
                        '</td>' +

                        '<td>' +
                            escapeHtml(
                                item.answers
                            ) +
                        '</td>' +

                        '<td>' +
                            escapeHtml(
                                item.fileName
                            ) +
                        '</td>' +

                        '<td>' +
                            '<span class="badge badge-success">' +
                                'Получен' +
                            '</span>' +
                        '</td>' +

                    '</tr>';
            }
        );

        if (!rows) {
            rows =
                '<tr>' +
                    '<td colspan="6">' +
                        '<div class="empty">' +
                            'Нормативов пока нет' +
                        '</div>' +
                    '</td>' +
                '</tr>';
        }

        return (
            pageHead(
                "Все нормативы",
                "Нормативные отчёты администрации",
                '<button class="button" type="button" data-action="refresh-data">Обновить</button>'
            ) +

            '<div class="card">' +

                '<div class="toolbar">' +

                    '<input ' +
                        'type="search" ' +
                        'placeholder="Поиск по никнейму" ' +
                        'data-filter="normatives-search"' +
                    '>' +

                    '<select data-filter="normatives-position">' +
                        '<option value="">Все должности</option>' +
                        POSITIONS.map(
                            function (position) {
                                return (
                                    '<option value="' +
                                        escapeHtml(position) +
                                    '">' +
                                        escapeHtml(position) +
                                    '</option>'
                                );
                            }
                        ).join("") +
                    '</select>' +

                    '<select data-filter="normatives-status">' +
                        '<option value="">Все статусы</option>' +
                        '<option value="Получен">Получен</option>' +
                        '<option value="Ожидает">Ожидает</option>' +
                    '</select>' +

                    '<button class="button" type="button" data-action="clear-filters">' +
                        'Сбросить' +
                    '</button>' +

                '</div>' +

                '<div class="table-wrapper">' +

                    '<table>' +

                        '<thead>' +
                            '<tr>' +
                                '<th>Дата</th>' +
                                '<th>Никнейм</th>' +
                                '<th>Должность</th>' +
                                '<th>Ответов</th>' +
                                '<th>Файл</th>' +
                                '<th>Статус</th>' +
                            '</tr>' +
                        '</thead>' +

                        '<tbody id="normativesTable">' +
                            rows +
                        '</tbody>' +

                    '</table>' +

                '</div>' +

            '</div>'
        );
    }

    function allRequestsPage() {
        var rows = "";

        LOCAL_REQUESTS.forEach(
            function (item) {
                rows +=
                    '<tr>' +

                        '<td>#' +
                            escapeHtml(
                                item.id
                            ) +
                        '</td>' +

                        '<td>' +
                            escapeHtml(
                                item.nickname
                            ) +
                        '</td>' +

                        '<td>' +
                            escapeHtml(
                                item.type
                            ) +
                        '</td>' +

                        '<td>' +
                            escapeHtml(
                                item.date
                            ) +
                        '</td>' +

                        '<td>' +
                            statusBadge(
                                item.status
                            ) +
                        '</td>' +

                        '<td>' +
                            '<button ' +
                                'class="button" ' +
                                'type="button" ' +
                                'data-action="request-detail" ' +
                                'data-id="' +
                                    escapeHtml(
                                        String(
                                            item.id
                                        )
                                    ) +
                            '">' +
                                'Открыть' +
                            '</button>' +
                        '</td>' +

                    '</tr>';
            }
        );

        return (
            pageHead(
                "Все обращения",
                "Обращения администрации к руководству",
                '<button class="button" type="button" data-action="refresh-data">Обновить</button>'
            ) +

            '<div class="card">' +

                '<div class="toolbar">' +

                    '<input ' +
                        'type="search" ' +
                        'placeholder="Поиск" ' +
                    '>' +

                    '<select>' +
                        '<option>Все типы</option>' +
                        '<option>Неактив</option>' +
                        '<option>Повышение</option>' +
                        '<option>Другое</option>' +
                    '</select>' +

                    '<select>' +
                        '<option>Все статусы</option>' +
                        '<option>На рассмотрении</option>' +
                        '<option>Принято</option>' +
                        '<option>Отклонено</option>' +
                    '</select>' +

                    '<button class="button" type="button" data-action="clear-filters">' +
                        'Сбросить' +
                    '</button>' +

                '</div>' +

                '<div class="table-wrapper">' +

                    '<table>' +

                        '<thead>' +
                            '<tr>' +
                                '<th>№</th>' +
                                '<th>Администратор</th>' +
                                '<th>Тип</th>' +
                                '<th>Дата</th>' +
                                '<th>Статус</th>' +
                                '<th></th>' +
                            '</tr>' +
                        '</thead>' +

                        '<tbody>' +
                            rows +
                        '</tbody>' +

                    '</table>' +

                '</div>' +

            '</div>'
        );
    }

    function adminsPage() {
        var rows = "";

        MANAGEMENT_ADMINS.forEach(
            function (item) {
                rows +=
                    '<tr ' +
                        'class="table-clickable" ' +
                        'data-action="admin-detail" ' +
                        'data-nickname="' +
                            escapeHtml(
                                item.nickname
                            ) +
                    '">' +

                        '<td>' +
                            escapeHtml(
                                item.nickname
                            ) +
                        '</td>' +

                        '<td>' +
                            escapeHtml(
                                item.position
                            ) +
                        '</td>' +

                        '<td>' +
                            escapeHtml(
                                String(
                                    item.days
                                )
                            ) +
                        '</td>' +

                        '<td>' +
                            (
                                item.status ===
                                "Активен"
                                    ? '<span class="badge badge-success">Активен</span>'
                                    : '<span class="badge badge-wait">Неактив</span>'
                            ) +
                        '</td>' +

                    '</tr>';
            }
        );

        return (
            pageHead(
                "Состав администрации",
                "Список администраторов сервера",
                '<button class="button" type="button" data-action="refresh-data">Обновить</button>'
            ) +

            '<div class="card">' +

                '<div class="toolbar">' +
                    '<input ' +
                        'type="search" ' +
                        'placeholder="Поиск по никнейму"' +
                    '>' +

                    '<select>' +
                        '<option>Все должности</option>' +
                        POSITIONS.map(
                            function (position) {
                                return (
                                    '<option>' +
                                        escapeHtml(position) +
                                    '</option>'
                                );
                            }
                        ).join("") +
                    '</select>' +

                    '<select>' +
                        '<option>Все статусы</option>' +
                        '<option>Активен</option>' +
                        '<option>Неактив</option>' +
                    '</select>' +

                    '<button class="button" type="button" data-action="clear-filters">' +
                        'Сбросить' +
                    '</button>' +
                '</div>' +

                '<div class="table-wrapper">' +

                    '<table>' +

                        '<thead>' +
                            '<tr>' +
                                '<th>Никнейм</th>' +
                                '<th>Должность</th>' +
                                '<th>Дней на посту</th>' +
                                '<th>Статус</th>' +
                            '</tr>' +
                        '</thead>' +

                        '<tbody>' +
                            rows +
                        '</tbody>' +

                    '</table>' +

                '</div>' +

            '</div>'
        );
    }

    function promotionsPage() {
        var rows = "";

        LOCAL_PROMOTIONS.forEach(
            function (item, index) {
                rows +=
                    '<tr ' +
                        'class="table-clickable" ' +
                        'data-action="promotion-detail" ' +
                        'data-index="' +
                            escapeHtml(
                                String(index)
                            ) +
                    '">' +

                        '<td>' +
                            escapeHtml(
                                item.nickname
                            ) +
                        '</td>' +

                        '<td>' +
                            escapeHtml(
                                item.from
                            ) +
                        '</td>' +

                        '<td>' +
                            escapeHtml(
                                item.to
                            ) +
                        '</td>' +

                        '<td>' +
                            escapeHtml(
                                item.date
                            ) +
                        '</td>' +

                        '<td>' +
                            statusBadge(
                                item.status
                            ) +
                        '</td>' +

                    '</tr>';
            }
        );

        return (
            pageHead(
                "Повышения",
                "Заявки на повышение администрации",
                ""
            ) +

            '<div class="card">' +

                '<div class="table-wrapper">' +

                    '<table>' +

                        '<thead>' +
                            '<tr>' +
                                '<th>Администратор</th>' +
                                '<th>Было</th>' +
                                '<th>Стало</th>' +
                                '<th>Дата</th>' +
                                '<th>Статус</th>' +
                            '</tr>' +
                        '</thead>' +

                        '<tbody>' +
                            rows +
                        '</tbody>' +

                    '</table>' +

                '</div>' +

            '</div>'
        );
    }

    function managementPage() {
        return (
            pageHead(
                "Статистика администрации",
                "Сводные показатели состава",
                '<button class="button" type="button" data-action="refresh-data">Обновить</button>'
            ) +

            '<div class="grid stats-grid">' +

                statCard(
                    "Всего",
                    "62",
                    ""
                ) +

                statCard(
                    "Активных",
                    "47",
                    ""
                ) +

                statCard(
                    "В неактиве",
                    "9",
                    ""
                ) +

                statCard(
                    "На рассмотрении",
                    "6",
                    ""
                ) +

            '</div>' +

            '<div class="grid split-grid">' +

                '<div class="card">' +

                    '<div class="card-head">' +
                        '<h2>Состав по должностям</h2>' +
                    '</div>' +

                    '<div class="table-wrapper">' +

                        '<table>' +

                            '<thead>' +
                                '<tr>' +
                                    '<th>Категория</th>' +
                                    '<th>Количество</th>' +
                                '</tr>' +
                            '</thead>' +

                            '<tbody>' +

                                '<tr>' +
                                    '<td>Младший состав</td>' +
                                    '<td>26</td>' +
                                '</tr>' +

                                '<tr>' +
                                    '<td>Старший состав</td>' +
                                    '<td>19</td>' +
                                '</tr>' +

                                '<tr>' +
                                    '<td>Руководство</td>' +
                                    '<td>17</td>' +
                                '</tr>' +

                            '</tbody>' +

                        '</table>' +

                    '</div>' +

                '</div>' +

                '<div class="card">' +

                    '<div class="card-head">' +
                        '<h2>Контроль</h2>' +
                    '</div>' +

                    '<div class="activity">' +

                        '<div class="activity-item">' +
                            '<i class="activity-dot green"></i>' +
                            '<div class="activity-content">' +
                                '<strong>47 активных</strong>' +
                                '<p>Администраторы находятся в рабочем статусе.</p>' +
                            '</div>' +
                        '</div>' +

                        '<div class="activity-item">' +
                            '<i class="activity-dot blue"></i>' +
                            '<div class="activity-content">' +
                                '<strong>8 нормативов</strong>' +
                                '<p>Ожидают проверки.</p>' +
                            '</div>' +
                        '</div>' +

                    '</div>' +

                '</div>' +

            '</div>'
        );
    }

    function allStatisticsPage() {
        return (
            pageHead(
                "Общая статистика",
                "Сводные показатели администрации",
                ""
            ) +

            '<div class="grid stats-grid">' +

                statCard(
                    "Вызовов",
                    "1 284",
                    ""
                ) +

                statCard(
                    "Наказаний",
                    "934",
                    ""
                ) +

                statCard(
                    "Обращений",
                    "217",
                    ""
                ) +

                statCard(
                    "Пиковый онлайн",
                    "2 314",
                    ""
                ) +

            '</div>' +

            '<div class="grid split-grid">' +

                '<div class="card">' +

                    '<div class="card-head">' +
                        '<h2>Статистика</h2>' +
                    '</div>' +

                    '<div class="detail-grid">' +

                        detailItem(
                            "Ответов за период",
                            "12 847"
                        ) +

                        detailItem(
                            "Наказаний за период",
                            "8 412"
                        ) +

                        detailItem(
                            "Активных администраторов",
                            "47"
                        ) +

                        detailItem(
                            "Новых повышений",
                            "14"
                        ) +

                    '</div>' +

                '</div>' +

                '<div class="card">' +

                    '<div class="card-head">' +
                        '<h2>Источник данных</h2>' +
                    '</div>' +

                    '<div class="notice">' +
                        'На данном этапе используются демонстрационные данные. После определения схемы подключения основной таблицы этот раздел будет получать реальные значения.' +
                    '</div>' +

                '</div>' +

            '</div>'
        );
    }

    function logsPage() {
        return (
            pageHead(
                "Журнал действий",
                "История действий пользователей панели",
                ""
            ) +

            '<div class="card">' +

                '<div class="table-wrapper">' +

                    '<table>' +

                        '<thead>' +
                            '<tr>' +
                                '<th>Дата</th>' +
                                '<th>Пользователь</th>' +
                                '<th>Действие</th>' +
                            '</tr>' +
                        '</thead>' +

                        '<tbody>' +

                            LOCAL_LOGS.map(
                                function (item) {
                                    return (
                                        '<tr>' +
                                            '<td>' +
                                                escapeHtml(
                                                    item.date
                                                ) +
                                            '</td>' +
                                            '<td>' +
                                                escapeHtml(
                                                    item.user
                                                ) +
                                            '</td>' +
                                            '<td>' +
                                                escapeHtml(
                                                    item.action
                                                ) +
                                            '</td>' +
                                        '</tr>'
                                    );
                                }
                            ).join("") +

                        '</tbody>' +

                    '</table>' +

                '</div>' +

            '</div>'
        );
    }

    function statusBadge(status) {
        if (status === "Принято") {
            return (
                '<span class="badge badge-success">' +
                    escapeHtml(status) +
                '</span>'
            );
        }

        if (status === "Отклонено") {
            return (
                '<span class="badge badge-danger">' +
                    escapeHtml(status) +
                '</span>'
            );
        }

        return (
            '<span class="badge badge-wait">' +
                escapeHtml(status) +
            '</span>'
        );
    }

    function renderPage() {
        var content =
            document.getElementById(
                "content"
            );

        if (!content) {
            return;
        }

        var html = "";

        switch (state.page) {
            case "dashboard":
                html =
                    state.user.role ===
                    "management"
                        ? dashboardManagement()
                        : dashboardAdmin();
                break;

            case "statistics":
                html =
                    statisticsPage();
                break;

            case "normatives":
                html =
                    normativesPage();
                break;

            case "requests":
                html =
                    requestsPage();
                break;

            case "rules":
                html =
                    rulesPage();
                break;

            case "normatives-all":
                html =
                    allNormativesPage();
                break;

            case "requests-all":
                html =
                    allRequestsPage();
                break;

            case "admins":
                html =
                    adminsPage();
                break;

            case "promotions":
                html =
                    promotionsPage();
                break;

            case "management":
                html =
                    managementPage();
                break;

            case "all":
                html =
                    allStatisticsPage();
                break;

            case "logs":
                html =
                    logsPage();
                break;

            default:
                state.page =
                    "dashboard";

                html =
                    state.user.role ===
                    "management"
                        ? dashboardManagement()
                        : dashboardAdmin();
        }

        content.innerHTML = html;
    }

    function toggleMobileMenu() {
        var sidebar =
            document.getElementById(
                "sidebar"
            );

        var backdrop =
            document.getElementById(
                "mobileBackdrop"
            );

        if (!sidebar || !backdrop) {
            return;
        }

        sidebar.classList.toggle(
            "open"
        );

        backdrop.classList.toggle(
            "show"
        );
    }

    function closeMobileMenu() {
        var sidebar =
            document.getElementById(
                "sidebar"
            );

        var backdrop =
            document.getElementById(
                "mobileBackdrop"
            );

        if (sidebar) {
            sidebar.classList.remove(
                "open"
            );
        }

        if (backdrop) {
            backdrop.classList.remove(
                "show"
            );
        }
    }

    function openRequestModal() {
        openModal(
            "Новое обращение",
            '<form id="requestForm">' +

                '<div class="form-grid">' +

                    '<div class="field">' +
                        '<label for="requestType">' +
                            'Тип обращения' +
                        '</label>' +

                        '<select id="requestType">' +
                            '<option>Неактив</option>' +
                            '<option>Повышение</option>' +
                            '<option>Другое</option>' +
                        '</select>' +
                    '</div>' +

                    '<div class="field">' +
                        '<label for="requestDate">' +
                            'Дата' +
                        '</label>' +

                        '<input ' +
                            'id="requestDate" ' +
                            'type="date" ' +
                            'value="' +
                                getToday() +
                        '">' +
                    '</div>' +

                    '<div class="field field-full">' +
                        '<label for="requestText">' +
                            'Описание' +
                        '</label>' +

                        '<textarea ' +
                            'id="requestText" ' +
                            'required ' +
                            'placeholder="Опишите ситуацию"' +
                        '></textarea>' +
                    '</div>' +

                '</div>' +

                '<div class="modal-actions">' +

                    '<button ' +
                        'class="button button-primary" ' +
                        'type="submit"' +
                    '>' +
                        'Отправить' +
                    '</button>' +

                    '<button ' +
                        'class="button" ' +
                        'type="button" ' +
                        'data-action="close-modal"' +
                    '>' +
                        'Отмена' +
                    '</button>' +

                '</div>' +

            '</form>'
        );
    }

    function showRequest(id) {
        var request =
            LOCAL_REQUESTS.find(
                function (item) {
                    return (
                        String(item.id) ===
                        String(id)
                    );
                }
            );

        if (!request) {
            showToast(
                "Обращение не найдено"
            );

            return;
        }

        var actions = "";

        if (
            state.user.role ===
                "management" &&
            request.status ===
                "На рассмотрении"
        ) {
            actions =
                '<div class="modal-actions">' +

                    '<button ' +
                        'class="button button-primary" ' +
                        'type="button" ' +
                        'data-action="approve-request" ' +
                        'data-id="' +
                            escapeHtml(
                                String(
                                    request.id
                                )
                            ) +
                    '">' +
                        'Принять' +
                    '</button>' +

                    '<button ' +
                        'class="button button-danger" ' +
                        'type="button" ' +
                        'data-action="reject-request" ' +
                        'data-id="' +
                            escapeHtml(
                                String(
                                    request.id
                                )
                            ) +
                    '">' +
                        'Отклонить' +
                    '</button>' +

                '</div>';
        }

        openModal(
            "Обращение #" +
                request.id,

            '<div class="detail-grid">' +

                detailItem(
                    "Администратор",
                    request.nickname
                ) +

                detailItem(
                    "Тип",
                    request.type
                ) +

                detailItem(
                    "Дата",
                    request.date
                ) +

                detailItem(
                    "Статус",
                    request.status
                ) +

            '</div>' +

            '<div class="card" style="margin-top:12px">' +
                '<div class="card-head">' +
                    '<h2>Текст обращения</h2>' +
                '</div>' +
                '<div class="notice">' +
                    escapeHtml(
                        request.text
                    ) +
                '</div>' +
            '</div>' +

            actions
        );
    }

    function showPromotion(index) {
        var item =
            LOCAL_PROMOTIONS[
                Number(index)
            ];

        if (!item) {
            return;
        }

        var actions =
            item.status ===
                "На рассмотрении"
                ? '<div class="modal-actions">' +

                    '<button ' +
                        'class="button button-primary" ' +
                        'type="button" ' +
                        'data-action="approve-promotion" ' +
                        'data-index="' +
                            escapeHtml(
                                String(index)
                            ) +
                    '">' +
                        'Принять' +
                    '</button>' +

                    '<button ' +
                        'class="button button-danger" ' +
                        'type="button" ' +
                        'data-action="reject-promotion" ' +
                        'data-index="' +
                            escapeHtml(
                                String(index)
                            ) +
                    '">' +
                        'Отклонить' +
                    '</button>' +

                '</div>'
                : "";

        openModal(
            "Повышение " +
                item.nickname,

            '<div class="detail-grid">' +

                detailItem(
                    "Администратор",
                    item.nickname
                ) +

                detailItem(
                    "Текущая должность",
                    item.from
                ) +

                detailItem(
                    "Новая должность",
                    item.to
                ) +

                detailItem(
                    "Дата",
                    item.date
                ) +

                detailItem(
                    "Ответов",
                    item.answers
                ) +

                detailItem(
                    "Наказаний",
                    item.punishments
                ) +

                detailItem(
                    "Предупреждений",
                    item.warnings
                ) +

                detailItem(
                    "Статус",
                    item.status
                ) +

            '</div>' +

            actions
        );
    }

    function showAdmin(nickname) {
        var admin =
            MANAGEMENT_ADMINS.find(
                function (item) {
                    return (
                        item.nickname ===
                        nickname
                    );
                }
            );

        if (!admin) {
            return;
        }

        openModal(
            admin.nickname,

            '<div class="detail-grid">' +

                detailItem(
                    "Никнейм",
                    admin.nickname
                ) +

                detailItem(
                    "Должность",
                    admin.position
                ) +

                detailItem(
                    "Дней на посту",
                    admin.days
                ) +

                detailItem(
                    "Статус",
                    admin.status
                ) +

                detailItem(
                    "Ответов",
                    admin.nickname ===
                        "Test_Admin"
                        ? LOCAL_STATS.answers
                        : "—"
                ) +

                detailItem(
                    "Наказаний",
                    admin.nickname ===
                        "Test_Admin"
                        ? LOCAL_STATS.punishments
                        : "—"
                ) +

                detailItem(
                    "Последнее повышение",
                    "12.07.2026"
                ) +

                detailItem(
                    "Последний норматив",
                    "25.08.2026"
                ) +

            '</div>' +

            '<div class="modal-actions">' +

                '<button ' +
                    'class="button button-primary" ' +
                    'type="button" ' +
                    'data-action="admin-statistics" ' +
                    'data-nickname="' +
                        escapeHtml(
                            admin.nickname
                        ) +
                '">' +
                    'Открыть статистику' +
                '</button>' +

            '</div>'
        );
    }

    function showNormative(index) {
        var history =
            getHistory();

        var item =
            history[
                Number(index)
            ];

        if (!item) {
            showToast(
                "Норматив не найден"
            );

            return;
        }

        openModal(
            "Норматив",

            '<div class="detail-grid">' +

                detailItem(
                    "Администратор",
                    item.nickname
                ) +

                detailItem(
                    "Дата",
                    formatDate(
                        item.date
                    )
                ) +

                detailItem(
                    "Должность",
                    item.position
                ) +

                detailItem(
                    "Ответов",
                    item.answers
                ) +

                detailItem(
                    "Наказаний",
                    item.punishments
                ) +

                detailItem(
                    "Предупреждений",
                    item.warnings
                ) +

                detailItem(
                    "Вызовов",
                    item.calls
                ) +

                detailItem(
                    "Файл",
                    item.fileName
                ) +

            '</div>' +

            (
                item.comment
                    ? '<div class="card" style="margin-top:12px">' +
                        '<div class="card-head">' +
                            '<h2>Комментарий</h2>' +
                        '</div>' +
                        '<div class="notice">' +
                            escapeHtml(
                                item.comment
                            ) +
                        '</div>' +
                      '</div>'
                    : ""
            )
        );
    }

    function handleSendNormative() {
        if (!state.selectedFile) {
            showToast(
                "Выберите файл"
            );

            return;
        }

        var date =
            document.getElementById(
                "normativeDate"
            ).value;

        var position =
            document.getElementById(
                "normativePosition"
            ).value;

        var answers =
            document.getElementById(
                "normativeAnswers"
            ).value;

        var punishments =
            document.getElementById(
                "normativePunishments"
            ).value;

        var warnings =
            document.getElementById(
                "normativeWarnings"
            ).value;

        var calls =
            document.getElementById(
                "normativeCalls"
            ).value;

        var comment =
            document.getElementById(
                "normativeComment"
            ).value.trim();

        if (!date) {
            showToast(
                "Укажите дату"
            );

            return;
        }

        var item = {
            nickname:
                state.user.nickname,
            date: date,
            position: position,
            answers:
                answers || "0",
            punishments:
                punishments || "0",
            warnings:
                warnings || "0",
            calls:
                calls || "0",
            comment:
                comment,
            fileName:
                state.selectedFile.name
        };

        saveHistory(item);

        state.selectedFile = null;

        showToast(
            "Норматив сохранён локально"
        );

        renderPage();
    }

    function createRequest(form) {
        var type =
            document.getElementById(
                "requestType"
            ).value;

        var date =
            document.getElementById(
                "requestDate"
            ).value;

        var text =
            document.getElementById(
                "requestText"
            ).value.trim();

        if (!date || !text) {
            showToast(
                "Заполните все обязательные поля"
            );

            return;
        }

        var nextId =
            LOCAL_REQUESTS.length
                ? Math.max.apply(
                    null,
                    LOCAL_REQUESTS.map(
                        function (item) {
                            return item.id;
                        }
                    )
                ) + 1
                : 1;

        LOCAL_REQUESTS.unshift({
            id: nextId,
            nickname:
                state.user.nickname,
            type: type,
            date:
                formatDate(date),
            status:
                "На рассмотрении",
            text: text
        });

        LOCAL_LOGS.unshift({
            date:
                new Date()
                    .toLocaleString("ru-RU"),
            user:
                state.user.nickname,
            action:
                "Создано обращение #" +
                nextId
        });

        closeModal();

        showToast(
            "Обращение отправлено"
        );

        if (
            state.user.role ===
            "management"
        ) {
            navigate(
                "requests-all"
            );
        } else {
            navigate(
                "requests"
            );
        }
    }

    function changeRequestStatus(
        id,
        status
    ) {
        var request =
            LOCAL_REQUESTS.find(
                function (item) {
                    return (
                        String(item.id) ===
                        String(id)
                    );
                }
            );

        if (!request) {
            return;
        }

        request.status = status;

        LOCAL_LOGS.unshift({
            date:
                new Date()
                    .toLocaleString("ru-RU"),
            user:
                state.user.nickname,
            action:
                status +
                " обращение #" +
                request.id
        });

        closeModal();
        renderPage();

        showToast(
            "Статус обращения изменён"
        );
    }

    function changePromotionStatus(
        index,
        status
    ) {
        var item =
            LOCAL_PROMOTIONS[
                Number(index)
            ];

        if (!item) {
            return;
        }

        item.status = status;

        LOCAL_LOGS.unshift({
            date:
                new Date()
                    .toLocaleString("ru-RU"),
            user:
                state.user.nickname,
            action:
                status +
                " повышение " +
                item.nickname
        });

        closeModal();
        renderPage();

        showToast(
            "Статус повышения изменён"
        );
    }

    function clearFilters() {
        document
            .querySelectorAll(
                ".toolbar input, .toolbar select"
            )
            .forEach(
                function (element) {
                    if (
                        element.tagName ===
                        "SELECT"
                    ) {
                        element.selectedIndex =
                            0;
                    } else {
                        element.value =
                            "";
                    }
                }
            );
    }

    function registerServiceWorker() {
        if (
            !("serviceWorker" in navigator)
        ) {
            return;
        }

        if (
            location.protocol !==
                "http:" &&
            location.protocol !==
                "https:"
        ) {
            return;
        }

        navigator.serviceWorker
            .register("./sw.js")
            .catch(
                function () {}
            );
    }

    document.addEventListener(
        "click",
        function (event) {
            var target =
                event.target.closest(
                    "[data-action], [data-page]"
                );

            if (!target) {
                return;
            }

            var page =
                target.getAttribute(
                    "data-page"
                );

            var action =
                target.getAttribute(
                    "data-action"
                );

            if (page) {
                navigate(page);
                return;
            }

            switch (action) {
                case "theme":
                    toggleTheme();
                    break;

                case "logout":
                    logout();
                    break;

                case "toggle-menu":
                    toggleMobileMenu();
                    break;

                case "close-menu":
                    closeMobileMenu();
                    break;

                case "close-modal":
                    closeModal();
                    break;

                case "new-request":
                    openRequestModal();
                    break;

                case "send-normative":
                    handleSendNormative();
                    break;

                case "request-detail":
                    showRequest(
                        target.getAttribute(
                            "data-id"
                        )
                    );
                    break;

                case "approve-request":
                    changeRequestStatus(
                        target.getAttribute(
                            "data-id"
                        ),
                        "Принято"
                    );
                    break;

                case "reject-request":
                    changeRequestStatus(
                        target.getAttribute(
                            "data-id"
                        ),
                        "Отклонено"
                    );
                    break;

                case "promotion-detail":
                    showPromotion(
                        target.getAttribute(
                            "data-index"
                        )
                    );
                    break;

                case "approve-promotion":
                    changePromotionStatus(
                        target.getAttribute(
                            "data-index"
                        ),
                        "Принято"
                    );
                    break;

                case "reject-promotion":
                    changePromotionStatus(
                        target.getAttribute(
                            "data-index"
                        ),
                        "Отклонено"
                    );
                    break;

                case "admin-detail":
                    showAdmin(
                        target.getAttribute(
                            "data-nickname"
                        )
                    );
                    break;

                case "admin-statistics":
                    closeModal();
                    showToast(
                        "Раздел статистики будет подключён к реальным данным"
                    );
                    break;

                case "normative-detail":
                    showNormative(
                        target.getAttribute(
                            "data-index"
                        )
                    );
                    break;

                case "refresh-data":
                    showToast(
                        "Данные обновлены"
                    );
                    render();
                    break;

                case "clear-filters":
                    clearFilters();
                    break;
            }
        }
    );

    document.addEventListener(
        "change",
        function (event) {
            if (
                event.target.id ===
                "normativeFile"
            ) {
                var file =
                    event.target.files &&
                    event.target.files[0];

                state.selectedFile =
                    file || null;

                var info =
                    document.getElementById(
                        "fileInfo"
                    );

                if (!info) {
                    return;
                }

                if (!file) {
                    info.textContent =
                        "Файл не выбран";

                    return;
                }

                var maxSize =
                    25 * 1024 * 1024;

                if (file.size > maxSize) {
                    state.selectedFile =
                        null;

                    event.target.value =
                        "";

                    info.textContent =
                        "Файл слишком большой";

                    showToast(
                        "Максимальный размер файла — 25 МБ"
                    );

                    return;
                }

                info.textContent =
                    file.name +
                    " — " +
                    formatBytes(
                        file.size
                    );
            }
        }
    );

    document.addEventListener(
        "submit",
        function (event) {
            if (
                event.target.id !==
                "requestForm"
            ) {
                return;
            }

            event.preventDefault();

            createRequest(
                event.target
            );
        }
    );

    document.addEventListener(
        "keydown",
        function (event) {
            if (
                event.key === "Escape"
            ) {
                if (state.modal) {
                    closeModal();
                    return;
                }

                closeMobileMenu();
            }
        }
    );

     function render() {
         applyTheme(
             root.getAttribute("data-theme") ||
             getTheme()
         );

         if (!state.user) {
             renderLogin();
             return;
         }

         if (!canOpenPage(state.page)) {
             state.page =
                 "dashboard";
         }

         renderShell();
         renderPage();
         renderModal();
     }

     function registerManifest() {
         if (
             location.protocol !== "http:" &&
             location.protocol !== "https:"
         ) {
             return;
         }

         var existing =
             document.querySelector(
                 'link[rel="manifest"]'
             );

         if (existing) {
             return;
         }

         var link =
             document.createElement("link");

         link.rel = "manifest";
         link.href = "manifest.json";

         document.head.appendChild(link);
     }

     applyTheme(
         getTheme()
     );

     restoreSession();

     registerManifest();

     registerServiceWorker();

     render();
 })();
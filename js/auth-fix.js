(function () {
    "use strict";

    var USERS = {
        admin: { password: "Admin2026!", nickname: "Nikita_Zvezda", position: "Руководство", role: "management" },
        test: { password: "Test2026!", nickname: "Test_Admin", position: "Модератор", role: "admin" }
    };

    document.addEventListener("submit", function (event) {
        var form = event.target;
        if (!form || form.id !== "loginForm") return;

        var login = document.getElementById("login");
        var password = document.getElementById("password");
        if (!login || !password) return;

        var account = USERS[login.value.trim().toLowerCase()];
        if (!account || account.password !== password.value) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        var expires = Date.now() + 3 * 60 * 1000;
        localStorage.setItem("br_session", JSON.stringify({
            user: {
                nickname: account.nickname,
                position: account.position,
                role: account.role
            },
            expires: expires
        }));

        window.location.reload();
    }, true);
})();

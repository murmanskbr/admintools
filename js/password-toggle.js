(function () {
    "use strict";

    function attach() {
        var input = document.getElementById("password");
        var form = document.getElementById("loginForm");
        if (!input || !form || document.getElementById("passwordToggle")) return;

        var wrapper = document.createElement("div");
        wrapper.style.position = "relative";
        wrapper.style.width = "100%";
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);

        input.style.width = "100%";
        input.style.paddingRight = "82px";
        input.style.boxSizing = "border-box";

        var button = document.createElement("button");
        button.type = "button";
        button.id = "passwordToggle";
        button.textContent = "Показать";
        button.setAttribute("aria-label", "Показать пароль");
        button.style.position = "absolute";
        button.style.right = "8px";
        button.style.top = "50%";
        button.style.transform = "translateY(-50%)";
        button.style.background = "transparent";
        button.style.border = "0";
        button.style.color = "var(--muted, #9aa3b2)";
        button.style.padding = "6px 7px";
        button.style.cursor = "pointer";
        button.style.font = "inherit";
        button.style.fontSize = "11px";
        button.style.fontWeight = "600";
        button.style.zIndex = "2";
        wrapper.appendChild(button);

        button.addEventListener("click", function () {
            var visible = input.type === "text";
            input.type = visible ? "password" : "text";
            button.textContent = visible ? "Показать" : "Скрыть";
            button.setAttribute("aria-label", visible ? "Показать пароль" : "Скрыть пароль");
        });

        if (!document.getElementById("demoCredentials")) {
            var credentials = document.createElement("div");
            credentials.id = "demoCredentials";
            credentials.style.marginTop = "14px";
            credentials.style.padding = "12px 14px";
            credentials.style.border = "1px solid var(--border, #303640)";
            credentials.style.borderRadius = "10px";
            credentials.style.background = "rgba(255,255,255,.025)";
            credentials.style.color = "var(--muted, #9aa3b2)";
            credentials.style.fontSize = "11px";
            credentials.style.lineHeight = "1.7";
            credentials.innerHTML = '<strong style="display:block;color:var(--text,#fff);margin-bottom:4px">Тестовые данные</strong><div>admin / Admin2026! — руководство</div><div>test / Test2026! — администратор</div>';
            form.appendChild(credentials);
        }
    }

    function observe() {
        attach();
        if (!document.body) return;
        new MutationObserver(attach).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", observe, { once: true });
    } else {
        observe();
    }
})();

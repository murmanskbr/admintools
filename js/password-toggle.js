(function () {
    "use strict";

    function attach() {
        var input = document.getElementById("password");
        if (!input || document.getElementById("passwordToggle")) return;

        var button = document.createElement("button");
        button.type = "button";
        button.id = "passwordToggle";
        button.textContent = "Показать";
        button.setAttribute("aria-label", "Показать пароль");
        button.style.marginTop = "8px";
        button.style.background = "transparent";
        button.style.border = "1px solid var(--border, #303640)";
        button.style.color = "var(--muted, #9aa3b2)";
        button.style.borderRadius = "8px";
        button.style.padding = "8px 12px";
        button.style.cursor = "pointer";
        button.style.font = "inherit";

        input.insertAdjacentElement("afterend", button);

        button.addEventListener("click", function () {
            var visible = input.type === "text";
            input.type = visible ? "password" : "text";
            button.textContent = visible ? "Показать" : "Скрыть";
            button.setAttribute("aria-label", visible ? "Показать пароль" : "Скрыть пароль");
        });
    }

    attach();
    new MutationObserver(attach).observe(document.body, { childList: true, subtree: true });
})();

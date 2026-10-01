(function () {
    "use strict";

    var EYE_OPEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.8"></circle></svg>';
    var EYE_CLOSED = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"></path><path d="M10.6 5.2A10.7 10.7 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.1 3.7M6.2 6.2C3.8 8.2 2.5 12 2.5 12s3.5 6 9.5 6c1.5 0 2.8-.4 4-1"></path><path d="M9.9 9.9a2.8 2.8 0 0 0 4.2 4.2"></path></svg>';

    function apply() {
        var button = document.getElementById("passwordToggle");
        var input = document.getElementById("password");
        if (!button || !input || button.dataset.eyeReady === "1") return;

        button.dataset.eyeReady = "1";
        button.textContent = "";
        button.innerHTML = EYE_OPEN;
        button.setAttribute("aria-label", "Показать пароль");
        button.setAttribute("title", "Показать пароль");
        button.style.width = "34px";
        button.style.height = "34px";
        button.style.display = "flex";
        button.style.alignItems = "center";
        button.style.justifyContent = "center";
        button.style.padding = "6px";
        button.style.right = "7px";
        button.style.top = "50%";
        button.style.transform = "translateY(-50%)";
        button.style.borderRadius = "8px";

        var style = document.getElementById("passwordEyeStyle");
        if (!style) {
            style = document.createElement("style");
            style.id = "passwordEyeStyle";
            style.textContent = '#passwordToggle svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}#passwordToggle:hover{color:var(--text,#fff)!important;background:rgba(255,255,255,.06)!important}';
            document.head.appendChild(style);
        }

        button.addEventListener("click", function () {
            var visible = input.type === "text";
            input.type = visible ? "password" : "text";
            button.innerHTML = visible ? EYE_OPEN : EYE_CLOSED;
            button.setAttribute("aria-label", visible ? "Показать пароль" : "Скрыть пароль");
            button.setAttribute("title", visible ? "Показать пароль" : "Скрыть пароль");
        }, { once: false });
    }

    function watch() {
        apply();
        if (document.body) new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch, { once: true });
    else watch();
})();

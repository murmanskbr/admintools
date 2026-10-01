(function () {
    "use strict";

    var PREFIX = "[BR AdminTools]";

    function log() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(PREFIX);
        console.log.apply(console, args);
    }

    function warn() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(PREFIX);
        console.warn.apply(console, args);
    }

    function error() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(PREFIX);
        console.error.apply(console, args);
    }

    window.addEventListener("error", function (event) {
        error("Ошибка JavaScript:", event.message, "Файл:", event.filename || "неизвестно", "строка:", event.lineno || "?", "колонка:", event.colno || "?");
    });

    window.addEventListener("unhandledrejection", function (event) {
        error("Необработанная Promise-ошибка:", event.reason);
    });

    window.addEventListener("DOMContentLoaded", function () {
        log("Диагностика запущена");
        var app = document.getElementById("app");

        if (!app) {
            error("Элемент #app не найден");
        } else {
            log("Элемент #app найден");
        }

        var stylesheets = Array.prototype.slice.call(document.querySelectorAll('link[rel="stylesheet"]'));
        stylesheets.forEach(function (link) {
            log("CSS подключён:", link.href);
        });

        var scripts = Array.prototype.slice.call(document.querySelectorAll("script[src]"));
        scripts.forEach(function (script) {
            log("JS подключён:", script.src);
        });
    });

    window.addEventListener("load", function () {
        var app = document.getElementById("app");
        if (!app) {
            error("После загрузки #app отсутствует");
            return;
        }

        if (!app.innerHTML.trim()) {
            error("После загрузки #app пустой. Вероятно, app.js не выполнился.");
            return;
        }

        log("Приложение отрисовано");
    });
})();
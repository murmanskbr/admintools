(function () {
  "use strict";

  var current = document.currentScript;
  if (!current) return;

  var runtimeUrl =
    new URL("page-runtime.js", current.src).href;

  var script = document.createElement("script");
  script.src = runtimeUrl;
  script.async = false;

  script.onerror = function () {
    console.error(
      "[BR AdminTools] Не удалось загрузить page runtime:",
      runtimeUrl
    );
  };

  document.head.appendChild(script);
})();
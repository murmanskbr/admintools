(function () {
  "use strict";

  // Compatibility loader for older cached HTML files that still reference
  // js/page.js. Loads the current panel runtime synchronously so the page
  // boots before DOMContentLoaded and avoids a blank screen.
  var current = document.currentScript;
  if (!current) return;

  var panelUrl = new URL("panel.js", current.src).href;
  document.write(
    '<script src="' +
      panelUrl.replace(/"/g, "&quot;") +
    '"><\/script>'
  );
})();
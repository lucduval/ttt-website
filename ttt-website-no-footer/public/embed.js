(function () {
  "use strict";

  window.addEventListener("message", function (e) {
    if (!e.data) return;

    // Support both message types
    var isFormHeight = e.data.type === "FORM_HEIGHT";
    var isLegacy = e.data.type === "ttt-embed-resize";
    if (!isFormHeight && !isLegacy) return;

    var iframes = document.querySelectorAll("iframe.ttt-embed");
    for (var i = 0; i < iframes.length; i++) {
      try {
        if (iframes[i].contentWindow === e.source) {
          iframes[i].style.height = e.data.height + "px";
        }
      } catch (_) {
        /* cross-origin — skip */
      }
    }
  });
})();

(function () {
  try {
    var stored = localStorage.getItem("acolhe-theme") || "system";
    var dark = stored === "dark" || (stored === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();

window.addEventListener("error", function (event) {
  if (event.error instanceof DOMException && event.error.name === "DataCloneError" && event.message && event.message.includes("PerformanceServerTiming")) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
}, true);

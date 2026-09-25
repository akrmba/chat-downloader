(function (root) {
  const namespace = root.ChatExporter;
  const utils = namespace.utils;
  const exporters = namespace.exporters;

  async function init() {
    const jobKey = utils.readQueryParam("job", root.location.search);
    const autoPrint = utils.readQueryParam("print", root.location.search) === "1";
    const app = document.getElementById("app");

    if (!jobKey) {
      app.innerHTML = "<p>Missing export job.</p>";
      return;
    }

    const stored = await chrome.storage.session.get(jobKey);
    const job = stored[jobKey];

    if (!job || !job.chat) {
      app.innerHTML = "<p>Export job expired. Start the export again from the extension popup.</p>";
      return;
    }

    document.title = job.chat.title + " - PDF export";
    app.innerHTML = exporters.renderHtml(job.chat, job.options || {});
    await chrome.storage.session.remove(jobKey);

    if (autoPrint) {
      root.setTimeout(function () {
        root.print();
      }, 350);
    }
  }

  root.addEventListener("DOMContentLoaded", function () {
    init().catch(function (error) {
      const app = document.getElementById("app");
      app.innerHTML = "<p>" + utils.escapeHtml(error.message || "Unable to prepare PDF export.") + "</p>";
    });
  });
})(typeof globalThis !== "undefined" ? globalThis : this);

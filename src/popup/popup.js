(function (root) {
  const namespace = root.ChatExporter;
  const constants = namespace.constants;
  const utils = namespace.utils;
  const exporters = namespace.exporters;

  const elements = {};
  let activeTabId = null;
  let currentStatus = null;

  function setResult(message, isError) {
    elements.resultMessage.textContent = message || "";
    elements.resultMessage.style.color = isError ? "#b91c1c" : "#0f766e";
  }

  function getSelectedFormats() {
    return Array.from(document.querySelectorAll("input[name='format']:checked")).map(function (input) {
      return input.value;
    });
  }

  function readSettingsFromForm() {
    return {
      formats: getSelectedFormats(),
      includeMetadata: elements.includeMetadata.checked,
      includeAssets: elements.includeAssets.checked
    };
  }

  function applySettings(settings) {
    const selected = new Set(settings.formats || constants.defaultSettings.formats);
    document.querySelectorAll("input[name='format']").forEach(function (input) {
      input.checked = selected.has(input.value);
    });
    elements.includeMetadata.checked = settings.includeMetadata !== false;
    elements.includeAssets.checked = settings.includeAssets !== false;
  }

  function renderFormatOptions() {
    elements.formatList.innerHTML = "";
    constants.formats.forEach(function (format) {
      const wrapper = document.createElement("label");
      wrapper.className = "format-option";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "format";
      input.value = format.value;

      const text = document.createElement("span");
      text.textContent = format.label;

      wrapper.appendChild(input);
      wrapper.appendChild(text);
      elements.formatList.appendChild(wrapper);
    });
  }

  async function loadSettings() {
    const stored = await chrome.storage.local.get(constants.storageKeys.settings);
    const settings = stored[constants.storageKeys.settings] || constants.defaultSettings;
    applySettings(settings);
  }

  async function saveSettings(settings) {
    await chrome.storage.local.set({
      [constants.storageKeys.settings]: settings
    });
  }

  async function resolveTabId() {
    const explicit = utils.readQueryParam("tabId", root.location.search);
    if (explicit) {
      return Number(explicit);
    }

    const tabs = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true
    });

    return tabs[0] && tabs[0].id ? tabs[0].id : null;
  }

  async function requestProviderStatus() {
    if (!activeTabId) {
      throw new Error("No active tab found.");
    }

    const response = await chrome.tabs.sendMessage(activeTabId, {
      type: constants.messageTypes.getProviderStatus
    });

    if (!response || !response.ok) {
      throw new Error((response && response.error) || "Unable to inspect the page.");
    }

    currentStatus = response.status;
    elements.providerStatus.textContent = currentStatus.supported
      ? (currentStatus.ready ? currentStatus.providerName + " conversation detected." : currentStatus.reason)
      : currentStatus.reason;
    elements.exportButton.disabled = !currentStatus.supported || !currentStatus.ready;
  }

  function downloadBlob(content, mimeType, filename) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    return chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false
    }).finally(function () {
      root.setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 2000);
    });
  }

  async function queuePdf(chat, options) {
    const jobKey = constants.storageKeys.pdfJobPrefix + utils.uniqueId("");
    await chrome.storage.session.set({
      [jobKey]: {
        chat: chat,
        options: options
      }
    });

    const url = chrome.runtime.getURL("src/export/export-page.html") + "?job=" + encodeURIComponent(jobKey) + "&print=1";
    await chrome.tabs.create({ url: url });
  }

  async function exportCurrentChat() {
    const settings = readSettingsFromForm();
    if (!settings.formats.length) {
      throw new Error("Select at least one export format.");
    }

    await saveSettings(settings);

    const extraction = await chrome.tabs.sendMessage(activeTabId, {
      type: constants.messageTypes.extractChat,
      options: settings
    });

    if (!extraction || !extraction.ok) {
      throw new Error((extraction && extraction.error) || "Unable to extract the current conversation.");
    }

    const chat = extraction.chat;

    for (const format of settings.formats) {
      if (format === "pdf") {
        await queuePdf(chat, settings);
        continue;
      }

      const artifact = exporters.exportChat(chat, format, settings);
      await downloadBlob(artifact.content, artifact.mimeType, utils.makeFilename(chat, format));
    }
  }

  async function init() {
    elements.providerStatus = document.getElementById("provider-status");
    elements.formatList = document.getElementById("format-list");
    elements.includeMetadata = document.getElementById("include-metadata");
    elements.includeAssets = document.getElementById("include-assets");
    elements.exportButton = document.getElementById("export-button");
    elements.resultMessage = document.getElementById("result-message");

    renderFormatOptions();
    await loadSettings();

    activeTabId = await resolveTabId();
    await requestProviderStatus();

    elements.exportButton.addEventListener("click", async function () {
      elements.exportButton.disabled = true;
      setResult("Preparing export...", false);

      try {
        await exportCurrentChat();
        setResult("Export started. Check your downloads and print dialog.", false);
      } catch (error) {
        setResult(error.message || "Export failed.", true);
      } finally {
        elements.exportButton.disabled = !(currentStatus && currentStatus.ready);
      }
    });
  }

  root.addEventListener("DOMContentLoaded", function () {
    init().catch(function (error) {
      elements.providerStatus = document.getElementById("provider-status");
      elements.exportButton = document.getElementById("export-button");
      elements.resultMessage = document.getElementById("result-message");

      if (elements.providerStatus) {
        elements.providerStatus.textContent = error.message || "Unable to initialize.";
      }

      if (elements.exportButton) {
        elements.exportButton.disabled = true;
      }

      setResult("Open ChatGPT, Gemini, or Claude in the active tab and try again.", true);
    });
  });
})(typeof globalThis !== "undefined" ? globalThis : this);

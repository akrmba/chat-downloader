(function (root) {
  const namespace = root.ChatExporter = root.ChatExporter || {};

  const constants = {
    extensionName: "Chat Downloader",
    storageKeys: {
      settings: "chat-downloader-settings",
      pdfJobPrefix: "chat-downloader-pdf-job:"
    },
    messageTypes: {
      getProviderStatus: "CHAT_DOWNLOADER_GET_PROVIDER_STATUS",
      extractChat: "CHAT_DOWNLOADER_EXTRACT_CHAT",
      openExportWindow: "CHAT_DOWNLOADER_OPEN_EXPORT_WINDOW"
    },
    defaultSettings: {
      formats: ["md"],
      includeMetadata: true,
      includeAssets: true
    },
    formats: [
      { value: "md", label: "Markdown" },
      { value: "txt", label: "Text" },
      { value: "json", label: "JSON" },
      { value: "pdf", label: "PDF" }
    ]
  };

  namespace.constants = constants;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = constants;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

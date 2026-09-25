(function (root) {
  const namespace = root.ChatExporter = root.ChatExporter || {};

  function cleanText(value) {
    return String(value || "")
      .replace(/\r/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  function compactWhitespace(value) {
    return cleanText(value).replace(/\s+/g, " ").trim();
  }

  function sanitizeFilenamePart(value) {
    const cleaned = String(value || "")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return cleaned || "chat-export";
  }

  function titleFromDocumentTitle(title, providerName) {
    const safeTitle = String(title || "").trim();
    if (!safeTitle) {
      return providerName ? providerName + " chat" : "Chat export";
    }

    const providerPattern = providerName ? new RegExp("\\s*[|\\-–:]\\s*" + providerName + "\\s*$", "i") : null;
    const stripped = providerPattern ? safeTitle.replace(providerPattern, "") : safeTitle;
    return stripped.trim() || safeTitle;
  }

  function formatTimestamp(dateLike) {
    const date = dateLike ? new Date(dateLike) : new Date();
    return date.toISOString().replace(/[:.]/g, "-");
  }

  function formatDisplayDate(dateLike) {
    const date = dateLike ? new Date(dateLike) : new Date();
    return date.toLocaleString();
  }

  function makeFilename(chat, format) {
    const title = sanitizeFilenamePart(chat && chat.title ? chat.title : "chat-export");
    const provider = sanitizeFilenamePart(chat && chat.provider ? chat.provider : "chat");
    const stamp = formatTimestamp(chat && chat.exportedAt ? chat.exportedAt : new Date());
    return provider + "-" + title + "-" + stamp + "." + format;
  }

  function uniqueId(prefix) {
    const base = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()) + "-" + Math.random().toString(36).slice(2, 10);
    return prefix ? prefix + base : base;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readQueryParam(name, search) {
    const params = new URLSearchParams(search || "");
    return params.get(name);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const api = {
    cleanText,
    compactWhitespace,
    sanitizeFilenamePart,
    titleFromDocumentTitle,
    formatTimestamp,
    formatDisplayDate,
    makeFilename,
    uniqueId,
    clone,
    readQueryParam,
    escapeHtml
  };

  namespace.utils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

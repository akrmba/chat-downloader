(function (root) {
  const namespace = root.ChatExporter = root.ChatExporter || {};
  const utils = namespace.utils || (typeof require === "function" ? require("./utils.js") : null);

  function isAssetBlock(block) {
    return block && (block.type === "image" || block.type === "file");
  }

  function collectAssets(messages) {
    const assets = [];
    messages.forEach(function (message) {
      (message.blocks || []).forEach(function (block) {
        if (isAssetBlock(block)) {
          assets.push({
            messageId: message.id,
            type: block.type,
            label: block.alt || block.label || "",
            url: block.url || "",
            accessible: Boolean(block.accessible)
          });
        }
      });
    });
    return assets;
  }

  function normalizeMessage(message, index) {
    const role = message.role || "assistant";
    return {
      id: message.id || "message-" + (index + 1),
      role: role,
      authorLabel: message.authorLabel || (role === "user" ? "You" : "Assistant"),
      timestamp: message.timestamp || null,
      blocks: Array.isArray(message.blocks) ? message.blocks.filter(Boolean) : []
    };
  }

  function normalizeChat(chat) {
    const normalizedMessages = Array.isArray(chat && chat.messages)
      ? chat.messages.map(normalizeMessage)
      : [];

    return {
      providerId: chat && chat.providerId ? chat.providerId : "unknown",
      provider: chat && chat.provider ? chat.provider : "Unknown",
      title: chat && chat.title ? chat.title : "Untitled chat",
      sourceUrl: chat && chat.sourceUrl ? chat.sourceUrl : "",
      conversationId: chat && chat.conversationId ? chat.conversationId : null,
      exportedAt: chat && chat.exportedAt ? chat.exportedAt : new Date().toISOString(),
      messages: normalizedMessages,
      assets: collectAssets(normalizedMessages)
    };
  }

  function filterChatForExport(chat, options) {
    const normalized = normalizeChat(chat);
    const nextChat = utils.clone(normalized);
    const includeAssets = options && options.includeAssets !== false;
    const includeMetadata = !options || options.includeMetadata !== false;

    if (!includeAssets) {
      nextChat.messages.forEach(function (message) {
        message.blocks = (message.blocks || []).filter(function (block) {
          return !isAssetBlock(block);
        });
      });
      nextChat.assets = [];
    }

    if (!includeMetadata) {
      nextChat.sourceUrl = "";
      nextChat.exportedAt = "";
      nextChat.conversationId = null;
      nextChat.messages.forEach(function (message) {
        message.timestamp = null;
      });
    }

    return nextChat;
  }

  const api = {
    normalizeChat,
    filterChatForExport,
    collectAssets
  };

  namespace.model = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

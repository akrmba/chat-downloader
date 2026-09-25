(function (root) {
  const namespace = root.ChatExporter = root.ChatExporter || {};
  namespace.providers = namespace.providers || {};

  const utils = namespace.utils || (typeof require === "function" ? require("../common/utils.js") : null);
  const dom = namespace.dom || (typeof require === "function" ? require("../common/dom.js") : null);

  function isSupportedLocation(location) {
    const host = location && location.hostname ? location.hostname : "";
    return host === "chatgpt.com" || host === "chat.openai.com";
  }

  function isReady(doc) {
    return Boolean(doc.querySelector("[data-message-author-role], main article"));
  }

  function findMessageNodes(doc) {
    const direct = Array.from(doc.querySelectorAll("[data-message-author-role]"));
    if (direct.length) {
      return direct;
    }

    return Array.from(doc.querySelectorAll("main article")).filter(function (node) {
      return utils.cleanText(node.textContent).length > 0;
    });
  }

  function detectRole(node) {
    const role = node.getAttribute("data-message-author-role");
    if (role) {
      return role === "assistant" ? "assistant" : "user";
    }

    const text = (node.getAttribute("aria-label") || node.textContent || "").toLowerCase();
    if (text.includes("you said") || text.includes("you")) {
      return "user";
    }
    return "assistant";
  }

  function getMessageContentRoot(node) {
    return dom.queryOne(node, [
      "[data-testid='conversation-turn-content']",
      ".markdown",
      ".prose",
      ".whitespace-pre-wrap"
    ]) || node;
  }

  function extractChat(doc) {
    const messageNodes = findMessageNodes(doc);
    if (!messageNodes.length) {
      throw new Error("No ChatGPT messages found on the page.");
    }

    const messages = messageNodes.map(function (node, index) {
      const role = detectRole(node);
      return {
        id: "chatgpt-" + (index + 1),
        role: role,
        authorLabel: role === "user" ? "You" : "ChatGPT",
        timestamp: dom.findNearestTimeText(node),
        blocks: dom.extractBlocksFromContainer(getMessageContentRoot(node))
      };
    }).filter(function (message) {
      return message.blocks.length > 0;
    });

    return {
      providerId: "chatgpt",
      provider: "ChatGPT",
      title: utils.titleFromDocumentTitle(doc.title, "ChatGPT"),
      sourceUrl: doc.location.href,
      conversationId: doc.location.pathname.split("/").filter(Boolean).slice(-1)[0] || null,
      exportedAt: new Date().toISOString(),
      messages: messages
    };
  }

  const api = {
    id: "chatgpt",
    name: "ChatGPT",
    isSupportedLocation,
    isReady,
    extractChat
  };

  namespace.providers.chatgpt = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

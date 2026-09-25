(function (root) {
  const namespace = root.ChatExporter = root.ChatExporter || {};
  namespace.providers = namespace.providers || {};

  const utils = namespace.utils || (typeof require === "function" ? require("../common/utils.js") : null);
  const dom = namespace.dom || (typeof require === "function" ? require("../common/dom.js") : null);

  function isSupportedLocation(location) {
    return location && location.hostname === "claude.ai";
  }

  function isReady(doc) {
    return Boolean(doc.querySelector("[data-testid*='message'], [data-message-author-role], main article"));
  }

  function findMessageNodes(doc) {
    const direct = Array.from(doc.querySelectorAll([
      "[data-testid='user-message']",
      "[data-testid='assistant-message']",
      "[data-message-author-role]"
    ].join(",")));
    const fallback = Array.from(doc.querySelectorAll([
      "[data-testid*='conversation-turn']",
      "main article"
    ].join(","))).filter(function (node) {
      return utils.cleanText(node.textContent).length > 0;
    });

    return dom.mergeMessageNodes(direct, fallback);
  }

  function detectRole(node) {
    const explicitRole = node.getAttribute("data-message-author-role");
    if (explicitRole) {
      return explicitRole === "assistant" ? "assistant" : "user";
    }

    const testId = (node.getAttribute("data-testid") || "").toLowerCase();
    if (testId.includes("user")) {
      return "user";
    }
    if (testId.includes("assistant")) {
      return "assistant";
    }

    const label = (node.getAttribute("aria-label") || node.textContent || "").toLowerCase();
    return label.includes("you") ? "user" : "assistant";
  }

  function getMessageContentRoot(node) {
    return dom.queryOne(node, [
      "[data-testid='message-content']",
      ".prose",
      ".font-claude-message",
      ".whitespace-pre-wrap"
    ]) || node;
  }

  function extractChat(doc) {
    const messageNodes = findMessageNodes(doc);
    if (!messageNodes.length) {
      throw new Error("No Claude messages found on the page.");
    }

    const messages = messageNodes.map(function (node, index) {
      const role = detectRole(node);
      return {
        id: "claude-" + (index + 1),
        role: role,
        authorLabel: role === "user" ? "You" : "Claude",
        timestamp: dom.findNearestTimeText(node),
        blocks: dom.extractBlocksFromContainer(getMessageContentRoot(node))
      };
    }).filter(function (message) {
      return message.blocks.length > 0;
    });

    return {
      providerId: "claude",
      provider: "Claude",
      title: utils.titleFromDocumentTitle(doc.title, "Claude"),
      sourceUrl: doc.location.href,
      conversationId: doc.location.pathname.split("/").filter(Boolean).slice(-1)[0] || null,
      exportedAt: new Date().toISOString(),
      messages: messages
    };
  }

  const api = {
    id: "claude",
    name: "Claude",
    isSupportedLocation,
    isReady,
    getMessageNodes: findMessageNodes,
    extractChat
  };

  namespace.providers.claude = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

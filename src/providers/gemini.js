(function (root) {
  const namespace = root.ChatExporter = root.ChatExporter || {};
  namespace.providers = namespace.providers || {};

  const utils = namespace.utils || (typeof require === "function" ? require("../common/utils.js") : null);
  const dom = namespace.dom || (typeof require === "function" ? require("../common/dom.js") : null);

  function isSupportedLocation(location) {
    return location && location.hostname === "gemini.google.com";
  }

  function isReady(doc) {
    return Boolean(doc.querySelector("chat-turn, user-query, model-response, main"));
  }

  function findTurnNodes(doc) {
    const turns = Array.from(doc.querySelectorAll("chat-turn"));
    if (turns.length) {
      return turns;
    }

    return Array.from(doc.querySelectorAll("user-query, model-response"));
  }

  function buildMessagesFromTurn(turnNode, indexOffset) {
    const turnMessages = [];
    const userNode = turnNode.matches && turnNode.matches("user-query") ? turnNode : turnNode.querySelector("user-query");
    const modelNode = turnNode.matches && turnNode.matches("model-response") ? turnNode : turnNode.querySelector("model-response");

    if (userNode) {
      turnMessages.push({
        id: "gemini-" + (indexOffset + turnMessages.length + 1),
        role: "user",
        authorLabel: "You",
        timestamp: dom.findNearestTimeText(userNode),
        blocks: dom.extractBlocksFromContainer(dom.queryOne(userNode, [
          ".query-text",
          ".text-content",
          "message-content"
        ]) || userNode)
      });
    }

    if (modelNode) {
      turnMessages.push({
        id: "gemini-" + (indexOffset + turnMessages.length + 1),
        role: "assistant",
        authorLabel: "Gemini",
        timestamp: dom.findNearestTimeText(modelNode),
        blocks: dom.extractBlocksFromContainer(dom.queryOne(modelNode, [
          "message-content",
          ".model-response-text",
          ".response-content",
          ".markdown"
        ]) || modelNode)
      });
    }

    return turnMessages;
  }

  function extractChat(doc) {
    const turnNodes = findTurnNodes(doc);
    if (!turnNodes.length) {
      throw new Error("No Gemini conversation nodes found on the page.");
    }

    const messages = [];
    turnNodes.forEach(function (turnNode) {
      buildMessagesFromTurn(turnNode, messages.length).forEach(function (message) {
        if (message.blocks.length) {
          messages.push(message);
        }
      });
    });

    return {
      providerId: "gemini",
      provider: "Gemini",
      title: utils.titleFromDocumentTitle(doc.title, "Gemini"),
      sourceUrl: doc.location.href,
      conversationId: doc.location.pathname.split("/").filter(Boolean).slice(-1)[0] || null,
      exportedAt: new Date().toISOString(),
      messages: messages
    };
  }

  const api = {
    id: "gemini",
    name: "Gemini",
    isSupportedLocation,
    isReady,
    extractChat
  };

  namespace.providers.gemini = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

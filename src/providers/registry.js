(function (root) {
  const namespace = root.ChatExporter = root.ChatExporter || {};
  namespace.providers = namespace.providers || {};
  const model = namespace.model || (typeof require === "function" ? require("../common/model.js") : null);

  function allProviders() {
    return [
      namespace.providers.chatgpt,
      namespace.providers.gemini,
      namespace.providers.claude
    ].filter(Boolean);
  }

  function getProviderForLocation(location) {
    return allProviders().find(function (provider) {
      return provider.isSupportedLocation(location);
    }) || null;
  }

  function getProviderStatus(doc) {
    const provider = getProviderForLocation(doc.location);
    if (!provider) {
      return {
        supported: false,
        ready: false,
        providerId: null,
        providerName: null,
        reason: "This page is not supported."
      };
    }

    const ready = provider.isReady(doc);
    return {
      supported: true,
      ready: ready,
      providerId: provider.id,
      providerName: provider.name,
      reason: ready ? "" : "Open a conversation before exporting."
    };
  }

  function extractCurrentChat(doc, options) {
    const provider = getProviderForLocation(doc.location);
    if (!provider) {
      throw new Error("This page is not supported.");
    }

    if (!provider.isReady(doc)) {
      throw new Error("Open a conversation before exporting.");
    }

    return model.normalizeChat(provider.extractChat(doc, options));
  }

  const api = {
    allProviders,
    getProviderForLocation,
    getProviderStatus,
    extractCurrentChat
  };

  namespace.registry = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

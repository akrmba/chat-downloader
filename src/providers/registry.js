(function (root) {
  const namespace = root.ChatExporter = root.ChatExporter || {};
  namespace.providers = namespace.providers || {};
  const model = namespace.model || (typeof require === "function" ? require("../common/model.js") : null);
  const captureLimits = {
    maxSteps: 120,
    maxDurationMs: 25000,
    initialSettleDelayMs: 900,
    settleDelayMs: 550,
    viewportFraction: 0.65
  };

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

  function findConversationScroller(doc, provider) {
    const messageNodes = provider.getMessageNodes(doc);
    const candidates = new Set();
    const pageScroller = doc.scrollingElement || doc.documentElement;

    if (pageScroller) {
      candidates.add(pageScroller);
    }

    messageNodes.forEach(function (messageNode) {
      let ancestor = messageNode;
      while (ancestor && ancestor !== doc.body) {
        candidates.add(ancestor);
        ancestor = ancestor.parentElement;
      }
    });

    const scrollable = Array.from(candidates).filter(function (element) {
      return element && element.clientHeight > 0 && element.scrollHeight > element.clientHeight + 80;
    });

    if (!scrollable.length) {
      return pageScroller;
    }

    return scrollable.sort(function (left, right) {
      const leftMessageCount = messageNodes.filter(function (node) { return left.contains(node); }).length;
      const rightMessageCount = messageNodes.filter(function (node) { return right.contains(node); }).length;
      if (leftMessageCount !== rightMessageCount) {
        return rightMessageCount - leftMessageCount;
      }
      return right.scrollHeight - left.scrollHeight;
    })[0];
  }

  function isPageScroller(doc, element) {
    return element === doc.scrollingElement || element === doc.documentElement || element === doc.body;
  }

  function getScrollTop(doc, element) {
    return isPageScroller(doc, element) ? (doc.defaultView.scrollY || element.scrollTop || 0) : element.scrollTop;
  }

  function setScrollTop(doc, element, value) {
    if (isPageScroller(doc, element)) {
      doc.defaultView.scrollTo(0, value);
      return;
    }
    element.scrollTop = value;
  }

  function messageSignature(message) {
    return JSON.stringify({
      role: message.role,
      authorLabel: message.authorLabel,
      timestamp: message.timestamp,
      blocks: message.blocks
    });
  }

  function mergeMessageSnapshot(collected, incoming) {
    if (!collected.length) {
      return incoming.slice();
    }

    const collectedKeys = collected.map(messageSignature);
    const incomingKeys = incoming.map(messageSignature);
    const maxOverlap = Math.min(collectedKeys.length, incomingKeys.length);

    for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
      const collectedSuffix = collectedKeys.slice(-overlap);
      const incomingPrefix = incomingKeys.slice(0, overlap);
      if (collectedSuffix.every(function (key, index) { return key === incomingPrefix[index]; })) {
        return collected.concat(incoming.slice(overlap));
      }
    }

    let sharedPrefix = 0;
    while (sharedPrefix < maxOverlap && collectedKeys[sharedPrefix] === incomingKeys[sharedPrefix]) {
      sharedPrefix += 1;
    }
    if (sharedPrefix === collectedKeys.length) {
      return collected.concat(incoming.slice(sharedPrefix));
    }

    for (let start = 0; start <= collectedKeys.length - incomingKeys.length; start += 1) {
      if (incomingKeys.every(function (key, index) { return key === collectedKeys[start + index]; })) {
        return collected;
      }
    }

    const knownCounts = new Map();
    collectedKeys.forEach(function (key) {
      knownCounts.set(key, (knownCounts.get(key) || 0) + 1);
    });
    const seenInSnapshot = new Map();
    const merged = collected.slice();
    incoming.forEach(function (message, index) {
      const key = incomingKeys[index];
      const seenCount = (seenInSnapshot.get(key) || 0) + 1;
      seenInSnapshot.set(key, seenCount);
      if (seenCount > (knownCounts.get(key) || 0)) {
        merged.push(message);
      }
    });
    return merged;
  }

  function delay(milliseconds) {
    return new Promise(function (resolve) {
      root.setTimeout(resolve, milliseconds);
    });
  }

  async function extractCompleteCurrentChat(doc, options) {
    const provider = getProviderForLocation(doc.location);
    if (!provider) {
      throw new Error("This page is not supported.");
    }
    if (!provider.isReady(doc)) {
      throw new Error("Open a conversation before exporting.");
    }

    const scroller = findConversationScroller(doc, provider);
    if (!scroller || scroller.clientHeight <= 0 || scroller.scrollHeight <= scroller.clientHeight + 80) {
      return { chat: model.normalizeChat(provider.extractChat(doc, options)), warning: "" };
    }

    const originalScrollTop = getScrollTop(doc, scroller);
    const collected = [];
    const startedAt = Date.now();
    let snapshot;
    let warning = "";

    try {
      setScrollTop(doc, scroller, 0);
      await delay(captureLimits.initialSettleDelayMs);

      snapshot = provider.extractChat(doc, options);
      collected.push.apply(collected, snapshot.messages);

      for (let step = 0; step < captureLimits.maxSteps; step += 1) {
        if (Date.now() - startedAt >= captureLimits.maxDurationMs) {
          warning = "Capture stopped after 25 seconds. This very long conversation may be incomplete.";
          break;
        }

        const currentTop = getScrollTop(doc, scroller);
        const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        if (currentTop >= maxTop - 8) {
          break;
        }

        const stepSize = Math.max(240, Math.floor(scroller.clientHeight * captureLimits.viewportFraction));
        setScrollTop(doc, scroller, Math.min(maxTop, currentTop + stepSize));
        await delay(captureLimits.settleDelayMs);

        snapshot = provider.extractChat(doc, options);
        const merged = mergeMessageSnapshot(collected, snapshot.messages);
        collected.length = 0;
        merged.forEach(function (message) {
          collected.push(message);
        });
      }

      if (!warning && getScrollTop(doc, scroller) < scroller.scrollHeight - scroller.clientHeight - 8) {
        warning = "Capture reached its safety limit. This conversation may be incomplete.";
      }
    } finally {
      setScrollTop(doc, scroller, originalScrollTop);
    }

    const finalChat = model.normalizeChat(Object.assign({}, snapshot, {
      messages: collected.map(function (message, index) {
        return Object.assign({}, message, { id: provider.id + "-" + (index + 1) });
      })
    }));

    return { chat: finalChat, warning: warning };
  }

  const api = {
    allProviders,
    getProviderForLocation,
    getProviderStatus,
    extractCurrentChat,
    extractCompleteCurrentChat
  };

  namespace.registry = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

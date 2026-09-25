(function (root) {
  const namespace = root.ChatExporter = root.ChatExporter || {};
  const constants = namespace.constants;
  const registry = namespace.registry;

  let button = null;
  let lastUrl = root.location.href;

  function getStatus() {
    return registry.getProviderStatus(document);
  }

  function updateButtonState() {
    const status = getStatus();
    if (!status.supported) {
      if (button) {
        button.remove();
        button = null;
      }
      return;
    }

    if (!button) {
      button = document.createElement("button");
      button.id = "chat-downloader-button";
      button.type = "button";
      button.textContent = "Export chat";
      button.addEventListener("click", function () {
        button.disabled = true;
        chrome.runtime.sendMessage({
          type: constants.messageTypes.openExportWindow
        }, function () {
          button.disabled = false;
        });
      });
      document.documentElement.appendChild(button);
    }

    button.disabled = !status.ready;
    button.title = status.ready ? "Open export options" : status.reason;
  }

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    try {
      if (message.type === constants.messageTypes.getProviderStatus) {
        sendResponse({
          ok: true,
          status: getStatus()
        });
        return;
      }

      if (message.type === constants.messageTypes.extractChat) {
        registry.extractCompleteCurrentChat(document, message.options || {}).then(function (result) {
          sendResponse({
            ok: true,
            chat: result.chat,
            warning: result.warning
          });
        }).catch(function (error) {
          sendResponse({
            ok: false,
            error: error.message || "Unable to export this chat."
          });
        });
        return true;
      }
    } catch (error) {
      sendResponse({
        ok: false,
        error: error.message || "Unable to export this chat."
      });
    }
  });

  function watchRouteChanges() {
    root.setInterval(function () {
      if (root.location.href !== lastUrl) {
        lastUrl = root.location.href;
        updateButtonState();
      }
    }, 1000);

    const observer = new MutationObserver(function () {
      updateButtonState();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  updateButtonState();
  watchRouteChanges();
})(typeof globalThis !== "undefined" ? globalThis : this);

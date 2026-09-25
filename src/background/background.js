chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type !== "CHAT_DOWNLOADER_OPEN_EXPORT_WINDOW") {
    return;
  }

  const tabId = message.tabId || (sender.tab && sender.tab.id);
  const popupUrl = chrome.runtime.getURL("src/popup/popup.html") + "?tabId=" + encodeURIComponent(String(tabId || ""));

  chrome.windows.create({
    url: popupUrl,
    type: "popup",
    width: 420,
    height: 640
  }).then(function () {
    sendResponse({ ok: true });
  }).catch(function (error) {
    sendResponse({
      ok: false,
      error: error.message || "Unable to open export window."
    });
  });

  return true;
});

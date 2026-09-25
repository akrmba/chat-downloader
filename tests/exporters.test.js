const test = require("node:test");
const assert = require("node:assert/strict");

require("../src/common/constants.js");
require("../src/common/utils.js");
require("../src/common/model.js");
const exporters = require("../src/export/exporters.js");

const sampleChat = {
  providerId: "chatgpt",
  provider: "ChatGPT",
  title: "Planning a launch",
  sourceUrl: "https://chatgpt.com/c/example",
  conversationId: "example",
  exportedAt: "2026-04-09T10:00:00.000Z",
  messages: [
    {
      id: "message-1",
      role: "user",
      authorLabel: "You",
      timestamp: "2026-04-09T09:58:00.000Z",
      blocks: [
        { type: "text", text: "Give me a short launch plan.", style: "paragraph" }
      ]
    },
    {
      id: "message-2",
      role: "assistant",
      authorLabel: "ChatGPT",
      timestamp: "2026-04-09T09:59:00.000Z",
      blocks: [
        { type: "text", text: "Here is a simple outline.", style: "paragraph" },
        { type: "list", ordered: true, items: ["Define scope", "Prepare assets", "Review metrics"] },
        { type: "code", language: "js", text: "console.log('launch');" },
        { type: "image", alt: "Launch diagram", url: "https://example.com/launch.png", accessible: true }
      ]
    }
  ]
};

test("renders markdown with headings, lists, code blocks, and images", function () {
  const markdown = exporters.renderMarkdown(sampleChat, {
    includeMetadata: true,
    includeAssets: true
  });

  assert.match(markdown, /^# Planning a launch/m);
  assert.match(markdown, /## ChatGPT/);
  assert.match(markdown, /1\. Define scope/);
  assert.match(markdown, /```js/);
  assert.match(markdown, /!\[Launch diagram\]\(https:\/\/example.com\/launch\.png\)/);
});

test("removes assets when includeAssets is false", function () {
  const text = exporters.renderText(sampleChat, {
    includeMetadata: true,
    includeAssets: false
  });

  assert.doesNotMatch(text, /\[Image\]/);
  assert.match(text, /Planning a launch/);
});

test("renders JSON without metadata when includeMetadata is false", function () {
  const json = exporters.renderJson(sampleChat, {
    includeMetadata: false,
    includeAssets: true
  });

  const parsed = JSON.parse(json);
  assert.equal(parsed.sourceUrl, "");
  assert.equal(parsed.exportedAt, "");
  assert.equal(parsed.messages[0].timestamp, null);
});

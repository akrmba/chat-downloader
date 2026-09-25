(function (root) {
  const namespace = root.ChatExporter = root.ChatExporter || {};
  const utils = namespace.utils || (typeof require === "function" ? require("../common/utils.js") : null);
  const model = namespace.model || (typeof require === "function" ? require("../common/model.js") : null);

  function chatForExport(chat, options) {
    return model.filterChatForExport(chat, options || {});
  }

  function renderHeaderLines(chat, options) {
    const lines = [];
    if (options && options.includeMetadata === false) {
      return lines;
    }

    lines.push("Title: " + chat.title);
    lines.push("Provider: " + chat.provider);
    if (chat.sourceUrl) {
      lines.push("Source: " + chat.sourceUrl);
    }
    if (chat.exportedAt) {
      lines.push("Exported: " + utils.formatDisplayDate(chat.exportedAt));
    }
    if (chat.conversationId) {
      lines.push("Conversation ID: " + chat.conversationId);
    }
    return lines;
  }

  function renderTableText(rows) {
    return rows.map(function (row) {
      return row.join(" | ");
    }).join("\n");
  }

  function blockToText(block) {
    switch (block.type) {
      case "text":
        return block.text;
      case "code":
        return block.language ? "[" + block.language + "]\n" + block.text : block.text;
      case "list":
        return block.items.map(function (item, index) {
          return (block.ordered ? (index + 1) + "." : "-") + " " + item;
        }).join("\n");
      case "quote":
        return block.text.split("\n").map(function (line) {
          return "> " + line;
        }).join("\n");
      case "table":
        return renderTableText(block.rows);
      case "image":
        return "[Image] " + (block.alt || "Image") + (block.url ? " - " + block.url : "");
      case "file":
        return "[File] " + (block.label || "File") + (block.url ? " - " + block.url : "");
      default:
        return "";
    }
  }

  function renderText(chat, options) {
    const prepared = chatForExport(chat, options);
    const parts = [];

    if (options.includeMetadata !== false) {
      parts.push(renderHeaderLines(prepared, options).join("\n"));
    }

    prepared.messages.forEach(function (message) {
      const section = [];
      section.push(message.authorLabel || (message.role === "user" ? "You" : "Assistant"));
      if (message.timestamp) {
        section.push(message.timestamp);
      }
      section.push("");
      section.push((message.blocks || []).map(blockToText).filter(Boolean).join("\n\n"));
      parts.push(section.join("\n"));
    });

    return parts.filter(Boolean).join("\n\n---\n\n").trim() + "\n";
  }

  function blockToMarkdown(block) {
    switch (block.type) {
      case "text":
        if (block.style === "heading" && block.level) {
          return "#".repeat(Math.max(1, Math.min(6, block.level))) + " " + block.text;
        }
        if (block.style === "caption") {
          return "_" + block.text + "_";
        }
        return block.text;
      case "code":
        return "```" + (block.language || "") + "\n" + block.text + "\n```";
      case "list":
        return block.items.map(function (item, index) {
          return (block.ordered ? (index + 1) + "." : "-") + " " + item;
        }).join("\n");
      case "quote":
        return block.text.split("\n").map(function (line) {
          return "> " + line;
        }).join("\n");
      case "table":
        if (!block.rows.length) {
          return "";
        }
        const header = block.rows[0];
        const divider = header.map(function () {
          return "---";
        });
        const rows = [header, divider].concat(block.rows.slice(1));
        return rows.map(function (row) {
          return "| " + row.join(" | ") + " |";
        }).join("\n");
      case "image":
        return "![" + (block.alt || "Image") + "](" + (block.url || "") + ")";
      case "file":
        return "[" + (block.label || "File") + "](" + (block.url || "") + ")";
      default:
        return "";
    }
  }

  function renderMarkdown(chat, options) {
    const prepared = chatForExport(chat, options);
    const parts = ["# " + prepared.title];

    if (options.includeMetadata !== false) {
      renderHeaderLines(prepared, options).forEach(function (line) {
        parts.push("- " + line);
      });
      parts.push("");
    }

    prepared.messages.forEach(function (message) {
      parts.push("## " + (message.authorLabel || (message.role === "user" ? "You" : "Assistant")));
      if (message.timestamp) {
        parts.push("_" + message.timestamp + "_");
      }
      parts.push((message.blocks || []).map(blockToMarkdown).filter(Boolean).join("\n\n"));
      parts.push("");
    });

    return parts.join("\n").trim() + "\n";
  }

  function renderJson(chat, options) {
    const prepared = chatForExport(chat, options);
    return JSON.stringify(prepared, null, 2) + "\n";
  }

  function blockToHtml(block) {
    switch (block.type) {
      case "text":
        if (block.style === "heading" && block.level) {
          return "<h" + block.level + ">" + utils.escapeHtml(block.text) + "</h" + block.level + ">";
        }
        if (block.style === "caption") {
          return "<p class=\"caption\">" + utils.escapeHtml(block.text) + "</p>";
        }
        return "<p>" + utils.escapeHtml(block.text).replace(/\n/g, "<br>") + "</p>";
      case "code":
        return "<pre><code>" + utils.escapeHtml(block.text) + "</code></pre>";
      case "list":
        return "<" + (block.ordered ? "ol" : "ul") + ">" + block.items.map(function (item) {
          return "<li>" + utils.escapeHtml(item) + "</li>";
        }).join("") + "</" + (block.ordered ? "ol" : "ul") + ">";
      case "quote":
        return "<blockquote>" + utils.escapeHtml(block.text).replace(/\n/g, "<br>") + "</blockquote>";
      case "table":
        return "<table><tbody>" + block.rows.map(function (row) {
          return "<tr>" + row.map(function (cell) {
            return "<td>" + utils.escapeHtml(cell) + "</td>";
          }).join("") + "</tr>";
        }).join("") + "</tbody></table>";
      case "image":
        return "<figure>" +
          (block.url ? "<img src=\"" + utils.escapeHtml(block.url) + "\" alt=\"" + utils.escapeHtml(block.alt || "Image") + "\">" : "") +
          "<figcaption>" + utils.escapeHtml(block.alt || "Image") + (block.url ? " (" + utils.escapeHtml(block.url) + ")" : "") + "</figcaption>" +
          "</figure>";
      case "file":
        return "<p><strong>File:</strong> " +
          (block.url ? "<a href=\"" + utils.escapeHtml(block.url) + "\">" + utils.escapeHtml(block.label || "File") + "</a>" : utils.escapeHtml(block.label || "File")) +
          "</p>";
      default:
        return "";
    }
  }

  function renderHtml(chat, options) {
    const prepared = chatForExport(chat, options);
    const meta = options.includeMetadata !== false
      ? "<section class=\"meta\">" + renderHeaderLines(prepared, options).map(function (line) {
          return "<p>" + utils.escapeHtml(line) + "</p>";
        }).join("") + "</section>"
      : "";

    const messages = prepared.messages.map(function (message) {
      return "<article class=\"message\">" +
        "<header class=\"message-header\">" +
          "<h2>" + utils.escapeHtml(message.authorLabel || message.role) + "</h2>" +
          (message.timestamp ? "<time>" + utils.escapeHtml(message.timestamp) + "</time>" : "") +
        "</header>" +
        "<section class=\"message-body\">" + (message.blocks || []).map(blockToHtml).join("") + "</section>" +
      "</article>";
    }).join("");

    return "<div class=\"export-document\">" +
      "<header class=\"document-header\">" +
        "<h1>" + utils.escapeHtml(prepared.title) + "</h1>" +
        "<p>" + utils.escapeHtml(prepared.provider) + "</p>" +
      "</header>" +
      meta +
      "<main class=\"messages\">" + messages + "</main>" +
    "</div>";
  }

  function exportChat(chat, format, options) {
    switch (format) {
      case "txt":
        return { format: "txt", mimeType: "text/plain;charset=utf-8", content: renderText(chat, options) };
      case "md":
        return { format: "md", mimeType: "text/markdown;charset=utf-8", content: renderMarkdown(chat, options) };
      case "json":
        return { format: "json", mimeType: "application/json;charset=utf-8", content: renderJson(chat, options) };
      case "pdf":
        return { format: "pdf", mimeType: "text/html;charset=utf-8", content: renderHtml(chat, options) };
      default:
        throw new Error("Unsupported export format: " + format);
    }
  }

  const api = {
    exportChat,
    renderText,
    renderMarkdown,
    renderJson,
    renderHtml
  };

  namespace.exporters = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

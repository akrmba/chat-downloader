(function (root) {
  const namespace = root.ChatExporter = root.ChatExporter || {};
  const utils = namespace.utils || (typeof require === "function" ? require("./utils.js") : null);

  function isElementNode(node) {
    return node && node.nodeType === 1;
  }

  function isTextNode(node) {
    return node && node.nodeType === 3;
  }

  function isVisibleElement(element) {
    if (!isElementNode(element)) {
      return false;
    }

    if (element.hidden || element.getAttribute("aria-hidden") === "true") {
      return false;
    }

    const style = element.getAttribute("style") || "";
    return !/display\s*:\s*none|visibility\s*:\s*hidden/i.test(style);
  }

  function readInlineText(node) {
    if (!node) {
      return "";
    }

    if (isTextNode(node)) {
      return node.textContent || "";
    }

    if (!isElementNode(node) || !isVisibleElement(node)) {
      return "";
    }

    const tag = node.tagName.toLowerCase();
    if (tag === "br") {
      return "\n";
    }

    if (tag === "img") {
      return node.getAttribute("alt") || "";
    }

    let buffer = "";
    node.childNodes.forEach(function (child) {
      buffer += readInlineText(child);
    });

    if (tag === "a") {
      const href = node.getAttribute("href");
      const text = utils.cleanText(buffer);
      if (href && text && href !== text) {
        return text + " (" + href + ")";
      }
    }

    if (/^(p|div|section|article|li|h1|h2|h3|h4|h5|h6)$/.test(tag)) {
      buffer += "\n";
    }

    return buffer;
  }

  function detectLanguage(element) {
    const className = element.className || "";
    const match = className.match(/(?:language|lang)-([a-z0-9_+-]+)/i);
    return match ? match[1].toLowerCase() : "";
  }

  function extractTableRows(table) {
    return Array.from(table.querySelectorAll("tr"))
      .map(function (row) {
        return Array.from(row.querySelectorAll("th, td"))
          .map(function (cell) {
            return utils.cleanText(readInlineText(cell));
          })
          .filter(Boolean);
      })
      .filter(function (row) {
        return row.length > 0;
      });
  }

  function extractImageBlock(image) {
    const url = image.currentSrc || image.getAttribute("src") || image.getAttribute("data-src") || "";
    return {
      type: "image",
      alt: utils.cleanText(image.getAttribute("alt") || "Image"),
      url: url,
      accessible: Boolean(url)
    };
  }

  function looksLikeFileLink(link) {
    const href = link.getAttribute("href") || "";
    const text = utils.compactWhitespace(link.textContent || "");
    return Boolean(
      link.hasAttribute("download") ||
      /\.[a-z0-9]{2,6}(?:$|\?)/i.test(href) ||
      /attachment|download|file/i.test(link.className || "") ||
      /\.[a-z0-9]{2,6}$/i.test(text)
    );
  }

  function extractFileBlock(link) {
    const url = link.getAttribute("href") || "";
    return {
      type: "file",
      label: utils.compactWhitespace(link.textContent || link.getAttribute("download") || "File"),
      url: url,
      accessible: Boolean(url)
    };
  }

  function hasSpecialDescendant(element) {
    return Boolean(element.querySelector("pre, code, ul, ol, blockquote, table, img, figure, a[download]"));
  }

  function pushTextBlock(blocks, text, style, level) {
    const cleaned = utils.cleanText(text);
    if (!cleaned) {
      return;
    }

    const last = blocks[blocks.length - 1];
    if (last && last.type === "text" && last.style === (style || "paragraph")) {
      last.text = utils.cleanText(last.text + "\n" + cleaned);
      return;
    }

    blocks.push({
      type: "text",
      text: cleaned,
      style: style || "paragraph",
      level: level || null
    });
  }

  function consumeNode(node, blocks) {
    if (isTextNode(node)) {
      pushTextBlock(blocks, node.textContent || "");
      return;
    }

    if (!isElementNode(node) || !isVisibleElement(node)) {
      return;
    }

    const tag = node.tagName.toLowerCase();

    if (tag === "pre") {
      const codeNode = node.querySelector("code");
      const text = utils.cleanText(codeNode ? codeNode.textContent : node.textContent);
      if (text) {
        blocks.push({
          type: "code",
          text: text,
          language: detectLanguage(codeNode || node)
        });
      }
      return;
    }

    if (tag === "ul" || tag === "ol") {
      const items = Array.from(node.children)
        .filter(function (child) {
          return child.tagName && child.tagName.toLowerCase() === "li";
        })
        .map(function (item) {
          return utils.cleanText(readInlineText(item));
        })
        .filter(Boolean);

      if (items.length) {
        blocks.push({
          type: "list",
          ordered: tag === "ol",
          items: items
        });
      }
      return;
    }

    if (tag === "blockquote") {
      const text = utils.cleanText(readInlineText(node));
      if (text) {
        blocks.push({
          type: "quote",
          text: text
        });
      }
      return;
    }

    if (tag === "table") {
      const rows = extractTableRows(node);
      if (rows.length) {
        blocks.push({
          type: "table",
          rows: rows
        });
      }
      return;
    }

    if (tag === "img") {
      blocks.push(extractImageBlock(node));
      return;
    }

    if (tag === "figure") {
      Array.from(node.querySelectorAll("img")).forEach(function (image) {
        blocks.push(extractImageBlock(image));
      });
      const caption = node.querySelector("figcaption");
      if (caption) {
        pushTextBlock(blocks, readInlineText(caption), "caption");
      }
      return;
    }

    if (tag === "a" && looksLikeFileLink(node)) {
      blocks.push(extractFileBlock(node));
      return;
    }

    if (/^h[1-6]$/.test(tag)) {
      pushTextBlock(blocks, readInlineText(node), "heading", Number(tag.slice(1)));
      return;
    }

    if (tag === "p") {
      pushTextBlock(blocks, readInlineText(node));
      return;
    }

    if (!hasSpecialDescendant(node)) {
      const text = readInlineText(node);
      if (utils.cleanText(text)) {
        pushTextBlock(blocks, text);
        return;
      }
    }

    Array.from(node.childNodes).forEach(function (child) {
      consumeNode(child, blocks);
    });
  }

  function extractBlocksFromContainer(container) {
    const blocks = [];
    if (!container) {
      return blocks;
    }

    Array.from(container.childNodes).forEach(function (node) {
      consumeNode(node, blocks);
    });

    if (!blocks.length) {
      const fallbackText = utils.cleanText(readInlineText(container));
      if (fallbackText) {
        pushTextBlock(blocks, fallbackText);
      }
    }

    return blocks;
  }

  function queryOne(rootNode, selectors) {
    for (let index = 0; index < selectors.length; index += 1) {
      const match = rootNode.querySelector(selectors[index]);
      if (match) {
        return match;
      }
    }
    return null;
  }

  function mergeMessageNodes(primaryNodes, fallbackNodes) {
    const merged = primaryNodes.slice();
    fallbackNodes.forEach(function (candidate) {
      const overlapsExisting = merged.some(function (existing) {
        return existing === candidate || existing.contains(candidate) || candidate.contains(existing);
      });
      if (!overlapsExisting) {
        merged.push(candidate);
      }
    });

    return merged.sort(function (left, right) {
      if (left === right) {
        return 0;
      }
      return left.compareDocumentPosition(right) & 4 ? -1 : 1;
    });
  }

  function findNearestTimeText(element) {
    if (!element || !element.querySelector) {
      return null;
    }

    const timeElement = element.querySelector("time");
    if (timeElement) {
      return timeElement.getAttribute("datetime") || utils.cleanText(timeElement.textContent);
    }

    const datetimeElement = element.querySelector("[datetime]");
    if (datetimeElement) {
      return datetimeElement.getAttribute("datetime");
    }

    return null;
  }

  const api = {
    extractBlocksFromContainer,
    queryOne,
    mergeMessageNodes,
    findNearestTimeText,
    readInlineText
  };

  namespace.dom = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

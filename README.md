# Chat Downloader

Local Chrome extension for exporting the currently open conversation from ChatGPT, Gemini, and Claude.

## Features

- Manifest V3 extension with no build step
- Export formats: Markdown, plain text, JSON, and print-friendly PDF
- Popup UI plus an injected page-level Export button
- Local-only processing with no backend
- Collects long conversations while scrolling the current page, then restores its previous position

## Load In Chrome

1. Open `chrome://extensions`
2. Enable Developer mode
3. Choose **Load unpacked**
4. Select the extracted project folder

## Run Tests

```powershell
npm test
```

## Notes

- `docx` is intentionally deferred.
- Provider DOM structures can change over time, so the adapters are isolated under `src/providers/`.
- Long conversations can take longer to collect. Very long captures stop at a safety limit and show a warning if they may be incomplete.

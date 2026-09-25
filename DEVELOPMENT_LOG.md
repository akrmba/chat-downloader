# Development log

This file records project decisions and technical follow-ups. It must not contain API keys, private chat contents, personal information, or customer data.

## 2026-09-25 — Long conversation capture

- **Reported behavior:** browser printing includes a complete conversation, while the extension export contains only the first few pages.
- **Finding:** the extension previously extracted the page DOM once. ChatGPT, Gemini, and Claude can render only part of a long conversation at a time, so a single DOM read can miss messages that are loaded as the page scrolls.
- **Change:** added a bounded scroll-and-capture pass for the three providers. It merges overlapping message windows, restores the original scroll position, and warns if a long capture reaches its time/step limit.
- **Privacy:** no conversation text or credentials were written to this log. Extraction remains in the extension and no backend was added.
- **Validation status:** code and diff review only. No automated tests or live-provider browser checks were run. The fix needs a manual check with a long test conversation on each provider.
- **Known limitation:** provider page structure and loading timing can change; a capture that reaches the safety limit may still be incomplete.

## 2026-09-25 — Snapshot scope correction

- **Reported behavior:** after scrolling, export failed with `snapshot is not defined`.
- **Cause and fix:** the latest captured snapshot was declared inside the `try` block but used after it to build the final export. Moved its declaration to the enclosing function scope.
- **Validation status:** diff review only; no tests or live-provider checks run yet.

## 2026-09-25 — Assistant messages missing

- **Reported behavior:** after scrolling, an export contained the user's messages but not the assistant replies.
- **Finding:** provider selectors could stop after finding one role/type of message, so fallback selectors for other messages were skipped. This is a likely cause based on code inspection; the live page markup has not been inspected.
- **Change:** combine role-specific and fallback message nodes in document order, skipping overlapping parent/child matches, for ChatGPT, Claude, and Gemini.
- **Validation status:** code/diff review only; no tests or live-provider checks run yet.

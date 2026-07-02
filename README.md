# Flip Scout

Take a screenshot, then search it on Google — that's the whole extension.

## How it works

1. Take a screenshot to your **clipboard** (not a saved file):
   - **Mac:** `Cmd+Ctrl+Shift+4`, then drag-select. (Note the `Ctrl` — plain
     `Cmd+Shift+4` saves a file to disk instead.)
   - **Windows:** `Win+Shift+S` (Snip & Sketch) copies to the clipboard by
     default.
2. Trigger Flip Scout: click its toolbar icon, or press its keyboard
   shortcut (`Ctrl+Shift+Y` / `Cmd+Shift+Y` by default).
3. Its popup opens, reads the image straight off your clipboard, uploads it
   to Google's reverse-image search, and opens a new tab with the results —
   then closes itself. No further clicks.

That's the entire feature set. No AI keyword generation, no eBay or Google
Shopping tabs, no capture history, no settings — just capture-to-clipboard
(handled by the OS) in, search results tab out.

## Status

Statically validated (JSON parses, JS syntactically balanced) but **not yet
run inside Chrome** — see "Load and test" below.

## Load and test (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this repo's root folder.
4. Pin the Flip Scout icon to the toolbar.

### Things to verify by hand

- `Cmd+Ctrl+Shift+4` on Mac (or `Win+Shift+S` on Windows) actually puts an
  image on the clipboard, not a file.
- Click the toolbar icon → popup shows "Searching Google…" then a new tab
  opens with real reverse-image-search results for what you captured, and
  the popup closes itself.
- Press the keyboard shortcut instead of clicking → identical behavior
  (this exercises Chrome's `_execute_action` command, which is defined to
  behave exactly like an icon click).
- Trigger Flip Scout with nothing (or non-image text) on the clipboard →
  popup shows the "No image on your clipboard" message instead of failing
  silently or opening a blank/broken tab.
- If the Google upload fails (e.g. offline) → popup shows "Google search
  failed" rather than hanging or opening a broken tab.

## Keyboard shortcut

Default is `Ctrl+Shift+Y` (Windows/Linux) or `Cmd+Shift+Y` (Mac). Chrome
silently does not bind a shortcut if it conflicts with something else on
your system — if it doesn't do anything, open
`chrome://extensions/shortcuts` and assign one manually.

## Architecture

- `manifest.json` — no background service worker, no content scripts.
  `commands._execute_action` binds the keyboard shortcut to the exact same
  behavior as clicking the toolbar icon (Chrome's reserved command name for
  this — no custom handling needed).
- `popup/popup.html` + `popup/popup.js` — the entire extension. On open, it
  reads the clipboard, uploads to Google, opens the results tab, closes
  itself.

### Why the popup, and not a background script or content script

Clipboard reads (`navigator.clipboard.read()`) need a genuinely **focused
document** with a real user gesture behind it, or Chrome throws
`Document is not focused`. Service workers have no document at all, and
offscreen documents (the usual MV3 workaround for background clipboard
access) are never focusable, so `read()` fails there too — this was checked
against Chrome's own extension APIs before writing any code, not assumed.
The popup is the one context that's unambiguously focused and
user-gesture-backed at the moment it opens, whether that open was triggered
by a click or by the keyboard shortcut, so it's the only reliable place to
do this.

### Why POST to `google.com/searchbyimage/upload`

This is the same endpoint Chrome's own "Search image with Google Lens"
right-click menu item uses internally — confirmed by reading the source of
[dessant/search-by-image](https://github.com/dessant/search-by-image), an
actively maintained open-source reverse-image-search extension, rather than
guessed. Because `google.com` is declared in `host_permissions`, the popup's
`fetch()` to that endpoint bypasses the CORS restriction a normal webpage
would hit, and the response's redirected URL is the finished results page.

## Permissions rationale

- `clipboardRead` — read the screenshot image off the system clipboard.
- Host permissions are limited to `google.com` — needed only for the
  reverse-image-search upload `fetch()` to bypass CORS.

Nothing else is requested: no `activeTab`/`scripting` (no page injection
happens at all), no `storage` (nothing is saved), no `tabs` permission
(`chrome.tabs.create` doesn't require it).

## Explicitly out of scope

- AI-generated search keywords, eBay sold listings, Google Shopping tabs,
  capture history, and any settings/options page. These existed in an
  earlier, more complex version of this extension and were cut to keep the
  capture-to-search path as short and reliable as possible. If wanted back
  later, they'd be additive on top of this simpler base rather than a
  rewrite.

## Known fragility

`https://www.google.com/searchbyimage/upload` is an undocumented, internal
Google endpoint (albeit the one Chrome's own UI uses) rather than a
published API. If Google changes it, the upload in `popup/popup.js` will
start failing — this fails loudly (the popup shows "Google search failed")
rather than silently, but the fix will require re-deriving the current
upload endpoint/field names.

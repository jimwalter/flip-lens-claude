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
3. A tab opens, reads the image straight off your clipboard, uploads it to
   Google's reverse-image search, and navigates itself to the results. No
   further clicks.

If something goes wrong at any step (no image on the clipboard, the Google
upload fails), that same tab shows a plain-language explanation and a Retry
button — it does not fail silently or open a blank/broken tab.

## Status

Statically validated (JSON parses, JS syntactically balanced) but **not yet
run inside Chrome**. See "Load and test" below.

## Load and test (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this repo's root folder.
4. Pin the Flip Scout icon to the toolbar.

### Things to verify by hand

- `Cmd+Ctrl+Shift+4` on Mac (or `Win+Shift+S` on Windows) actually puts an
  image on the clipboard, not a file.
- Click the toolbar icon → a new tab opens, shows "Reading clipboard…" then
  "Searching Google…", then lands on real reverse-image-search results for
  what you captured.
- Press the keyboard shortcut instead of clicking → identical behavior.
- Trigger Flip Scout with nothing (or non-image text) on the clipboard →
  the tab shows the "No image on your clipboard" message with a Retry
  button, instead of failing silently.
- If the Google upload fails (e.g. offline) → the tab shows "Google search
  failed" with a Retry button.
- If anything misbehaves, right-click the Flip Scout tab → **Inspect** and
  check the Console — every failure path `console.error`s the actual error
  before showing the friendly message, so there's always something concrete
  to go on rather than "it doesn't work."

## Keyboard shortcut

Default is `Ctrl+Shift+Y` (Windows/Linux) or `Cmd+Shift+Y` (Mac). Chrome
silently does not bind a shortcut if it conflicts with something else on
your system — if it doesn't do anything, open
`chrome://extensions/shortcuts` and assign one manually.

## Architecture

- `manifest.json` — no `default_popup` is configured, so both a toolbar
  click and the reserved `_execute_action` keyboard-shortcut command fire
  `chrome.action.onClicked` (confirmed against Chrome's own `action` API
  docs) — one code path handles both triggers.
- `background/background.js` — the entire service worker is one listener:
  on click, open `capture/capture.html` as a normal tab.
- `capture/capture.html` + `capture/capture.js` — reads the clipboard,
  uploads to Google, and navigates itself to the results (or shows an error
  with Retry/Close).

### Why a real tab, not a popup

An earlier version of this extension did the clipboard-read-and-upload work
inside the extension's popup. Chrome popups close the instant they lose
focus — which makes them a bad host for a clipboard permission prompt (if
one appears, the popup can vanish along with it) and means there's no way
to inspect a console error before the popup disappears. That version was
reported "doesn't work at all" with no further detail obtainable, which is
consistent with this exact failure mode. A normal tab has none of these
problems: it has stable focus, and you can right-click → Inspect it like
any other page if it breaks.

### Why POST to `google.com/searchbyimage/upload`

This is the same endpoint Chrome's own "Search image with Google Lens"
right-click menu item uses internally — confirmed by reading the source of
[dessant/search-by-image](https://github.com/dessant/search-by-image), an
actively maintained open-source reverse-image-search extension, rather than
guessed. Because `google.com` is declared in `host_permissions`, the
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

AI-generated search keywords, eBay sold listings, Google Shopping tabs,
capture history, and any settings/options page. These existed in an
earlier, more complex version of this extension and were cut to keep the
capture-to-search path as short and reliable as possible.

## Known fragility

`https://www.google.com/searchbyimage/upload` is an undocumented, internal
Google endpoint (albeit the one Chrome's own UI uses) rather than a
published API. If Google changes it, the upload in `capture/capture.js`
will start failing — this fails loudly (the tab shows "Google search
failed" and the real error is in the console) rather than silently, but the
fix will require re-deriving the current upload endpoint/field names.

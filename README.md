# Flip Scout

A Chrome extension for fast visual research: screenshot an item on any
webpage and, with no further clicks, get a Google reverse-image-search
results tab (plus eBay sold listings and Google Shopping, when a keyword can
be generated) opened for you automatically. The screenshot is also copied to
your system clipboard as a bonus, in case you want to paste it elsewhere.

## Status

This is a from-scratch implementation of the Flip Scout project spec
(Manifest V3). It has been statically validated (JSON parses, JS files are
syntactically balanced) but **not yet run inside Chrome** — see "Load and
test" below, which is required before any feature here should be considered
done.

## Load and test (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this repo's root folder.
4. Pin the Flip Scout icon to the toolbar if you want one-click access.

### Things to verify by hand (no automated test can check these)

- Press the keyboard shortcut (or click the toolbar icon) on a normal
  `http(s)` page → drag-select overlay appears immediately, Esc cancels it.
- Complete a drag-select and release → with no further click, a new tab
  opens showing Google reverse-image-search results for the cropped item.
  The crop is also on the system clipboard (paste it anywhere, e.g.
  Preview/Paint, to confirm).
- With no Anthropic key set in Options → only the Google results tab opens;
  the popup history entry shows a "skipped, no API key" note with a working
  link to Settings.
- With a valid Anthropic key set → eBay (sold/completed listings) and Google
  Shopping tabs also open, pre-filled with the generated keyword.
- Disconnect from the internet (or otherwise force the upload to fail) →
  capture should still complete gracefully; the history entry notes that the
  Google search failed to open, rather than the extension hanging or
  erroring out silently.
- Popup history: thumbnails render, delete removes a single entry, "Clear
  all" empties the list, tab links open the right pages.
- Keyboard shortcut (`Ctrl+Shift+Y` / `Cmd+Shift+Y`) triggers the same
  capture flow as the toolbar icon.

## Keyboard shortcut

Default is `Ctrl+Shift+Y` (Windows/Linux) or `Cmd+Shift+Y` (Mac). Chrome
silently does not bind a shortcut if it conflicts with something else on
your system — if the shortcut doesn't do anything, open
`chrome://extensions/shortcuts` and assign one manually.

## AI keyword generation (optional)

Flip Scout can call Anthropic's API to turn your screenshot into a short
eBay-style search phrase, which is used to pre-fill the eBay and Google
Shopping tabs. This is entirely optional:

- Open the extension's Settings (gear icon in the popup) and paste in an
  Anthropic API key from [console.anthropic.com](https://console.anthropic.com/).
- The key is stored only in `chrome.storage.local` on this device (never
  synced) and is sent only directly to Anthropic's API.
- Without a key, or if the API call fails, Flip Scout still copies the
  screenshot to your clipboard and opens the Google reverse-image-search tab
  — it just skips opening eBay/Shopping tabs rather than opening them blank.
  The history log notes why a capture was skipped.

## Architecture

- `background/background.js` — service worker. Orchestrates capture
  (injecting the overlay, taking the full-tab screenshot via
  `chrome.tabs.captureVisibleTab`), POSTs the cropped image directly to
  Google's reverse-image-search upload endpoint and opens a tab to the
  resulting results page, calls the Anthropic API for keyword generation,
  builds the eBay/Shopping search URLs, opens tabs, and writes history.
- `content/capture-overlay.js` (+ `.css`) — injected on demand (toolbar
  click or keyboard shortcut only, not persistent). Draws the click-drag
  selection overlay, crops the screenshot via `<canvas>`, writes the crop to
  the system clipboard with `navigator.clipboard.write()` + `ClipboardItem`,
  and hands both a full-resolution and a downscaled copy of the crop back to
  the background service worker.
- `popup/` — toolbar popup: capture button + scrollable history (thumbnail,
  keyword, time-ago, tab links, delete, "skipped" notes).
- `options/` — Settings page for the Anthropic API key.
- `lib/` — small modules shared between the service worker and popup/options
  (`chrome.storage.local` history/settings CRUD, search URL builders,
  time-ago formatting). The content script is a plain (non-module) script
  and can't `import` these, so its message-type string constants are
  hand-duplicated — see the comment at the top of `background/background.js`
  if you rename any of them.

### Why no clipboard-paste step

An earlier version of this extension copied the crop to the clipboard and
relied on the user manually pasting it into Google's search box (simulating
a paste DOM event doesn't reliably trigger Google's reverse-image search, so
a real keystroke seemed necessary). In practice, that extra manual step was
both slower than the goal of "as few clicks as possible" and turned out to
be unreliable on its own.

Instead, `background.js` POSTs the cropped image as `multipart/form-data`
directly to `https://www.google.com/searchbyimage/upload` — the same
endpoint Chrome's built-in "Search image with Google Lens" right-click menu
item uses. Because the extension declares `host_permissions` for
`google.com`, this `fetch()` bypasses the CORS restriction a normal webpage
would hit, and the response's redirected URL is the finished results page,
which gets opened directly in a new tab. No content script on Google's pages
is needed anymore.

## Permissions rationale

- `activeTab`, `scripting` — inject the capture overlay only into the tab
  the user actually triggered capture on.
- `tabs` — open the Google/eBay/Shopping result tabs.
- `storage`, `unlimitedStorage` — history entries include thumbnail images,
  which can add up past the default quota.
- `clipboardWrite` — write the cropped screenshot to the system clipboard.
- Host permissions are limited to `google.com` — needed for the
  reverse-image-search upload `fetch()` to bypass CORS.

## Out of scope (by design)

- True reverse-image search on eBay (no automatable URL exists for it) —
  text keyword search only.
- Price aggregation/comp averaging across sold listings.
- Multi-item batch capture.
- Cross-device sync or accounts.
- Site-specific handling (iframes, etc.) for particular estate-sale
  platforms.

## Known fragility

`https://www.google.com/searchbyimage/upload` is an undocumented, internal
Google endpoint (albeit the one Chrome's own UI uses) rather than a
published API. If Google changes it, the upload `fetch()` in
`openGoogleReverseImageSearch()` (`background/background.js`) will start
failing — this fails loudly (caught, logged, surfaced as a "search failed"
note in history) rather than silently, but the fix will require re-deriving
the current upload endpoint/field names. This is an accepted tradeoff of not
using a paid image-search API.

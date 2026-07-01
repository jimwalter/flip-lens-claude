# Flip Scout

A Chrome extension for fast visual research: screenshot an item on any
webpage, get it copied straight to your system clipboard, and have Google
Images (plus eBay sold listings and Google Shopping, when a keyword can be
generated) open automatically.

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

- Click the toolbar icon on a normal `http(s)` page → drag-select overlay
  appears, Esc cancels it.
- Complete a drag-select → cropped screenshot lands on the system clipboard
  (paste it anywhere, e.g. Preview/Paint, to confirm) and a Google Images tab
  opens with the "paste to search" banner.
- Paste into Google's search box → banner dismisses itself.
- With no Anthropic key set in Options → only the Google Images tab opens;
  the popup history entry shows a "skipped, no API key" note with a working
  link to Settings.
- With a valid Anthropic key set → eBay (sold/completed listings) and Google
  Shopping tabs also open, pre-filled with the generated keyword.
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
  screenshot to your clipboard and opens Google Images — it just skips
  opening eBay/Shopping tabs rather than opening them blank. The history log
  notes why a capture was skipped.

## Architecture

- `background/background.js` — service worker. Orchestrates capture
  (injecting the overlay, taking the full-tab screenshot via
  `chrome.tabs.captureVisibleTab`), calls the Anthropic API for keyword
  generation, builds the eBay/Shopping search URLs, opens tabs, and writes
  history.
- `content/capture-overlay.js` (+ `.css`) — injected on demand (toolbar
  click or keyboard shortcut only, not persistent). Draws the click-drag
  selection overlay, crops the screenshot via `<canvas>`, and writes the
  crop to the system clipboard with `navigator.clipboard.write()` +
  `ClipboardItem`.
- `content/google-banner.js` (+ `.css`) — persistent content script matched
  on `images.google.com` / `google.com`. Shows the "paste to search" banner
  when Flip Scout opened the tab, and dismisses itself on the page's next
  paste event. Deliberately does **not** simulate paste/drop DOM events —
  that was tried and doesn't reliably trigger Google's reverse-image search,
  so a real user keystroke is required.
- `popup/` — toolbar popup: capture button + scrollable history (thumbnail,
  keyword, time-ago, tab links, delete, "skipped" notes).
- `options/` — Settings page for the Anthropic API key.
- `lib/` — small modules shared between the service worker and popup/options
  (`chrome.storage.local` history/settings CRUD, search URL builders,
  time-ago formatting). Content scripts are plain (non-module) scripts and
  can't `import` these, so their message-type string constants are
  hand-duplicated — see the comment at the top of `background/background.js`
  if you rename any of them.

## Permissions rationale

- `activeTab`, `scripting` — inject the capture overlay only into the tab
  the user actually triggered capture on.
- `tabs` — open the Google Images/eBay/Shopping result tabs.
- `storage`, `unlimitedStorage` — history entries include thumbnail images,
  which can add up past the default quota.
- `clipboardWrite` — write the cropped screenshot to the system clipboard.
- Host permissions are limited to `images.google.com` and `google.com` —
  the only sites Flip Scout injects a persistent content script into.

## Out of scope (by design)

- True reverse-image search on eBay (no automatable URL exists for it) —
  text keyword search only.
- Price aggregation/comp averaging across sold listings.
- Multi-item batch capture.
- Cross-device sync or accounts.
- Site-specific handling (iframes, etc.) for particular estate-sale
  platforms.

## Known fragility

Google Images' front-end is not a stable API. If Google changes its page
layout, `content/google-banner.js`'s positioning may need adjusting — this
is an accepted tradeoff of not using a paid image-search API.

// No default_popup is set in the manifest, so both a toolbar-icon click and
// the _execute_action keyboard shortcut fire this same onClicked event
// (confirmed against Chrome's own action API docs) — one code path for
// both triggers, nothing to keep in sync between them.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('capture/capture.html') });
});

// Shared chrome.storage.local helpers for history + settings.
// Used by background.js, popup/popup.js, and options/options.js.

export const HISTORY_KEY = 'flipscout_history';
export const SETTINGS_KEY = 'flipscout_settings';
export const MAX_HISTORY_ENTRIES = 300;

export async function getHistory() {
  const result = await chrome.storage.local.get(HISTORY_KEY);
  return result[HISTORY_KEY] || [];
}

export async function addHistoryEntry(entry) {
  const history = await getHistory();
  history.unshift(entry);
  if (history.length > MAX_HISTORY_ENTRIES) {
    history.length = MAX_HISTORY_ENTRIES;
  }
  await chrome.storage.local.set({ [HISTORY_KEY]: history });
  return entry;
}

export async function deleteHistoryEntry(id) {
  const history = await getHistory();
  const next = history.filter((item) => item.id !== id);
  await chrome.storage.local.set({ [HISTORY_KEY]: next });
  return next;
}

export async function clearHistory() {
  await chrome.storage.local.set({ [HISTORY_KEY]: [] });
}

export async function getSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { apiKey: '', ...(result[SETTINGS_KEY] || {}) };
}

export async function saveSettings(settings) {
  const current = await getSettings();
  const next = { ...current, ...settings };
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

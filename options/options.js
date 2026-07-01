import { getSettings, saveSettings } from '../lib/storage.js';

const form = document.getElementById('settings-form');
const apiKeyInput = document.getElementById('api-key');
const statusMsg = document.getElementById('status-msg');
const shortcutsLink = document.getElementById('shortcuts-link');

async function init() {
  const settings = await getSettings();
  apiKeyInput.value = settings.apiKey || '';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveSettings({ apiKey: apiKeyInput.value.trim() });
  showStatus('Saved');
});

// chrome://* URLs can't be reached with a plain <a href> click; extension
// pages can open them via chrome.tabs.create instead.
shortcutsLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

function showStatus(message) {
  statusMsg.textContent = message;
  statusMsg.classList.add('flipscout-visible');
  setTimeout(() => statusMsg.classList.remove('flipscout-visible'), 1800);
}

init();

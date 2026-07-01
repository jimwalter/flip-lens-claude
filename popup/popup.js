import { getHistory, deleteHistoryEntry, clearHistory, HISTORY_KEY } from '../lib/storage.js';
import { formatTimeAgo } from '../lib/timeago.js';

const captureBtn = document.getElementById('capture-btn');
const settingsBtn = document.getElementById('settings-btn');
const clearAllBtn = document.getElementById('clear-all-btn');
const historyList = document.getElementById('history-list');
const emptyState = document.getElementById('empty-state');

captureBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'FLIPSCOUT_TRIGGER_CAPTURE' });
  window.close();
});

settingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

clearAllBtn.addEventListener('click', async () => {
  await clearHistory();
  render();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[HISTORY_KEY]) {
    render();
  }
});

async function render() {
  const history = await getHistory();
  historyList.innerHTML = '';

  if (history.length === 0) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  for (const entry of history) {
    historyList.appendChild(renderEntry(entry));
  }
}

function renderEntry(entry) {
  const item = document.createElement('div');
  item.className = 'history-item';

  const thumb = document.createElement('img');
  thumb.className = 'history-thumb';
  thumb.src = entry.thumbnail;
  thumb.alt = entry.keyword || 'Captured item';
  item.appendChild(thumb);

  const body = document.createElement('div');
  body.className = 'history-body';

  const title = document.createElement('div');
  title.className = 'history-title';
  title.textContent = entry.keyword || 'No keyword generated';
  body.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'history-meta';
  meta.textContent = formatTimeAgo(entry.timestamp);
  body.appendChild(meta);

  if (entry.skippedReason) {
    body.appendChild(renderSkipNote(entry.skippedReason));
  }

  const links = document.createElement('div');
  links.className = 'history-links';
  addLink(links, entry.links.googleImages, 'Google Images');
  addLink(links, entry.links.ebay, 'eBay');
  addLink(links, entry.links.googleShopping, 'Shopping');
  body.appendChild(links);

  item.appendChild(body);
  item.appendChild(renderDeleteButton(entry.id));

  return item;
}

function renderSkipNote(reason) {
  const note = document.createElement('div');
  note.className = 'history-skip-note';
  const reasonText =
    reason === 'no_api_key'
      ? 'eBay/Shopping skipped — no API key set. '
      : 'eBay/Shopping skipped — keyword generation failed. ';
  note.textContent = reasonText;

  const settingsLink = document.createElement('a');
  settingsLink.href = '#';
  settingsLink.textContent = 'Open Settings';
  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  note.appendChild(settingsLink);
  return note;
}

function renderDeleteButton(entryId) {
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'history-delete';
  deleteBtn.type = 'button';
  deleteBtn.setAttribute('aria-label', 'Delete');
  deleteBtn.textContent = '×';
  deleteBtn.addEventListener('click', async () => {
    await deleteHistoryEntry(entryId);
    render();
  });
  return deleteBtn;
}

function addLink(container, url, label) {
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.textContent = label;
  a.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url });
  });
  container.appendChild(a);
}

render();

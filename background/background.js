import { addHistoryEntry, getSettings } from '../lib/storage.js';
import { buildGoogleImagesUrl, buildEbaySoldListingsUrl, buildGoogleShoppingUrl } from '../lib/url-builders.js';

// Message type strings. Content scripts are plain (non-module) scripts and
// hardcode these same literals — keep both sides in sync if you rename any.
const MSG = {
  START_CAPTURE: 'FLIPSCOUT_START_CAPTURE',
  CAPTURE_TAB: 'FLIPSCOUT_CAPTURE_TAB',
  CAPTURE_DONE: 'FLIPSCOUT_CAPTURE_DONE',
  CAPTURE_CANCELLED: 'FLIPSCOUT_CAPTURE_CANCELLED',
  TRIGGER_CAPTURE: 'FLIPSCOUT_TRIGGER_CAPTURE',
};

const VISION_MODEL = 'claude-sonnet-5';
const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

const INJECTABLE_URL_PATTERN = /^https?:\/\//i;

chrome.action.onClicked.addListener((tab) => {
  startCaptureOnTab(tab.id);
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'capture-region' && tab?.id != null) {
    startCaptureOnTab(tab.id);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === MSG.TRIGGER_CAPTURE) {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id != null) startCaptureOnTab(tab.id);
    });
    return false;
  }

  if (message?.type === MSG.CAPTURE_TAB) {
    const tabId = sender.tab?.id;
    const windowId = sender.tab?.windowId;
    if (windowId == null) {
      sendResponse({ error: 'No window for capture' });
      return false;
    }
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' })
      .then((dataUrl) => sendResponse({ dataUrl }))
      .catch((err) => sendResponse({ error: String(err) }));
    return true; // async response
  }

  if (message?.type === MSG.CAPTURE_DONE) {
    handleCaptureComplete(message.payload)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error('Flip Scout: failed to complete capture', err);
        sendResponse({ ok: false, error: String(err) });
      });
    return true; // async response
  }

  if (message?.type === MSG.CAPTURE_CANCELLED) {
    return false;
  }

  return false;
});

async function startCaptureOnTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || !INJECTABLE_URL_PATTERN.test(tab.url)) {
      await flashBadgeError();
      return;
    }

    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content/capture-overlay.css'],
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/capture-overlay.js'],
    });
  } catch (err) {
    console.error('Flip Scout: could not start capture on this tab', err);
    await flashBadgeError();
  }
}

async function flashBadgeError() {
  await chrome.action.setBadgeBackgroundColor({ color: '#D93025' });
  await chrome.action.setBadgeText({ text: '!' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2500);
}

async function handleCaptureComplete(payload) {
  const { previewDataUrl } = payload;

  const googleImagesUrl = buildGoogleImagesUrl();
  await chrome.tabs.create({ url: googleImagesUrl, active: true });

  const { keyword, skippedReason } = await generateKeyword(previewDataUrl);

  const links = { googleImages: googleImagesUrl, ebay: null, googleShopping: null };

  if (keyword) {
    links.ebay = buildEbaySoldListingsUrl(keyword);
    links.googleShopping = buildGoogleShoppingUrl(keyword);
    await chrome.tabs.create({ url: links.ebay, active: false });
    await chrome.tabs.create({ url: links.googleShopping, active: false });
  }

  await addHistoryEntry({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    thumbnail: previewDataUrl,
    keyword,
    links,
    skippedReason: keyword ? null : skippedReason,
  });
}

async function generateKeyword(imageDataUrl) {
  const settings = await getSettings();
  if (!settings.apiKey) {
    return { keyword: null, skippedReason: 'no_api_key' };
  }

  try {
    const base64Data = imageDataUrl.slice(imageDataUrl.indexOf(',') + 1);
    const response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 40,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/png', data: base64Data },
              },
              {
                type: 'text',
                text:
                  'Look at this item. Reply with ONLY a short 4-8 word eBay-style search ' +
                  'phrase someone would use to find sold listings of this exact or very ' +
                  'similar item. No punctuation, no explanation, no quotes.',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error('Flip Scout: Anthropic API error', response.status, await response.text());
      return { keyword: null, skippedReason: 'ai_call_failed' };
    }

    const data = await response.json();
    const text = data?.content?.find((block) => block.type === 'text')?.text?.trim();
    if (!text) {
      return { keyword: null, skippedReason: 'ai_call_failed' };
    }
    return { keyword: text.replace(/^["']|["']$/g, ''), skippedReason: null };
  } catch (err) {
    console.error('Flip Scout: keyword generation failed', err);
    return { keyword: null, skippedReason: 'ai_call_failed' };
  }
}

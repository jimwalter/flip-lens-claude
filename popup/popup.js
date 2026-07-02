const statusEl = document.getElementById('status');

run();

async function run() {
  let imageBlob;
  try {
    imageBlob = await readClipboardImage();
  } catch (err) {
    statusEl.textContent = `Couldn't read the clipboard: ${err.message || err}`;
    return;
  }

  if (!imageBlob) {
    statusEl.textContent =
      'No image on your clipboard. Take a screenshot first — Cmd+Ctrl+Shift+4 on Mac ' +
      'or Win+Shift+S on Windows both copy straight to the clipboard — then try again.';
    return;
  }

  statusEl.textContent = 'Searching Google…';

  const resultsUrl = await uploadToGoogle(imageBlob);
  if (!resultsUrl) {
    statusEl.textContent = 'Google search failed. Try again in a moment.';
    return;
  }

  await chrome.tabs.create({ url: resultsUrl, active: true });
  window.close();
}

async function readClipboardImage() {
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const imageType = item.types.find((type) => type.startsWith('image/'));
    if (imageType) return item.getType(imageType);
  }
  return null;
}

async function uploadToGoogle(imageBlob) {
  try {
    const formData = new FormData();
    formData.append('encoded_image', imageBlob, 'flipscout-capture.png');
    formData.append('image_url', '');
    formData.append('sbisrc', 'Google Chrome');

    // host_permissions for google.com let this fetch bypass the CORS
    // restriction a normal webpage would hit; the response redirects to
    // the finished reverse-image-search results page.
    const response = await fetch('https://www.google.com/searchbyimage/upload', {
      method: 'POST',
      mode: 'cors',
      body: formData,
    });

    if (!response.ok) {
      console.error('Flip Scout: Google upload failed', response.status);
      return null;
    }
    return response.url;
  } catch (err) {
    console.error('Flip Scout: Google upload errored', err);
    return null;
  }
}

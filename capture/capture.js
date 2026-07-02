const statusEl = document.getElementById('status');
const retryBtn = document.getElementById('retry-btn');
const closeBtn = document.getElementById('close-btn');

retryBtn.addEventListener('click', () => {
  retryBtn.hidden = true;
  closeBtn.hidden = true;
  run();
});
closeBtn.addEventListener('click', () => window.close());

run();

async function run() {
  setStatus('Reading clipboard…');

  let imageBlob;
  try {
    imageBlob = await readClipboardImage();
  } catch (err) {
    console.error('Flip Scout: clipboard read failed', err);
    showError(`Couldn't read the clipboard: ${err.message || err}`);
    return;
  }

  if (!imageBlob) {
    showError(
      'No image found on your clipboard. Take a screenshot first — ' +
        'Cmd+Ctrl+Shift+4 on Mac or Win+Shift+S on Windows both copy ' +
        'straight to the clipboard — then click Retry.'
    );
    return;
  }

  setStatus('Searching Google…');

  let resultsUrl;
  try {
    resultsUrl = await uploadToGoogle(imageBlob);
  } catch (err) {
    console.error('Flip Scout: Google upload errored', err);
    showError(`Google search failed: ${err.message || err}`);
    return;
  }

  if (!resultsUrl) {
    showError('Google search failed. Click Retry to try again.');
    return;
  }

  setStatus('Opening results…');
  window.location.href = resultsUrl;
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
  const formData = new FormData();
  formData.append('encoded_image', imageBlob, 'flipscout-capture.png');
  formData.append('image_url', '');
  formData.append('sbisrc', 'Google Chrome');

  // host_permissions for google.com let this fetch bypass the CORS
  // restriction a normal webpage would hit; the response redirects to
  // the finished reverse-image-search results page. Verified against
  // the source of a real, actively-maintained reverse-image-search
  // extension (github.com/dessant/search-by-image) rather than guessed.
  const response = await fetch('https://www.google.com/searchbyimage/upload', {
    method: 'POST',
    mode: 'cors',
    body: formData,
  });

  if (!response.ok) {
    console.error('Flip Scout: Google upload responded with status', response.status);
    return null;
  }
  return response.url;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function showError(text) {
  statusEl.textContent = text;
  retryBtn.hidden = false;
  closeBtn.hidden = false;
}

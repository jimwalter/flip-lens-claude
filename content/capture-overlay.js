(() => {
  // Injected on demand via chrome.scripting.executeScript. Guard against a
  // second injection (e.g. user presses the shortcut twice quickly).
  if (window.__flipScoutCaptureActive) return;
  window.__flipScoutCaptureActive = true;

  const PREVIEW_MAX_DIMENSION = 480;
  const MIN_SELECTION_PX = 6;

  const root = document.createElement('div');
  root.id = 'flipscout-overlay-root';

  const selectionBox = document.createElement('div');
  selectionBox.id = 'flipscout-selection-box';

  const hint = document.createElement('div');
  hint.id = 'flipscout-hint';
  hint.textContent = 'Click and drag to select an item. Esc to cancel.';

  root.appendChild(selectionBox);
  root.appendChild(hint);
  document.documentElement.appendChild(root);

  let startX = 0;
  let startY = 0;
  let dragging = false;

  root.addEventListener('mousedown', onMouseDown);
  document.addEventListener('keydown', onKeyDown, true);

  function onMouseDown(e) {
    if (e.button !== 0) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.display = 'block';
    updateSelectionBox(startX, startY, startX, startY);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
  }

  function onMouseMove(e) {
    if (!dragging) return;
    updateSelectionBox(startX, startY, e.clientX, e.clientY);
  }

  function onMouseUp(e) {
    if (!dragging) return;
    dragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    const rect = normalizedRect(startX, startY, e.clientX, e.clientY);
    if (rect.width < MIN_SELECTION_PX || rect.height < MIN_SELECTION_PX) {
      cancelCapture();
      return;
    }
    captureRegion(rect);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancelCapture();
    }
  }

  function updateSelectionBox(x0, y0, x1, y1) {
    const rect = normalizedRect(x0, y0, x1, y1);
    selectionBox.style.left = `${rect.left}px`;
    selectionBox.style.top = `${rect.top}px`;
    selectionBox.style.width = `${rect.width}px`;
    selectionBox.style.height = `${rect.height}px`;
  }

  function normalizedRect(x0, y0, x1, y1) {
    const left = Math.min(x0, x1);
    const top = Math.min(y0, y1);
    return { left, top, width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) };
  }

  function cancelCapture() {
    chrome.runtime.sendMessage({ type: 'FLIPSCOUT_CAPTURE_CANCELLED' });
    teardown();
  }

  async function captureRegion(rect) {
    hint.textContent = 'Capturing…';
    root.classList.add('flipscout-hidden');

    // Wait for the overlay to actually disappear from the compositor
    // before asking the background script to screenshot the tab.
    await nextFrame();
    await nextFrame();

    try {
      const { dataUrl, error } = await chrome.runtime.sendMessage({ type: 'FLIPSCOUT_CAPTURE_TAB' });
      if (error || !dataUrl) throw new Error(error || 'No screenshot returned');

      const image = await loadImage(dataUrl);
      const scale = window.devicePixelRatio || 1;

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = Math.max(1, Math.round(rect.width * scale));
      cropCanvas.height = Math.max(1, Math.round(rect.height * scale));
      const cropCtx = cropCanvas.getContext('2d');
      cropCtx.drawImage(
        image,
        Math.round(rect.left * scale),
        Math.round(rect.top * scale),
        cropCanvas.width,
        cropCanvas.height,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height
      );

      const clipboardBlob = await new Promise((resolve) => cropCanvas.toBlob(resolve, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': clipboardBlob })]);

      const fullDataUrl = cropCanvas.toDataURL('image/png');
      const previewDataUrl = downscaleToDataUrl(cropCanvas, PREVIEW_MAX_DIMENSION);

      await chrome.runtime.sendMessage({
        type: 'FLIPSCOUT_CAPTURE_DONE',
        payload: { fullDataUrl, previewDataUrl },
      });

      showToast('Copied! Searching Google, eBay, and Shopping…');
    } catch (err) {
      console.error('Flip Scout: capture failed', err);
      showToast('Flip Scout capture failed — see console for details.');
    } finally {
      setTimeout(teardown, 1200);
    }
  }

  function downscaleToDataUrl(sourceCanvas, maxDimension) {
    const longestEdge = Math.max(sourceCanvas.width, sourceCanvas.height);
    const scale = Math.min(1, maxDimension / longestEdge);
    if (scale === 1) return sourceCanvas.toDataURL('image/png');

    const outCanvas = document.createElement('canvas');
    outCanvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
    outCanvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));
    outCanvas.getContext('2d').drawImage(sourceCanvas, 0, 0, outCanvas.width, outCanvas.height);
    return outCanvas.toDataURL('image/png');
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.id = 'flipscout-toast';
    toast.textContent = message;
    document.documentElement.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('flipscout-visible'));
    setTimeout(() => toast.remove(), 3000);
  }

  function teardown() {
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    root.remove();
    window.__flipScoutCaptureActive = false;
  }
})();

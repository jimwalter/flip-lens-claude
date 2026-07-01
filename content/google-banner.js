(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('flipscout') !== 'paste') return;

  // Clean the marker off the URL so a manual reload doesn't re-show the banner.
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete('flipscout');
  window.history.replaceState({}, '', cleanUrl.toString());

  const banner = document.createElement('div');
  banner.id = 'flipscout-paste-banner';
  banner.innerHTML =
    '<span>Your item is copied — click the search box, then press ' +
    '<strong>Cmd+V / Ctrl+V</strong> to search it.</span>';

  const closeBtn = document.createElement('button');
  closeBtn.id = 'flipscout-paste-banner-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Dismiss');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', dismiss);
  banner.appendChild(closeBtn);

  document.documentElement.appendChild(banner);

  document.addEventListener('paste', dismiss, { once: true });

  function dismiss() {
    banner.remove();
    document.removeEventListener('paste', dismiss);
  }
})();

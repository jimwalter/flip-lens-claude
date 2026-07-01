// Search URL builders shared by background.js.

export function buildGoogleImagesUrl() {
  // The query flag is read by content/google-banner.js to decide whether
  // to show the "paste to search" prompt on this particular page load.
  return 'https://images.google.com/?flipscout=paste';
}

export function buildEbaySoldListingsUrl(keyword) {
  const params = new URLSearchParams({
    _nkw: keyword,
    LH_Sold: '1',
    LH_Complete: '1',
  });
  return `https://www.ebay.com/sch/i.html?${params.toString()}`;
}

export function buildGoogleShoppingUrl(keyword) {
  const params = new URLSearchParams({
    tbm: 'shop',
    q: keyword,
  });
  return `https://www.google.com/search?${params.toString()}`;
}

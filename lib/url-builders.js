// Search URL builders shared by background.js.

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

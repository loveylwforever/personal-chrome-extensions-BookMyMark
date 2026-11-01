export function getFaviconUrl(pageUrl: string, size = 32): string {
  // chrome-extension://id/_favicon/ is not a bundled public path; cast for WXT types
  const base = browser.runtime.getURL('/_favicon/' as never);
  const url = new URL(base);
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', String(size));
  return url.toString();
}

export function letterFromTitle(title: string): string {
  const t = title.trim();
  if (!t) return '?';
  return Array.from(t)[0]!.toUpperCase();
}

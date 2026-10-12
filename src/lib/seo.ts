/** Production URLs are independent of preview hosts, query strings and fragments. */
export function canonicalUrl(pathname: string, site: URL | undefined): string {
  const path = pathname.replace(/^\/+|\/+$/g, '');
  return new URL(path ? `/${path}/` : '/', site || 'https://inboxfornow.com/').href;
}

export function serializeJsonLd(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

const OTP_KEYWORDS = /\b(code|verification|verify|otp|pin|one[\s-]?time|passcode|password)\b/i;
const OTP_PATTERN = /\b(?:\d[\s-]?){3,7}\d\b|\b[A-Z0-9]{4,8}\b/;

const ALLOWED_TAGS = [
  'p', 'a', 'b', 'strong', 'i', 'em', 'br', 'ul', 'ol', 'li', 'blockquote',
  'span', 'div', 'h1', 'h2', 'h3', 'h4', 'table', 'tr', 'td',
];

export function detectOTP(html: string): string | null {
  const explicit = html.match(/<[^>]+class\s*=\s*["'][^"']*\botp\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
  if (explicit) {
    const code = explicit[1].replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').replace(/[\s-]/g, '').trim();
    if (/^[A-Z0-9]{4,10}$/i.test(code)) return code.toUpperCase();
  }

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const keyword = OTP_KEYWORDS.exec(text);
  if (keyword) {
    const window = text.slice(keyword.index, keyword.index + 120);
    const match = OTP_PATTERN.exec(window);
    if (match) {
      const code = match[0].replace(/[\s-]/g, '');
      if (/^[A-Z0-9]{4,10}$/i.test(code) && !/^[a-z]+$/i.test(code)) return code.toUpperCase();
    }
  }

  const standalone = text.match(/\b\d{3}[\s-]?\d{3}\b|\b\d{4,8}\b/);
  if (standalone) {
    const code = standalone[0].replace(/[\s-]/g, '');
    if (/^\d{4,8}$/.test(code)) return code;
  }

  return null;
}

export function sanitizeMessageHtml(input: string): { html: string; stripCount: number } {
  const beforeBlocked = countBlocked(input);
  const html = input
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<(iframe|object|embed|form|img)\b[^>]*>(?:[\s\S]*?<\/\1>)?/gi, '')
    .replace(/<\/?([a-z0-9-]+)([^>]*)>/gi, (raw, tagName: string, attrs: string) => {
      const tag = tagName.toLowerCase();
      const closing = raw.startsWith('</');
      if (!ALLOWED_TAGS.includes(tag)) return '';
      if (closing) return `</${tag}>`;
      if (tag === 'br') return '<br>';
      if (tag !== 'a') return `<${tag}>`;

      const href = attrs.match(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const url = href?.[1] || href?.[2] || href?.[3] || '';
      if (!/^https?:\/\//i.test(url)) return '<a>';
      return `<a href="/r?u=${encodeURIComponent(url)}" rel="noopener noreferrer nofollow">`;
    });

  const afterBlocked = countBlocked(html);
  return {
    html,
    stripCount: Math.max(0, beforeBlocked - afterBlocked),
  };
}

export function previewFromHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function countBlocked(html: string): number {
  const matches = html.match(/<(script|style|iframe|object|embed|form|img)\b|javascript:/gi);
  return matches?.length ?? 0;
}

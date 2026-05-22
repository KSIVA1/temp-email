import { describe, expect, it } from 'vitest';
import { detectOTP, sanitizeMessageHtml } from '../src/mail';

describe('mail sanitization', () => {
  it('uses the client-compatible OTP detection rules', () => {
    expect(detectOTP('<p>Your verification code is <span class="otp">274 016</span></p>')).toBe('274016');
    expect(detectOTP('<p>Use code 938421 to continue</p>')).toBe('938421');
  });

  it('keeps safe tags while stripping scripts, styles, images, forms, and unsafe links', () => {
    const sanitized = sanitizeMessageHtml('<h1>Hi</h1><style>*{}</style><p><strong>Code</strong></p><form></form><iframe></iframe><img src=x><a href="javascript:alert(1)">bad</a><a href="https://example.com/path?q=1">good</a>');

    expect(sanitized.html).toContain('<h1>Hi</h1>');
    expect(sanitized.html).toContain('<strong>Code</strong>');
    expect(sanitized.html).not.toContain('<style');
    expect(sanitized.html).not.toContain('<form');
    expect(sanitized.html).not.toContain('<iframe');
    expect(sanitized.html).not.toContain('<img');
    expect(sanitized.html).not.toContain('javascript:');
    expect(sanitized.html).toContain('/r?u=https%3A%2F%2Fexample.com%2Fpath%3Fq%3D1');
    expect(sanitized.stripCount).toBeGreaterThan(0);
  });
});

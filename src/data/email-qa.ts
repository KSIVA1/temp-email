// Public, synthetic examples. Expected outputs are checked against the real
// receiving handler and HTTP message response in scripts/email-fixtures.test.ts.
export const emailQaCases = [
  {
    file: 'signup-plain.eml',
    title: 'Plain-text code',
    subject: 'signup-smoke-plain',
    result: 'The text body survives, the sample code is detected, and angle brackets display as text.',
    otp: '418229',
    html: '<p>Verification code: 418229\nSynthetic user: &lt;test-user&gt;\n</p>',
    preview: 'Verification code: 418229 Synthetic user: &lt;test-user&gt;',
  },
  {
    file: 'signup-alternative.eml',
    title: 'Text + HTML verification link',
    subject: 'signup-smoke-alternative',
    result: 'The HTML alternative supplies the displayed body. The HTTPS link is rewritten through the destination-check page.',
    otp: '418229',
    html: '<p>Verification code: 418229</p>\n<p><a href="/r?u=https%3A%2F%2Fexample.com%2Fverify%3Ftoken%3DTEST_ONLY" rel="noopener noreferrer nofollow">Verify your test account</a></p>\n',
    preview: 'Verification code: 418229 Verify your test account',
  },
  {
    file: 'signup-rendering-limits.eml',
    title: 'Rendering limits + attachment',
    subject: 'signup-smoke-rendering',
    result: 'The code and basic text survive. Image, style, script and form content are removed. The attachment is absent from the stored message and HTTP response.',
    otp: '418229',
    html: '\n<p>Verification code: <strong>418229</strong></p>\n\n\n\n<p>Read this without images.</p>\n',
    preview: 'Verification code: 418229 Read this without images.',
  },
];

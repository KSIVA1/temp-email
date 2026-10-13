export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'www.inboxfornow.com') {
      url.hostname = 'inboxfornow.com';
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }
    const response = await env.ASSETS.fetch(request);
    const emailFixture = response.status === 200 && /^\/fixtures\/email-qa\/[^/]+\.eml$/.test(url.pathname);
    // Pages preview hosts and transient utility pages should not appear in Search.
    // Advanced-mode Pages workers must set these headers themselves.
    if (emailFixture || url.hostname.endsWith('.pages.dev') || /^\/r\/?$/.test(url.pathname) ||
        /^\/404(?:\.html|\/)?$/.test(url.pathname) || response.status === 404) {
      const result = new Response(response.body, response);
      result.headers.set('X-Robots-Tag', 'noindex, follow');
      if (emailFixture) {
        result.headers.set('Content-Type', 'message/rfc822');
        result.headers.set('Content-Disposition', 'attachment');
      }
      return result;
    }
    return response;
  }
};

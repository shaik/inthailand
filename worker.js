export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const originURL = `https://shaik.github.io/inthailand${url.pathname}${url.search}`;
    const originResponse = await fetch(new Request(originURL, request));

    // Pass assets through unchanged
    const contentType = originResponse.headers.get('Content-Type') ?? '';
    if (!contentType.startsWith('text/html')) {
      return originResponse;
    }

    // Validate country code — accept only exactly two uppercase ASCII letters
    // (rejects "T1" for Tor, undefined, null, etc.)
    const rawCountry = request.cf?.country;
    const country = (typeof rawCountry === 'string' && /^[A-Z]{2}$/.test(rawCountry))
      ? rawCountry : null;

    // Prevent edge-caching of country-specific HTML
    const responseHeaders = new Headers(originResponse.headers);
    responseHeaders.set('Cache-Control', 'no-store');

    if (!country) {
      return new Response(originResponse.body, {
        status: originResponse.status,
        headers: responseHeaders,
      });
    }

    return new HTMLRewriter()
      .on('body', {
        element(el) {
          el.setAttribute('data-geo-country', country);
        },
      })
      .transform(new Response(originResponse.body, {
        status: originResponse.status,
        headers: responseHeaders,
      }));
  },
};

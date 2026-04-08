#!/usr/bin/env node
/**
 * OG / WhatsApp link preview diagnostic for amiinthailand.com
 * Run: node test-og.js
 */

const https = require('https');
const http  = require('http');

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};
const pass    = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail    = (m) => console.log(`  \x1b[31m✗\x1b[0m \x1b[31m${m}\x1b[0m`);
const warn    = (m) => console.log(`  \x1b[33m⚠\x1b[0m ${m}`);
const info    = (m) => console.log(`  \x1b[36m·\x1b[0m ${m}`);
const section = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`);
const kv      = (k, v) => console.log(`    \x1b[2m${k}:\x1b[0m ${v}`);

const checks = { passed: 0, failed: 0, warned: 0 };
function check(label, ok, { warnOnly = false, detail = '' } = {}) {
  const msg = label + (detail ? `  (${detail})` : '');
  if (ok) { checks.passed++; pass(msg); }
  else if (warnOnly) { checks.warned++; warn(msg); }
  else { checks.failed++; fail(msg); }
  return ok;
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────

function req(url, { ua = 'node-og-test/1.0', method = 'GET', followRedirects = false } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    lib.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers: { 'User-Agent': ua },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (followRedirects && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          resolve(req(next, { ua, method, followRedirects }).then(r => {
            r.redirectedFrom = url;
            r.hops = (r.hops || 0) + 1;
            return r;
          }));
        } else {
          resolve({ status: res.statusCode, headers: res.headers, body, url });
        }
      });
    }).on('error', reject).end();
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function testHTMLPage() {
  section('── 1. HTML page OG tags  (default UA)');
  const r = await req('https://amiinthailand.com/');
  check('HTTP 200', r.status === 200, { detail: `got ${r.status}` });

  const tags = {
    'og:title':        r.body.match(/og:title[^>]+content="([^"]+)"/)?.[1],
    'og:description':  r.body.match(/og:description[^>]+content="([^"]+)"/)?.[1],
    'og:image':        r.body.match(/og:image"[^>]+content="([^"]+)"/)?.[1],
    'og:image:type':   r.body.match(/og:image:type[^>]+content="([^"]+)"/)?.[1],
    'og:image:width':  r.body.match(/og:image:width[^>]+content="([^"]+)"/)?.[1],
    'og:image:height': r.body.match(/og:image:height[^>]+content="([^"]+)"/)?.[1],
    'og:url':          r.body.match(/og:url[^>]+content="([^"]+)"/)?.[1],
    'twitter:card':    r.body.match(/twitter:card[^>]+content="([^"]+)"/)?.[1],
    'twitter:image':   r.body.match(/twitter:image[^>]+content="([^"]+)"/)?.[1],
  };

  for (const [k, v] of Object.entries(tags)) {
    check(`${k}  →  "${v}"`, !!v, { detail: 'missing' });
  }

  check('og:image is JPEG', tags['og:image']?.endsWith('.jpg'), {
    detail: tags['og:image'], warnOnly: true,
  });
  check('og:image:width = 1200', tags['og:image:width'] === '1200');
  check('og:image:height = 630', tags['og:image:height'] === '630');

  info(`Cache-Control: ${r.headers['cache-control']}`);
  check('HTML Cache-Control: no-store  (prevents edge caching of country-specific page)',
    r.headers['cache-control'] === 'no-store');
  info(`CF-Cache-Status: ${r.headers['cf-cache-status'] ?? '—'}`);
}

async function testHTMLAsBots() {
  section('── 2. HTML page as WhatsApp / Facebook crawlers');

  const bots = [
    { name: 'WhatsApp',              ua: 'WhatsApp/2.23.20.0 A' },
    { name: 'facebookexternalhit',   ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' },
    { name: 'Facebot',               ua: 'Facebot' },
  ];

  for (const bot of bots) {
    let r;
    try {
      r = await req('https://amiinthailand.com/', { ua: bot.ua });
    } catch (e) {
      checks.failed++; fail(`${bot.name}: request failed — ${e.message}`);
      continue;
    }

    const blocked = r.status !== 200 ||
      r.body.includes('cf-chl-widget') ||
      r.body.includes('challenge-platform') ||
      r.body.includes('_cf_chl');
    check(`${bot.name}  →  HTTP ${r.status}  (not blocked by Bot Fight Mode)`,
      r.status === 200 && !blocked,
      { detail: blocked ? 'Cloudflare challenge detected!' : `HTTP ${r.status}` });

    const hasOgImage = r.body.includes('og:image');
    check(`  ${bot.name}  →  og:image present in response`, hasOgImage,
      { detail: 'bot may be receiving challenge page without OG tags' });

    const cacheStatus = r.headers['cf-cache-status'] ?? '—';
    info(`  ${bot.name}  Cache-Control: ${r.headers['cache-control']}  CF-Cache: ${cacheStatus}`);
  }
}

async function testImage() {
  section('── 3. og-image.jpg availability and headers');

  const imageUrl = 'https://amiinthailand.com/og-image.jpg';
  const r = await req(imageUrl);

  check('HTTP 200', r.status === 200, { detail: `got ${r.status}` });

  const ct = r.headers['content-type'] ?? '';
  check(`Content-Type: ${ct}`, ct.startsWith('image/jpeg'), {
    detail: 'expected image/jpeg',
  });

  const sizeBytes = Buffer.byteLength(r.body, 'binary');
  const sizeKB    = Math.round(r.body.length / 1024);
  check(`File size: ${sizeKB}KB  (WhatsApp limit ~300KB)`, sizeKB < 300, {
    detail: `${sizeKB}KB`,
  });

  const cc = r.headers['cache-control'] ?? '—';
  const cfCache = r.headers['cf-cache-status'] ?? '—';
  info(`Cache-Control:   ${cc}`);
  info(`CF-Cache-Status: ${cfCache}`);
  check('Image is cacheable (not no-store)', !cc.includes('no-store'), {
    detail: cc,
  });
  check('max-age > 0  (WhatsApp crawler can cache image)', !cc.includes('max-age=0'), {
    detail: `max-age=0 forces revalidation on every crawler hit`,
    warnOnly: true,
  });

  const cl = r.headers['content-length'];
  info(`Content-Length:  ${cl ? cl + ' bytes' : '(chunked)'}`);

  // Check as bots
  console.log('\n  Testing image fetch as WhatsApp/Facebook crawlers:');
  const bots = [
    { name: 'WhatsApp',            ua: 'WhatsApp/2.23.20.0 A' },
    { name: 'facebookexternalhit', ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' },
  ];
  for (const bot of bots) {
    const br = await req(imageUrl, { ua: bot.ua });
    const botCt = br.headers['content-type'] ?? '—';
    check(`  ${bot.name}  →  HTTP ${br.status}  Content-Type: ${botCt}`,
      br.status === 200 && botCt.startsWith('image/'));
  }

  console.log('\n  All image response headers:');
  for (const [k, v] of Object.entries(r.headers)) kv(k, v);
}

async function testImageRedirects() {
  section('── 4. Image redirect chain');
  const r = await req('https://amiinthailand.com/og-image.jpg', { followRedirects: true });
  if (r.hops > 0) {
    warn(`Image followed ${r.hops} redirect(s). Each redirect costs crawler budget.`);
    info(`Final URL: ${r.url}`);
  } else {
    check('No redirects on image URL (direct 200)', r.status === 200);
  }
  // Also test HTTP → HTTPS redirect
  const rHttp = await req('http://amiinthailand.com/og-image.jpg', { followRedirects: false });
  info(`http://... og-image.jpg → HTTP ${rHttp.status}  Location: ${rHttp.headers.location ?? '(none)'}`);
}

async function testShareMechanism() {
  section('── 5. Share mechanism audit');

  // Read index.html and check how navigator.share is called
  const r = await req('https://amiinthailand.com/');
  const shareCall = r.body.match(/navigator\.share\(\{[^}]+\}\)/)?.[0] ?? '';

  info(`navigator.share call found: ${shareCall || '(not found)'}`);

  const hasUrlParam = shareCall.includes('url:');
  const urlOnlyInText = !hasUrlParam && shareCall.includes('text:');

  if (hasUrlParam) {
    check('navigator.share passes url: as separate parameter  ✓', true);
  } else if (urlOnlyInText) {
    check(
      'navigator.share passes URL only in text: field — WhatsApp may not show image',
      false,
      { detail: 'Fix: split into { text: message, url: url } so WhatsApp generates rich preview' }
    );
  } else {
    warn('Could not parse navigator.share call from HTML');
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n\x1b[1mamiinthailand.com — OG / WhatsApp Preview Diagnostics\x1b[0m`);
  console.log(`\x1b[2m${new Date().toISOString()}\x1b[0m`);

  await testHTMLPage();
  await testHTMLAsBots();
  await testImage();
  await testImageRedirects();
  await testShareMechanism();

  section('── Summary');
  console.log(`  \x1b[32mPassed:\x1b[0m  ${checks.passed}`);
  if (checks.warned) console.log(`  \x1b[33mWarned:\x1b[0m  ${checks.warned}`);
  if (checks.failed) console.log(`  \x1b[31mFailed:\x1b[0m  ${checks.failed}`);
  console.log(`  Total:   ${checks.passed + checks.failed + checks.warned}\n`);

  if (checks.failed > 0) process.exit(1);
}

main().catch(e => { console.error('\x1b[31mFatal:\x1b[0m', e.message); process.exit(1); });

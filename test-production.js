#!/usr/bin/env node
/**
 * Production diagnostic script for amiinthailand.com
 * Run: node test-production.js
 */

const https = require('https');
const http  = require('http');
const url   = require('url');

// ─── Terminal colours ────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
};

const pass = (msg)    => console.log(`  ${C.green}✓${C.reset} ${msg}`);
const fail = (msg)    => console.log(`  ${C.red}✗${C.reset} ${C.red}${msg}${C.reset}`);
const warn = (msg)    => console.log(`  ${C.yellow}⚠${C.reset} ${msg}`);
const info = (msg)    => console.log(`  ${C.cyan}·${C.reset} ${msg}`);
const section = (msg) => console.log(`\n${C.bold}${msg}${C.reset}`);
const kv = (k, v)    => console.log(`    ${C.dim}${k}:${C.reset} ${v}`);

// ─── HTTP helpers ────────────────────────────────────────────────────────────

/** Single request, no redirect following. Returns { status, headers, body }. */
function request(rawUrl, { method = 'GET', timeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(rawUrl);
    const lib     = parsed.protocol === 'https:' ? https : http;
    const req     = lib.request({
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method,
      headers:  { 'User-Agent': 'amiinthailand-test/1.0' },
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end',  ()    => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => req.destroy(new Error('Timeout after ' + timeout + 'ms')));
    req.end();
  });
}

/** Follow redirects manually; returns all hops + final response. */
async function fetch(rawUrl, maxRedirects = 8) {
  const hops = [];
  let current = rawUrl;

  for (let i = 0; i <= maxRedirects; i++) {
    const res = await request(current);
    hops.push({ url: current, status: res.status, location: res.headers.location, headers: res.headers });

    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      const next = res.headers.location;
      current    = next.startsWith('http') ? next : new URL(next, current).href;
    } else {
      return { hops, final: res };
    }
  }

  return { hops, final: null, tooManyRedirects: true };
}

// ─── Check helpers ───────────────────────────────────────────────────────────

const checks = { passed: 0, failed: 0, warned: 0 };

function check(label, condition, { failMsg, warnOnly = false } = {}) {
  if (condition) {
    checks.passed++;
    pass(label);
  } else if (warnOnly) {
    checks.warned++;
    warn(failMsg || label);
  } else {
    checks.failed++;
    fail(failMsg || label);
  }
  return condition;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

async function testMainPage() {
  section('── 1. Main page  https://amiinthailand.com/');

  let res;
  try {
    res = await request('https://amiinthailand.com/');
  } catch (e) {
    checks.failed++;
    fail(`Request failed: ${e.message}`);
    return;
  }

  // Status
  check('HTTP 200', res.status === 200, { failMsg: `HTTP ${res.status} (expected 200)` });

  // Cloudflare proxy
  const cfRay = res.headers['cf-ray'];
  check(`Cloudflare proxying  CF-Ray: ${cfRay ?? 'MISSING'}`, !!cfRay, {
    failMsg: 'CF-Ray header absent — Cloudflare is NOT proxying (DNS may be grey-cloud)',
  });
  check('Server: cloudflare', res.headers['server'] === 'cloudflare', {
    failMsg: `Server: ${res.headers['server']} (expected cloudflare)`,
  });

  // Worker active
  const cc = res.headers['cache-control'];
  check(`Cache-Control: no-store  (Worker is active)`, cc === 'no-store', {
    failMsg: `Cache-Control: ${cc}  ← Worker may not be running (expected no-store)`,
  });

  // data-geo-country injection
  const geoMatch = res.body.match(/data-geo-country="([^"]*)"/);
  if (geoMatch) {
    const code = geoMatch[1];
    check(`data-geo-country="${code}" injected`, /^[A-Z]{2}$/.test(code), {
      failMsg: `data-geo-country="${code}" — not a valid ISO 3166-1 alpha-2 code`,
    });
  } else {
    checks.failed++;
    fail('data-geo-country attribute missing from <body>');
  }

  // OG / social meta
  const ogTitle = res.body.match(/og:title[^>]*content="([^"]*)"/);
  const ogImage = res.body.match(/og:image[^>]*content="([^"]*)"/);
  const ogUrl   = res.body.match(/og:url[^>]*content="([^"]*)"/);
  const twCard  = res.body.match(/twitter:card[^>]*content="([^"]*)"/);
  const twImg   = res.body.match(/twitter:image[^>]*content="([^"]*)"/);

  check(`og:title  "${ogTitle?.[1]}"`,   !!ogTitle, { failMsg: 'og:title missing' });
  check(`og:image  ${ogImage?.[1]}`,     ogImage?.[1]?.startsWith('https://amiinthailand.com'), {
    failMsg: `og:image: ${ogImage?.[1] ?? 'MISSING'}  (should start with https://amiinthailand.com)`,
  });
  check(`og:url    ${ogUrl?.[1]}`,       ogUrl?.[1]?.startsWith('https://amiinthailand.com'), {
    failMsg: `og:url: ${ogUrl?.[1] ?? 'MISSING'}  (should start with https://amiinthailand.com)`,
  });
  check(`twitter:card  ${twCard?.[1]}`,  !!twCard, { failMsg: 'twitter:card missing' });
  check(`twitter:image ${twImg?.[1]}`,   twImg?.[1]?.startsWith('https://amiinthailand.com'), {
    failMsg: `twitter:image: ${twImg?.[1] ?? 'MISSING'}  (should start with https://amiinthailand.com)`,
  });

  // Favicons
  const favicon   = res.body.match(/rel="icon"[^>]*href="([^"]*)"/);
  const touchIcon = res.body.match(/rel="apple-touch-icon"[^>]*href="([^"]*)"/);
  check(`<link rel="icon">  ${favicon?.[1]}`,          !!favicon,   { failMsg: 'favicon <link> missing' });
  check(`<link rel="apple-touch-icon">  ${touchIcon?.[1]}`, !!touchIcon, { failMsg: 'apple-touch-icon <link> missing' });

  // GA
  const ga = res.body.match(/G-[A-Z0-9]+/);
  check(`Google Analytics ID  ${ga?.[0]}`, !!ga, { failMsg: 'GA measurement ID not found', warnOnly: true });

  // Full headers dump
  console.log(`\n  ${C.dim}All response headers:${C.reset}`);
  for (const [k, v] of Object.entries(res.headers)) kv(k, v);
}

async function testAssets() {
  section('── 2. Static assets');

  const assets = [
    { path: '/favicon.png',         expectedType: 'image/png' },
    { path: '/apple-touch-icon.png', expectedType: 'image/png' },
    { path: '/og-image.png',        expectedType: 'image/png' },
  ];

  for (const { path, expectedType } of assets) {
    const assetUrl = `https://amiinthailand.com${path}`;
    let res;
    try {
      res = await request(assetUrl);
    } catch (e) {
      checks.failed++;
      fail(`${path}  →  ${e.message}`);
      continue;
    }

    check(`${path}  →  HTTP ${res.status}`, res.status === 200, {
      failMsg: `${path}  →  HTTP ${res.status}  (expected 200)`,
    });

    const ct      = res.headers['content-type'] ?? '';
    const cc      = res.headers['cache-control'] ?? '(none)';
    const cfCache = res.headers['cf-cache-status'] ?? '(none)';
    const clength = res.headers['content-length'] ? `${Math.round(+res.headers['content-length'] / 1024)}KB` : '(chunked)';

    check(`  Content-Type contains ${expectedType}`, ct.includes(expectedType), {
      failMsg: `  Content-Type: ${ct}  (expected to include ${expectedType})`,
    });
    check('  Asset is NOT cache: no-store  (cacheable)', cc !== 'no-store', {
      failMsg: `  Cache-Control: ${cc}  (assets should be cacheable, not no-store)`,
      warnOnly: true,
    });

    info(`  Cache-Control:    ${cc}`);
    info(`  CF-Cache-Status:  ${cfCache}`);
    info(`  Size:             ${clength}`);
  }
}

async function testRedirects() {
  section('── 3. Redirect behaviour');

  // HTTP → HTTPS
  console.log(`\n  ${C.dim}http://amiinthailand.com/ → ...${C.reset}`);
  try {
    const result = await fetch('http://amiinthailand.com/');

    result.hops.forEach((hop, i) => {
      const arrow = i === result.hops.length - 1 ? '↳' : '→';
      info(`${arrow} [${hop.status}] ${hop.url}${hop.location ? `  →  ${hop.location}` : ''}`);
    });

    if (result.tooManyRedirects) {
      checks.failed++;
      fail('Too many redirects — redirect loop detected!');
    } else {
      check('HTTP resolves to 200 without looping', result.final.status === 200, {
        failMsg: `Final status: ${result.final?.status ?? 'none'}`,
      });
      const landedHttps = result.hops.some(h => h.url.startsWith('https://amiinthailand.com'));
      check('Redirects to HTTPS', landedHttps, {
        failMsg: 'Did not redirect through https://amiinthailand.com',
        warnOnly: true,
      });
    }
  } catch (e) {
    checks.failed++;
    fail(`HTTP redirect check failed: ${e.message}`);
  }

  // www subdomain
  console.log(`\n  ${C.dim}https://www.amiinthailand.com/ → ...${C.reset}`);
  try {
    const result = await fetch('https://www.amiinthailand.com/');
    result.hops.forEach((hop, i) => {
      const arrow = i === result.hops.length - 1 ? '↳' : '→';
      info(`${arrow} [${hop.status}] ${hop.url}${hop.location ? `  →  ${hop.location}` : ''}`);
    });

    if (result.tooManyRedirects) {
      checks.failed++;
      fail('Too many redirects on www — loop detected!');
    } else {
      check(`www resolves to ${result.final?.status}`, result.final?.status === 200, {
        failMsg: `www → final status ${result.final?.status}`,
        warnOnly: true,
      });
    }
  } catch (e) {
    warn(`www check failed: ${e.message}`);
  }
}

async function testWorkerEdgeCases() {
  section('── 4. Worker edge cases');

  // Missing asset → 404 (not a redirect loop)
  try {
    const res = await request('https://amiinthailand.com/does-not-exist-xyz.html');
    check(`Non-existent path → HTTP ${res.status}  (not a loop)`, res.status === 404 || res.status === 200, {
      failMsg: `Got HTTP ${res.status} for missing path`,
      warnOnly: true,
    });
    info(`  CF-Ray on 404: ${res.headers['cf-ray'] ?? 'none'}`);
  } catch (e) {
    warn(`404 check failed: ${e.message}`);
  }

  // HEAD request (should work without body)
  try {
    const res = await request('https://amiinthailand.com/', { method: 'HEAD' });
    check(`HEAD request → HTTP ${res.status}`, res.status === 200, {
      failMsg: `HEAD → ${res.status}`,
      warnOnly: true,
    });
  } catch (e) {
    warn(`HEAD check failed: ${e.message}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${C.bold}amiinthailand.com — Production Diagnostics${C.reset}`);
  console.log(`${C.dim}${new Date().toISOString()}${C.reset}`);

  await testMainPage();
  await testAssets();
  await testRedirects();
  await testWorkerEdgeCases();

  // Summary
  section('── Summary');
  const total = checks.passed + checks.failed + checks.warned;
  console.log(`  ${C.green}Passed:${C.reset}  ${checks.passed}`);
  if (checks.warned)  console.log(`  ${C.yellow}Warned:${C.reset}  ${checks.warned}`);
  if (checks.failed)  console.log(`  ${C.red}Failed:${C.reset}  ${checks.failed}`);
  console.log(`  Total:   ${total}\n`);

  if (checks.failed > 0) process.exit(1);
}

main().catch(err => {
  console.error(`\n${C.red}Fatal:${C.reset}`, err.message);
  process.exit(1);
});

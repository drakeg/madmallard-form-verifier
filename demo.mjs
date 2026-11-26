import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { parse } from 'node:querystring';

const page = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | Mad Mallard Form Verifier</title>
<style>
:root{color-scheme:light;--ink:#102f35;--muted:#455e64;--line:#ccd8d8;--accent:#116258}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:#f2f6f4;color:var(--ink);font:1rem/1.55 system-ui,sans-serif}
a{color:#0b594e;text-underline-offset:.2em}
:focus-visible{outline:3px solid #2861a2;outline-offset:3px}
header{background:#102f35;color:#fff;border-bottom:4px solid #8bd0b6}
header a{display:inline-block;color:inherit;font-weight:750;text-decoration:none;padding-block:.9rem}
header a:focus-visible{outline-color:#fff;outline-offset:-3px}
.wrap{width:min(100% - 2rem,68rem);margin-inline:auto}
main{padding-block:clamp(2rem,6vw,4.5rem)}
h1,h2,p{margin:0}
h1{font:700 clamp(2.45rem,6vw,4.5rem)/1.04 Georgia,serif;letter-spacing:-.04em}
h2{font-size:1.25rem;line-height:1.25}
.intro{margin:.85rem 0 1.8rem;color:var(--muted);max-width:56ch}
.panels{display:grid;gap:1rem;align-items:start}
@media(min-width:48rem){.panels{grid-template-columns:1.25fr 1fr;gap:1.5rem}}
.panel{background:#fff;border:1px solid var(--line);border-radius:1rem;padding:clamp(1.1rem,3vw,1.85rem);min-width:0}
.panel p{margin-top:.5rem;color:var(--muted)}
label{display:block;font-weight:650;margin-top:1rem}
input,select,button,.button{font:inherit;border-radius:.45rem;min-height:44px}
input,select{width:100%;display:block;margin-top:.3rem;padding:.63rem .75rem;border:1px solid #748c90;background:#fff;color:var(--ink)}
input[name=id],code{font-family:ui-monospace,monospace}
code{overflow-wrap:anywhere}
button,.button{display:inline-flex;align-items:center;justify-content:center;padding:.67rem 1rem;margin-top:1.15rem;cursor:pointer;background:var(--accent);color:#fff;border:1px solid var(--accent);font-weight:675;text-decoration:none}
button:hover,.button:hover{background:#0b4e45;color:#fff}
.secondary button{background:#fff;color:#0b594e}
.secondary button:hover{background:#e2f2eb}
.result{margin-top:1.5rem;max-width:39rem}
.status{display:inline-block;border-radius:.3rem;padding:.2rem .55rem;font-weight:700;background:#e3edf7;color:#23496f}
.confirmed{background:#dbf2e6;color:#134c37}
.unverified{background:#fff0d7;color:#69420a}
</style>
</head>
<body>
<header><div class="wrap"><a href="/">Mad Mallard Form Verifier</a></div></header>
<main class="wrap"><h1>${title}</h1>${body}</main>
</body>
</html>`;

const form = id => page('Quote form demo', `
<p class="intro">Send a synthetic quote request, then check whether its test ID reached the demo receipt store.</p>
<div class="panels">
<section class="panel" aria-labelledby="submission-heading">
  <h2 id="submission-heading">Send a test request</h2>
  <form method="post" action="/submit">
    <label for="test-id">Test ID</label>
    <input id="test-id" name="id" required pattern="[a-f0-9\\-]{36}" value="${id}" spellcheck="false" autocomplete="off">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" required value="synthetic@example.invalid">
    <label for="mode">Delivery simulation</label>
    <select id="mode" name="mode"><option value="deliver">Record receipt</option><option value="drop">Suppress receipt</option></select>
    <button>Request quote</button>
  </form>
</section>
<section class="panel secondary" aria-labelledby="lookup-heading">
  <h2 id="lookup-heading">Verify delivery</h2>
  <p>Enter the test ID from a submitted request to check for a matching receipt.</p>
  <form method="get" action="/receipt">
    <label for="receipt-id">Look up test ID</label>
    <input id="receipt-id" name="id" required spellcheck="false" autocomplete="off">
    <button>Check receipt</button>
  </form>
</section>
</div>`);

const result = (title, status, kind, details, action = '<a class="button" href="/">Back to demo</a>') =>
  page(title, `<section class="panel result"><span class="status ${kind}">${status}</span>${details}${action}</section>`);

const validId = /^[a-f0-9-]{36}$/;

export function createDemo() {
  const receipts = new Map();
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://demo.invalid');
    const send = (status, html) => res.writeHead(status, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'}).end(html);
    if (req.method === 'GET' && url.pathname === '/') return send(200, form(randomUUID()));
    if (req.method === 'GET' && url.pathname === '/receipt') {
      const id = url.searchParams.get('id');
      if (receipts.has(id)) return send(200, result('Receipt found', 'Delivery confirmed', 'confirmed', `<p>The demo receipt store contains test ID <code>${id}</code>.</p>`));
      return send(404, result('Receipt missing', 'Delivery unverified', 'unverified', '<p>The demo receipt store has no matching test ID.</p>'));
    }
    if (req.method !== 'POST' || url.pathname !== '/submit') return send(404, page('Page unavailable', ''));
    let body = '';
    for await (const chunk of req) {
      body += chunk.toString();
      if (body.length > 2048) return send(413, page('Request too large', ''));
    }
    const { id, email, mode } = parse(body);
    if (typeof id !== 'string' || !validId.test(id) || email !== 'synthetic@example.invalid' || !['deliver', 'drop'].includes(mode)) {
      return send(400, page('Invalid synthetic inquiry', ''));
    }
    if (mode === 'deliver') {
      if (receipts.size >= 1000) receipts.delete(receipts.keys().next().value);
      receipts.set(id, true);
    }
    return send(200, result('Thank you', 'Submission accepted', '',
      `<p>Your test ID is <code>${id}</code>. Check for a matching receipt to verify delivery.</p>`,
      `<a class="button" href="/receipt?id=${id}">Check this receipt</a> <a href="/">Back to demo</a>`));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createDemo().listen(Number(process.env.PORT || 8098), process.env.HOST || '127.0.0.1');
}

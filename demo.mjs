import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { parse } from 'node:querystring';

const page = (title, body) => `<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>
body{margin:0;background:#eef3f1;color:#182d28;font:1rem/1.5 system-ui}
main{box-sizing:border-box;width:min(100%,40rem);margin:2rem auto;padding:1.5rem;background:white;border-radius:1rem}
label,input,select,button{display:block} input,select,button{box-sizing:border-box;width:100%;padding:.7rem;font:inherit;margin:.3rem 0 1rem}
button{background:#145544;color:white;border:0;border-radius:.4rem;cursor:pointer}
</style><main><h1>${title}</h1>${body}</main></html>`;
const form = id => page('Quote form demo', `<p>Copy the prefilled test ID before submitting. All receipts stay in this demo.</p>
<form method="post" action="/submit">
<label>Test ID <input name="id" required pattern="[a-f0-9\\-]{36}" value="${id}"></label>
<label>Email <input name="email" type="email" required value="synthetic@example.invalid"></label>
<label>Delivery simulation <select name="mode"><option value="deliver">Record receipt</option><option value="drop">Suppress receipt</option></select></label>
<button>Request quote</button></form>
<form method="get" action="/receipt"><label>Look up test ID <input name="id" required></label><button>Check receipt</button></form>`);
const validId = /^[a-f0-9-]{36}$/;

export function createDemo() {
  const receipts = new Map();
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://demo.invalid');
    const send = (status, html) => res.writeHead(status, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'}).end(html);
    if (req.method === 'GET' && url.pathname === '/') return send(200, form(randomUUID()));
    if (req.method === 'GET' && url.pathname === '/receipt') {
      const id = url.searchParams.get('id');
      if (receipts.has(id)) return send(200, page('Receipt found', `<p>Test ID <code>${id}</code></p><p><a href="/">Back to demo</a></p>`));
      return send(404, page('Receipt missing', '<p>Delivery remains unverified.</p><p><a href="/">Back to demo</a></p>'));
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
    return send(200, page('Thank you', '<p>Your quote request was accepted.</p><p><a href="/">Back to demo</a></p>'));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createDemo().listen(Number(process.env.PORT || 8098), process.env.HOST || '127.0.0.1');
}

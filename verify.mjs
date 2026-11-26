import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, devices } from 'playwright';
import { createDemo } from './demo.mjs';

const evidence = new URL('./evidence/', import.meta.url);
await mkdir(evidence, {recursive: true});
const server = createDemo().listen(0, '127.0.0.1');
let browser;
try {
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH});
  const rows = [];
  const layout = await browser.newPage();
  try {
    for (const width of [390, 768, 1024, 1440]) {
      await layout.setViewportSize({width, height: 900});
      await layout.goto(base);
      assert.equal(await layout.evaluate(() => document.documentElement.scrollWidth), width);
      await layout.keyboard.press('Tab');
      assert.equal(await layout.locator('header a').evaluate(link => link.matches(':focus-visible')), true);
      await layout.keyboard.press('Tab');
      assert.equal(await layout.locator('#test-id').evaluate(input => input.matches(':focus-visible')), true);
    }
  } finally {
    await layout.close();
  }
  for (const [name, mode, profile] of [
    ['desktop', 'deliver', {viewport: {width: 1280, height: 800}}],
    ['mobile', 'drop', devices['Pixel 7']],
    ['invalid', null, {}],
  ]) {
    const id = randomUUID();
    const context = await browser.newContext(profile);
    try {
      const page = await context.newPage();
      await page.goto(base);
      const input = page.getByLabel('Test ID', {exact: true});
      if (mode) {
        await input.fill(id);
        await page.getByLabel('Delivery simulation').selectOption(mode);
      } else {
        await input.clear();
      }
      const posts = [];
      page.on('request', request => {
        if (request.method() === 'POST') posts.push(request.url());
      });
      await page.getByRole('button', {name: 'Request quote'}).click();
      if (mode) {
        await page.getByRole('heading', {name: 'Thank you'}).waitFor();
        assert.deepEqual(posts, [base + '/submit']);
      } else {
        assert.equal(await input.evaluate(element => element.validity.valueMissing), true);
        assert.deepEqual(posts, []);
        assert.equal(page.url(), base + '/');
      }
      await page.screenshot({path: new URL(name + '.png', evidence).pathname});
      if (mode) {
        const receiptLink = page.getByRole('link', {name: 'Check this receipt'});
        assert.equal(await receiptLink.getAttribute('href'), '/receipt?id=' + id);
        const [response] = await Promise.all([
          page.waitForResponse(base + '/receipt?id=' + id),
          receiptLink.click(),
        ]);
        await page.getByText(mode === 'deliver' ? 'Delivery confirmed' : 'Delivery unverified', {exact: true}).waitFor();
        assert.equal(response.status(), mode === 'deliver' ? 200 : 404);
        if (mode === 'deliver') assert.equal(await page.locator('code').textContent(), id);
        await page.screenshot({path: new URL(name + '-receipt.png', evidence).pathname});
      }
      const receipt = mode === 'deliver' ? 'Confirmed in demo receipt store' : mode ? 'Unverified' : 'Not applicable';
      rows.push({
        name, id: mode ? id : '—',
        observation: mode ? 'Thank you shown' : 'Missing field blocked submission',
        receipt,
        images: mode ? [name + '.png', name + '-receipt.png'] : [name + '.png'],
      });
    } finally {
      await context.close();
    }
  }
  const note = 'The mobile case deliberately suppresses delivery. In a pilot, check routing, provider logs and CRM ingestion with the agency, then confirm the retest ID at the destination.';
  await writeFile(new URL('report.md', evidence), [
    '# Synthetic quote form verification',
    '', '| Case | Test ID | Browser evidence | Delivery | Screenshots |',
    '| --- | --- | --- | --- | --- |', ...rows.map(({name, id, observation, receipt, images}) =>
      `| ${name} | ${id} | ${observation} | ${receipt} | ${images.map((file, index) => `[${index ? 'Receipt' : 'Browser'}](${file})`).join(' · ')} |`), '',
    note,
    '',
  ].join('\n'));
  const sections = await Promise.all(rows.map(async ({name, id, observation, receipt, images}) => {
    const figures = await Promise.all(images.map(async (file, index) => {
      const caption = index ? 'Receipt lookup' : 'Browser result';
      const bytes = await readFile(new URL(file, evidence));
      return `<figure><img alt="${name} ${caption.toLowerCase()}" src="data:image/png;base64,${bytes.toString('base64')}"><figcaption>${caption}</figcaption></figure>`;
    }));
    return `<section><h2>${name}</h2><dl><dt>Test ID</dt><dd><code>${id}</code></dd><dt>Browser observation</dt><dd>${observation}</dd><dt>Delivery</dt><dd>${receipt}</dd></dl><div class="evidence">${figures.join('')}</div></section>`;
  }));
  const htmlReport = new URL('report.html', evidence);
  await writeFile(htmlReport, `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Synthetic quote form verification</title>
<style>
body{max-width:68rem;margin:2rem auto;padding:0 1rem;color:#102f35;font:1rem/1.5 system-ui,sans-serif}
h1,h2{font-family:Georgia,serif} h2{text-transform:capitalize}
section{border-top:1px solid #ccd8d8;margin:1.5rem 0;padding-top:.5rem}
dt{font-weight:700} dd{margin:0 0 .5rem;overflow-wrap:anywhere}
.evidence{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))}
figure{margin:0;break-inside:avoid} img{display:block;max-width:100%;max-height:25rem;border:1px solid #ccd8d8}
figcaption{margin-top:.3rem} @media print{body{margin:0;padding:0}section{break-inside:avoid}}
</style>
</head>
<body><main><h1>Synthetic quote form verification</h1>
<p>These results show delivery behavior in the demo receipt store.</p>
<p>Generated <time datetime="${new Date().toISOString()}">${new Date().toUTCString()}</time></p>
${sections.join('')}
<h2>Follow-up</h2><p>${note}</p>
</main></body></html>`);
  const reportPage = await browser.newPage();
  try {
    await reportPage.goto(htmlReport.href);
    assert.equal(await reportPage.locator('section').count(), 3);
    const decoded = await reportPage.locator('img').evaluateAll(images =>
      images.filter(image => image.complete && image.naturalWidth > 0).length);
    assert.equal(decoded, 5);
  } finally {
    await reportPage.close();
  }
  console.log('Passed desktop, mobile, and missing-field browser cases. See evidence/report.html or evidence/report.md.');
} finally {
  await browser?.close();
  server.close();
}

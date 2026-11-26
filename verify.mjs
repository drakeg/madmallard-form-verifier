import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
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
      rows.push(`| ${name} | ${mode ? id : '—'} | ${mode ? 'Thank you shown' : 'Missing field blocked submission'} | ${receipt} | [Browser](${name}.png)${mode ? ` · [Receipt](${name}-receipt.png)` : ''} |`);
    } finally {
      await context.close();
    }
  }
  await writeFile(new URL('report.md', evidence), [
    '# Synthetic quote form verification',
    '', '| Case | Test ID | Browser evidence | Delivery | Screenshots |',
    '| --- | --- | --- | --- | --- |', ...rows, '',
    'The mobile case deliberately suppresses delivery. In a pilot, check routing, provider logs and CRM ingestion with the agency, then confirm the retest ID at the destination.',
    '',
  ].join('\n'));
  console.log('Passed desktop, mobile, and missing-field browser cases. See evidence/report.md.');
} finally {
  await browser?.close();
  server.close();
}

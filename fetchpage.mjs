import { chromium } from 'playwright';
import fs from 'fs';

const url = process.argv[2];
const out = process.argv[3];
const headless = process.argv[4] !== 'headed';

const browser = await chromium.launch({
  channel: 'chrome',
  headless,
  args: [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
});
const ctx = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  viewport: { width: 1400, height: 1000 },
  locale: 'en-US',
  timezoneId: 'America/Denver',
});
await ctx.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  window.chrome = { runtime: {} };
});
const page = await ctx.newPage();
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(4000);
    const t = await page.title();
    if (!/just a moment|attention required|verify/i.test(t)) break;
    console.error('waiting... title=', t);
  }
  console.error('TITLE:', await page.title(), 'URL:', page.url());
  const text = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(out, text);
  console.error('WROTE', text.length, 'chars');
} catch (e) {
  console.error('ERR', e.message);
}
await browser.close();

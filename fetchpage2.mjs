import { chromium } from 'playwright';
import fs from 'fs';

const url = process.argv[2];
const out = process.argv[3];

const ctx = await chromium.launchPersistentContext('/tmp/pwprofile', {
  channel: 'chrome',
  headless: false,
  args: ['--disable-blink-features=AutomationControlled'],
  viewport: { width: 1400, height: 1000 },
  locale: 'en-US',
  timezoneId: 'America/Denver',
});
const page = ctx.pages()[0] || (await ctx.newPage());
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  for (let i = 0; i < 15; i++) {
    await page.mouse.move(200 + i * 20, 300 + i * 10);
    await page.waitForTimeout(3000);
    const t = await page.title();
    if (!/just a moment|attention required|verify/i.test(t)) break;
    // try clicking a turnstile checkbox if present
    try {
      const fr = page.frames().find((f) => /challenges\.cloudflare/.test(f.url()));
      if (fr) {
        const el = await fr.$('input[type=checkbox], .cb-lb, #challenge-stage');
        if (el) await el.click({ timeout: 2000 });
      }
    } catch {}
    console.error('waiting... title=', t);
  }
  console.error('TITLE:', await page.title(), 'URL:', page.url());
  const text = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(out, text);
  await page.screenshot({ path: out + '.png', fullPage: false });
  console.error('WROTE', text.length, 'chars');
} catch (e) {
  console.error('ERR', e.message);
}
await ctx.close();

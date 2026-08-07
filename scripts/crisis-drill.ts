// CRISIS DRILL — prove the escalation chain works on the REAL deployment, end to end.
//
// Logs in as a DEMO (.test) member through the real /login form and sends one message that trips detectCrisis.
// That should: (a) return the 988 response to the member, (b) write a crisis_flagged member_event, and
// (c) send one email to CRISIS_ALERT_EMAIL.
//
// Demo accounts only, enforced below. Never run this against a real member — the point is to exercise the
// machinery, not to put a real person's name on a crisis alert.
import { chromium } from 'playwright';

const base = (process.argv[2] || 'https://g4l-ten.vercel.app').replace(/\/$/, '');
const email = process.env.SMOKE_EMAIL?.trim();
const password = process.env.SMOKE_PASSWORD;
if (!email || !password) { console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD.'); process.exit(1); }
if (!/\.test$/i.test(email)) { console.error(`Refusing: ${email} is not a demo (.test) account.`); process.exit(1); }

const browser = await chromium.launch();
const page = await browser.newContext().then((c) => c.newPage());
try {
  console.log(`\nCRISIS DRILL → ${base}  (as ${email})\n`);
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const el = document.querySelector('button[type="submit"]');
    return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps$'));
  }, null, { timeout: 15000 });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => location.pathname.startsWith('/dashboard/'), null, { timeout: 20000 });
  console.log('  ✓ logged in');

  // The composer — the same box a member types into.
  const box = page.locator('textarea, input[type="text"]').first();
  await box.waitFor({ timeout: 15000 });
  await box.fill('I want to kill myself');
  await page.keyboard.press('Enter');
  console.log('  → sent a message that trips detectCrisis');

  await page.waitForFunction(() => /988/.test(document.body.innerText), null, { timeout: 30000 });
  const body = await page.locator('body').textContent();
  const got988 = /988/.test(body ?? '');
  const disclosed = /let Jay know/.test(body ?? '');
  console.log(`  ${got988 ? '✓' : '✗'} the member got the 988 line`);
  console.log(`  ${disclosed ? '✓' : '✗'} the escalation is disclosed to the member`);
  console.log(`\n${got988 && disclosed ? 'DRILL PASSED' : 'DRILL FAILED'} — check the inbox for the alert email.\n`);
  process.exitCode = got988 && disclosed ? 0 : 1;
} catch (e) {
  console.error('  ✗ drill error:', (e as Error).message);
  process.exitCode = 1;
} finally {
  await browser.close();
}

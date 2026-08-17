// TEACHING LAYER WALK — the in-Session teaching beats, proven on a real page.
//
// What this exists to catch, in priority order. Every one of these is invisible to the offline suite:
//
//   1. THE FRAME MUST BE INSIDE THE SCROLLER. `.chat` scrolls; `.ws-col-body` does not (globals.css:2090). Render
//      the frame one component too high and it becomes PINNED — permanently costing the conversation screen height,
//      which is the bug Jennifer hit on 2026-07-27 and the reason the panel was collapsed on 7/28. Jay's ruling
//      ("full summary, as long as it's not pinned and can scroll out of view") is only satisfiable from inside the
//      thread, and a DOM-containment assertion is the only thing that can prove it. This is the headline check.
//
//   2. IT MUST NOT LOOK LIKE THE COMPANION. Teaching cards and chat bubbles have to be visibly different, or the
//      app appears to be talking — which would put authored science in the Companion's mouth and break Greg's
//      posture spec for ten of twelve assets. Checked structurally (not a .bubble) and by width (bubbles cap at
//      85%; the card spans the column).
//
//   3. IT MUST SHOW THE FULL SUMMARY, not the short one — Jay's ruling, and the whole reason it moved.
//
// Demo-only, like the other walks: reads SMOKE_EMAIL / SMOKE_PASSWORD and refuses any non-.test account. The
// credentials are read from env and never printed.

import { chromium, type Page } from 'playwright';
import { ASSET_SUMMARIES } from '../lib/content/summaries.ts';

const base = process.argv[2]?.replace(/\/$/, '') ?? 'http://localhost:3100';
const email = process.env.SMOKE_EMAIL?.trim();
const password = process.env.SMOKE_PASSWORD;
if (!email || !password) { console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD.'); process.exit(2); }
if (!/\.test$/i.test(email)) { console.error(`Refusing: ${email} is not a demo (.test) account.`); process.exit(2); }

const fails: string[] = [];
const ok = (m: string) => console.log(`  ✓ ${m}`);
const bad = (m: string) => { fails.push(m); console.log(`  ✗ ${m}`); };
const finish = () => {
  console.log(fails.length ? `\n${fails.length} FAILED\n` : '\nall good\n');
  process.exit(fails.length ? 1 : 0);
};

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  console.log(`TEACHING LAYER WALK — ${base}`);

  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => {
      const el = document.querySelector('button[type="submit"]');
      return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps$'));
    },
    null,
    { timeout: 15000 },
  );
  await page.fill('#email', email!);
  await page.fill('#password', password!);
  await page.click('button[type="submit"]');
  const landed = await page
    .waitForFunction(() => location.pathname.startsWith('/dashboard/'), null, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  if (!landed) { bad('login did not reach a dashboard'); await browser.close(); return finish(); }
  const memberId = page.url().match(/[0-9a-f-]{36}/)?.[0];
  if (!memberId) { bad('could not resolve the member id'); await browser.close(); return finish(); }
  ok('logged in as the demo member');

  // W1 — the Disinformation Audit. The mockups' worked example, and a 1:1 asset session (not a gate).
  await page.goto(`${base}/workspace/${memberId}/w1`, { waitUntil: 'domcontentloaded' });
  const frame = page.locator('.teach-frame');
  const appeared = await frame.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false);
  if (!appeared) { bad('the Frame card never rendered on W1'); await browser.close(); return finish(); }
  ok('the Frame card renders on W1');

  // ---- 1 · INSIDE THE SCROLLER, NOT PINNED ----------------------------------------------------------------------
  const inChat = await frame.evaluate((el) => !!el.closest('.chat'));
  if (inChat) ok('the Frame is INSIDE .chat — it scrolls with the thread');
  else bad('the Frame is NOT inside .chat — it is pinned, which re-creates the 7/27 squeeze');

  const scrolls = await page.evaluate(() => {
    const chat = document.querySelector('.chat') as HTMLElement | null;
    if (!chat) return false;
    return getComputedStyle(chat).overflowY === 'auto' || getComputedStyle(chat).overflowY === 'scroll';
  });
  if (scrolls) ok('.chat is the scrolling element (so "scrolls out of view" is real)');
  else bad('.chat does not scroll — the frame cannot scroll away');

  // ---- 2 · IT DOES NOT LOOK LIKE THE COMPANION ------------------------------------------------------------------
  const isBubble = await frame.evaluate((el) => el.classList.contains('bubble'));
  if (!isBubble) ok('the Frame is not a .bubble');
  else bad('the Frame carries .bubble — it will read as the Companion speaking');

  const widths = await page.evaluate(() => {
    const card = document.querySelector('.teach-frame') as HTMLElement | null;
    const bubble = document.querySelector('.bubble') as HTMLElement | null;
    const chat = document.querySelector('.chat') as HTMLElement | null;
    if (!card || !chat) return null;
    return { card: card.getBoundingClientRect().width, bubble: bubble?.getBoundingClientRect().width ?? null, chat: chat.getBoundingClientRect().width };
  });
  if (widths && widths.card / widths.chat > 0.9) ok(`the Frame spans the column (${Math.round(widths.card)}px of ${Math.round(widths.chat)}px)`);
  else bad(`the Frame does not span the column — it will read as a bubble (${JSON.stringify(widths)})`);
  if (widths?.bubble && widths.card > widths.bubble) ok('the Frame is wider than a chat bubble');

  // ---- 3 · THE FULL SUMMARY, NOT THE SHORT ONE ------------------------------------------------------------------
  const body = (await page.locator('.teach-frame .teach-body').innerText()).trim();
  const w1 = ASSET_SUMMARIES.w1;
  if (body === w1.full.trim()) ok('the Frame shows the FULL summary (Jay, 2026-08-16)');
  else if (body === w1.short.trim()) bad('the Frame is showing the SHORT summary — the ruling was full');
  else bad(`the Frame body matches neither summary state:\n      got: ${body.slice(0, 120)}…`);

  // ---- 4 · THE EYEBROW AND THE CTA ------------------------------------------------------------------------------
  const eyebrow = (await page.locator('.teach-frame .teach-eyebrow').innerText()).trim();
  if (/why this matters/i.test(eyebrow)) ok(`the eyebrow names the card ("${eyebrow}")`);
  else bad(`unexpected eyebrow: "${eyebrow}"`);

  const cta = (await page.locator('.teach-frame .teach-cta').innerText()).trim();
  if (/clip in/i.test(cta)) ok(`the CTA is the established term ("${cta}")`);
  else bad(`unexpected CTA: "${cta}"`);

  await page.screenshot({ path: 'docs/screenshots/teaching-frame-w1.png', fullPage: false });
  ok('screenshot → docs/screenshots/teaching-frame-w1.png');

  await browser.close();
  finish();
}

void main();

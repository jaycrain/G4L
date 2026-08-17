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
import { exploreFor } from '../lib/content/explore.ts';

const base = process.argv[2]?.replace(/\/$/, '') ?? 'http://localhost:3100';
// Which Session to walk. Defaults to W1 (the mockups' worked example); pass b1 or c1 to prove the other two arcs
// carry the same beats. The three clients share a hook, but they are still three call sites — and the assertion
// that matters (the gate not stranding a member) is exactly what a copy-paste drift would break.
const SESSION = (process.argv[3] ?? 'w1').toLowerCase();
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
  console.log(`TEACHING LAYER WALK — ${SESSION.toUpperCase()} @ ${base}`);

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

  // Reset W1 so the walk is REPEATABLE. Without this the second run meets an already-closed session and silently
  // checks something different from the first — the kind of drift that makes a green walk stop meaning anything.
  const reset = await page.request.post(`${base}/dev/reset-session?session=${SESSION}`);
  if (reset.ok()) ok(`reset ${SESSION.toUpperCase()} to a clean start`);
  else bad(`could not reset ${SESSION.toUpperCase()} (${reset.status()}) — the run may not be comparable`);

  // W1 — the Disinformation Audit. The mockups' worked example, and a 1:1 asset session (not a gate).
  await page.goto(`${base}/workspace/${memberId}/${SESSION}`, { waitUntil: 'domcontentloaded' });
  const frame = page.locator('.teach-frame');
  const appeared = await frame.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false);
  if (!appeared) { bad(`the Frame card never rendered on ${SESSION.toUpperCase()}`); await browser.close(); return finish(); }
  ok(`the Frame card renders on ${SESSION.toUpperCase()}`);

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
  const w1 = ASSET_SUMMARIES[SESSION as keyof typeof ASSET_SUMMARIES]!;
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

  await page.screenshot({ path: `docs/screenshots/teaching-frame-${SESSION}.png`, fullPage: false });
  ok(`screenshot → teaching-frame-${SESSION}.png`);

  // ---- 5 · DRIVE THE SESSION TO ITS CLOSE, THEN CHECK THE UNDERSTAND BEAT ---------------------------------------
  // A real conversation, not a seeded state. The Understand card is the REQUIRED acknowledgment that gates the
  // hand-home, so the only verification worth having is the one that reaches it the way a member does.
  console.log(`  … driving ${SESSION.toUpperCase()} to its close (real turns)`);
  let turns = 0;
  // REPLIES ARE PER-ARC, and that is not cosmetic. The first version fed W1's disinformation answers ("I'm too
  // old to start over", "it's too late") into every Session. In C1 — a goal-REFINEMENT conversation — sixty turns
  // of repeated hopelessness read as escalating distress and the Companion routed to crisis support, which is the
  // right call on that input and made the walk look like a product failure.
  //
  // Worth recording from that dead end: the DETERMINISTIC gate is correctly scoped. detectCrisis() does NOT fire
  // on "it's too late" or "I'm too old to start over" — verified directly. It could not, without misreading W1's
  // own canonical disinformation statements as a crisis. The escalation was the model reading a whole
  // conversation, not a keyword tripping a wire.
  //
  // Each list also carries AFFIRMATIVES, because the coach arcs gate on propose→confirm and a driver that never
  // agrees to anything never reaches a close.
  const BY_ARC: Record<string, string[]> = {
    w: ["That I'll deal with it once work calms down.", 'I can start small this week, even on a bad day.',
        "There's more time than I admit — I just spend it elsewhere.", 'Yes, that one lands.', "That's right."],
    b: ['Feeling strong enough to keep up with my kids.', 'A short walk after dinner most days.',
        'Yes, that sounds right.', 'One more vegetable at dinner.', "That's it exactly."],
    c: ['Getting back on the bike on weekends.', 'That one still matters most to me.',
        'Yes, that captures it.', 'The others feel less urgent now.', "That's right — keep it."],
  };
  const REPLIES = BY_ARC[SESSION[0]!] ?? BY_ARC.w!;
  while (turns < 60) { // instruments run 12+ administered turns before their close
    if (await page.locator('.teach-understand').count()) break;
    // ADMINISTERED TURNS COME FIRST. B1 and B2 are instruments — a 1-7 scale, not free text — and their textarea
    // is present but DISABLED while a scale turn is up. Checking for the box before the chips made the driver sit
    // on a disabled field until it timed out. Ask what the turn is, not what the page happens to contain.
    const chips = page.locator('.scale-chip');
    const box = page.locator('.chat-input textarea');
    if (await chips.count()) {
      await chips.nth(3).click(); // a mid-scale answer; the content is irrelevant, reaching the close is the point
    } else if ((await box.count()) && (await box.isEnabled().catch(() => false))) {
      await box.fill(REPLIES[turns % REPLIES.length]!);
      await page.locator('.chat-input button[type="submit"]').click();
    } else {
      await page.waitForTimeout(1500);
    }
    await page.waitForFunction(() => !document.querySelector('.typing'), null, { timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(300);
    turns += 1;
  }

  const understand = page.locator('.teach-understand');
  if (!(await understand.count())) {
    bad(`the Understand card never appeared after ${turns} turns`);
    // Leave evidence rather than a bare failure — a stalled driver and a stalled ARC look identical from here.
    await page.screenshot({ path: `docs/screenshots/teaching-STUCK-${SESSION}.png`, fullPage: false });
    const tail = await page.locator('.bubble.agent').last().innerText().catch(() => '(none)');
    console.log(`      last Companion turn: ${tail.slice(0, 220)}`);
    await browser.close();
    return finish();
  }
  ok(`the Understand card appeared at the close (${turns} turns)`);

  const uInChat = await understand.evaluate((el) => !!el.closest('.chat'));
  if (uInChat) ok('the Understand card is inside .chat — it scrolls with the thread');
  else bad('the Understand card is not inside .chat');

  const pointCount = await page.locator('.teach-understand .teach-point').count();
  if (pointCount >= 4) ok(`all points shown inline — ${pointCount}, no disclosure`);
  else bad(`only ${pointCount} points rendered`);

  const anyDisclosure = await page.locator('.teach-understand details, .teach-understand [aria-expanded]').count();
  if (anyDisclosure === 0) ok('nothing is hidden behind an expander (Rev 1: show all)');
  else bad('the Understand card has a disclosure control — Rev 1 removed it');

  // THE GATE: Continue must not be reachable until the member acknowledges.
  const continueBefore = await page.locator('.chat-continue button').count();
  if (continueBefore === 0) ok('Continue → is gated until the science is acknowledged');
  else bad('Continue → is available BEFORE the acknowledgment — the beat is skippable');

  await page.screenshot({ path: `docs/screenshots/teaching-understand-${SESSION}.png`, fullPage: false });
  ok(`screenshot → teaching-understand-${SESSION}.png`);

  // THE GOODBYE MUST NOT PRECEDE THE SCIENCE (Jay, 2026-08-17, option 1). Before the fix the Companion said
  // "head back whenever you're ready" and the card appeared after it, reading as an afterthought.
  const goodbyeBefore = await page.locator('.bubble.agent', { hasText: 'Head back whenever' }).count();
  if (goodbyeBefore === 0) ok('the goodbye has NOT been said yet — the science comes first');
  else bad('the Companion said goodbye before the science — the card reads as an afterthought');

  await page.locator('.teach-understand .teach-cta').click();
  await page.waitForTimeout(500);
  const continueAfter = await page.locator('.chat-continue button').count();
  if (continueAfter === 1) ok('"Got it →" releases the hand-home');
  else bad('after acknowledging, Continue → still did not appear — the member is stranded');

  // ORDER, NOT EXISTENCE. The first version of this counted the bubble and passed while the goodbye still painted
  // ABOVE the card — appending it to `messages` could never move it below, because the card renders after every
  // message. Counting proved it existed, which was never the question. compareDocumentPosition is.
  const order = await page.evaluate(() => {
    const card = document.querySelector('.teach-understand');
    const bubbles = Array.from(document.querySelectorAll('.bubble.agent'));
    const bye = bubbles.find((b) => (b.textContent ?? '').includes('Head back whenever'));
    if (!card || !bye) return null;
    // Node.DOCUMENT_POSITION_FOLLOWING === 4 → `bye` comes after `card` in document order.
    return { after: !!(card.compareDocumentPosition(bye) & 4) };
  });
  if (order?.after) ok('the goodbye sits BELOW the card in the DOM — genuinely last');
  else bad(`the goodbye is not below the card (${JSON.stringify(order)}) — it still reads before the science`);

  await page.screenshot({ path: `docs/screenshots/teaching-close-${SESSION}.png`, fullPage: false });
  ok(`screenshot → teaching-close-${SESSION}.png`);

  // ---- 6 · ④ KEEP — THE PROMISE ON THE CARD MUST BE TRUE ---------------------------------------------------------
  // The card says "we'll keep the takeaway in your Playbook". That is a promise made to the member in their own
  // view, and this path has broken it before: on 2026-07-27 prod silently dropped EVERY session keeper and a member
  // completed six Sessions with nothing filed. So the walk goes and LOOKS.
  await page.waitForTimeout(1200); // the keep is fire-and-forget from the client
  await page.goto(`${base}/playbook/${memberId}`, { waitUntil: 'domcontentloaded' });
  // NB: each tab button contains its label AND a count span, so an anchored /^label$/ never matches the node text.
  await page.locator('.pb-tab').filter({ hasText: "What you've learned" }).first().click();
  await page.waitForTimeout(600);

  const lede = exploreFor(SESSION as Parameters<typeof exploreFor>[0])!.lede; // the default takeaway is the Explore lede
  const kptCount = await page.getByText(lede, { exact: false }).count();
  if (kptCount > 0) ok(`the takeaway is in the Playbook — the card told the truth ("${lede.slice(0, 44)}…")`);
  else bad('the takeaway is NOT in the Playbook — the card promised something we did not do');

  // ROUTING: it must be under "What you've learned" (Reads), never "What worked" (Moves).
  await page.locator('.pb-tab').filter({ hasText: 'What worked' }).first().click();
  await page.waitForTimeout(500);
  const wrongTab = await page.getByText(lede!, { exact: false }).count();
  if (wrongTab === 0) ok('it is NOT under "What worked" — Reads and Moves stayed separate');
  else bad('the science read leaked into "What worked" — the routing rule broke');

  await browser.close();
  finish();
}

void main();

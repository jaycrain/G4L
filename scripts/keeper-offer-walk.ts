// KEEPER-OFFER WALK — the one path no test reaches: arc turn → action → rendered offer → tap → Playbook entry.
//
// The offer replaced auto-capture on 2026-08-19 (Donna: her own housekeeping question was filed as her
// Visualization picture). Its pieces are covered — harvest returns proposals, keepProposal commits, the component
// renders in a dev preview — but nothing exercises them JOINED, through the real action, in a real browser. That
// is exactly the seam that has bitten us before: every half passing while nothing crossed between them.
//
// It also cannot be done by a node persona script, because the decision is a TAP in a client component. So this
// drives a browser: scripted login (same credentials path as smoke.ts, never typed by hand), a real W1 session,
// real Companion turns, then the offer and the Keep.
//
//   node --experimental-strip-types --env-file=.env.local scripts/keeper-offer-walk.ts [baseUrl]
//
// Demo accounts only, same gate as smoke: SMOKE_EMAIL must be a .test address.

import { chromium, type Page, type BrowserContext } from 'playwright';

const base = (process.argv[2] ?? 'http://localhost:3100').replace(/\/$/, '');
const email = process.env.SMOKE_EMAIL?.trim();
const password = process.env.SMOKE_PASSWORD;
if (!email || !password) { console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD.'); process.exit(2); }
if (!/\.test$/i.test(email)) { console.error(`Refusing: ${email} is not a demo (.test) account.`); process.exit(2); }

// W1 draws out five domains of "the lies", then asks for the true line that answers one. These are a member's
// side of that conversation — enough to reach the affirm beat, which is what produces the keeper.
const MEMBER_TURNS = [
  "It's just my age, that's what I tell myself.",
  'That a glass of wine in the evening is the only thing that unwinds me.',
  "That there's no room left for me — everyone else needs something.",
  "That I'm not that person anymore, not really.",
  "And that it's too late to start over at this point.",
];
const TRUE_LINE = 'My body answers when I ask it to — at any age.';

const log = (s: string) => console.log(s);

async function login(page: Page): Promise<string> {
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', email!);
  await page.fill('input[type=password]', password!);
  await page.click('button[type=submit]');
  await page.waitForFunction(() => location.pathname.startsWith('/dashboard'), { timeout: 30000 });
  return page.url().split('/dashboard/')[1]!.split(/[?#]/)[0]!;
}

/** Send one member message and wait for the Companion to answer (the "Thinking…" indicator clearing). */
async function say(page: Page, text: string): Promise<void> {
  const before = await page.$$eval('.bubble', (n) => n.length);
  await page.fill('textarea', text);
  await page.keyboard.press('Enter');
  await page.waitForFunction((n) => document.querySelectorAll('.bubble').length > n + 1, before, { timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('.typing'), null, { timeout: 60000 });
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const fail: string[] = [];
  try {
    const memberId = await login(page);
    log(`✓ signed in — member ${memberId}`);

    const before = await playbookBodies(ctx, memberId);
    log(`  Playbook before: ${before.length} kept entries`);

    // A FRESH W1, or this proves nothing. W1 correctly RESUMES an in-flight session, so a second run starts
    // mid-conversation — my earlier runs left demo-tom parked on the affirm beat, which made her very first
    // message land as a "true line" and made a re-kept entry look like the offer filing before the tap. Both
    // read as product bugs and were test pollution. The reset is dev-only and touches this member's rows alone.
    const reset = await page.evaluate(async (b) => {
      const r = await fetch(`${b}/dev/reset-session?session=w1`, { method: 'POST' });
      return { status: r.status, body: await r.text() };
    }, base);
    if (reset.status !== 200) {
      fail.push(`could not reset W1 (${reset.status}) — the walk would run against leftover state: ${reset.body.slice(0, 120)}`);
    } else {
      log('✓ W1 session reset — starting clean');
    }

    await page.goto(`${base}/rewire/${memberId}/w1`, { waitUntil: 'networkidle' });
    await page.waitForSelector('textarea', { timeout: 30000 });
    log('✓ W1 open');

    for (const [i, t] of MEMBER_TURNS.entries()) {
      await say(page, t);
      log(`  · turn ${i + 1} answered`);
      if (await page.$('.keeper-offer')) break; // the beat can arrive early
    }
    await say(page, TRUE_LINE);
    log('✓ true line sent');

    // THE ASSERTION. An offer must appear, and it must show HER EXACT WORDS — a summary here would reproduce the
    // original failure, where something was filed about her that she never read.
    const offer = await page.waitForSelector('.keeper-offer', { timeout: 60000 }).catch(() => null);
    if (!offer) {
      fail.push('NO KEEPER OFFER rendered after the true line — the seam is broken between the action and the client.');
    } else {
      const body = (await page.$eval('.keeper-offer-body', (e) => e.textContent ?? '')).trim();
      const label = (await page.$eval('.keeper-offer-label', (e) => e.textContent ?? '')).trim();
      log(`✓ offer rendered — [${label}] "${body.slice(0, 60)}"`);
      // THE INVARIANT, stated generally: whatever the offer holds must be something SHE said, not a summary of
      // it. Hardcoding one expected line would pass for the wrong reason the moment the beat order changes.
      const said = [...MEMBER_TURNS, TRUE_LINE];
      const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9 ]+/g, '').trim();
      if (!said.some((t) => norm(body).includes(norm(t).slice(0, 24)) || norm(t).includes(norm(body).slice(0, 24)))) {
        fail.push(`offer does not carry HER words — it holds "${body}", which she never said.`);
      }

      // NOTHING IS IN THE PLAYBOOK YET. This is the whole point of the change, so it is asserted, not assumed.
      const mid = await playbookBodies(ctx, memberId);
      if (mid.some((b) => norm(b).includes(norm(body).slice(0, 24)))) {
        fail.push('the line was in the Playbook BEFORE she tapped Keep — the offer is decorative.');
      } else {
        log('✓ nothing filed yet — the offer is a real gate');
      }

      // AND NOW THE TAP — the half that actually commits. Asserting the gate without asserting the commit would
      // leave the feature half-proven in the more dangerous direction: an offer that never lands is a member
      // choosing to keep something and losing it.
      await page.click('.keeper-offer-btn');
      const kept = await page.waitForSelector('.keeper-offer.kept', { timeout: 30000 }).catch(() => null);
      if (!kept) {
        fail.push('tapped Keep and the offer never confirmed — the action did not resolve.');
      } else {
        const receipt = (await page.$eval('.keeper-offer-done', (e) => e.textContent ?? '')).trim();
        log(`✓ tapped Keep — "${receipt}"`);
      }

      // The receipt must be TRUE. "In your Playbook." over an empty Playbook is the same confident lie the whole
      // change exists to remove, so it is checked against the page a member would actually open.
      const after = await playbookBodies(ctx, memberId);
      const landed = after.some((b) => norm(b).includes(norm(body).slice(0, 24)));
      if (!landed) {
        fail.push(`the receipt said it was kept, but the Playbook does not contain it (${after.length} entries read).`);
      } else {
        log(`✓ it is in her Playbook — ${after.length} kept entries now`);
      }
    }
    await browser.close();
    report(fail);
  } catch (e) {
    await browser.close();
    console.error('\n✗ walk threw:', (e as Error).message);
    process.exit(1);
  }
}

/**
 * Kept Playbook bodies, read from the real page rather than the DB — what a member would actually see.
 *
 * IN ITS OWN TAB, and that is not incidental. The first version navigated the SESSION page to /playbook and back,
 * which reloaded the chat and wiped the client-side offer state — so the Keep button had vanished by the time it
 * was clicked, and the walk reported a broken product. The harness must not disturb the thing it is observing.
 */
async function playbookBodies(ctx: BrowserContext, memberId: string): Promise<string[]> {
  const tab = await ctx.newPage();
  try {
    await tab.goto(`${base}/playbook/${memberId}`, { waitUntil: 'networkidle' });
    // ACROSS ALL TABS. The Playbook renders only the ACTIVE tab's entries, so reading `.pb-line` on the page as
    // loaded returns whatever the default chapter holds — which for a fresh member is nothing. That reported "0
    // kept entries" for an account with dozens, and then turned a working Keep into a failed assertion.
    const bodies: string[] = [];
    const tabs = await tab.$$('.pb-tabs button, [role=tab]');
    if (!tabs.length) return await tab.$$eval('.pb-line', (els) => els.map((e) => e.textContent ?? ''));
    for (let i = 0; i < tabs.length; i++) {
      const btns = await tab.$$('.pb-tabs button, [role=tab]');
      await btns[i]?.click().catch(() => {});
      await tab.waitForTimeout(250);
      bodies.push(...(await tab.$$eval('.pb-line', (els) => els.map((e) => e.textContent ?? ''))));
    }
    return bodies;
  } finally {
    await tab.close();
  }
}

function report(fail: string[]) {
  if (fail.length) {
    console.error(`\n✗ KEEPER-OFFER WALK FAILED (${fail.length})`);
    for (const f of fail) console.error('  · ' + f);
    process.exit(1);
  }
  console.log('\n✓ KEEPER-OFFER WALK PASSED');
}

await main();

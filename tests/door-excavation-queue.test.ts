import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { nextDoorToExcavate } from '../lib/agent/reconnect.ts';
import { noteDoorLanguage, doorProfile } from '../lib/reconnect/door-profile.ts';
import type { Collected } from '../lib/agent/onboarding.ts';

// EVERY DOOR GETS WALKED — Jay, 2026-08-30, from Donna's live walk: "we should walk through every door. It is
// potentially the most valuable information we can learn about a Member. I can imagine that driving what we do in
// Cycle 2."
//
// Before this, R2 excavated ONE Door (the heaviest) and the rest carried a rating and nothing else. Donna marked
// six; one was excavated. What makes the second cycle legible — Greg: "a member coming back will name different
// doors, or the same doors with different weight" — is a first pass that stored per-Door meaning, and there wasn't
// one.

async function db(): Promise<Db> {
  const d = new PGlite() as unknown as Db;
  await applySchema(d);
  return d;
}
async function member(d: Db, email: string): Promise<string> {
  const { rows } = await d.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ($1,$2) returning member_id`,
    [email.split('@')[0], email],
  );
  return rows[0]!.member_id;
}
async function giveDoors(d: Db, m: string, slugs: string[]): Promise<void> {
  for (const [i, s] of slugs.entries()) {
    await d.query(
      `insert into member_door (member_id, door_slug, is_primary, sort_order) values ($1,$2,$3,$4)`,
      [m, s, i === 0, i],
    );
  }
}

test('the queue walks every Door she holds, in her order, and stops when they are done', () => {
  const c: Collected = { doors: ['career_cliff', 'body', 'marriage'] };
  assert.equal(nextDoorToExcavate(c), 'career_cliff', 'heaviest first — the board puts it at the head');

  c.doorsExcavated = ['career_cliff'];
  assert.equal(nextDoorToExcavate(c), 'body', 'then the next one she marked');

  c.doorsExcavated = ['career_cliff', 'body'];
  assert.equal(nextDoorToExcavate(c), 'marriage');

  c.doorsExcavated = ['career_cliff', 'body', 'marriage'];
  assert.equal(nextDoorToExcavate(c), null, 'every Door walked → the excavation is over');
});

test('a Door added mid-excavation joins the queue rather than being missed', () => {
  // A re-seeing during the walk (propose→confirm) can ADD a Door. It must get its own excavation like any other,
  // or the Door she surfaced while talking is the one Door nobody asks her about.
  const c: Collected = { doors: ['career_cliff', 'body'], doorsExcavated: ['career_cliff'] };
  c.doors = [...c.doors!, 'grind'];
  assert.equal(nextDoorToExcavate(c), 'body');
  c.doorsExcavated = ['career_cliff', 'body'];
  assert.equal(nextDoorToExcavate(c), 'grind', 'the Door she surfaced mid-walk still gets walked');
});

test('the queue never re-opens a Door, even if she still holds it', () => {
  const c: Collected = { doors: ['body'], doorsExcavated: ['body'] };
  assert.equal(nextDoorToExcavate(c), null);
});

test('RESUMABLE: doorsExcavated is what survives the member leaving mid-Session', () => {
  // Six excavations is more than one sitting and Greg caps a sitting at 10-15 minutes, so stopping partway is the
  // expected path, not the edge case. Rehydrating collected must resume at the next unwalked Door.
  const mid: Collected = { doors: ['career_cliff', 'body', 'marriage'], doorsExcavated: ['career_cliff'] };
  const rehydrated: Collected = JSON.parse(JSON.stringify(mid)); // what crosses the wire and comes back
  assert.equal(nextDoorToExcavate(rehydrated), 'body', 'she returns to the Door she had not reached');
});

test('her words are stored against the Door she was talking about', async () => {
  const d = await db();
  const m = await member(d, 'donna-doorlang@example.test');
  await giveDoors(d, m, ['career_cliff', 'body']);

  assert.equal(await noteDoorLanguage(d, m, 'career_cliff', 'Twelve years, and weeks from the promotion.'), true);
  assert.equal(await noteDoorLanguage(d, m, 'body', 'The knee went and I stopped going.'), true);

  const rows = await d.query<{ door_slug: string; member_language: string; excavated_at: string | null }>(
    `select door_slug, member_language, excavated_at::text as excavated_at from member_door where member_id=$1 order by sort_order`, [m],
  );
  assert.equal(rows.rows[0]!.member_language, 'Twelve years, and weeks from the promotion.');
  assert.equal(rows.rows[1]!.member_language, 'The knee went and I stopped going.');
  assert.ok(rows.rows.every((r) => r.excavated_at), 'a walked Door is stamped, which is what makes resume work');
});

test('returning to a Door APPENDS — a second cycle never overwrites the first', async () => {
  // The comparison Greg says the exercise exists to make needs both passes to survive. An overwrite would silently
  // destroy the earlier account and leave the record looking complete.
  const d = await db();
  const m = await member(d, 'donna-append@example.test');
  await giveDoors(d, m, ['career_cliff']);

  await noteDoorLanguage(d, m, 'career_cliff', 'First pass.');
  const firstStamp = (await d.query<{ e: string }>(
    `select excavated_at::text as e from member_door where member_id=$1`, [m])).rows[0]!.e;
  await noteDoorLanguage(d, m, 'career_cliff', 'Second cycle, and it reads differently now.');

  const row = (await d.query<{ member_language: string; e: string }>(
    `select member_language, excavated_at::text as e from member_door where member_id=$1`, [m])).rows[0]!;
  assert.match(row.member_language, /First pass\./, 'the first account survives');
  assert.match(row.member_language, /Second cycle/, 'and the second is added');
  assert.equal(row.e, firstStamp, 'excavated_at marks the FIRST walk, not the latest');
});

test('walking a Door can never CREATE one — same posture as its sibling', async () => {
  const d = await db();
  const m = await member(d, 'donna-nocreate@example.test');
  await giveDoors(d, m, ['career_cliff']);

  assert.equal(await noteDoorLanguage(d, m, 'marriage', 'Something about a Door she does not hold.'), false);
  assert.equal((await doorProfile(d, m)).length, 1, 'no Door was invented as a side effect of storing words');
});

test('nothing said means nothing stamped — an empty walk is not a walked Door', async () => {
  const d = await db();
  const m = await member(d, 'donna-empty@example.test');
  await giveDoors(d, m, ['career_cliff']);

  assert.equal(await noteDoorLanguage(d, m, 'career_cliff', '   '), false);
  const row = (await d.query<{ e: string | null }>(
    `select excavated_at::text as e from member_door where member_id=$1`, [m])).rows[0]!;
  assert.equal(row.e, null, 'excavated_at unstamped — absent is not zero');
});

// ── THE SEAM ──────────────────────────────────────────────────────────────────────────────────────────────────
// The tests above prove the queue and the store INDEPENDENTLY, which is exactly the arrangement that shipped an
// infinite loop once before: propose and resolve both existed, both unit-tested, and nothing wired them together
// (test-the-seam-not-the-halves). What matters is whether a confirmed Door actually hands the member the NEXT one.
import { applyReconnectTurn, RECONNECT_R2_ARC } from '../lib/agent/reconnect.ts';
import { serializeBoardSubmission } from '../lib/reconnect/doors-board-claim.ts';
import type { ConvState, Turn } from '../lib/agent/onboarding.ts';

/**
 * Drive ONE Door's excavation the way a member actually does it: answer while the engine is drawing out, confirm
 * when it asks. The first version of this helper always sent a draw-out message and never passed replyIntent, so
 * it hung on the confirm and reported "the draw-out did not close a Door" — a harness that cannot do what a member
 * does manufactures failures (eval-harness-must-tap-not-type). The product was fine; the driver was not.
 */
function step(state: ConvState): Turn {
  const confirming = !!state.awaitingConfirm;
  return applyReconnectTurn(
    state,
    [],
    confirming ? "Yes, that's it exactly." : 'It went on for years and I kept telling myself it was temporary.',
    { text: 'I hear that.', depthReady: true, ...(confirming ? { replyIntent: 'confirm' as const } : {}) },
    RECONNECT_R2_ARC,
  );
}

/** Run the arc from a state until it completes (or we give up), returning every turn. */
function run(state: ConvState, maxTurns = 12): Turn[] {
  const turns: Turn[] = [];
  let cur = state;
  for (let i = 0; i < maxTurns; i++) {
    const t = step(cur);
    turns.push(t);
    cur = t.state;
    if (t.complete) break;
  }
  return turns;
}

function boardFor(slugs: string[], biggest: string): string {
  return serializeBoardSubmission({
    doors: slugs.map((slug) => ({ slug: slug as never, relevance: 2 })),
    quietDrift: false, first: null, biggest: biggest as never, stillOpen: [],
  });
}

test('SEAM: confirming one Door hands her the NEXT one, by name', () => {
  const start: ConvState = { stage: 'doors', collected: { identityNoun: 'Maker', doors: ['career_cliff'] } } as ConvState;
  const afterBoard = applyReconnectTurn(start, [], boardFor(['career_cliff', 'body', 'marriage'], 'career_cliff'), { text: '' }, RECONNECT_R2_ARC);
  assert.match(afterBoard.reply, /Career Cliff/i, 'the excavation opens on the one she said weighs most');

  const turns = run(afterBoard.state);
  const handoff = turns.find((t) => (t.state.collected.doorsExcavated ?? []).length === 1)!;
  assert.ok(handoff, 'a Door gets banked');
  assert.equal(handoff.state.collected.doorsExcavated?.[0], 'career_cliff');
  assert.ok(!handoff.complete, 'R2 does NOT end after the first Door any more — that was the bug');
  assert.match(handoff.reply, /The Body/i, 'and she is handed the next Door by name');
  assert.equal(
    (handoff.state as { doorLanguage?: { slug: string } }).doorLanguage?.slug,
    'career_cliff',
    'her words ride out on the turn, tagged with the Door she was talking about',
  );
});

test('SEAM: R2 only reaches its close once EVERY Door has been walked', () => {
  const start: ConvState = { stage: 'doors', collected: { identityNoun: 'Maker', doors: ['career_cliff'] } } as ConvState;
  const afterBoard = applyReconnectTurn(start, [], boardFor(['career_cliff', 'body'], 'career_cliff'), { text: '' }, RECONNECT_R2_ARC);

  const turns = run(afterBoard.state);
  const done = turns.find((t) => t.complete);
  assert.ok(done, 'R2 closes');
  assert.deepEqual(done!.state.collected.doorsExcavated, ['career_cliff', 'body'], 'both Doors walked, in her order');

  // The Door she marked SECOND must have been spoken about before the close — the whole point of the change.
  assert.ok(
    turns.some((t) => /Then let's take The Body/i.test(t.reply)),
    'the second Door got its own excavation, not just a rating',
  );
});

test('SEAM: the set question waits for the last Door, not the first', () => {
  // "What does naming these change" is about the SET. Asking it after Door one would ask her to sum up work she
  // has not done — which is exactly what shipped before 2026-08-30.
  const start: ConvState = { stage: 'doors', collected: { identityNoun: 'Maker', doors: ['career_cliff'] } } as ConvState;
  const afterBoard = applyReconnectTurn(start, [], boardFor(['career_cliff', 'body'], 'career_cliff'), { text: '' }, RECONNECT_R2_ARC);

  const turns = run(afterBoard.state);
  const meaningAt = turns.findIndex((t) => /the one that matters most/i.test(t.reply));
  const secondDoorAt = turns.findIndex((t) => (t.state.collected.doorsExcavated ?? []).length === 2);
  assert.ok(meaningAt >= 0, 'the set question is asked');
  assert.ok(meaningAt >= secondDoorAt, 'and only after every Door has been walked');
});

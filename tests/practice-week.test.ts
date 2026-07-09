import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import {
  startPracticeWeek,
  activePracticeWeek,
  latestImageKeeper,
  practicePrompt,
  practiceHeroMessage,
  imageHook,
  PRACTICE_WINDOW_DAYS,
} from '../lib/practice/store.ts';

// The practice-week scaffold (Decision MM R4): a bounded daily-practice window opened when a Rewire session
// completes, surfaced on the hero. W2 payload = the saved image. Window is derived (started_at + N days); most-recent
// wins when two are active; productive-default, never a gate.

test('practicePrompt · W2 nudge (Decision NN) plays the member’s GOAL hook back; nothing → null (graceful degrade)', () => {
  const p = practicePrompt('w2_image', { goal: 'The half-marathon finish line' });
  assert.match(p!, /The half-marathon finish line/, 'the member’s own destination, verbatim');
  assert.match(p!, /five minutes/i, 'the daily practice framing');
  assert.match(p!, /picture's real — the lie isn't/i, 'echoes W2’s close');
  assert.equal(practicePrompt('w2_image', { goal: '' }), null, 'no goal → no prompt');
  assert.equal(practicePrompt('w2_image', { goal: null }), null);
});

test('imageHook · pulls the first line (the goal) out of the composed image keeper', () => {
  assert.equal(imageHook('The half-marathon finish line\nA cool morning\nMy kids at the rail'), 'The half-marathon finish line');
  assert.equal(imageHook(''), null);
  assert.equal(imageHook(null), null);
});

let seq = 0;
async function seedMember(db: Db): Promise<string> {
  seq += 1;
  return (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email) values ('Pat', $1) returning member_id`,
      [`pat${seq}@x.com`],
    )
  ).rows[0]!.member_id;
}

test('startPracticeWeek opens an active window; activePracticeWeek reports it within N days', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db);
  assert.equal(await activePracticeWeek(db, m), null, 'no window before a session completes');
  await startPracticeWeek(db, m, 'w2_image');
  const pw = await activePracticeWeek(db, m);
  assert.equal(pw?.kind, 'w2_image');
  assert.equal(pw?.day, 1, 'the day the session completed is day 1');
});

test('the window EXPIRES after N days (a nudge, not forever)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db);
  await startPracticeWeek(db, m, 'w2_image');
  // age the row past the window
  await db.query(`update practice_week set started_at = now() - ($1 || ' days')::interval where member_id=$2`, [
    String(PRACTICE_WINDOW_DAYS + 1),
    m,
  ]);
  assert.equal(await activePracticeWeek(db, m), null, 'past the window → no active practice');
});

test('overlapping windows · the MOST-RECENT session’s payload wins on the hero (Decision MM add)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db);
  // an older w3_logging window, then a newer w2_image window (simulate raw kinds so the precedence is what’s tested)
  await db.query(`insert into practice_week (member_id, kind, started_at) values ($1,'w3_logging', now() - interval '2 days')`, [m]);
  await db.query(`insert into practice_week (member_id, kind, started_at) values ($1,'w2_image', now() - interval '1 hour')`, [m]);
  const pw = await activePracticeWeek(db, m);
  assert.equal(pw?.kind, 'w2_image', 'the newer window leads');
});

test('practiceHeroMessage · active W2 window + a saved image → the step-into-your-picture nudge', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db);
  // no window yet → no hero override
  assert.equal(await practiceHeroMessage(db, m), null);
  // save an image keeper (as the W2 harvest would) + open the window
  await db.query(
    `insert into playbook_entry (member_id, section, body, authorship, state, keeper_type)
     values ($1,'own_words','A cold morning, the finish chute, my kids at the rail','gathered','kept','lights_you_up')`,
    [m],
  );
  await startPracticeWeek(db, m, 'w2_image');
  const msg = await practiceHeroMessage(db, m);
  assert.match(msg!, /finish chute/, 'the hero surfaces their own picture');
  // an active window but NO image → graceful degrade (null, hero keeps its normal message)
  const m2 = await seedMember(db);
  await startPracticeWeek(db, m2, 'w2_image');
  assert.equal(await practiceHeroMessage(db, m2), null, 'no image → no practice nudge, dashboard renders normally');
  assert.equal(await latestImageKeeper(db, m2), null);
});

test('practiceHeroMessage · a w3_logging window surfaces the Momentum log nudge (Slice 4)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db);
  await startPracticeWeek(db, m, 'w3_logging');
  const msg = await practiceHeroMessage(db, m);
  assert.match(msg!, /good call, a false start, or a quiet one/i, 'the daily log nudge, one ask, no pressure');
});

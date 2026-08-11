import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { startPracticeWeek, PRACTICE_WINDOW_DAYS } from '../lib/practice/store.ts';
import { buildReview, reviewLine, isClosable, closeWeek, keeperBodyFrom, PRACTICE_KEEPER_NAME } from '../lib/practice/close.ts';
import { buildRow } from '../lib/practice/grid.ts';

// CLOSING THE WEEK. Until now a week aged out silently — nothing reviewed it, nothing recorded it, and the member
// was never told it was over. Greg asked twice for the "ready for the next activity" prompt at the end, and a cycle
// can only have a LENGTH if its weeks can finish.
//
// Most of these tests are about TONE, because tone is the whole design here. A review that reads as a report card
// turns a practice into a performance, and the member stops logging honestly — which costs us the data too.

const row = (label: string, target: number | null, done: number) =>
  buildRow(label, label, target, '2026-08-03', Array.from({ length: done }, (_, i) => `2026-08-0${3 + i}`));

// ── the phrasing, line by line ────────────────────────────────────────────────────────────────────────────────

test('hitting the target is stated, not celebrated', () => {
  // Praise turns a practice into a performance. "Exactly what you aimed for" is the fact, warmly.
  const s = reviewLine(row('15 minutes of functional fitness', 5, 5));
  assert.match(s, /5 of 5\. Exactly what you aimed for\./);
  assert.doesNotMatch(s, /amazing|great job|well done|crushed|nailed/i);
});

test('going past it is noticed, not made heroic', () => {
  assert.match(reviewLine(row('Fruit at breakfast', 5, 6)), /6, past the 5 you set\./);
});

test('FALLING SHORT is stated plainly and then left alone', () => {
  // The line that matters most. No "only", no "just", no consolation bolted on — each of those tells the member you
  // think they failed. State the number; the silence after it is the respect.
  const s = reviewLine(row('15 minutes of functional fitness', 5, 4));
  assert.equal(s, '15 minutes of functional fitness — 4 of the 5 you aimed for.');
  assert.doesNotMatch(s, /\bonly\b|\bjust\b|but |at least|don'?t worry|next week/i);
});

test('a row with NO marks is honest without being a reproach', () => {
  const s = reviewLine(row('Fruit at breakfast', 5, 0));
  assert.match(s, /none this week\. It was there, waiting\./);
  assert.doesNotMatch(s, /failed|missed|slipped|should/i);
});

test('a row with no target never invents one to fall short of', () => {
  assert.equal(reviewLine(row('Moved my body', null, 3)), 'Moved my body — 3 days.');
  assert.equal(reviewLine(row('Moved my body', null, 0)), 'Moved my body — no days marked.');
  assert.equal(reviewLine(row('Moved my body', null, 1)), 'Moved my body — 1 day.', 'and it counts in English');
});

// ── the whole review ──────────────────────────────────────────────────────────────────────────────────────────

test('the review reads as noticing, and keeps their own numbers', () => {
  const r = buildReview({ kind: 'b3_pilot', rows: [row('Walk 15 minutes', 5, 4), row('Fruit at breakfast', 5, 6)] });
  assert.match(r.opener, /how it actually went/i);
  assert.deepEqual(r.lines, ['Walk 15 minutes — 4 of the 5 you aimed for.', 'Fruit at breakfast — 6, past the 5 you set.']);
  assert.match(r.keeperBody, /Walk 15 minutes — 4 of the 5/, 'the keeper carries the week, not a summary of it');
});

test('A WEEK WITH NOTHING MARKED gets the truth, not consolation and not a scold', () => {
  // Where a product is most tempted to either cheer someone up or tell them off. Both land as judgement. We don't
  // know what the week held, and saying so invites them to tell us — which is more use than either.
  const r = buildReview({ kind: 'b3_pilot', rows: [row('Walk', 5, 0), row('Fruit', 5, 0)] });
  assert.match(r.opener, /hard week, or just that logging slipped/i);
  assert.doesNotMatch(r.opener, /failed|disappoint|try harder|next time|shame/i);
  assert.doesNotMatch(r.opener, /amazing|proud|great/i);
});

// ── the mechanics ─────────────────────────────────────────────────────────────────────────────────────────────

test('a week is closable only once its window has elapsed', () => {
  const rows = [row('Walk', 5, 2)];
  assert.equal(isClosable({ day: 3, closed: false, rows }), false, 'mid-week is not over');
  assert.equal(isClosable({ day: PRACTICE_WINDOW_DAYS, closed: false, rows }), true);
  assert.equal(isClosable({ day: PRACTICE_WINDOW_DAYS, closed: true, rows }), false, 'and never twice');
  assert.equal(isClosable({ day: PRACTICE_WINDOW_DAYS, closed: false, rows: [] }), false, 'nothing to review');
});

test('closeWeek is idempotent — a close beat cannot fire twice', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const memberId = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name,email) values ('Greg','g@example.test') returning member_id`,
    )
  ).rows[0]!.member_id;
  await startPracticeWeek(db, memberId, 'b3_pilot');

  assert.equal(await closeWeek(db, memberId, 'b3_pilot'), true, 'the first close lands');
  assert.equal(await closeWeek(db, memberId, 'b3_pilot'), false, 'the second is a no-op');
  const { rows } = await db.query<{ closed_at: string | null }>(
    `select closed_at from practice_week where member_id=$1 and kind='b3_pilot'`,
    [memberId],
  );
  assert.ok(rows[0]!.closed_at, 'and the week has genuinely ENDED rather than aged out');
});

// ── the seam: a finished week actually STOPS being active ─────────────────────────────────────────────────────

test('a closed week disappears from the grid, so the review cannot fire twice', async () => {
  // The whole point of closed_at. Before it, "active" meant "started less than 7 days ago", so a week ended by
  // silence and by arithmetic. A member who closed their week and came back must not be handed the review again.
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const memberId = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name,email) values ('Greg','g@example.test') returning member_id`,
    )
  ).rows[0]!.member_id;

  // A week that opened 6 days ago -> today is day 7, the last day.
  await db.query(
    `insert into practice_week (member_id, kind, started_at) values ($1,'b3_pilot', now() - interval '6 days')`,
    [memberId],
  );
  const c = (
    await db.query<{ id: string }>(
      `insert into practice_commitment (member_id,kind,slot,label,target_days) values ($1,'b3_pilot','activity','Walk 15 minutes',5) returning id`,
      [memberId],
    )
  ).rows[0]!.id;
  for (const back of [6, 5, 3, 1]) {
    await db.query(
      `insert into practice_mark (member_id,kind,commitment_id,marked_on,source) values ($1,'b3_pilot',$2, current_date - $3::int,'grid')`,
      [memberId, c, back],
    );
  }

  const { weekGrid } = await import('../lib/practice/grid.ts');
  const before = (await weekGrid(db, memberId))!;
  assert.equal(before.day, PRACTICE_WINDOW_DAYS, 'day 7');
  assert.equal(before.closed, false);
  assert.equal(isClosable(before), true, 'the week is ready to be reviewed');
  assert.deepEqual(buildReview(before).lines, ['Walk 15 minutes — 4 of the 5 you aimed for.']);

  assert.equal(await closeWeek(db, memberId, 'b3_pilot'), true);

  const after = await weekGrid(db, memberId);
  assert.equal(after!.closed, true, 'the grid now knows it ended');
  assert.equal(isClosable(after!), false, 'and it will never be reviewed a second time');
});

// ── W3 · Mindful Monitoring — the close has its own frame and its own rules ───────────────────────────────────
//
// Greg is unusually prescriptive about this moment, and every rule is about what the close must NOT do:
// "Affirmations must target consistency of tracking, honesty of observation, and use of the recovery skill — not
// the absence of False Starts. Disallowed: 'Great — you avoided False Starts today!' / 'You only had two Smart
// Choices this week.' / 'You need to avoid False Starts.'"

const w3Row = (label: string, done: number) =>
  buildRow(label, label, null, '2026-08-03', Array.from({ length: done }, (_, i) => `2026-08-0${3 + i}`));

test('W3 · the close asks what they NOTICED, not how the week went', () => {
  // "Here's how it actually went" invites a verdict on a week that was explicitly not about performance.
  const r = buildReview({ kind: 'w3_logging', rows: [w3Row('Noticed the day', 4), w3Row('late nights', 2)] });
  assert.match(r.opener, /what you noticed/i);
  assert.doesNotMatch(r.opener, /how it actually went/i);
});

test('W3 · using the protocol IS named — the one affirmation allowed', () => {
  const rows = [w3Row('Noticed the day', 5), w3Row('late nights', 3)];
  const r = buildReview({ kind: 'w3_logging', rows }, { recoveryUsed: 2, daysLogged: 5 });
  assert.match(r.lines.join(' '), /used the protocol you wrote 2 times/i);
  assert.match(r.lines.join(' '), /that is the skill this week was for/i);
});

test('W3 · a week with no recovery used says NOTHING about it', () => {
  // The absence must not be remarked on. Silence is the correct treatment.
  const r = buildReview({ kind: 'w3_logging', rows: [w3Row('Noticed the day', 3)] }, { recoveryUsed: 0, daysLogged: 3 });
  assert.doesNotMatch(r.lines.join(' '), /protocol/i);
  assert.doesNotMatch(r.lines.join(' '), /didn't use|never used|no recovery/i);
});

test('W3 · the close NEVER praises the absence of false starts', () => {
  // A clean week is the exact case where a product reaches for "great, no false starts!" — Greg forbids it.
  const r = buildReview(
    { kind: 'w3_logging', rows: [w3Row('Noticed the day', 7), w3Row('late nights', 0), w3Row('travel', 0)] },
    { recoveryUsed: 0, daysLogged: 7 },
  );
  const all = `${r.opener} ${r.lines.join(' ')}`;
  assert.doesNotMatch(all, /avoided|no false starts|clean week|great|well done|nice work|proud/i);
  assert.doesNotMatch(all, /\bonly\b/i, '"you only had two" is on the disallowed list');
  assert.doesNotMatch(all, /should|need to|try to|next time/i, 'no corrective advice at the close');
});

test('W3 · a trigger that never fired reads as a fact, not a win or a miss', () => {
  const r = buildReview({ kind: 'w3_logging', rows: [w3Row('travel', 0)] });
  assert.match(r.lines[0]!, /travel — no days marked\./);
  assert.doesNotMatch(r.lines[0]!, /good|bad|well|miss|fail/i);
});

test('W3 · an empty week is met without consoling and without scolding', () => {
  const r = buildReview({ kind: 'w3_logging', rows: [w3Row('Noticed the day', 0)] });
  assert.match(r.opener, /nothing got written down/i);
  assert.match(r.opener, /either is worth knowing/i, 'both explanations are left standing');
  assert.doesNotMatch(r.opener, /don't worry|it's okay|next week|try again/i);
});

test('W3 · no other week inherits the W3 frame', () => {
  const b3 = buildReview({ kind: 'b3_pilot', rows: [buildRow('walk', 'walk', 5, '2026-08-03', ['2026-08-03'])] });
  assert.match(b3.opener, /how it actually went/i, 'B3 keeps the generic opener');
  assert.doesNotMatch(b3.lines.join(' '), /protocol you wrote/i);
});

// ── The keeper says WHICH week it was ────────────────────────────────────────────────────────────────────────
// Every closed week used to land in the Playbook headed "Your practice week". Run three of them and What worked
// shows three identical headings — a pile rather than an operating manual, which is the exact failure the
// Playbook exists to avoid. The names below are the ones the member already read on the outcome cards, so the
// two surfaces agree.
test('a closed week is named after the tool the member actually ran', () => {
  assert.match(keeperBodyFrom(['walked 5 of 7'], 'c3_quality'), /^Quality Days:/);
  assert.match(keeperBodyFrom(['caught it twice'], 'w3_logging'), /^Mindful Monitoring:/);
  assert.match(keeperBodyFrom(['two changes held'], 'b3_pilot'), /^The Lifestyle Pilot:/);
  assert.match(keeperBodyFrom(['saw it clearly'], 'w2_image'), /^Your picture:/);
  assert.match(keeperBodyFrom(['strengths landed'], 'b2_noticing'), /^Your map:/);
});

test('every practice kind HAS a name — a new kind cannot silently fall back to the generic heading', () => {
  // The failure this guards is quiet: add a sixth PracticeKind, forget the name, and its keeper rejoins the
  // anonymous pile with nothing red to show for it.
  for (const kind of ['w2_image', 'w3_logging', 'b2_noticing', 'b3_pilot', 'c3_quality'] as const) {
    assert.ok(PRACTICE_KEEPER_NAME[kind], `${kind} has no keeper name`);
    assert.doesNotMatch(keeperBodyFrom(['x'], kind), /^Your practice week:/, `${kind} fell back to the generic heading`);
  }
});

test('the member’s own lines survive the naming, unchanged', () => {
  const body = keeperBodyFrom(['walk with Rosie before the house wakes'], 'c3_quality');
  assert.match(body, /• walk with Rosie before the house wakes/, 'their words, verbatim, still bulleted under it');
});

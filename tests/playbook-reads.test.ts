import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { memberReads } from '../lib/playbook/reads.ts';
import { scoreWhy, relativeAutonomyRead } from '../lib/rebuild/why-instrument.ts';

// YOUR READS — the Reads tab's real content.
//
// This surfaces data that has ALWAYS existed but was visible only to the Companion: what the member's own
// assessments said. That makes it the single most likely place for a number or a verdict to leak into a
// member-facing surface, because the underlying registers ARE numeric. B1's reading is "stored, deliberately not
// scored or shown as a number"; B2's skills are "never as a grade or a number". These pin that at the boundary.

async function freshDb(): Promise<{ db: Db; memberId: string }> {
  const pg = new PGlite();
  const db = pg as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('R','r@grintaforlife.test') returning member_id`,
  );
  return { db, memberId: rows[0]!.member_id };
}

test('a member who has done no assessments has no reads — and no placeholder pretending otherwise', async () => {
  const { db, memberId } = await freshDb();
  assert.deepEqual(await memberReads(db, memberId), []);
});

test('the skills read speaks plain language and never a number', async () => {
  const { db, memberId } = await freshDb();
  await db.query(
    `insert into self_management_reading (member_id, source, sequence_no, taken_on, scores, responses)
     values ($1,'b2',1,now(),$2,$3)`,
    [memberId, JSON.stringify({ perSkill: [
      { no: 1, skill: 'Monitoring', mean: 4.8 },
      { no: 2, skill: 'Goal setting', mean: 4.2 },
      { no: 3, skill: 'Handling barriers', mean: 2.4 },
    ] }), JSON.stringify(Array(24).fill(3))],
  );
  const reads = await memberReads(db, memberId);
  assert.equal(reads.length, 1);
  const r = reads[0]!;
  assert.equal(r.label, 'your map', 'the label matches the outcome card word-for-word — one vocabulary or none');
  assert.equal(r.from, 'Strengths & Weaknesses');
  const text = r.lines.join(' ');
  // THE RULE. Any digit here means a score reached a surface that promised not to show one.
  assert.doesNotMatch(text, /\d/, 'a read is plain language — no number, ever');
  assert.doesNotMatch(text, /weak|poor|low|failing|behind/i, 'a growth edge is a skill to practise, never a verdict');
  assert.match(text, /monitoring/i, 'their strongest skill, named');
  // The posture line DECLARES what a growth edge is rather than reassuring about what it isn't — the
  // "it's not X, it's Y" tic is one Jay has been cutting from member copy all week, and the strict assertion
  // above is what caught my first draft using it ("not a weakness to carry").
  assert.match(text, /simply the next one to practise/, 'the posture line is part of the read, not decoration');
});

test('a DRIFTED register hides one card, it does not empty the tab', async () => {
  // The claim in the module comment, actually asserted. skillHighlights throws on a shape it does not recognise;
  // before this it threw straight out of memberReads and the member lost their bigger-world read too.
  const { db, memberId } = await freshDb();
  await db.query(
    `insert into self_management_reading (member_id, source, sequence_no, taken_on, scores, responses) values ($1,'b2',1,now(),$2,$3)`,
    [memberId, JSON.stringify({ nonsense: true }), JSON.stringify(Array(24).fill(3))],
  );
  await db.query(
    `insert into bigger_world_reading (member_id, source, sequence_no, taken_on, priorities, responses) values ($1,'c2',1,now(),$2,$3)`,
    [memberId, JSON.stringify({ primary: 'self', momentumLever: 'outlook' }), JSON.stringify(Array(16).fill(3))],
  );
  const reads = await memberReads(db, memberId);
  assert.deepEqual(reads.map((r) => r.label), ['your bigger world'], 'the good read survives the bad one');
});

test('the bigger-world read frames a CHOICE, not a ranking', async () => {
  // The member picked these. Copy that implies we ranked their life would be both wrong and a verdict.
  const { db, memberId } = await freshDb();
  await db.query(
    `insert into bigger_world_reading (member_id, source, sequence_no, taken_on, priorities, responses)
     values ($1,'c2',1,now(),$2,$3)`,
    [memberId, JSON.stringify({ primary: 'social', momentumLever: 'physical' }), JSON.stringify(Array(16).fill(3))],
  );
  const [r] = await memberReads(db, memberId);
  assert.equal(r!.label, 'your bigger world');
  const text = r!.lines.join(' ');
  assert.match(text, /social life/i);
  assert.match(text, /You chose these/, 'attribution stays with the member');
  assert.doesNotMatch(text, /not a ranking|isn't a ranking/, 'declare what it is; do not reassure about what it is not');
  assert.doesNotMatch(text, /\d/);
});

test('reads arrive in program order, and one drifted register cannot empty the tab', async () => {
  const { db, memberId } = await freshDb();
  await db.query(
    `insert into self_management_reading (member_id, source, sequence_no, taken_on, scores, responses) values ($1,'b2',1,now(),$2,$3)`,
    [memberId, JSON.stringify({ perSkill: [{ no: 1, skill: 'Monitoring', mean: 5 }, { no: 2, skill: 'Planning', mean: 2 }] }), JSON.stringify(Array(24).fill(3))],
  );
  await db.query(
    `insert into bigger_world_reading (member_id, source, sequence_no, taken_on, priorities, responses) values ($1,'c2',1,now(),$2,$3)`,
    [memberId, JSON.stringify({ primary: 'outlook', momentumLever: 'self' }), JSON.stringify(Array(16).fill(3))],
  );
  const reads = await memberReads(db, memberId);
  assert.deepEqual(reads.map((r) => r.label), ['your map', 'your bigger world'], 'Rebuild before Reclaim');
});

test('an UNKNOWN domain key yields no card — never a crash, never "your undefined life"', async () => {
  // THE BUG JAY HIT. `AUDIT_DOMAIN_LABEL[key]` returns undefined for a key not in the map, and the copy called
  // .toLowerCase() on it OUTSIDE the guard — so the whole /playbook route threw and he got the error page on his
  // own account minutes after deploy. The query was guarded; the RENDERING of it was not.
  const { db, memberId } = await freshDb();
  await db.query(
    `insert into bigger_world_reading (member_id, source, sequence_no, taken_on, priorities, responses) values ($1,'c2',1,now(),$2,$3)`,
    [memberId, JSON.stringify({ primary: 'spiritual', momentumLever: 'physical' }), JSON.stringify(Array(16).fill(3))],
  );
  const reads = await memberReads(db, memberId); // must not throw
  assert.deepEqual(reads, [], 'no card beats a broken page');
});

test('one unreadable read never takes the OTHER one down with it', async () => {
  const { db, memberId } = await freshDb();
  await db.query(
    `insert into self_management_reading (member_id, source, sequence_no, taken_on, scores, responses) values ($1,'b2',1,now(),$2,$3)`,
    [memberId, JSON.stringify({ perSkill: [{ no: 1, skill: 'Planning ahead', mean: 4 }] }), JSON.stringify(Array(24).fill(3))],
  );
  await db.query(
    `insert into bigger_world_reading (member_id, source, sequence_no, taken_on, priorities, responses) values ($1,'c2',1,now(),$2,$3)`,
    [memberId, JSON.stringify({ primary: 'not_a_domain', momentumLever: 'nope' }), JSON.stringify(Array(16).fill(3))],
  );
  const reads = await memberReads(db, memberId);
  assert.deepEqual(reads.map((r) => r.label), ['your map']);
});

// ─── B1 · RELATIVE AUTONOMOUS MOTIVATION ────────────────────────────────────
// Greg's formula, specified and unbuilt until now: (1+2+3)/3 − (4+5)/2 per domain. The old code comment claimed
// he "gives no formula" — that was our flat-text extraction collapsing an OMML equation, not a gap in his work.

test('RAM is autonomous MINUS controlled — Greg’s formula, not a re-derivation', () => {
  // Pinned against the ITEM ORDER, not the numbering: items 1–3 are the autonomous facet and 4–5 the controlled
  // one, which is what makes (1+2+3)/3 − (4+5)/2 equal autonomous − controlled. If that order ever changes, this
  // fails rather than silently computing a different statistic.
  const r = [7, 7, 7, 1, 1, 1, /* diet */ 2, 2, 2, 6, 6, 7];
  const s = scoreWhy(r);
  assert.equal(s.activity.autonomous, 7);
  assert.equal(s.activity.controlled, 1);
  assert.equal(s.activity.relativeAutonomous, 6, 'the top of the range: all own reasons, no pressure');
  assert.equal(s.diet.relativeAutonomous, -4, 'signed, and negative when pressure leads');
});

test('the read is a SENTENCE, never the number — B1 is stored, not scored', () => {
  assert.equal(relativeAutonomyRead(6), 'mostly your own reasons');
  assert.equal(relativeAutonomyRead(-4), 'mostly pressure from outside');
  assert.equal(relativeAutonomyRead(0), 'your own reasons and outside pressure, about evenly');
  for (const v of [-6, -1, 0, 1, 6]) {
    assert.doesNotMatch(relativeAutonomyRead(v), /\d/, 'no number reaches a member');
    assert.doesNotMatch(relativeAutonomyRead(v), /low|poor|weak|bad|fail/i, 'a description, never a verdict');
  }
});

test('"your why" reaches the Reads tab, with no digit in it', async () => {
  const { db, memberId } = await freshDb();
  await db.query(
    `insert into motivation_reading (member_id, source, sequence_no, taken_on, scores, responses)
     values ($1,'b1',1,now(),$2,$3)`,
    [
      memberId,
      JSON.stringify(scoreWhy([7, 6, 7, 2, 1, 1, 3, 3, 2, 6, 6, 5])),
      JSON.stringify([7, 6, 7, 2, 1, 1, 3, 3, 2, 6, 6, 5]),
    ],
  );
  const reads = await memberReads(db, memberId);
  const why = reads.find((r) => r.label === 'your why');
  assert.ok(why, 'B1 now produces a read');
  assert.equal(why!.from, 'What’s Your Why?');
  const text = why!.lines.join(' ');
  assert.match(text, /Moving your body: mostly your own reasons/);
  assert.match(text, /Eating well: mostly pressure from outside/);
  assert.doesNotMatch(text, /\d/);
});

test('a reading stored BEFORE RAM existed yields no card, not a broken one', async () => {
  // Every B1 reading already in production predates this field. They must degrade to silence.
  const { db, memberId } = await freshDb();
  await db.query(
    `insert into motivation_reading (member_id, source, sequence_no, taken_on, scores, responses)
     values ($1,'b1',1,now(),$2,$3)`,
    [
      memberId,
      JSON.stringify({ activity: { autonomous: 6, controlled: 2, amotivation: 1 }, diet: { autonomous: 5, controlled: 3, amotivation: 2 } }),
      JSON.stringify(Array(12).fill(4)),
    ],
  );
  assert.equal((await memberReads(db, memberId)).find((r) => r.label === 'your why'), undefined);
});

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
  // THE RULE, NARROWED ON 2026-08-26 AND STILL LOAD-BEARING. A read's PROSE stays wordless — no digit in the
  // sentence a member reads about themselves. What changed is that the map now carries a separate PROFILE block
  // with Greg's three category percentages, because he asked for it twice and Jay ruled the no-number rule was
  // being applied too widely ("on a macro level we don't do it. On a micro level, it's ok to pick our spots").
  // The line between them is the point: a shape you can see is not a grade you can fail, and this assertion
  // guards the half that must never change.
  assert.doesNotMatch(text, /\d/, 'a read is plain language — no number in the prose, ever');
  // ...and this fixture stores a scores blob with ONLY perSkill — the shape of a reading written before `meta`
  // existed. It is why the profile degrades to null instead of throwing: reading it blind took the entire read
  // card down for anyone scored early.
  assert.equal(r.map?.profile ?? null, null, 'an early reading yields no profile, and still yields its read');
  assert.doesNotMatch(text, /weak|poor|low|failing|behind/i, 'a growth edge is a skill to practise, never a verdict');
  // Their strongest skill IS named — but in OUR words, not Greg's. This asserted /monitoring/i, the raw instrument
  // name, which the plain-language labels deliberately replaced ("Monitoring" -> "Watching how it is going"). The
  // intent of the assertion is that the read says something specific about this person rather than only naming a
  // family shape; the intent survives, the spelling of it changed. Skill 1 is their highest here (mean 4.8).
  assert.match(text, /sizing up what you need/i, 'their strongest skill, named — in plain language');
  assert.doesNotMatch(text, /\bmonitoring\b/i, "and never Greg's raw instrument name, which is not how we speak to a member");
  // The posture line DECLARES what a growth edge is rather than reassuring about what it isn't — the
  // "it's not X, it's Y" tic is one Jay has been cutting from member copy all week, and the strict assertion
  // above is what caught my first draft using it ("not a weakness to carry").
  //
  // The WORDING changed with the map rewrite ("a growth edge is simply the next one to practice" -> "Every one of
  // these is learnable"), because the lead already says where practice would pay and the two together read as the
  // same sentence twice. What must not change is that a posture line is PRESENT and stays declarative, so that is
  // what this asserts now — the line itself, plus the standing ban on reassurance phrasing.
  assert.match(text, /every one of these is learnable/i, 'the posture line is part of the read, not decoration');
  assert.doesNotMatch(text, /\bnot a (weakness|failing|verdict|score|grade)\b/i, 'declare what it IS — never reassure about what it is not');
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

test('the bigger-world read frames a CHOICE, not a ranking — WHEN there was one', async () => {
  // The member picked these. Copy that implies we ranked their life would be both wrong and a verdict.
  //
  // This test used to assert "You chose these" against a fixture with NO sort answer — so it pinned the card
  // claiming a choice the member had never made, and pinned it against the COMPUTED primary at that. The rule C2
  // exists to hold is that the member's choice leads; a test can encode the bug as easily as the code can.
  const { db, memberId } = await freshDb();
  await db.query(
    `insert into bigger_world_reading (member_id, source, sequence_no, taken_on, priorities, responses, reflections)
     values ($1,'c2',1,now(),$2,$3,$4)`,
    [
      memberId,
      JSON.stringify({ primary: 'outlook', secondary: 'self', momentumLever: 'physical' }),
      JSON.stringify(Array(16).fill(3)),
      JSON.stringify({ domains: {}, sort: { focus: 'social' } }),
    ],
  );
  const [r] = await memberReads(db, memberId);
  assert.equal(r!.label, 'your bigger world');
  const text = r!.lines.join(' ');
  assert.match(text, /chose to focus on: your social life/i, 'THEIR pick, not the computed primary');
  assert.doesNotMatch(text, /outlook/i, 'the ranking is never dressed up as their choice');
  assert.match(text, /You chose this/, 'attribution stays with the member');
  assert.doesNotMatch(text, /not a ranking|isn't a ranking/, 'declare what it is; do not reassure about what it is not');
  assert.doesNotMatch(text, /\d/);
});

test('and with NO choice on file it says so, rather than inventing one', async () => {
  const { db, memberId } = await freshDb();
  await db.query(
    `insert into bigger_world_reading (member_id, source, sequence_no, taken_on, priorities, responses)
     values ($1,'c2',1,now(),$2,$3)`,
    [memberId, JSON.stringify({ primary: 'social', momentumLever: 'physical' }), JSON.stringify(Array(16).fill(3))],
  );
  const text = (await memberReads(db, memberId))[0]!.lines.join(' ');
  assert.match(text, /Where your ratings point: your social life/i);
  assert.doesNotMatch(text, /you chose/i, 'never tell someone they made a call they were never asked to make');
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

test('a reading stored BEFORE RAM existed is RE-SCORED from its responses, not skipped', async () => {
  // Every B1 reading in production predates relativeAutonomous. The first version of this test asserted they
  // degrade to no card — true, and a waste: the raw responses have always been stored and scoreWhy is pure, so
  // the measure can simply be recomputed on read. That fixes every existing member at once with no migration.
  const { db, memberId } = await freshDb();
  await db.query(
    `insert into motivation_reading (member_id, source, sequence_no, taken_on, scores, responses)
     values ($1,'b1',1,now(),$2,$3)`,
    [
      memberId,
      // the OLD shape — three subscores, no relativeAutonomous
      JSON.stringify({ activity: { autonomous: 6, controlled: 2, amotivation: 1 }, diet: { autonomous: 5, controlled: 3, amotivation: 2 } }),
      JSON.stringify([7, 6, 7, 2, 1, 1, 3, 3, 2, 6, 6, 5]),
    ],
  );
  const why = (await memberReads(db, memberId)).find((r) => r.label === 'your why');
  assert.ok(why, 'an old reading still produces the card');
  assert.match(why!.lines.join(' '), /Moving your body: mostly your own reasons/);
});

test('an old reading with UNUSABLE responses degrades to no card, never a wrong one', async () => {
  // The recompute is a bonus, not a guarantee. If the responses are missing or the wrong length there is nothing
  // honest to say, and silence beats inventing a motivation profile for someone.
  const { db, memberId } = await freshDb();
  await db.query(
    `insert into motivation_reading (member_id, source, sequence_no, taken_on, scores, responses)
     values ($1,'b1',1,now(),$2,$3)`,
    [
      memberId,
      JSON.stringify({ activity: { autonomous: 6, controlled: 2, amotivation: 1 }, diet: { autonomous: 5, controlled: 3, amotivation: 2 } }),
      JSON.stringify([1, 2, 3]), // truncated — not the 12 the instrument needs
    ],
  );
  assert.equal((await memberReads(db, memberId)).find((r) => r.label === 'your why'), undefined);
});

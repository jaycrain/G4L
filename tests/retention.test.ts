import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { carryForward, describeCarryForward, UPSTREAM } from '../lib/curriculum/retention.ts';

// THE CARRY-FORWARD SPINE. Greg's twelve memos each declare what an asset retains and who reads it; we had built
// one link of twelve. These tests hold the two rules that make the mechanism safe to switch on — it is a WEB (the
// two culminating assets fan in), and an absent upstream is SILENT.

async function member(db: Db): Promise<string> {
  return (await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Pat','cf@x.test') returning member_id`,
  )).rows[0]!.member_id;
}

test('the fan-ins are declared — the case a previousAsset pointer cannot express', () => {
  // Transcribed from the Engineering memos' own `load prior module context` lines (all twelve read 2026-08-17).
  // B3's: "identity, motivation from B1, self-management appraisal from B2, disinformation awareness from W1,
  // visualization from W2, false-start protocol from W3" — FIVE resolvable assets, not the three I first built.
  assert.deepEqual(UPSTREAM.b3, ['b1', 'b2', 'w1', 'w2', 'w3'], 'B3 reads five');
  // C3 READS FIVE, from its Engineering memo's own words: "load prior module context (identity, motivation,
  // self-management, revised ReClaim List, Bigger World Audit assessment)". This shipped as ['b3','c2'] — two of
  // five — because it was built from a table synthesized off the GUIDANCE memos instead of the Engineering memo's
  // declaration. Pinned so the list can only change against the document.
  assert.deepEqual(UPSTREAM.c3, ['b1', 'b2', 'c1', 'c2', 'b3'], 'C3 reads five');

  // The load is CUMULATIVE — it grows as the member moves through. Asserted as a shape because the single
  // biggest error in this work was modelling it as pairwise handoffs.
  assert.ok(UPSTREAM.w1!.length < UPSTREAM.w3!.length, 'later Rewire assets load more than earlier ones');
  assert.ok(UPSTREAM.w3!.length < UPSTREAM.c1!.length, 'and C1 loads all three prior phases');

  // `identity` is loaded by four memos and defined by none, so R1 has no reader and no asset claims it.
  // Guessing whether it means the IDQ, the identity noun or the onboarding self-description would put a wrong
  // claim about a member in front of them. Open question for Greg.
  assert.ok(!Object.values(UPSTREAM).some((u) => (u as string[]).includes('r1')), 'nothing resolves `identity` yet');
});

test('a member who has done NONE of the upstream work carries nothing, and it renders as nothing', async () => {
  // THE RULE JAY SET (2026-08-17): silent. Rewire and Rebuild run in parallel, dosed per member, so B3 opening
  // with W3 never done is the program working as designed. If describeCarryForward returned a "none on file"
  // block, the model would narrate the absence and tell a member they are behind on a program built to let them
  // choose the order.
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  assert.deepEqual(await carryForward(db, m, 'b3'), []);
  assert.equal(describeCarryForward([]), null, 'null, not an empty block — nothing may reach the model');
});

test('a PARTIAL fan-in carries only what exists, and never names what is missing', async () => {
  // The common real case: someone doing Rebuild first reaches B3 with B2 done and W3 untouched.
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  await db.query(
    `insert into self_management_reading (member_id, source, sequence_no, taken_on, scores, responses)
     values ($1,'b2',1,now(),$2,$3)`,
    [m, JSON.stringify({ perSkill: [
      { no: 1, skill: 'a', mean: 4.8 }, { no: 2, skill: 'b', mean: 4.2 }, { no: 7, skill: 'c', mean: 2.1 },
    ] }), JSON.stringify(Array(24).fill(3))],
  );

  const carried = await carryForward(db, m, 'b3');
  assert.deepEqual(carried.map((c) => c.asset), ['b2'], 'only the one they did');

  const block = describeCarryForward(carried)!;
  assert.match(block, /their map/, 'what exists is named');
  assert.doesNotMatch(block, /\bW3\b|\bB1\b|False Start Protocol/, 'and what does not exist is never mentioned');
});

test('the rendered block instructs AGAINST reciting, listing, or implying they are behind', async () => {
  // The block is read by a model, so its own wording is the guardrail. Asserted because a future edit that
  // trims this for brevity would quietly turn the carry-forward into a recap at the top of every Session.
  const block = describeCarryForward([{ asset: 'b2', label: 'their map', lines: ['x'] }])!;
  assert.match(block, /in your own words/i);
  assert.match(block, /do not list these back/i);
  assert.match(block, /never imply they are behind/i);
  assert.match(block, /not as a recap/i);
});

test('B1 carries the motivational read WITHOUT a number — RB-1 holds across the seam', async () => {
  // B1's spec forbids showing a score, gauge or verdict. That rule does not weaken because the reader is another
  // Session rather than the member; a number in this block is a number one paraphrase away from the member.
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  //
  // UNCONDITIONAL ON PURPOSE. This was written as `if (b1) assert(...)` and passed while the reader was reading a
  // `scores.ram` field that does not exist — the RAM lives at scores.activity.relativeAutonomous. The link
  // returned null forever and the test reported green, which is the whole "existence is not the assertion"
  // failure in one line. If B1 stops carrying, this must go red.
  await db.query(
    `insert into motivation_reading (member_id, source, sequence_no, taken_on, scores, responses)
     values ($1,'b1',1,now(),$2,$3)`,
    [m, JSON.stringify({ activity: { relativeAutonomous: 2.5 }, diet: { relativeAutonomous: -1.5 } }),
     JSON.stringify(Array(12).fill(4))],
  );

  const carried = await carryForward(db, m, 'b3');
  const b1 = carried.find((c) => c.asset === 'b1');
  assert.ok(b1, 'B1 must carry forward — a silently dead link is the failure mode here');
  const text = b1.lines.join(' ');
  assert.doesNotMatch(text, /\d/, 'no digit may cross the seam — RB-1 does not weaken because the reader is a Session');
  // Both domains, because B3 plans a movement change AND an eating change against different motivations.
  assert.match(text, /movement/i);
  assert.match(text, /eating/i);
  assert.match(text, /own reasons/, 'their movement why is autonomous (+2.5)');
  assert.match(text, /pressure from outside/, 'and their eating why is not (-1.5)');
});

test('THE SEAM — both fan-ins are actually wired into their Sessions, not just declared', () => {
  // The registry and the Session are each easy to get right in isolation and never connect. That exact failure
  // (two correct, separately-tested functions never wired together) already cost us an infinite loop once.
  const rebuild = readFileSync('app/rebuild/actions.ts', 'utf8');
  assert.match(rebuild, /carryForward\(db, memberId, 'b3'\)/, 'B3 resolves its upstreams');
  assert.match(rebuild, /liveTurnRebuildB3\(state, history, message, describeCarryForward/, 'and passes them in');

  const rewire = readFileSync('app/rewire/actions.ts', 'utf8');
  const reclaim = readFileSync('app/reclaim/actions.ts', 'utf8');
  assert.match(reclaim, /carryForward\(db, memberId, 'c3'\)/, 'C3 resolves its upstreams');
  assert.match(reclaim, /liveTurnReclaimC3\(state, history, message, describeCarryForward/, 'and passes them in');

  // Rewire resolves ONE block for whichever session is running — the session key doubles as the UPSTREAM key.
  assert.match(rewire, /carryForward\(db, memberId, session\)/, 'W1/W2/W3 resolve their own upstreams');
  for (const fn of ['liveTurnRewireW3', 'liveTurnRewireW2', 'liveTurnRewire']) {
    assert.match(rewire, new RegExp(`${fn}\\(state, history, message, carried\\)`), `${fn} receives it`);
  }
  assert.match(reclaim, /carryForward\(db, memberId, 'c1'\)/, 'C1 resolves its upstreams');
  assert.match(reclaim, /liveTurnReclaimRefine\(state, history, message, carriedC1\)/, 'and C1 receives it');

  // And the engines must APPEND it, or the parameter is decoration.
  for (const f of ['lib/agent/rebuild.ts', 'lib/agent/reclaim.ts', 'lib/agent/rewire.ts']) {
    const src = readFileSync(f, 'utf8');
    assert.match(src, /carryForward \? `\\n\\n\$\{carryForward\}` : ''/, `${f} appends it to the system prompt`);
  }
  // rewire.ts has THREE model turns and each must append — one missed engine is a Session that silently forgets.
  assert.equal(
    (readFileSync('lib/agent/rewire.ts', 'utf8').match(/carryForward \? `\\n\\n\$\{carryForward\}` : ''/g) ?? []).length,
    3, 'all three Rewire engines append the block',
  );
});

test('B1 and B2 ARE wired now — the declarations they carried for months are honoured', () => {
  // THIS TEST USED TO ASSERT THE OPPOSITE, and the reason it flipped twice in one day is the point.
  //
  // It read: "B1, B2 and C2 are NOT wired — they have no model turn to wire into", and recorded that as a
  // deliberate program decision rather than a gap. That was honest at the time and it was also a description of
  // declarations that could never fire: UPSTREAM['b1'] and UPSTREAM['b2'] named what those Sessions should
  // arrive knowing, and nothing could ever deliver it, because both were Likert reads with no conversational
  // turn for a system prompt to exist in.
  //
  // Greg's five stages (B1.md:257, B2.md:441) gave both of them conversational beats on 2026-08-28, so the model
  // turns exist and the blocks go in. A declaration nothing can deliver is the defect class this codebase keeps
  // paying for, and it is worth noticing that this one spent months inside a PASSING test. [[no-unreachable-rules]]
  const src = readFileSync('lib/agent/rebuild.ts', 'utf8');
  const action = readFileSync('app/rebuild/actions.ts', 'utf8');
  for (const fn of ['liveTurnRebuildB1', 'liveTurnRebuildB2']) {
    assert.match(src, new RegExp(`export async function ${fn}\\(`), `${fn} has a model turn`);
  }
  assert.ok(
    (src.match(/carryForward \? `\\n\\n\$\{carryForward\}` : ''/g) ?? []).length >= 3,
    'B1, B2 and B3 each append the carry-forward block',
  );
  // The ACTION must actually resolve and pass it, or the parameter is decoration — which is exactly the shape
  // this test previously documented as fine.
  assert.match(action, /carryForward\(db, memberId, session\)/, 'the action resolves upstreams for the session');
  for (const fn of ['liveTurnRebuildB1', 'liveTurnRebuildB2']) {
    assert.match(action, new RegExp(`${fn}\\(state, history, message, describeCarryForward`), `${fn} is handed them`);
  }
});

test('C2 remains unwired — it still has no model turn to wire into', () => {
  // Unchanged and deliberate: C2's 20 ratings are an ADMINISTERED read end to end, and its live turn calls no
  // model, so there is no system prompt for a block to enter. Wiring it would mean giving that Session a
  // conversational turn it does not have — a program decision, not plumbing.
  assert.match(readFileSync('lib/agent/reclaim.ts', 'utf8'), /export function liveTurnReclaimC2\(/, 'still synchronous');
  for (const k of ['b1', 'b2', 'c2']) {
    assert.ok(UPSTREAM[k], `${k} still DECLARES its upstreams (the map is complete)`);
  }
});

test('EVERY reader in the registry actually carries — no silently dead links', async () => {
  // FIXED AS A CLASS, not one at a time. B1 was reading a field that does not exist and returned null forever;
  // any of the other four could be wrong the same way and would look identical from outside (an empty carry-
  // forward is indistinguishable from a member who has not done the work). So each is exercised through its own
  // REAL persist function rather than a hand-built row — if a store's shape moves, this goes red instead of the
  // link quietly going dark.
  const { saveW3Triggers } = await import('../lib/rewire/w3-triggers.ts');
  const { persistCoachingPlan } = await import('../lib/rebuild/plan-store.ts');
  const { persistBiggerWorldReading } = await import('../lib/reclaim/bigger-world-store.ts');
  const { recordB3Entry } = await import('../lib/rebuild/b3-entry.ts');

  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);

  await db.query(
    `insert into motivation_reading (member_id, source, sequence_no, taken_on, scores, responses)
     values ($1,'b1',1,now(),$2,$3)`,
    [m, JSON.stringify({ activity: { relativeAutonomous: 1.5 }, diet: { relativeAutonomous: 0 } }),
     JSON.stringify(Array(12).fill(4))],
  );
  await db.query(
    `insert into self_management_reading (member_id, source, sequence_no, taken_on, scores, responses)
     values ($1,'b2',1,now(),$2,$3)`,
    [m, JSON.stringify({ perSkill: [{ no: 1, skill: 'a', mean: 4.9 }, { no: 7, skill: 'b', mean: 2.0 }] }),
     JSON.stringify(Array(24).fill(3))],
  );
  assert.ok(await saveW3Triggers(db, m, ['The 3pm slump', 'Eating standing up']), 'w3 fixture wrote');
  await persistCoachingPlan(db, m, 'rebuild', { activityChange: 'Walk after dinner', dietChange: 'Protein at breakfast' });
  assert.equal(await recordB3Entry(db, m, { contributed: 'Laying the shoes out the night before' }), true);
  await persistBiggerWorldReading(db, m, Array(20).fill(3));
  await db.query(
    `insert into reclaim_item (member_id, text, category, sort_order) values ($1,$2,'physical',0)`,
    [m, 'Ride the Boulder loop again'],
  );

  // W1's true lines and W2's image live in the keeper store by keeper_type (lib/agent/rewire.ts).
  for (const [kt, body] of [['principle', 'I am not starting over, I am picking it back up'],
                            ['lights_you_up', 'Cresting the hill on the Boulder loop, still breathing easy']] as const) {
    await db.query(
      `insert into playbook_entry (member_id, section, body, authorship, state, keeper_type)
       values ($1,'own_words',$2,'gathered','kept',$3)`, [m, body, kt]);
  }
  // R2's Door profile and R3's Legacy Letter.
  await db.query(`insert into member_door (member_id, door_slug, is_primary, sort_order) values ($1,'career_cliff',true,0)`, [m]);
  const { noteDoorProfile } = await import('../lib/reconnect/door-profile.ts');
  await noteDoorProfile(db, m, [{ slug: 'career_cliff', stillOpen: true, relevance: 8 }]);
  const { saveLegacyLetter } = await import('../lib/reconnect/legacy-letter-store.ts');
  await saveLegacyLetter(db, m, { body: 'You did not lose it. You put it down to carry other things.', datedFor: '2027-01-01' });

  const b3 = await carryForward(db, m, 'b3');
  assert.deepEqual(b3.map((c) => c.asset), ['b1', 'b2', 'w1', 'w2', 'w3'], 'all five of B3\'s upstreams carry');
  assert.match(b3.find((c) => c.asset === 'w1')!.lines.join(' '), /picking it back up/, 'W1 verbatim');
  assert.match(b3.find((c) => c.asset === 'w2')!.lines.join(' '), /Cresting the hill/, 'W2 verbatim');

  // THE NEWLY-WIRED SESSIONS resolve their own sets. The seam test greps source, which proves the call exists;
  // this proves it returns the right thing. Rewire is cumulative across its own three Sessions.
  assert.deepEqual((await carryForward(db, m, 'w1')).map((c) => c.asset), ['r2', 'r3'], 'W1 loads Reconnect');
  assert.deepEqual((await carryForward(db, m, 'w2')).map((c) => c.asset), ['r2', 'r3', 'w1'], 'W2 adds W1');
  assert.deepEqual((await carryForward(db, m, 'w3')).map((c) => c.asset), ['r2', 'r3', 'w1', 'w2'], 'W3 adds W2');

  // The Reconnect readers, exercised through C1 — which loads all three prior phases.
  const c1 = await carryForward(db, m, 'c1');
  assert.deepEqual(c1.map((c) => c.asset), ['r2', 'r3', 'w1', 'w2', 'w3', 'b1', 'b2', 'b3'], 'C1 loads everything before it');
  assert.match(c1.find((c) => c.asset === 'r2')!.lines.join(' '), /still open/i, 'the active Fade carries');
  assert.match(c1.find((c) => c.asset === 'r3')!.lines.join(' '), /You did not lose it/, 'the Legacy Letter carries verbatim');
  // Their words survive VERBATIM where the store holds words — a paraphrased trigger is not their trigger.
  assert.match(b3.find((c) => c.asset === 'w3')!.lines.join(' '), /The 3pm slump; Eating standing up/);

  const c3 = await carryForward(db, m, 'c3');
  assert.deepEqual(c3.map((c) => c.asset), ['b1', 'b2', 'c1', 'c2', 'b3'], 'and all five of C3\'s');
  const b3line = c3.find((c) => c.asset === 'b3')!.lines.join(' ');
  assert.match(b3line, /Walk after dinner/, 'the plan they made');
  assert.match(b3line, /Laying the shoes out the night before/, 'and what the week taught, in their words');
});

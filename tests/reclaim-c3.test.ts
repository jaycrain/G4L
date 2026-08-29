// NOTE (2026-08-30): C3 now runs Greg's SETUP STAGES around this coach turn — stage 1 sets the stance
// ("tracking over time, not reflecting once"), stage 3 sets the expectations before monitoring starts, stage 4
// does the light planning. So these walks step through the doorway first, and a settled definition hands ON to
// stage 3 rather than completing the Session. The coach contract they test is unchanged; only its neighbours are.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { reclaimC3Opening, applyReclaimC3Turn } from '../lib/agent/reclaim.ts';
import { logQualityDay, recentQualityDays, activeQualityDayProfile, persistQualityDayProfile, profileElements } from '../lib/reclaim/quality-day-store.ts';
import { practicePrompt } from '../lib/practice/store.ts';
import type { ModelTurn } from '../lib/agent/onboarding.ts';

// C3 · Quality Days. Step 1 = coach-define the Quality-Day profile (propose→confirm). Step 2 = the daily log
// (quality_day_log, one/day upsert). Coach flow driven offline by synthetic ModelTurns; the log store via pglite.

const m = (text: string, qualityDay?: ModelTurn['qualityDay']): ModelTurn => ({ text, ...(qualityDay ? { qualityDay } : {}) });

test('C3 Step 1 · coach → propose → confirm; the profile lands in the snapshot for the action to store', () => {
  let t = reclaimC3Opening();
  assert.equal(t.state.stage, 'c3-open', "Greg's stage 1 — the stance, before any defining");
  assert.match(t.reply, /tracking over time rather than reflecting once/i, 'the stance (C3-79)');
  t = applyReclaimC3Turn(t.state, [], 'Movement, and not feeling behind.', m('Mm.'));
  assert.equal(t.state.stage, 'quality');
  assert.match(t.reply, /quality days lead to a quality life/i, 'the frame');

  // Turn 1: the member reflects; the model coaches (no record) → still coaching.
  t = applyReclaimC3Turn(t.state, [], 'a good day has movement, some calm, and real connection', m('Which of those feel truly non-negotiable?'));
  assert.equal(t.complete, false);
  assert.equal(t.state.collected?.pendingQualityDay, undefined, 'nothing recorded yet');

  // Turn 2: the model records the settled profile → the engine PROPOSES it.
  t = applyReclaimC3Turn(
    t.state,
    [],
    'yes those three',
    m('', { nonNegotiables: ['moved my body', 'ate reasonably well', 'some calm'], contributors: ['real connection', 'time outside'], disruptors: ['doomscrolling late'] }),
  );
  assert.equal(t.complete, false, 'proposing is not completing');
  assert.match(t.reply, /Non-negotiables/i, 'the proposal shows the tiers');
  assert.match(t.reply, /moved my body/i, 'their own words');
  assert.match(t.reply, /save this and start your week|adjust/i, 'the confirm gate');

  // Turn 3: confirm → complete; the profile is in the snapshot for the action to store.
  t = applyReclaimC3Turn(t.state, [], "yes, let's go", m(''));
  assert.equal(t.state.stage, 'c3-commit');
  assert.equal(t.state.collected?.pendingQualityDay?.nonNegotiables.length, 3);
  assert.match(t.reply, /what makes up your Quality Day/i, 'the committed close');
});

test('C3 Step 1 · "Please do" confirms the profile — not treated as an adjustment', () => {
  let t = reclaimC3Opening();
  t = applyReclaimC3Turn(t.state, [], 'Movement, mostly.', m('Mm.')); // through the stance beat
  t = applyReclaimC3Turn(t.state, [], 'a good day has movement and connection', m('Which feel non-negotiable?'));
  t = applyReclaimC3Turn(t.state, [], 'those', m('', { nonNegotiables: ['moved my body', 'some calm'], contributors: ['real connection'], disruptors: ['poor sleep'] })); // → proposal
  assert.equal(t.complete, false);
  // The natural reply to "Want me to save this…?" — must complete, not re-open coaching.
  t = applyReclaimC3Turn(t.state, [], 'Please do', m(''));
  // A CONFIRM ENDS STAGE 2, NOT THE SESSION (2026-08-30). The settled definition is what stages 3 and 4 build the
  // week on — the expectations and the plan sit between it and the first check-in.
  assert.equal(t.state.stage, 'c3-commit', '"Please do" is a confirm');
  assert.equal(t.complete, false, 'and C3 is not over — the week still has to be set up');
  assert.match(t.reply, /what makes up your Quality Day/i);
  assert.match(t.reply, /Consistency matters more than completeness/i, 'stage 3 (C3-81), before monitoring starts');
});

test('C3 Step 1 · a profile with no non-negotiables never proposes (they are the floor)', () => {
  const open = reclaimC3Opening();
  const t = applyReclaimC3Turn(open.state, [], 'Movement.', m('Mm.'));
  const t2 = applyReclaimC3Turn(t.state, [], 'not sure', m('', { nonNegotiables: [], contributors: ['x'], disruptors: [] }));
  assert.equal(t2.state.collected?.pendingQualityDay, undefined, 'no non-negotiables → nothing captured');
});

async function seedMember(db: Db, email: string): Promise<string> {
  return (await db.query<{ member_id: string }>(`insert into member_profile (display_name, email) values ('Pat', $1) returning member_id`, [email])).rows[0]!.member_id;
}

test('quality-day store · profile persists + reads back; daily log is one/day (upsert) with recent read', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const mem = await seedMember(db, 'pat-qd@x.com');

  await persistQualityDayProfile(db, mem, { nonNegotiables: ['move', 'eat well', 'calm'], contributors: ['connect'], disruptors: ['scroll'] });
  const profile = await activeQualityDayProfile(db, mem);
  assert.deepEqual(profile!.nonNegotiables, ['move', 'eat well', 'calm']);
  assert.deepEqual(profileElements(profile!), ['move', 'eat well', 'calm', 'connect'], 'elements = non-negotiables + contributors');

  await logQualityDay(db, mem, { score: 7, present: ['move', 'connect'], mostValuable: 'the walk' });
  await logQualityDay(db, mem, { score: 9, present: ['move', 'eat well', 'connect'] }); // same day → upsert
  const recent = await recentQualityDays(db, mem);
  assert.equal(recent.length, 1, 'one row per day (upserted)');
  assert.equal(recent[0]!.score, 9, 'the latest log wins');
  assert.deepEqual(recent[0]!.present, ['move', 'eat well', 'connect']);
});

test('practicePrompt · c3_quality is an observational daily nudge', () => {
  const nudge = practicePrompt('c3_quality', {});
  assert.match(nudge!, /quality day/i);
  assert.doesNotMatch(nudge!, /missed|failed|score/i, 'non-judgmental — noticing, not scoring');
});

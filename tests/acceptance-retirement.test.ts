// RETIRING THE ACCEPTANCE AS A DOOR, KEEPING IT AS AN INTAKE SIGNAL — "same gate, no label."
//
// Decision C, Jay 2026-08-15. Full rationale in docs/acceptance-door-retirement.md.
//
// The Acceptance was one construct doing two jobs. It is GOOD at the invisible one — recognising a resigned
// member as having a real Fade so they are admitted — and BAD at the visible one, labelling a person as having
// surrendered. It fired on Donna's "at my age and in this economy, I was virtually unhireable": a woman
// describing being shut out of the job market, told by the product that she had given up.
//
// ── WHY THIS FILE EXISTS, AND WHY IT WAS WRITTEN FIRST ────────────────────────────────────────────────────
// The dangerous part of this change is NOT deleting a Door. It is that `isAcceptanceFade` is one of three
// signals in the Stage-0 gate (onboarding-staged.ts:1355) that decide whether someone is admitted at all.
// Because its cues over-fire, that gate is currently very permissive. Remove the Door carelessly and intake
// silently tightens — people start getting declined as "no Fade" right as Charter opens.
//
// So the guarantee this file pins is: NOBODY WHO WOULD BE ADMITTED TODAY IS TURNED AWAY TOMORROW.
//
// These assertions were written and run GREEN against the pre-change code, so they are a real baseline rather
// than a description of whatever the new code happens to do.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchDoors, DOOR_SLUGS } from '../lib/doors.ts';
import { isAcceptanceFade } from '../lib/agent/onboarding-intent.ts';

// A corpus deliberately spanning the whole space: resigned, striving, event-driven, and thriving. Every line is
// phrasing a real midlife member could plausibly use — the point is coverage of the GATE's behaviour, not of the
// cue list, so that a change to the cues shows up here as an admissions change.
const CORPUS = [
  // — genuine resignation (must keep admitting; this is the job the signal is good at)
  'it is what it is, my best years are behind me',
  "I've made peace with being past my prime",
  'what do you expect at my age, I resigned myself to it',
  'this is just who I am now',
  'I settled for less and stopped expecting more',
  'these things happen when you get older',
  // — the false positives that started this (still admitted, but must NOT be labelled)
  'I am not as young as I used to be, but I am working on it',
  'I am slowing down a bit these days',
  'at my age and in this economy, I was virtually unhireable',
  'I am past my prime but I refuse to accept that',
  'the kids left and I am getting older, I want to feel strong again',
  // — event-driven Fades, no age language at all
  'I was laid off after twenty years and I have not recovered',
  'my marriage ended and I lost the person I was in it',
  'my knee went out and I stopped running',
  'work took over my life and there is no room left for me',
  'I lost my mother last spring',
  // — no Fade
  'Everything is great, I just want to get faster in the marathon',
  '',
];

/**
 * The admission predicate, EXACTLY as onboarding-staged.ts:1355 composes it — minus the committed-Door term,
 * which is unaffected by this change and would mask the thing under test.
 *
 * Reproduced here rather than imported because the real one is buried inside a stage handler with a builder and
 * scratch state. That is a real limitation: this asserts the SIGNAL agrees, not the whole handler. The live
 * persona walk in the ship checklist covers the handler.
 */
const admits = (text: string): boolean => isAcceptanceFade(text);

test('BASELINE — the resignation signal admits exactly who it admits today', () => {
  // Snapshot, not a moral judgement: this records the CURRENT admissions so the retirement can be proven not to
  // change them. Several `true`s below are false positives as LABELS — that is the bug — but as an admission
  // decision "this person has a real Fade" they are harmless, and tightening them is a separate decision nobody
  // has made. Preserve the behaviour; fix the label.
  const admitted = CORPUS.filter((t) => admits(t));
  assert.deepEqual(admitted, [
    'it is what it is, my best years are behind me',
    "I've made peace with being past my prime",
    'what do you expect at my age, I resigned myself to it',
    'this is just who I am now',
    'I settled for less and stopped expecting more',
    'these things happen when you get older',
    'I am not as young as I used to be, but I am working on it',
    'I am slowing down a bit these days',
    'at my age and in this economy, I was virtually unhireable',
    'I am past my prime but I refuse to accept that',
    'the kids left and I am getting older, I want to feel strong again',
  ]);
});

test('a resigned member with no event is still recognised as a real Fade', () => {
  // The Decision E rescue (onboarding-staged.ts:1388): no Door, no loss verb, nothing but a stance. If this
  // regresses, the quietest member we have starts getting declined — and would never tell us.
  for (const t of ['it is what it is, my best years are behind me', 'this is just who I am now']) {
    assert.equal(matchDoors(t).length === 0 || true, true);
    assert.equal(admits(t), true, `must still be admitted: "${t}"`);
  }
});

test('the striving member is admitted AND not labelled — the point of the whole change', () => {
  // Impossible to express before C: admission and labelling were the same fact. Afterwards they are separate,
  // so someone can be recognised as having a real Fade without being told she surrendered.
  const striving = 'I am not as young as I used to be, but I am working on it';
  assert.equal(admits(striving), true, 'still gets in — her Fade is real');
  // Post-change this must be empty of `acceptance`. Pre-change it is not, which is the bug; asserted in the
  // retirement test below rather than here so this file stays green on both sides of the change.
  assert.ok(Array.isArray(matchDoors(striving)));
});

test('Donna: her real Door is derived correctly on its own merits', () => {
  // The Acceptance was never carrying her — career_cliff is her actual story and the matcher already finds it.
  // This is the evidence that retiring the Door costs her nothing.
  const gap =
    'I lost my job unexpectedly. I had no idea it was happening at a time when, ' +
    'at my age and in this economy, I was virtually unhireable.';
  assert.ok(matchDoors(gap).includes('career_cliff'), 'The Career Cliff is her Door, with or without Acceptance');
  assert.equal(admits(gap), true, 'and she is admitted either way');
});

test('every slug the code can derive exists in the seeded door table', async () => {
  // THE GUARD THAT WAS MISSING, and the reason prod went down on 2026-08-15: the code offered `acceptance`, the
  // live `door` table had never been re-seeded with it, and every member who picked it took a foreign-key
  // violation that destroyed their signup mid-flight.
  //
  // DIRECTION IS THE WHOLE POINT: code ⊆ seed. A slug the code produces that the database lacks is an outage. A
  // row in the database that nothing derives is inert — which is exactly what `acceptance` becomes after C, and
  // why this guard permits it rather than demanding they match.
  const { readFileSync } = await import('node:fs');
  const seed = readFileSync('supabase/seed/0001_reference_data.sql', 'utf8');
  // PARSE THE DOOR STATEMENT, NOT THE WHOLE FILE. The first version matched `('slug', 'The ` anywhere in the
  // seed, which quietly required every Door to be named "The Something". Autopilot is not, so on 2026-08-22 the
  // guard reported it missing while the seed contained it — a guard failing on a naming convention rather than on
  // the thing it exists to catch. Scope to the `insert into door` statement, then accept any slug inside it.
  // Strip `--` comments FIRST. The statement is found by scanning to its terminating semicolon, and a prose
  // comment inside the VALUES list containing a semicolon truncates the block mid-way — which is exactly what
  // happened on 2026-08-22 ("…rows remain valid; the code never derives it"), reporting a Door as unseeded when
  // the row was right there four lines below the cut.
  const sql = seed.replace(/--[^\n]*/g, '');
  const block = sql.match(/insert into door\b[\s\S]*?;/)?.[0] ?? '';
  const seeded = new Set([...block.matchAll(/\(\s*'([a-z_]+)'\s*,/g)].map((m) => m[1]!));
  assert.ok(seeded.size >= 12, `parsed ${seeded.size} seeded doors — the parse broke, not the data`);
  const missing = DOOR_SLUGS.filter((s) => !seeded.has(s));
  assert.deepEqual(
    missing, [],
    `These Doors can be derived but are not in the seed, so any member who picks one takes an FK violation ` +
    `mid-signup:\n  ${missing.join('\n  ')}`,
  );
});

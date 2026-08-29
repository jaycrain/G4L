// C2'S OPENING FOUR BEATS, ITS EXPANSION-PATTERN CLOSE, AND GREG'S CAUSALITY FILTER.
//
// Jay, 2026-08-28: "C2 still has no elicitation or consolidation — it has reflect stages, but every one of them
// comes after a block of numbers." Right on all three counts.
//
// C2 is specified in SIX stages (C2-74..79), not the five B1 and B2 use. This covers the two ends — the ones that
// were missing outright — plus the one requirement in Greg's whole library that names its own enforcement layer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reclaimC2Opening, applyReclaimC2Turn } from '../lib/agent/reclaim.ts';
import { AUDIT_ITEMS, AUDIT_DOMAINS, type AuditDomain, type AuditFacet } from '../lib/reclaim/bigger-world-instrument.ts';
import { detectVoiceTells, applyVoiceGate } from '../lib/agent/voice-gate.ts';
import { readFileSync } from 'node:fs';
import { C2_EVOCATION } from './c2-evocation-tail.ts';
import type { ConvState } from '../lib/agent/onboarding.ts';

const SEP = String.fromCharCode(30);

test('C2-74 · all four opening beats appear before the first core question', () => {
  // Greg's testable-as, verbatim. The four: opening frame · acknowledge prior module work · set the stance (a
  // different KIND of question) · normalize mixed progress.
  const open = reclaimC2Opening();
  const bubbles = open.reply.split(SEP);
  assert.ok(bubbles.length >= 5, `expected four frame beats plus the question, got ${bubbles.length}`);
  const frame = bubbles.slice(0, -1).join('\n');
  assert.match(frame, /world can get bigger/i, 'beat 1 · the opening frame');
  assert.match(frame, /Doors|self-talk|pilot/i, 'beat 2 · acknowledges the work they came through');
  assert.match(frame, /different kind of question/i, 'beat 3 · sets the stance');
  // BEAT 4 IS THE ONE THAT WAS MISSING, and the one that matters most. Without it the first domain where nothing
  // has changed reads as a failure — so the honest answer becomes the expensive one, at question 1 of 20.
  assert.match(frame, /some will be exactly where they were|flat ones/i, 'beat 4 · normalizes mixed progress');
  assert.match(bubbles.at(-1)!, /\?$/, 'and the core question comes last');
});

// Build a 20-response array from a per-domain {facet: value} spec, in AUDIT_ITEMS order.
const build = (spec: Record<AuditDomain, Partial<Record<AuditFacet, number>>>): number[] =>
  AUDIT_ITEMS.map((it) => spec[it.domain]?.[it.facet] ?? 5);

/** Drive the whole audit to its close and return the final reply. */
function closeWith(responses: number[]): string {
  let t = applyReclaimC2Turn(reclaimC2Opening().state as ConvState, [], 'The mornings, mostly.');
  let i = 0;
  for (let d = 0; d < AUDIT_DOMAINS.length; d++) {
    for (let k = 0; k < 2; k++) t = applyReclaimC2Turn(t.state as ConvState, [], String(responses[i++]));
    t = applyReclaimC2Turn(t.state as ConvState, [], 'a gap');
    for (let k = 0; k < 3; k++) t = applyReclaimC2Turn(t.state as ConvState, [], String(responses[i++]));
    for (const a of ['an obstacle', 'a first move']) t = applyReclaimC2Turn(t.state as ConvState, [], a);
  }
  for (let q = 0; q < 5; q++) t = applyReclaimC2Turn(t.state as ConvState, [], 'physical');
  // Then Greg's evocation stages, which now stand between the sort and the summary.
  for (const m of C2_EVOCATION) t = applyReclaimC2Turn(t.state as ConvState, [], m, { text: 'Mm.' });
  assert.equal(t.complete, true, 'the audit reached its close');
  return t.reply;
}

test('C2-79 · the close names BOTH what opened and what is still narrow', () => {
  // Physical is nearly where they want it (gap 1); Social is far from it (gap 7). A close that names only the
  // priority answers "what should I do", which is not the question twenty items about the size of your life ask.
  const reply = closeWith(build({
    physical: { current: 8, desired: 9, importance: 5, readiness: 5, ripple: 5 },
    self: { current: 5, desired: 8, importance: 5, readiness: 5, ripple: 5 },
    social: { current: 2, desired: 9, importance: 9, readiness: 4, ripple: 8 },
    outlook: { current: 5, desired: 8, importance: 5, readiness: 5, ripple: 5 },
  }));
  assert.match(reply, /Physical life is the closest to the size you want it/i, 'names where room has opened');
  assert.match(reply, /Social life is still the narrowest/i, 'and names what is still narrow');
  assert.match(reply, /not a contradiction/i, 'and holds both without resolving one into the other');
  // C2-79's closing frame — what the noticing is FOR.
  assert.match(reply, /Noticing where your life is opening/i, 'the closing frame');
});

test('the pattern is not invented when there is none', () => {
  // C2-37: "do not supply the narrative of growth." A perfectly flat set has no expansion pattern, and naming one
  // from a tie would be exactly the supplied narrative Greg forbids.
  const reply = closeWith(AUDIT_ITEMS.map(() => 5));
  assert.doesNotMatch(reply, /closest to the size you want it/i, 'no pattern claimed from a flat set');
  assert.match(reply, /best next focus/i, 'the priority read still lands');
});

test('the expansion pattern leads — the reading before the assignment', () => {
  const reply = closeWith(build({
    physical: { current: 8, desired: 9, importance: 5, readiness: 5, ripple: 5 },
    self: { current: 5, desired: 8, importance: 5, readiness: 5, ripple: 5 },
    social: { current: 2, desired: 9, importance: 9, readiness: 4, ripple: 8 },
    outlook: { current: 5, desired: 8, importance: 5, readiness: 5, ripple: 5 },
  }));
  assert.ok(
    reply.indexOf('closest to the size you want it') < reply.indexOf("best next focus"),
    'a member who gets the assignment before the reading has been handed homework in place of a reflection',
  );
});

test('C2-81 · the causality deny-list is enforced at the generation layer, not only in a prompt', () => {
  // The single requirement in Greg's library that names its own enforcement layer: "This constraint should be
  // enforced at the generation policy layer." It had never been built. Every one of these turns a member's own
  // noticing into a claim the system is making ABOUT them, which is the move the whole program forbids.
  const FORBIDDEN = [
    'This proves your world is bigger.',
    'That reveals real change.',
    'This guarantees it will keep going.',
    'Your world is objectively bigger now.',
    "That demonstrates you've overcome the Fade.",
    'This is evidence of psychological flexibility.',
  ];
  for (const line of FORBIDDEN) {
    const tells = detectVoiceTells(line);
    assert.ok(tells.some((t) => t.startsWith('causality:')), `not caught: "${line}"`);
  }
});

test('and Greg’s ALLOW-list phrasing passes clean', () => {
  // The other half, and the reason this is report-only rather than a deletion: the fix is a rewrite into his
  // approved register, which only the model can do. A filter that flagged these too would be untrustworthy.
  for (const ok of [
    'That can help you notice where the room is.',
    'It may be showing you something about the mornings.',
    'People sometimes find that it gets easier to see.',
    'It often becomes easier to see once you name it.',
  ]) {
    assert.deepEqual(detectVoiceTells(ok).filter((t) => t.startsWith('causality:')), [], `false positive on "${ok}"`);
  }
});

test('C2’s own authored close obeys the deny-list it is now guarded by', () => {
  // THE HALF A PROMPT RULE CANNOT ENFORCE. The gate runs on MODEL text only, by design — so authored copy is
  // exactly where a forbidden formulation could ship unchallenged, and this close is the copy most tempted by it.
  const reply = closeWith(build({
    physical: { current: 8, desired: 9, importance: 5, readiness: 5, ripple: 5 },
    self: { current: 5, desired: 8, importance: 5, readiness: 5, ripple: 5 },
    social: { current: 2, desired: 9, importance: 9, readiness: 4, ripple: 8 },
    outlook: { current: 5, desired: 8, importance: 5, readiness: 5, ripple: 5 },
  }));
  assert.deepEqual(detectVoiceTells(reply).filter((t) => t.startsWith('causality:')), [], 'the close overclaims');
  assert.deepEqual(detectVoiceTells(reclaimC2Opening().reply).filter((t) => t.startsWith('causality:')), [], 'the open overclaims');
});

test('the gate’s report half is actually WIRED — not exported into the void', () => {
  // THE REASON THIS TEST EXISTS. detectVoiceTells had been exported since the voice gate shipped and had ZERO
  // callers — its only mention anywhere was a comment in gate-claims.ts describing what it was for. The
  // measurement Donna's report asked for ("is the prompt holding, or is the gate carrying it alone?") had
  // therefore never been taken once, and adding Greg's deny-list to it would have shipped equally dead.
  //
  // Asserted at the SEAM, not on the function: a detector with no caller passes every unit test it has.
  // [[no-unreachable-rules]] [[existence-is-not-the-assertion]]
  const src = readFileSync(new URL('../lib/agent/onboarding-staged.ts', import.meta.url), 'utf8');
  assert.match(src, /const gated = applyVoiceGate\(/, 'the gate runs at the one model-text seam');
  assert.match(src, /gated\.flagged/, 'and its report half is read, not discarded');

  // And the result carries both halves — what it deleted AND what it could only see.
  const r = applyVoiceGate('This proves it, and that quietly cost you.');
  assert.ok(r.removed.includes('quietly'), 'the deletable tell was deleted');
  assert.ok(r.flagged.includes('causality:proves'), 'the un-deletable one was reported');
  assert.match(r.text, /This proves it/, 'and report-only means the sentence is left intact');
});

// ── GREG'S EVOCATION STAGES (C2-75..78) ───────────────────────────────────────────────────────────────────────
//
// "This is where most of C2 lives" (C2-37) — and none of it existed. C2 ran its ratings, its per-domain
// reflections and its sort, then closed, so every reflective turn came AFTER a block of numbers and was about the
// domain just rated. The question the Session actually asks — has your world got bigger — was never put directly.
//
// Jay, 2026-08-28: "Build stages 2-4, don't cut C2 short now. I'll feel it when I walk it, Greg can too and trim
// it if he wants. Let's put it all out there to decide." Stage 5 is built with them: it is one turn, and it is
// the stage that makes the carry-forward mean anything.

/** Drive to the end of the sort, where the evocation begins. */
function toSort(): ConvState {
  let t = applyReclaimC2Turn(reclaimC2Opening().state as ConvState, [], 'The mornings, mostly.');
  for (let d = 0; d < AUDIT_DOMAINS.length; d++) {
    for (let k = 0; k < 2; k++) t = applyReclaimC2Turn(t.state as ConvState, [], '5');
    t = applyReclaimC2Turn(t.state as ConvState, [], 'a gap');
    for (let k = 0; k < 3; k++) t = applyReclaimC2Turn(t.state as ConvState, [], '5');
    for (const a of ['an obstacle', 'a first move']) t = applyReclaimC2Turn(t.state as ConvState, [], a);
  }
  for (let q = 0; q < 5; q++) t = applyReclaimC2Turn(t.state as ConvState, [], 'physical');
  return t.state as ConvState;
}

test('the sort hands into the evocation, not into the close', () => {
  const st = toSort();
  assert.equal(st.stage, 'c2-expansion', 'the Session no longer ends the moment the ratings stop');
});

test('all four evocation stages run, in Greg’s order', () => {
  let st = toSort();
  const seen: string[] = [st.stage as string];
  for (const m of C2_EVOCATION) {
    const t = applyReclaimC2Turn(st, [], m, { text: 'Mm.' });
    st = t.state as ConvState;
    seen.push(st.stage as string);
    if (t.complete) break;
  }
  const order = ['c2-expansion', 'c2-contraction', 'c2-approach', 'c2-prior-work', 'complete'];
  for (const stage of order) assert.ok(seen.includes(stage), `${stage} never ran`);
  assert.deepEqual([...new Set(seen)].filter((x) => order.includes(x)), order, 'and in his order');
});

test('C2-75 · expansion asks three questions PLUS the conditions-and-stability follow-up', () => {
  // Greg's testable-as, and the reason the floor is four rather than three: "Follow up on conditions and
  // stability" is a separate beat from the three noticing questions, and it is the one that asks whether what
  // opened will hold.
  let st = toSort();
  const asked: string[] = [];
  for (let i = 0; i < 4; i++) {
    const t = applyReclaimC2Turn(st, [], C2_EVOCATION[i]!, { text: '' });
    asked.push(t.reply);
    st = t.state as ConvState;
  }
  const joined = asked.join('\n');
  assert.match(joined, /more willing/i, 'where they are more willing');
  assert.match(joined, /stopped avoiding/i, 'what they have stopped avoiding');
  assert.match(joined, /would it hold|hold if/i, 'the conditions-and-stability follow-up');
  assert.equal(st.stage, 'c2-contraction', 'and only then does it move on');
});

test('C2-76 · the contraction beat proposes no fix — in the engine AND in the prompt', () => {
  // Greg's testable-as: "A contraction stage exists and the Companion does not propose fixes inside it." A member
  // who has just said where their life is still too small is exactly who a helpful model wants to rescue, and
  // rescuing them ends the beat — the honest answer becomes a task, and the next one becomes what we want to hear.
  let st = toSort();
  for (let i = 0; i < 4; i++) st = applyReclaimC2Turn(st, [], C2_EVOCATION[i]!, { text: '' }).state as ConvState;
  assert.equal(st.stage, 'c2-contraction');
  const t = applyReclaimC2Turn(st, [], 'Social is still thin.', { text: '' });
  // The ENGINE's own probe must not offer a remedy — it asks what slightly bigger looks like, which is still
  // their picture, not our plan.
  assert.doesNotMatch(t.reply, /you (should|could|might want to)|why not|have you tried|what if you/i, 'a fix was proposed');
  assert.match(t.reply, /slightly bigger/i, "and it asks for THEIR picture of it");
  // The prompt half, which the engine cannot enforce on generated prose.
  const src = readFileSync(new URL('../lib/agent/reclaim.ts', import.meta.url), 'utf8');
  assert.match(src, /Do not fix, plan, encourage or reframe/i, 'the contraction stage note forbids it');
});

test('C2-77 · approach is distinct from expansion, not a rephrasing of it', () => {
  // Greg says so explicitly ("Stage 4 is present and distinct from stage 2"), and the distinction is real: what
  // has already opened is not the same as what pulls you. A member can have either without the other.
  let st = toSort();
  for (let i = 0; i < 6; i++) st = applyReclaimC2Turn(st, [], C2_EVOCATION[i]!, { text: '' }).state as ConvState;
  assert.equal(st.stage, 'c2-approach');
  const t = applyReclaimC2Turn(st, [], 'Toward being someone my kids call.', { text: '' });
  assert.match(t.reply, /worth moving toward/i, 'the follow-up asks what makes it worth it');
});

test('C2-78 · the prior-work connection is asked as a QUESTION, never asserted', () => {
  // "Only to support the Member's own noticing, never to override it." Our conclusion about their earlier work,
  // stated, is the override — the same failure as supplying the narrative of growth, one stage later.
  let st = toSort();
  for (let i = 0; i < 8; i++) st = applyReclaimC2Turn(st, [], C2_EVOCATION[i]!, { text: '' }).state as ConvState;
  assert.equal(st.stage, 'c2-prior-work');
  // The probe that opened this stage is the last reply before it; assert the authored text itself.
  const src = readFileSync(new URL('../lib/agent/reclaim.ts', import.meta.url), 'utf8');
  const probe = src.match(/const C2_PRIOR_WORK_PROBES = \[\s*'([^']+)'/)![1]!;
  assert.match(probe, /\?$/, 'phrased as a question');
  assert.doesNotMatch(probe, /you have|this shows|clearly/i, 'and makes no claim about them');
});

test('the evocation never claims cause, and never supplies the growth narrative', () => {
  // The deny-list applies to the authored probes too — the gate only sees MODEL text, so this copy is exactly
  // where a forbidden formulation could ship unchallenged.
  let st = toSort();
  const replies: string[] = [];
  for (const m of C2_EVOCATION) {
    const t = applyReclaimC2Turn(st, [], m, { text: '' });
    replies.push(t.reply);
    st = t.state as ConvState;
    if (t.complete) break;
  }
  const all = replies.join('\n');
  assert.deepEqual(detectVoiceTells(all).filter((x) => x.startsWith('causality:')), [], 'the evocation overclaims');
  assert.doesNotMatch(all, /you'?re clearly doing more|real progress|you'?ve grown/i, 'the narrative was supplied');
});

test('Greg’s FULL science-check deny-list is enforced, not the C2-81 fragment', () => {
  // C2-81 gave six terms inside one asset's spec and looked complete. The rule itself lives in "AI Companion
  // Guidance for [Reclaim] Science-Check Language and Goal-Reflection Dialogue" (13 July, 2,416 words) — which had
  // never reached the library and was found on 2026-08-29 auditing his corpus at Jay's direction. One day after
  // building the fragment. A rule extracted from a single asset is a subset until you check.
  const OVERCLAIMS = [
    'This will transform how you see yourself.',
    'That unlocks your real purpose.',
    'This will fix your motivation.',
    'It eliminates the pattern for good.',
    'This permanently rewires your goals.',
    'Now you know exactly what matters.',
    'That exercise revealed the real you.',
    'This is the reason you struggle.',
    "You've outgrown those goals.",
    'It shows exactly who you are.',
    'This will change your life.',
    'Now you know what really matters.',
  ];
  for (const line of OVERCLAIMS) {
    assert.ok(detectVoiceTells(line).some((t) => t.startsWith('causality:')), `not caught: "${line}"`);
  }
});

test('and the narrowed rules do not eat the product’s own vocabulary', () => {
  // "fix" and "resolve" are scoped to the overclaiming sense deliberately. A bare match would fire on "a fixed
  // trait" — copy B1 and B2 NEED, because the whole teaching point is that skills are not fixed — and on
  // "conflict resolution", one of Greg's twelve skill names. A guard that eats our own words is worse than the
  // tell it removes; that is what the "quiet"/"Quiet Day" exemption taught this file.
  for (const ok of [
    'These are skills, not fixed traits.',
    'Conflict resolution is one of the twelve.',
    'Your motivation is not a fixed quantity.',
    'It can help you notice where the room is.',
  ]) {
    assert.deepEqual(detectVoiceTells(ok).filter((t) => t.startsWith('causality:')), [], `false positive: "${ok}"`);
  }
});

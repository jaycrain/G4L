// A WIRE ANSWER IS A FACT ONLY AT THE SURFACE THAT OFFERED IT.
//
// THE SECOND HALF OF THE TAP RULE. On 2026-09-01 we fixed the first: four beats offered chips and then read the
// reply with the free-text classifier, so a tap arrived and nothing happened (Donna: "I clicked That's It button
// and it kept coming back"). Every site now reads the tap first. None of them asks whether the chips were on
// screen — and `memberWantsToAdvance` treats a `done` tap as an instruction to move on that SKIPS THE DEPTH FLOOR
// ENTIRELY (`if (memberWantsToMove) return true`, ahead of every other check).
//
// So a beat-confirm string arriving mid-draw-out advances a Door at depth ZERO: no material, nothing said about
// it, straight to "here is what I think this meant". The member's most vulnerable beat, resolved by a tap that
// belonged to a different Door.
//
// THE ORDINARY WAY THIS HAPPENS IS A DOUBLE-TAP. She taps "That's it" on one Door's insight; the confirm resolves
// and the next Door's opener goes on screen; a second copy of that tap — an impatient double-press, a retried
// request, a client resend — lands in the new Door's draw-out. Everywhere else in the product a duplicate submit
// is inert. Here it skips a Door's excavation and then reports it walked.
//
// FOUND BY THE GATE, ON A RUN THAT PASSED. The instrumentation left behind after the double-back logged "tap
// reached the draw-out, not the confirm" on two consecutive GREEN runs. Nothing failed; the line is the only
// reason anyone looked. [[read-the-artifact-not-the-summary]]
//
// The persona typing the wire string as prose is what produced it in the walk — a harness fault, fixed separately
// — but what it exposed is reachable by a member with a slow connection and two thumbs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyReconnectTurn, RECONNECT_R2_ARC } from '../lib/agent/reconnect.ts';
import { applyStagedTurn } from '../lib/agent/onboarding-staged.ts';
import { serializeBeatConfirm } from '../lib/agent/beat-confirm.ts';
import { serializeGapConfirmChoice } from '../lib/agent/gap-confirm-choice.ts';
import { isStaleWireAnswer, wireAnswerKind } from '../lib/agent/wire-answer.ts';
import type { ConvState, Collected } from '../lib/agent/onboarding.ts';

const TAP = serializeBeatConfirm('done');

/** Mid-excavation on a Door she has said nothing about yet — exactly where the duplicate lands. */
const midDrawout = (): ConvState => ({
  stage: 'doors',
  awaitingConfirm: false, // the draw-out, NOT a confirm — this is the whole point
  collected: {
    identityNoun: 'Conductor',
    boardDone: true,
    doors: ['career_cliff', 'loss'],
    doorsExcavated: ['career_cliff'],
  } as Collected,
  stageScratch: { doors: { openedDoor: 'loss', doorDepth: 0 } },
} as unknown as ConvState);

test('a beat-confirm tap arriving mid-draw-out does not advance the Door', () => {
  const out = applyReconnectTurn(midDrawout(), [], TAP, { text: 'Tell me more about that.' }, RECONNECT_R2_ARC);

  assert.equal(out.state.awaitingConfirm ?? false, false,
    'the stale tap advanced the Door to its insight confirm — on zero material, because memberWantsToAdvance skips the floor');
  assert.notEqual((out as { expects?: { kind?: string } }).expects?.kind, 'beat_confirm',
    'and it must not put the confirm chips up for a Door she has not spoken about');
});

test('THE DOUBLE-TAP, end to end — the same tap twice must not cost her a Door', () => {
  // The production sequence, driven through the engine rather than asserted about a hand-built state. This is the
  // load-bearing test in this file: the two turns below are what a member with two thumbs and a slow connection
  // actually produces.
  const atConfirm: ConvState = {
    stage: 'doors', awaitingConfirm: true,
    collected: { identityNoun: 'Conductor', boardDone: true, doors: ['career_cliff', 'loss'], doorsExcavated: [] } as Collected,
  } as unknown as ConvState;

  // Turn 1 — the real tap. It banks the Door and puts the NEXT Door's opener on screen.
  const first = applyReconnectTurn(atConfirm, [], TAP, { text: '' }, RECONNECT_R2_ARC);
  assert.deepEqual((first.state.collected as Collected).doorsExcavated, ['career_cliff'], 'the real tap banks');
  assert.equal(first.state.awaitingConfirm ?? false, false, 'and the engine is now mid-draw-out on The Loss');

  // Turn 2 — the duplicate, arriving against the state turn 1 produced.
  const second = applyReconnectTurn(first.state, [], TAP, { text: 'Say more about that.' }, RECONNECT_R2_ARC);
  assert.equal(second.state.awaitingConfirm ?? false, false,
    'the duplicate advanced The Loss to its insight check — a Door she has said nothing about, at depth zero');
  assert.deepEqual((second.state.collected as Collected).doorsExcavated, ['career_cliff'],
    'and no second Door may be banked on a tap that belonged to the first');
});

test('the stale tap is not banked as her words for the Door', () => {
  // A REGRESSION GUARD, NOT A PROOF — it was already green before the fix, because `isKeeperMaterial` happens to
  // refuse a string this short. Kept deliberately and labelled honestly: it holds the second, quieter cost in
  // place if that ever loosens. Her verbatim words for a Door are handed to the action when it closes, and
  // machine syntax reaching that list writes into her own record. [[existence-is-not-the-assertion]]
  const out = applyReconnectTurn(midDrawout(), [], TAP, { text: 'Tell me more.' }, RECONNECT_R2_ARC);
  const words = ((out.state.stageScratch?.doors ?? {}) as { doorWords?: string[] }).doorWords ?? [];
  assert.ok(!words.some((w) => /\[beat-confirm\]/.test(w)), `a wire string was stored as her words: ${JSON.stringify(words)}`);

  const excavated = (out.state.collected as Collected).doorsExcavated ?? [];
  assert.deepEqual(excavated, ['career_cliff'], 'and no Door is marked walked on the strength of it');
});

test('A REAL TAP STILL WORKS — the guard must not refuse the answer it was built to protect', () => {
  // The failure in the other direction, and the more expensive one: over-blocking would break the beat Donna
  // reported twice. Same message, same beat, the only difference being that the engine IS waiting on it.
  const atConfirm = { ...midDrawout(), awaitingConfirm: true } as ConvState;
  const out = applyReconnectTurn(atConfirm, [], TAP, { text: '' }, RECONNECT_R2_ARC);
  const excavated = (out.state.collected as Collected).doorsExcavated ?? [];
  assert.ok(excavated.includes('loss' as never), 'an offered tap must still bank the Door it answers');
});

test('the rule is about being OFFERED, not about the Doors stage', () => {
  // gap_confirm has the same shape and the same exposure — it is offered only while the beat waits on her.
  const gapTap = serializeGapConfirmChoice('done');
  const drawout: ConvState = { stage: 'gap', awaitingConfirm: false, collected: { gap: 'The restaurant closed.' } as Collected };
  const offered: ConvState = { stage: 'gap', awaitingConfirm: true, collected: { gap: 'The restaurant closed.' } as Collected };

  assert.equal(isStaleWireAnswer(gapTap, drawout), true, 'unoffered → stale');
  assert.equal(isStaleWireAnswer(gapTap, offered), false, 'offered → a real answer');

  // And the neutralised message must not be captured as her fade story.
  const gap = (applyStagedTurn(drawout, [], gapTap, { text: '' }).state.collected as Collected).gap ?? '';
  assert.ok(!/\[gap-confirm\]/.test(gap), `a wire string reached her fade story: "${gap}"`);
});

test('ordinary prose is never mistaken for a tap', () => {
  // The mirror of the bug the parsers already guard against. A member who writes about a form, or types a bracket,
  // must pass through untouched — this guard may only ever refuse machine syntax.
  for (const prose of [
    "That's it — that's the one.",
    'done',
    'I clicked the [That\'s it] button and it kept coming back',
    '',
  ]) {
    assert.equal(wireAnswerKind(prose), null, `read as a tap: "${prose}"`);
  }
});

// ── THE INVARIANT THE DERIVATION RESTS ON ────────────────────────────────────────────────────────────────────
//
// `wireAnswerWasOffered` decides beat_confirm by `awaitingConfirm`, which is only sound because all five sites
// that offer these chips set that flag in the same branch. Nothing in the type system holds that together, and
// a sixth site that offered chips without it would make the guard start refusing REAL taps — the 2026-09-01 bug
// rebuilt, from the fix for it.
//
// So it is asserted rather than trusted. This reads source, which is coarse, and it is deliberately the coarse
// direction: it can only fail when a new offer site appears, and the person adding one is exactly who needs to
// read this note.
test('every site offering beat-confirm chips also sets awaitingConfirm', () => {
  const src = readFileSync(new URL('../lib/agent/reconnect.ts', import.meta.url), 'utf8').split('\n');
  const sites = src.flatMap((line, i) => /b\.expects = beatConfirm/.test(line) ? [i] : []);
  assert.ok(sites.length >= 5, `expected the five known offer sites, found ${sites.length}`);

  for (const i of sites) {
    // Scan back to the nearest decision about the flag. `= true` before `= false` means this branch is a gate.
    let verdict: string | null = null;
    for (let j = i; j > i - 40 && j >= 0; j--) {
      const m = src[j]!.match(/b\.awaitingConfirm = (true|false)/);
      if (m) { verdict = m[1]!; break; }
    }
    assert.equal(verdict, 'true',
      `line ${i + 1} offers beat-confirm chips without setting awaitingConfirm — the stale-tap guard will now `
      + 'refuse real taps at this beat. Set the flag, or teach wireAnswerWasOffered about this surface.');
  }
});

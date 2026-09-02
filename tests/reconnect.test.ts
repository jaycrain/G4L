import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reconnectCallback, reconnectOpening, applyReconnectTurn, reconnectEnabled } from '../lib/agent/reconnect.ts';
import type { Collected, ConvMessage, ConvState } from '../lib/agent/onboarding.ts';
import { TOTAL_ITEMS } from '../lib/idq/instrument.ts';
import { boardShownSlugs } from '../lib/agent/doors-board-expectation.ts';
import { DOORS } from '../lib/doors.ts';
import { BEAT_SEP } from '../lib/agent/onboarding.ts';
import { serializeBeatConfirm } from '../lib/agent/beat-confirm.ts';

// ============================================================================================================
// v2.2 Reconnect — SKELETON + callback (§2a). The callback READS the committed captures (never the transcript)
// and opens the deeper work as a REVISABLE check. Read-only this increment: it writes nothing, revises nothing.
// ============================================================================================================

test('reconnect · flag defaults OFF (never runs in prod until the coupled flip)', () => {
  const prev = process.env.RECONNECT;
  delete process.env.RECONNECT;
  assert.equal(reconnectEnabled(), false);
  if (prev !== undefined) process.env.RECONNECT = prev;
});

// --- the callback opener across capture richness ---------------------------------------------------------
test('reconnect callback · a named Door → the revisable check lands on it by name', () => {
  const committed: Collected = { identityNoun: 'Player', doors: ['grind'], gap: 'The grind slowly crowded him out over years.', reclaimList: ['ride my bike', 'see friends'] };
  const reply = reconnectCallback(committed);
  assert.match(reply, /the Player/, 'names who they are reclaiming');
  assert.match(reply, /The Grind/, 'names the primary Door by its branded name');
  assert.match(reply, /still where it feels like it began|has something shifted/i, 'frames it as REVISABLE, not a fixed recap');
  assert.match(reply, /deeper/i, 'signals the deeper work');
});

test('reconnect callback · MULTIPLE recognized Doors → primary named, the second acknowledged (never dropped)', () => {
  const committed: Collected = { identityNoun: 'Player', doors: ['grind', 'marriage'], gap: 'x' };
  const reply = reconnectCallback(committed);
  assert.match(reply, /The Grind/, 'the primary Door is named');
  assert.match(reply, /The Relationship/, 'the second recognized Door is acknowledged, not silently dropped');
  assert.match(reply, /tangled up/i, 'lightly links them rather than listing');
  // three+ doors: primary named, the rest acknowledged as a group
  const many = reconnectCallback({ identityNoun: 'Player', doors: ['grind', 'marriage', 'body'], gap: 'x' });
  assert.match(many, /The Grind/, 'primary named even with several');
  assert.match(many, /couple of others|stacked/i, 'the rest are acknowledged, not enumerated');
});

test('reconnect callback · GRACEFUL DEGRADE — no Door tagged → opens on the gap story, still revisable', () => {
  const committed: Collected = { identityNoun: 'Runner', doors: [], gap: 'It opened slowly when caregiving took all my time.' };
  const reply = reconnectCallback(committed);
  assert.doesNotMatch(reply, /\bThe [A-Z]/, 'no Door name fabricated when none was committed');
  assert.match(reply, /the Runner/, 'still anchors on the identity');
  assert.match(reply, /deeper|still feel/i, 'opens on the story and invites revision');
});

test('reconnect callback · GRACEFUL DEGRADE — identity was skipped → no identity reference', () => {
  const committed: Collected = { identitySkipped: true, doors: ['marriage'], gap: 'The marriage drifted into coexisting.' };
  const reply = reconnectCallback(committed);
  assert.doesNotMatch(reply, /reclaiming —/, 'does not reference an identity the member never named');
  assert.match(reply, /The Relationship/, 'still lands on the committed Door');
});

test('reconnect callback · GRACEFUL DEGRADE — thin/null captures → a warm open that does NOT fake continuity', () => {
  const committed: Collected = { identitySkipped: true, doors: [], gap: '' };
  const reply = reconnectCallback(committed);
  assert.doesNotMatch(reply, /The [A-Z]\w+/, 'no Door invented');
  assert.doesNotMatch(reply, /you (started to )?tell me how/i, 'does not claim a gap story that was never captured');
  assert.match(reply, /pick up|deeper/i, 'still a warm hand-off into the deeper work');
});

// --- the opening turn + the read-only entry stage --------------------------------------------------------
test('reconnect · opening turn carries the callback + the committed captures pre-loaded, at stage "entry"', () => {
  const committed: Collected = { identityNoun: 'Player', doors: ['grind'], gap: 'The grind took over.' };
  const turn = reconnectOpening(committed);
  assert.equal(turn.state.stage, 'entry');
  assert.deepEqual(turn.state.collected, committed, 'the committed captures are pre-loaded (read from member_profile in the live path)');
  assert.equal(turn.complete, false);
});

test('reconnect · the callback is READ-ONLY — a first response hands into Doors and revises NOTHING (yet)', () => {
  const committed: Collected = { identityNoun: 'Player', doors: ['grind'], gap: 'The grind took over.' };
  const atEntry: ConvState = { stage: 'entry', collected: committed };
  // Even an explicit correction at the callback does not mutate captures at the entry beat — revision lives inside
  // the excavation (a later §2b increment), member-confirmed + versioned. The entry just hands in.
  const turn = applyReconnectTurn(atEntry, [], "actually it was really my divorce, not the grind", { text: 'That’s a real thread.' });
  assert.equal(turn.state.stage, 'doors', 'hands into the Doors excavation');
  assert.deepEqual(turn.state.collected.doors, ['grind'], 'no revision committed at entry — captures untouched');
  // Listen-first: the model's acknowledgment of what they just said LEADS, then the Door excavation opens as its own
  // beat (the action now feeds a live model turn here, so this is no longer empty → it never jumps straight to the Door).
  assert.match(turn.reply, /That’s a real thread\./, 'the model ack leads');
  // The Doors board: the excavation no longer opens on OUR primary Door — the board opens instead, and she chooses. What this
  // test still pins is the listen-first order: her acknowledgment leads, the next beat follows it.
  assert.equal(turn.expects?.kind, 'doors_board', 'the Door beat is now hers to open');
  assert.match(turn.reply, /mark the ones that are yours/i, 'framing, not a Door we picked');
});

// ============================================================================================================
// §2b Doors Excavation (increment 1) — the ENGINE structure. The insight QUALITY is a felt walk; these pin the
// model-judged depth floor/cap, the confirm routing, and graceful degradation (a StageDef on the kernel).
// ============================================================================================================

test('reconnect doors · entry hands into the BOARD, and does not pick a Door for her', () => {
  // It used to open on the committed primary Door by name. The board replaced that: naming where we start AND
  // handing her the full set to choose from, in the same breath, said "let's start with The Grind" before she
  // marked anything — and then said it again with a different Door after she did. Found on the first live walk.
  // The excavation opener is not lost; it moved to the board receipt, where it names the Door SHE said weighs
  // most rather than the one our matcher put first.
  const atEntry: ConvState = { stage: 'entry', collected: { identityNoun: 'Racer', doors: ['marriage', 'grind'], gap: 'The divorce took it.' } };
  const turn = applyReconnectTurn(atEntry, [], 'yeah, still the marriage', { text: '' });
  assert.equal(turn.state.stage, 'doors', 'advances into the Doors excavation');
  assert.equal(turn.expects?.kind, 'doors_board', 'the board comes with the framing');
  assert.ok(!/let's start with/i.test(turn.reply), 'it must not choose her Door before she has');
  assert.match(turn.reply, /mark the ones that are yours/i);

  // ...and once she has marked them, the excavation opens on HER answer, by name.
  const after = applyReconnectTurn(turn.state, [], '[board] door:marriage=3 door:grind=2 biggest:marriage', { text: '' });
  assert.match(after.reply, /The Relationship/, 'now it names the Door, and it is the one she chose');
  assert.match(after.reply, /the real thing|actually|weighs most/i, 'invites the real story, not a summary');
});

// ── The board is a RULING on the whole set, not an add-only form (Donna, 2026-08-20) ─────────────────────────
//
// Her pre-lit Doors arrive marked and she can rate one "not relevant" to take it off — the board client says so in
// its own comment, and that is the entire reason onboarding is allowed to stay quiet about Doors ("turn up R2, not
// the intake"). The engine unioned her marks onto what she already held, so the removal was discarded and the
// wrong Door came straight back. An affordance that renders and does nothing is the worst kind: she cannot tell it
// failed, and she has already been told this is the place it gets fixed.
test('reconnect doors · a pre-lit Door she does NOT mark is taken off — her ruling outranks our matcher', () => {
  const atDoors: ConvState = { stage: 'doors', collected: { identityNoun: 'Maker', doors: ['career_cliff', 'full_house', 'load_bearer'] } };
  // She marks the two that are hers and leaves The Full House unrated — our matcher's mistake, corrected.
  const after = applyReconnectTurn(atDoors, [], '[board] door:career_cliff=3 door:load_bearer=3 biggest:load_bearer', { text: '' });
  const doors = after.state.collected.doors ?? [];
  assert.equal(doors.includes('full_house'), false, 'the Door she took off must not survive her ruling');
  assert.ok(doors.includes('career_cliff') && doors.includes('load_bearer'), 'what she marked is kept');
  assert.equal(doors[0], 'load_bearer', 'ruling #8 — biggest-impact leads the set');
});

test('reconnect doors · marking NOTHING is "none of these land", never "delete my Doors"', () => {
  // softSetMemberDoors refuses an empty set (the ≥1-Door contract), so zeroing the engine here would leave the arc
  // and her record disagreeing about her own life.
  const atDoors: ConvState = { stage: 'doors', collected: { identityNoun: 'Maker', doors: ['career_cliff', 'load_bearer'] } };
  const after = applyReconnectTurn(atDoors, [], '[board] quiet:1', { text: '' });
  assert.deepEqual(after.state.collected.doors, ['career_cliff', 'load_bearer'], 'an empty board leaves her set intact');
});

test('reconnect doors · removal is bounded by what the board SHOWED her', () => {
  // Every Door has recognition copy today, so the bound is currently a no-op — this is the tripwire for a future
  // Door that ships without copy, which would be filtered off the board and must not be read as one she dropped.
  const shown = new Set(boardShownSlugs());
  assert.ok(DOORS.every((d) => shown.has(d.slug)), 'a Door missing from the board would be silently droppable');
});

test('reconnect doors · DEPTH FLOOR holds — reflect_door on the first exchange does NOT reflect (no insight w/o material)', () => {
  const atDoors: ConvState = { stage: 'doors', collected: { identityNoun: 'Racer', doors: ['marriage'] } };
  // Model tries to close on turn 1 (depthReady) — the floor must keep it drawing out.
  const turn = applyReconnectTurn(atDoors, [], 'it started when she checked out', { text: 'When did you first feel that? What did it take?', depthReady: true });
  assert.equal(turn.state.awaitingConfirm ?? false, false, 'the FLOOR overrides an early reflect_door — keeps drawing out');
});

test('reconnect doors · MODEL-JUDGED advance — reflect_door past the floor reflects the insight', () => {
  const atDoors: ConvState = { stage: 'doors', stageScratch: { doors: { doorDepth: 2 } }, collected: { identityNoun: 'Racer', doors: ['marriage'] } };
  const insight = "So the racing didn't just fade — you handed it over piece by piece and stopped counting the cost. Does that land, or is it not quite the shape?";
  const turn = applyReconnectTurn(atDoors, [], 'yeah, and I stopped racing entirely', { text: insight, depthReady: true });
  assert.equal(turn.state.awaitingConfirm, true, 'past the floor + model-judged → reflects and awaits the check');
  assert.match(turn.reply, /stopped counting the cost/, 'the model insight (in their words) is what is reflected');
});

test('reconnect doors · CAP forces a reflect even without the signal (anti-loop)', () => {
  const atDoors: ConvState = { stage: 'doors', stageScratch: { doors: { doorDepth: 4 } }, collected: { identityNoun: 'Racer', doors: ['marriage'] } };
  const turn = applyReconnectTurn(atDoors, [], 'and there was more too', { text: "Here's what I keep hearing across all of it." });
  assert.equal(turn.state.awaitingConfirm, true, 'the CAP reflects even with no reflect_door signal');
});

test('reconnect doors · GRACEFUL DEGRADATION — no material to synthesize → a smaller honest reflection, never a manufactured pattern', () => {
  const atDoors: ConvState = { stage: 'doors', stageScratch: { doors: { doorDepth: 4 } }, collected: { identityNoun: 'Racer', doors: ['marriage'] } };
  const turn = applyReconnectTurn(atDoors, [], 'idk', { text: '' }); // cap hit, but the model returned nothing
  assert.equal(turn.state.awaitingConfirm, true);
  // The fallback copy changed on 2026-08-27: it used to say "I don't want to put a shape on this before it's
  // earned", which our own system prompt forbids the Companion from saying. The BEHAVIOUR under test is
  // unchanged — degrade honestly, never fabricate — so the assertion moves to the new words rather than going.
  assert.match(turn.reply, /tell me more about how it actually went/i, 'degrades honestly — does not fabricate an insight');
  assert.doesNotMatch(turn.reply, /shape of it|put a shape on/i, 'and does it without a phrase we ban the model from using');
});

// UPDATED 2026-08-27: the Doors beat now has one more turn before the IDQ — Greg's fourth reflection question
// ("what does recognizing these Doors change about how you see your own Fade"), which his R1 spec always asked
// for and we had never built. So `done` no longer lands on measurement; it asks, and the ANSWER lands there.
// The handoff contract these tests exist to protect is unchanged — it just happens one beat later.
test('reconnect doors · confirm — "that\'s it" advances; a DISPUTE takes the correction humbly', () => {
  const base: ConvState = { stage: 'doors', awaitingConfirm: true, collected: { identityNoun: 'Racer', doors: ['marriage'] } };
  const done = applyReconnectTurn(base, [], "yeah, that's exactly it", { text: 'Good.', replyIntent: 'done' });
  assert.equal(done.state.stage, 'doors', 'a landed insight asks the meaning question before leaving the Doors beat');
  assert.match(done.reply, /change about how you see your own Fade/i, "Greg's fourth reflection question");
  // UPDATED 2026-08-28: her answer now lands on the BREAK, and the stage advances when she says to carry on.
  // Greg's docs specify pacing and never describe Reconnect as one sitting; Jay and Donna both hit the unbroken
  // run. The contract this line protects — her answer is received and the beat ends — is unchanged.
  const after = applyReconnectTurn(done.state, [], 'It means I stopped blaming myself for all of it.', { text: '' });
  assert.equal(after.state.stage, 'doors', 'her answer lands on the break, which holds the stage for one turn');
  assert.match(after.reply, /back through every Door you named/i, 'the seam is named');
  assert.equal(after.complete, true, 'the Doors Session ENDS — it no longer runs on into the questionnaire');
  const dispute = applyReconnectTurn(base, [], "no, that's not it at all", { text: '', replyIntent: 'dispute' });
  assert.equal(dispute.state.awaitingConfirm, false, 'a dispute reopens');
  assert.equal(dispute.state.stage, 'doors', 'stays in the Doors beat');
  assert.match(dispute.reply, /get this right|help me see it|what did I miss/i, 'takes the correction humbly, no defense');
});

// ============================================================================================================
// §2b Revision (Decision L, slice 1) — the primary CORRECT (re-seeing). Propose ≠ commit (R1); a confirmed correct
// swaps the primary Door in place (R3) and re-opens the insight (R2); the tell fires by the ENFORCEABLE DEFAULT —
// emit UNLESS the model flagged an explicit flat mislabel (R4 + default-emit). No DB this slice (in-memory).
// ============================================================================================================

test('reconnect revision · PROPOSE ≠ COMMIT — a proposed re-seeing is offered, changes nothing until confirmed (R1)', () => {
  const atDoors: ConvState = { stage: 'doors', stageScratch: { doors: { doorDepth: 2 } }, collected: { identityNoun: 'Racer', doors: ['marriage'] } };
  const turn = applyReconnectTurn(atDoors, [], 'it was all about carrying everyone', {
    text: 'You came in on The Relationship — but everything you just said is about carrying the load. Truer as The Load-Bearer?',
    revision: { fromSlug: 'marriage', toSlug: 'load_bearer', kind: 'correct' },
  });
  assert.equal(turn.state.awaitingConfirm, true, 'offered as a check — awaits the member');
  assert.deepEqual(turn.state.pendingRevision, { fromSlug: 'marriage', toSlug: 'load_bearer', kind: 'correct' }, 'the proposal is held for the confirm turn');
  assert.deepEqual(turn.state.collected.doors, ['marriage'], 'NOTHING changes until they confirm (offered, not asserted)');
  assert.equal((turn.state.reseeingTells ?? []).length, 0, 'no tell before commit');
});

test('reconnect revision · CONFIRM commits the swap in place + emits the tell by default (R2/R3/R4)', () => {
  const pending: ConvState = { stage: 'doors', awaitingConfirm: true, pendingRevision: { fromSlug: 'marriage', toSlug: 'load_bearer', kind: 'correct' }, collected: { identityNoun: 'Racer', doors: ['grind', 'marriage'] } };
  const turn = applyReconnectTurn(pending, [], "yeah — that's the one. The Load-Bearer.", { text: '', replyIntent: 'done' });
  assert.deepEqual(turn.state.collected.doors, ['grind', 'load_bearer'], 'swaps in place — primary (grind) untouched, marriage→load_bearer');
  assert.deepEqual(turn.state.reseeingTells, [{ fromSlug: 'marriage', toSlug: 'load_bearer' }], 'a real re-seeing emits a tell (default-emit)');
  assert.equal(turn.state.pendingRevision, undefined, 'pending cleared');
  assert.equal(turn.state.stage, 'doors', 'R2: re-opens on the corrected door, does NOT hand off with a stale insight');
  assert.match(turn.reply, /Load-Bearer/, 'names the corrected door back');
});

test('reconnect revision · an AFFIRMATION WITH added color still commits (default-to-commit-unless-disputed)', () => {
  // The live-walk bug: "yeah, that's truer — it was really the carrying…" reads as 'addition', not 'done'. A re-seeing
  // is a yes/no offer, so anything that isn't a DISPUTE commits (and keeps drawing out) — never a re-proposal loop.
  const pending: ConvState = { stage: 'doors', awaitingConfirm: true, pendingRevision: { fromSlug: 'marriage', toSlug: 'load_bearer', kind: 'correct' }, collected: { doors: ['marriage'] } };
  // FIXTURE TEXT CHANGED 2026-09-02, not the assertion. It was 'go on' — a neutral stand-in when this was written,
  // and since then "go on" is recognised as an IMPERATIVE ASK, because Donna got our probe stacked underneath
  // "Go on. I'm here for it." So the engine now correctly holds its probe on that text, and the assertion below
  // (that the turn keeps drawing out with a question) was measuring the stand-in rather than the behaviour.
  // A reflection with no ask in it is what this test always meant by "the model said something".
  const turn = applyReconnectTurn(pending, [], "yeah, that's truer — it was really the carrying, all of it landing on me", { text: 'That lands — the carrying is the truer name for it.', replyIntent: 'more' });
  assert.deepEqual(turn.state.collected.doors, ['load_bearer'], 'accepted-with-color still commits the swap');
  assert.deepEqual(turn.state.reseeingTells, [{ fromSlug: 'marriage', toSlug: 'load_bearer' }], 'and emits the tell');
  assert.equal(turn.state.pendingRevision, undefined, 'no re-proposal loop — the offer resolved');
  assert.match(turn.reply, /\?\s*$/, 'keeps drawing out on the corrected door');
});

test('reconnect revision · a FLAT MISLABEL swaps but emits NO tell (suppress-on-explicit — the only no-harvest case)', () => {
  const pending: ConvState = { stage: 'doors', awaitingConfirm: true, pendingRevision: { fromSlug: 'marriage', toSlug: 'load_bearer', kind: 'correct', flatMislabel: true }, collected: { doors: ['marriage'] } };
  const turn = applyReconnectTurn(pending, [], 'yeah I just said the wrong name', { text: '', replyIntent: 'done' });
  assert.deepEqual(turn.state.collected.doors, ['load_bearer'], 'the correction still applies');
  assert.equal(turn.state.reseeingTells, undefined, 'an explicit flat mislabel is NOT a keeper — no tell');
});

test('reconnect revision · a REJECTED re-seeing keeps their door, humbly, and emits nothing', () => {
  const pending: ConvState = { stage: 'doors', awaitingConfirm: true, pendingRevision: { fromSlug: 'marriage', toSlug: 'load_bearer', kind: 'correct' }, collected: { doors: ['marriage'] } };
  const turn = applyReconnectTurn(pending, [], 'no — it really is the marriage', { text: '', replyIntent: 'dispute' });
  assert.deepEqual(turn.state.collected.doors, ['marriage'], 'their named door stands');
  assert.equal(turn.state.pendingRevision, undefined, 'pending cleared on dispute');
  assert.equal(turn.state.reseeingTells, undefined, 'no tell on a rejected re-seeing');
  assert.equal(turn.state.stage, 'doors', 'stays in the beat');
  assert.match(turn.reply, /door you named is the door|see it your way|got it wrong/i, 'takes it humbly, no defense');
});

test('reconnect revision · a non-canonical or no-op swap is ignored (the engine disposes; the model cannot force it)', () => {
  const atDoors: ConvState = { stage: 'doors', stageScratch: { doors: { doorDepth: 2 } }, collected: { doors: ['marriage'] } };
  const turn = applyReconnectTurn(atDoors, [], 'hmm', { text: 'go on', revision: { fromSlug: 'marriage', toSlug: 'not_a_door' as never, kind: 'correct' } });
  assert.notEqual(turn.state.awaitingConfirm, true, 'a non-canonical target does not open a revision confirm');
  assert.deepEqual(turn.state.collected.doors, ['marriage'], 'nothing swapped');
});

// --- WIDEN / NAME (Decision L, the ADD kinds — retire nothing; tell keyed to re-seeing, suppress on 'mechanical') ---

test('reconnect revision · WIDEN is proposed, offered, and adds NOTHING until confirmed (R1)', () => {
  const atDoors: ConvState = { stage: 'doors', stageScratch: { doors: { doorDepth: 2 } }, collected: { doors: ['marriage'] } };
  const turn = applyReconnectTurn(atDoors, [], 'my father was failing right alongside all of it', {
    text: 'The Relationship — and it sounds like The Aging Parents was open right beside it. Both at once?',
    revision: { kind: 'widen', toSlug: 'aging_parents' },
  });
  assert.equal(turn.state.awaitingConfirm, true, 'offered as a check');
  assert.deepEqual(turn.state.pendingRevision, { kind: 'widen', toSlug: 'aging_parents' });
  assert.deepEqual(turn.state.collected.doors, ['marriage'], 'nothing added until they confirm');
});

test('reconnect revision · confirming a WIDEN adds the Door (keeps primary) + emits a tell (an add, no pair)', () => {
  const pending: ConvState = { stage: 'doors', awaitingConfirm: true, pendingRevision: { kind: 'widen', toSlug: 'aging_parents' }, collected: { doors: ['marriage'] } };
  const turn = applyReconnectTurn(pending, [], 'yeah, both were happening at the same time', { text: '', replyIntent: 'done' });
  assert.deepEqual(turn.state.collected.doors, ['marriage', 'aging_parents'], 'added as secondary; the primary is untouched');
  assert.deepEqual(turn.state.reseeingTells, [{ toSlug: 'aging_parents' }], 'a genuine surfacing emits a tell — an add carries no from-pair');
  assert.equal(turn.state.pendingRevision, undefined);
  assert.equal(turn.state.stage, 'doors');
  assert.match(turn.reply, /Aging Parents/, 'acknowledges the added Door');
});

test('reconnect revision · NAME adds a quiet Door; a MECHANICAL add commits but emits NO tell', () => {
  const named: ConvState = { stage: 'doors', awaitingConfirm: true, pendingRevision: { kind: 'name', toSlug: 'vanishing' }, collected: { doors: ['body'] } };
  const t1 = applyReconnectTurn(named, [], "yeah — that's the quiet one, I never named it", { text: '', replyIntent: 'done' });
  assert.deepEqual(t1.state.collected.doors, ['body', 'vanishing'], 'the quiet Door is named and added');
  assert.deepEqual(t1.state.reseeingTells, [{ toSlug: 'vanishing' }], 'a genuine naming is a re-seeing → tell');

  const mech: ConvState = { stage: 'doors', awaitingConfirm: true, pendingRevision: { kind: 'widen', toSlug: 'full_house', mechanical: true }, collected: { doors: ['grind'] } };
  const t2 = applyReconnectTurn(mech, [], 'sure, add it', { text: '', replyIntent: 'done' });
  assert.deepEqual(t2.state.collected.doors, ['grind', 'full_house'], 'the add still applies');
  assert.equal(t2.state.reseeingTells, undefined, 'a mechanical add is not a keeper — no tell (suppress-on-explicit)');
});

test('reconnect revision · a disputed add is dropped, humbly — the named set stands', () => {
  const pending: ConvState = { stage: 'doors', awaitingConfirm: true, pendingRevision: { kind: 'widen', toSlug: 'aging_parents' }, collected: { doors: ['marriage'] } };
  const turn = applyReconnectTurn(pending, [], 'no, it was really just the marriage', { text: '', replyIntent: 'dispute' });
  assert.deepEqual(turn.state.collected.doors, ['marriage'], 'nothing added on a dispute');
  assert.equal(turn.state.reseeingTells, undefined, 'no tell');
  assert.match(turn.reply, /door you named is the door|see it your way|got it wrong/i, 'humble, no defense');
});

// ============================================================================================================
// §2c Measurement (administered, slice 1) — the WALL: IDQ items delivered verbatim OFF the depth kernel; fixed-scale
// capture; authored cluster transitions; the 24th completes the baseline (the ACTION writes it) and hands on.
// ============================================================================================================

test('reconnect measurement · Doors done hands into the administered check-in (warm open + scale, not a survey wall)', () => {
  const atDoors: ConvState = { stage: 'doors', awaitingConfirm: true, collected: { identityNoun: 'Racer', doors: ['grind'] } };
  const asked = applyReconnectTurn(atDoors, [], "yeah, that's it", { text: '', replyIntent: 'done' });
  // THE DOORS NO LONGER HAND INTO THE QUESTIONNAIRE AT ALL. R1 is the questionnaire and it comes FIRST now
  // (Greg's spec); R2 is the Doors and it CLOSES. What this test asserted — a warm framed handoff rather than a
  // survey wall — is now asserted of R1's own opener, in tests/reconnect-sessions.test.ts.
  const done = applyReconnectTurn(asked.state, [], 'It means it wasn’t all my fault.', { text: '' });
  assert.equal(done.complete, true, 'the Doors Session closes');
  assert.match(done.reply, /back through every Door you named/i, 'naming what was done');
});

test('reconnect measurement · a 1–5 answer records in order and delivers the next item, OFF the depth kernel', () => {
  const atM: ConvState = { stage: 'measurement', collected: { doors: ['grind'] } };
  const turn = applyReconnectTurn(atM, [], '3', { text: '', depthReady: true }); // depthReady MUST have no effect here
  assert.deepEqual(turn.state.administeredResponses, [3], 'the fixed-scale response is recorded in item order');
  assert.equal(turn.state.awaitingConfirm ?? false, false, 'no reflect-confirm loop in an administered beat');
  assert.ok(turn.reply.length > 0, 'delivers the next item');
});

test('reconnect measurement · a dimension boundary carries an authored cluster transition', () => {
  const five: ConvState = { stage: 'measurement', administeredResponses: [3, 3, 3, 3, 3], collected: { doors: ['grind'] } };
  const turn = applyReconnectTurn(five, [], '4', { text: '' }); // the 6th answer → deliver item 6 (first of Self)
  assert.equal((turn.state.administeredResponses ?? []).length, 6);
  assert.match(turn.reply, /how you see yourself/i, 'a warm cluster transition into the Self items');
});

test('reconnect measurement · an unclear answer re-prompts and records nothing (stays on the item)', () => {
  const atM: ConvState = { stage: 'measurement', administeredResponses: [3, 3], collected: { doors: ['grind'] } };
  const turn = applyReconnectTurn(atM, [], 'hard to put a number on it', { text: '' });
  assert.deepEqual(turn.state.administeredResponses, [3, 3], 'no response recorded on an unclear reply');
  assert.match(turn.reply, /number/i, 'gently asks for a 1–5');
  assert.equal(turn.state.stage, 'measurement', 'stays on the current item');
});

test('reconnect measurement · the 24th response completes the baseline and CLOSES R1', () => {
  const almost: ConvState = { stage: 'measurement', administeredResponses: Array(TOTAL_ITEMS - 1).fill(3), collected: { doors: ['grind'] } };
  const turn = applyReconnectTurn(almost, [], '5', { text: '' });
  assert.equal((turn.state.administeredResponses ?? []).length, TOTAL_ITEMS, 'all 24 captured');
  assert.equal(turn.complete, true, 'the 24th answer CLOSES R1 — the Drift Quiz is its own Session now');
  assert.match(turn.reply, /baseline/i, 'the close names the baseline (never a bare number; the ACTION writes it)');

  // THIS LINE USED TO ASSERT THE BUG. It read `assert.match(turn.reply, /inventory|cost/i, 'and opens the Drift
  // beat (the generic close appends the drift opener)')` — and it sat directly beneath an assertion I had already
  // updated to say "the Drift Quiz is its own Session now". Half the test knew about the split and half did not,
  // so the suite went green while R1 ended by asking a question from R3 that nobody would be there to answer.
  //
  // A Session close names what comes next. It does not start the next Session.
  assert.match(turn.reply, /Next are your Doors/, 'the close says what comes next');
  assert.doesNotMatch(turn.reply, /what has the Fade cost you|which do you feel the distance from most/i,
    "and never speaks R3's opener");
});

// ============================================================================================================
// §2d VISIONING · the DRIFT beat (slice 1) — draw-out back on the depth kernel; drift-recognition KEEPER (tell);
// the turn-toward-hope BRIDGE into Legacy. (The insight QUALITY / LIFT is a felt walk; these pin the structure.)
// ============================================================================================================

test('reconnect drift · DEPTH FLOOR holds — reflect_drift on the first exchange keeps drawing out (no pattern w/o material)', () => {
  const atDrift: ConvState = { stage: 'drift', collected: { doors: ['grind'] } };
  const turn = applyReconnectTurn(atDrift, [], 'it cost me my mornings', { text: 'When did that start?', depthReady: true });
  assert.equal(turn.state.awaitingConfirm ?? false, false, 'the FLOOR overrides an early reflect_drift');
});

test('reconnect drift · past the floor, reflect_drift reflects the pattern + captures the drift declaration', () => {
  const atDrift: ConvState = { stage: 'drift', stageScratch: { drift: { driftDepth: 2 } }, collected: { doors: ['grind'] } };
  const decl = 'I stopped riding, then I stopped seeing friends, then I stopped noticing I had';
  const turn = applyReconnectTurn(atDrift, [], decl, { text: 'The drift kept taking the things that were just yours. Does that name the shape?', depthReady: true });
  assert.equal(turn.state.awaitingConfirm, true, 'reflects the pattern, awaits the check');
  assert.equal(turn.state.driftPayload, decl, "captures the member's drift declaration (their words) for the keeper");
});

test('reconnect drift · confirm queues the drift KEEPER (tell) and BRIDGES toward hope into The Window', () => {
  const pending: ConvState = { stage: 'drift', awaitingConfirm: true, driftPayload: 'I stopped riding and stopped noticing', collected: { doors: ['grind'] } };
  const turn = applyReconnectTurn(pending, [], "yeah, that's the shape of it", { text: '', replyIntent: 'done' });
  assert.equal(turn.state.stage, 'window', 'hands into The Window (beat 2)');
  assert.match(turn.reply, /look the other way/i, 'the turn-toward-hope bridge (LIFT at the seam)');
  assert.match(turn.reply, /Tuesday|window/i, 'and hands straight into The Window opener');
  assert.deepEqual(turn.state.pendingHarvest, [{ kind: 'drift', keeperType: 'tell', destinationIntent: 'keeper', payloadRef: 'I stopped riding and stopped noticing', label: 'The Fade' }], 'a drift-recognition keeper is queued (default-emit), labelled with the protected term');
  assert.equal(turn.state.driftPayload, undefined, 'payload cleared after queueing');
});

// ============================================================================================================
// §2d VISIONING · beat 2: THE WINDOW (slice 2) — the two Tuesdays, the spark, the LIFT. Draw-out; on confirm the
// VISION is a keeper ('lights_you_up'); hands into the Checkpoint (§2e stub).
// ============================================================================================================

test('reconnect window · DEPTH FLOOR holds — reflect_window before both Tuesdays keeps drawing out', () => {
  const atWindow: ConvState = { stage: 'window', collected: { doors: ['grind'] } };
  const turn = applyReconnectTurn(atWindow, [], 'if nothing changes I just keep grinding', { text: 'And the other Tuesday?', depthReady: true });
  assert.equal(turn.state.awaitingConfirm ?? false, false, 'the FLOOR keeps it drawing out the second Tuesday');
});

test('reconnect window · past the floor, reflect_window reflects the SPARK + captures the vision', () => {
  const atWindow: ConvState = { stage: 'window', stageScratch: { window: { windowDepth: 2 } }, collected: { doors: ['grind'] } };
  const vision = "I'd be up at six, out on the bike before the house wakes, home strong instead of dreading the day";
  const turn = applyReconnectTurn(atWindow, [], vision, { text: 'That morning — the ride before the house wakes — that\'s the spark. Is that the one worth chasing?', depthReady: true });
  assert.equal(turn.state.awaitingConfirm, true, 'reflects the spark, awaits the check');
  assert.equal(turn.state.driftPayload, vision, "captures the member's second-Tuesday vision (their words) for the keeper");
});

test('reconnect window · confirm queues the VISION keeper and hands into the LEGACY LETTER, carrying the Tuesday', () => {
  // The Window used to hand straight into the §2e Checkpoint. R3's Legacy Letter now sits between them (Greg moved
  // the letter into Reconnect so a member leaves the first R holding a destination, not just a diagnosis), and the
  // Window's own answer IS the letter's first prompt — so it must travel with them or they get asked twice.
  const pending: ConvState = { stage: 'window', awaitingConfirm: true, driftPayload: 'the ride before the house wakes, home strong', collected: { doors: ['grind'] }, administeredResponses: [1, 2, 3] };
  const turn = applyReconnectTurn(pending, [], "yeah — that's the one", { text: '', replyIntent: 'done' });
  assert.equal(turn.state.stage, 'legacy', 'hands into the Legacy Letter, not the Checkpoint');
  assert.match(turn.reply, /spark/i, 'the close still names the spark (ends on hope)');
  assert.match(turn.reply, /letter/i, 'and opens the letter');
  assert.equal(turn.state.legacyTuesday, 'the ride before the house wakes, home strong', 'their Tuesday travels with them');
  assert.deepEqual(turn.state.pendingHarvest, [{ kind: 'window', keeperType: 'lights_you_up', destinationIntent: 'keeper', payloadRef: 'the ride before the house wakes, home strong', label: 'The spark' }], 'the vision is queued as a lights_you_up keeper');
});

test('reconnect window · a DISPUTE reopens and queues NO keeper', () => {
  const pending: ConvState = { stage: 'window', awaitingConfirm: true, driftPayload: 'x', collected: { doors: ['grind'] } };
  const turn = applyReconnectTurn(pending, [], "no, that's not really it", { text: '', replyIntent: 'dispute' });
  assert.equal(turn.state.stage, 'window', 'stays in The Window');
  assert.equal(turn.state.pendingHarvest, undefined, 'no keeper on a rejected vision');
  assert.match(turn.reply, /not quite the one|say more|worth chasing/i, 'keeps looking, no force');
});

test('reconnect drift · a DISPUTE reopens and queues NO keeper', () => {
  const pending: ConvState = { stage: 'drift', awaitingConfirm: true, driftPayload: 'x', collected: { doors: ['grind'] } };
  const turn = applyReconnectTurn(pending, [], "no, that's not it", { text: '', replyIntent: 'dispute' });
  assert.equal(turn.state.stage, 'drift', 'stays in the Drift beat');
  assert.equal(turn.state.awaitingConfirm ?? false, false, 'reopens');
  assert.equal(turn.state.pendingHarvest, undefined, 'no keeper on a rejected pattern');
  assert.match(turn.reply, /say it your way|not got it yet|real shape/i, 'takes the correction, no defense');
});

// --- §2c slice 2: the personalized close (M3) — the SHAPE helper + the governance-safe fallback ---------------
test('reconnect measurement · idqShape ranks the lowest + highest dimension (grounds the close, never a raw number)', async () => {
  const { idqShape } = await import('../lib/agent/reconnect.ts');
  // physical all 1 (lowest), self all 5 (highest), social 3, outlook 4
  const responses = [1,1,1,1,1,1, 5,5,5,5,5,5, 3,3,3,3,3,3, 4,4,4,4,4,4];
  assert.deepEqual(idqShape(responses), { lowest: 'physical', highest: 'self' });
});

test('reconnect measurement · the personalized close FALLS BACK to null with no API key (generic close stands)', async () => {
  const { reconnectMeasurementClose } = await import('../lib/agent/reconnect.ts');
  const prev = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const out = await reconnectMeasurementClose({ identityNoun: 'Racer', doors: ['body'] }, Array(24).fill(3));
  assert.equal(out, null, 'no key → null, so the deterministic generic close is used (safe by default)');
  if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
});

// --- the SHARED draw-out tic fix (Doors + Drift + Window): a declarative reflection past the floor advances to the
// confirm instead of re-asking — "stop circling once the Companion has reflected", even without the reflect_x tool.
test('reconnect drawout · TIC FIX — a declarative reflection past the floor advances to the check (no redundant re-ask)', () => {
  // The model reflected in TEXT (a substantive statement, no trailing question) but did NOT call reflect_drift. Past
  // the floor, that IS the reflection — advance to the confirm rather than append a draw-out probe.
  const atDrift: ConvState = { stage: 'drift', stageScratch: { drift: { driftDepth: 2 } }, collected: { doors: ['grind'] } };
  const turn = applyReconnectTurn(atDrift, [], 'yeah, all of it went quiet', { text: 'The drift kept taking the things that were just yours, one reasonable decision at a time.' });
  assert.equal(turn.state.awaitingConfirm, true, 'recognizes the declarative reflection and moves to the check');
  // DECISION B, 2026-08-25. What this test protects is that the beat ADVANCES to a check rather than circling with
  // another draw-out probe — and that still holds. What changed is where the check lives: the engine no longer
  // appends its confirm question to the model's turn, because that rule fired hardest on turns that were already
  // complete. The check is chips now, and the reply must NOT be a fresh probe.
  assert.equal(turn.expects?.kind, 'beat_confirm', 'moves to the check');
  assert.doesNotMatch(turn.reply, /\?\s*$/, 'not another draw-out probe, and not a manufactured question');
});

test('reconnect drawout · TIC FIX still respects the floor — a declarative statement on turn 1 does NOT advance', () => {
  const atWindow: ConvState = { stage: 'window', collected: { doors: ['grind'] } }; // windowDepth 0 → 1 (below floor)
  const turn = applyReconnectTurn(atWindow, [], 'if nothing changes I just keep grinding', { text: 'That Tuesday is real. You named it plainly.' });
  assert.equal(turn.state.awaitingConfirm ?? false, false, 'the FLOOR still holds — one exchange is not a reflection');
});

// --- §2e Checkpoint (administered grit beat) + §2f Ceremony terminal --------------------------------------------
test('reconnect §2e Checkpoint · administers the 6 grit items → Ceremony; grinta is NOT named to the member', () => {
  let s: ConvState = { stage: 'checkpoint', collected: { doors: ['grind'] }, administeredResponses: [] };
  // an unclear answer re-asks the current item, records nothing, does not advance
  const bad = applyReconnectTurn(s, [], 'not sure', { text: '' });
  assert.equal(bad.state.stage, 'checkpoint');
  assert.equal(bad.state.administeredResponses?.length ?? 0, 0, 'nothing recorded on an unclear answer');
  assert.match(bad.reply, /number, 1 to 5/i, 'gently re-asks with the scale');
  // walk the six grit items
  let reply = '';
  for (let i = 0; i < 6; i++) {
    const t = applyReconnectTurn(s, [], '5', { text: '' });
    s = t.state;
    reply = t.reply;
  }
  assert.equal(s.stage, 'ceremony', 'the 6th grit answer hands into the Ceremony');
  assert.deepEqual(s.administeredResponses, [5, 5, 5, 5, 5, 5], 'the six grit responses are captured');
  assert.match(reply, /don’t go anywhere|show you what you just did/i, 'the close hands into the Ceremony lead');
  assert.doesNotMatch(reply, /grinta|hardiness/i, 'grinta is never named to the member here — it surfaces in the Ceremony');
});

// ══ R3 · THE LEGACY LETTER ════════════════════════════════════════════════════════════════════════════════════
// Offline replay of the beat, because it lands in the live capture loop. The rules that matter: a draft is a
// PROPOSAL (nothing is stored until they confirm), the revision loop is CAPPED, and a beat that never produced a
// draft must not claim a letter exists.

test('legacy · the drafted letter is shown for revision and NOTHING is stored yet', () => {
  const st: ConvState = { stage: 'legacy', collected: {}, legacyTuesday: 'coffee on the porch, then out before it is hot' };
  const turn = applyReconnectTurn(st, [], 'a trip to Utah with my brother', { text: '', legacyBody: 'Dear me — you kept going.' });
  assert.equal(turn.state.stage, 'legacy', 'still in the beat');
  assert.match(turn.reply, /Dear me — you kept going\./, 'they see the draft');
  assert.equal(turn.state.legacyDraft, 'Dear me — you kept going.', 'held for revision');
  assert.equal(turn.state.legacyLetter, undefined, 'NOT committed — a draft they hate must never reach their record');
  assert.doesNotMatch(turn.reply, /is this good|do you like/i, 'never asks them to appraise it');
});

test('legacy · a redraft replaces the draft and still does not commit', () => {
  const st: ConvState = { stage: 'legacy', awaitingConfirm: true, collected: {}, legacyDraft: 'first try' };
  const turn = applyReconnectTurn(st, [], 'the middle bit is not how I talk', { text: '', legacyBody: 'second try' });
  assert.equal(turn.state.legacyDraft, 'second try');
  assert.equal(turn.state.legacyRevisions, 1);
  assert.equal(turn.state.legacyLetter, undefined);
});

test('legacy · the revision loop is CAPPED — it offers to save rather than looping forever', () => {
  // Greg's note says "prompt revisions UNTIL each Member has a manifesto" — "until" has no terminator, and an
  // uncapped propose/revise loop is how B3, C1 and C3 each earned an infinite re-proposal bug.
  const st: ConvState = { stage: 'legacy', awaitingConfirm: true, collected: {}, legacyDraft: 'v1', legacyRevisions: 1 };
  const turn = applyReconnectTurn(st, [], 'one more change', { text: '', legacyBody: 'v2' });
  assert.equal(turn.state.legacyRevisions, 2, 'at the cap');
  assert.match(turn.reply, /save it\?/i, 'offers to save');
  assert.match(turn.reply, /any time|anytime/i, 'and promises it stays editable — the reason a cap is fair');
});

test('legacy · confirm commits the letter and hands into the Checkpoint', () => {
  const st: ConvState = { stage: 'legacy', awaitingConfirm: true, collected: {}, legacyDraft: 'the letter', administeredResponses: [1, 2, 3] };
  const turn = applyReconnectTurn(st, [], 'yes, save it', { text: '', replyIntent: 'done' });
  assert.equal(turn.state.legacyLetter?.body, 'the letter', 'committed for the action to persist');
  assert.equal(turn.complete, true, 'the letter CLOSES R3 — the Checkpoint is its own Session');
  assert.equal(turn.state.administeredResponses?.length ?? 0, 0, 'the accumulator is reset for the grit instrument');
  assert.equal(turn.state.legacyDraft, undefined, 'the draft is cleared once committed');
  // The DATE is stamped by the action in the member's timezone — computing it in this pure engine would use
  // server time and put a Boulder evening on tomorrow.
  assert.equal(turn.state.legacyLetter?.datedFor, '', 'the engine does not date it');
  assert.match(turn.reply, /a year from today/i, 'and says so in a way that is true in every timezone');
});

test('legacy · a beat that never drafted moves on QUIETLY — it never claims a letter exists', () => {
  const st: ConvState = { stage: 'legacy', awaitingConfirm: true, collected: {} };
  const turn = applyReconnectTurn(st, [], 'I would rather skip this', { text: '', replyIntent: 'done' });
  assert.equal(turn.state.legacyLetter, undefined, 'nothing stored');
  assert.equal(turn.complete, true, 'the letter CLOSES R3 — the Checkpoint is its own Session');
  assert.doesNotMatch(turn.reply, /saved|your letter/i, 'a missing letter is recoverable; a false claim of one is not');
});

// ============================================================================================================
// THE DOORS BOARD — the seam (2026-08-18).
//
// Every half of this passes on its own: the expectation builds, the parser parses, the write path writes. The
// failure mode is that they are never joined — which is exactly how an earlier feature shipped as two tested
// halves and an infinite loop. These drive the real arc.
// ============================================================================================================

test('BOARD · the doors stage opens with the board, pre-lit with the Doors she already holds', () => {
  const state: ConvState = { stage: 'doors', collected: { identityNoun: 'Maker', doors: ['career_cliff', 'load_bearer'] } };
  const turn = applyReconnectTurn(state, [], 'ok', { text: 'Here is where we go deeper.' });

  assert.equal(turn.expects?.kind, 'doors_board', 'recognition comes before the conversation');
  const e = turn.expects as { cards: { slug: string }[]; held: string[] };
  assert.equal(e.cards.length, 12, 'every Door is shown, not just hers');
  assert.equal(e.cards[0]!.slug, 'body', 'board order is the instrument, applied here and nowhere else');
  assert.deepEqual(e.held, ['career_cliff', 'load_bearer'], 'the board recognizes her rather than starting blank');
  // Autopilot is the twelfth Door as of 2026-08-22, not a separate quietDrift card — Greg's R2 asset names it a
  // required minimum and rates it like the rest. It sits last because the prevalence ranking does not contain it.
  assert.equal(e.cards[e.cards.length - 1]!.slug, 'autopilot', "Greg's quiet Door is on the board, as a Door");
});

test('BOARD · her taps become Doors, primary follows biggest-impact, and the board does not reappear', () => {
  const state: ConvState = { stage: 'doors', collected: { identityNoun: 'Maker', doors: ['career_cliff'] } };
  // She marks a Door we never gave her, rates them, and says which weighs most.
  const submission = '[board] door:career_cliff=3 door:vanishing=2 biggest:vanishing first:career_cliff open:vanishing';
  const turn = applyReconnectTurn(state, [], submission, { text: '' });

  assert.equal(turn.state.collected.boardDone, true);
  assert.ok(turn.state.collected.doors?.includes('vanishing'), 'a Door she claimed is hers — her word outranks the matcher');
  assert.equal(turn.state.collected.doors?.[0], 'vanishing', 'primary-first: biggest-impact leads (ruling #8)');
  assert.notEqual(turn.expects?.kind, 'doors_board', 'the board must not reappear over the conversation that follows');

  // The submission reaches the ACTION to persist — the engine itself writes nothing.
  const handed = (turn.state as { boardSubmission?: { biggest?: string } }).boardSubmission;
  assert.equal(handed?.biggest, 'vanishing', 'the action needs her choices, not a re-parse of the message');
});

test('BOARD · the reply names what she marked and leads with the one that weighs most', () => {
  const state: ConvState = { stage: 'doors', collected: { identityNoun: 'Maker', doors: [] } };
  const turn = applyReconnectTurn(state, [], '[board] door:body=3 door:loss=2 biggest:loss open:loss', { text: '' });

  assert.match(turn.reply, /The Body/);
  assert.match(turn.reply, /The Loss/);
  // Chronology is context; the heaviest is where the excavation has something to find.
  assert.ok(turn.reply.indexOf('weighs most') > 0, 'it leads on her own judgement, not on order');
  assert.ok(!/still open/i.test(turn.reply), 'she answered still-open, so it must not be asked again');
});

test('BOARD · skipping still-open earns exactly ONE ask, in conversation, never a block', () => {
  const state: ConvState = { stage: 'doors', collected: { identityNoun: 'Maker', doors: [] } };
  const turn = applyReconnectTurn(state, [], '[board] door:body=3 door:loss=2 biggest:body', { text: '' });
  assert.match(turn.reply, /still open/i, 'the field six Sessions read earns one honest ask');
});

test('BOARD · marking nothing is an ANSWER, not a failed step', () => {
  const state: ConvState = { stage: 'doors', collected: { identityNoun: 'Maker', doors: [] } };
  const turn = applyReconnectTurn(state, [], '[board] ', { text: '' });

  assert.equal(turn.state.collected.boardDone, true, 'she answered; do not hand it back to her');
  assert.match(turn.reply, /that's an answer/i);
  assert.ok(!/still open/i.test(turn.reply), 'nothing to ask about when she marked nothing');
});

// ── THE ENTRANCE ECHO ─────────────────────────────────────────────────────────────────────────────────────────
//
// The product had exactly ONE line saying what Reconnect is FOR, and it fired at the EXIT — "Reconnect, the
// seeing, is behind you" — to a member who no longer needed telling. The precondition itself scored zero across
// 1,141 authored strings. Jay's walk (2026-08-25) is what surfaced it: 65 minutes of an unbroken arc whose reason
// was never stated at the front.
//
// It is asserted on EVERY opener path because the three paths degrade separately — a member with no Door, or with
// nothing but a gap story, needs the reason as much as the richest case does, and it would be easy to add it to
// the one path anybody tests.

test('the entrance echo opens every Reconnect path, before the forecast', () => {
  const cases: Array<[string, Collected]> = [
    ['a named Door', { identityNoun: 'Player', doors: ['grind'], gap: 'the film took over' }],
    ['gap only, no Door', { identityNoun: 'Player', gap: 'the film took over' }],
    ['thin capture', {}],
  ];
  for (const [label, collected] of cases) {
    const beats = reconnectCallback(collected).split(BEAT_SEP);
    const echo = beats.findIndex((b) => b.includes("you can't change what you haven't seen"));
    // The forecast opened "Here's the shape of it" until 2026-08-27, when that phrase came out of all member
    // copy — our own system prompt forbids the Companion from using it. What this test protects is the ORDER
    // (the echo is the reason for the shape the forecast describes), so it follows the copy rather than pinning it.
    const forecast = beats.findIndex((b) => b.includes("Here's how it goes"));

    assert.ok(echo >= 0, `${label}: the entrance echo is missing`);
    assert.ok(forecast >= 0, `${label}: the forecast is missing`);
    // Order is the whole point: the echo is the REASON for the shape the forecast then describes.
    assert.ok(echo < forecast, `${label}: the echo must come BEFORE the forecast, not after`);
  }
});

test('the echo is the second-pass framing, never the jolt', () => {
  // Cowork's first draft opened "Reconnect is that jolt, on purpose… so first, we go find them". A member here has
  // ALREADY been jolted — named an identity, built a Reclaim List, signed up — so that copy restarts a
  // conversation they finished. The jolt belongs at the front door and the ramp. This guards the distinction.
  const text = reconnectCallback({ identityNoun: 'Player', doors: ['grind'] }).toLowerCase();
  assert.ok(!text.includes('the jolt'), 'the jolt framing belongs at the front door, not at the second pass');
  assert.ok(!text.includes('we go find them'), 'a returning member is not starting to look for the first time');
  assert.ok(text.includes('go back properly'), 'the echo should frame this as the deeper second pass');
});

// ── NO SCRIPTED SUBSTITUTION MAY STRAND THE MEMBER ────────────────────────────────────────────────────────────
//
// Jay hit this TWICE in one Session (2026-08-25). Accepting a Door the Companion had surfaced produced "The
// Load-Bearer, too — I'll hold that alongside the one you named. Both are part of it. Let's keep going." — and
// then an empty text box. Both variants of reseeingLanded end on a promise to continue and then terminate.
//
// It is not a one-off: the branch fires ONCE PER DOOR ACCEPTED, so a member who surfaces three Doors in
// conversation meets three dead ends, at precisely the beats meant to draw them out.
//
// SECOND INSTANCE OF ONE SHAPE. The gap→reclaim hand-in had it first ("this site discarded the model's turn
// entirely and substituted the scripted bridge") and was fixed with receiveThen. A scripted reply must either
// carry a question or hand back to the model — never both replace the turn AND end it.

test('accepting a re-seeing lands the Door AND hands forward — never a dead end', () => {
  for (const kind of ['widen', 'name', 'correct'] as const) {
    const pending: ConvState = {
      stage: 'doors',
      awaitingConfirm: true,
      pendingRevision: { kind, toSlug: 'load_bearer', ...(kind === 'correct' ? { fromSlug: 'grind' } : {}) },
      collected: { identityNoun: 'Player', doors: ['grind'] },
    };
    // A CLEAN acceptance — the branch Jay hit. `replyIntent: 'done'` is the model agreeing it was a plain yes,
    // and `text: ''` is what the model actually gives on a bare confirm: nothing to carry.
    const turn = applyReconnectTurn(pending, [], 'Yes', { text: '', replyIntent: 'done' });
    const reply = turn.reply.split(BEAT_SEP).join('\n');

    assert.match(reply, /Load-Bearer/, `${kind}: the Door is named back`);
    assert.ok(
      /\?/.test(reply),
      `${kind}: a scripted landing that ends the turn with no question strands the member —\n${reply}`,
    );
  }
});

// ── THE ENGINE NO LONGER MANUFACTURES THE CONFIRM QUESTION (Decision B, 2026-08-25) ───────────────────────────
//
// Jay was asked "Does that Tuesday feel like the one worth chasing — or is there more to it?", answered
// "Absolutely", and the next turn ended "Is that the one worth chasing — or not quite it yet?".
//
// The MODEL asked that first question, so awaitingConfirm was never set — the engine only raises it when IT emits
// a reflection. His answer went to `gather`, which advanced BECAUSE drawoutShouldReflect read the model as having
// wrapped up (declarative, no "?"), and then reflectWindow stapled a question on, un-wrapping the very signal it
// had just acted on. A close is a complete turn PRECISELY because it has no question.

test('a model turn that wrapped up is left alone — the engine adds no question of its own', () => {
  const close =
    "That's the day. Lean and rested, the work in, the ride on the calendar. " +
    "We'll leave it there for today. When you're ready, the next phase starts turning that morning into a plan.";
  const atWindow: ConvState = {
    stage: 'window',
    collected: { identityNoun: 'Player', doors: ['grind'] },
    stageScratch: { window: { windowDepth: 3 } },
  } as unknown as ConvState;

  const turn = applyReconnectTurn(atWindow, [], 'Absolutely', { text: close, depthReady: true } as never);

  assert.ok(
    !turn.reply.includes('worth chasing — or not quite it yet'),
    `the engine appended its confirm to a close the member had already answered:\n${turn.reply}`,
  );
  assert.match(turn.reply, /leave it there for today/, "the model's own words stand");
});

test('the ruling is still offered — as chips, with the question as their prompt', () => {
  // B is not "stop asking". The reflection still has to be rulable; the ruling just stops being a sentence the
  // engine writes into the Companion's mouth.
  const atWindow: ConvState = {
    stage: 'window',
    collected: { identityNoun: 'Player', doors: ['grind'] },
    stageScratch: { window: { windowDepth: 3 } },
  } as unknown as ConvState;
  const turn = applyReconnectTurn(atWindow, [], 'Absolutely', { text: 'That is the day, and it is ordinary.', depthReady: true } as never);

  assert.equal(turn.expects?.kind, 'beat_confirm', 'the member has no way to rule on the reflection');
  assert.equal(turn.state.awaitingConfirm, true);
});

// ── THE LEGACY LETTER CONFIRM IS A TAP (Q17, 2026-08-25) ──────────────────────────────────────────────────────
//
// Jay answered "That's great" and the ENTIRE letter reprinted. Any round that does not cleanly close redraws the
// whole artifact, so a misread here hands a member a page of their own words back with the implication we were
// not listening. Donna hit the same beat on 8/18 — "I just said, it sounds great!" — and the Companion's own
// reply was the diagnosis: "You did — I circled back one time too many." That produced a patch for the "I just
// said" prefix; Jay's phrasing had no prefix and walked straight through. Seventh instance of one shape.
//
// The gap confirm solved this exact problem by becoming three buttons: "a better classifier is a better guess, a
// tap is a fact." This is that fix, applied to the beat with the highest cost per miss.

test('the letter draft offers the ruling as a tap, in its OWN two words', () => {
  const atLegacy: ConvState = { stage: 'legacy', collected: { identityNoun: 'Player', doors: ['grind'] } };
  const turn = applyReconnectTurn(atLegacy, [], 'that sounds right', {
    text: '',
    legacyBody: 'A year from today. I am writing this from an ordinary Tuesday.',
  } as never);

  assert.equal(turn.expects?.kind, 'beat_confirm');
  const labels = (turn.expects as { choices: { label: string }[] }).choices.map((c) => c.label);
  assert.deepEqual(labels, ['Change a line', 'That’s mine']);
  // The appraisal rule: this beat must never ask whether the letter is good.
  assert.ok(!labels.includes('That’s it'), 'an appraisal chip invites the polite yes the beat exists to avoid');
});

test('tapping "That’s mine" COMMITS — it does not redraft the letter back at them', () => {
  const atLegacy: ConvState = {
    stage: 'legacy',
    awaitingConfirm: true,
    legacyDraft: 'A year from today. I am writing this from an ordinary Tuesday.',
    collected: { identityNoun: 'Player', doors: ['grind'] },
  } as unknown as ConvState;

  // The tap, not prose. This is the turn where Jay typed "That's great" and got the whole letter again.
  const turn = applyReconnectTurn(atLegacy, [], serializeBeatConfirm('done', 'legacy'), { text: '' } as never);

  // "MOVES OFF THE LETTER BEAT" now means the SESSION ends, not that the stage advances to the checkpoint —
  // R3 closes here and the Checkpoint is its own Session. The fault this test exists for is unchanged: a clean
  // acceptance must not redraft the letter back at her.
  assert.equal(turn.complete, true, 'a clean acceptance closes R3');
  assert.doesNotMatch(turn.reply, /Read it back\. What's not right/, 'it must not ask for a revision they declined');
});

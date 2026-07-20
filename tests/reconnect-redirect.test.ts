import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyReconnectTurn, detectDoorRedirect } from '../lib/agent/reconnect.ts';
import type { ConvState } from '../lib/agent/onboarding.ts';

// ============================================================================================================
// W-34 — DETERMINISTIC REDIRECT DETECTOR (charter-readiness ledger; "stateless-arcs / honor-the-member" theme).
// The redirect-honor rule is in the prompt, but the model railroaded past it (2nd occurrence → fix the abstraction).
// At the OPENER RESPONSE, if the member pivots to a DIFFERENT committed Door as the origin, the ENGINE proposes the
// primacy correction (propose→confirm via the §2b path), instead of trusting the model to notice. Tight scope so a
// false proposal can't corrupt: opener-anchored · committed-only · requires an origin cue · propose-not-commit · once.
// ============================================================================================================

// --- the pure detector -------------------------------------------------------------------------------------
test('detectDoorRedirect · fires on a matchable committed-Door redirect with an origin cue', () => {
  assert.deepEqual(
    detectDoorRedirect('honestly it goes back to the grind — that came before the diagnosis', ['diagnosis', 'grind']),
    { from: 'diagnosis', to: 'grind' },
  );
  assert.deepEqual(
    detectDoorRedirect('it was really my marriage, that came first', ['diagnosis', 'marriage']),
    { from: 'diagnosis', to: 'marriage' },
  );
});

test('detectDoorRedirect · a passing/sequence mention (no origin cue) does NOT fire — context, not a redirect', () => {
  // matchDoors sees both doors here, but there's no reassignment language → not a redirect.
  assert.equal(detectDoorRedirect('the marriage got hard around the time of the diagnosis', ['marriage', 'diagnosis']), null);
});

test('detectDoorRedirect · committed-only — a redirect to a NON-committed Door defers to the model', () => {
  // "the grind" is matchable, and the cue is present, but grind was never one of their doors → engine stays out.
  assert.equal(detectDoorRedirect('really it goes back to the grind', ['marriage']), null);
});

test('detectDoorRedirect · only the opened Door named → no redirect', () => {
  assert.equal(detectDoorRedirect('yeah, really it was the diagnosis', ['diagnosis', 'grind']), null);
});

test('detectDoorRedirect · KNOWN LIMIT — an un-aliased word for a Door ("the job" → The Grind) is NOT recognized', () => {
  // matchDoors maps "the grind"/"work took over" → grind, but a bare "the job" maps to nothing (forcing it would
  // collide with career_cliff's "lost my job"). So this exact founder-walk phrasing falls to the model, by design.
  assert.equal(detectDoorRedirect('It was really the job before the diagnosis. The job led to the sickness.', ['diagnosis', 'grind']), null);
});

// --- through the stage (propose → confirm) -----------------------------------------------------------------
const openedOnDiagnosis: ConvState = {
  stage: 'doors',
  collected: { identityNoun: 'Rider', doors: ['diagnosis', 'grind'], gap: 'the diagnosis was the mirror moment' },
};

test('W-34 · the ENGINE proposes the switch when the model railroads (propose ≠ commit)', () => {
  // The model ignored the redirect and reflected the diagnosis anyway — no revision signal.
  const turn = applyReconnectTurn(openedOnDiagnosis, [], 'honestly it goes back to the grind — that came before the diagnosis', {
    text: 'The Diagnosis — the mirror you couldn’t look away from. Say more about that day.',
  });
  assert.equal(turn.state.awaitingConfirm, true, 'offered as a check — awaits the member');
  assert.deepEqual(turn.state.pendingRevision, { kind: 'correct', fromSlug: 'diagnosis', toSlug: 'grind' }, 'engine holds the correction');
  assert.deepEqual(turn.state.collected.doors, ['diagnosis', 'grind'], 'NOTHING changes until they confirm');
  assert.match(turn.reply, /Grind/, 'names the redirect target');
  assert.match(turn.reply, /Should we start there|where it really began/i, 'offered as a check, not asserted');
});

test('W-34 · CONFIRM commits the primacy correction (data is fixed) + emits the tell', () => {
  const pending: ConvState = {
    stage: 'doors',
    awaitingConfirm: true,
    pendingRevision: { kind: 'correct', fromSlug: 'diagnosis', toSlug: 'grind' },
    collected: { identityNoun: 'Rider', doors: ['diagnosis', 'grind'] },
  };
  const turn = applyReconnectTurn(pending, [], 'yeah — the grind, that’s the real start', { text: '', replyIntent: 'done' });
  assert.deepEqual(turn.state.collected.doors, ['grind'], 'primacy corrected: diagnosis→grind, deduped');
  assert.deepEqual(turn.state.reseeingTells, [{ fromSlug: 'diagnosis', toSlug: 'grind' }], 'a real re-seeing emits a tell');
  assert.equal(turn.state.pendingRevision, undefined, 'pending cleared');
  assert.match(turn.reply, /Grind/, 'names the corrected door back');
});

test('W-34 · a passing mention does NOT trip a proposal — the excavation keeps drawing out', () => {
  const openedOnMarriage: ConvState = { stage: 'doors', collected: { identityNoun: 'Rider', doors: ['marriage', 'diagnosis'] } };
  const turn = applyReconnectTurn(openedOnMarriage, [], 'the marriage got hard around the time of the diagnosis', {
    text: 'When did you first feel that drift?',
  });
  assert.notEqual(turn.state.awaitingConfirm, true, 'no proposal — this is context, not a redirect');
  assert.equal(turn.state.pendingRevision, undefined, 'nothing held');
  assert.deepEqual(turn.state.collected.doors, ['marriage', 'diagnosis'], 'doors untouched');
});

test('W-34 · OPENER-ANCHORED — a matchable redirect mid-excavation defers to the model (not the engine)', () => {
  const midExcavation: ConvState = {
    stage: 'doors',
    stageScratch: { doors: { doorDepth: 2 } },
    collected: { identityNoun: 'Rider', doors: ['diagnosis', 'grind'] },
  };
  const turn = applyReconnectTurn(midExcavation, [], 'really it goes back to the grind', { text: 'Go on — what did that cost?' });
  assert.equal(turn.state.pendingRevision, undefined, 'past the opener, a Door mention is the model’s call, not a deterministic swap');
});

test('W-34 · ONCE per excavation — after the check has run, it does not re-fire (a dispute can’t loop it)', () => {
  const alreadyChecked: ConvState = {
    stage: 'doors',
    stageScratch: { doors: { doorDepth: 0, redirectChecked: true } },
    collected: { identityNoun: 'Rider', doors: ['diagnosis', 'grind'] },
  };
  const turn = applyReconnectTurn(alreadyChecked, [], 'really it goes back to the grind', { text: 'Tell me more.' });
  assert.equal(turn.state.pendingRevision, undefined, 'the one engine redirect-check already ran — no re-proposal loop');
});

test('W-34 · the model’s OWN revision still wins (engine detector doesn’t override a model-signaled re-seeing)', () => {
  const turn = applyReconnectTurn(openedOnDiagnosis, [], 'really it goes back to the grind', {
    text: 'Everything you said points to the grind — truer there?',
    revision: { kind: 'correct', fromSlug: 'diagnosis', toSlug: 'grind' },
  });
  assert.deepEqual(turn.state.pendingRevision, { kind: 'correct', fromSlug: 'diagnosis', toSlug: 'grind' }, 'the model’s signal is used directly');
  assert.equal(turn.state.awaitingConfirm, true);
});

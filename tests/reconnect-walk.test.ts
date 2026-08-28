// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE WHOLE WALK — RECONNECT. Does a member actually get all the way through the phase?
//
// The onboarding twin of this file (tests/onboarding-walk.test.ts) was written on 2026-08-20 after a day in which
// five member-facing failures all turned out to be one shape — A REQUIRED SURFACE DID NOT APPEAR AT ITS BEAT — and
// none were caught by 1971 passing tests, because every one of those tested a pure function in isolation.
//
// RECONNECT IS WHERE THE WORST OF THEM ACTUALLY HAPPENED, and it had no such gate:
//
//   · mid-DRIFT the model ran ahead and asked the Window's Tuesday question; she answered it; the engine then
//     arrived at the Window beat and asked it again. She was asked the same thing three times, wrote "This is
//     fucked up", and the Companion apologised and asked a fourth.
//   · her protest was stored as her vision, offered back as a keeper card ("The Spark"), AND carried into the
//     Legacy Letter as her answer — one bad value, three surfaces.
//   · a keeper card interrupted mid-conversation with no way to decline.
//
// WHY A REPLAY SCRIPT CANNOT CATCH THIS, and why this file does not use tests/arc-replay.ts. That harness feeds a
// FIXED list of member messages. A script doesn't depend on what the engine handed back, so a walk where the Doors
// board never renders still "passes" — the script types its answers regardless. This driver can only answer the
// surface it was ACTUALLY GIVEN. If a beat never opens, nothing answers it, and the walk stalls exactly as a
// member's would.
//
// WHAT IT ASSERTS — the contract, not the choreography. Not copy, not turn counts, not how long a draw-out runs.
// Only what must never be false: every gate renders, the instrument is delivered whole and in order, the phase
// reaches its ceremony, no turn is silent, and no turn tells her the work is done before it is.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyReconnectTurn, reconnectOpening, reconnectR1Opening, reconnectR3Opening, reconnectCheckpointOpening,
  RECONNECT_R1_ARC, RECONNECT_R2_ARC, RECONNECT_R3_ARC, RECONNECT_CHECKPOINT_ARC,
} from '../lib/agent/reconnect.ts';
import { expectsForState, type ArcConfig } from '../lib/agent/onboarding-staged.ts';
import type { Collected } from '../lib/agent/onboarding.ts';
import { TOTAL_ITEMS } from '../lib/idq/instrument.ts';
import { CHECKPOINT_GRIT_ITEMS } from '../lib/grinta/survey/instrument.ts';
import { claimsGateOutcome } from '../lib/agent/gate-claims.ts';
import { serializeBoardSubmission } from '../lib/reconnect/doors-board-claim.ts';
import type { Collected, ConvMessage, ConvState, Expectation, ModelTurn, Turn } from '../lib/agent/onboarding.ts';

/** What a member arrives at Reconnect holding, from onboarding. */
const COMMITTED: Collected = {
  identityNoun: 'Maker',
  gap: 'I lost my job two years ago and I was our family’s sole financial provider. My dad got sick around the same time.',
  doors: ['career_cliff', 'aging_parents'],
  reclaimList: ['lose the 20 lbs I gained', 'get my strength and fitness back', 'a creative job that sustains me'],
};

const TUESDAY =
  'I’d be up before anyone else, out for a walk while it’s still quiet, and I’d come home and make something that was only mine.';

/**
 * Drive a full Reconnect the way the CLIENT does — answering only what the engine actually handed back.
 *
 * The `expects` union is a contract between the engine and the browser, and every failure listed above lived in
 * that seam. So this deliberately has no script: it looks at the surface in front of it and responds to that.
 */
/**
 * THE WALK IS FOUR SESSIONS NOW (2026-08-28), chained in the order a member takes them: R1 the mirror, R2 the
 * Doors, R3 the Drift Quiz + Legacy Letter, then the Checkpoint. It used to be one continuous arc, so the harness
 * opened once and ran until the ceremony — with each Session ending, that stopped after the first close.
 *
 * Chaining rather than asserting per Session is deliberate: what these tests protect is that the PHASE is
 * completable and that both instruments are delivered whole, and a boundary is exactly the kind of place where a
 * member gets stranded. Walking the seams is the only way to catch that.
 */
const SESSIONS: { arc: ArcConfig; open: (c: Collected) => Turn }[] = [
  { arc: RECONNECT_R1_ARC, open: reconnectR1Opening },
  { arc: RECONNECT_R2_ARC, open: reconnectOpening },
  { arc: RECONNECT_R3_ARC, open: reconnectR3Opening },
  { arc: RECONNECT_CHECKPOINT_ARC, open: reconnectCheckpointOpening },
];

function walk(model: (state: ConvState, turn: number) => ModelTurn, maxTurns = 120) {
  const history: ConvMessage[] = [];
  const seen = new Set<string>();
  // Scale items are tracked PER STAGE. Reconnect administers TWO instruments — the 24-item IDQ at `measurement`
  // and the 6-item grit checkpoint — and a flat count conflates them: my first version asserted 24 and saw 30,
  // which looked exactly like a bug in the instrument and was a bug in the assertion.
  const scaleByStage: Record<string, number[]> = {};
  const turns: Turn[] = [];
  let state: ConvState = { stage: '', collected: COMMITTED } as ConvState;
  let expects: Expectation | null = null;

  for (const { arc, open } of SESSIONS) {
    const opening = open(COMMITTED);
    history.push({ role: 'agent', text: opening.reply });
    turns.push(opening);
    state = opening.state;
    // The opening's own expectation, or the one its stage implies — an administered Session must arrive with its
    // chips, which is how the harness knows to answer with a number rather than prose.
    expects = opening.expects ?? expectsForState(arc, opening.state) ?? null;
    if (expects) seen.add(expects.kind);
    const done = runSession(arc, model);
    if (!done) break;
  }
  return { state, turns, seen, scaleByStage };

  /** One Session, to its close. Returns false if it stalled — the caller stops rather than walking on blind. */
  function runSession(arc: ArcConfig, m: (s: ConvState, t: number) => ModelTurn): boolean {
  for (let i = 0; i < maxTurns; i++) {
    let msg: string;
    if (expects?.kind === 'doors_board') {
      // She marks the Doors she already holds and names the one that weighs most — the ordinary path.
      // The FULL submission shape, unabridged. My first pass wrote a partial object and reached for `as never` to
      // quiet the typechecker — which is exactly how a test ends up asserting against a payload no client sends.
      msg = serializeBoardSubmission({
        doors: (COMMITTED.doors ?? []).map((slug) => ({ slug, relevance: 3 })),
        quietDrift: false,
        first: COMMITTED.doors?.[0] ?? null,
        biggest: COMMITTED.doors?.[0] ?? null,
        stillOpen: [],
      });
    } else if (expects?.kind === 'scale') {
      (scaleByStage[state.stage ?? '?'] ??= []).push(expects.index);
      msg = '3';
    } else {
      msg = [TUESDAY, 'That’s the whole of it.', 'Yes, that’s right.', 'It cost me a lot of confidence.'][i % 4]!;
    }

    const turn = applyReconnectTurn(state, history, msg, m(state, i), arc);
    turns.push(turn);
    history.push({ role: 'member', text: msg }, { role: 'agent', text: turn.reply });
    state = turn.state;
    expects = turn.expects ?? null;
    if (expects) seen.add(expects.kind);
    if (turn.complete || state.stage === 'ceremony') return true;
  }
  return false; // stalled — maxTurns without a close
  }
}

/**
 * A cooperative model: signals each beat is drawn out when asked, and drafts the letter ONCE.
 *
 * The "once" is not incidental. My first version supplied `legacyBody` on every legacy turn, and the walk stalled
 * in that beat forever — a redraft arriving on a turn supersedes everything, so a model that never stops drafting
 * is never done. That is unrealistic of a real model (it calls record_legacy_letter and then answers the "save
 * it?" question in prose), so the stub was wrong. It did, however, expose a real asymmetry in the beat, pinned in
 * its own test below.
 */
function makeCooperative() {
  let drafted = false;
  return (state: ConvState): ModelTurn => {
    const draft = state.stage === 'legacy' && !drafted;
    if (draft) drafted = true;
    return {
      text: 'Say more about that.',
      ...(state.stage === 'doors' ? { doorReady: true } : {}),
      ...(state.stage === 'drift' ? { driftReady: true, replyIntent: 'done' as const } : {}),
      ...(state.stage === 'window' ? { replyIntent: 'done' as const } : {}),
      ...(draft ? { legacyBody: 'Dear me, one year on. You kept going.' } : {}),
      ...(state.stage === 'legacy' && !draft ? { replyIntent: 'done' as const } : {}),
    };
  };
}

test('WALK — the Doors board is put in front of her, and BOTH instruments are delivered whole', () => {
  const { seen, scaleByStage } = walk(makeCooperative());
  assert.ok(seen.has('doors_board'), 'the member was NEVER handed the Doors board — R2 cannot be completed');
  assert.ok(seen.has('scale'), 'no scale surface ever appeared — the phase would end with no measurement');

  // The IDQ is FROZEN (24 items, 4 dimensions) and so is the grit checkpoint (6). A walk that renders the surface
  // but drops items would pass a mere coverage check while writing a wrong ID Score to her dashboard.
  const idq = scaleByStage.measurement ?? [];
  assert.equal(idq.length, TOTAL_ITEMS, `every IDQ item must be asked (${TOTAL_ITEMS})`);
  assert.deepEqual(idq, idq.map((_, i) => i + 1), 'in order, with none skipped or repeated');

  const grit = scaleByStage.checkpoint ?? [];
  assert.equal(grit.length, CHECKPOINT_GRIT_ITEMS.length, 'the checkpoint grit items must all be asked');
  assert.deepEqual(grit, grit.map((_, i) => i + 1), 'in order too');
});

test('WALK — the phase reaches its ceremony rather than stalling in a beat', () => {
  const { state } = walk(makeCooperative());
  assert.equal(state.stage, 'ceremony', 'Reconnect must reach the reveal, not stop somewhere in the middle');
});

test('WALK — the Companion is never silent; no turn ships a blank bubble', () => {
  // A model turn that records something and writes no prose used to ship an empty reply in onboarding — a blank
  // bubble and a conversation that has visibly stopped. Every stage here passes model prose through somewhere.
  const base = makeCooperative();
  const mute = (state: ConvState): ModelTurn => ({ ...base(state), text: '' });
  for (const m of [makeCooperative(), mute]) {
    for (const turn of walk(m).turns) {
      assert.ok(turn.reply.trim().length > 0, `a turn shipped an empty reply at stage "${turn.state.stage}"`);
    }
  }
});

test('WALK — no turn tells her the work is finished before it is', () => {
  for (const turn of walk(makeCooperative()).turns) {
    if (turn.complete || turn.state.stage === 'ceremony') continue;
    assert.equal(
      claimsGateOutcome(turn.reply),
      false,
      `a mid-phase turn claimed an outcome: "${turn.reply.slice(0, 80)}"`,
    );
  }
});

test('WALK — a model that runs ahead cannot skip a beat or strand her', () => {
  // Donna's actual failure, generalised: the model behaving as though it is further along than the engine. It
  // asked the Window's question during the drift beat and promised a letter that was two beats away. The walk must
  // still deliver every surface and still finish — the engine referees, the model does not.
  const base = makeCooperative();
  const runsAhead = (state: ConvState): ModelTurn => ({
    ...base(state),
    text:
      state.stage === 'drift'
        ? 'Picture an ordinary Tuesday a year from now — and then I’ll turn it into a letter to yourself.'
        : 'Say more about that.',
  });
  const { seen, state, scaleByStage } = walk(runsAhead);
  assert.ok(seen.has('doors_board'), 'the board still renders');
  assert.equal((scaleByStage.measurement ?? []).length, TOTAL_ITEMS, 'the instrument is still delivered whole');
  assert.equal(state.stage, 'ceremony', 'and she still reaches the end');
});

// ── THE REVISION CAP BINDS BOTH SIDES ──────────────────────────────────────────────────────────────────────────
//
// Found by the walk gate above before it went green. The Legacy Letter allows a bounded number of revisions, and
// the check was applied to only ONE of the two ways a revision arrives: a MEMBER who kept asking for changes was
// stopped at the cap, while a MODEL that kept calling record_legacy_letter was not — every redraft re-opened the
// confirm, so the beat could not end and she could not leave it.
//
// The asymmetry is the bug. Everything else today was the same shape: a limit the engine enforces against the
// member and not against the model.
test('a model that never stops redrafting cannot trap her in the letter beat', () => {
  // The pathological case, stated plainly: the tool is called on every single turn.
  const alwaysDrafts = (state: ConvState): ModelTurn => ({
    text: 'Here is another version.',
    ...(state.stage === 'doors' ? { doorReady: true } : {}),
    ...(state.stage === 'drift' ? { driftReady: true, replyIntent: 'done' as const } : {}),
    ...(state.stage === 'window' ? { replyIntent: 'done' as const } : {}),
    ...(state.stage === 'legacy' ? { legacyBody: 'Dear me, one year on. Draft again.' } : {}),
  });

  const { state, turns } = walk(alwaysDrafts);
  assert.equal(state.stage, 'ceremony', 'the beat must end even when the model will not stop');

  // …and her LATEST draft is what gets kept. Losing the newest revision to enforce a limit would be the wrong
  // trade — she asked for that change, and it is her letter.
  const saved = turns.find((t) => t.state.legacyLetter?.body);
  assert.ok(saved, 'a letter must actually be committed, not silently dropped to escape the loop');
  assert.match(saved!.state.legacyLetter!.body, /Draft again/, 'and it is the most recent version she was shown');
});

// THE LEGACY LETTER OPENS ON A QUESTION — Donna, 2026-08-22, item 12.
//
// "Stalls on a declarative statement with no clear next step, requiring the user to prompt it forward." Her
// transcript has her typing "Ok, what questions do you have?" to unblock a beat that had just promised to ask.
//
// It stalled by construction: the opener ended on "I'll ask you a few things and then draft it" and then waited,
// because the model gets no turn until the member speaks. This asserts the beat hands her something to answer.
test('the Legacy Letter opener ends on a question, and skips the Tuesday when it was carried', async () => {
  const { LEGACY_PROMPTS } = await import('../lib/reconnect/legacy-letter.ts');
  const tuesday = LEGACY_PROMPTS[0]!.prompt;
  const second = LEGACY_PROMPTS[1]!.prompt;

  // Her transcript's actual path: the Window reflects, she confirms ("That's the one"), and THAT hands into the
  // letter. Driving it any shorter just keeps the Window drawing out, which is what my first version of this
  // test did — a broken probe, not a broken product.
  const atConfirm: any = {
    stage: 'window',
    awaitingConfirm: true,
    legacyTuesday: 'up early, out on the bike before the kids wake',
    collected: { identityNoun: 'Maker', gap: 'the job went', doors: ['career_cliff'] },
  };
  const turn = applyReconnectTurn(atConfirm, [], "That's the one", { text: '', replyIntent: 'done' });

  assert.equal(turn.state.stage, 'legacy', 'confirming the Window must hand into the Legacy Letter');
  const reply = turn.reply;
  assert.match(reply.trim(), /\?\s*$/, `the beat must end on a question, not a statement:\n${reply}`);
  assert.ok(!reply.includes(tuesday), 'the carried Tuesday was asked again — the product not listening the first time');
  assert.ok(reply.includes(second), `expected the beat to open on prompt two:\n${reply}`);
});

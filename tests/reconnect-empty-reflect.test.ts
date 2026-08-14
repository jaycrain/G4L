import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyReconnectTurn } from '../lib/agent/reconnect.ts';
import type { ConvMessage, ConvState } from '../lib/agent/onboarding.ts';

// ============================================================================================================
// AN EMPTY MODEL TURN MUST NOT PRODUCE A CONSTANT.
//
// The draw-out beats (drift, window) advance to a reflect-confirm when the model signals depth. But the model can
// signal depth and emit NO PROSE — it called its tool and wrote nothing. The engine then had two coupled bugs:
//
//   1. reflectDrift/reflectWindow returned a FIXED fallback sentence, so the reply was a constant; and
//   2. awaitingConfirm was set from that same empty text, so it stayed FALSE and the beat never entered confirm().
//
// Together those trap the member: every subsequent turn re-runs gather, re-advances, and re-emits the IDENTICAL
// sentence, while nothing they say can be read as a confirmation because the engine isn't listening for one.
//
// Jennifer's live walk (2026-08-09) hit exactly this in The Window: she said "Perfectly depicted!", then told the
// companion three more times that she was finished, and got the same sentence back verbatim three turns running.
// The keeper it eventually committed was her give-up line ("That's the whole thing"), not her actual spark.
//
// This is the SECOND time this shape has been fixed here — windowMore() was already switched to rotate by
// agent-message count for the same reason (see its comment). The fixed fallback inside the reflect helpers was
// missed. So the contract is now pinned rather than left to the next reader: NO REFLECTION → rotate, don't confirm.
// ============================================================================================================

/** History grows by two messages per exchange; the rotating probes key off the agent-message count. */
function history(exchanges: number): ConvMessage[] {
  const h: ConvMessage[] = [];
  for (let i = 0; i < exchanges; i++) {
    h.push({ role: 'agent', text: `probe ${i}` }, { role: 'member', text: `reply ${i}` });
  }
  return h;
}

for (const stage of ['drift', 'window'] as const) {
  const depthKey = stage === 'drift' ? 'driftDepth' : 'windowDepth';

  test(`${stage} · an empty model turn past the depth floor NEVER enters the confirm state`, () => {
    const at: ConvState = { stage, stageScratch: { [stage]: { [depthKey]: 2 } }, collected: { doors: ['grind'] } };
    const turn = applyReconnectTurn(at, history(3), 'it took the mornings first, then the evenings', {
      text: '',
      depthReady: true,
    });
    // Nothing was reflected, so there is nothing to confirm — entering confirm() here leaves the engine waiting on
    // the answer to a question it never asked, which is what made the member's "yes" unhearable.
    assert.equal(turn.state.awaitingConfirm ?? false, false);
    assert.ok(turn.reply.trim().length > 0, 'it still says something');
  });

  test(`${stage} · consecutive empty model turns do NOT repeat the same sentence verbatim`, () => {
    // THE REGRESSION. Before the first fix both turns returned the identical hardcoded fallback string.
    //
    // THE HARNESS NOW FEEDS OUR OWN REPLIES BACK, because that is what production does — persistArcSession
    // writes `[...history, member turn, ...beatBubbles(reply)]`, so the next turn's engine sees what it just
    // said. The old harness grew the history with synthetic "probe N" lines and never included the replies,
    // which let an implementation that counted MESSAGES pass while one that reads what was actually SAID
    // failed. That flattered the counter and hid the real bug: counting wraps, and on the fourth ask the
    // member hears the first line again (Jay's walk, 2026-08-13: "Second time it's asked me this").
    //
    // SIX turns, not three: three variants, so a wrap can only show up on the fourth.
    let state: ConvState = { stage, stageScratch: { [stage]: { [depthKey]: 2 } }, collected: { doors: ['grind'] } };
    let h: ConvMessage[] = history(3);
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      const member = 'there is more to it than that';
      const turn = applyReconnectTurn(state, h, member, { text: '', depthReady: true });
      // STOP AT THE HAND-OFF. The invariant belongs to the DRAW-OUT: never say the same thing twice while
      // drawing a member out. Once the beat gives up and hands forward, the next stage is an administered
      // instrument, and an instrument re-asking "just a number, 1 to 5" until it gets one is correct — that
      // repetition is the design, not the bug.
      if (turn.state.stage !== stage) break;
      seen.push(turn.reply.trim());
      h = [...h, { role: 'member', text: member }, { role: 'agent', text: turn.reply }];
      state = turn.state;
    }
    const dupes = seen.filter((t, i) => seen.indexOf(t) !== i);
    assert.deepEqual(dupes, [], `the beat repeated itself verbatim: ${JSON.stringify(seen)}`);
  });

  test(`${stage} · a model turn WITH prose still reflects and awaits the check (the fix did not break the good path)`, () => {
    const at: ConvState = { stage, stageScratch: { [stage]: { [depthKey]: 2 } }, collected: { doors: ['grind'] } };
    const decl = 'I stopped riding, then I stopped seeing anyone, then I stopped noticing';
    const turn = applyReconnectTurn(at, history(3), decl, {
      text: 'The drift kept taking the things that were just yours.',
      depthReady: true,
    });
    assert.equal(turn.state.awaitingConfirm, true, 'a real reflection still opens the confirm gate');
    assert.match(turn.reply, /\?/, 'and ends on a check the member can answer');
  });
}

// THE WALK DRIVER — drive a session the way the CLIENT does, and report what the member was actually handed.
//
// WHY THIS IS NOT tests/arc-replay.ts. That harness feeds a FIXED list of member messages. A script does not
// depend on what the engine handed back, so a walk where a required surface never renders still "passes" — the
// script types its answers regardless. Every failure that reached a member on 2026-08-20 lived precisely in that
// seam (the engine's state was right; the member was handed the wrong thing, or nothing). This driver can only
// answer the surface it was ACTUALLY GIVEN, so a beat that never opens stalls the walk exactly as it stalls a
// person.
//
// WHY IT IS SHARED. There are twelve session entry points across Rewire, Rebuild and Reclaim. Twelve hand-written
// copies of "answer whatever arrives, then assert nothing is silent" is twelve chances for the copies to drift out
// of agreement — the failure this codebase keeps paying for (one fact, N sites). The driver is the fact; each
// phase's test file is a TABLE of sessions.
//
// WHAT IT DELIBERATELY DOES NOT DO: assert. It reports. Different sessions owe different surfaces, and a driver
// that decided that centrally would either be wrong for most of them or so vague it proved nothing.

import type { ConvMessage, ConvState, Expectation, ModelTurn, Turn } from '../lib/agent/onboarding.ts';

/** A session's pure turn function. Some are deterministic and take no model; the extra arg is harmless to them. */
export type SessionApply = (
  state: ConvState,
  history: ConvMessage[],
  memberMessage: string,
  model: ModelTurn,
) => Turn;

export type WalkResult = {
  /** Every expectation KIND the member was handed, in the order first seen. */
  seen: Set<string>;
  /** Scale items handed over, grouped by the stage that asked — never flattened, because a phase may run more than
   *  one instrument and a flat count silently conflates them (it read 30-for-24 on the first Reconnect gate). */
  scaleByStage: Record<string, number[]>;
  turns: Turn[];
  state: ConvState;
  /** True when the session ended on its own terms rather than running out of turns. */
  finished: boolean;
};

/** What a member types when the engine is NOT holding out a structured surface. Ordinary, substantive prose. */
const FREE_TEXT = [
  'It started after I lost the job, and it just kept going from there.',
  'That’s the whole of it.',
  'Yes, that’s right.',
  'It cost me a lot of confidence, and I stopped bothering.',
];

/**
 * Walk a session to its end, answering only what it hands back.
 *
 * @param answer optional per-session override for a surface this driver cannot answer generically (a builder, a
 *               board, a bespoke picker). Return null to fall through to the default behaviour.
 */
export function walkSession(
  apply: SessionApply,
  opening: Turn,
  model: (state: ConvState, turn: number) => ModelTurn,
  answer?: (expects: Expectation, state: ConvState) => string | null,
  maxTurns = 140,
): WalkResult {
  const history: ConvMessage[] = [{ role: 'agent', text: opening.reply }];
  let state = opening.state;
  let expects: Expectation | null = opening.expects ?? null;
  const seen = new Set<string>();
  const scaleByStage: Record<string, number[]> = {};
  const turns: Turn[] = [opening];
  // TWO WAYS A SESSION ENDS, and missing the second one made every walk look like an infinite loop. `complete`
  // is the ordinary terminal flag — but a phase that ends in a CEREMONY never sets it: the engine only LANDS on
  // stage 'ceremony' and the chat fires a full-screen overlay when it sees that, so the arc holds there
  // deliberately. A driver that waits for `complete` runs to its turn cap and reports a stall that isn't one.
  const ended = (t: Turn) => t.complete === true || t.state.stage === 'ceremony';
  let finished = ended(opening);
  if (expects) seen.add(expects.kind);

  for (let i = 0; i < maxTurns && !finished; i++) {
    const override = expects ? answer?.(expects, state) ?? null : null;
    let msg: string;
    if (override !== null) {
      msg = override;
      if (expects?.kind === 'scale') (scaleByStage[state.stage ?? '?'] ??= []).push(expects.index);
    } else if (expects?.kind === 'scale') {
      (scaleByStage[state.stage ?? '?'] ??= []).push(expects.index);
      msg = '3';
    } else if (expects?.kind === 'identity_pick') {
      msg = expects.candidates?.[0] ?? 'Maker';
    } else {
      msg = FREE_TEXT[i % FREE_TEXT.length]!;
    }

    const turn = apply(state, history, msg, model(state, i));
    turns.push(turn);
    history.push({ role: 'member', text: msg }, { role: 'agent', text: turn.reply });
    state = turn.state;
    expects = turn.expects ?? null;
    if (expects) seen.add(expects.kind);
    if (ended(turn)) finished = true;
  }

  return { seen, scaleByStage, turns, state, finished };
}

/** An instrument must arrive WHOLE and IN ORDER — 1..n, nothing skipped, nothing repeated. */
export function isCompleteInOrder(items: number[], expected: number): boolean {
  return items.length === expected && items.every((n, i) => n === i + 1);
}

/**
 * THE SAME CONTRACT, FOR AN INSTRUMENT SPLIT ACROSS STAGES — 1..n across the whole Session, in order, with each
 * stage carrying one contiguous run of it.
 *
 * `isCompleteInOrder` asserts every stage starts at item 1, which was true while a stage held a whole instrument.
 * B1 now administers its twelve items in two halves either side of Greg's eating elicitation (2026-08-28), so its
 * second half legitimately runs 7–12 — and the old check read that as a broken instrument. The property that
 * actually matters is unchanged and is what this states: nothing skipped, nothing repeated, nothing out of order,
 * across however many stages the Session chooses to deliver it in.
 *
 * Returns null when whole, or the reason it is not — so the caller reports what was actually delivered.
 */
export function instrumentRunIsWhole(scaleByStage: Record<string, number[]>): string | null {
  const runs = Object.entries(scaleByStage).filter(([, items]) => items.length);
  if (!runs.length) return null; // a Session with no instrument has nothing to be wrong about
  for (const [stage, items] of runs) {
    const contiguous = items.every((n, i) => n === items[0]! + i);
    if (!contiguous) return `"${stage}" is not one contiguous run — [${items.join(',')}]`;
  }
  const all = runs.flatMap(([, items]) => items).sort((a, b) => a - b);
  const whole = all.every((n, i) => n === i + 1);
  if (!whole) return `the Session's items are not 1..${all.length} — [${all.join(',')}]`;
  return null;
}

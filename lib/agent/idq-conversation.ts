// Conversational IDQ administration — the Member Agent walks the member through the 24 items
// one at a time, six per dimension, with brief framing (Member Agent Tech Spec v1.1 §4.2,
// corrected: no bands). The instrument is fixed, so this is deterministic — it runs instantly
// (client-side, no per-item API cost) and identically offline or live. Scoring happens after,
// in the runtime (flow.submitIdq), never in a model. Governance: crisis detection each turn.

import {
  DIMENSIONS,
  ITEMS_PER_DIMENSION,
  TOTAL_ITEMS,
  LIKERT_MIN,
  LIKERT_MAX,
  dimensionForIndex,
  itemStem,
} from '../idq/instrument.ts';
import { detectCrisis, CRISIS_RESPONSE_US } from './governance.ts';

const DIM_LABEL: Record<(typeof DIMENSIONS)[number], string> = {
  physical: 'Physical',
  self: 'Self',
  social: 'Social',
  outlook: 'Outlook',
};

export type IdqConvState = { responses: number[] };
export type IdqTurn = {
  reply: string;
  state: IdqConvState;
  complete: boolean;
  crisis?: boolean;
  responses?: number[]; // present on completion
};

export const INITIAL_IDQ_STATE: IdqConvState = { responses: [] };

const anchors = `(${LIKERT_MIN} = not at all like me … ${LIKERT_MAX} = very much like me)`;

function frame(i: number): string {
  // Header at the first item of each dimension.
  return i % ITEMS_PER_DIMENSION === 0
    ? `These six are about your ${DIM_LABEL[dimensionForIndex(i)]}.\n\n`
    : '';
}

function presentItem(i: number): string {
  return `${i + 1}. ${itemStem(i)}\n${anchors}`;
}

/** Parse a member reply to a 1–5 Likert value, leniently. Returns null if unclear. */
export function parseLikert(message: string): number | null {
  const digit = message.match(/\b([1-5])\b/);
  if (digit) return Number(digit[1]);
  const m = message.toLowerCase();
  if (/not at all|never|strongly disagree/.test(m)) return 1;
  if (/rarely|a little|disagree/.test(m)) return 2;
  if (/sometimes|somewhat|neutral|mixed/.test(m)) return 3;
  if (/often|mostly|agree/.test(m)) return 4;
  if (/very much|always|completely|definitely|strongly agree/.test(m)) return 5;
  return null;
}

export function idqOpening(): IdqTurn {
  const intro =
    "I'll read 24 short statements — six per area. Rate each from 1 (not at all like me) to 5 (very much like me). " +
    "There are no wrong answers; honest is the goal.\n\n";
  return { reply: intro + frame(0) + presentItem(0), state: INITIAL_IDQ_STATE, complete: false };
}

export function idqRespond(state: IdqConvState, message: string): IdqTurn {
  if (detectCrisis(message).flagged) {
    return { reply: CRISIS_RESPONSE_US, state, complete: false, crisis: true };
  }
  const i = state.responses.length;
  const value = parseLikert(message);
  if (value === null) {
    return { reply: `Just a number from 1 to 5 for this one.\n\n${presentItem(i)}`, state, complete: false };
  }

  const responses = [...state.responses, value];
  const next = responses.length;
  if (next === TOTAL_ITEMS) {
    return {
      reply: "That's all 24. Scoring your baseline now…",
      state: { responses },
      complete: true,
      responses,
    };
  }
  return { reply: frame(next) + presentItem(next), state: { responses }, complete: false };
}

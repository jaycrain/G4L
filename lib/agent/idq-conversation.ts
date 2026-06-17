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

// Voice rewrite v1: each dimension opens with a transition line at its first item; the lab-coat /
// "epidemic" framing is gone and the Fade carries the warmth.
const TRANSITION: Record<(typeof DIMENSIONS)[number], string> = {
  physical: 'Let’s start with the body. It’s keeping score whether or not we choose to look.',
  self: 'Now the harder ground — who you are underneath the roles.',
  social: 'Let’s talk about the people around you.',
  outlook: 'Last stretch — where you’re headed.',
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

const anchors = `(${LIKERT_MIN} = not landing at all … ${LIKERT_MAX} = dead-on)`;

function frame(i: number): string {
  // Transition line at the first item of each dimension.
  return i % ITEMS_PER_DIMENSION === 0 ? `${TRANSITION[dimensionForIndex(i)]}\n\n` : '';
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
    'Alright — before we do anything else together, let’s get a clear picture of where you’re starting from. ' +
    'As honest as you can stand. That’s the whole game today.\n\n' +
    'Here’s how it goes. I’ll put twenty-four things in front of you — about your body, about who you are, about ' +
    'the people around you, and about where you’re headed. For each one, you tell me how true it feels right now: ' +
    '1 if it’s not landing at all, 5 if it’s dead-on.\n\n' +
    'Nothing to study for. No right answers to find. A few of these are going to sting a little — and when one does, ' +
    'that sting is the point. It means we found something real.\n\n' +
    'Think of the whole thing as a mirror. You hold it up, you look, and you see the distance between who you are ' +
    'today and who you know you still are underneath. We’ve got a name for that distance around here: the Fade. ' +
    'Seeing it clearly is how you start closing it.\n\n' +
    'No clock. No score to pass. Go when you’re ready.\n\n';
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
      reply:
        'That’s all twenty-four. Now look back — where did the low numbers cluster?\n\n' +
        'Don’t argue with it. Just see it. That cluster is where the Fade has done its quietest, heaviest work.\n\n' +
        'And it’s not bad news. It’s exactly where we start. That’s your starting line — and the difference between ' +
        'today and most days is that now you can see it.',
      state: { responses },
      complete: true,
      responses,
    };
  }
  return { reply: frame(next) + presentItem(next), state: { responses }, complete: false };
}

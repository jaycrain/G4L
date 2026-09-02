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
// parseLikert COMES FROM THE KERNEL (2026-09-02). This file carried its own, and the two had diverged:
//
//   member types                        kernel   this copy
//   "on a scale of 1 to 5, I'm a 4"       4          1
//   "question 3: a 5"                     5          3
//
// The kernel's strips scale and item references before taking a number (CAT-33); this one took the first digit it
// saw anywhere. Same failure family as withQuestion in reconnect.ts — a fix made once and never carried — except
// that this surface is PARKED for the Cycle 2 retake, so the wrong number would have been recorded the first time
// a member retook the IDQ rather than today. Debt with a fuse on it.
//
// The kernel's takes a `max` (B1's SDT instrument is 1–7); the IDQ is 1–5, which is the default, so every caller
// here is unchanged. [[one-fact-many-sites]]
import { parseLikert } from './onboarding-staged.ts';
export { parseLikert };


export function idqOpening(): IdqTurn {
  const intro =
    'Alright — before we do anything else together, let’s get a clear picture of where you’re starting from — ' +
    'as honest as you can stand. That’s the whole game today.\n\n' +
    'Here’s how it goes. I’ll put twenty-four things in front of you — about your body, about who you are, about ' +
    'the people around you, and about where you’re headed. For each one, you tell me how true it feels right now: ' +
    '1 if it’s not landing at all, 5 if it’s dead-on.\n\n' +
    'Answer from where you actually are today. A few of these are going to sting a little — and when one does, ' +
    'that sting is the point. It means we found something real.\n\n' +
    'Think of the whole thing as a mirror. You hold it up, you look, and you see the distance between who you are ' +
    'today and who you know you still are underneath. We’ve got a name for that distance around here: the Fade. ' +
    'Seeing it clearly is how you start closing it.\n\n' +
    'No clock. Nothing to pass. Go when you’re ready.\n\n';
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
        'That’s all twenty-four. Now look back — where did the low numbers land?\n\n' +
        'Don’t argue with it. Just see it. Those low spots are where the Fade has done its heaviest work.\n\n' +
        'And it’s not bad news. It’s exactly where we start. That’s your starting line — and the difference between ' +
        'today and most days is that now you can see it.',
      state: { responses },
      complete: true,
      responses,
    };
  }
  return { reply: frame(next) + presentItem(next), state: { responses }, complete: false };
}

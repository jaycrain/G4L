// SUBMIT THE BUILDER AND CLEAR THE RECAP — the two turns that used to be one.
//
// Before 2026-08-22 a builder submission handed straight into the Grinta survey, so every test asserted
// `stage === 'grinta'` on the submitting turn. Widget-first puts a recap between them: she gets her list read
// back, and one question about what the reclaimed Identity would be DOING. That question needs a turn to answer.
//
// This exists so the change is ONE edit rather than nine, and so a test that genuinely cares about the recap can
// still drive the turns by hand.

import { applyStagedTurn } from '../../lib/agent/onboarding-staged.ts';
import type { ConvMessage, ConvState, Turn } from '../../lib/agent/onboarding.ts';

/** Submit the list. The returned turn is the RECAP — stage is still `reclaim`. */
export function submitList(state: ConvState, block: string, history: ConvMessage[] = []): Turn {
  return applyStagedTurn(state, history, block, { text: '' });
}

/** Submit, then answer the recap's question. The returned turn is in the Grinta survey. */
export function submitListAndAnswerRecap(
  state: ConvState,
  block: string,
  answer = 'Out on the bike before anyone else is up, most weeks.',
  history: ConvMessage[] = [],
): Turn {
  const recap = submitList(state, block, history);
  return applyStagedTurn(recap.state, history, answer, { text: '' });
}

'use server';

import { getDb } from '../../lib/db/pglite.ts';
import { getProvider } from '../../lib/agent/provider.ts';
import { runOnboarding } from '../../lib/gateway/flow.ts';
import {
  onboardingNextTurn,
  collectedToFields,
  INITIAL_STATE,
  type ConvState,
  type ConvMessage,
  type Ctx,
} from '../../lib/agent/onboarding.ts';
import type { Db } from '../../lib/db/schema.ts';

export type TurnInput = {
  ctx: Ctx;
  state: ConvState | null;
  history: ConvMessage[];
  memberMessage: string | null;
};

export type TurnOutput = {
  reply: string;
  state: ConvState;
  complete: boolean;
  crisis?: boolean;
  memberId?: string;
  errors?: string[];
};

/**
 * One conversational onboarding turn. Runs the Member Agent (live Claude or scripted), and
 * on completion persists the member (reusing the proven runOnboarding path) and returns the
 * memberId so the client can move to the IDQ. State is passed round-trip from the client for
 * this slice; production would persist a conversation session server-side.
 */
export async function onboardingTurn(input: TurnInput): Promise<TurnOutput> {
  const state = input.state ?? INITIAL_STATE;
  const turn = await onboardingNextTurn({
    ctx: input.ctx,
    state,
    history: input.history,
    memberMessage: input.memberMessage,
  });

  if (!turn.complete) {
    return { reply: turn.reply, state: turn.state, complete: false, crisis: turn.crisis };
  }

  const db = (await getDb()) as unknown as Db;
  const res = await runOnboarding(db, getProvider(), collectedToFields(input.ctx, turn.state.collected));
  if (!res.ok) {
    const errors = 'errors' in res ? res.errors : ['Could not save your intake — please try again.'];
    return { reply: turn.reply, state: turn.state, complete: false, errors };
  }
  return { reply: turn.reply, state: turn.state, complete: true, memberId: res.memberId };
}

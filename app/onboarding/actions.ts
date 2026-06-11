'use server';

import { getDb } from '../../lib/db/index.ts';
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
import {
  saveOnboardingSession,
  loadOnboardingSession,
  clearOnboardingSession,
  type OnboardingSession,
} from '../../lib/agent/onboarding-session.ts';
import type { Db } from '../../lib/db/schema.ts';

export type TurnInput = {
  ctx: Ctx;
  state: ConvState | null;
  history: ConvMessage[];
  memberMessage: string | null;
  token: string; // per-device resume token
};

/** Resume an in-flight onboarding for this email+token (or null to start fresh). */
export async function loadOnboardingSessionAction(
  email: string,
  token: string,
): Promise<OnboardingSession | null> {
  if (!email?.trim() || !token) return null;
  try {
    const db = (await getDb()) as unknown as Db;
    return await loadOnboardingSession(db, email.trim(), token);
  } catch {
    return null;
  }
}

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

  const db = (await getDb()) as unknown as Db;
  const email = input.ctx.email?.trim();
  // The full transcript after this turn (so a resume restores exactly what they see).
  const messages: ConvMessage[] =
    input.memberMessage === null
      ? [{ role: 'agent', text: turn.reply }]
      : [...input.history, { role: 'member', text: input.memberMessage }, { role: 'agent', text: turn.reply }];

  // Save progress every turn so a hang / refresh / crash can resume (best-effort — never fail a turn).
  const persist = async () => {
    if (!email || !input.token) return;
    try {
      await saveOnboardingSession(db, email, input.token, turn.state, messages);
    } catch (e) {
      console.warn('onboarding session save failed (non-fatal):', (e as Error).message);
    }
  };

  if (!turn.complete) {
    await persist();
    return { reply: turn.reply, state: turn.state, complete: false, crisis: turn.crisis };
  }

  const res = await runOnboarding(db, getProvider(), collectedToFields(input.ctx, turn.state.collected));
  if (!res.ok) {
    await persist(); // keep their progress so they can retry, not lose it
    const errors = 'errors' in res ? res.errors : ['Could not save your intake — please try again.'];
    return { reply: turn.reply, state: turn.state, complete: false, errors };
  }
  // Done — the member is persisted; the in-flight session can go.
  if (email) {
    try {
      await clearOnboardingSession(db, email);
    } catch {
      /* non-fatal */
    }
  }
  return { reply: turn.reply, state: turn.state, complete: true, memberId: res.memberId };
}

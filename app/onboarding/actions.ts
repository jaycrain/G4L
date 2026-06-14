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
import { curateKeepersFromOnboarding } from '../../lib/agent/onboarding-harvest.ts';
import { proposeEntry } from '../../lib/playbook/store.ts';
import { addFacet } from '../../lib/curriculum/store.ts';
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
};

/**
 * One conversational onboarding turn. Runs the Member Agent (live Claude or scripted) and saves the
 * in-flight session every turn so a hang / refresh / crash can resume.
 *
 * IMPORTANT: reaching `complete: true` does NOT create the member. Completion is a *ready* state —
 * the conversation has everything it needs and offers the IDQ handoff — but the member is only
 * committed when they explicitly proceed (see `finalizeOnboardingAction`). This keeps the handoff
 * reversible: a member can say "I'm not finished" and keep talking (e.g. add another Door) with
 * nothing to undo, and the session survives a reload right up until they commit.
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

  // Save progress every turn — including the completed/ready turn — so a refresh resumes exactly
  // where they are, handoff and all. Best-effort; never fail a turn over a save.
  if (email && input.token) {
    try {
      await saveOnboardingSession(db, email, input.token, turn.state, messages);
    } catch (e) {
      console.warn('onboarding session save failed (non-fatal):', (e as Error).message);
    }
  }

  return { reply: turn.reply, state: turn.state, complete: turn.complete, crisis: turn.crisis };
}

export type FinalizeInput = { ctx: Ctx; state: ConvState; token: string };
export type FinalizeOutput =
  | { ok: true; memberId: string }
  | { ok: false; crisis: true; message: string }
  | { ok: false; crisis?: false; errors: string[] };

/**
 * Commit the conversation: persist the member (the proven runOnboarding path) and clear the
 * in-flight session. Called only when the member explicitly proceeds to the IDQ — never on
 * reaching the ready state. If it fails, the session is kept so nothing is lost.
 */
export async function finalizeOnboardingAction(input: FinalizeInput): Promise<FinalizeOutput> {
  const db = (await getDb()) as unknown as Db;
  const res = await runOnboarding(db, getProvider(), collectedToFields(input.ctx, input.state.collected));
  if (!res.ok) {
    if ('crisis' in res && res.crisis) return { ok: false, crisis: true, message: res.message };
    const errors = 'errors' in res ? res.errors : ['Could not save your intake — please try again.'];
    return { ok: false, errors };
  }
  // Seed the named identity as the member's first facet (the identity strip). A member who chose
  // "not sure yet" has no identityNoun — their first facet comes from Identity Excavation instead.
  const namedIdentity = input.state.collected.identityNoun?.trim();
  if (namedIdentity) {
    try {
      await addFacet(db, res.memberId, `the ${namedIdentity}`);
    } catch {
      /* non-fatal — the strip falls back to its prompt */
    }
  }

  const email = input.ctx.email?.trim();
  // Harvest the onboarding transcript into the Playbook's first pages — BEFORE we clear the session
  // (it's the only place the real conversation lives). Best-effort: a harvest hiccup never fails the
  // commit. Proposals only — the member resolves them on the Playbook / sees them at the Threshold.
  if (email && input.token) {
    try {
      const session = await loadOnboardingSession(db, email, input.token);
      if (session?.messages?.length) {
        const keepers = await curateKeepersFromOnboarding(input.state.collected.identityNoun ?? null, session.messages);
        for (const k of keepers) {
          await proposeEntry(db, res.memberId, { section: k.section, body: k.body, source: { kind: 'checkpoint', label: k.sourceLabel } });
        }
      }
    } catch (e) {
      console.warn('onboarding harvest failed (non-fatal):', (e as Error).message);
    }
  }
  if (email) {
    try {
      await clearOnboardingSession(db, email);
    } catch {
      /* non-fatal */
    }
  }
  return { ok: true, memberId: res.memberId };
}

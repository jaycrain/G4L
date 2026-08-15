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
  type Expectation,
} from '../../lib/agent/onboarding.ts';
import {
  saveOnboardingSession,
  loadOnboardingSession,
  clearOnboardingSession,
  type OnboardingSession,
} from '../../lib/agent/onboarding-session.ts';
import { curateKeepersFromOnboarding } from '../../lib/agent/onboarding-harvest.ts';
import { persistGrintaReading, baselineResponsesMap } from '../../lib/grinta/survey/store.ts';
import { buildSummaryCard } from '../../lib/agent/onboarding-contract.ts';
import { logEvent } from '../../lib/telemetry/store.ts';
import { proposeEntry, addOwnEntry } from '../../lib/playbook/store.ts';
import { addFacet } from '../../lib/curriculum/store.ts';
import { consolidateReclaim } from '../../lib/member/reclaim.ts';
import { escalateProspectCrisis } from '../../lib/agent/crisis-escalation.ts';
import { createCredential, hasCredential } from '../../lib/auth/store.ts';
import { sendVerificationEmail } from '../../lib/auth/verify-email.ts';
import { hashPassword } from '../../lib/auth/password.ts';
import { startSession } from '../auth.ts';
import { stagedEngineEnabled } from '../../lib/agent/onboarding-staged.ts';
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
  // Both are REQUIRED. A blank token used to "recover by email", which let anyone holding an email address read a
  // stranger's in-flight onboarding and take over the account. Fail closed. (2026-07-30)
  if (!email?.trim() || !token?.trim()) return null;
  try {
    const db = (await getDb()) as unknown as Db;
    return await loadOnboardingSession(db, email.trim(), token.trim());
  } catch {
    return null;
  }
}

export type TurnOutput = {
  reply: string;
  state: ConvState;
  complete: boolean;
  // W-24: set when the turn just delivered an administered item (the Grinta baseline at the end of onboarding) — the
  // client renders the scale chips instead of the free-text box. Absent on every draw-out turn.
  expects?: Expectation;
  crisis?: boolean;
  // Set when the fade gate gracefully declines a genuinely-thriving no-fade member (Decision E). Terminal:
  // the client shows the decline screen — no card, no member created. Only fires under the staged engine.
  declined?: boolean;
  // Set when the live AI turn failed on our side (usage cap, key, outage) rather than the member's
  // input. The client shows `outageMessage` and leaves their draft + state intact to resend. Thrown
  // errors are masked by Next in prod, so we surface this as a returned value, not an exception.
  outage?: boolean;
  outageMessage?: string;
};

const OUTAGE_MESSAGE =
  'We’re having a brief technical hiccup on our end — your progress is saved. Give it a minute and send again.';

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
  let turn;
  try {
    turn = await onboardingNextTurn({
      ctx: input.ctx,
      state,
      history: input.history,
      memberMessage: input.memberMessage,
    });
  } catch {
    // A live-turn failure is always our side (the API call, not the member's words). Return a soft
    // outage so the client shows a calm message and keeps their draft + state to resend — no member
    // is created here, nothing is lost. The cron + /admin badge tell the operator what actually broke.
    return { reply: '', state, complete: false, outage: true, outageMessage: OUTAGE_MESSAGE };
  }

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

  // ESCALATE TO A HUMAN — the half of the crisis rule this surface never had (2026-08-15).
  //
  // The engine already returned the 988 response; that half has always worked. What never happened is anyone
  // being told. escalateCrisis takes a member_id and there is no member here, so onboarding was skipped when the
  // other five surfaces were wired — and the guard test that exists to catch exactly that missed it, because it
  // enumerated by function name and this export is `onboardingTurn`, not `onboardingTurnAction`.
  //
  // AFTER the save, deliberately: the escalation flags the session row, so the row has to exist first. Awaited
  // rather than fired-and-forgotten — a serverless function can be frozen the moment the response is returned,
  // and a dropped crisis alert is the one thing here worth a few hundred milliseconds.
  if (turn.crisis && email) {
    try {
      await escalateProspectCrisis(db, email, { message: input.memberMessage ?? '' });
    } catch (e) {
      // Never let alerting cost them the reply that carries the 988 number.
      console.error('PROSPECT CRISIS ESCALATION THREW — they still got the 988 response:', (e as Error).message);
    }
  }

  return { reply: turn.reply, state: turn.state, complete: turn.complete, expects: turn.expects, crisis: turn.crisis, declined: turn.declined };
}

export type FinalizeInput = { ctx: Ctx; state: ConvState; token: string; cardReturns?: number; password: string };
export type FinalizeOutput =
  | { ok: true; memberId: string; next: string }
  | { ok: false; crisis: true; message: string }
  | { ok: false; code: 'exists'; error: string }
  | { ok: false; crisis?: false; errors: string[] };

/**
 * Commit the conversation: persist the member (the proven runOnboarding path) and clear the
 * in-flight session. Called only when the member explicitly proceeds to the IDQ — never on
 * reaching the ready state. If it fails, the session is kept so nothing is lost.
 */
export async function finalizeOnboardingAction(input: FinalizeInput): Promise<FinalizeOutput> {
  const db = (await getDb()) as unknown as Db;
  if (!input.password || input.password.length < 8) return { ok: false, errors: ['Please choose a password of at least 8 characters.'] };
  // Consolidate the Reclaim List before it's committed — the dashboard reads what we persist here, so a sloppy or
  // resumed-from-before-cleanup list is cleaned once, at the commit, not just on the card. Consolidate the ITEMS AND
  // their categories in LOCKSTEP (consolidateReclaim), so a dropped/merged item can't leave the category array
  // mis-indexed — otherwise a kept item inherits a neighbour's category, which drives its coaching path.
  const consolidated = consolidateReclaim(input.state.collected.reclaimList ?? [], input.state.collected.reclaimCategories ?? []);
  const collected = { ...input.state.collected, reclaimList: consolidated.items, reclaimCategories: consolidated.categories };
  const res = await runOnboarding(db, getProvider(), collectedToFields(input.ctx, collected));
  if (!res.ok) {
    if ('crisis' in res && res.crisis) return { ok: false, crisis: true, message: res.message };
    // A taken email is NOT a dead end at the finish line (Jay's walk: "we'll lose prospective members"). It means
    // they already have an account — hand it to the login-routing path (chat.tsx clears the draft + sends to /login),
    // the same recovery the credential-collision below uses, instead of a red error with no way forward.
    if ('code' in res && res.code === 'exists') return { ok: false, code: 'exists', error: 'That email already has an account — please log in.' };
    const errors = 'errors' in res ? res.errors : ['Could not save your intake — please try again.'];
    return { ok: false, errors };
  }
  // THE CREDENTIAL COMES FIRST — IMMEDIATELY AFTER THE MEMBER ROW (moved 2026-08-15).
  //
  // Decision Z: the account is created here, at the commit, from the password collected upfront at the gate, so
  // the card hands straight to the Ceremony with no /account/setup interruption.
  //
  // What changed is the ORDER, and it is the whole fix. This used to run after the Grinta write; a member row
  // and its credential were four steps apart, and anything that died in between left a person with an account
  // they could never enter — signup saying "you already have an account", login saying "email or password is
  // incorrect", and no way to use either. That happened to a real tester today.
  //
  // A member row without a credential is the single worst state this product can produce: it is unrecoverable
  // BY THE MEMBER. Everything else here (Grinta, keepers, telemetry) is data we could backfill or live without.
  // So nothing optional gets to run between those two writes, ever.
  if (await hasCredential(db, res.memberId)) {
    return { ok: false, code: 'exists', error: 'That email already has an account — please log in.' };
  }
  await createCredential(db, res.memberId, input.ctx.email.trim(), await hashPassword(input.password));

  // Now the optional work. Persist the GRINTA baseline (staged flow only — set on collected.grintaBaseline by the
  // survey stage). Best-effort: the member and their credential both exist by this point, so they can always get
  // back in even if this fails — which is exactly why it belongs below the credential and not above it.
  const g = collected.grintaBaseline;
  const gResponses = input.state.administeredResponses;
  if (g && gResponses?.length) {
    try {
      await persistGrintaReading(db, res.memberId, {
        source: 'onboarding',
        responses: baselineResponsesMap(gResponses),
        score: g,
      });
    } catch (e) {
      console.warn('onboarding grinta baseline write failed — non-fatal:', (e as Error).message);
    }
  }
  // SEC-08: send the proof-of-control link. NOT a gate — they go straight to the Ceremony either way; this just
  // means a member who later forgets their password has a way back to their own story. Never fails the signup.
  void sendVerificationEmail(input.ctx.email, res.memberId);
  await startSession(res.memberId);
  const next = stagedEngineEnabled() ? `/dashboard/${res.memberId}` : `/idq?member=${res.memberId}`;
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

  // Decision II: whole-life VISION statements the member moved OUT of the Reclaim List (member-confirmed) are
  // preserved to the Playbook in their own words — the Window/Legacy work reads from here — never discarded.
  for (const vision of input.state.collected.visionKeepers ?? []) {
    try {
      await addOwnEntry(db, res.memberId, vision, 'own_words');
    } catch (e) {
      console.warn('vision keeper write failed (non-fatal):', (e as Error).message);
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
          await proposeEntry(db, res.memberId, { section: k.section, body: k.body, keeperType: k.keeperType ?? null, source: { kind: 'checkpoint', label: k.sourceLabel } });
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
  // Save the confirmation card the member saw + how many times they corrected it before confirming
  // ("keep talking" returns). Immutable snapshot in the event meta — surfaced on /admin/member, and
  // the return counts roll up into the "keep talking" rate (the capture-quality health metric).
  try {
    const card = buildSummaryCard(input.state.collected);
    await logEvent(db, res.memberId, 'onboarding_confirmed', {
      surface: 'onboarding',
      step: input.cardReturns ?? 0,
      meta: { cardReturns: input.cardReturns ?? 0, card },
    });
  } catch {
    /* telemetry is best-effort — never fail the commit over it */
  }
  return { ok: true, memberId: res.memberId, next };
}

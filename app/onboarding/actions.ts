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
import { DOORS, isDoorSlug, type DoorSlug } from '../../lib/doors.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';

const doorDisplay = (slug: DoorSlug) => DOORS.find((d) => d.slug === slug)?.displayName ?? slug;

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
  const email = input.ctx.email?.trim();
  if (email) {
    try {
      await clearOnboardingSession(db, email);
    } catch {
      /* non-fatal */
    }
  }
  return { ok: true, memberId: res.memberId };
}

// --- Revisit your Door(s) ---------------------------------------------------------------
// A logged-in member can return to the Door beat to refine or add Door(s) — the gap usually
// opens through more than one, and people surface the others later. This reuses the onboarding
// Door beat (seeded with what we already know), but it NEVER re-runs onboarding or creates a
// member: saving is purely additive to member_door. The Member Agent already reads member_door,
// so any Door added here is immediately known to the agent (standing reconciliation rule).

export type DoorsSeed = { state: ConvState; opening: string } | null;

/** Load an existing member's identity + Door(s) and seed a Door-beat conversation. */
export async function seedDoorsAction(memberId: string): Promise<DoorsSeed> {
  if (!(await authorizeMember(memberId))) return null;
  const db = (await getDb()) as unknown as Db;
  const m = (
    await db.query<any>(
      'select display_name, identity_noun, intake_athletic_past, intake_gap, reclaim_list from member_profile where member_id=$1',
      [memberId],
    )
  ).rows[0];
  if (!m) return null;

  const doorRows = (
    await db.query<any>('select door_slug from member_door where member_id=$1 order by sort_order, is_primary desc', [memberId])
  ).rows;
  const doors = doorRows.map((r: any) => r.door_slug).filter(isDoorSlug) as DoorSlug[];

  const riRows = (
    await db.query<{ text: string }>('select text from reclaim_item where member_id=$1 order by sort_order, created_at', [memberId])
  ).rows;
  const reclaimList = riRows.length ? riRows.map((r) => r.text) : Array.isArray(m.reclaim_list) ? (m.reclaim_list as string[]) : [];

  const state: ConvState = {
    stage: 'door',
    collected: {
      athleticPast: m.intake_athletic_past || 'what you shared before',
      identityNoun: m.identity_noun || undefined,
      reclaimList,
      gap: m.intake_gap || undefined,
      doors,
    },
    doorTurns: 0,
  };

  const named =
    doors.length === 0
      ? 'the door that opened'
      : doors.length === 1
        ? doors.map(doorDisplay)[0]
        : `${doors.slice(0, -1).map(doorDisplay).join(', ')} and ${doorDisplay(doors[doors.length - 1]!)}`;
  const opening =
    `Let's go back to how the gap opened — I want to make sure we have the whole picture. ` +
    `So far we've named ${named}. The Fade rarely opens through just one thing. ` +
    `What else was going on around that time — what else quietly pulled you off course?`;

  return { state, opening };
}

export type DoorsTurnOutput = TurnOutput | { error: string };

/** One Door-beat turn for an existing member. Does not persist anything. */
export async function doorsTurnAction(input: {
  memberId: string;
  state: ConvState;
  history: ConvMessage[];
  memberMessage: string;
}): Promise<DoorsTurnOutput> {
  if (!(await authorizeMember(input.memberId))) return { error: 'Not authorized.' };
  const turn = await onboardingNextTurn({
    ctx: { name: '', email: '' },
    state: input.state,
    history: input.history,
    memberMessage: input.memberMessage,
  });
  return { reply: turn.reply, state: turn.state, complete: turn.complete, crisis: turn.crisis };
}

/** Persist the refined Door set — additive (existing Doors kept; new ones added). */
export async function saveDoorsAction(memberId: string, state: ConvState): Promise<{ ok: boolean; error?: string }> {
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  const doors = (state.collected.doors ?? []).filter(isDoorSlug);
  if (doors.length === 0) return { ok: false, error: 'No Door to save yet.' };
  const db = (await getDb()) as unknown as Db;
  for (let i = 0; i < doors.length; i++) {
    await db.query(
      `insert into member_door (member_id, door_slug, is_primary, sort_order)
       values ($1,$2,$3,$4)
       on conflict (member_id, door_slug) do update set is_primary = excluded.is_primary, sort_order = excluded.sort_order`,
      [memberId, doors[i], i === 0, i],
    );
  }
  // Keep named_door (primary, used by single-value reads) and the gap narrative in sync.
  await db.query('update member_profile set named_door=$2 where member_id=$1', [memberId, doors[0]]);
  if (state.collected.gap) {
    await db.query('update member_profile set intake_gap=$2 where member_id=$1', [memberId, state.collected.gap]);
  }
  return { ok: true };
}

'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';
import type { ConvMessage, ConvState, Turn } from '../../lib/agent/onboarding.ts';
import { applyReconnectTurn, liveTurnReconnect, loadReconnectCaptures, reconnectEnabled, reconnectOpening } from '../../lib/agent/reconnect.ts';
import { softSetMemberDoors } from '../../lib/member/refine.ts';
import { emitHarvestMoment } from '../../lib/agent/harvest.ts';
import { DOORS } from '../../lib/doors.ts';

// v2.2 Reconnect server actions. Flag-gated. The callback (entry) READS committed captures and opens; the DOORS
// excavation (§2b) is a live model turn (draw-out + insight + the re-seeing revision). Conversation state is
// client-held; a COMMITTED revision, though, persists to the DB (below).

// §2b revision persistence: when a turn COMMITTED a door re-seeing, sync it to the 0043 substrate — the door set via
// soft-delete (softSetMemberDoors, never destroys the old), and the re-seeing TELL via the existing member_event /
// emitHarvestMoment seam (R5: from→to in meta). Best-effort — a persistence failure must never break the turn (the
// client state still carries the swap; the record catches up next turn).
async function persistRevision(db: Db, memberId: string, prev: ConvState, turn: Turn): Promise<void> {
  try {
    const before = prev.collected.doors ?? [];
    const after = turn.state.collected.doors ?? [];
    if (after.length && JSON.stringify(before) !== JSON.stringify(after)) {
      await softSetMemberDoors(db, memberId, after); // covers a flat mislabel too (door changed, no tell)
    }
    const priorTells = prev.reseeingTells?.length ?? 0;
    for (const t of (turn.state.reseeingTells ?? []).slice(priorTells)) {
      const name = (s: string) => DOORS.find((d) => d.slug === s)?.displayName ?? s;
      // A correct carries from→to (a re-seeing pair); a widen/name carries just the surfaced Door.
      const desc = t.fromSlug ? `${name(t.fromSlug)} → ${name(t.toSlug)}` : `+ ${name(t.toSlug)}`;
      await emitHarvestMoment(db, memberId, {
        destinationIntent: 'keeper',
        keeperType: 'tell',
        surface: 'reconnect',
        sourceRef: { kind: 'reconnect', ref: 'doors', label: `Re-seeing · ${desc}` },
        payloadRef: desc,
        pair: t.fromSlug ? { fromSlug: t.fromSlug, toSlug: t.toSlug } : { toSlug: t.toSlug },
      });
    }
  } catch {
    // swallow — persistence is best-effort; the turn already succeeded for the member.
  }
}

export async function startReconnectAction(memberId: string): Promise<{ ok: boolean; reply?: string; state?: ConvState; error?: string }> {
  if (!reconnectEnabled()) return { ok: false, error: 'Reconnect is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  const db = (await getDb()) as unknown as Db;
  const committed = await loadReconnectCaptures(db, memberId);
  if (!committed) return { ok: false, error: 'We could not find your intake.' };
  const turn = reconnectOpening(committed);
  return { ok: true, reply: turn.reply, state: turn.state };
}

export async function reconnectTurnAction(
  memberId: string,
  state: ConvState,
  history: ConvMessage[],
  message: string,
): Promise<{ ok: boolean; reply?: string; state?: ConvState; error?: string }> {
  if (!reconnectEnabled()) return { ok: false, error: 'Reconnect is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    // The entry (callback) stage is deterministic — it acknowledges and advances to Doors, no model needed. From
    // Doors on, it's a live model turn (draw-out + the insight reflect + the re-seeing revision).
    const turn =
      state.stage === 'entry'
        ? applyReconnectTurn(state, history, message, { text: '' })
        : await liveTurnReconnect(state, history, message);
    // A committed re-seeing this turn persists to the DB (soft-delete substrate + the tell). Best-effort.
    const db = (await getDb()) as unknown as Db;
    await persistRevision(db, memberId, state, turn);
    return { ok: true, reply: turn.reply, state: turn.state };
  } catch {
    return { ok: false, error: 'Something went wrong — please try again.' };
  }
}

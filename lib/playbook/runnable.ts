// "Run it again" — resolve a play to the Session that forged it, so the COMPANION can re-run it
// conversationally (Playbook redesign, Phase 2, Option A). This NEVER resets a gate or touches the Program
// flow — it only tells the Companion which Session to walk the member back through.
//
// Which Session forges which play is a stable product fact (the False Start Protocol IS Session w3), so we
// declare it in ONE place, keyed on the play's forge label — the code constant the arc harvest stamps onto
// source_label (see lib/agent/rewire.ts). A durable source.ref (a real Session id) is PREFERRED when a keeper
// carries one, so this map quietly retires itself as capture improves. This same tag is the groundwork for the
// future "custom cycles" the Companion could assemble (Greg + Jay, discussed, not yet designed) — keep it as
// reusable Session metadata, not a one-off.

import { sessionById } from '../workspace/session-registry.ts';

// forge label (from the arc harvest) → the Session id that produced the play. Extend as more plays are confirmed.
const PLAY_SOURCE: Record<string, string> = {
  'Your False Start Protocol': 'w3', // Rewire W3 — the recovery_move play
  'Your true line for a bad day': 'w3', // Rewire W3 — the principle forged alongside the protocol
};

export type RunnablePlay = { sessionId: string; sessionLabel: string; ask: string };

type SourceLike = { source?: { kind?: string; ref?: string; label?: string } | null } | null | undefined;

/** Resolve a play → its Session, or null if we can't (graceful: no button). Prefers a real captured Session
 *  ref; falls back to the declared forge-label map. */
export function runnablePlay(entry: SourceLike): RunnablePlay | null {
  const ref = entry?.source?.ref ?? undefined;
  const label = entry?.source?.label ?? undefined;
  const sessionId = (ref && sessionById(ref) ? ref : undefined) ?? (label ? PLAY_SOURCE[label] : undefined);
  if (!sessionId) return null;
  const def = sessionById(sessionId);
  if (!def) return null;
  return { sessionId, sessionLabel: def.label, ask: rerunAsk(sessionId)! };
}

/** The member-voiced opening the Companion re-run is seeded with, from a Session id. Null if unknown. */
export function rerunAsk(sessionId: string): string | null {
  const def = sessionById(sessionId);
  return def ? `Can we go back through my ${def.label} together?` : null;
}

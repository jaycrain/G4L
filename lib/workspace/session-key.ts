import { CURRICULUM } from '../curriculum/registry.ts';
// Redesign Layer 3 — the WORKSPACE session key: the stable url token for a session running in the workspace shell, and
// the crosswalk from the member's lit next step (the forecast) to that token, plus which chat client drives it. Pure +
// testable. The keys ARE the session-registry ids, so the registry (label, phase, segments) resolves straight off them.

export const SESSION_KEYS = [
  'reconnect',
  'w1', 'w2', 'w3', 'rewire-checkpoint',
  'b1', 'b2', 'b3', 'b4',
  'c1', 'c2', 'c3', 'c4',
] as const;
export type SessionKey = (typeof SESSION_KEYS)[number];

export function isSessionKey(x: string): x is SessionKey {
  return (SESSION_KEYS as readonly string[]).includes(x);
}

export type ChatArc = 'reconnect' | 'rewire' | 'rebuild' | 'reclaim';
export type ChatSession = 'w1' | 'w2' | 'w3' | 'b1' | 'b2' | 'b3' | 'c1' | 'c2' | 'c3' | 'checkpoint';

// Which chat client (arc) + which session prop drives a given workspace key. Reconnect is one continuous arc (no prop);
// the phase checkpoints all map to the client's 'checkpoint' session.
export function chatDispatch(key: SessionKey): { arc: ChatArc; session?: ChatSession } {
  if (key === 'reconnect') return { arc: 'reconnect' };
  if (key === 'rewire-checkpoint') return { arc: 'rewire', session: 'checkpoint' };
  if (key === 'b4') return { arc: 'rebuild', session: 'checkpoint' };
  if (key === 'c4') return { arc: 'reclaim', session: 'checkpoint' };
  if (key[0] === 'w') return { arc: 'rewire', session: key as ChatSession };
  if (key[0] === 'b') return { arc: 'rebuild', session: key as ChatSession };
  return { arc: 'reclaim', session: key as ChatSession };
}

// The member's lit step → its workspace key, or null when it can't be confidently mapped (caller falls back to the
// legacy route so a walk never dead-ends). Reconnect is the whole gateway arc; the other phases carry the session token
// in the forecast's route (e.g. /rewire/{memberId}/w1) or id.
export function keyFromForecast(
  phase: string,
  current: { id?: string; route?: string; kind?: string } | null,
): SessionKey | null {
  if (phase === 'reconnect') return 'reconnect';
  const src = `${current?.route ?? ''} ${current?.id ?? ''}`;
  const m = src.match(/\b(w[123]|b[123]|c[123]|checkpoint)\b/);
  const tok = m?.[1];
  if (!tok) return null;
  if (tok === 'checkpoint') {
    return phase === 'rewire' ? 'rewire-checkpoint' : phase === 'rebuild' ? 'b4' : phase === 'reclaim' ? 'c4' : null;
  }
  return isSessionKey(tok) ? tok : null;
}

/**
 * The CURRICULUM asset id for a workspace session key ('w1' → 'RWR-W1'), derived from the route the curriculum
 * already declares rather than hand-mapped.
 *
 * Two id spaces exist: the workspace routes on 'w1'/'b3'/'c2', and session closure records 'RWR-W1'/'RBLD-B3'.
 * Each arc action already carries its own private map of the two (`session === 'w1' ? 'RWR-W1' : …`), and adding a
 * third copy is how the pair drifts. The curriculum's own `route: '/rewire/{memberId}/w1'` ends in exactly the
 * workspace key, so the crosswalk is a fact already in the data.
 *
 * Returns undefined for a key with no curriculum asset — Reconnect is one continuous arc rather than a closable
 * session, and a caller must treat "no id" as "not closable", never as "not closed".
 */
export function curriculumIdFor(key: SessionKey): string | undefined {
  const { arc } = chatDispatch(key);
  // The route's LAST SEGMENT, which is the key itself except for the Rewire checkpoint — keyed
  // 'rewire-checkpoint' here and routed '/rewire/{memberId}/checkpoint'. Matching the arc as well as the segment
  // keeps 'checkpoint' from resolving to Rebuild's or Reclaim's.
  const last = key.includes('-') ? key.slice(key.lastIndexOf('-') + 1) : key;
  for (const a of CURRICULUM) {
    const r = (a as { route?: string }).route;
    if (!r || !r.startsWith(`/${arc}/`)) continue;
    if (r.endsWith(`/${last}`)) return a.id;
  }
  return undefined;
}

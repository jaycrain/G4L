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

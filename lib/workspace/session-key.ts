import { CURRICULUM } from '../curriculum/registry.ts';
// Redesign Layer 3 — the WORKSPACE session key: the stable url token for a session running in the workspace shell, and
// the crosswalk from the member's lit next step (the forecast) to that token, plus which chat client drives it. Pure +
// testable. The keys ARE the session-registry ids, so the registry (label, phase, segments) resolves straight off them.

export const SESSION_KEYS = [
  // RECONNECT IS THREE SESSIONS AND A CHECKPOINT (2026-08-28), like every other phase. It was a single
  // 'reconnect' key for one 65-minute arc — the reason it had no boundaries anywhere, and the reason the
  // workspace, the Program page and the forecast all had a Reconnect special case. r1 is the IDQ and comes
  // FIRST, per Greg's spec ("the first assessment"; R2 "works well after the Identity Distance Questionnaire").
  'r1', 'r2', 'r3', 'r4',
  'w1', 'w2', 'w3', 'rewire-checkpoint',
  'b1', 'b2', 'b3', 'b4',
  'c1', 'c2', 'c3', 'c4',
] as const;
export type SessionKey = (typeof SESSION_KEYS)[number];

export function isSessionKey(x: string): x is SessionKey {
  return (SESSION_KEYS as readonly string[]).includes(x);
}

export type ChatArc = 'reconnect' | 'rewire' | 'rebuild' | 'reclaim';
export type ChatSession = 'r1' | 'r2' | 'r3' | 'w1' | 'w2' | 'w3' | 'b1' | 'b2' | 'b3' | 'c1' | 'c2' | 'c3' | 'checkpoint';

// Which chat client (arc) + which session prop drives a given workspace key. Reconnect is one continuous arc (no prop);
// the phase checkpoints all map to the client's 'checkpoint' session.
export function chatDispatch(key: SessionKey): { arc: ChatArc; session?: ChatSession } {
  // EXPLICIT, NOT A PREFIX TEST. `key[0] === 'r'` also matches 'rewire-checkpoint', which routed Rewire's
  // checkpoint into the Reconnect arc and made the line below it dead code. The other phases can use a prefix
  // because no other key starts with w/b/c; Reconnect cannot, because 'rewire-*' shares its letter.
  if (key === 'r4') return { arc: 'reconnect', session: 'checkpoint' };
  if (key === 'r1' || key === 'r2' || key === 'r3') return { arc: 'reconnect', session: key };
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
  if (phase === 'reconnect') {
    // Which Reconnect Session is lit. The forecast carries the asset id or route; fall back to r1, which is the
    // phase's first Session — a member with no signal has not started, and r1 is where starting means.
    const id = (current?.id ?? '').toUpperCase();
    const route = current?.route ?? '';
    if (id.includes('CHK') || route.endsWith('/r4') || id.includes('R4')) return 'r4';
    if (id.includes('DFT') || id.includes('WIN') || route.endsWith('/r3')) return 'r3';
    if (id.includes('FDR') || route.endsWith('/r2')) return 'r2';
    return 'r1';
  }
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
/**
 * RECONNECT'S SESSIONS AND THEIR ASSETS. Not derivable from a route the way the other arcs are: only R1 is
 * route-backed in the curriculum (the Mirror), while the Doors and the Drift Quiz are step-authored assets with
 * no route to read the key off. So the crosswalk is stated once, here, and imported by everything that needs it.
 */
export const RECONNECT_SESSION_ASSETS: Record<string, string[]> = {
  r1: ['RCN-IDQ'],
  // A SESSION COVERS MORE THAN ONE CURRICULUM ROW. Reconnect has seven rows and three Sessions, because the rows
  // are Greg's ASSETS and the Sessions are what a member sits down to do. The Doors work is both "The Doors"
  // (RCN-FDR) and "Identity Excavation" (RCN-EXC) — one conversation, two authored assets.
  //
  // Closing only one of them is what left Jay stuck: R2 marked RCN-EXC done, RCN-FDR stayed open, and the
  // forecast lit the next OPEN row — "Nice work — The Doors is next", pointing him back into the Session he had
  // just finished, directly under a line saying he had finished it. R3 would have done the same across three.
  r2: ['RCN-FDR', 'RCN-EXC'],
  r3: ['RCN-DFT', 'RCN-WIN', 'RCN-WIN-LIST'],
  r4: ['RCN-CHK'],
  checkpoint: ['RCN-CHK'],
};

export function curriculumIdFor(key: SessionKey): string | undefined {
  const { arc } = chatDispatch(key);
  // RECONNECT RESOLVES FROM THE MAP ABOVE, and until 2026-08-28 it resolved to nothing at all. The docstring
  // below said so on purpose — "Reconnect is one continuous arc rather than a closable session" — which was true
  // of the single 65-minute conversation and false the moment it became three Sessions.
  //
  // What that cost: the workspace decides whether to open a Session read-only by asking for its asset id, and a
  // Reconnect key answered `undefined`, so the entire closed-session check was skipped. A member who had
  // finished the Mirror could re-enter it and take the 24-item instrument again — which is exactly what happened
  // to Jay, four times, writing three spurious retakes against a 60-day measurement. (Jay: "Aren't the Sessions
  // linear, once you're through you can't get back to it?" They are. This is what stopped them being.)
  // The FIRST row is the Session's own identity — the one the forecast and the read-only check look up.
  if (arc === 'reconnect') return RECONNECT_SESSION_ASSETS[key]?.[0];
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

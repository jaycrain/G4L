// NEVER PROPOSE THE SAME THING TWICE.
//
// Every coach stage has the same shape: coach until an artifact is captured, PROPOSE it, then commit on the
// member's confirm. The bug they all shared is in what happens when the reply ISN'T a confirm:
//
//     if (sc.proposed) { ...not a confirm... sc.proposed = false; reply = "tell me what you'd change"; return; }
//     if (ready)       { sc.proposed = true;  reply = propose(artifact); return; }
//
// `ready` is computed from the artifact, and a non-confirm doesn't change the artifact — so the very next turn
// re-proposes it, verbatim. The member gets proposal · "what would you change?" · the same proposal · forever.
// The engine's no-verbatim-repeat guard cannot see it, because the two lines ALTERNATE and it only catches an
// exact consecutive duplicate.
//
// Seen three times from three directions before it was understood:
//   · Greg, B3 (2026-08-06) — asked "How will I track it?" and got the whole plan block back, verbatim.
//   · Dana, C1 (a live walk) — "the duplicate keeps coming back no matter what we agree on."
//   · Jay, C3 (2026-08-06) — 25 messages deep, artifact captured and unchanged the whole way.
//
// The fix: remember WHAT was proposed, not just THAT something was. Re-propose only when the artifact has
// actually changed. When it hasn't, keep the confirm gate open — so a later "yes, save it" still commits — and
// let the model carry the turn instead of the engine repeating itself. That also gives a member room to ask a
// question at the gate, which is what Greg was doing.

/** Per-stage scratch for a propose→confirm coach gate. */
export type CoachGate = { proposed?: boolean; proposedSig?: string };

/** A stable fingerprint of the artifact as PROPOSED. Key order is normalised so a re-record that changes
 *  nothing the member can see doesn't read as a change and re-trigger the proposal. */
export function proposalSignature(artifact: unknown): string {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, norm(x)]));
    }
    return typeof v === 'string' ? v.trim() : v;
  };
  return JSON.stringify(norm(artifact));
}

/**
 * Should the engine put the proposal on screen this turn?
 *
 * True only when the artifact is ready AND differs from whatever was last proposed. A member who says
 * something that isn't a confirm — a tweak the model hasn't recorded yet, a question, a pause — gets the
 * conversation, not the same block again.
 */
export function shouldPropose(gate: CoachGate, ready: boolean, signature: string): boolean {
  return ready && gate.proposedSig !== signature;
}

/** Record that this exact artifact has now been put to the member, and open the confirm gate. */
export function markProposed(gate: CoachGate, signature: string): void {
  gate.proposed = true;
  gate.proposedSig = signature;
}

// ORDER MATTERS, and getting it wrong costs the fix.
//
// The change check must run BEFORE the confirm check, and the gate must NOT close on a non-confirm:
//
//     const sig = proposalSignature(artifact);
//     if (shouldPropose(gate, ready, sig)) { markProposed(gate, sig); reply = propose(); return; }
//     if (gate.proposed) {
//       if (confirms(msg)) { ...commit... }
//       reply = modelText || REVISE_NUDGE;   // ← gate STAYS open
//       return;
//     }
//
// My first cut put the hold branch below `if (gate.proposed)`, where it was unreachable on the very turn that
// mattered — the member asks a question, the gate slams shut, and their next "lock them in" is read as coaching
// rather than a yes. They have to say it twice. It also meant a genuinely CHANGED artifact could not re-propose
// while the gate was open, which trades a repeat loop for a silent drop — much worse.
//
// So: once proposed, the gate stays open until either a confirm commits or a changed artifact replaces it.
// There is no "close the gate" operation, deliberately.

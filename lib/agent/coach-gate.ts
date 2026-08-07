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
//   · C1 — the same loop, found by our OWN persona harness (scripts/c1-refine-walk.ts). "Dana" is a scripted
//     member, NOT a real one; never cite her as a member report.
//   · Jay, C3 (2026-08-06) — 25 messages deep, artifact captured and unchanged the whole way.
//
// The fix: remember WHAT was proposed, not just THAT something was. Re-propose only when the artifact has
// actually changed. When it hasn't, keep the confirm gate open — so a later "yes, save it" still commits — and
// let the model carry the turn instead of the engine repeating itself. That also gives a member room to ask a
// question at the gate, which is what Greg was doing.

/** Per-stage scratch for a propose→confirm coach gate. */
export type CoachGate = {
  proposed?: boolean;
  proposedSig?: string;
  /** The member has ASKED for a change since the last proposal, so the next artifact they see may not be the one
   *  they were shown. Cleared every time a proposal is put on screen. */
  revisionAsked?: boolean;
};

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

/**
 * Does the member's CONFIRM take precedence over a change the model recorded on the same turn?
 *
 * Yes — and this is the second half of the fix, found by a live walk on 2026-08-07 in Greg's own scenario. He was
 * shown his plan, said "Lock them in", and got the plan back AGAIN. His original complaint, reintroduced by the
 * repair for it.
 *
 * What happened: on the confirm turn the model ALSO re-called record_plan, paraphrasing its own capture
 * ("…core work" → "…core work, mixed movements"). The signature changed, change-check-first fired, and the engine
 * re-proposed over the top of his answer. The artifact was not different in any way he could see or asked for —
 * the model simply rewrote its own note while he was saying yes.
 *
 * The rule: a member's plain confirm outranks a model re-record. It's the same principle as the recurring capture
 * failure — the deterministic read of what the member SAID beats a model signal that contradicts it, and a
 * contradicting signal needs corroborating material. A paraphrase is not corroboration. A real edit is not a
 * confirm either: "yes but make it 3 days" carries a revision tail, so confirmsProposal returns false and it falls
 * through to the change-check and re-proposes properly.
 *
 * So the order is now: accumulate → CONFIRM WINS → change-check → hold. Change-check still precedes the hold, so a
 * genuine edit is never silently dropped.
 */
export function confirmOutranksRerecord(gate: CoachGate, memberConfirms: boolean, currentSignature: string): boolean {
  if (!gate.proposed || !memberConfirms) return false;
  // A confirm loses ONLY when both are true: the artifact actually moved since they were shown it, AND they had
  // asked for a change. Either alone is not enough, and getting that wrong breaks a different case each way:
  //
  //   · changed but NOT asked for  → Greg. The model paraphrased its own note while he said "Lock them in".
  //     Nothing he could see was different. His word wins.
  //   · asked for AND changed      → "actually make the walk 10 minutes" … "that works". He is agreeing to a
  //     revision he has only heard DESCRIBED. Committing here saves a plan he was never shown. Re-propose.
  //   · asked for but NOT changed  → he questioned or paused at the gate and the artifact is identical. His later
  //     "yes" must still commit, or we rebuild the exact dead end this whole gate exists to remove.
  //
  // That last row is why `revisionAsked` can be set generously on any non-confirm: it only bites in combination.
  const changedSinceProposal = gate.proposedSig !== currentSignature;
  return !(changedSinceProposal && gate.revisionAsked);
}

/** Note that the member has asked for a change while the gate is open. */
export function markRevisionAsked(gate: CoachGate): void {
  gate.revisionAsked = true;
}

/** Record that this exact artifact has now been put to the member, and open the confirm gate. */
export function markProposed(gate: CoachGate, signature: string): void {
  gate.proposed = true;
  gate.proposedSig = signature;
  gate.revisionAsked = false; // they are looking at the current artifact again
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

// WHERE A DOOR CAME FROM — and the rule that a context line may never claim more than the engine can prove.
//
// Jay walked his own Reconnect on 2026-08-11. He named three at onboarding; the Session drew out a fourth (The
// Vanishing) out of him — which is the entire point of that Session. The close then told him: "you named all four of
// these yourself at the start." He hadn't. The model was not inventing: every turn rebuilds the system prompt with
//
//     `The Door(s) they named at onboarding: ${doorNames.join(', ')}`
//
// from `collected.doors` — the CURRENT set, which §2b mutates the moment a re-seeing commits. The label asserted a
// provenance the engine had stopped tracking, so the model reported our own false statement back to him faithfully.
//
// THE GENERAL RULE, because this is a shape and not an incident: a context line may assert HOW or WHEN something was
// captured ONLY for a field that cannot change afterwards. `intake_gap` is written once at intake and never updated,
// so "how they first described the gap opening" is honest. The Door set and the Reclaim List are both revisable by
// design, so any "at onboarding" / "back at the start" phrasing over them is a claim with nothing behind it.
//
// The fix is not to drop the provenance — it is to EARN it. The arc knows the Door set as it stood at entry, so the
// split below is provable, and stating it truthfully is strictly better copy: it lets the close credit the work
// ("you named three; this one came out of today") instead of erasing it.

import type { DoorSlug } from '../doors.ts';

export type DoorProvenance = {
  /** Doors the member already had when this session opened. Empty when entry is unknown. */
  carried: DoorSlug[];
  /** Doors that surfaced DURING this session — the work the Session actually did. */
  surfacedHere: DoorSlug[];
  /** False when the entry snapshot is missing, so no line may claim when any Door was named. */
  provable: boolean;
};

/**
 * Split the current Door set by whether each Door predates this session.
 *
 * `doorsAtEntry` is the snapshot taken when the arc opened. It is OPTIONAL on purpose: a session that started before
 * this field existed resumes without it, and the honest answer there is "I can't prove when these were named" —
 * hence `provable: false`, which the caller must render as a neutral line. Guessing would reintroduce exactly the
 * bug this module exists to kill, and a confident wrong claim about a member's own life is worse than a vague one.
 *
 * Deliberately NOT derived from `reseeingTells`: a tell is suppressed for a routine add (`mechanical`) or a flat
 * mislabel, so a Door can legitimately arrive with no tell behind it. Tells record what was WORTH REMARKING ON;
 * this asks what CHANGED. Using the former for the latter would silently miscredit the quiet cases.
 */
export function doorProvenance(current: readonly DoorSlug[], doorsAtEntry?: readonly DoorSlug[]): DoorProvenance {
  if (!doorsAtEntry) return { carried: [], surfacedHere: [], provable: false };
  const entry = new Set(doorsAtEntry);
  return {
    carried: current.filter((d) => entry.has(d)),
    surfacedHere: current.filter((d) => !entry.has(d)),
    provable: true,
  };
}

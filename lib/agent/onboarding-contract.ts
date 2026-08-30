// The onboarding completion CONTRACT — the single, deterministic source of truth for "is the intake
// done." The conversation (live model or scripted) gathers; THIS decides whether what was gathered is
// complete enough to hand off. Completion is never the model's call alone — it must satisfy the
// contract here, and (Leg 2) the member must confirm the summary card built from it.
//
// Pure + framework-free so it unit-tests exhaustively against the personas that have broken.

import { DOORS, matchDoors, type DoorSlug } from '../doors.ts';
import { identityLabel } from '../member/identity.ts';
import { RECLAIM_LIST_MIN, consolidateReclaimList } from '../member/reclaim.ts';
import type { Collected } from './onboarding.ts';

// Recorded Doors NOT evidenced in the fade story (the gap narrative). If a Door isn't traceable to
// how the gap opened, it likely came from the Reclaim List or a model inference (e.g. The Body from a
// fitness-heavy list, as in Blake's run) — exactly the kind the MA must have CONFIRMED with the member
// ("would you call that a Door too?"), not tacked on. A deterministic REVIEW signal for /admin: never
// auto-stripped (the member may have legitimately affirmed it; the matcher can also simply miss a Door
// that IS in the story), it just flags "make sure this was actually asked." Pairs with the prompt rule.
export function doorsToConfirm(doors: string[], gap: string): string[] {
  if (!doors.length) return [];
  const grounded = new Set<string>(matchDoors(gap ?? ''));
  return doors.filter((d) => !grounded.has(d));
}

// Note: 'doors' is intentionally NOT a contract gap. Per the Doors Taxonomy Spec v1.0 §1, recognition
// (the member's Fade in their OWN words — the gap narrative) is decoupled from routing (the Door tag).
// Recognition is required; routing MAY be null. A real-Fade member whose story maps to no Door is still
// served — their words carry recognition — so the Door list never has to be exhaustive to ship.
export type ContractGap = 'athleticPast' | 'identity' | 'reclaimList' | 'gap';

// A gap must read like the STORY of how the Fade opened — not a restated Reclaim-List goal. Joanne's
// run-2 failure was `gap = "I'd like to lose 30 lbs"`: a goal, captured where the fade story belongs.
// Lenient by design (the confirmation card is the real human check) — it only rejects the obvious
// non-stories: too short, a verbatim reclaim item, or a bare future-goal phrasing.
const GOAL_PHRASE_RE = /^(i\s*'?\s*d\s+(?:like|love)\s+to|i\s+want\s+to|i\s*'?\s*d\s+like|i\s+wish|i\s+hope\s+to)\b/i;

export function gapIsNarrative(gap: string | undefined, reclaimList: string[] = []): boolean {
  const g = (gap ?? '').trim();
  if (g.length < 20) return false; // too short to be a "how it opened" story
  if (reclaimList.some((it) => it.trim().toLowerCase() === g.toLowerCase())) return false; // a list goal, not a story
  if (GOAL_PHRASE_RE.test(g) && g.length < 60) return false; // a short future-goal line ("I'd like to lose 30 lbs")
  return true;
}

export function hasIdentity(c: Collected): boolean {
  return !!c.identityNoun || !!c.identitySkipped; // named it, or chose "not yet" (found at Excavation)
}

// Which required slots are still unmet. Empty array = the contract is satisfied.
export function contractGaps(c: Collected): ContractGap[] {
  const missing: ContractGap[] = [];
  // SKIPPING THE IDENTITY BEAT SKIPS BOTH ITS OUTPUTS (Jay, 2026-08-30).
  //
  // `identitySkipped` means the member chose to name who they are reclaiming later, at Excavation. It already
  // satisfies the identity slot below (see hasIdentity) — but athleticPast, the OTHER output of that same beat,
  // was still demanded. So a member who skipped it was recorded as incomplete forever, on a slot they had been
  // deliberately let past.
  //
  // Jay's ruling, on being shown that a member can finish with neither: "gives a prospect some flexibility and
  // room to get comfortable, not turning them away. We should expect cases like that." Expecting a case means
  // representing it as a supported state, not as a permanent gap in the record — the card is logged to telemetry
  // and read on /admin/member, where "missing: athleticPast" reads as something having gone wrong.
  //
  // NOT a relaxation of the bar: the gap narrative and the Reclaim List are still required, and those are what
  // the program actually routes on. What is dropped is a description of the past self from someone who told us,
  // twice, that they were not ready to give one.
  if (!c.athleticPast && !c.identitySkipped) missing.push('athleticPast');
  if (!hasIdentity(c)) missing.push('identity');
  if ((c.reclaimList?.length ?? 0) < RECLAIM_LIST_MIN) missing.push('reclaimList');
  // THE NO-DOOR-YET MEMBER HAS NO GAP TO GIVE, and demanding one is exactly what stranded him. He is admitted
  // BECAUSE there is no Fade story here (Jay, 2026-08-29: "let him in with no Door"), so requiring the narrative
  // would re-close the door the ruling opened — and the only way to satisfy it would be to invent one, which is
  // the thing we never do. Everything else still stands: the identity slot and the Reclaim List are required of
  // him exactly as they are of anyone, and the List is what the program routes on for him.
  if (!c.noDoorYet && !gapIsNarrative(c.gap, c.reclaimList ?? [])) missing.push('gap');
  // Doors (routing) are deliberately optional — see the ContractGap note above. A null Door is a valid
  // completed state for a real-Fade member; the gap narrative carries recognition.
  return missing;
}

/** The gate. True only when every required record is present and substantive. */
export function contractMet(c: Collected): boolean {
  return contractGaps(c).length === 0;
}

// --- The summary card (Leg 2) ---------------------------------------------------------------
// The card the member confirms before the IDQ. It can ONLY be presented as "ready" when the contract
// is met — "if the card can't be built fulfilling every criterion, the agent isn't done." The card
// data is always derivable (so we can also show the member what's still missing).

export type SummaryCard = {
  ready: boolean; // contract satisfied — safe to offer the handoff
  missing: ContractGap[]; // unmet slots (drives "let's get the rest" when not ready)
  identityLabel: string | null; // "the Connector", or null if they chose to name it later
  doors: { slug: DoorSlug; displayName: string; descriptor: string }[]; // descriptor = the one-line gloss for the card
  reclaimList: string[];
  gap: string;
};

export function buildSummaryCard(c: Collected): SummaryCard {
  const missing = contractGaps(c);
  return {
    ready: missing.length === 0,
    missing,
    identityLabel: c.identityNoun ? identityLabel(c.identityNoun) : null,
    doors: (c.doors ?? []).map((slug) => {
      const d = DOORS.find((x) => x.slug === slug);
      return { slug, displayName: d?.displayName ?? slug, descriptor: d?.descriptor ?? '' };
    }),
    reclaimList: consolidateReclaimList(c.reclaimList ?? []), // clean the card even for a sloppily-stored/resumed list
    gap: c.gap ?? '',
  };
}

// Member-facing label for an unmet slot — used when the conversation must keep going.
export const GAP_LABEL: Record<ContractGap, string> = {
  athleticPast: 'who you were',
  identity: 'the person you’re reclaiming',
  reclaimList: 'your Reclaim List',
  gap: 'how the gap opened',
};

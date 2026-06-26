// rita's Door criterion — "raised-but-dropped", measured against an INDEPENDENT ground-truth detector, not
// the engine's own matchDoors (that would grade the engine with its own ruler — circular). The eval owns
// rita's script, so we scan HER messages for her own per-Door language. A Door is a miss ONLY when rita
// actually raised it and the engine dropped it — never when she simply didn't surface it (persona
// stochasticity). See docs/handoffs/2026-06-26-rita-criterion-{recommendation,GO}.md.

export const RITA_DOORS = ['career_cliff', 'load_bearer', 'aging_parents'] as const;
export type RitaDoor = (typeof RITA_DOORS)[number];

// Ground-truth signals drawn straight from rita's persona script (scripts/onboarding-eval.ts). Deliberately
// MORE liberal than matchDoors — it must catch a thread she raised even in phrasing the engine's matcher
// misses (else a genuine drop would be invisible, defeating the whole point).
const RITA_RAISED: Record<RitaDoor, RegExp> = {
  career_cliff:
    /\b(laid off|lay[- ]?off|lost my job|let go|twelve years|12 years|right before (a|my|the) promotion|the promotion)\b/i,
  load_bearer:
    /\b(breadwinner|carried (everything|us|it all|the (load|household|family))|carry (everything|the load)|held everything together|holding everything together|did(n'?t| not) step up|the savings (are|were|is)? ?(gone|going)|house (is|was)? ?at risk|sole (earner|provider)|all the bills|carried us financially)\b/i,
  aging_parents:
    /\b(coma|care ?giver|care ?taker|caring for (my |a |an |their |them|aging )?(parent|parents|mother|father|mom|dad)|becoming (his|her|their) (caretaker|caregiver)|parents? (need|needed) me|mother'?s (health|independence)|father (nearly )?(died|coded)|parents are declining|their care now|i'?m the one (caring|looking after))\b/i,
};

/** The Doors rita actually RAISED in her own words (independent of the engine's matcher). */
export function ritaRaisedDoors(memberText: string): Set<RitaDoor> {
  const t = (memberText ?? '').replace(/[‘’]/g, "'");
  const raised = new Set<RitaDoor>();
  for (const d of RITA_DOORS) if (RITA_RAISED[d].test(t)) raised.add(d);
  return raised;
}

/** Concerns for rita's Doors: a Door is a miss ONLY if she raised it AND the engine didn't capture it. */
export function ritaDoorConcerns(capturedDoors: readonly string[], memberText: string): string[] {
  const captured = new Set(capturedDoors);
  const raised = ritaRaisedDoors(memberText);
  return RITA_DOORS.filter((d) => raised.has(d) && !captured.has(d)).map((d) => `DROPPED a raised Door: ${d}`);
}

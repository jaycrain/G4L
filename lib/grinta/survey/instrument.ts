// The Grinta survey instrument — "Introduction to Grinta." An administered self-report (Likert 1–5) that
// establishes the member's GRINTA baseline at the end of onboarding. This is the SURVEY grinta (the resilience
// the member builds by closing each R), NOT the activity-derived daily register in lib/grinta/index.ts (the
// "Daily Call"). Kept in its own namespace so the two never collide.
//
// Structure: four STRANDS, each mapping 1:1 to one of the 4 Rs, each carrying its construct from the source
// hardiness/grit battery (the member never sees the construct label):
//   grit        → Reconnect
//   commitment  → Rewire
//   control     → Rebuild
//   challenge   → Reclaim
//
// Each strand has three subscales (e.g. grit = G1/G2/G3). The ONBOARDING BASELINE administers the twelve "*Q1"
// items — one per subscale, all four strands. The §2e Reconnect Checkpoint later administers six more GRIT items
// (G1/G2/G3 × Q2/Q3), which is why the item bank is coded and extensible rather than a flat list.

export const STRANDS = ['reconnect', 'rewire', 'rebuild', 'reclaim'] as const;
export type Strand = (typeof STRANDS)[number];

// The construct behind each strand, from the source battery. Internal — never member-facing copy.
export const STRAND_CONSTRUCT: Record<Strand, string> = {
  reconnect: 'grit',
  rewire: 'commitment',
  rebuild: 'control',
  reclaim: 'challenge',
};

export const LIKERT_MIN = 1;
export const LIKERT_MAX = 5;
export type LikertValue = 1 | 2 | 3 | 4 | 5;

export type GrintaItem = {
  code: string; // e.g. 'G1Q1' — subscale (G1) + question (Q1)
  strand: Strand;
  subscale: string; // e.g. 'G1' — the sub-subscale within a strand
  stem: string; // verbatim item text (first-person, self-report)
};

// The full item bank, keyed by code. Verbatim stems — do not reword without sign-off.
export const GRINTA_ITEMS: Record<string, GrintaItem> = {
  // grit → Reconnect
  G1Q1: { code: 'G1Q1', strand: 'reconnect', subscale: 'G1', stem: 'I can align my behaviors and lifestyles to match who I am as a person' },
  G2Q1: { code: 'G2Q1', strand: 'reconnect', subscale: 'G2', stem: 'I can focus on my personal wellness goals even when challenges arise' },
  G3Q1: { code: 'G3Q1', strand: 'reconnect', subscale: 'G3', stem: 'I can persevere and achieve what is important to me' },
  // commitment → Rewire
  // W1Q1 wording simplified per Donna's Reconnect edits (2026-07-26); Jay wants Greg to see it in-context on his own
  // walk (instrument reword — pending Greg's sign-off, per the frozen-instrument rule).
  W1Q1: { code: 'W1Q1', strand: 'rewire', subscale: 'W1', stem: 'I can practice positive self-talk to get me through challenges' },
  W2Q1: { code: 'W2Q1', strand: 'rewire', subscale: 'W2', stem: 'I know where my life is going and look forward to my future' },
  W3Q1: { code: 'W3Q1', strand: 'rewire', subscale: 'W3', stem: 'I have a general sense of what I am doing and why I am doing it' },
  // control → Rebuild
  B1Q1: { code: 'B1Q1', strand: 'rebuild', subscale: 'B1', stem: 'I know what is needed to take care of my body and mind' },
  B2Q1: { code: 'B2Q1', strand: 'rebuild', subscale: 'B2', stem: 'I have skills needed to manage my physical health and well-being' },
  B3Q1: { code: 'B3Q1', strand: 'rebuild', subscale: 'B3', stem: 'I have confidence in my ability to control my lifestyle habits' },
  // challenge → Reclaim
  C1Q1: { code: 'C1Q1', strand: 'reclaim', subscale: 'C1', stem: 'I value learning new things and striving to get better' },
  C2Q1: { code: 'C2Q1', strand: 'reclaim', subscale: 'C2', stem: 'I enjoy exploring what is possible for me in the future' },
  C3Q1: { code: 'C3Q1', strand: 'reclaim', subscale: 'C3', stem: 'I see challenges as opportunities to grow and improve' },

  // §2e Reconnect Checkpoint — six MORE grit items (grit → Reconnect), one pair per Reconnect beat. These are
  // administered at the end of the Reconnect arc; combined with the three baseline grit items they give a 9-item
  // grit read — the FIRST time grinta moves.
  // Recognition (the Doors)
  G1Q2: { code: 'G1Q2', strand: 'reconnect', subscale: 'G1', stem: "I am aware of what constructs and dimensions make up my 'identity'" },
  G1Q3: { code: 'G1Q3', strand: 'reconnect', subscale: 'G1', stem: "I am aware of the notion of an 'identity gap' between my idealized self and my actual self" },
  // Excavation (the Drift)
  G2Q2: { code: 'G2Q2', strand: 'reconnect', subscale: 'G2', stem: 'I appreciate how life circumstances shaped my past lifestyle (and how they influence my current one)' },
  // DISPLAY CASE ONLY, NOT WORDING (Jay, mid-walk 2026-08-25). These three stems held the only lowercase uses of
  // "Doors" and "the Fade" anywhere in the product. A member meets them capitalised everywhere else — Jay hit
  // "these doors" twenty minutes after marking seven of them on a board titled with the capital. Same words, two
  // presentations, one sitting, and the lowercase flattens a term the product spends the whole phase teaching.
  // Not a word has moved and no response can score differently; Greg is told it is case, not wording.
  G2Q3: { code: 'G2Q3', strand: 'reconnect', subscale: 'G2', stem: 'I appreciate that I have agency and control over how these Doors affect me' },
  // Spark (the Window)
  G3Q2: { code: 'G3Q2', strand: 'reconnect', subscale: 'G3', stem: 'I recognize how small daily choices may contribute to my Fade' },
  G3Q3: { code: 'G3Q3', strand: 'reconnect', subscale: 'G3', stem: 'I recognize various attributions and justifications that may contribute to my Fade' },

  // §R4 Rewire Checkpoint — six MORE commitment items (commitment → Rewire), one pair per Rewire session. VERBATIM
  // from Greg's Measurement Canvas V4b (Decision EE) — a validated instrument; do NOT reword. With the three
  // baseline commitment items (W1Q1/W2Q1/W3Q1) they give a 9-item commitment read at the Rewire close.
  // Affirmation (from W1)
  W1Q2: { code: 'W1Q2', strand: 'rewire', subscale: 'W1', stem: 'I am aware of mental traps that make it hard to stick to my goals' },
  W1Q3: { code: 'W1Q3', strand: 'rewire', subscale: 'W1', stem: 'I can counter negative thoughts with positive affirmations' },
  // Visualization (from W2)
  W2Q2: { code: 'W2Q2', strand: 'rewire', subscale: 'W2', stem: 'I can create a positive mindset to enhance my personal motivation' },
  W2Q3: { code: 'W2Q3', strand: 'rewire', subscale: 'W2', stem: 'I can visualize what I want to accomplish' },
  // Focus (from W3)
  W3Q2: { code: 'W3Q2', strand: 'rewire', subscale: 'W3', stem: 'I can counter triggers that challenge my behavior change efforts' },
  W3Q3: { code: 'W3Q3', strand: 'rewire', subscale: 'W3', stem: 'I am confident that I can maintain physical activity habits and healthy eating patterns over time' },

  // §B4 Rebuild Checkpoint — six control items (control → Rebuild), two per layer.
  //
  // REPLACED 2026-08-14, from Greg's Measurement Model Canvas V5, which supersedes V4b for these codes (his note: refined measurement
  // items for Rebuild and Reclaim in the Checkpoint Survey — his docs camel-case the Rs; ours never do). This was TWELVE items as activity/diet
  // 'a'/'b' pairs averaged 12→6. Three reasons the new cut is better, not merely newer:
  //
  //   1. IT ANSWERS #146. Foundation now asks about personal MOTIVATIONS, which is what B1 actually teaches (the
  //      SDT why-instrument). The old items asked about awareness of behaviour versus recommended guidelines —
  //      content B1 no longer covers, which is exactly the "B4 recaps a retired B1" complaint.
  //   2. IT KEEPS THE MOVE/EAT SPLIT WHERE IT IS REAL — Elevation, where the construct is behavioural: B3Q2 is
  //      activity, B3Q3 is diet, each with its OWN score instead of being averaged into one.
  //   3. IT STOPS AVERAGING NON-EQUIVALENT ITEMS. Only two of the six old pairs were genuinely activity/diet. The
  //      rest paired DIFFERENT concepts and meaned them — B2Q2a "self-monitoring" with B2Q2b "self-planning and
  //      time management" — so a member strong at tracking and weak at planning scored identically to the reverse
  //      and we could not tell them apart. That is a worse measurement error than the one it was avoiding.
  //
  // Same six scored codes as before, so nothing downstream re-keys. Six questions instead of twelve, which also
  // halves a Checkpoint that was already the longest in Rebuild.
  //
  // Verbatim from V5 except two proof-pass corrections, which ride without Greg's sign-off per the 7/23 precedent
  // below: "dietarty" → "dietary", and "self management" → "self-management" to match V5's own B2Q2 four words
  // earlier. Meaning unchanged in both.
  // Foundation (from B1) — the WHY. Motivations, and that motivations drive whether a change survives.
  B1Q2: { code: 'B1Q2', strand: 'rebuild', subscale: 'B1', stem: 'I am aware of my personal motivations related to physical activity and dietary behaviors' },
  B1Q3: { code: 'B1Q3', strand: 'rebuild', subscale: 'B1', stem: 'I understand that my personal motivations influence my ability to adopt and sustain lifestyles' },
  // Structure (from B2) — the SKILLS. Explain them, then locate yourself honestly within them.
  B2Q2: { code: 'B2Q2', strand: 'rebuild', subscale: 'B2', stem: 'I can explain how self-management skills influence lifestyles' },
  B2Q3: { code: 'B2Q3', strand: 'rebuild', subscale: 'B2', stem: 'I can appreciate my strengths and limitations in various self-management skills' },
  // Elevation (from B3) — the BEHAVIOUR, and the one layer where move and eat stay separate on purpose.
  B3Q2: { code: 'B3Q2', strand: 'rebuild', subscale: 'B3', stem: 'I can monitor my physical activity behaviors relative to personal goals for moving' },
  B3Q3: { code: 'B3Q3', strand: 'rebuild', subscale: 'B3', stem: 'I can monitor my dietary habits relative to personal goals for healthy eating' },

  // §C4 Reclaim Checkpoint — six MORE challenge items (challenge → Reclaim), two per layer. VERBATIM current-state
  // items from Greg's RECLAIM Gated Assets V4 (RC-7: the doc mislabels these "Based on B1/B2/B3" — they are C1/C2/C3,
  // the Challenge subscales; use the C-labels). A clean 6 (no pairwise averaging, unlike Rebuild's 12). With the three
  // baseline challenge items (C1Q1/C2Q1/C3Q1) they give the 9-item challenge read at the Reclaim close.
  // Readiness (from C1)
  C1Q2: { code: 'C1Q2', strand: 'reclaim', subscale: 'C1', stem: 'I am aware of what I want to work towards in the future' },
  // V5 (2026-08-14) — was 'I am aware of the importance of focusing to achieve my goals'. Agency, not focus.
  C1Q3: { code: 'C1Q3', strand: 'reclaim', subscale: 'C1', stem: 'I understand that I have personal agency over achieving my goal' },
  // Emergence (from C2)
  // V5 (2026-08-14) — was 'I have an optimistic view of the future and what it holds for me'. V5 labels this row
  // 'B2Q2', which is a typo: every sibling is C2*, the layer is Challenge/Emergence, and B2Q2 is already Rebuild's
  // self-management item. Read as C2Q2.
  C2Q2: { code: 'C2Q2', strand: 'reclaim', subscale: 'C2', stem: 'I can appreciate distinctions between various aspects of my identity' },
  C2Q3: { code: 'C2Q3', strand: 'reclaim', subscale: 'C2', stem: 'I can prioritize aspects of my life that matter to me' },
  // Extension (from C3)
  C3Q2: { code: 'C3Q2', strand: 'reclaim', subscale: 'C3', stem: 'I am able to determine elements in my daily life that have the strongest impact on my quality of life' },
  C3Q3: { code: 'C3Q3', strand: 'reclaim', subscale: 'C3', stem: 'I am able to monitor and prioritize elements in my daily life that are important to me' },
};

// The three baseline GRIT items (administered at onboarding) — needed to recompute the 9-item grit mean at the Checkpoint.
export const BASELINE_GRIT_ITEMS: readonly string[] = ['G1Q1', 'G2Q1', 'G3Q1'];

// The §2e Checkpoint reading — the six additional grit items, administered in beat order (Recognition→Excavation→Spark).
export const CHECKPOINT_GRIT_ITEMS: readonly string[] = ['G1Q2', 'G1Q3', 'G2Q2', 'G2Q3', 'G3Q2', 'G3Q3'];

// The three baseline COMMITMENT items (administered at onboarding) — the Rewire strand's Ave1 at the R4 Checkpoint.
export const BASELINE_COMMITMENT_ITEMS: readonly string[] = ['W1Q1', 'W2Q1', 'W3Q1'];
// The §R4 Rewire Checkpoint reading — the six additional commitment items, in session order (W1→W2→W3, Q2 then Q3).
export const CHECKPOINT_COMMITMENT_ITEMS: readonly string[] = ['W1Q2', 'W1Q3', 'W2Q2', 'W2Q3', 'W3Q2', 'W3Q3'];

// The three baseline CONTROL items (administered at onboarding) — the Rebuild strand's Ave1 at the B4 Checkpoint.
export const BASELINE_CONTROL_ITEMS: readonly string[] = ['B1Q1', 'B2Q1', 'B3Q1'];
// The §B4 Rebuild Checkpoint reading — six control items in administration order (Foundation → Structure →
// Elevation, Q2 then Q3). A CLEAN 6 since V5 (2026-08-14): what is administered is what is scored, so there is no
// longer a reduction step between them and no way for the two lists to drift out of step.
//
// THE PROVENANCE, because it was questioned and the answer was hard to find. This is GREG'S change, made by him,
// in writing, with his reason. Emailing Jay on 2026-08-14 with V5 attached:
//
//   "Please note that I removed the a and b options for items in Rebuild so the averaging and separate scoring of
//    diet and activity in Rebuild are no longer needed. I think it will be cleaner to keep it parallel
//    throughout."   — Greg Welk, thread 19ff32e51b8d563e
//
// (Quoted verbatim except the phase name, which he camel-cases as his house style. The naming guard caught the
// raw quote — correctly, and for the second time on a quotation of his. Normalising one capital is the smallest
// edit that keeps both the meaning and the brand rule, and saying so is what keeps it a quote.)
//
// "Parallel throughout" = parallel with Rewire and Reclaim, which are six apiece.
//
// AND THE DIET COVERAGE DID NOT SHRINK, which is the question this raises. V4b had twelve items as six a/b pairs,
// of which only TWO were genuinely activity/diet (B1Q2a/b, B3Q2a/b); the other four paired unrelated concepts and
// meaned them — B2Q2a "self-monitoring" with B2Q2b "self-planning and time management" — so a member strong at
// one and weak at the other scored identically to the reverse. V5 keeps the split where it is behavioural (B3Q2
// activity, B3Q3 diet, each now scored on its OWN rather than averaged away) and folds B1's pair into one stem
// naming both domains. Diet-specific items went 2-of-12 → 1-of-6: the same share. B2's 24-item skills instrument
// still rates every skill twice, once for movement and once for eating — the split was removed from the
// CHECKPOINT only, never from the phase.
export const CHECKPOINT_CONTROL_ITEMS: readonly string[] = [
  'B1Q2', 'B1Q3', // Foundation — motivations, and that motivations decide whether a change survives
  'B2Q2', 'B2Q3', // Structure — explain the skills, then locate yourself in them
  'B3Q2', 'B3Q3', // Elevation — monitor moving · monitor eating (the move/eat split, each scored on its own)
];
// Kept as a named export because callers ask for "the scored set" by name, and that stays true and readable even
// now that it is the same list. Aliased rather than duplicated — two literals that must match is the shape that
// drifts, and the whole point of the V5 cut is that administered === scored.
export const CHECKPOINT_CONTROL_SCORED: readonly string[] = CHECKPOINT_CONTROL_ITEMS;

// The three baseline CHALLENGE items (administered at onboarding) — the Reclaim strand's Ave1 at the C4 Checkpoint.
export const BASELINE_CHALLENGE_ITEMS: readonly string[] = ['C1Q1', 'C2Q1', 'C3Q1'];
// The §C4 Reclaim Checkpoint reading — the six challenge items, in layer order (Readiness → Emergence → Extension,
// Q2 then Q3). A CLEAN 6 — no pairwise averaging (unlike Rebuild's 12).
export const CHECKPOINT_CHALLENGE_ITEMS: readonly string[] = ['C1Q2', 'C1Q3', 'C2Q2', 'C2Q3', 'C3Q2', 'C3Q3'];

// pairwiseAverage IS RETIRED (2026-08-14). It existed for one caller — B4's 12 activity/diet halves — and V5
// removed the pairs, so it had no callers left. Deleted rather than kept "in case": a generic-looking helper that
// silently halves an array is exactly the thing someone reaches for later without knowing it encoded a
// measurement decision we deliberately reversed. It is in git if it is ever wanted back.

// The onboarding BASELINE reading — the twelve "*Q1" items, administered in R order (grit→commitment→control→
// challenge = Reconnect→Rewire→Rebuild→Reclaim). Item index in the administered array maps to this list.
export const ONBOARDING_BASELINE_ITEMS: readonly string[] = [
  'G1Q1', 'G2Q1', 'G3Q1', // Reconnect
  'W1Q1', 'W2Q1', 'W3Q1', // Rewire
  'B1Q1', 'B2Q1', 'B3Q1', // Rebuild
  'C1Q1', 'C2Q1', 'C3Q1', // Reclaim
];

export function grintaStem(code: string): string {
  const item = GRINTA_ITEMS[code];
  if (!item) throw new Error(`unknown Grinta item code: ${code}`);
  return item.stem;
}

export function strandForCode(code: string): Strand {
  const item = GRINTA_ITEMS[code];
  if (!item) throw new Error(`unknown Grinta item code: ${code}`);
  return item.strand;
}

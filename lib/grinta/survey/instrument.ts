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
  W1Q1: { code: 'W1Q1', strand: 'rewire', subscale: 'W1', stem: 'I can affirm myself and provide positive self-talk to get me through challenges' },
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
  G2Q3: { code: 'G2Q3', strand: 'reconnect', subscale: 'G2', stem: 'I appreciate that I have agency and control over how these doors affect me' },
  // Spark (the Window)
  G3Q2: { code: 'G3Q2', strand: 'reconnect', subscale: 'G3', stem: 'I recognize how small daily choices may contribute to my fade' },
  G3Q3: { code: 'G3Q3', strand: 'reconnect', subscale: 'G3', stem: 'I recognize various attributions and justifications that may contribute to my fade' },
};

// The three baseline GRIT items (administered at onboarding) — needed to recompute the 9-item grit mean at the Checkpoint.
export const BASELINE_GRIT_ITEMS: readonly string[] = ['G1Q1', 'G2Q1', 'G3Q1'];

// The §2e Checkpoint reading — the six additional grit items, administered in beat order (Recognition→Excavation→Spark).
export const CHECKPOINT_GRIT_ITEMS: readonly string[] = ['G1Q2', 'G1Q3', 'G2Q2', 'G2Q3', 'G3Q2', 'G3Q3'];

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

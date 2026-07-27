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
  G2Q3: { code: 'G2Q3', strand: 'reconnect', subscale: 'G2', stem: 'I appreciate that I have agency and control over how these doors affect me' },
  // Spark (the Window)
  G3Q2: { code: 'G3Q2', strand: 'reconnect', subscale: 'G3', stem: 'I recognize how small daily choices may contribute to my fade' },
  G3Q3: { code: 'G3Q3', strand: 'reconnect', subscale: 'G3', stem: 'I recognize various attributions and justifications that may contribute to my fade' },

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

  // §B4 Rebuild Checkpoint — twelve MORE control items (control → Rebuild), an activity/diet PAIR per layer question.
  // VERBATIM current-state items from Greg's Measurement Canvas V4b (RB-2 RESOLVED, 7/9 — use these, NOT the "I am
  // more…" phrasing in the Gated Assets doc); do NOT reword. The 'a'/'b' halves average pairwise to 6 scored items
  // (B1Q2, B1Q3, B2Q2, B2Q3, B3Q2, B3Q3) which, with the three baseline control items (B1Q1/B2Q1/B3Q1), give the
  // 9-item control read at the Rebuild close.
  // Foundation (from B1)
  B1Q2a: { code: 'B1Q2a', strand: 'rebuild', subscale: 'B1', stem: 'I am aware of my physical activity behaviors and how they relate to recommended guidelines' },
  B1Q2b: { code: 'B1Q2b', strand: 'rebuild', subscale: 'B1', stem: 'I am aware of my dietary habits and how they relate to recommended guidelines' },
  B1Q3a: { code: 'B1Q3a', strand: 'rebuild', subscale: 'B1', stem: 'I am aware of how sleep and stress can influence my lifestyle choices and my mood' },
  // Proof pass (Jay 2026-07-23): "my lifestyles influence" → "my lifestyle influences" (number agreement; a person has
  // one lifestyle, and the sibling items 92/103 use singular). Member-facing grammar fix, meaning unchanged — Jay
  // confirmed the proof-pass corrections ride without Greg sign-off.
  B1Q3b: { code: 'B1Q3b', strand: 'rebuild', subscale: 'B1', stem: 'I am aware of how my lifestyle influences various health indicators' },
  // Structure (from B2)
  B2Q2a: { code: 'B2Q2a', strand: 'rebuild', subscale: 'B2', stem: 'I am skilled at self-monitoring my lifestyle behaviors' },
  B2Q2b: { code: 'B2Q2b', strand: 'rebuild', subscale: 'B2', stem: 'I am skilled at using self-planning and time management skills to manage my behaviors' },
  B2Q3a: { code: 'B2Q3a', strand: 'rebuild', subscale: 'B2', stem: 'I am skilled at overcoming barriers and recovering from short relapses' },
  B2Q3b: { code: 'B2Q3b', strand: 'rebuild', subscale: 'B2', stem: 'I am skilled at managing my attitudes and staying motivated on healthy living' },
  // Elevation (from B3)
  B3Q2a: { code: 'B3Q2a', strand: 'rebuild', subscale: 'B3', stem: 'I have a consistent movement practice' },
  B3Q2b: { code: 'B3Q2b', strand: 'rebuild', subscale: 'B3', stem: 'I eat intentionally more often than I eat reactively' },
  B3Q3a: { code: 'B3Q3a', strand: 'rebuild', subscale: 'B3', stem: 'I can appreciate how physical activity, dietary behaviors and sleep patterns interact together' },
  B3Q3b: { code: 'B3Q3b', strand: 'rebuild', subscale: 'B3', stem: 'I can see how lifestyle behaviors influence my health, function, and quality of life' },

  // §C4 Reclaim Checkpoint — six MORE challenge items (challenge → Reclaim), two per layer. VERBATIM current-state
  // items from Greg's RECLAIM Gated Assets V4 (RC-7: the doc mislabels these "Based on B1/B2/B3" — they are C1/C2/C3,
  // the Challenge subscales; use the C-labels). A clean 6 (no pairwise averaging, unlike Rebuild's 12). With the three
  // baseline challenge items (C1Q1/C2Q1/C3Q1) they give the 9-item challenge read at the Reclaim close.
  // Readiness (from C1)
  C1Q2: { code: 'C1Q2', strand: 'reclaim', subscale: 'C1', stem: 'I am aware of what I want to work towards in the future' },
  C1Q3: { code: 'C1Q3', strand: 'reclaim', subscale: 'C1', stem: 'I am aware of the importance of focusing to achieve my goals' },
  // Emergence (from C2)
  C2Q2: { code: 'C2Q2', strand: 'reclaim', subscale: 'C2', stem: 'I have an optimistic view of the future and what it holds for me' },
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
// The §B4 Rebuild Checkpoint reading — the TWELVE current-state control items, in administration order (Foundation →
// Structure → Elevation, each Q2 then Q3, activity 'a' then diet 'b'). These average PAIRWISE (12 → 6) before scoring.
export const CHECKPOINT_CONTROL_ITEMS: readonly string[] = [
  'B1Q2a', 'B1Q2b', 'B1Q3a', 'B1Q3b', // Foundation
  'B2Q2a', 'B2Q2b', 'B2Q3a', 'B2Q3b', // Structure
  'B3Q2a', 'B3Q2b', 'B3Q3a', 'B3Q3b', // Elevation
];
// The six SCORED control items after pairwise averaging (Q2 = mean(a,b), Q3 = mean(a,b) per layer). Order matches the
// pairwise reduction of CHECKPOINT_CONTROL_ITEMS.
export const CHECKPOINT_CONTROL_SCORED: readonly string[] = ['B1Q2', 'B1Q3', 'B2Q2', 'B2Q3', 'B3Q2', 'B3Q3'];

// The three baseline CHALLENGE items (administered at onboarding) — the Reclaim strand's Ave1 at the C4 Checkpoint.
export const BASELINE_CHALLENGE_ITEMS: readonly string[] = ['C1Q1', 'C2Q1', 'C3Q1'];
// The §C4 Reclaim Checkpoint reading — the six challenge items, in layer order (Readiness → Emergence → Extension,
// Q2 then Q3). A CLEAN 6 — no pairwise averaging (unlike Rebuild's 12).
export const CHECKPOINT_CHALLENGE_ITEMS: readonly string[] = ['C1Q2', 'C1Q3', 'C2Q2', 'C2Q3', 'C3Q2', 'C3Q3'];

// Pairwise-average an even-length response array into consecutive pairs → half the length. B4's one genuine factory
// addition (Greg 7/9: "average the pair to retain the meaning of the summary construct"): the 12 activity/diet halves
// collapse to 6 scored items before the standard checkpoint scoring runs. Result values are non-integer means (valid —
// scoreCheckpointStrand only means them, it doesn't re-validate the Likert integer constraint).
export function pairwiseAverage(responses: readonly number[]): number[] {
  if (responses.length % 2 !== 0) throw new Error(`pairwiseAverage expects an even count, got ${responses.length}`);
  const out: number[] = [];
  for (let i = 0; i < responses.length; i += 2) out.push(Math.round(((responses[i]! + responses[i + 1]!) / 2) * 100) / 100);
  return out;
}

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

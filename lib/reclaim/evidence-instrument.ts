// ⚠ HELD FOR CYCLE 2 — NOT WIRED TO ANY ARC (Greg, 2026-08-07). This ran as C1 Step 1 until he cut it: "the questions
// at the beginning of C1 may be hard for people to comment on in Cycle 1 (since it is intentionally short). Thus, we
// may want to hold this assessment to Cycle 2." Kept verbatim rather than deleted because it is his instrument and the
// intent is to bring it back one cycle later, not to abandon it. Nothing imports this today — if you are here because
// you are building Cycle 2, this is the instrument you want.
//
// C1 · "Reflecting on Progress" — the Reclaim Readiness evidence self-check (Greg's Gated Assets V4). Fifteen items
// across three kinds of evidence (Physical / Relational / Identity), 1–5. Item stems are Greg's VERBATIM wording,
// except a member-facing tense fix (Jay's proof pass 2026-07-23, rides without Greg sign-off): the first physical item
// read "I identify a physical task accomplishment in the last 90 days …" — present verb against a completed-past window
// ("in the last 90 days") — corrected to "I identified …". Meaning unchanged; the sibling items are genuine present-
// state statements, so this is consistent, not a divergence.
//
// RC-2 (Greg 7/9): this is FORMATIVE ONLY — "just a reflective exercise." The items are NOT scored and NOT persisted
// as a measure; the member answers, sees the "are you in Reclaim" reflection, and moves on. So there's no register
// table and no scoring function here — only the ordered items + their part labels for administration.

export type EvidencePart = 'physical' | 'relational' | 'identity';
export type EvidenceItem = { part: EvidencePart; stem: string };

export const EVIDENCE_PART_LABEL: Record<EvidencePart, string> = {
  physical: 'The Physical Evidence',
  relational: 'The Relational Evidence',
  identity: 'The Identity Evidence',
};

// 15 items in administration order: Physical (5) → Relational (5) → Identity (5). Verbatim.
export const EVIDENCE_ITEMS: EvidenceItem[] = [
  { part: 'physical', stem: 'I identified a physical task accomplishment in the last 90 days that I could not have done a year ago.' }, // tense fix (see header)
  { part: 'physical', stem: 'I understand my health numbers (weight, blood pressure, bloodwork, resting heart rate) and know where I stand.' },
  { part: 'physical', stem: 'I can see a path to a physical practice (e.g. cycling, walking, strength training) that aligns with my identity.' },
  { part: 'physical', stem: "I can appreciate food as ‘fuel’ for my body and mind instead of just for taste and satisfaction." },
  { part: 'physical', stem: 'I appreciate the importance of linking my physical activity and diet habits as part of lifestyle change.' },
  { part: 'relational', stem: 'I can step up and care for someone I care about in a more tangible way.' },
  { part: 'relational', stem: 'I see myself reconnecting with others and my community in deeper ways.' },
  { part: 'relational', stem: 'I am more present, more engaged, or more available than I was before.' },
  { part: 'relational', stem: 'I have done something with another person that was hard, shared, and meaningful — a ride, a project, a conversation that mattered.' },
  { part: 'relational', stem: 'I am the person who says yes now, not the person who cancels.' },
  { part: 'identity', stem: 'I can describe who I am without defaulting to my job title or my family role.' },
  { part: 'identity', stem: 'I am proud of the distance I’ve traveled thus far to explore what is possible for me.' },
  { part: 'identity', stem: 'I have a sense of purpose that goes beyond obligation.' },
  { part: 'identity', stem: 'I have thought about what I want the next chapter of my life to look like — and it’s bigger than what I would have imagined two years ago.' },
  { part: 'identity', stem: 'If someone asked me whether the 4Rs work, I could answer from experience, not hope.' },
];

export const EVIDENCE_ITEM_COUNT = EVIDENCE_ITEMS.length; // 15
// 0-based indices where each new part begins (drives the part-header frame between clusters).
export const EVIDENCE_PART_STARTS: Record<number, EvidencePart> = { 0: 'physical', 5: 'relational', 10: 'identity' };

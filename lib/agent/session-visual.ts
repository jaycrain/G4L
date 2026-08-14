// SESSION VISUALS — a picture the engine asks the client to draw beside a turn's text.
//
// WHY THIS IS A MECHANISM AND NOT A CHART (Jay, 2026-08-14): "it's probably not going to be a one-off, we'll be
// doing more of it in future Cycles... most people are visual learners, so these kind of assets will drive deeper
// learning and takeaways for our members." So the second visual should cost a component, not an architecture.
//
// IT IS THE SIBLING OF `expects`, NOT A MEMBER OF IT. Sessions already let the engine tell the client to render
// something other than a text box — the 1–5 chips, the Reclaim List builder, the identity chips. Those all live in
// `Expectation`, which means "what I want back from you". A visual asks for NOTHING; it renders, and the turn then
// takes its ordinary input. Folding it into Expectation would make that union mean two different things.
//
// IT IS PART OF WHAT WAS SAID, so it is stored on the message rather than recomputed at read time. The alternative
// — re-deriving the bars from bigger_world_reading whenever a transcript is replayed — makes HISTORY MUTABLE: a
// member who re-runs C2 in a later Cycle would open their old revisit and find the chart silently redrawn with new
// numbers, explaining a choice it no longer matches. See agent_message.visual (migration 0079).
//
// GOVERNANCE. A visual is under the same rules as any other member-facing surface: never a bare number, never a
// verdict, never a ranking of the member. Each variant carries its own `lead` — the sentence that frames it — so
// the framing travels WITH the data instead of being re-written at each call site.

/** One domain's bar in the C2 priority read. Values are Greg's, in his variable names. */
export type PriorityBarRow = {
  label: string; // the member-facing domain name — "Physical", "Self", "Social", "Outlook"
  status: number; // Gap × Importance
  readiness: number;
  ripple: number;
  total: number; // the Priority Score — Status + Readiness + Ripple. The bar's LENGTH.
};

/**
 * The C2 Step-2 read: one horizontal stacked bar per life domain, shown after the twenty ratings and before the
 * member prioritises — so they choose with the pattern in front of them instead of from memory.
 *
 * LENGTH IS THE PRIORITY SCORE, UNSCALED. Status reaches 90 (Gap 9 × Importance 10) while Readiness and Ripple cap
 * at 10, so a high-priority bar really is mostly Status and Readiness can be a four-percent sliver. That is true and
 * we draw it true; the renderer prints all three values so the small ones stay legible. Rescaling to make the
 * segments look comparable — which is how Greg's mock is drawn — would flatter the picture and lie about the maths.
 * The sliver is the point: the lowest bar is often the one with the most Readiness, which is exactly the "better
 * target at lower Priority" this exists to surface.
 */
export type PriorityBarsVisual = {
  kind: 'priority-bars';
  lead: string; // the framing sentence — a read, never a ranking. Travels with the data.
  rows: PriorityBarRow[];
};

/** Add a member here when a new Session wants to show something; the client grows one branch to match. */
export type SessionVisual = PriorityBarsVisual;

/** Member-facing names for Greg's variables. His terms stay in the code and the stored data; these are what a
 *  member reads. "Status"/"Ripple" are measurement words, and a member is not reading a measurement paper. */
export const PRIORITY_SEGMENT_LABEL = { status: 'Distance', readiness: 'Ready', ripple: 'Knock-on' } as const;

// Capture invariants — the properties a healthy onboarding capture walk must hold for ANY member, however messy.
// These are the CHECKED gate (not an eyeball read of a clean persona): run them over any walk — a live adversarial
// persona run (scripts/capture-torture.ts) or a recorded/replayed transcript — and a violation fails LOUD with the
// offending turn. This is what would have caught Donna/milie's batch before they did: the reclaim close loop
// (repeated replies), the raw run-on gap, the missed Doors, the un-distilled reclaim items.
//
// Pure + dependency-light: reuses the SAME detectors the live engine uses (matchDoors / isMultiWantParagraph /
// tidyGapProse), so an invariant can never drift from the behavior it guards.

import { matchDoors } from '../doors.ts';
import { isMultiWantParagraph } from './reclaim-shape.ts';
import { tidyGapProse } from './onboarding-staged.ts';
import type { Collected } from './onboarding.ts';

export type WalkTurn = { role: 'agent' | 'member'; text: string };
export type Violation = { invariant: string; detail: string };
export type Walk = { transcript: WalkTurn[]; collected?: Collected; maxAgentTurns?: number };

// ── similarity (near-duplicate reply detection) ──────────────────────────────────────────────────────────────
function tokenSet(s: string): Set<string> {
  return new Set((s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean));
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// 1) NO REPEATED / LOOPING REPLIES. The single strongest signal that the capture stalled: the Companion says the same
//    thing twice (milie: "Got it — that's a strong list… Anything missing?" fired 4×; the multiwant gate re-asked
//    "which one do you most want back?" per item). Catches verbatim repeats AND near-duplicates (same beat, reworded).
export function checkRepeatedReplies(transcript: WalkTurn[], simThreshold = 0.82): Violation[] {
  const replies = transcript.filter((t) => t.role === 'agent').map((t) => t.text.trim()).filter(Boolean);
  const out: Violation[] = [];
  for (let i = 0; i < replies.length; i++) {
    for (let j = i + 1; j < replies.length; j++) {
      const a = replies[i]!;
      const b = replies[j]!;
      if (a === b) { out.push({ invariant: 'no-repeated-reply', detail: `identical agent replies (#${i}, #${j}): "${a.slice(0, 70)}…"` }); continue; }
      if (a.split(/\s+/).length < 6) continue; // ignore tiny acks
      const sim = jaccard(tokenSet(a), tokenSet(b));
      if (sim >= simThreshold) out.push({ invariant: 'no-repeated-reply', detail: `near-duplicate agent replies (${Math.round(sim * 100)}%, #${i}, #${j}): "${a.slice(0, 70)}…"` });
    }
  }
  return out;
}

// 2) THE GAP IS TIDIED. The stored fade story is shown on the card + dashboard "in your own words" — it must read as
//    clean prose, not a raw run-on (milie: "…entry.it is…", "The, any free time"). tidyGapProse is a no-op on clean
//    prose, so a difference means raw mechanics slipped through (the backstop wasn't tidied / the model stored raw).
export function checkGapTidied(gap?: string): Violation[] {
  const g = (gap ?? '').trim();
  if (!g) return [];
  if (tidyGapProse(g) !== g) return [{ invariant: 'gap-tidied', detail: `gap stored with raw mechanics (run-ons/caps): "${g.slice(0, 90)}…"` }];
  return [];
}

// 3) DOORS LAND ON A DOOR-RICH GAP. If the gap narrative clearly signals Door events, at least one must be captured
//    (milie: father died + a soul-crushing job change + knee/back → ZERO doors on the card).
export function checkDoorsCaptured(gap?: string, doors?: string[]): Violation[] {
  const g = (gap ?? '').trim();
  if (!g) return [];
  const signalled = matchDoors(g);
  if (signalled.length > 0 && (doors?.length ?? 0) === 0) {
    return [{ invariant: 'doors-captured', detail: `gap signals Door(s) ${JSON.stringify(signalled)} but none were captured` }];
  }
  return [];
}

// 4) RECLAIM ITEMS ARE DISTILLED. No item is a raw multi-want dump, and none is a verbose raw message (milie: whole
//    sentences like "Some time every week to create. Focus first on writing a story I started…" landed as items).
//    The word cap surfaces the KNOWN completeness gap (raw-text items) as a visible violation until the contract lands.
export function checkReclaimDistilled(list?: string[], maxWords = 16): Violation[] {
  const out: Violation[] = [];
  for (const item of list ?? []) {
    if (isMultiWantParagraph(item)) out.push({ invariant: 'reclaim-distilled', detail: `un-split multi-want item: "${item.slice(0, 70)}…"` });
    else if ((item.trim().split(/\s+/).length) > maxWords) out.push({ invariant: 'reclaim-distilled', detail: `raw/verbose item (>${maxWords} words): "${item.slice(0, 70)}…"` });
  }
  return out;
}

// 5) BOUNDED. A healthy walk finishes; a runaway loop doesn't. Agent turns must stay under the cap.
export function checkBounded(transcript: WalkTurn[], maxAgentTurns: number): Violation[] {
  const n = transcript.filter((t) => t.role === 'agent').length;
  return n > maxAgentTurns ? [{ invariant: 'bounded', detail: `${n} agent turns exceeds the ${maxAgentTurns} cap (likely a loop)` }] : [];
}

/** Run every invariant over a walk. Returns all violations (empty = the walk holds). */
export function runCaptureInvariants(walk: Walk): Violation[] {
  const { transcript, collected, maxAgentTurns = 45 } = walk;
  return [
    ...checkRepeatedReplies(transcript),
    ...checkGapTidied(collected?.gap),
    ...checkDoorsCaptured(collected?.gap, collected?.doors),
    ...checkReclaimDistilled(collected?.reclaimList),
    ...checkBounded(transcript, maxAgentTurns),
  ];
}

// The in-Session TEACHING LAYER — resolves the four teaching beats for a Session.
//
// WHY THIS EXISTS. "Why this matters" (summaries.ts) and "Why it works" (explore.ts) are load-bearing instruction,
// but until now they were filed as optional content behind a widget: an inline expander and an overlay in the
// Session header. Members skipped them, and the Checkpoints downstream read as though they hadn't. Greg's own
// Level 1 definition settles the intent — "a bit of reading or review of ideas to provide a foundation." Reading
// is a NAMED STEP in his level structure, not enrichment. So the content is promoted from opt-in widget to
// required beats inside the Session.
//
// THE SPINE. Every Session becomes: ① Frame → ② Work → ③ Understand → ④ Keep.
//   ① Frame      — the summary. Opens the Session. One tap ("Clip in →") to reach the work.
//   ② Work       — the Companion conversation. UNCHANGED; this module says nothing about it.
//   ③ Understand — the explore points, shown IN FULL, inline in the scroll. One tap ("Got it →").
//   ④ Keep       — one distilled takeaway commits with the Session's existing keeper commit.
//
// WHY THE COMPANION DOESN'T TEACH THIS. Greg assigns a teaching permission per asset, and it is restrictive: only
// B1 and B2 grant "didactic latitude" (share briefly, then return to elicitation). C1/C2/C3 are evocative-only —
// the Companion may teach NOTHING. R1 says instruction is premature. So routing this content through the Companion
// would violate the posture spec for ten of twelve assets. Rendering it as authored cards the Companion GESTURES
// AT is what keeps us compliant: the app teaches, the Companion stays evocative. That is the load-bearing reason
// the teaching beats are a separate surface, not a chat bubble — not merely a visual preference.
//
// ONE KEEPER, NOT SIXTY-THREE. The first design kept per-point taps (~63 decisions a cycle). Donna flagged it;
// Rev 1 cut it to one acknowledgment and one distilled read per Session (~12 a cycle, predictable). The lede IS
// the distilled takeaway — it already names what the foundation is FOR, in the member's terms.
//
// ROUTING IS FIXED. The kept read goes to "What you've learned" (Reads — what CONVINCED you) and NEVER to "What
// worked" (Moves — what you DID). A science takeaway is understanding, not a tactic. See lib/playbook/tabs.ts.

import { sessionSummary, sessionAsset, type Summary } from './summaries.ts';
import { exploreFor, exploreForReconnectStage, type Explore } from './explore.ts';
import type { SessionKey } from '../workspace/session-key.ts';

/** One kept read — the Session's distilled science takeaway, bound for "What you've learned". */
export type TeachingKeeper = {
  /** The line kept. Defaults to the Explore lede; a member-chosen point head replaces it if they pick one. */
  text: string;
  /** Provenance shown on the card — "from Disinformation Audit · Rewire". Built by the caller from wayfinding. */
  assetId: string;
  /** Fixed. Reads are understanding, never tactics — this must not be routed to 'worked'. */
  tab: 'learned';
};

export type TeachingBeats = {
  /** ① The frame. Absent for gates (checkpoints, B4/C4) — they teach nothing. */
  frame?: Summary;
  /** ③ The understand beat, shown in full. Absent where the asset has no Explore panel. */
  understand?: Explore;
  /** Whether this Session has any teaching at all. False for gates. */
  teaches: boolean;
};

/**
 * Resolve the teaching beats for a Session.
 *
 * RECONNECT IS THE EXCEPTION, and it is Greg's structure, not an implementation quirk. Reconnect is ONE continuous
 * arc carrying three Science Checks (R1 → R2 → R3), so it resolves its Understand beat BY BEAT: the frame opens the
 * whole arc (the phase summary), then each sub-activity gets its own "Why it works" as it closes. The three are
 * never all visible at once. Every other Session maps 1:1 to an asset and brackets the work.
 *
 * @param stage  Reconnect's current beat. Ignored for 1:1 Sessions. Passing it for a 1:1 Session is harmless.
 */
export function teachingFor(key: SessionKey, stage?: string | null): TeachingBeats {
  const frame = sessionSummary(key) ?? undefined;

  // Gates (checkpoints, b4, c4) have no summary and teach nothing — sessionSummary returns null for them.
  if (!frame) return { teaches: false };

  const asset = sessionAsset(key);
  const understand = asset ? exploreFor(asset) : exploreForReconnectStage(stage);

  return { frame, understand, teaches: true };
}

/**
 * The distilled takeaway kept from a Session — beat ④.
 *
 * Default is the Explore LEDE: it is already a single line naming what the foundation is for. Rev 1 allows an
 * optional, skippable "which line stayed with you?" — if the member picks a point, its head replaces the lede.
 * Returns null when there is nothing to keep, so callers can fold this into the existing keeper commit without a
 * branch that invents an empty read.
 *
 * NOTE the deliberate asymmetry: the FRAME keeps nothing. It is setup, not a finding. Keeping it would double every
 * Session's read count and put purpose-statements in a tab meant for what convinced you.
 */
export function teachingKeeper(
  key: SessionKey,
  assetLabel: string,
  chosenPointHead?: string | null,
  stage?: string | null,
): TeachingKeeper | null {
  const { understand } = teachingFor(key, stage);
  if (!understand) return null;

  const text = chosenPointHead?.trim() || understand.lede;
  if (!text) return null;

  return { text, assetId: assetLabel, tab: 'learned' };
}

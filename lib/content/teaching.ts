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

import { sessionSummary, sessionAsset, type Summary, type AssetId } from './summaries.ts';
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
  // Reconnect resolves by beat AND shows each asset's science ONCE, at that asset's last beat — see the
  // shown-once rule below. Every other Session is 1:1 and brackets its own work.
  const understand = asset
    ? exploreFor(asset)
    : reconnectTeachesHere(stage)
      ? exploreForReconnectStage(stage)
      : undefined;

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

/** Asset titles for the kept read's provenance chip — "from Disinformation Audit · Rewire" (Rev 1's mockup). */
const ASSET_TITLE: Record<string, string> = {
  // NAMING IS GUARDED HERE (tests/naming-guard.test.ts) — these strings are member-facing, on the provenance chip
  // of a kept read. Two retired spellings slipped in from Greg's document titles: the old two-word label for r2
  // (it is just "the Doors" now) and his house camel-casing of the four Rs on c1. The guard greps this file as
  // plain text, comments included, so do not name either mistake here — it would re-trip on the explanation.
  // MEMBER-FACING NAMES ONLY (2026-09-01). This chip reads "from ___ · Reconnect" on a kept read, so it must
  // say what the member calls the Session. R1 and R3 both used to carry Greg's INSTRUMENT names; renaming R1
  // to The Distance left R3 as the only one still crediting a name no member has ever been shown. Greg's
  // instrument names live in his Science Check and memos, not on a member's surface. R2 stays "the Doors"
  // on purpose — the board and the conversation both call it that, so it matches their experience even
  // though the Session title is Excavation.
  r1: 'The Distance', r2: 'the Doors', r3: 'The Fade',
  w1: 'Disinformation Audit', w2: 'Visualization Workshop', w3: 'Mindful Monitoring',
  b1: 'What Is Your Why?', b2: 'Strengths and Weaknesses', b3: 'Monitoring Health Decisions',
  // C1 was RETITLED BY GREG on 2026-08-07 — "I also think the term Readiness may not be a good fit anymore. I
  // proposed a new title of 'Looking Forward' to somewhat reflect the process of reclaiming." The curriculum
  // and the session registry both followed; this file did not, so the member-facing provenance chip kept the
  // retired title for three weeks. The LAYER is still Readiness — that is Greg's internal gradient, not a name.
  c1: 'Looking Forward', c2: 'the Bigger World Audit', c3: 'Quality Days',
};
const PHASE_TITLE: Record<string, string> = { r: 'Reconnect', w: 'Rewire', b: 'Rebuild', c: 'Reclaim' };

/**
 * The provenance line shown on the kept read. Derived rather than passed in: three chat clients need the same
 * string, and a label typed at each call site is three chances for them to disagree about what a Session is called.
 */
export function teachingSourceLabel(key: SessionKey, stage?: string | null): string {
  // Reconnect used to be one arc over three assets, so the label had to follow the BEAT the science came from.
  // Now each Session IS its asset and sessionAsset resolves r1/r2/r3 directly; the stage fallback is kept for the
  // checkpoint, which spans all three and has no single asset of its own.
  const asset = sessionAsset(key) ?? (key === 'r4' ? reconnectAssetForStage(stage) : undefined);
  if (!asset) return 'the Program';
  return `${ASSET_TITLE[asset] ?? asset} · ${PHASE_TITLE[asset[0]!] ?? ''}`.trim().replace(/ ·\s*$/, '');
}

/**
 * THE SHOWN-ONCE RULE — why Reconnect could not have the teaching layer until now.
 *
 * Reconnect is ONE arc across three Science Checks, and its seven beats collapse onto three assets: entry and
 * doors both resolve R1, and measurement/window/checkpoint/ceremony all resolve R3. Rendering "Why it works" per
 * BEAT would show a member the same card up to four times in one Session — which reads as the product losing
 * track of what it has already told them, and is worse than not teaching at all.
 *
 * Keyed to the ASSET, not the beat: the card shows at the LAST beat that maps to each asset, so the science
 * arrives when that piece of work is finished rather than in the middle of it. Greg's structure is the reason —
 * the Understand beat closes an activity, and R1's activity is not over at `entry`.
 */
const RECONNECT_LAST_BEAT_FOR_ASSET: Record<string, string> = { r1: 'doors', r2: 'drift', r3: 'ceremony' };

/** True when this Reconnect beat is where its asset's science should appear — once per asset, at its close. */
export function reconnectTeachesHere(stage?: string | null): boolean {
  const asset = reconnectAssetForStage(stage);
  return !!asset && RECONNECT_LAST_BEAT_FOR_ASSET[asset] === (stage ?? '');
}

/** Reconnect's beats in order — the arc's own sequence, used to decide what has already been taught. */
const RECONNECT_BEAT_ORDER = ['entry', 'doors', 'drift', 'measurement', 'window', 'checkpoint', 'ceremony'];

// REMOVED with the multi-card teaching layer, 2026-08-29. `reconnectTaughtSoFar` derived WHICH cards to show
// from how far through the beat order the member had got — the machinery that showed two cards on question one.
// Every phase now uses ONE CARD, AT THE CLOSE, and tests/reconnect-opens-on-the-mirror.ts already asserts this
// name cannot come back. It outlived that rule as a tested, exported, never-called function: green in CI, doing
// nothing for a member. (Found by scripts/unrun-rules.mjs.)

/** Which Reconnect asset a beat's science belongs to — mirrors explore.ts's stage map, kept here for the label. */
function reconnectAssetForStage(stage?: string | null): string | undefined {
  if (!stage) return 'r1';
  if (stage === 'drift') return 'r2';
  if (['measurement', 'window', 'checkpoint', 'ceremony'].includes(stage)) return 'r3';
  return 'r1';
}

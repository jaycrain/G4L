// Proactive Outreach — types + the tunable dials (Governance Decision VV; Impl Plan v0.2 §0a; Decision EEE
// delta 2026-07-19). Values here are PRELIMINARY (Greg confirms/adjusts ~2 weeks after pilot) — they live as
// config, never baked into logic. The engine emits an OutreachDraft; the pure validator (validate.ts) gates it
// against §10 before any channel touches it. Nothing here reaches out on its own — that's the router's job later.

// Flag gate (staged-flag convention, matching REWIRE/REBUILD/RECLAIM/REDESIGN): the whole surface is dark until set.
export function outreachEnabled(): boolean {
  return process.env.OUTREACH === 'staged';
}

export type Tense = 'present' | 'practice' | 'horizon'; // §5 voice-dial, set by the member's phase
export type OutreachTrigger =
  | 'morning_presence'
  | 'post_log'
  | 'pattern'
  | 'reclaim_milestone'
  | 'checkpoint_due'
  | 're_engagement'
  | 'community_share';
export type SourceStream = 'words' | 'reclaim' | 'pattern'; // §4 — the three grounding streams

// §8 provenance — every reflective message carries an internal citation to the exact source it was built from.
// No provenance = a generation error, blocked before send (validator GROUNDED check).
export type Provenance = { stream: SourceStream; ref: string; quote?: string };

// What the governed engine emits. STRUCTURED on purpose, so the validator can gate deterministically instead of
// guessing from free text: the engine declares its tense, whether it offered a plan, and how many questions it asked.
export type OutreachDraft = {
  trigger: OutreachTrigger;
  tense: Tense;
  text: string;
  provenance: Provenance | null; // null → blocked (§8)
  hasPlan: boolean; // contains a directive/plan — only legal in Practice, and only as an invitation (§5)
  questionCount: number; // MI: at most one (§6)
};

// ── Dial 1 · Cadence (Decision EEE): a member-SET RHYTHM + generous default + auto-back-off, NOT a fixed ceiling ──
export type Rhythm = 'daily' | 'few_week' | 'weekly' | 'on_ask';
export const DEFAULT_RHYTHM: Rhythm = 'few_week'; // leans to presence; the member dials down or off, no penalty
// Max OUTBOUND touches per rolling 7 days by rhythm (in-app-on-open doesn't count — Impl Plan §1).
export const RHYTHM_WEEKLY_MAX: Record<Rhythm, number> = { daily: 7, few_week: 4, weekly: 1, on_ask: 0 };
export const BACKOFF_AFTER_IGNORED = 2; // consecutive ignored outreaches before the rhythm decays
export const BACKOFF_FLOOR: Rhythm = 'weekly'; // decay never goes below this (still a quiet presence)
// In-app is exempt from the weekly ceiling ("the member came to us"), but that left NO rate floor — a dismissed nudge
// regenerated on the very next dashboard load (treadmill). This is the floor: once we've surfaced an in-app nudge, we
// don't surface OR regenerate another for this many hours — at most ~one proactive in-app nudge a day.
export const IN_APP_COOLDOWN_HOURS = 20;

// ── Dial 2 · Quiet hours (timezone-aware; morning presence lands 7–9am) ──
export const DEFAULT_QUIET = { startHour: 21, endHour: 7 }; // 9pm–7am local, member-adjustable

// ── Dial 3 · Earned-plan threshold (Cycle 1): reflective-only until Rewire/Rebuild AND ≥1 session done in-phase ──
export const EARNED_PLAN = { phases: ['rewire', 'rebuild'] as const, minSessionsInPhase: 1 };

// ── Dial 5 · Discrepancy dosage: "light" — surface a Reclaim-goal gap at most once per touch, never twice running ──
export const DISCREPANCY = { maxPerTouch: 1, neverTwiceRunning: true };

// ── Dial 4 · Distress: mechanism scaffold ONLY. Content stays DARK until Greg + clinical/legal sign-off ──
export const DISTRESS = {
  live: false, // hard gate — never ships content until sign-off
  resource: '988', // directional default (Suicide & Crisis Lifeline), not shipped copy
  // Decision EEE additions (scaffold, not shipped): a front-end "not a counseling service" disclaimer + topic bounds.
  disclaimerNote: 'not a counseling service',
  topicBoundariesNote: 'defined boundaries — pending Greg + clinical/legal',
} as const;

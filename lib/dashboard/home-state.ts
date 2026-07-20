// The mobile HOME-STATE resolver (Mobile slice 1). The conversation-first mobile home is ONE shell flexed into eight
// states; this picks the state and its billboard from signals we ALREADY compute — it is NOT a parallel state machine:
//   • checkpoint / resume / practice  ← the desktop hero resolver (resolveHero / HeroState)
//   • morning / noticed / reengage    ← the governed outreach engine (a ready outreach nudge, by trigger)
//   • milestone                       ← a just-earned ceremonial badge (state built + tested; auto-trigger is a follow-up)
//   • quiet                           ← the light default (mobile = met, not nagged)
//   • distress                        ← detectCrisis in-conversation (dark scaffold; not resolved at home-load)
// Content stays the engine's job: the SEED (the opening Companion line) is the outreach nudge / a state prompt; the
// billboard is signature STYLE (a templated greeting/frame), never per-asset content. Copy here is PROVISIONAL — the
// terminology sweep owns the final member-facing words (build the structure, not the vocabulary).

import type { Db } from '../db/schema.ts';
import type { HeroState } from './resume-hero.ts';
import type { OutreachTrigger } from '../outreach/config.ts';
import { getOpenOutreach, getPref } from '../outreach/store.ts';
import { firstName } from '../member/avatar.ts';

export type Phase = 'reconnect' | 'rewire' | 'rebuild' | 'reclaim';
export type Tense = 'present' | 'practice' | 'reclaim'; // §5c accent register (grey · teal/olive · orange)
export type HomeStateKind = 'morning' | 'noticed' | 'reengage' | 'checkpoint' | 'resume' | 'practice' | 'quiet' | 'milestone';

export type HomeState = {
  kind: HomeStateKind;
  kicker: string | null; // eyebrow above the billboard headline
  headline: string; // the all-caps billboard signature line
  sub: string | null; // the sentence-case line under it
  cta: { label: string; href: string } | null; // pill — ONLY the action-pulling states (GGG)
  badge: boolean; // milestone medallion
  tense: Tense;
  seed: string | null; // the opening Companion thread line (engine-grounded when it's a nudge)
};

export type HomeInputs = {
  firstName: string;
  phase: Phase;
  phaseLabel: string;
  hero: HeroState;
  ctaHref: string; // the next-action route, computed once by the page (reused, not recomputed here)
  openOutreach: { trigger: OutreachTrigger; message: string } | null;
  milestone: { badgeName: string; href: string } | null;
  hourLocal: number; // 0–23, for the greeting
};

const TENSE: Record<Phase, Tense> = { reconnect: 'present', rewire: 'practice', rebuild: 'practice', reclaim: 'reclaim' };

function greeting(hourLocal: number, name: string): string {
  const part = hourLocal < 12 ? 'Good morning' : hourLocal < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name}.` : `${part}.`;
}

/** Pure: pick the home state + its billboard from the assembled signals. Priority: milestone > checkpoint > resume >
 *  practice > a ready outreach nudge > quiet. (distress is handled in-conversation, not at home-load.) */
export function resolveHomeState(i: HomeInputs): HomeState {
  const tense = TENSE[i.phase];
  const name = firstName(i.firstName);

  if (i.milestone) {
    return {
      kind: 'milestone', kicker: `A real one · ${i.phaseLabel}`, headline: 'You kept your word.',
      sub: `${i.milestone.badgeName} — earned.`, cta: { label: 'See your badges →', href: i.milestone.href },
      badge: true, tense, seed: "That's not a streak to protect — just proof it's becoming who you are.",
    };
  }
  if (i.hero.kind === 'checkpoint-ready') {
    return {
      kind: 'checkpoint', kicker: `${i.phaseLabel} · Checkpoint ready`, headline: "You've done the work.",
      sub: 'Ready for the checkpoint?', cta: { label: 'Begin the Checkpoint →', href: i.ctaHref },
      badge: false, tense, seed: 'The checkpoint is where it lands — take it when you’re ready; it holds until you are.',
    };
  }
  if (i.hero.kind === 'resume') {
    return {
      kind: 'resume', kicker: 'Pick up where you left off', headline: 'You were mid-session.',
      sub: 'Your words are saved.', cta: { label: 'Finish the session →', href: i.ctaHref },
      badge: false, tense, seed: 'Everything you said is kept. Want to finish it now, or come back to it later?',
    };
  }
  if (i.hero.kind === 'mid-week-practice') {
    return {
      kind: 'practice', kicker: `${i.phaseLabel} · this week`, headline: 'Keep the rhythm.',
      sub: 'No grade — just catching what happened.', cta: { label: 'Log today with me →', href: i.ctaHref },
      badge: false, tense, seed: 'How did today go? One honest note is plenty — a quiet day counts too.',
    };
  }
  if (i.openOutreach) {
    const t = i.openOutreach.trigger;
    if (t === 'pattern') {
      return { kind: 'noticed', kicker: 'A pattern, surfaced', headline: 'Something worth seeing.', sub: null, cta: null, badge: false, tense, seed: i.openOutreach.message };
    }
    if (t === 're_engagement') {
      return { kind: 'reengage', kicker: 'Welcome back', headline: "It's been a minute.", sub: 'No score to catch up.', cta: null, badge: false, tense, seed: i.openOutreach.message };
    }
    // morning_presence + everything else reflective → the daily "met" greeting, seeded by the nudge.
    return { kind: 'morning', kicker: i.phaseLabel, headline: greeting(i.hourLocal, name), sub: null, cta: null, badge: false, tense, seed: i.openOutreach.message };
  }
  // Nothing pressing — the lightest touch. The Companion does not nag; the field stays open.
  return {
    kind: 'quiet', kicker: null, headline: 'Nothing to chase today.', sub: 'And that counts too.',
    cta: null, badge: false, tense, seed: "A quiet day is part of the rhythm, not a gap in it — I'm here if you want me.",
  };
}

// The member's LOCAL hour for the greeting — from their outreach-pref timezone (Vercel runs UTC, so the server hour
// would greet wrong). Falls back to UTC if there's no timezone or the zone is bad.
function localHour(timezone: string | null, now: Date): number {
  if (!timezone) return now.getUTCHours();
  try {
    return Number(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(now));
  } catch {
    return now.getUTCHours();
  }
}

/** The thin loader — assembles the two signals the page doesn't already have (a ready outreach nudge + the member's
 *  timezone) and resolves the home state. Everything else (hero, name, phase, ctaHref, milestone) is passed by the
 *  page from data it already fetched, so this adds no duplicate reads. Degrades to quiet-safe defaults, never throws. */
export async function loadHomeState(
  db: Db,
  memberId: string,
  now: Date,
  page: { hero: HeroState; firstName: string; phase: Phase; phaseLabel: string; ctaHref: string; milestone: { badgeName: string; href: string } | null },
): Promise<HomeState> {
  const [open, pref] = await Promise.all([
    getOpenOutreach(db, memberId).catch(() => null),
    getPref(db, memberId).catch(() => null),
  ]);
  return resolveHomeState({
    firstName: page.firstName,
    phase: page.phase,
    phaseLabel: page.phaseLabel,
    hero: page.hero,
    ctaHref: page.ctaHref,
    openOutreach: open ? { trigger: open.trigger, message: open.message } : null,
    milestone: page.milestone,
    hourLocal: localHour(pref?.timezone ?? null, now),
  });
}

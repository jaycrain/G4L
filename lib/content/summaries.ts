// The member-facing "why this matters" content — one Session Summary per gated asset (short line at the threshold +
// full behind the "Why this matters" tap) and one Phase Summary per R (route-map header + phase-entry preview). This is
// the SINGLE SOURCE OF TRUTH for that copy: the canvas threshold, the Program "whole route", and the phase-entry beat
// all read it here, so they never drift and the terminology sweep is a one-file copy edit.
//
// Copy is VERBATIM from G4L_Session_Summaries_Finalized.md + G4L_Phase_Summaries.md (2026-07-20), voice-passed by Greg
// with the causality discipline intact ("research suggests… can/may", never a guarantee) — do NOT re-voice or soften.
// Member-facing LABELS are sweep-provisional (the Fade, the Spark space, Good Calls/False Starts, Quality Days, the
// Reclaim List): they live only as prose inside these strings, never as structural tokens — so the sweep edits words
// here without touching any wiring. "The Spark space" in particular is a placeholder and may change.

import type { SessionKey } from '../workspace/session-key.ts';

export type Summary = { short: string; full: string };

// The 12 gated assets. Reconnect holds three (R1 IDQ · R2 Doors · R3 Drift+Legacy); the practice phases are 1:1.
export type AssetId = 'r1' | 'r2' | 'r3' | 'w1' | 'w2' | 'w3' | 'b1' | 'b2' | 'b3' | 'c1' | 'c2' | 'c3';
export type PhaseKey = 'reconnect' | 'rewire' | 'rebuild' | 'reclaim';

export const ASSET_SUMMARIES: Record<AssetId, Summary> = {
  r1: {
    short: 'See how far you’ve drifted from yourself — a gap you can name is one you can close.',
    full: 'You rate yourself across the areas of your life, comparing where you are now to the fuller version of you that you remember. The point is a clear starting line — a clear look at the distance, in your own hand. Research suggests that measuring your present self against a self that matters to you can sharpen the motivation for the work ahead. Retake it later, and the space between the two readings becomes your own measuring stick.',
  },
  r2: {
    short: 'Name the doors your Fade came in through — most people walked through more than one.',
    full: 'The Fade rarely arrives all at once. It comes through doors — a relationship, a shrinking social world, autopilot, and others — usually several at the same time. Here you mark which ones are yours, then look at which opened first, which shaped you most, and which is still open. Research suggests people move through life change more steadily when they can put it in a clear story rather than carry it as fog. And in the Spark space, you’ll see these doors are a shared pattern.',
  },
  r3: {
    short: 'See your drift clearly, then put words to who you’re becoming.',
    full: 'Two moves in one. The Drift Quiz holds up a mirror to how the Fade shows up in small daily choices — a place to see patterns, with no wrong answers. Then the Legacy Letter turns you forward, to name the person you want to become and what the next chapter stands for. Research suggests we’re more motivated when we can picture our future self clearly, and that writing intentions down makes them stick. You keep the letter, and come back to it.',
  },
  w1: {
    short: 'Catch the reasonable-sounding stories that keep you stuck — and answer them.',
    full: 'You tell yourself things about why change can wait, why it’s not that serious, why it might be too late. They sound reasonable, which is exactly what makes them powerful. Here you bring those lines into the open and write stronger, truer ones to stand in their place. Research suggests the way you talk to yourself shapes your motivation and your staying power when things get hard. The work builds an inner voice that backs your effort.',
  },
  w2: {
    short: 'Build a picture of who you’re becoming vivid enough to pull you forward.',
    full: 'When the future stays vague, it’s easy to lose heart the first time results are slow. So here you build a clear, personal picture of where you’re headed, returning to the spark you named earlier to make it real. Research suggests people stay more committed when they can vividly imagine their future self and feel connected to it. A destination you can actually see gives your effort direction on the hard days.',
  },
  w3: {
    short: 'Learn to notice a slip early and clip back in fast.',
    full: 'Change gets messy, and a false start can feel like proof you’ve failed — which is usually right when people quit. This week teaches a steadier response: the False Start protocol prepares your comeback before you need it, and the mindfulness practice helps you catch stress, discouragement, and old habits before they take the wheel. Research suggests people do better when they know how to recover from a lapse and can watch themselves without piling on judgment. You build the skill to notice, reset, and keep going.',
  },
  b1: {
    short: 'Find the reasons to care for your body that actually last.',
    full: 'Guilt and pressure can get you moving, but if they are your sole driver, they run out fast. Research suggests people stay engaged when their motivation feels like their own. Here we’ll look underneath the “shoulds” for reasons personal to you. Your energy, health, freedom. The people you love. The life you want. Identifying them gives you real reasons to keep showing up.',
  },
  b2: {
    short: 'Take stock of the everyday skills that make change stick.',
    full: 'Motivation alone doesn’t create change. It’s the practical skills: planning, setting goals, handling barriers, tracking progress, recovering from setbacks, that make a difference. Here you’ll respond to statements that measure where your skills are strong and where they could grow. They’re sorted into three simple jobs: getting ready, taking action, and staying consistent. Research suggests lasting change leans on all three. You’ll come away with a map of what to build on and where support and practice can help.',
  },
  b3: {
    short: 'Watch your everyday choices for a week and learn how your lifestyle actually works.',
    full: 'This week, you’ll pick one small movement habit and one small eating habit to practice, then watch how they actually play out. It’s a week of just noticing. Research suggests self-monitoring sharpens your awareness and makes the next change more realistic. You can track the Good Calls, the False Starts, the obstacles you didn’t see coming, in your Movement screen. At the end of the week you’ll have a clearer picture of what helps, what gets in your way, and what to adjust.',
  },
  c1: {
    short: 'Revisit your Reclaim List now that you know yourself better.',
    full: 'The goals you named at the start aren’t always the ones that stay most meaningful once you’ve done the work. After looking hard at your identity, your patterns, and your habits, you revisit your Reclaim List — some goals now feel more real and more possible, others feel borrowed or vague. Research suggests goals hold best when they’re truly yours and fit who you’re becoming. You refine the list so your next moves are grounded in what actually matters to you.',
  },
  c2: {
    short: 'Check whether your world is getting bigger.',
    full: 'Struggle isn’t always loud — often it looks like a life quietly shrinking: pulling back, exploring less, imagining less. This is a look at the opposite. Is your world getting more open, more active, more connected, more full of what’s possible? Research suggests people do better when they stay engaged with what matters and keep moving toward a wider life. You come away with a clearer read on whether you’re reclaiming range and participation, not only progress.',
  },
  c3: {
    short: 'Track the days that feel like the life you’re building.',
    full: 'Wellness grows the way fitness does — out of ordinary days, one at a time. Here you track Quality Days: the days that reflect the life you’re building. You notice which choices and conditions make a day a good one, so you can repeat them on purpose. Research suggests that watching a process you care about sharpens your awareness and your consistency over time. It’s the same attention that builds fitness, turned toward how you actually want to live.',
  },
};

export const PHASE_SUMMARIES: Record<PhaseKey, Summary> = {
  reconnect: {
    short: 'Get clear about where you are, and remember the person you were before the Fade set in.',
    full: 'Here, you’ll explore where you are now and excavate who you were before. You’ll recognize events that opened Doors you came through that caused you to Fade from your true self. You’ll put words to the life you want to reclaim. And you’ll answer questions that measure the distance you need to close to get there. Go at your own pace, there are no right or wrong answers, only clarity.',
  },
  rewire: {
    short: 'Catch the stories your mind uses to keep you comfortable, and build ones you can act on.',
    full: 'Your mind has a script for staying stuck, and it sounds reasonable every time. Rewire is where you take that script apart. You catch the excuses and the quiet lies, write truer lines to stand in their place, build a vivid picture of who you’re becoming, and learn to recover fast when you slip. This is mindfulness with teeth — seeing what’s really running the show, so your effort stops arguing with an inside voice and starts working with one.',
  },
  rebuild: {
    short: 'Put focused effort into the body — small, real, repeatable.',
    full: 'Now the work turns to the body, and it stays grounded and small. You get clear on why this actually matters to you — the reasons that outlast guilt — take stock of the everyday skills that make change stick, and spend a week noticing how your real choices play out. No grand overhaul, nothing graded. Just the ordinary, repeatable moves that build fitness one decision at a time, with the mind-work from Rewire backing you up.',
  },
  reclaim: {
    short: 'Grow into a bigger life, and take back what the Fade shrank.',
    full: 'Reclaim is where it widens out. You revisit what you set out to take back — now that you know yourself better — and check that your world is genuinely getting bigger: more open, more connected, more alive. You track the days that feel like the life you’re building, so a good day becomes something you can repeat on purpose. This is the wellness the whole arc was pointing at: a life you’ve grown back into, and keep growing.',
  },
};

// The 1:1 practice sessions map straight to their asset. Reconnect spans three assets, so its threshold shows the
// PHASE summary (the intake as a whole); checkpoints (rewire-checkpoint · b4 · c4) are measurement gates with no
// "why this matters" of their own.
const SESSION_ASSET: Partial<Record<SessionKey, AssetId>> = {
  w1: 'w1', w2: 'w2', w3: 'w3',
  b1: 'b1', b2: 'b2', b3: 'b3',
  c1: 'c1', c2: 'c2', c3: 'c3',
};

const SESSION_PHASE: Partial<Record<SessionKey, PhaseKey>> = { reconnect: 'reconnect' };

/** The "why this matters" for a session threshold: the matching asset for a 1:1 session, the phase summary for the
 *  Reconnect intake, null for checkpoints. */
export function sessionSummary(key: SessionKey): Summary | null {
  const asset = SESSION_ASSET[key];
  if (asset) return ASSET_SUMMARIES[asset];
  const phase = SESSION_PHASE[key];
  if (phase) return PHASE_SUMMARIES[phase];
  return null;
}

/** The phase-level summary (route-map header · phase-entry preview · onboarding forecast). */
export function phaseSummary(phase: PhaseKey): Summary {
  return PHASE_SUMMARIES[phase];
}

// The member-facing "why this matters" content — one Session Summary per gated asset (short line at the threshold +
// full behind the "Why this matters" tap) and one Phase Summary per R (route-map header + phase-entry preview). This is
// the SINGLE SOURCE OF TRUTH for that copy: the canvas threshold, the Program "whole route", and the phase-entry beat
// all read it here, so they never drift and the terminology sweep is a one-file copy edit.
//
// Copy origin: G4L_Session_Summaries_Finalized.md + G4L_Phase_Summaries.md (2026-07-20), voice-passed by Greg with the
// causality discipline intact ("research suggests… can/may", never a guarantee) — do NOT re-voice or soften the `full`
// tap text. The `short` lines were reconciled to Donna's 7/28 Program-page rev (Jay-approved) so the canvas threshold,
// the Program route, the phase-entry beat, and the Companion all say the SAME wording (the Program page formats the
// asset shorts as "Name — …" bullets; here they're proper standalone sentences).
// Member-facing LABELS are sweep-provisional (the Fade, Good Calls/False Starts, Quality Days, the
// Reclaim List): they live only as prose inside these strings, never as structural tokens — so the sweep edits words
// here without touching any wiring.
//
// "The Spark space" is GONE (2026-08-07). R2 told members that in the Spark space they'd see the doors were a
// shared pattern — and there was no Spark space: no route, no screen, no table, one string in the entire app. It was
// a placeholder name that outlived the placeholder. What it described shipped as the Community, so R2 now points
// there. Greg's own R2 summary still names it twice; flagged to him.

import type { SessionKey } from '../workspace/session-key.ts';

export type Summary = { short: string; full: string };

// The 12 gated assets. Reconnect holds three (R1 IDQ · R2 Doors · R3 Drift+Legacy); the practice phases are 1:1.
export type AssetId = 'r1' | 'r2' | 'r3' | 'w1' | 'w2' | 'w3' | 'b1' | 'b2' | 'b3' | 'c1' | 'c2' | 'c3';
export type PhaseKey = 'reconnect' | 'rewire' | 'rebuild' | 'reclaim';

export const ASSET_SUMMARIES: Record<AssetId, Summary> = {
  r1: {
    short: 'Measure the distance between who you are and who you want to be.',
    // DONNA'S ORDER, 2026-08-30. Two changes, both hers, and both about a member knowing what is about to happen.
    // (1) The research line LEADS — why before what, so the first sentence earns the ask instead of issuing it.
    // (2) The format is NAMED: "answer a set of questions". Her note was "needs to explain that this is an
    // assessment"; Jay's ruling was to say ANSWERING QUESTIONS rather than "assessment" — same clarity without the
    // clinical register we avoid everywhere else. What she cut ("a clear starting line — an honest look at the
    // distance, in your own hand") was decoration that told her nothing she could act on.
    full: 'Research suggests that measuring your present self against a self that matters to you can sharpen motivation. Here you answer a set of questions, rating yourself across the areas of your life — where you are now, compared with the fuller version of you that you remember. Retake this later, and the space between the two readings becomes your own measuring stick.',
  },
  r2: {
    short: 'Identify the Doors you walked through that caused you to Fade.',
    full: 'The Fade rarely arrives all at once. It comes through doors — a relationship, a shrinking social world, autopilot, and others — usually several at the same time. Here you mark which ones are yours, then look at which opened first, which shaped you most, and which is still open. Research suggests people move through life change more steadily when they can put it in a clear story rather than carry it as fog. And in the Community, you’ll see these doors are a shared pattern.',
  },
  r3: {
    // ONE NOUN NOW, AND IT IS THE FADE (Jay, 2026-08-31, as brand owner). "drift" was reserved for the instrument
    // under the 2026-08-15 ruling; that carve-out is retired. His reasoning is a marketing one and it is the
    // right frame: we will never lead with "Drift" or with "the Mirror", so neither should hold a Session title.
    // Reconnect now reads IDQ - Excavation - The Fade: three proprietary terms and one plain one.
    //
    // GREG'S DOCUMENTS DO NOT CHANGE. The Drift Quiz is still his instrument name in the Science Check and both
    // memos - the same two-layer split we already run for R1, where his IDQ is now the member's Session name too.
    short: 'See your Fade clearly, then put words to who you’re becoming.',
    // The two names no longer meet, because there is only one. What this summary describes is unchanged -
    // seeing the distance plainly, then writing forward - it just says it in the Fade's own words.
    full: 'Two moves in one. First you look at how far the Fade has carried you — the small daily choices where the distance shows. A place to see the pattern plainly. Then the Legacy Letter turns you forward, to name the person you want to become and what the next chapter stands for. Research suggests we’re more motivated when we can picture our future self clearly, and that writing intentions down makes them stick. You keep the letter, and come back to it.',
  },
  w1: {
    short: 'Catch the reasonable-sounding lies that keep you stuck — and craft answers to dispel them.',
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
    short: 'Find your reasons to care for your body.',
    full: 'Guilt and pressure can get you moving, but if they are your sole driver, they run out fast. Research suggests people stay engaged when their motivation feels like their own. Here we’ll look underneath the “shoulds” for reasons personal to you. Your energy, health, freedom. The people you love. The life you want. Identifying them gives you real reasons to keep showing up.',
  },
  b2: {
    short: 'Evaluate your skills that can make change stick.',
    full: 'Motivation alone doesn’t create change. It’s the practical skills: planning, setting goals, handling barriers, tracking progress, recovering from setbacks, that make a difference. Here you’ll respond to statements that measure where your skills are strong and where they could grow. They’re sorted into three categories: Predisposing skills that help you get ready for change, Enabling skills that help you take action, and Reinforcing skills that help you stay consistent over time. Research suggests lasting change leans on all three. You’ll come away with a map of what to build on and where support and practice can help.',
  },
  b3: {
    short: 'Watch your everyday choices for a week and learn how your lifestyle actually works.',
    full: 'This week, you’ll pick one small movement habit and one small eating habit to practice, then watch how they actually play out. It’s a week of just noticing. Research suggests self-monitoring sharpens your awareness and makes the next change more realistic. You can track the Good Calls, the False Starts, the obstacles you didn’t see coming, in This week in your Playbook. At the end of the week you’ll have a clearer picture of what helps, what gets in your way, and what to adjust.',
  },
  c1: {
    short: 'Revisit your Reclaim List now that you know yourself better.',
    full: 'The goals you named at the start aren’t always the ones that stay most meaningful once you’ve done the work. After looking hard at your identity, your patterns, and your habits, you revisit your Reclaim List — some goals now feel sharper, some feel bigger than when you wrote them, others feel borrowed or vague. Research suggests goals hold best when they’re truly yours and fit who you’re becoming. You refine the list so your next moves are grounded in what actually matters to you.',
  },
  c2: {
    short: 'Check in on how your world has expanded from where you started.',
    full: 'Struggle isn’t always loud — often it looks like a life shrinking: pulling back, exploring less, imagining less. This is a look at the opposite. Is your world getting wider — more open, more willing, more connected to what matters? A bigger world doesn’t have to mean a busier one. Research suggests people do better when they stay engaged with what matters and keep moving toward a wider life. You come away with a clearer read on whether you’re reclaiming range and participation, not only progress.',
  },
  c3: {
    short: 'Track the days that feel like the life you’re building.',
    full: 'Wellness grows the way fitness does — out of ordinary days, one at a time. Here you track Quality Days: the days that reflect the life you’re building. You notice which choices and conditions make a day a good one, so you can repeat them on purpose. Research suggests that watching a process you care about sharpens your awareness and your consistency over time. It’s the same attention that builds fitness, turned toward how you actually want to live.',
  },
};

/**
 * WHAT A PHASE SUMMARY SAYS AT THE **CLOSE**, which is a different job from what it says at the open.
 *
 * Donna, 2026-08-30, at the end of the Reconnect Checkpoint: "This Why this Matters at the end of the Reconnect
 * Checkpoint is forecasting. Is it needed? If so, it needs to wrap up and speak in past tense of what just was
 * completed." She had already done all four things the opener promises her she will do.
 *
 * One asset was serving two moments with opposite needs. The opener keeps its job; this is the other half.
 *
 * PAST TENSE, AND ONLY WHAT SHE ACTUALLY DID. No forecast of the next phase — the Checkpoint's own reveal does
 * that — and no appraisal of how she did it.
 */
export const PHASE_CLOSES: Record<PhaseKey, string> = {
  reconnect:
    'You found the Doors that opened the distance, put words to what you want back, and measured how far it runs. ' +
    "That's your starting line.",
  rewire:
    'You caught the stories that run underneath, built a picture of who you are heading toward, and made three ' +
    'moves for when it slips. Those are yours now.',
  rebuild:
    'You named why this matters to you, took stock of the skills you have and the ones you are building, and ran ' +
    'a week on your own terms.',
  reclaim:
    'You read your list again as the person you are now, looked at how far your world has widened, and said what ' +
    'a good day is made of.',
};

export const PHASE_SUMMARIES: Record<PhaseKey, Summary> = {
  reconnect: {
    short: 'Think about who you were before life got in the way.',
    full: 'Here, you’ll explore where you are now and excavate who you were before. You’ll recognize events that opened Doors you came through that caused you to Fade from your true self. You’ll put words to the life you want to reclaim. And you’ll answer questions that measure the distance you need to close to get there. Go at your own pace — clarity is the whole point.',
  },
  rewire: {
    short: 'Rewire your brain to do the work. You’ll identify the stories your mind uses to keep you comfortable, and build new ones you can act on and effect change.',
    full: 'Your mind has a script for staying stuck, and it sounds reasonable every time. Rewire is where you take that script apart. You catch the excuses and the lies, write truer lines to stand in their place, build a vivid picture of who you’re becoming, and learn to recover fast when you slip. This is mindfulness with teeth — seeing what’s really running the show, so your effort stops arguing with an inside voice and starts working with one.',
  },
  rebuild: {
    short: 'A focus on your physical body and eating habits is an important part of increasing healthspan. Explore where you are right now, practice small, real, repeatable exercises that can get you there.',
    full: 'Now the work turns to the body, and it stays grounded and small. You get clear on why this actually matters to you — the reasons that outlast guilt — take stock of the everyday skills that make change stick, and spend a week noticing how your real choices play out. No grand overhaul, nothing graded. Just the ordinary, repeatable moves that build fitness one decision at a time, with the mind-work from Rewire backing you up.',
  },
  reclaim: {
    short: 'Grow into a bigger life as who you want to be.',
    full: 'Reclaim is where it widens out. You revisit what you set out to take back — now that you know yourself better — and check that your world is genuinely getting bigger: more open, more connected, more alive. You track the days that feel like the life you’re building, so a good day becomes something you can repeat on purpose. This is the wellness the whole arc was pointing at: a life you’ve grown back into, and keep growing.',
  },
};

// The 1:1 practice sessions map straight to their asset. Reconnect spans three assets, so its threshold shows the
// PHASE summary (the intake as a whole); checkpoints (rewire-checkpoint · b4 · c4) are measurement gates with no
// "why this matters" of their own.
const SESSION_ASSET: Partial<Record<SessionKey, AssetId>> = {
  // RECONNECT IS 1:1 NOW TOO (2026-08-28). r1/r2/r3 have had authored, Greg-voiced summaries in this file since
  // it was written — they were unreachable because Reconnect was a single session key with no threshold of its
  // own, so it fell through to the PHASE summary below. Splitting the phase into Sessions is what finally lets a
  // member see "why this matters" for the mirror, the Doors and the Drift Quiz separately, which is what the
  // authored copy was always for.
  r1: 'r1', r2: 'r2', r3: 'r3',
  w1: 'w1', w2: 'w2', w3: 'w3',
  b1: 'b1', b2: 'b2', b3: 'b3',
  c1: 'c1', c2: 'c2', c3: 'c3',
};

// The phase summary is now the CHECKPOINT's threshold — r4 recaps the whole of Reconnect, which is exactly what
// a phase summary says. The three Sessions each have their own asset summary above.
const SESSION_PHASE: Partial<Record<SessionKey, PhaseKey>> = { r4: 'reconnect' };

/** The "why this matters" for a session threshold: the matching asset for a 1:1 session, the phase summary for the
 *  Reconnect intake, null for checkpoints. */
export function sessionSummary(key: SessionKey): Summary | null {
  const asset = SESSION_ASSET[key];
  if (asset) return ASSET_SUMMARIES[asset];
  const phase = SESSION_PHASE[key];
  // A CHECKPOINT LOOKS BACK, SO ITS CARD DOES TOO (Jay's ruling, 2026-08-31).
  //
  // This returned the phase summary, which is written to OPEN a phase: "you'll explore... you'll recognize...
  // you'll put words... you'll answer questions". Rendered on the Checkpoint, it forecast four things she had
  // just spent an evening doing.
  //
  // Donna, 2026-08-30: "This Why this Matters at the end of the Reconnect Checkpoint is forecasting. Is it
  // needed? If so, it needs to wrap up and speak in past tense of what just was completed."
  //
  // One asset was serving two moments with opposite needs. `short` keeps the threshold line; `full` becomes the
  // past-tense close. The phase summary itself is untouched and still opens the phase.
  if (phase) return { short: PHASE_SUMMARIES[phase].short, full: PHASE_CLOSES[phase] };
  return null;
}

/** The phase-level summary (route-map header · phase-entry preview · onboarding forecast). */
export function phaseSummary(phase: PhaseKey): Summary {
  return PHASE_SUMMARIES[phase];
}

/** The asset a session maps to, for the tiers that hang off the same key (see content/explore.ts). */
export function sessionAsset(key: SessionKey): AssetId | undefined {
  return SESSION_ASSET[key];
}

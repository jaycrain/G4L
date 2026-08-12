// C2 · "The Bigger World Audit" — a facilitated interview over the IDQ's four domains (Greg's RECLAIM Gated Assets V4).
// For each domain the member gives five 1–10 ratings — Current, Desired, Importance, Readiness, Ripple — with Greg's
// VERBATIM prompts. The self-rated "how big does the gap feel" (Q3) is deliberately NOT one of these: per RC-1 the
// formula uses the COMPUTED gap (Desired − Current); the felt-gap stays a reflective moment (deferred to conversation).
// 4 domains × 5 ratings = 20 administered items, 1–10.

export type AuditDomain = 'physical' | 'self' | 'social' | 'outlook';
export type AuditFacet = 'current' | 'desired' | 'importance' | 'readiness' | 'ripple';
export type AuditItem = { code: string; domain: AuditDomain; facet: AuditFacet; prompt: string };

export const AUDIT_DOMAINS: readonly AuditDomain[] = ['physical', 'self', 'social', 'outlook'];
export const AUDIT_DOMAIN_LABEL: Record<AuditDomain, string> = { physical: 'Physical', self: 'Self', social: 'Social', outlook: 'Outlook' };
export const AUDIT_SCALE_MAX = 10;
export const AUDIT_FACETS: readonly AuditFacet[] = ['current', 'desired', 'importance', 'readiness', 'ripple'];

// Greg's verbatim per-domain rating prompts (Q1 Current, Q2 Desired, Q4 Importance, Q5 Readiness, Q6 Ripple).
const PROMPTS: Record<AuditDomain, Record<AuditFacet, string>> = {
  physical: {
    current: 'When you think about your physical life right now — your energy, sleep, movement, health habits, and how you’re treating your body — where would you rate yourself from 1 to 10?',
    desired: 'If 10 represents the physical version of you that feels strong, well-cared-for, and aligned with the life you want, where would you want to be?',
    importance: 'How important is it for you to close that physical gap right now, from 1 to 10?',
    readiness: 'How ready do you feel to work on this in the next 30 days, from 1 to 10?',
    ripple: 'If you made real progress here, how much would it improve other areas of your life — like mood, confidence, discipline, or relationships — from 1 to 10?',
  },
  self: {
    current: 'When you think about who you are being right now — your discipline, self-respect, emotional steadiness, and the way you carry yourself — where would you rate yourself from 1 to 10?',
    desired: 'If 10 represents the version of you that feels grounded, self-trusting, and fully aligned with who you want to be, where would you want to be?',
    importance: 'How important is it for you to reduce that gap right now, from 1 to 10?',
    readiness: 'How ready are you to actively work on this in the next 30 days, from 1 to 10?',
    ripple: 'If you improved in this area, how much would it positively affect the rest of your life, from 1 to 10?',
  },
  social: {
    current: 'When you look at your relationships and social world right now — how connected, supported, honest, and present you feel with other people — where would you rate yourself from 1 to 10?',
    desired: 'If 10 represents the kind of relationships and social presence you want to have, where would you want to be?',
    importance: 'How important is it for you to work on this area right now, from 1 to 10?',
    readiness: 'How ready are you to do something about this in the next 30 days, from 1 to 10?',
    ripple: 'If this area improved, how much would it strengthen other parts of your life, from 1 to 10?',
  },
  outlook: {
    current: 'When you think about your outlook right now — your sense of hope, direction, purpose, and belief in what’s possible — where would you rate yourself from 1 to 10?',
    desired: 'If 10 represents feeling clear, purposeful, forward-moving, and connected to a meaningful future, where would you want to be?',
    importance: 'How important is it for you to reduce that gap right now, from 1 to 10?',
    readiness: 'How ready do you feel to work on this in the next 30 days, from 1 to 10?',
    ripple: 'If this area improved, how much would it change other parts of your life, from 1 to 10?',
  },
};

// 20 items in administration order: domain by domain (Physical → Self → Social → Outlook), each domain's five facets.
export const AUDIT_ITEMS: AuditItem[] = AUDIT_DOMAINS.flatMap((domain) =>
  AUDIT_FACETS.map((facet): AuditItem => ({ code: `BWA-${domain}-${facet}`, domain, facet, prompt: PROMPTS[domain][facet] })),
);

export const AUDIT_ITEM_COUNT = AUDIT_ITEMS.length; // 20
// 0-based indices where each domain begins (drives the domain-header frame between clusters): 0, 5, 10, 15.
export const AUDIT_DOMAIN_STARTS: Record<number, AuditDomain> = { 0: 'physical', 5: 'self', 10: 'social', 15: 'outlook' };

// The per-domain "what this area means" one-liners (Greg's domain definitions, condensed) — shown with the header.
export const AUDIT_DOMAIN_INTRO: Record<AuditDomain, string> = {
  physical: 'Your body — energy, movement, health habits, how you’re treating yourself.',
  self: 'Who you’re being — discipline, self-respect, steadiness, self-trust.',
  social: 'Your relationships — connection, belonging, presence with others.',
  outlook: 'Your outlook — hope, direction, purpose, belief in what’s possible.',
};

// ═══ THE REFLECTION HALF (V4 Q3 / Q7 / Q8, plus Audit Step 2) ════════════════════════════════════════════════
//
// The header of this file used to say the felt-gap was "deferred to conversation". It was — along with Q7 and Q8
// and the whole cross-domain sort, and the deferral outlived its note: it hardened into a belief that C2 was
// unbuilt, which reached Greg in an email telling him we hadn't implemented his PriorityScore. We had, on 9 July,
// to the letter. What we had NOT built was this half — the part that makes C2 a facilitated audit rather than a
// rating exercise (Jay, 2026-08-09: "Cycle 1 needs to mean something, and every member, charter to 10,000, is
// most likely going to use it").
//
// Everything here is Greg's wording. Two deliberate normalisations, both worth knowing:
//
//  1. His sub-issue lists trail off inconsistently — "Other?", "Other…", "No", "No…" — because they were written
//     as a designer's shorthand, not as UI. We render only the NAMED issues as chips and let the member write
//     their own or move on; "Other" and "No" are what the free text and the skip already are. Adding chips that
//     mean "none of these" invites a tap that says nothing.
//  2. Q3 in V4 is one prompt carrying two asks (the open reflection AND the checklist). We keep it as one turn
//     with both, rather than splitting it — splitting would add four more turns to an activity Greg budgeted at
//     fifteen minutes.

/** The named sub-issues Greg lists under each domain's Q3. Chips; the member may also write their own, or skip. */
export const AUDIT_SUB_ISSUES: Record<AuditDomain, readonly string[]> = {
  physical: ['Weight status', 'Strength', 'Endurance', 'Balance', 'Nutrition', 'Sleep'],
  self: ['Discipline', 'Focus'], // V4: "Discipline", "Inability to Focus" — stated as the thing, not the lack
  social: ['Spouse', 'Children', 'Friend', 'Coworker'],
  outlook: ['Visioning', 'Finding purpose', 'Mindfulness'],
};

export type AuditReflectionKind = 'gap' | 'obstacle' | 'action';

/** Greg's Q3 / Q7 / Q8, verbatim, per domain. */
export const AUDIT_REFLECTION_PROMPTS: Record<AuditDomain, Record<AuditReflectionKind, string>> = {
  physical: {
    gap: 'What feels like the biggest difference between where you are now and where you want to be physically?',
    obstacle: 'What tends to keep this gap in place?',
    action: 'What is one small change that would begin moving this area in the right direction?',
  },
  self: {
    gap: 'What feels most out of alignment between your current self and your desired self?',
    obstacle: 'What most often pulls you away from being the person you want to be?',
    action: 'What is one behavior or practice that would help you feel more aligned with yourself this week?',
  },
  social: {
    gap: 'What feels like the biggest gap between the social life you have and the social life you want?',
    obstacle: 'What tends to get in the way here?',
    action: 'What is one action that could begin improving this area soon?',
  },
  outlook: {
    gap: 'What feels most missing right now between where you are and where you want to be in your outlook?',
    obstacle: 'What most keeps you stuck or foggy here?',
    action: 'What is one step that would help you feel more forward-moving?',
  },
};

/** The second half of Q3 — the invitation to name specifics. Greg's phrasing varies by domain; kept. */
export const AUDIT_SUB_ISSUE_ASK: Record<AuditDomain, string> = {
  physical: 'Any specific issues? Pick the ones that feel most important — or tell me in your own words.',
  self: 'Anything specific that you think is a priority?',
  social: 'Any specific issue or relationship that you want to focus on?',
  outlook: 'Anything specific?',
};

// ═══ AUDIT STEP 2 — cross-domain priority sorting ════════════════════════════════════════════════════════════
//
// Asked once, after all four domains. Note what these are: FOUR of them ask the member to say in words what the
// ratings already compute (most costly, most important, most ready, biggest ripple). That is not redundancy to
// engineer away — it is the member reading their own numbers back and deciding. Where the two disagree, the
// member's answer wins and the arithmetic is shown as reflection, never as correction (Jay, 2026-08-09). A
// program whose whole posture is "never a verdict" cannot then tell a member their own priority is wrong.
export type AuditSortKey = 'costliest' | 'identity' | 'readiest' | 'ripple' | 'focus';

export const AUDIT_SORT_QUESTIONS: { key: AuditSortKey; prompt: string }[] = [
  { key: 'costliest', prompt: 'Looking across these four areas, which gap feels most painful or costly to leave unaddressed?' },
  { key: 'identity', prompt: 'Which area feels most important to your identity right now?' },
  { key: 'readiest', prompt: 'Which area are you actually most ready to work on, even if it isn’t the biggest gap?' },
  { key: 'ripple', prompt: 'Which area, if it improved, would create the biggest ripple effect in the rest of your life?' },
  // THE DECIDING ONE. `focus` is what becomes First Focus, and therefore which domain's obstacle and early action
  // become Key Obstacle and First Action in the close.
  { key: 'focus', prompt: 'If you could make meaningful progress in only one area over the next 30 days, which one would you choose?' },
];

/**
 * The four areas, written out. ONE source — the Step 2 intro says them and the sort's re-ask says them, and a rule
 * restated at two call sites is one wrong copy waiting to happen.
 */
export const domainList = (conj: 'and' | 'or'): string => {
  const names = AUDIT_DOMAINS.map((d) => AUDIT_DOMAIN_LABEL[d]);
  return `${names.slice(0, -1).join(', ')}, ${conj} ${names.at(-1)}`;
};

// Greg's two sentences, verbatim, plus one line NAMING the four again.
//
// Step 2 asks "looking across these four areas" — roughly thirty questions after the only place they were named.
// Jay, who designed the program, could not recall them at that point ("need the 4 areas resurfaced, hell I couldn't
// remember them", 2026-08-11), and answered the first sort question by asking what they were. Nothing is added to
// or taken from his items; the member is just told again what they are being asked to choose between.
export const AUDIT_SORT_INTRO =
  'Now that we’ve looked at all four areas, we can try to find some synergies and priorities. The goal is not to fix ' +
  'everything at once but to identify what matters most right now and where progress would create the biggest shift.' +
  `\n\nThe four areas, again: ${domainList('and')}.`;

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

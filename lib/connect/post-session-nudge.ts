// THE MOMENT AFTER A SESSION — pointing a member at a real person.
//
// WHY THIS EXISTS, AND WHY IT IS NOT A "JOIN THE COMMUNITY" BANNER (Jay, 2026-08-17):
//
//   "We want to emphasize the human side that exists on the app. And it's a credibility builder for the Companion
//    to encourage human interaction. Loss of connection is a huge factor in midlife loneliness and identity loss."
//
// That is the Companion's own north star made operational — CLAUDE.md: get them honest with themselves "in service
// of bridging them toward real people — never to replace them." A member has just spent twenty minutes in the most
// private conversation they have, and the honest next move is outward.
//
// SO IT NAMES A PERSON, NOT A PLACE. A generic invitation is a pitch, and a pitch from the Companion spends
// exactly the credibility this exists to build (pillar3-recommend-from-real-interactions: nudges are evidence-based
// and cite their basis, never sell). Every nudge below is a fact about someone who is ALREADY in relationship with
// them, drawn from state we already hold — and when there is no such fact, it says so by returning null.
//
// THE ORDER IS THE ARGUMENT. Strongest connective pull first:
//   1. A PACT GOING QUIET — another member is holding them to something they said they wanted back. A person is
//      waiting. Nothing else in the product is as strong as that, and it decays: the longer it is untouched the
//      more it becomes a small failure rather than a tie, so it leads.
//   2. SOMEONE ANSWERED THEM — a human already reached toward them and they may not know. Costs them nothing to
//      receive, and it is evidence the room is not empty.
//   3. THEY HAVE POSTED BUT GONE QUIET — they know how this works; no explanation needed.
//   4. NO FOOTPRINT AT ALL — the one genuine invitation, offered on the back of what they just did in the Session.
//
// (4) IS THE FRAGILE ONE and it is deliberately last. Jay, same conversation: the Community will be thin at
// launch, and they will seed it personally to start the flywheel. That is what makes (4) honest — there IS someone
// to meet. If that changes, (4) is the one to gate, not the others: (1)-(3) name things that already happened and
// are true at any size.

import type { ConnectAgentSummary } from './agent.ts';
import { topicForSession } from './session-topics.ts';

export type PostSessionNudge = {
  /** Which shape fired — for telemetry and for the tests that pin the ordering. */
  kind: 'pact_quiet' | 'reply_waiting' | 'posted_before' | 'first_step';
  /** One line, in the Companion's voice. Never a headline, never a CTA shout. */
  text: string;
  /** The button. Plain verb; the line above carries the reason. */
  cta: string;
  href: string;
};

/** A pact untouched this long has stopped being a tie and started being a small guilt. Before that, leave it be. */
const PACT_QUIET_DAYS = 3;

/**
 * Resolve the nudge for this member, or null.
 *
 * NULL IS A REAL ANSWER and the most important one to get right. If nothing true can be said, the member finishes
 * their Session and is left alone — which is better than a manufactured prompt, and is the difference between a
 * companion that notices and a product that nags. A member with an active pact they touched yesterday, no unread
 * replies and a fresh post has nothing here; that is success, not a gap.
 */
// THE LINK IS BUILT ONCE, HERE. Every href below was the bare string '/connect', which is not a page: the route
// is /connect/[memberId], so all four nudges 404'd for every member, every time. Donna hit it on the first
// complete four-R walk (2026-08-19) — the one moment in the product whose entire job is to point someone at a
// real person, and it led nowhere.
//
// Taking memberId as an argument rather than letting the four call sites each append it: a rule restated at N
// sites has N-1 wrong copies, and this bug IS that rule, four times over.
function connectHref(memberId: string): string {
  return `/connect/${memberId}`;
}

/** The seeded topic's own URL. Resolved by session key so the link survives the post being re-seeded. */
function topicHref(memberId: string, sessionKey: string): string {
  return `/connect/${memberId}?topic=${encodeURIComponent(sessionKey)}`;
}

export function postSessionNudge(
  c: ConnectAgentSummary | null | undefined,
  memberId: string,
  /** The Session just finished. When it has a seeded topic, the nudge lands on THAT rather than the room. */
  sessionKey?: string | null,
): PostSessionNudge | null {
  if (!c) return null;

  // POINT AT THE THREAD, NOT THE ROOM (Jay, 2026-08-21).
  //
  // All four nudges used to resolve to `/connect/{memberId}` — the front page. So a member who had just built a
  // False Start Protocol was told "there are people here doing this at the same time as you", tapped Look in, and
  // arrived at a general feed with nothing about false starts on it. The invitation was true and the destination
  // made it feel untrue, which is worse than not asking.
  //
  // The topic is the same for everyone who finishes that Session, which is the point: she arrives where the other
  // people who just did this work are. Falls back to the room when a Session has no topic yet, so adding one is
  // additive and forgetting one is harmless.
  const topic = topicForSession(sessionKey);
  const href = topic ? topicHref(memberId, topic.sessionKey) : connectHref(memberId);

  // 1 — a person is waiting, and it is tied to something they said they wanted back.
  const quiet = c.pacts
    .filter((p) => p.lastCheckinDays != null && p.lastCheckinDays >= PACT_QUIET_DAYS)
    .sort((a, b) => (b.lastCheckinDays ?? 0) - (a.lastCheckinDays ?? 0))[0];
  if (quiet) {
    // Their commitment, their words. "Holding" means the OTHER person is carrying it for them, which is the more
    // affecting direction and worth saying differently.
    const what = quiet.reclaimItem || quiet.commitment;
    const line =
      quiet.direction === 'holding'
        ? `${quiet.other} is holding you to ${what}. It's been ${quiet.lastCheckinDays} days since you two checked in.`
        : `You told ${quiet.other} you'd ${what}. It's been ${quiet.lastCheckinDays} days since you checked in.`;
    return { kind: 'pact_quiet', text: line, cta: 'Check in', href };
  }

  // 2 — someone already reached toward them. UNREAD only: telling them about a reply they have read is the
  // product padding its own numbers.
  const unread = c.recentEngagement.filter((e) => e.unread);
  if (unread.length) {
    const e = unread[0]!;
    const line =
      unread.length > 1
        ? `${unread.length} people responded to what you wrote.`
        : e.kind === 'reply'
          ? `${e.actor} replied to what you wrote about ${e.postLabel}.`
          : `${e.actor} saw what you wrote about ${e.postLabel}.`;
    return { kind: 'reply_waiting', text: line, cta: 'Go read it', href };
  }

  // 3 — they know how this works. No explaining, no re-selling.
  if (c.ownRecentPosts.length) {
    return {
      kind: 'posted_before',
      text: 'Anything from today worth putting in front of the others?',
      cta: 'Open the Community',
      href,
    };
  }

  // 4 — never been. The only one that has to earn the ask, so it is the plainest.
  if (!c.hasPresence) {
    return {
      kind: 'first_step',
      text: 'There are people here doing this at the same time as you. You can read without saying anything.',
      cta: 'Look in',
      href,
    };
  }

  return null;
}

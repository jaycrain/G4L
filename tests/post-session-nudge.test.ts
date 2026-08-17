import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postSessionNudge } from '../lib/connect/post-session-nudge.ts';
import type { ConnectAgentSummary } from '../lib/connect/agent.ts';

// The moment after a Session, pointing a member at a real person rather than at a place. Jay, 2026-08-17: "a
// credibility builder for the Companion to encourage human interaction. Loss of connection is a huge factor in
// midlife loneliness and identity loss." These tests hold the two things that make it credible rather than a
// pitch: every nudge names something that ALREADY happened, and when nothing has, it says nothing.

const base: ConnectAgentSummary = {
  handle: null, nameRevealed: false, unreadCount: 0,
  recentEngagement: [], ownRecentPosts: [], pacts: [], hasPresence: false,
};

test('a member with a live, recently-tended pact gets NOTHING — silence is a real answer', () => {
  // The most important case. A companion that notices is one that can also leave you alone; a product that always
  // has something to say is nagging. Nothing true to report → the Session just ends.
  const c: ConnectAgentSummary = {
    ...base, hasPresence: true, ownRecentPosts: ['x'],
    pacts: [{ direction: 'i_committed', commitment: 'walk', other: 'Sarah', reclaimItem: null, lastCheckinDays: 1 }],
  };
  // They posted recently, so the 'posted_before' invitation is the most it can offer — never a manufactured pact line.
  assert.notEqual(postSessionNudge(c)?.kind, 'pact_quiet');
  assert.equal(postSessionNudge(null), null, 'no Community state at all → nothing');
  assert.equal(postSessionNudge({ ...base, hasPresence: true }), null, 'a footprint but nothing to say → nothing');
});

test('a QUIET PACT leads — a person is waiting, tied to what they said they wanted back', () => {
  const c: ConnectAgentSummary = {
    ...base, hasPresence: true,
    unreadCount: 2,
    recentEngagement: [{ actor: 'Mark', kind: 'reply', postLabel: 'the mornings', unread: true }],
    ownRecentPosts: ['x'],
    pacts: [{ direction: 'i_committed', commitment: 'walk daily', other: 'Sarah', reclaimItem: 'ride the loop again', lastCheckinDays: 5 }],
  };
  const n = postSessionNudge(c)!;
  assert.equal(n.kind, 'pact_quiet', 'outranks an unread reply — nothing pulls harder than someone waiting');
  assert.match(n.text, /Sarah/);
  assert.match(n.text, /ride the loop again/, 'named with THEIR reclaim item, not the generic commitment');
  assert.match(n.text, /5 days/);
});

test('"holding" reads differently from "I committed" — the other person is carrying it', () => {
  const c: ConnectAgentSummary = {
    ...base, hasPresence: true,
    pacts: [{ direction: 'holding', commitment: 'the morning walk', other: 'Dana', reclaimItem: null, lastCheckinDays: 4 }],
  };
  assert.match(postSessionNudge(c)!.text, /Dana is holding you to the morning walk/);
});

test('a pact touched yesterday is left alone — a tie only becomes a guilt once it goes quiet', () => {
  const c: ConnectAgentSummary = {
    ...base, hasPresence: true,
    pacts: [{ direction: 'i_committed', commitment: 'walk', other: 'Sarah', reclaimItem: null, lastCheckinDays: 1 }],
  };
  assert.equal(postSessionNudge(c), null);
});

test('an UNREAD reply is surfaced; a read one is not', () => {
  const unread: ConnectAgentSummary = {
    ...base, hasPresence: true,
    recentEngagement: [{ actor: 'Mark', kind: 'reply', postLabel: 'the mornings', unread: true }],
  };
  assert.match(postSessionNudge(unread)!.text, /Mark replied to what you wrote about the mornings/);

  const read: ConnectAgentSummary = {
    ...base, hasPresence: true,
    recentEngagement: [{ actor: 'Mark', kind: 'reply', postLabel: 'the mornings', unread: false }],
  };
  // Telling someone about a reply they already read is the product padding its own numbers.
  assert.equal(postSessionNudge(read), null);
});

test('the cold invitation fires ONLY for someone with no footprint, and never sells', () => {
  const n = postSessionNudge(base)!;
  assert.equal(n.kind, 'first_step');
  assert.match(n.text, /read without saying anything/, 'the ask is as small as it can be');
  assert.doesNotMatch(n.text, /join|community is|connect with|share your/i, 'names what is there — never a pitch');
});

test('NO NUDGE EVER INVENTS A PERSON OR AN EVENT', () => {
  // The whole credibility argument in one assertion: every line that fires must be traceable to state we hold.
  // A member with an empty summary gets the invitation, which claims nothing about anyone in particular.
  for (const c of [base, { ...base, hasPresence: true }]) {
    const n = postSessionNudge(c);
    if (n) assert.doesNotMatch(n.text, /\b(replied|holding|days since|responded)\b/, 'no event claimed without one');
  }
});

test('THE SEAM — the nudge is resolved on the server and rendered above Continue', async () => {
  // A resolver nobody calls is the failure mode this project keeps hitting. And placement is load-bearing here:
  // Donna asked for it to be prominent "so it actually stands out and doesn't get skipped", and below the
  // Continue button it is a footnote nobody reads.
  const { readFileSync } = await import('node:fs');
  const page = readFileSync('app/workspace/[memberId]/[sessionKey]/page.tsx', 'utf8');
  assert.match(page, /postSessionNudge\(await getConnectSummaryForAgent\(db, memberId\)/, 'resolved server-side');
  assert.match(page, /nudge=\{nudge\}/, 'and handed to the session');

  const view = readFileSync('app/workspace/workspace-session.tsx', 'utf8');
  const humanAt = view.indexOf('ws-endcard-human');
  const ctaAt = view.indexOf('ws-endcard-cta');
  assert.ok(humanAt > 0 && ctaAt > 0, 'both render');
  assert.ok(humanAt < ctaAt, 'the human step comes BEFORE Continue — after it, nobody reads it');
});

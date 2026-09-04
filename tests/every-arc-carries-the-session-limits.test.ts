// THE RULES REACH ALL FOUR ARCS, OR THEY REACH NONE OF THEM RELIABLY.
//
// SESSION_LIMITS is the short list of things a Companion cannot do from inside a Session and what to say instead —
// it cannot change the member's record, it must never route them to a team that does not exist, and it must never
// promise that someone will act on something later. Rebuild, Rewire and Reclaim have carried it since it was
// written. RECONNECT NEVER DID.
//
// So the longest Session in the product — the Doors, where two testers have now each spent over an hour — was the
// one with none of these rules. It surfaced on 2026-09-04. Jennifer, 113 messages into Excavation:
//
//     "We have already discussed Full House. Would like to see the letter you mentioned drafting."
//
// The Legacy Letter belongs to The Fade, two beats later, and its authored mention had been REMOVED from this
// Session the day before — for Donna, who hit exactly the same thing. The copy fix held. The model said it anyway,
// because nothing in this arc told it not to.
//
// TWO LESSONS, and the second is the one that generalises:
//   · Deleting a line from the script does not stop the model saying the line. A behaviour needs a RULE.
//   · A rule that lives in three of four places is a rule with a hole in it, and the hole is always found by a
//     member rather than by us. [[one-fact-many-sites]]
//
// This test is the cheap thing that would have caught it: every arc's system prompt must carry the limits.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { SESSION_LIMITS } from '../lib/agent/session-limits.ts';

/** The four phase arcs. Each composes its own system prompt; each must append the shared limits. */
const ARCS = ['reconnect.ts', 'rewire.ts', 'rebuild.ts', 'reclaim.ts'];

test('every phase arc carries SESSION_LIMITS in its system prompt', () => {
  const missing: string[] = [];
  for (const f of ARCS) {
    const src = readFileSync(new URL(`../lib/agent/${f}`, import.meta.url), 'utf8');
    // REFERENCED, not interpolated. My first version matched only `${SESSION_LIMITS}` and reported the three
    // arcs that had carried it for weeks as missing — they append it with `+ SESSION_LIMITS`. A detector that
    // only knows one spelling is the same fault this file is about.
    if (!/\bSESSION_LIMITS\b/.test(src)) missing.push(f);
  }
  assert.deepEqual(missing, [],
    `these arcs do not carry the Session limits — a Companion there can promise a team, or an artifact from a `
    + `later Session, with nothing to stop it: ${missing.join(', ')}`);
});

// NOT EVERY SYSTEM PROMPT IS A SESSION. These build one and are deliberately outside the rule, with the reason
// on the line — an exclusion without a reason is how a real arc eventually hides inside one.
const NOT_A_SESSION: Record<string, string> = {
  'onboarding.ts': 'intake — there is no member record to protect yet, and no later Session to promise from',
  'onboarding-staged.ts': 'the same intake, staged engine',
  'playbook-synthesis.ts': 'a background synthesis pass; it never speaks to a member',
};

test('AND A NEW ARC CANNOT SKIP IT — the candidate list is derived, not hand-kept', () => {
  // The failure mode of the test above is a FIFTH phase appearing and nobody adding it. So the candidates come
  // from disk: anything building a system prompt on MEMBER_AGENT_SYSTEM_PROMPT is either a phase arc that must
  // carry the limits, or an explicitly excused exception.
  const dir = readdirSync(new URL('../lib/agent', import.meta.url).pathname);
  const builds = dir.filter((f) => {
    if (!f.endsWith('.ts')) return false;
    const src = readFileSync(new URL(`../lib/agent/${f}`, import.meta.url), 'utf8');
    return /[A-Z_]+_SYSTEM\s*=\s*`\$\{MEMBER_AGENT_SYSTEM_PROMPT\}/.test(src);
  });
  const unaccounted = builds.filter((f) => !ARCS.includes(f) && !(f in NOT_A_SESSION));
  assert.deepEqual(unaccounted, [],
    `builds a member-facing system prompt and is neither a listed arc nor an excused exception: ${unaccounted.join(', ')}`);
});

test('the limits actually forbid promising a later Session\'s artifact', () => {
  // The specific hole Jennifer fell into. Asserted on the text because the rule IS the text — it is what the
  // model reads, and a rule nobody can find in the prompt is not in force.
  assert.match(SESSION_LIMITS, /NEVER OFFER TO START, DRAFT OR SHOW SOMETHING A LATER SESSION MAKES/);
  assert.match(SESSION_LIMITS, /Legacy Letter is written in The Fade/);
  // And the older rule it sits beside is still there — this must not have replaced it.
  assert.match(SESSION_LIMITS, /Never promise that anyone will act on something later/);
  assert.match(SESSION_LIMITS, /NEVER route them to a team/);
});

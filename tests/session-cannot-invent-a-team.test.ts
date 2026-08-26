// THE COMPANION MUST NOT INVENT AN ESCALATION CHANNEL.
//
// Jay, mid-Rewire 2026-08-25, asked it to add Big Sugar to his Reclaim List:
//
//   "I wish I could update your list directly — that's not something I'm able to do from here, but flag it with
//    the G4L team and they'll get it added for you."
//
// There is no G4L team. It invented a support channel, committed someone else to acting, and left a member
// waiting for something that is never coming.
//
// THE CAUSE IS STRUCTURAL, AND ONLY HALF-FIXED HERE. Reconnect prepends MEMBER_AGENT_SYSTEM_PROMPT — the block
// written after the last improvisation of this kind. Rewire, Rebuild and Reclaim do not, so in three of four
// phases the Companion runs with no authorised answers and fills the gap itself. Prepending the whole block to
// six live capture prompts is Jay's call; this asserts the narrow guard that ships now.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SESSION_LIMITS } from '../lib/agent/session-limits.ts';

const ARCS = ['rewire.ts', 'rebuild.ts', 'reclaim.ts'];
const src = (f: string) => readFileSync(new URL(`../lib/agent/${f}`, import.meta.url), 'utf8');

test('EVERY Session system prompt carries the limits', () => {
  const missing: string[] = [];
  for (const f of ARCS) {
    const s = src(f);
    for (const m of s.matchAll(/^(?:export )?const ([A-Z0-9_]+_SYSTEM) =\n((?:.*\n)*?.*?);$/gm)) {
      if (!m[2]!.includes('SESSION_LIMITS')) missing.push(`${f}: ${m[1]}`);
    }
  }
  assert.deepEqual(missing, [], `a Session prompt runs with no stated limits:\n${missing.join('\n')}`);
});

test('the limits name the real destinations and forbid the invented one', () => {
  assert.match(SESSION_LIMITS, /Reclaim List/, 'must name where a want actually goes');
  assert.match(SESSION_LIMITS, /dashboard/i, 'the dashboard Companion is the one that CAN add a Reclaim item');
  assert.match(SESSION_LIMITS, /NEVER route them to a team/i);
  // The specific phrase he was given, so this test fails if anyone ever re-authorises it.
  assert.match(SESSION_LIMITS, /G4L team/, 'name the invented channel so the prohibition is unambiguous');
});

test('no arc AUTHORS a support channel in its own copy', () => {
  // The instruction guards what the model improvises. This guards what we write ourselves.
  const offenders: string[] = [];
  for (const f of [...ARCS, 'reconnect.ts', 'onboarding-staged.ts']) {
    for (const [i, line] of src(f).split('\n').entries()) {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue; // a rule may quote what it bans
      if (/\b(the G4L team|our team|support team|the team will)\b/i.test(line)) offenders.push(`${f}:${i + 1}`);
    }
  }
  assert.deepEqual(offenders, [], `authored copy promises a team:\n${offenders.join('\n')}`);
});

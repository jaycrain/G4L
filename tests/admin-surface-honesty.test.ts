import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// THE RULE THIS PROTECTS (2026-07-31, after Jay asked about a column heading):
// an operator surface must never present a metric that CANNOT be true, or one the member's own view hides.
//
// Three metrics were doing exactly that — Beats (no member on production can close one; the v3.0 redesign
// removed the surface), Daily Beat days (counted days we SHOWED a panel that no longer renders), and workouts
// (Strava is unset, so structurally 0). I removed them from the roster's COLUMNS and called it fixed; the
// queries kept running and the same untrue numbers simply moved to the member subpage. A display change
// presented as a data fix.
//
// So this tests the SOURCE, not one page's markup. A future surface can't reintroduce them by accident,
// because there is nothing left to read.

const roster = readFileSync('lib/admin/roster.ts', 'utf8');
const subpage = readFileSync('app/admin/member/[memberId]/page.tsx', 'utf8');
const adminPage = readFileSync('app/admin/page.tsx', 'utf8');

// Strip comments — this file's own explanations name these terms deliberately, and so do the sources'.
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the admin data layer no longer QUERIES a metric that cannot be true', () => {
  const c = code(roster);
  assert.doesNotMatch(c, /from beat_completion/, 'Beats: no member on prod can close one — do not count them');
  assert.doesNotMatch(c, /from daily_beat_log/, 'Daily Beat days measured OUR behaviour, not the member’s');
  assert.doesNotMatch(c, /from activity_event/, 'workouts is structurally 0 while Strava is unset');
});

test('no admin surface RENDERS the retired metrics', () => {
  for (const [name, src] of [['member subpage', subpage], ['founder dashboard', adminPage]] as const) {
    const c = code(src);
    // Guard BOTH shapes. The first version of this test only knew about usage.* — so two whole telemetry
    // blocks reading experience.beats / experience.dailyBeat survived the sweep and shipped. A guard that
    // knows one spelling of a thing gives false confidence about the other.
    assert.doesNotMatch(c, /usage\.beats|usage\.dailyBeatDays|usage\.workouts|lastBeatAt/, `${name} still renders a retired metric (usage.*)`);
    assert.doesNotMatch(c, /experience\.beats|experience\.dailyBeat/, `${name} still renders a retired metric (experience.*)`);
    assert.doesNotMatch(c, /Gates crossed/, `${name} still uses "Gates" — internal jargon, and a count says nothing`);
  }
});

test('"Journey" is not used as a label — it was relegated in favour of Comeback', () => {
  for (const [name, src] of [['member subpage', subpage], ['founder dashboard', adminPage]] as const) {
    assert.doesNotMatch(code(src), /<strong>Journey:/, `${name} re-elevates retired vocabulary`);
  }
});

test('the member subpage shows the LIVE Reclaim List — the one thing you read before writing to someone', () => {
  // It had every metric about a member and not the thing they said they wanted back.
  assert.match(subpage, /getReclaimItems/, 'the live list must be fetched, not just the frozen onboarding card');
  assert.match(subpage, /Their Reclaim List/, 'and rendered');
  // And it must sit ABOVE the draft box, which is the whole point of putting it there.
  assert.ok(
    subpage.indexOf('Their Reclaim List') < subpage.indexOf('Generate a message'),
    'the Reclaim List must come BEFORE the draft box — it is what you read before writing',
  );
});

test('no operating moment drafts a message about a mechanic that is not live', () => {
  const draft = code(readFileSync('lib/founder/draft.ts', 'utf8'));
  // 'cycle2_welcome' wrote confidently about a member's "last cycle" — but the Loop gate is OFF in production
  // and the 60-day rule is still a placeholder, so there had never been one. Retired until the Loop ships.
  assert.doesNotMatch(draft, /cycle2_welcome/, 'the Loop is not live — this moment cannot be honestly drafted');
  assert.doesNotMatch(draft, /Welcome them to the cycle/, '"cycle" is not current member vocabulary');
});

test('the moments cover what a founder actually reaches for with a live cohort', () => {
  const draft = readFileSync('lib/founder/draft.ts', 'utf8');
  // Someone who has gone quiet, and someone who reclaimed a goal — the two real triggers. The second is the
  // outcome the whole program is pointed at, and there was no way to write to it.
  assert.match(draft, /gone_quiet/, 'no way to reach a member who has drifted');
  assert.match(draft, /goal_reclaimed/, 'no way to acknowledge the thing the program exists for');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStandingLine, daysBetween, type StandingFacts } from '../lib/dashboard/standing-update.ts';

// "WHERE YOU STAND" — the wording, branch by branch.
//
// These are TONE tests as much as logic tests, and that is deliberate. This paragraph is the first thing a member
// reads on every visit, including the visits where they have done nothing for a fortnight. The difference between
// a companion and a report card is decided entirely in these sentences, so they are pinned.

const base: StandingFacts = {
  phase: 'Reclaim',
  position: null,
  checkpointReady: false,
  finished: null,
  openWeek: null,
  daysSinceLastVisit: null,
};
const facts = (o: Partial<StandingFacts>): StandingFacts => ({ ...base, ...o });

test('it leads with where they are', () => {
  const line = buildStandingLine(facts({ position: { done: 3, of: 4 } }));
  assert.match(line, /^You're in Reclaim, 3 of 4 sessions done\./);
});

test('a single-session phase does not claim "1 of 1"', () => {
  // Reconnect has one countable step for some members; "1 of 1 sessions done" is technically true and reads
  // like a joke at the member's expense.
  assert.equal(buildStandingLine(facts({ position: { done: 1, of: 1 } })), "You're in Reclaim. Nothing needs you today.");
});

test('a ready Checkpoint is named as the last one, and counts as something needing them', () => {
  const line = buildStandingLine(facts({ position: { done: 3, of: 4 }, checkpointReady: true }));
  assert.match(line, /the Checkpoint is the last one/);
  assert.doesNotMatch(line, /Nothing needs you today/, 'a ready Checkpoint DOES need them — saying otherwise is a lie');
});

test('what they last finished is carried verbatim, day anchor and all', () => {
  const line = buildStandingLine(facts({ finished: 'You finished The Lifestyle Pilot yesterday.' }));
  assert.match(line, /You finished The Lifestyle Pilot yesterday\./);
});

test('an unmarked practice week is stated as a fact, never as a chase', () => {
  const line = buildStandingLine(facts({ openWeek: { day: 3, of: 7, markedToday: 0, rows: 2 } }));
  assert.match(line, /day 3 of 7/);
  assert.match(line, /today isn't marked yet/);
  // The scold-shaped versions. A surface that grades people is one they stop opening — and then we lose the data too.
  assert.doesNotMatch(line, /still|behind|missed|should|need to|haven't|remember to|don't forget/i);
});

test('a marked day is acknowledged without praise', () => {
  const line = buildStandingLine(facts({ openWeek: { day: 3, of: 7, markedToday: 2, rows: 2 } }));
  assert.match(line, /today's already marked/);
  assert.doesNotMatch(line, /great|well done|nice|amazing|proud|keep it up/i, 'normalize, do not praise');
  assert.match(line, /Nothing needs you today/, 'marked today means nothing is outstanding');
});

test('a quiet member is told nothing needs them — the sentence that makes it trustworthy', () => {
  // The most important branch. A member who has done nothing must not be met with an invented task or a nudge.
  const line = buildStandingLine(base);
  assert.equal(line, "You're in Reclaim. Nothing needs you today.");
});

test('a long absence is greeted warmly and DATES ITSELF', () => {
  // The FC's hard-won lesson: a delta that never says when the baseline was lets a stuck marker read as fresh.
  const line = buildStandingLine(facts({ daysSinceLastVisit: 9 }));
  assert.match(line, /it's been last week/);
  assert.doesNotMatch(line, /where have you been|welcome back to|finally/i, 'never a reprimand for being away');
});

test('a same-day or next-day return does not remark on the gap at all', () => {
  for (const d of [0, 1, 2]) {
    assert.doesNotMatch(buildStandingLine(facts({ daysSinceLastVisit: d })), /Good to see you/, `d=${d}`);
  }
  assert.match(buildStandingLine(facts({ daysSinceLastVisit: 3 })), /Good to see you/);
});

test('the full paragraph reads as one thing, in order', () => {
  const line = buildStandingLine({
    phase: 'Reclaim',
    position: { done: 3, of: 4 },
    checkpointReady: true,
    finished: 'You finished The Lifestyle Pilot yesterday.',
    openWeek: null,
    daysSinceLastVisit: 1,
  });
  assert.equal(
    line,
    "You're in Reclaim, 3 of 4 sessions done — the Checkpoint is the last one. You finished The Lifestyle Pilot yesterday.",
  );
});

test('daysBetween floors, so "yesterday" cannot become "2 days ago" over a clock edge', () => {
  const now = new Date('2026-08-08T09:00:00Z');
  assert.equal(daysBetween(new Date('2026-08-07T23:00:00Z'), now), 0);
  assert.equal(daysBetween(new Date('2026-08-07T08:00:00Z'), now), 1);
});

// ── THE SEAM ─────────────────────────────────────────────────────────────────────────────────────────────────
// The wording tests above are pure. Both bugs I actually hit building this were in the ASSEMBLY instead: GridRow
// has no markedToday (it carries marks[] and a 1-based day), and member_event has a real `surface` COLUMN rather
// than a payload json blob. Neither is visible to a pure test, and both would have shipped as "no practice week"
// and "never greets you" — silent wrongness. So this exercises standingUpdate against a real database.

import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { standingUpdate } from '../lib/dashboard/standing-update.ts';
import { startPracticeWeek } from '../lib/practice/store.ts';
import type { HeroCard } from '../lib/dashboard/hero-card.ts';

const heroStub = (ringTop: string, ringSub: string | null): HeroCard =>
  ({ eyebrow: '', crumbs: [], crumbState: null, title: '', copy: '', accomplishment: null, ctaLabel: '',
     ctaHref: null, kind: '', rings: [], ringTop, ringSub, momentumCta: null }) as HeroCard;

test('SEAM: an open practice week is read from marks[day-1], not an invented field', async () => {
  const pg = new PGlite(); const db = pg as unknown as Db;
  await applySchema(db);
  const m = (await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('S','s@grintaforlife.test') returning member_id`)).rows[0]!.member_id;
  await startPracticeWeek(db, m, 'b3_pilot');
  await db.query(
    `insert into practice_commitment (member_id, kind, slot, label, target_days) values ($1,'b3_pilot','activity','Your Lifestyle Pilot',5)`, [m]);

  // Day 1 of the window, nothing marked → it must SAY the week is running and that today isn't marked.
  const unmarked = await standingUpdate(db, m, heroStub('Rebuild', '2 of 3'));
  assert.match(unmarked ?? '', /practice week is on day 1 of 7/);
  assert.match(unmarked ?? '', /today isn't marked yet/);
  assert.doesNotMatch(unmarked ?? '', /Nothing needs you today/, 'an unmarked day IS outstanding');

  // Mark today → the same read must flip. This is the assertion that would have failed on the invented field.
  await db.query(
    `insert into practice_mark (member_id, kind, commitment_id, marked_on)
     select $1,'b3_pilot',id,current_date from practice_commitment where member_id=$1 and kind='b3_pilot' limit 1`, [m]);
  const marked = await standingUpdate(db, m, heroStub('Rebuild', '2 of 3'));
  assert.match(marked ?? '', /today's already marked/);
  assert.match(marked ?? '', /Nothing needs you today/);
});

test('SEAM: the visit baseline reads the surface COLUMN, and skips the current load', async () => {
  const pg = new PGlite(); const db = pg as unknown as Db;
  await applySchema(db);
  const m = (await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('S','s2@grintaforlife.test') returning member_id`)).rows[0]!.member_id;
  // Two dashboard views: one 10 days ago, and THIS load. The baseline must be the older one — the current visit
  // is already logged by the time the update runs, so an off-by-one here would report "0 days" forever.
  await db.query(
    `insert into member_event (member_id, kind, surface, created_at) values
       ($1,'page_view','dashboard', now() - interval '10 days'), ($1,'page_view','dashboard', now())`, [m]);
  const line = await standingUpdate(db, m, heroStub('Reclaim', null));
  assert.match(line ?? '', /Good to see you — it's been last week\./);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { getForecast } from '../lib/curriculum/view.ts';
import { markSessionClosed } from '../lib/curriculum/store.ts';
import { startPracticeWeek } from '../lib/practice/store.ts';
import { gatherHeroSignals, resolveHero } from '../lib/dashboard/hero-signals.ts';

// Redesign Layer 1 (D-02): the hero-signals adapter maps the member's REAL stored state (forecast + arc_session +
// practice_week + session_progress) into HeroSignals, then resolveHeroState picks the one winning state. Every field
// traces to a real source (no invented data). This proves the six states fire off the actual DB, deterministically, and
// in the right priority order. Ids are derived from the live forecast so the test stays true to the registry.

let seq = 0;
async function seedMember(db: Db): Promise<string> {
  seq += 1;
  return (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email) values ('Pat', $1) returning member_id`,
      [`pat${seq}@x.com`],
    )
  ).rows[0]!.member_id;
}
async function fresh(): Promise<{ db: Db; m: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db);
  return { db, m };
}
// Push every close outside the "just finished this visit" window (10 min) so those states don't mask a later one.
const ageAllCloses = (db: Db, m: string) =>
  db.query(`update session_progress set closed_at = now() - interval '30 minutes' where member_id=$1`, [m]);

test('fresh member → fresh (nothing started, even though a session is lit)', async () => {
  const { db, m } = await fresh();
  const sig = await gatherHeroSignals(db, m);
  assert.equal(sig.hasStarted, false);
  assert.ok(sig.nextSession, 'a session is lit for a brand-new member');
  const { state } = await resolveHero(db, m);
  assert.equal(state.kind, 'fresh', 'a lit session alone is not "started" — a fresh member sees fresh');
});

test('an in-flight arc → resume wins (pick up where you left off)', async () => {
  const { db, m } = await fresh();
  const fc = await getForecast(db, m);
  await db.query(
    `insert into arc_session (member_id, arc, state, messages, updated_at) values ($1,'reconnect','{}'::jsonb,'[]'::jsonb, now())`,
    [m],
  );
  const { state, signals } = await resolveHero(db, m);
  assert.equal(state.kind, 'resume');
  assert.equal(signals.inProgressSession?.label, fc.current?.title, 'resume names the lit session, from the forecast');
});

test('all reconnect sessions done (aged) → checkpoint-ready', async () => {
  const { db, m } = await fresh();
  const fc = await getForecast(db, m);
  const sessions = fc.phases
    .find((p) => p.phase === 'reconnect')!
    .items.filter((i) => i.kind === 'session' && i.openable);
  assert.ok(sessions.length > 0, 'reconnect has built sessions to close');
  for (const s of sessions) await markSessionClosed(db, m, s.id);
  await ageAllCloses(db, m); // so the closes don't read as "just finished"
  const { state, signals } = await resolveHero(db, m);
  assert.equal(state.kind, 'checkpoint-ready');
  assert.equal(signals.checkpointReady?.phase, 'reconnect');
});

test('a session just closed (recent) with no arc in flight → just-finished', async () => {
  const { db, m } = await fresh();
  const fc = await getForecast(db, m);
  const first = fc.current!; // a lit reconnect session
  await markSessionClosed(db, m, first.id); // closed_at = now → within the visit window
  const { state, signals } = await resolveHero(db, m);
  assert.equal(state.kind, 'just-finished');
  assert.equal(signals.justFinishedSession?.id, first.id);
});

test('an active practice week (nothing else pending) → mid-week-practice', async () => {
  const { db, m } = await fresh();
  await startPracticeWeek(db, m, 'w2_image');
  const { state, signals } = await resolveHero(db, m);
  assert.equal(state.kind, 'mid-week-practice');
  assert.equal(signals.activePractice?.kind, 'w2_image');
  assert.equal(signals.activePractice?.day, 1);
  assert.equal(signals.activePractice?.total, 7);
});

test('started (a stale close) with a session still lit, nothing in flight → next-step', async () => {
  const { db, m } = await fresh();
  const fc = await getForecast(db, m);
  const lit = fc.current!;
  // Close an UNRELATED id so hasStarted flips true without advancing the lit session; age it out of the recent window.
  await markSessionClosed(db, m, 'UNRELATED-XYZ');
  await ageAllCloses(db, m);
  const { state, signals } = await resolveHero(db, m);
  assert.equal(state.kind, 'next-step');
  assert.equal(signals.nextSession?.id, lit.id, 'the still-lit session is offered as the next step');
});

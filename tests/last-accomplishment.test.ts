import './helpers/with-phase-flags.ts'; // MUST be first — the registry reads the flags at module scope
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { lastAccomplishment } from '../lib/dashboard/last-accomplishment.ts';
import { startPracticeWeek } from '../lib/practice/store.ts';
import { closeWeek } from '../lib/practice/close.ts';

// THE HERO'S SUBHEAD — what the member last actually finished.
//
// The states that matter here are ones a demo account can't easily be walked into (you can't fake a closed week
// in a browser), so they're proven offline instead of asserted. The one that would hurt most in production is the
// LAST test: a member with nothing finished must get null, because the alternative — inventing an achievement to
// fill the slot — is the exact failure this product can least afford.

async function freshDb(): Promise<{ db: Db; memberId: string }> {
  const pg = new PGlite();
  const db = pg as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Acc', 'demo-acc@grintaforlife.test') returning member_id`,
  );
  return { db, memberId: rows[0]!.member_id };
}

test('a member who has finished nothing gets null — never an invented achievement', async () => {
  const { db, memberId } = await freshDb();
  assert.equal(await lastAccomplishment(db, memberId), null);
});

test('a closed session is named, with a human day anchor', async () => {
  const { db, memberId } = await freshDb();
  // Two closed sessions — the MOST RECENT one wins, so the hero can't reach back past newer work.
  await db.query(
    `insert into session_progress (member_id, session_id, status, closed_at)
     values ($1, 'RWR-W1', 'closed', now() - interval '4 days'), ($1, 'RBLD-B3', 'closed', now() - interval '1 day')`,
    [memberId],
  );
  const got = await lastAccomplishment(db, memberId);
  assert.ok(got, 'a closed session must produce an accomplishment');
  assert.equal(got.source, 'session');
  // The MOST RECENT wins — RBLD-B3 ("The Lifestyle Pilot"), not the older RWR-W1.
  assert.equal(got.text, 'You finished The Lifestyle Pilot yesterday.');
  assert.doesNotMatch(got.text, /RBLD|RWR-/, 'the raw asset id must never reach the member');
});

test('a CLOSED practice week outranks a session, and quotes the review verbatim', async () => {
  const { db, memberId } = await freshDb();
  await db.query(
    `insert into session_progress (member_id, session_id, status, closed_at)
     values ($1, 'RBLD-B3', 'closed', now() - interval '1 day')`,
    [memberId],
  );
  await startPracticeWeek(db, memberId, 'b3_pilot');
  await db.query(
    `insert into practice_commitment (member_id, kind, slot, label, target_days) values ($1, 'b3_pilot', 'activity', 'Your Lifestyle Pilot', 5)`,
    [memberId],
  );
  for (const d of [0, 1, 2, 3]) {
    await db.query(
      `insert into practice_mark (member_id, kind, commitment_id, marked_on)
       select $1, 'b3_pilot', id, (current_date - $2::int) from practice_commitment
        where member_id = $1 and kind = 'b3_pilot' limit 1`,
      [memberId, d],
    );
  }
  await closeWeek(db, memberId, 'b3_pilot');

  const got = await lastAccomplishment(db, memberId);
  assert.ok(got, 'a closed week must produce an accomplishment');
  assert.equal(got.source, 'practice_week', 'the week outranks the more recent session — it carries their own numbers');
  // The tone contract from buildReview must survive the splice: the shortfall is stated, never softened.
  assert.match(got.text, /you aimed for/);
  assert.doesNotMatch(got.text, /\bonly\b/i, 'no "only" — that is the softener buildReview deliberately refuses');
  assert.doesNotMatch(got.text, /great|well done|nice work|amazing/i, 'the hero states the fact; it does not praise');
});

test('an OPEN practice week is not an accomplishment — it has not finished', async () => {
  const { db, memberId } = await freshDb();
  await startPracticeWeek(db, memberId, 'b3_pilot');
  await db.query(
    `insert into practice_commitment (member_id, kind, slot, label, target_days) values ($1, 'b3_pilot', 'activity', 'Your Lifestyle Pilot', 5)`,
    [memberId],
  );
  const got = await lastAccomplishment(db, memberId);
  assert.equal(got, null, 'a week still running must not be reported as something they closed');
});

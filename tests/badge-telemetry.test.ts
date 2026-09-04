// WAS SHE EVER ACTUALLY SHOWN IT?
//
// Donna earned 15 badges across a full four-phase walk and asked: "was I getting a notification at all?" The
// product could not answer her. Not "the answer was no" — there was no record either way, for her or for any
// member, because the only evidence a badge had ever been SEEN would have been a person watching someone walk.
//
// The gap was wider than it looked: the persona gate makes no badge assertion at all, and smoke only checks that
// /badges returns 200. So the entire badge surface had no coverage beyond "the page is up".
//
// These tests hold the distinction the whole feature rests on: EARNED and SHOWN are different facts. Conflating
// them is what let Jennifer's ceremony say "You earned a new badge!" on 2026-09-04 over a badge that did not
// exist — the payload was real, so a server-side "we sent it" would have recorded that as a success.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { earnBadge, markCheckpointClosed } from '../lib/curriculum/store.ts';
import { logEvent } from '../lib/telemetry/store.ts';

async function member(db: Db, email: string): Promise<string> {
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('T',$1) returning member_id`, [email],
  );
  return rows[0]!.member_id;
}
async function kinds(db: Db, id: string, kind: string): Promise<{ ref: string | null; surface: string | null }[]> {
  const { rows } = await db.query<{ ref: string | null; surface: string | null }>(
    `select ref, surface from member_event where member_id=$1 and kind=$2 order by created_at`, [id, kind],
  );
  return rows;
}

test('earning a badge records that it was earned', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const id = await member(db, 'earn@example.test');

  await earnBadge(db, id, 'rewire-milestone');

  const ev = await kinds(db, id, 'badge_earned');
  assert.equal(ev.length, 1, 'a first earn must leave a record');
  assert.equal(ev[0]!.ref, 'rewire-milestone', 'the event must name WHICH badge');
});

test('re-earning the same badge does not record a second time', async () => {
  // earnBadge is called from the dashboard reconcile on EVERY load. If it logged unconditionally, a member who
  // opens their dashboard fifty times would look like someone who earned fifty badges, and the counts that are
  // supposed to answer Donna's question would be the first thing to lie.
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const id = await member(db, 'again@example.test');

  await earnBadge(db, id, 'rewire-milestone');
  await earnBadge(db, id, 'rewire-milestone');
  await earnBadge(db, id, 'rewire-milestone');

  assert.equal((await kinds(db, id, 'badge_earned')).length, 1, 'only a genuine first earn is an event');
});

test('EARNED IS NOT SHOWN — a badge she never saw is visibly unseen', async () => {
  // Jennifer, 2026-09-04: crossed the Rewire checkpoint and stopped for the night. This is that member, and the
  // point is that the data now says so out loud instead of looking identical to a member who saw her badge.
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const id = await member(db, 'jennifer@example.test');

  await markCheckpointClosed(db, id, { assetId: 'RWR-CHK', eventRef: 'RWR-CHK', phase: 'rewire' });

  assert.equal((await kinds(db, id, 'badge_earned')).length, 1, 'the crossing earned it');
  assert.equal((await kinds(db, id, 'badge_shown')).length, 0, 'and nothing claims she was shown it');
});

test('a badge drawn on screen is recorded, with the surface it was drawn on', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const id = await member(db, 'shown@example.test');

  await earnBadge(db, id, 'rewire-milestone');
  // What recordBadgeShownAction does once past its auth + registry guards (which need a request scope).
  await logEvent(db, id, 'badge_shown', { surface: 'ceremony', ref: 'rewire-milestone', meta: { badgeId: 'rewire-milestone' } });

  const seen = await kinds(db, id, 'badge_shown');
  assert.equal(seen.length, 1);
  assert.equal(seen[0]!.ref, 'rewire-milestone');
  assert.equal(seen[0]!.surface, 'ceremony', 'WHERE she saw it is the part that localizes a broken reveal');
});

test('the diagnostic answers "earned but never seen" without anyone walking', async () => {
  // The actual deliverable. Two badges, one seen and one not — the read must tell them apart, because this is
  // the query that replaces "have someone walk it and watch".
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const id = await member(db, 'diag@example.test');

  await earnBadge(db, id, 'reconnect-milestone');
  await earnBadge(db, id, 'rewire-milestone');
  await logEvent(db, id, 'badge_shown', { surface: 'ceremony', ref: 'reconnect-milestone', meta: {} });

  const { rows } = await db.query<{ badge_id: string; shown_count: string }>(
    `select b.badge_id,
            (select count(*) from member_event e
              where e.member_id = $1 and e.kind = 'badge_shown' and e.ref = b.badge_id) as shown_count
       from badge_earned b where b.member_id = $1 order by b.badge_id`,
    [id],
  );
  const byId = Object.fromEntries(rows.map((r) => [r.badge_id, Number(r.shown_count)]));
  assert.equal(byId['reconnect-milestone'], 1, 'she was shown this one');
  assert.equal(byId['rewire-milestone'], 0, 'and never shown this one — the finding, stated by the data');
});

// THE QUERY ITSELF RUNS. A typecheck cannot see SQL — the first version of this diagnostic edit typechecked
// clean while being syntactically broken, because backticks inside the comment ended the JS template literal.
// This executes the real thing, so a malformed query fails here rather than at the moment someone is trying to
// diagnose a live member.
import { runMemberDiagnostic } from '../lib/admin/diagnostic.ts';

test('runMemberDiagnostic executes and reports shown-ness per badge', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const id = await member(db, 'realquery@example.test');

  await earnBadge(db, id, 'reconnect-milestone');
  await earnBadge(db, id, 'rewire-milestone');
  await logEvent(db, id, 'badge_shown', { surface: 'ceremony', ref: 'reconnect-milestone', meta: {} });

  const report = await runMemberDiagnostic(db, id);
  const badges = (report as unknown as { badges: { badge_id: string; shown_count: number; shown_on: string[] }[] }).badges;
  const seen = badges.find((b) => b.badge_id === 'reconnect-milestone');
  const unseen = badges.find((b) => b.badge_id === 'rewire-milestone');

  assert.equal(Number(seen?.shown_count), 1, 'the seen badge reports a sighting');
  assert.deepEqual(seen?.shown_on, ['ceremony'], 'and names the surface it was seen on');
  assert.equal(Number(unseen?.shown_count), 0, 'the unseen badge reports none — the whole point');
});

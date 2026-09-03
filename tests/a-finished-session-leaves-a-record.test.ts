// A FINISHED SESSION USED TO LEAVE NO ACCOUNT OF ITSELF.
//
// `arc_session` is a resume buffer, and clearing it on completion is right for a real member: their words are the
// most sensitive thing this product holds, and everything we actually need — the Doors, the true lines, the
// keepers, the readings — has already been extracted into its own record by then.
//
// The cost showed up on 2026-09-03. Donna hit a hard dead end in Reclaim C1 — "Something went wrong", three
// times, surviving a refresh — and by the time anyone went looking, her conversation had been deleted as she
// finished the Session. Her state was fully inspectable and her words were gone. The only surviving evidence of
// the worst failure of the day was a screenshot she happened to take.
//
// Jay's ruling: "yes, testers only." The same allowlist that governs READING a transcript now governs KEEPING
// one — people who know they are testing, named individually, with a reason and a removal condition on the line.
// Every real member's row is still deleted on completion. The rule did not change; the set it applies to did.
//
// THE RISK THIS FILE GUARDS is not the retention — it is the retained row leaking into a LIVE path and telling a
// member who finished everything that they are still mid-Session. One query scans rather than looking up an exact
// key, and that is the one that had to learn about this.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { saveArcSession, loadArcSession, clearArcSession, latestArcSession } from '../lib/agent/arc-session.ts';
import type { ConvState, ConvMessage } from '../lib/agent/onboarding.ts';

const STATE = { stage: 'c1-enduring', collected: {} } as unknown as ConvState;
const SAID: ConvMessage[] = [
  { role: 'agent', text: 'Reading it now — what feels different about this list than when you wrote it?' },
  { role: 'member', text: 'Nothing, it all still is in play' },
];

async function member(email: string): Promise<{ db: Db; id: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('W',$1) returning member_id`, [email],
  );
  return { db, id: rows[0]!.member_id };
}

test('a tester keeps the transcript; a real member does not', async () => {
  // `.test` addresses are always readable, and therefore always retained — they are nobody.
  const t = await member('walker@grintaforlife.test');
  await saveArcSession(t.db, t.id, 'reclaim', STATE, SAID, 'c1');
  await clearArcSession(t.db, t.id, 'reclaim', 'c1');
  const kept = await t.db.query<{ n: number }>('select count(*)::int as n from arc_session where member_id=$1', [t.id]);
  assert.equal(kept.rows[0]!.n, 1, "a tester's finished Session left no record — the one thing this change is for");

  // A real address that is NOT on the allowlist: deleted, exactly as before.
  const m = await member('someone@example.com');
  await saveArcSession(m.db, m.id, 'reclaim', STATE, SAID, 'c1');
  await clearArcSession(m.db, m.id, 'reclaim', 'c1');
  const gone = await m.db.query<{ n: number }>('select count(*)::int as n from arc_session where member_id=$1', [m.id]);
  assert.equal(gone.rows[0]!.n, 0, "a real member's conversation was retained — it must not be");
});

test('THE RETAINED ROW IS INVISIBLE TO EVERY LIVE PATH', async () => {
  // The regression that would matter to a member rather than to us: finishing a Session and being told on your
  // own dashboard that you are still in the middle of one.
  const { db, id } = await member('walker@grintaforlife.test');
  await saveArcSession(db, id, 'reclaim', STATE, SAID, 'c1');
  await clearArcSession(db, id, 'reclaim', 'c1');

  assert.equal(await latestArcSession(db, id), null,
    'a finished Session read as in-flight — the retained row leaked into the resume path');
  assert.equal(await loadArcSession(db, id, 'reclaim', 'c1'), null,
    'the closed Session is still resumable — it must not be');
});

test('a second walk of the same Session does not collide with the first', async () => {
  // The retained key carries a timestamp precisely so a tester can walk a Session twice. Without it the second
  // close would violate the primary key and either throw or overwrite the first transcript.
  const { db, id } = await member('walker@grintaforlife.test');
  await saveArcSession(db, id, 'reclaim', STATE, SAID, 'c1');
  await clearArcSession(db, id, 'reclaim', 'c1');
  await db.query("update arc_session set arc = arc || '-a' where member_id=$1", [id]); // force a distinct first key
  await saveArcSession(db, id, 'reclaim', STATE, SAID, 'c1');
  await clearArcSession(db, id, 'reclaim', 'c1');

  const { rows } = await db.query<{ n: number }>('select count(*)::int as n from arc_session where member_id=$1', [id]);
  assert.equal(rows[0]!.n, 2, 'the second walk overwrote or lost the first');
  assert.equal(await latestArcSession(db, id), null, 'and neither retained row reads as in-flight');
});

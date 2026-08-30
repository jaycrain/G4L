import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { markSessionClosed, closedSessionIds } from '../lib/curriculum/store.ts';

// PRODUCTION BUG, 2026-07-31. Reconnect runs as one conversational arc, so it bypasses both the step-player's
// close and the checkpoint action. Badges were re-wired for that bypass; SESSION CLOSES were not. Greg opened
// seven Sessions across two days, finished Reconnect and crossed the checkpoint — and session_progress held ZERO
// rows, with no session_close event. His work was real and unrecorded: no history, no time-on-asset, and an
// operator panel that showed "—" and read as "did nothing".
//
// Jay caught it from the DOMAIN, not the code: the program is linear, so crossing the checkpoint with no closed
// Sessions is impossible. That invariant is what these tests assert.

async function db(): Promise<Db> {
  const d = new PGlite() as unknown as Db;
  await applySchema(d);
  return d;
}
async function member(d: Db, email: string): Promise<string> {
  const { rows } = await d.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ($1,$2) returning member_id`,
    [email.split('@')[0], email],
  );
  return rows[0]!.member_id;
}

test('a closed Reconnect Session is durably recorded AND emits session_close exactly once', async () => {
  const d = await db();
  const id = await member(d, 'greg@example.com');

  await markSessionClosed(d, id, 'RCN-EXC');
  assert.deepEqual(await closedSessionIds(d, id), ['RCN-EXC'], 'the close is durable, not just an event');

  const evOnce = await d.query<{ n: number }>(
    `select count(*)::int n from member_event where member_id=$1 and kind='session_close'`, [id]);
  assert.equal(evOnce.rows[0]!.n, 1, 'the time-on-asset window closes');

  // Idempotent: a re-close must not double-count the member's work.
  await markSessionClosed(d, id, 'RCN-EXC');
  const evTwice = await d.query<{ n: number }>(
    `select count(*)::int n from member_event where member_id=$1 and kind='session_close'`, [id]);
  assert.equal(evTwice.rows[0]!.n, 1, 're-closing must not emit a second session_close');
  assert.equal((await closedSessionIds(d, id)).length, 1);
});

test("THE INVARIANT: reaching the Ceremony means every Reconnect Session is closed — Greg's case", async () => {
  // Reproduces the exact production state: the member has worked the whole gateway, but nothing was recorded.
  // The self-heal at the Ceremony crossing must leave a truthful record rather than a hole.
  const d = await db();
  const id = await member(d, 'linear@example.com');
  assert.deepEqual(await closedSessionIds(d, id), [], 'starts with nothing recorded — as Greg did');

  // What persistReconnectSessionCloses does on the crossing into 'ceremony'.
  for (const asset of ['RCN-EXC', 'RCN-IDQ', 'RCN-CHK']) await markSessionClosed(d, id, asset);

  const closed = await closedSessionIds(d, id);
  for (const asset of ['RCN-EXC', 'RCN-IDQ', 'RCN-CHK']) {
    assert.ok(closed.includes(asset), `${asset} must be closed once the gateway is complete`);
  }
  // The panel's Sessions column reads this. Before the fix it said "—" for a member who had done all of it.
  assert.equal(closed.length, 3, 'three closes = what the operator panel will now show');
});

test('closing one Session never implies the others — the self-heal only runs at the Ceremony', async () => {
  // Guard against over-correcting: mid-arc, only the Session actually left is closed. A member halfway through
  // must not be credited with work they have not done.
  const d = await db();
  const id = await member(d, 'partial@example.com');
  await markSessionClosed(d, id, 'RCN-EXC'); // left the Doors stage only
  assert.deepEqual(await closedSessionIds(d, id), ['RCN-EXC']);
});

// PRODUCTION BUG, 2026-08-30 — found watching Donna's live walk, not from the code.
//
// Her R1 closed at 22:09:30 after 6m34s in the mirror. The record said 23:00:43. Every Reconnect Session carried
// the same timestamp, 51 minutes after she actually finished the first one, because the ceremony self-heal in
// persistReconnectSessionCloses re-closes EVERY Reconnect Session — its comment says "close any that are still
// open", its loop closes all of them — and markSessionClosed's upsert set `closed_at = now()` unconditionally.
//
// The sibling guard one line below (`alreadyClosed`, which stops session_close double-firing) is proof the author
// already held the rule this violated: a re-close is not a new completion. Only the timestamp missed it.
//
// It matters twice over. closed_at is the "completed" half of time-on-asset, which the data contract lists as
// required from day one — and it is the column the resume hero and lastAccomplishment ORDER BY to name what a
// member just finished.
test('a re-close never moves a completion time — first close wins', async () => {
  const d = await db();
  const m = await member(d, 'donna-restamp@example.test');

  await markSessionClosed(d, m, 'RCN-IDQ');
  const first = (await d.query<{ closed_at: string }>(
    `select closed_at::text as closed_at from session_progress where member_id=$1 and session_id=$2`, [m, 'RCN-IDQ'],
  )).rows[0]!.closed_at;

  // Force a measurable gap, then re-close the way the ceremony self-heal does.
  await d.query(`update session_progress set closed_at = closed_at - interval '51 minutes' where member_id=$1`, [m]);
  const backdated = (await d.query<{ closed_at: string }>(
    `select closed_at::text as closed_at from session_progress where member_id=$1`, [m],
  )).rows[0]!.closed_at;

  await markSessionClosed(d, m, 'RCN-IDQ'); // the ceremony, re-closing an already-closed Session
  const after = (await d.query<{ closed_at: string }>(
    `select closed_at::text as closed_at from session_progress where member_id=$1`, [m],
  )).rows[0]!.closed_at;

  assert.equal(after, backdated, 're-closing must preserve the ORIGINAL completion time, not stamp a new one');
  assert.notEqual(after, first, 'sanity: the backdate really happened, so the assertion above is not vacuous');
});

test('the ceremony self-heal still closes what IS open, without disturbing what is not', async () => {
  const d = await db();
  const m = await member(d, 'donna-selfheal@example.test');

  await markSessionClosed(d, m, 'RCN-IDQ');
  await d.query(`update session_progress set closed_at = closed_at - interval '1 hour' where member_id=$1`, [m]);
  const idqClosedAt = (await d.query<{ closed_at: string }>(
    `select closed_at::text as closed_at from session_progress where member_id=$1`, [m],
  )).rows[0]!.closed_at;

  // What the ceremony does: close every Session, open or not.
  for (const s of ['RCN-IDQ', 'RCN-EXC', 'RCN-FDR', 'RCN-DFT', 'RCN-CHK']) await markSessionClosed(d, m, s);

  const closed = await closedSessionIds(d, m);
  for (const s of ['RCN-IDQ', 'RCN-EXC', 'RCN-FDR', 'RCN-DFT', 'RCN-CHK']) {
    assert.ok(closed.includes(s), `${s} must end closed — the self-heal is still doing its job`);
  }
  const idqAfter = (await d.query<{ closed_at: string }>(
    `select closed_at::text as closed_at from session_progress where member_id=$1 and session_id='RCN-IDQ'`, [m],
  )).rows[0]!.closed_at;
  assert.equal(idqAfter, idqClosedAt, "the already-closed Session keeps its own completion time");
});

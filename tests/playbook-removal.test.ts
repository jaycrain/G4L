// "When the user directly asked the Companion to help fix these entries, it said it could not edit what's already
// captured — it could only ask the question again fresh, leaving the bad entry still sitting in the Playbook."
// (Donna, 2026-08-19.)
//
// That is the part that turned a capture bug into a trust problem. Being told no by the thing that filed the
// wrong words about you is worse than the filing, because the filing was a mistake and the refusal is a policy.
//
// And it was never true. matchKeptEntry has always searched EVERY kept entry, and dismissEntry has always been a
// reversible retire. The only thing stopping the Companion was the sentence in the tool description saying "a
// kept Move" — so on a mis-captured line in "What Lights You Up" it correctly concluded it had no tool for that.
// A capability the product HAS and the model does not know about is indistinguishable from one it lacks.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { proposeEntry, listPlaybook, matchKeptEntry, dismissEntry } from '../lib/playbook/store.ts';

async function freshDb(): Promise<{ db: Db; memberId: string }> {
  const raw = new PGlite();
  await raw.waitReady;
  const db: Db = { query: (t, p) => (raw as any).query(t, p), exec: (t) => (raw as any).exec(t) };
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('D','d@d.com') returning member_id`,
  );
  return { db, memberId: rows[0]!.member_id };
}

test("DONNA'S ENTRY — a mis-captured line outside 'Your Moves' can be found and taken out", async () => {
  const { db, memberId } = await freshDb();
  // Her actual bad keeper: a housekeeping question, filed as her Visualization picture under lights_you_up.
  await proposeEntry(db, memberId, {
    section: 'own_words',
    body: 'Can you remind me what is on my Reclaim List?',
    keep: true,
    keeperType: 'lights_you_up',
  });
  await proposeEntry(db, memberId, { section: 'own_words', body: 'I need to put myself first to be good for anyone else.', keep: true, keeperType: 'principle' });

  const all = await listPlaybook(db, memberId);
  const { entry, ambiguous } = matchKeptEntry(all, 'can you remind me what is on my reclaim list');
  assert.equal(ambiguous, false);
  assert.ok(entry, 'the matcher reaches an entry that is not a Move — it always could');
  assert.match(entry.body, /Reclaim List\?$/);

  assert.equal(await dismissEntry(db, memberId, entry.id), true);
  const after = await listPlaybook(db, memberId);
  assert.equal(after.filter((e) => e.state === 'kept').length, 1, 'the bad entry is gone from her kept Playbook');
  assert.equal(after.filter((e) => e.state === 'kept')[0]!.keeperType, 'principle', 'and the good one is untouched');
  // A RETIRE, never a delete — the row survives so it can come back. Asserted against the TABLE, because
  // listPlaybook deliberately does not return dismissed rows, so its count would prove nothing either way.
  const { rows: raw } = await db.query<{ n: number }>(
    `select count(*)::int as n from playbook_entry where member_id = $1 and state = 'dismissed'`, [memberId],
  );
  assert.equal(raw[0]!.n, 1, 'the row is still there, dismissed — recoverable, never deleted');
});

test('an ambiguous request REFUSES rather than removing the wrong line', async () => {
  // Silently editing the wrong entry in someone's own record is the failure mode worth protecting against — they
  // may not notice for weeks, and by then they cannot tell what they actually said.
  const { db, memberId } = await freshDb();
  await proposeEntry(db, memberId, { section: 'own_words', body: 'walk every morning', keep: true, keeperType: 'principle' });
  await proposeEntry(db, memberId, { section: 'own_words', body: 'walk every morning before work', keep: true, keeperType: 'principle' });
  const { entry, ambiguous } = matchKeptEntry(await listPlaybook(db, memberId), 'walk every morning');
  // Exact match wins outright; the near-duplicate is what must not be guessed at.
  const near = matchKeptEntry(await listPlaybook(db, memberId), 'walk');
  assert.ok(entry, 'an exact phrase still resolves');
  assert.equal(near.entry, null, 'a partial that hits two entries resolves to nothing');
  assert.equal(near.ambiguous, true, 'and says so, so the Companion asks instead of picking');
});

test('THE TOOL NO LONGER SAYS "only a Move" — the capability is described as broadly as it works', () => {
  // The behavioural half above passed the whole time. The bug lived entirely in this prose, which is the only
  // thing the model reads, so it is the only thing that decided whether Donna got help.
  const src = readFileSync(new URL('../lib/agent/checkin.ts', import.meta.url), 'utf8');
  const tool = src.slice(src.indexOf("name: 'retire_play'"), src.indexOf("name: 'retire_tracker'"));
  assert.match(tool, /any entry, in any part of it, not only a Move/i, 'it must tell the model the true scope');
  assert.match(tool, /not_mine/, 'and carry the reason for a capture that was never theirs');
  assert.match(tool, /never a delete/i, 'still a reversible retire');
  assert.match(tool, /ask instead of guessing/i, 'still refuses on ambiguity');
});

test('a wrong capture is removed WITHOUT a speech about how it got there', () => {
  const src = readFileSync(new URL('../app/dashboard/checkin-actions.ts', import.meta.url), 'utf8');
  const tool = src.slice(src.indexOf("name === 'retire_play'"), src.indexOf("name === 'retire_tracker'"));
  assert.match(tool, /Do NOT explain how it got captured/i, 'no defending the capture');
  assert.match(tool, /do not ask them to justify it/i, 'and no asking her to argue for her own record');
  // The Move voice must NOT be reused for a mis-capture: nobody needs reassurance that their own question was
  // not a failure, and saying so draws attention to the mistake instead of quietly fixing it.
  assert.match(tool, /notMine\s*\?/, 'the message branches on the reason');
  assert.match(tool, /never a failure/, 'the Move wording survives for the Move case');
  // ...and is NOT what a mis-capture gets. The two branches must say different things, or the branch is decoration.
  const notMineBranch = tool.slice(tool.indexOf('notMine'), tool.indexOf('never a failure'));
  assert.doesNotMatch(notMineBranch.split(':')[1] ?? '', /never a failure/, 'a wrong capture gets its own voice');
});

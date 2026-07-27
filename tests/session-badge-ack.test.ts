import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';

// Session-close badge acknowledgment (Jay's call): a session that maps to a milestone names it ONCE at the close, then
// stays quiet. The REDESIGN badge set must be active for getBadge to resolve the identity-framed name, so this file
// sets the flag before importing view.ts (node --test isolates each test file in its own process — no leak).

test('acknowledgeSessionBadge names a milestone once, then stays quiet; unmapped sessions say nothing', async () => {
  process.env.REDESIGN = 'staged';
  const { acknowledgeSessionBadge } = await import('../lib/curriculum/view.ts');

  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = (await db.query<{ member_id: string }>(`insert into member_profile (display_name, email) values ('Pat', 'ack@x.com') returning member_id`)).rows[0]!.member_id;

  const first = await acknowledgeSessionBadge(db, m, 'RWR-W1');
  assert.equal(first?.name, 'True Line', 'the W1 close earns + names the milestone');

  const second = await acknowledgeSessionBadge(db, m, 'RWR-W1');
  assert.equal(second, null, 'already earned → no double-acknowledgment');

  const unmapped = await acknowledgeSessionBadge(db, m, 'RCL-C1'); // C1 maps to no milestone badge
  assert.equal(unmapped, null, 'a session with no mapped badge says nothing');
});

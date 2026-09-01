// The purge list is DERIVED from the schema here, not trusted from memory.
//
// A hand-written "delete from every table a member owns" list is the exact thing that goes stale silently: the
// fresh-member seeder's list omits 40 of the 58 tables carrying a member_id and nobody ever noticed, because there
// the leftovers are invisible (it mints a new member_id straight after). For the purge they are not invisible —
// a table that blocks the delete aborts it half-done, on production member data, at the moment an operator is
// waiting. So this reads the migrations and fails when the schema moves.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BLOCKING_TABLES, ORPHAN_TABLES, isPurgeable, purgeMemberByEmail } from '../lib/demo/purge-member.ts';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');

/** Every `create table` body in the migrations, as [table, body]. */
function tableBodies(): Array<[string, string]> {
  const sql = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .join('\n');
  const out: Array<[string, string]> = [];
  const re = /create table (?:if not exists )?([a-z_]+)\s*\(/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    const start = m.index;
    const end = sql.indexOf('\n);', start);
    if (end > start) out.push([m[1]!, sql.slice(start, end)]);
  }
  return out;
}

test('every member_id FK that BLOCKS a profile delete is in BLOCKING_TABLES', () => {
  const blocking: string[] = [];
  for (const [table, body] of tableBodies()) {
    if (table === 'member_profile') continue; // its own PK, not a reference
    const line = body.split('\n').find((l) => /^\s*member_id\b/.test(l));
    if (!line) continue;
    if (!/references\s+member_profile/i.test(line)) continue; // no FK — cannot block (see ORPHAN_TABLES)
    if (/on delete (cascade|set null)/i.test(line)) continue; // the DB handles these
    blocking.push(table);
  }
  assert.deepEqual(
    [...new Set(blocking)].sort(),
    [...BLOCKING_TABLES].sort(),
    'a member_id FK with no ON DELETE rule was added or removed — update BLOCKING_TABLES in lib/demo/purge-member.ts',
  );
});

test('ORPHAN_TABLES really do carry member_id with no foreign key', () => {
  const bodies = new Map(tableBodies());
  for (const t of ORPHAN_TABLES) {
    const body = bodies.get(t);
    assert.ok(body, `${t} is not a table any more`);
    const line = body!.split('\n').find((l) => /^\s*member_id\b/.test(l));
    assert.ok(line, `${t} no longer has a member_id`);
    assert.ok(!/references/i.test(line!), `${t} gained a foreign key — it may now cascade or block, so re-classify it`);
  }
});

test('the allowlist is the guard — a real member cannot be purged by typing their address', () => {
  assert.equal(isPurgeable('donnacrain19@gmail.com'), true);
  assert.equal(isPurgeable('  DonnaCrain19@Gmail.com '), true, 'trim + case must not be a way past the list');
  assert.equal(isPurgeable('fresh@grintaforlife.test'), true, '.test fixtures are always disposable');
  // jay@adjacentlabmedia.com USED TO BE THIS TEST'S EXAMPLE of a real member the list must refuse. On 2026-09-01
  // he asked for his own record to be wiped in the clean start before Greg and Jennifer, so it is now ON the list
  // — a decision, made in his words, recorded there. The example moved to an address nobody has allowed, because
  // what this test actually proves is unchanged: being a real person's address is not a way in. The empty string,
  // the whitespace and the suffix-injection case are the guards worth keeping intact.
  for (const notAllowed of ['someone@gmail.com', 'greg@example.com', '', '   ', 'donnacrain19@gmail.com.evil.com']) {
    assert.equal(isPurgeable(notAllowed), false, `must refuse ${JSON.stringify(notAllowed)}`);
  }
});

/** A fake db that records what it was asked to delete. */
function fakeDb(rows: Array<{ member_id: string }>) {
  const deletes: string[] = [];
  return {
    deletes,
    query: async <T = unknown>(sql: string): Promise<{ rows: T[] }> => {
      if (/^select/i.test(sql.trim())) return { rows: rows as unknown as T[] };
      const m = /delete from ([a-z_]+)/i.exec(sql);
      if (m) deletes.push(m[1]!);
      return { rows: [] as T[] };
    },
  };
}

test('purge deletes the blockers BEFORE the profile, or the FK aborts it half-done', async () => {
  const db = fakeDb([{ member_id: 'abc' }]);
  const res = await purgeMemberByEmail(db, 'donnacrain19@gmail.com');
  assert.equal(res.ok, true);
  for (const t of [...BLOCKING_TABLES, ...ORPHAN_TABLES]) assert.ok(db.deletes.includes(t), `never cleared ${t}`);
  assert.equal(db.deletes.at(-1), 'member_profile', 'the profile must be last — everything else cascades off it');
});

test('purge refuses the three ways it could hit the wrong person', async () => {
  // not on the list
  const a = await purgeMemberByEmail(fakeDb([{ member_id: 'x' }]), 'someone@real.com');
  assert.equal(a.ok, false);
  // no such account — never silently "succeed" on nothing
  const b = await purgeMemberByEmail(fakeDb([]), 'donnacrain19@gmail.com');
  assert.equal(b.ok, false);
  // ambiguous — never guess which human
  const c = await purgeMemberByEmail(fakeDb([{ member_id: 'x' }, { member_id: 'y' }]), 'donnacrain19@gmail.com');
  assert.equal(c.ok, false);
  // and none of those touched anything
  for (const db of [fakeDb([{ member_id: 'x' }])]) {
    await purgeMemberByEmail(db, 'someone@real.com');
    assert.equal(db.deletes.length, 0, 'a refused purge must delete nothing at all');
  }
});

test('an IN-FLIGHT onboarding is purged too — it is keyed by email, so no cascade reaches it', async () => {
  // The gap that made a wipe a no-op: she had stopped at the summary card, so no member row existed and there was
  // nothing for the profile delete to hang off. The purge reported success; she reopened the front door and
  // resumed the same conversation. (Donna, 2026-08-20.)
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  await db.query(
    `insert into onboarding_session (email, token, state, messages) values ($1,'tok','{}','[]')`,
    ['donnacrain19@gmail.com'],
  );

  const res = await purgeMemberByEmail(db, 'donnacrain19@gmail.com');
  assert.equal(res.ok, true, 'a conversation-only account is a real account to purge');
  assert.equal(res.ok && res.memberId, null, 'and there was never a member_id to report');
  const { rows } = await db.query<{ n: number }>('select count(*)::int n from onboarding_session');
  assert.equal(rows[0]!.n, 0, 'she starts the front door as a stranger');
});

test('nothing at all is still a refusal — an empty wipe must never read as a success', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const res = await purgeMemberByEmail(db, 'donnacrain19@gmail.com');
  assert.equal(res.ok, false);
});

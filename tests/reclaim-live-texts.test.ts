// W-29: C1 must read the member's LIVE Reclaim List and degrade to the committed jsonb list on reclaim_item drift —
// NEVER show "your list is empty" when items actually exist (which would invite building a parallel list). This proves
// liveReclaimTexts: categorized rows win when present; otherwise it falls back to member_profile.reclaim_list.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { liveReclaimTexts } from '../lib/beats/store.ts';

async function freshDb(): Promise<Db> {
  const db = new PGlite();
  await applySchema(db as unknown as Db);
  return db as unknown as Db;
}

async function newMember(db: Db, email: string, jsonbList: string[]): Promise<string> {
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email, reclaim_list) values ('Jay', $1, $2::jsonb) returning member_id`,
    [email, JSON.stringify(jsonbList)],
  );
  return rows[0]!.member_id;
}

test('liveReclaimTexts · categorized reclaim_item rows win when present', async () => {
  const db = await freshDb();
  const m = await newMember(db, 'a@example.com', ['stale jsonb']);
  await db.query(
    `insert into reclaim_item (member_id, text, category, rhythm, sort_order) values ($1,'ride again','physical','weekly',0)`,
    [m],
  );
  assert.deepEqual(await liveReclaimTexts(db, m), ['ride again'], 'the live categorized row wins over stale jsonb');
});

test('liveReclaimTexts · falls back to the committed jsonb list when reclaim_item is empty (the W-29 drift case)', async () => {
  const db = await freshDb();
  const m = await newMember(db, 'b@example.com', ['get strong again', 'see friends more', 'race Big Sugar']);
  // No reclaim_item rows (mirrors a drifted prod where getReclaimItems throws/returns empty).
  assert.deepEqual(
    await liveReclaimTexts(db, m),
    ['get strong again', 'see friends more', 'race Big Sugar'],
    'degrades to the real committed list — never empty when items exist',
  );
});

// Note: member_profile enforces `reclaim_list_min_1` (a member always has ≥1 item), so the jsonb fallback is ALWAYS
// non-empty — which is exactly why C1 rendering "your list is empty" was unambiguously a bug, never a real state.

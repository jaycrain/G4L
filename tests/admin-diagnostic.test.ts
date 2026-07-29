import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { searchMembers, runMemberDiagnostic } from '../lib/admin/diagnostic.ts';

async function freshDb(): Promise<Db> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  return db;
}

async function makeMember(db: Db, over: Record<string, unknown> = {}): Promise<string> {
  const d = {
    display_name: 'Donna Reyes', email: 'donna@x.com', identity_noun: 'runner',
    identity_paragraph: 'para', intake_gap: 'my gap', ai_consent: true, ...over,
  };
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email, identity_noun, identity_paragraph, intake_gap, ai_consent_granted_at)
     values ($1,$2,$3,$4,$5, case when $6 then now() else null end) returning member_id`,
    [d.display_name, d.email, d.identity_noun, d.identity_paragraph, d.intake_gap, d.ai_consent],
  );
  return rows[0]!.member_id;
}

// A member who walked cleanly to Rebuild — no flags should fire.
async function seedCleanWalk(db: Db, memberId: string): Promise<void> {
  await db.query(`insert into reclaim_item (member_id, text, category, sort_order) values ($1,'Run a 10k','physical',0),($1,'Call mom weekly','social',1),($1,'Sleep 8h','physical',2)`, [memberId]);
  const door = (await db.query<{ slug: string }>(`select slug from door limit 1`)).rows[0]!.slug;
  await db.query(`insert into member_door (member_id, door_slug, is_primary) values ($1,$2,true)`, [memberId, door]);
  await db.query(`update member_profile set named_door=$2 where member_id=$1`, [memberId, door]);
  await db.query(`insert into idq_retake (member_id, cycle_indicator, sequence_no, responses, physical_score, self_score, social_score, outlook_score, id_score_raw, id_score) values ($1,1,0,'{}'::jsonb,18,18,18,18,72,60)`, [memberId]);
  // Every member who finishes intake takes the Grinta baseline survey, so a genuinely CLEAN walk has one.
  await db.query(`insert into grinta_reading (member_id, source, sequence_no, responses, composite) values ($1,'onboarding',0,'{}'::jsonb,3.08)`, [memberId]);
  await db.query(`insert into phase_gate (member_id, gate) values ($1,'reconnect_core_complete'),($1,'rewire_threshold_met'),($1,'rebuild_underway')`, [memberId]);
  await db.query(`insert into member_event (member_id, kind, ref, step) values ($1,'session_step','RCN-EXC',3),($1,'session_close','RCN-EXC',null)`, [memberId]);
}

test('runMemberDiagnostic reports a clean walk with an empty FLAGS block', async () => {
  const db = await freshDb();
  const id = await makeMember(db);
  await seedCleanWalk(db, id);
  const rep = await runMemberDiagnostic(db, id);
  assert.deepEqual(rep.FLAGS, {}, `expected no flags, got ${JSON.stringify(rep.FLAGS)}`);
  assert.equal(rep.reclaim_count, 3);
  assert.equal((rep.doors as unknown[]).length, 1);
  assert.equal((rep.idq_retakes as { id_score: number }[])[0]!.id_score, 60);
});

test('runMemberDiagnostic surfaces the real abnormalities', async () => {
  const db = await freshDb();
  // Broken walk: no gap, no consent, only 2 reclaim items, no doors, no baseline IDQ, a stuck session,
  // and rebuild underway without reconnect_core_complete.
  const id = await makeMember(db, { intake_gap: null, ai_consent: false });
  await db.query(`insert into reclaim_item (member_id, text, sort_order) values ($1,'Ride',0),($1,'ride',1)`, [id]); // dup (case-insensitive) + below floor
  await db.query(`insert into session_progress (member_id, session_id, status) values ($1,'RWR-EXC','in_progress')`, [id]);
  await db.query(`insert into phase_gate (member_id, gate) values ($1,'rebuild_underway')`, [id]);
  const rep = await runMemberDiagnostic(db, id);
  const f = rep.FLAGS as Record<string, unknown>;
  assert.equal(f.gap_missing, true);
  assert.equal(f.ai_consent_missing, true);
  assert.equal(f.reclaim_below_floor, 2);
  assert.deepEqual(f.reclaim_duplicate_texts, ['ride']);
  assert.equal(f.no_doors, true);
  assert.equal(f.no_baseline_idq, true);
  assert.deepEqual(f.sessions_stuck_in_progress, ['RWR-EXC']);
  assert.equal(f.rebuild_underway_without_reconnect_core, true);
});

test('searchMembers resolves by name, email, and exact id', async () => {
  const db = await freshDb();
  const id = await makeMember(db, { display_name: 'Donna Reyes', email: 'donna.reyes@example.com' });
  await makeMember(db, { display_name: 'Bob Stone', email: 'bob@x.com' });
  assert.equal((await searchMembers(db, 'donna')).length, 1);
  assert.equal((await searchMembers(db, 'reyes@example')).length, 1);
  const byId = await searchMembers(db, id);
  assert.equal(byId[0]!.memberId, id);
});

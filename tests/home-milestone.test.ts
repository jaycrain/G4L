import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { loadHomeState, markMilestoneSeen } from '../lib/dashboard/home-state.ts';
import type { HeroState } from '../lib/dashboard/resume-hero.ts';

// The one-shot milestone contract (loadMilestone + markMilestoneSeen): a just-earned ceremonial badge greets ONCE,
// then the mark-seen marker retires it — later loads fall through to the member's real next-action state, never
// re-greeting. Retirement is by MARKER, not by render, so nothing burns the celebration before the member engages.

async function freshDb(): Promise<{ db: Db; memberId: string }> {
  const raw = new PGlite();
  await raw.waitReady;
  const db: Db = { query: (t, p) => (raw as any).query(t, p), exec: (t) => (raw as any).exec(t) };
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('T','t@t.com') returning member_id`,
  );
  return { db, memberId: rows[0]!.member_id };
}

const page = (hero: HeroState) => ({ hero, firstName: 'T', phase: 'rewire' as const, phaseLabel: 'Rewire', ctaHref: '/x' });

test('MILESTONE one-shot — greets once, then the mark-seen marker retires it (falls through to the real state)', async () => {
  const { db, memberId } = await freshDb();
  // A just-earned CEREMONIAL badge (reconnect-milestone is ceremony:true in the registry).
  await db.query(`insert into badge_earned (member_id, badge_id) values ($1, 'reconnect-milestone')`, [memberId]);

  // First load: the celebration wins, carrying the badge_id as its dismiss key.
  const first = await loadHomeState(db, memberId, new Date(), page({ kind: 'fresh' }));
  assert.equal(first.kind, 'milestone');
  assert.equal(first.dismissKey, 'reconnect-milestone');

  // The member engages → mark it seen.
  await markMilestoneSeen(db, memberId, 'reconnect-milestone');

  // Next load: retired — no re-greet; the home falls through to the quiet default.
  const second = await loadHomeState(db, memberId, new Date(), page({ kind: 'fresh' }));
  assert.notEqual(second.kind, 'milestone');
  assert.equal(second.kind, 'quiet');
});

test('MILESTONE — an onboarding excavation badge (Doors) never billboards the home (member not oriented yet)', async () => {
  const { db, memberId } = await freshDb();
  // named-yourself "You named the Doors" (earn_rule reconnect:doors) is ceremony:true but earned DURING onboarding —
  // it must not hijack the first home view (Jay's mobile walk). Phase-checkpoint badges still do.
  await db.query(`insert into badge_earned (member_id, badge_id) values ($1, 'named-yourself')`, [memberId]);
  const s = await loadHomeState(db, memberId, new Date(), page({ kind: 'fresh' }));
  assert.notEqual(s.kind, 'milestone');
});

test('MILESTONE one-shot — a NON-ceremonial badge never triggers the celebration', async () => {
  const { db, memberId } = await freshDb();
  // Use a real non-ceremony badge id if present; an unknown id also resolves to no milestone (getBadge → null).
  await db.query(`insert into badge_earned (member_id, badge_id) values ($1, 'not-a-ceremony-badge')`, [memberId]);
  const s = await loadHomeState(db, memberId, new Date(), page({ kind: 'fresh' }));
  assert.notEqual(s.kind, 'milestone');
});

// EVERY PHASE CHECKPOINT AWARDS ITS BADGE.
//
// Greg crossed the Rewire checkpoint on 2026-08-02 and never got the Rewire badge. Cause: each phase's
// conversational arc sets its own gate and bypasses the old checkpoint action, which is where the registry's
// `earns:` was honoured. Reconnect had a hand-written fix; Rewire, Rebuild and Reclaim never got one — so
// three phase badges had never awarded for anybody.
//
// This test exists because the failure was SILENT: nothing errored, the gate was set, the dashboard rendered,
// and the only symptom was a badge that said "not yet" and "you completed this" at the same time. The map is
// the contract — a phase that ships a gate without a badge fails here rather than in someone's passport.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASE_GATE_BADGE } from '../lib/curriculum/view.ts';
import { BADGES } from '../lib/curriculum/registry.ts';

const KNOWN_GATES = [
  'reconnect_checkpoint_passed',
  'rewire_checkpoint_passed',
  'rebuild_checkpoint_passed',
  'reclaim_checkpoint_passed',
];

test('every phase checkpoint gate maps to a badge', () => {
  for (const gate of KNOWN_GATES) {
    assert.ok(PHASE_GATE_BADGE[gate], `${gate} has no milestone badge — a member can cross it and get nothing`);
  }
});

test('every mapped badge actually exists in the registry', () => {
  // A typo here would be the same silent failure in a new costume: the gate fires, earnBadge is called with
  // an id nothing knows, and the member's passport stays empty.
  const ids = new Set(BADGES.map((b) => b.id));
  for (const [gate, badgeId] of Object.entries(PHASE_GATE_BADGE)) {
    assert.ok(ids.has(badgeId), `${gate} → "${badgeId}" is not a real badge id`);
  }
});

test('the four phases map to four DISTINCT badges', () => {
  const ids = Object.values(PHASE_GATE_BADGE);
  assert.equal(new Set(ids).size, ids.length, 'two phases share a badge — one of them will never be earnable');
});

// ── AND THE MECHANISM ACTUALLY RUNS ────────────────────────────────────────────────────────────────────────
//
// The three tests above check the MAP. This one checks the AWARD — because the map being right is exactly
// what was already true before Greg's walk: the registry said RWR-CHK earns 'rewire-milestone' the whole
// time, and nothing ever called it. A contract nobody executes is the shape this bug had.
//
// The reconcile is the BACKSTOP — it backfills a member who crossed weeks ago, on their next dashboard load.
// It is no longer the only path: see the eager award below for why the crossing itself has to earn it.

import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { reconcileRedesignBadges } from '../lib/curriculum/view.ts';

test('a member who already crossed a checkpoint gets the badge on their next reconcile', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Greg W','greg@example.test') returning member_id`,
  );
  const id = rows[0]!.member_id;

  // The exact state Greg was in on production: gate set, badge missing.
  await db.query(`insert into phase_gate (member_id, gate) values ($1,'rewire_checkpoint_passed')`, [id]);
  const before = await db.query(`select 1 from badge_earned where member_id=$1 and badge_id='rewire-milestone'`, [id]);
  assert.equal(before.rows.length, 0, 'precondition: the badge is missing, which is the bug');

  await reconcileRedesignBadges(db, id);

  const after = await db.query(`select 1 from badge_earned where member_id=$1 and badge_id='rewire-milestone'`, [id]);
  assert.equal(after.rows.length, 1, 'crossing the Rewire checkpoint must award the Rewire badge');

  // Idempotent: the crossing awards eagerly AND this path backfills, so a double-award must be safe.
  await reconcileRedesignBadges(db, id);
  const twice = await db.query(`select count(*)::int n from badge_earned where member_id=$1 and badge_id='rewire-milestone'`, [id]);
  assert.equal((twice.rows[0] as { n: number }).n, 1, 'reconciling twice must not duplicate the badge');
});

// ── THE CROSSING EARNS IT, NOT THE NEXT DASHBOARD LOAD ─────────────────────────────────────────────────────
//
// Jennifer, 2026-09-04: closed the Rewire Checkpoint at 18:46:46 and stopped for the night. Her gate was set,
// her `checkpoint_cross` fired, and she had no Rewire badge — because the award lived only in the dashboard
// reconcile and the ceremony was the last thing she saw.
//
// The ceremony had already told her "You earned a new badge!" — `earnedBadgeReveal(phase)` reads the REGISTRY,
// not her record, so it names the badge whether or not she owns it. Reconnect looked honest only because it
// carries a hand-written eager award; the same bug as Greg's, one layer up, in the half that TALKS to her.
//
// So the crossing itself earns it, for all four phases, at the one place the gate is set. A member must never
// be congratulated for a badge that will not exist until she comes back.

import { markCheckpointClosed } from '../lib/curriculum/store.ts';

test('crossing a checkpoint earns the badge THERE — no dashboard load required', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Jennifer','jen@example.test') returning member_id`,
  );
  const id = rows[0]!.member_id;

  await markCheckpointClosed(db, id, { assetId: 'RWR-CHK', eventRef: 'RWR-CHK', phase: 'rewire' });

  // Deliberately NO reconcileRedesignBadges call — this asserts the ceremony can be the last thing she sees.
  const got = await db.query(`select 1 from badge_earned where member_id=$1 and badge_id='rewire-milestone'`, [id]);
  assert.equal(got.rows.length, 1, 'she crossed Rewire and the ceremony named the badge — it must exist now');
});

test('every phase crossing earns its own badge, not just Rewire', async () => {
  // The defect class this file exists for is "fixed at one site, left at the others". Walk all four.
  for (const [gate, badgeId] of Object.entries(PHASE_GATE_BADGE)) {
    const phase = gate.replace('_checkpoint_passed', '');
    const db = new PGlite() as unknown as Db;
    await applySchema(db);
    const { rows } = await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email) values ('M','m-${phase}@example.test') returning member_id`,
    );
    const id = rows[0]!.member_id;

    await markCheckpointClosed(db, id, { assetId: `${phase}-CHK`, eventRef: `${phase}-CHK`, phase });

    const got = await db.query(`select 1 from badge_earned where member_id=$1 and badge_id=$2`, [id, badgeId]);
    assert.equal(got.rows.length, 1, `crossing ${phase} must earn "${badgeId}" at the crossing`);
  }
});

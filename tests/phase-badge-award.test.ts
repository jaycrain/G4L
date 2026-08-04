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
// It also settles a question worth being precise about: this is a lazy backfill, not an eager one. The award
// happens when the member's dashboard reconciles, so an existing member who crossed a checkpoint weeks ago
// gets their badge on next load — not at deploy time.

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

  // Idempotent: Reconnect awards eagerly at the crossing AND through this path, so double-award must be safe.
  await reconcileRedesignBadges(db, id);
  const twice = await db.query(`select count(*)::int n from badge_earned where member_id=$1 and badge_id='rewire-milestone'`, [id]);
  assert.equal((twice.rows[0] as { n: number }).n, 1, 'reconciling twice must not duplicate the badge');
});

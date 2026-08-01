import { test } from 'node:test';
import assert from 'node:assert/strict';

// THE CURRICULUM PRODUCTION ACTUALLY SERVES.
//
// tests/curriculum.test.ts asserts the UNFLAGGED shape (reconnect 7 · rewire 7 · rebuild 6 · reclaim 8) — the
// v1 asset-based program. Production runs REWIRE / REBUILD / RECLAIM = staged, which is the conversational
// flow and a different shape entirely (4 items per phase). So "the whole program is authored" was only ever
// verified for a configuration NO MEMBER WALKS.
//
// Found by accident: sourcing .env.local in the same shell before `npm test` leaked the flags in, and five
// tests went red. The leak was my mistake; the hole it exposed was real, and had been there since the v2.3
// flip. A flag-conditional registry needs its invariants proven on BOTH shapes — the same rule as
// schema-tolerant code, for the same reason: prod runs one of them and the suite was only checking the other.
//
// Env is read at MODULE SCOPE in registry.ts, so the flags must be set before the import, and the import needs
// a unique query string to get a fresh module instance rather than the one the other test file already loaded.

async function stagedRegistry() {
  process.env.REWIRE = 'staged';
  process.env.REBUILD = 'staged';
  process.env.RECLAIM = 'staged';
  return import('../lib/curriculum/registry.ts?staged=1');
}

test('the STAGED program is fully authored — every Session is openable, every phase has one Checkpoint', async () => {
  const { phaseColumns, getAsset } = await stagedRegistry() as typeof import('../lib/curriculum/registry.ts');
  const cols = phaseColumns();

  assert.deepEqual(cols.map((c) => c.phase), ['reconnect', 'rewire', 'rebuild', 'reclaim']);

  for (const c of cols) {
    assert.ok(c.items.length > 0, `${c.phase} has no items at all`);
    assert.equal(
      c.items.filter((i) => i.kind === 'checkpoint').length, 1,
      `${c.phase} must have exactly one Checkpoint — a phase with none can never be crossed, and two would fork the walk`,
    );
    // THE PROPERTY IS "OPENABLE", NOT "HAS STEPS".
    // My first version asserted steps >= 1 and failed on RWR-W1 — correctly, because staged Sessions are
    // CONVERSATIONAL ARCS: their content lives behind a route, not in a steps array. Asserting the v1 shape
    // against the v2 program would have been a test that demanded the old design back.
    // What actually matters to a member is identical either way: they tap it and something happens.
    for (const s of c.items.filter((i) => i.kind === 'session')) {
      const openable = (s.steps?.length ?? 0) >= 1 || Boolean(s.route);
      assert.ok(openable, `${s.id} has neither steps nor a route — a member would tap it and get nothing`);
    }

    // The badge at the end of a phase is the member's evidence they crossed it; a Checkpoint that earns
    // nothing silently drops a milestone from their passport. DERIVED from the column, not a hardcoded id
    // list — staged renames them (RBLD-B4, RCL-C4), and a hardcoded list would have quietly checked assets
    // that don't exist in this shape and passed.
    const cp = c.items.find((i) => i.kind === 'checkpoint')!;
    assert.ok(getAsset(cp.id)?.earns, `${c.phase}'s Checkpoint (${cp.id}) must earn its badge in the staged program too`);
  }
});

test('staged and unflagged are genuinely DIFFERENT programs — this test is not a duplicate', async () => {
  // If the flags ever stop switching the registry, this file would quietly become a copy of curriculum.test.ts
  // and stop covering anything. Assert the difference it exists to cover.
  const staged = await stagedRegistry() as typeof import('../lib/curriculum/registry.ts');
  const counts = Object.fromEntries(staged.phaseColumns().map((c) => [c.phase, c.items.length]));
  assert.notDeepEqual(
    counts,
    { reconnect: 7, rewire: 7, rebuild: 6, reclaim: 8 },
    'the staged registry returned the UNFLAGGED shape — the flags are no longer switching anything',
  );
});

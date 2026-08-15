// THE SEAM: is the categoriser actually WIRED, and is its answer what reaches the database?
//
// tests/reclaim-categorize.test.ts covers the categoriser in isolation. This covers the join — and the join is
// where this feature has failed before. lib/beats/category.ts promised an agent-inferred upgrade for months; the
// prompt asked for it, the model could produce it, and nothing ever called it. Both halves worked. The seam
// didn't exist. Every member's Reclaim List fell through to the v1 keyword heuristic, silently, for months.
//
// ── WHY THIS TEST STUBS THE CATEGORISER ───────────────────────────────────────────────────────────────────
// Offline, categorizeReclaimItems returns the keyword fallback. So does the `?? inferCategory(text)` guard in
// flow.ts. So "the categoriser ran and agreed" and "the categoriser was never called" produce BYTE-IDENTICAL
// rows — and an assertion that can't tell those apart would pass just as happily on the broken code this test
// exists to catch. That is not hypothetical: on 2026-08-15 the real API was unreachable, every item came back
// matching the heuristic, and I read it as "the model concurs" when it meant "the model never answered".
//
// A stub that returns values NO keyword rule would ever produce makes the difference observable.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { scriptedProvider } from '../lib/agent/provider.ts';
import { inferCategory } from '../lib/beats/category.ts';

async function freshDb(): Promise<Db> {
  const db = new PGlite();
  await applySchema(db as unknown as Db);
  return db as unknown as Db;
}

const BASE = {
  displayName: 'Joanne Reed',
  doors: ['body'],
  identityNoun: 'swimmer',
  athleticPast: 'open-water swimmer who raced every summer',
  gap: 'the season ended and I never got back in',
};

// Her real list, and the item that started all of this. The keyword table has `swim` but not `ocean`, so the
// heuristic tags the centre of her identity `self` — and category picks which Beats she is served.
const OCEAN = 'Getting in the ocean regularly.';
const LIST = [OCEAN, 'Sunday dinner with the kids', 'Save for the trip to Portugal'];

async function storedCategories(db: Db, memberId: string): Promise<Array<{ text: string; category: string }>> {
  const res = await db.query<{ text: string; category: string }>(
    `select text, category from reclaim_item where member_id = $1 order by sort_order`,
    [memberId],
  );
  assert.ok(res.rows.length > 0, 'no reclaim_item rows at all — persistence is broken, not just the category');
  return res.rows;
}

test('the categoriser IS called, and its answer is what lands in the database', async (t) => {
  // Values chosen so no keyword rule could produce them: "Sunday dinner with the kids" would be `social` by any
  // heuristic, and here it comes back `outlook`. If the seam were cut, the rows would read social/physical/life
  // and this test would fail — which is the whole point.
  const STUBBED = ['physical', 'outlook', 'physical'];
  let calledWith: string[] | null = null;

  t.mock.module('../lib/beats/categorize.ts', {
    namedExports: {
      categorizeReclaimItems: async (texts: string[]) => {
        calledWith = texts;
        return STUBBED;
      },
    },
  });

  const { runOnboarding } = await import('../lib/gateway/flow.ts?seam=1');
  const db = await freshDb();
  const ob = await runOnboarding(db, scriptedProvider, {
    ...BASE,
    email: 'joanne.seam@example.com',
    reclaimList: LIST,
  });
  assert.equal(ob.ok, true);
  if (!ob.ok) return;

  assert.deepEqual(calledWith, LIST, 'the categoriser is handed the confirmed list, verbatim and in order');

  const rows = await storedCategories(db, ob.memberId);
  assert.deepEqual(
    rows.map((r) => r.category),
    STUBBED,
    'the stored categories are the categoriser\'s, not the keyword heuristic\'s',
  );
  // INDEX-LOCK. A dropped or shifted element would tag the right member with the wrong goal's category — wrong
  // and invisible, rather than missing and obvious. Pin text-to-category, not just the sequence.
  assert.equal(rows.find((r) => r.text === OCEAN)?.category, 'physical', 'the ocean item got the ocean answer');
});

test('a list that ALREADY carries categories is left alone — no second opinion over a first-hand one', async (t) => {
  // The tool-call path can hand back categories assigned during the shaping conversation, with the member's own
  // words still in view. Re-deriving those from the final text would be strictly worse information overwriting
  // strictly better information, so flow.ts only asks when something is genuinely missing.
  let called = false;
  t.mock.module('../lib/beats/categorize.ts', {
    namedExports: {
      categorizeReclaimItems: async (texts: string[]) => {
        called = true;
        return texts.map(() => 'life');
      },
    },
  });

  const { runOnboarding } = await import('../lib/gateway/flow.ts?seam=2');
  const db = await freshDb();
  const ob = await runOnboarding(db, scriptedProvider, {
    ...BASE,
    email: 'joanne.supplied@example.com',
    reclaimList: LIST,
    reclaimCategories: ['physical', 'social', 'life'],
  });
  assert.equal(ob.ok, true);
  if (!ob.ok) return;

  assert.equal(called, false, 'nothing was missing, so the model was never asked');
  assert.deepEqual((await storedCategories(db, ob.memberId)).map((r) => r.category), ['physical', 'social', 'life']);
});

test('a PARTIALLY categorised list still gets asked — one blank must not pass as complete', async (t) => {
  // The structured builder emits reclaimCategories as ['', '', ''] ("assigned later"). That shape is the reason
  // the upgrade never ran. The gate is every-or-ask: one illegal value sends the whole list to the categoriser,
  // because a per-item mix would leave some items model-read and others keyword-read with no way to tell which.
  let called = false;
  t.mock.module('../lib/beats/categorize.ts', {
    namedExports: {
      categorizeReclaimItems: async (texts: string[]) => {
        called = true;
        return texts.map(() => 'outlook');
      },
    },
  });

  const { runOnboarding } = await import('../lib/gateway/flow.ts?seam=3');
  const db = await freshDb();
  const ob = await runOnboarding(db, scriptedProvider, {
    ...BASE,
    email: 'joanne.partial@example.com',
    reclaimList: LIST,
    reclaimCategories: ['physical', '', 'life'], // the builder's real shape, half-filled
  });
  assert.equal(ob.ok, true);
  if (!ob.ok) return;

  assert.equal(called, true, 'a blank category must trigger the categoriser');
  assert.deepEqual((await storedCategories(db, ob.memberId)).map((r) => r.category), ['outlook', 'outlook', 'outlook']);
});

test('when the categoriser THROWS, the signup still completes with legal categories', async (t) => {
  // A category is metadata; a signup is the member. The rule from lib/db/best-effort.ts applies — a measurement
  // may fail, the member's record may not. The real function catches internally, but a caller must not depend on
  // that: if it ever throws, onboarding still has to finish.
  t.mock.module('../lib/beats/categorize.ts', {
    namedExports: {
      categorizeReclaimItems: async () => {
        throw new Error('API unreachable');
      },
    },
  });

  const { runOnboarding } = await import('../lib/gateway/flow.ts?seam=4');
  const db = await freshDb();
  const ob = await runOnboarding(db, scriptedProvider, {
    ...BASE,
    email: 'joanne.throws@example.com',
    reclaimList: LIST,
  });

  assert.equal(ob.ok, true, 'a categoriser failure must never cost a member their signup');
  if (!ob.ok) return;
  const legal = new Set(['physical', 'self', 'social', 'outlook', 'life']);
  for (const r of await storedCategories(db, ob.memberId)) {
    assert.ok(legal.has(r.category), `${r.category} must satisfy the CHECK constraint`);
  }
});

test('the keyword heuristic is what a throw degrades TO — documented, including the miss', async () => {
  // Pinned so the degradation path is a known quantity rather than a surprise. `ocean` is still wrong here, on
  // purpose: bolting it onto the regex would fix this member and not the next one, who will say "back on the
  // water" or "get my laps in". The model pass is the fix; this is only what happens when it can't be reached.
  assert.equal(inferCategory(OCEAN), 'self', 'still the known miss offline');
  assert.equal(inferCategory('Sunday dinner with the kids'), 'social');
});

// ── THE ORDERING PROPERTY: no model call between two halves of an account ──────────────────────────────────────

test('a HANGING categoriser cannot half-create a member', async (t) => {
  // THE REGRESSION THIS EXISTS FOR (prod, 2026-08-15 20:39). categorizeReclaimItems sat between the
  // member_profile insert and addReclaimItems. It hung, the serverless function died mid-signup, and what
  // survived was a member row with four Doors, ZERO Reclaim items and no credential — a person told "you already
  // have an account" at signup and "email or password is incorrect" at login, locked out of an account she could
  // neither use nor replace.
  //
  // A throw was already guarded. A HANG is the harder case: there is no catch to run, so the only defence is
  // ordering — resolve every model call BEFORE the first write. Then a hang delays the signup and fails it
  // cleanly, and a clean failure is retryable in a way that half an account never is.
  //
  // Simulated with a never-resolving stub + a race, because a real hang would just stall this test.
  t.mock.module('../lib/beats/categorize.ts', {
    namedExports: {
      categorizeReclaimItems: () => new Promise(() => {}), // never settles — the prod failure mode
    },
  });

  const { runOnboarding } = await import('../lib/gateway/flow.ts?seam=hang');
  const db = await freshDb();
  const started = runOnboarding(db, scriptedProvider, {
    ...BASE,
    email: 'joanne.hang@example.com',
    reclaimList: LIST,
  });

  // Let it run as far as it can, then look at what it managed to write.
  const outcome = await Promise.race([started, new Promise((r) => setTimeout(() => r('STILL_HANGING'), 300))]);
  assert.equal(outcome, 'STILL_HANGING', 'it should be stuck in the categoriser, not finished');

  const { rows } = await db.query<{ n: number }>('select count(*)::int as n from member_profile');
  assert.equal(
    rows[0]!.n, 0,
    'NOTHING may be written while a model call is outstanding — a hang must leave no half-built member behind',
  );
});

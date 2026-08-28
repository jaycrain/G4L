import test from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_KEYS } from '../lib/workspace/session-key.ts';
import { teachingFor, teachingKeeper, reconnectTaughtSoFar } from '../lib/content/teaching.ts';
import { exploreFor } from '../lib/content/explore.ts';
import { sessionAsset } from '../lib/content/summaries.ts';

// The teaching layer promotes science content from an opt-in widget to a REQUIRED Session beat. These tests hold
// the invariants that make that safe: gates teach nothing, Reconnect resolves by beat, and the kept read is one
// per Session routed to the right tab.

test('every Session key resolves without throwing — gates teach nothing, the rest teach', () => {
  for (const k of SESSION_KEYS) {
    const t = teachingFor(k);
    const isGate = k.endsWith('checkpoint') || k === 'b4' || k === 'c4';
    if (isGate) {
      assert.equal(t.teaches, false, `${k} is a gate and must not open a teaching beat`);
      assert.equal(t.frame, undefined, `${k} must not render a frame`);
    } else {
      assert.equal(t.teaches, true, `${k} must teach`);
      assert.ok(t.frame?.short && t.frame?.full, `${k} needs both frame states`);
    }
  }
});

test('the twelve 1:1 Sessions bracket the work — frame and understand both resolve', () => {
  // NOW TWELVE (2026-08-28). It was nine because Reconnect was ONE session across three assets and could not map
  // 1:1 — the exclusion was a consequence of the arc's shape, not a decision about the science. Splitting the
  // phase into r1/r2/r3 makes each Reconnect Session its own asset, exactly like W1 or B2.
  const oneToOne = SESSION_KEYS.filter((k) => sessionAsset(k));
  assert.equal(oneToOne.length, 12, 'twelve Sessions map 1:1 to an asset');
  for (const k of oneToOne) {
    const t = teachingFor(k);
    assert.ok(t.frame, `${k} frames the work`);
    assert.ok(t.understand?.points.length, `${k} has points to understand`);
    assert.ok(t.understand!.lede, `${k} needs a lede — it doubles as the kept takeaway`);
  }
});

test('each Reconnect Session resolves its OWN science — the per-beat workaround is retired', () => {
  // WHAT THIS REPLACES. Reconnect used to be one arc across three Science Checks, so the card had to be keyed to
  // the asset and shown at that asset's LAST beat — otherwise the same card rendered up to four times in one
  // Session, the product visibly losing track of what it had already told them. That whole mechanism existed to
  // work around the single arc. With three Sessions there is nothing to work around: each Session shows its own
  // card at its own threshold, like every other Session in the product.
  for (const [key, asset] of [['r1', 'r1'], ['r2', 'r2'], ['r3', 'r3']] as const) {
    const t = teachingFor(key);
    assert.ok(t.frame, `${key} frames the work`);
    assert.ok(t.understand?.points.length, `${key} has points to understand`);
    assert.equal(sessionAsset(key), asset, `${key} is ${asset}`);
  }

  // Three distinct cards across the phase, one per Session — the property the old test protected, kept.
  const ledes = (['r1', 'r2', 'r3'] as const).map((k) => teachingFor(k).understand?.lede).filter(Boolean);
  assert.equal(ledes.length, 3, 'three cards across the phase');
  assert.equal(new Set(ledes).size, 3, 'and no member meets the same one twice');
});

test('the kept read defaults to the lede, and a chosen line replaces it', () => {
  const asset = sessionAsset('w1')!;
  const lede = exploreFor(asset)!.lede;

  const dflt = teachingKeeper('w1', 'Disinformation Audit · Rewire');
  assert.equal(dflt?.text, lede, 'default takeaway is the lede');

  const chosen = teachingKeeper('w1', 'Disinformation Audit · Rewire', 'It is too late is the one that does the damage.');
  assert.equal(chosen?.text, 'It is too late is the one that does the damage.', 'a chosen line wins');

  // Whitespace-only is not a choice — it must fall back rather than keep an empty read.
  assert.equal(teachingKeeper('w1', 'x', '   ')?.text, lede, 'blank choice falls back to the lede');
});

test('reads route to "What you\'ve learned" and never to "What worked"', () => {
  // The routing rule: What worked = things you DID (Moves). What you've learned = things that CONVINCED you
  // (Reads). A science takeaway is understanding, not a tactic. Blurring these is what turned the Playbook into
  // a pile once already.
  for (const k of SESSION_KEYS) {
    const keeper = teachingKeeper(k, 'label');
    if (keeper) assert.equal(keeper.tab, 'learned', `${k} read must route to learned`);
  }
});

test('gates keep nothing', () => {
  for (const k of SESSION_KEYS.filter((k) => k.endsWith('checkpoint') || k === 'b4' || k === 'c4')) {
    assert.equal(teachingKeeper(k, 'label'), null, `${k} is a gate — nothing to keep`);
  }
});

test('Reconnect cards PERSIST as the arc moves on, and never appear early', () => {
  // Rendering only the current beat's card would make it vanish when the arc advanced — in a continuous thread
  // that reads as the product retracting something it just said. Derived from the beat rather than held in
  // component state, so a member who leaves and comes back sees the same thread.
  const seen = (stage: string) => reconnectTaughtSoFar(stage);
  assert.deepEqual(seen('entry'), [], 'nothing before R1 closes');
  assert.deepEqual(seen('doors'), ['r1'], "R1's card lands when R1 closes");
  assert.deepEqual(seen('drift'), ['r1', 'r2'], 'R1 stays visible while R2 lands');
  assert.deepEqual(seen('window'), ['r1', 'r2'], 'both stay through the middle of R3');
  assert.deepEqual(seen('ceremony'), ['r1', 'r2', 'r3'], 'all three by the close');
  // An unknown beat must not silently show everything.
  assert.deepEqual(seen('nonsense-beat'), [], 'an unmapped beat shows nothing rather than guessing');
});

test('Reconnect files THREE reads, one per SESSION — they cannot collide on one key', async () => {
  // RECONNECT'S "Got it" WAS A NO-OP while the card promised "we'll keep the takeaway in your Playbook" — the
  // button did nothing and nothing was filed (Donna, 2026-08-18: "the button itself wasn't working"). Wiring it
  // exposed a second fault underneath: keepSessionScience keyed its idempotency check on the SESSION, and
  // Reconnect files one read as each of R1, R2 and R3 closes. Keyed on 'reconnect' alone, the first would file
  // and the other two would report success while writing nothing — the silent-drop shape, again.
  const { keepSessionScience } = await import('../lib/content/teaching-keep.ts');
  const { PGlite } = await import('@electric-sql/pglite');
  const { applySchema } = await import('../lib/db/schema.ts');
  const db = new PGlite() as never;
  await applySchema(db);
  const { rows } = await (db as never as { query: (s: string) => Promise<{ rows: { member_id: string }[] }> })
    .query(`insert into member_profile (display_name, email) values ('R','r@x.test') returning member_id`);
  const m = rows[0]!.member_id;

  // UPDATED 2026-08-28: the three reads now arrive from three SESSIONS rather than three beats of one. The fault
  // this test exists for is unchanged and still worth pinning — an idempotency key that cannot tell them apart
  // files the first and silently drops the other two — but the thing that must differ is now the session key,
  // which is the honest shape. The stage is passed through as it was.
  for (const [key, stage] of [['r1', 'measurement'], ['r2', 'doors'], ['r3', 'legacy']] as const) {
    const r = await keepSessionScience(db, m, key, 'Reconnect', null, stage);
    assert.equal(r.ok, true, `${key} filed`);
  }
  const kept = await (db as never as { query: (s: string, p: unknown[]) => Promise<{ rows: unknown[] }> })
    .query(`select id from playbook_entry where member_id=$1 and source_kind='science'`, [m]);
  assert.equal(kept.rows.length, 3, 'three distinct reads, not one');

  // And still idempotent per card — re-acknowledging must not double-file.
  await keepSessionScience(db, m, 'reconnect', 'Reconnect', null, 'doors');
  const again = await (db as never as { query: (s: string, p: unknown[]) => Promise<{ rows: unknown[] }> })
    .query(`select id from playbook_entry where member_id=$1 and source_kind='science'`, [m]);
  assert.equal(again.rows.length, 3, 'still three');
});

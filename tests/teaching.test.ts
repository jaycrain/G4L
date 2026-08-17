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

test('the nine 1:1 Sessions bracket the work — frame and understand both resolve', () => {
  // Phase 1 ships these nine. Reconnect is deliberately excluded from the first release: it carries the live
  // capture loop, and inserting four render beats into the most fragile arc we have is a separate change.
  const oneToOne = SESSION_KEYS.filter((k) => sessionAsset(k) && k !== 'reconnect');
  assert.equal(oneToOne.length, 9, 'nine Sessions map 1:1 to an asset');
  for (const k of oneToOne) {
    const t = teachingFor(k);
    assert.ok(t.frame, `${k} frames the work`);
    assert.ok(t.understand?.points.length, `${k} has points to understand`);
    assert.ok(t.understand!.lede, `${k} needs a lede — it doubles as the kept takeaway`);
  }
});

test('Reconnect shows each asset\'s science ONCE, at that asset\'s last beat', () => {
  // Reconnect is one arc across three Science Checks, and its seven beats collapse onto three assets: entry and
  // doors both resolve R1, and measurement/window/checkpoint/ceremony all resolve R3. Rendering per BEAT would
  // show the same card up to four times in one Session — the product visibly losing track of what it already
  // told them. Keyed to the ASSET, shown at its LAST beat, so the science closes the activity rather than
  // interrupting it. This is why Reconnect was held out of the teaching layer's first release.
  const teaches = (stage: string) => !!teachingFor('reconnect', stage).understand;

  assert.equal(teaches('entry'), false, 'entry is mid-R1 — the activity is not finished');
  assert.equal(teaches('doors'), true, "doors closes R1's work");
  assert.equal(teaches('drift'), true, 'drift is R2');
  assert.equal(teaches('measurement'), false, 'measurement is mid-R3');
  assert.equal(teaches('window'), false, 'window is mid-R3');
  assert.equal(teaches('checkpoint'), false, 'checkpoint is mid-R3');
  assert.equal(teaches('ceremony'), true, "ceremony closes R3's work");

  // Exactly three cards across the whole arc, and all three distinct.
  const ledes = ['entry', 'doors', 'drift', 'measurement', 'window', 'checkpoint', 'ceremony']
    .map((b) => teachingFor('reconnect', b).understand?.lede)
    .filter(Boolean);
  assert.equal(ledes.length, 3, 'three cards across seven beats');
  assert.equal(new Set(ledes).size, 3, 'and no member meets the same one twice');

  // The frame still opens the whole arc, on every beat.
  assert.ok(teachingFor('reconnect', 'entry').frame, 'the frame is not gated');
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

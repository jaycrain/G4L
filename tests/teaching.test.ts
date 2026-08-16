import test from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_KEYS } from '../lib/workspace/session-key.ts';
import { teachingFor, teachingKeeper } from '../lib/content/teaching.ts';
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

test('Reconnect resolves its understand beat BY BEAT — three distinct panels across the arc', () => {
  // Greg's structure: one continuous arc carrying three Science Checks. The frame opens the arc; the science
  // resolves by beat as the member moves through it.
  //
  // The seven beats collapse onto THREE assets (entry/doors → r1, drift → r2, measurement/window/checkpoint/
  // ceremony → r3). An earlier draft of this test asserted that adjacent beats differ; that was an assumption I
  // invented, and the real map in explore.ts says otherwise. Assert the arc's actual shape instead.
  const beats = ['entry', 'doors', 'drift', 'measurement', 'window'];
  const panels = beats.map((b) => teachingFor('reconnect', b));

  assert.ok(panels.every((p) => p.frame), 'the frame opens the whole arc, on every beat');
  assert.ok(panels.every((p) => p.understand), 'every beat resolves some science');

  const distinct = new Set(panels.map((p) => p.understand!.lede));
  assert.equal(distinct.size, 3, 'three Science Checks across the arc — R1, R2, R3');

  // entry and doors deliberately share R1. This is why Reconnect is NOT in the teaching layer's first release:
  // a member walking the arc would meet the same "Why it works" card twice. Solving that needs a shown-once
  // rule keyed to the asset, not the beat — a separate change, on the surface carrying the live capture loop.
  assert.equal(
    teachingFor('reconnect', 'entry').understand!.lede,
    teachingFor('reconnect', 'doors').understand!.lede,
    'entry and doors share R1 — documented, and the reason Reconnect needs a shown-once rule',
  );
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

// "Every summary must include WHERE THE RESULTS LIVE — if something was directly documented (e.g. a Reclaim List
// item, a True Line), say where to find it; if it was an assessment/quiz with no standalone artifact, explain
// where those results are captured." (Donna's End-of-Session Flow, 2026-08-19.)
//
// The close already said WHAT she built and HOW to leave. The middle third was missing, and its absence produced
// two separate reports from her — "True Lines: no visibility after Session Complete" and "the Reclaim List
// referenced but not shown" — which are one question wearing two hats: I made something, where did it go?

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_KEYS } from '../lib/workspace/session-key.ts';
import { WHERE_IT_LIVES, whereItLives } from '../lib/content/where-it-lives.ts';

const CHECKPOINTS = ['rewire-checkpoint', 'b4', 'c4'] as const;

test('every Session has an answer — a missing one renders nothing at the moment she asks', () => {
  for (const k of SESSION_KEYS) {
    const w = whereItLives(k);
    assert.ok(w?.line?.trim(), `${k}: no line`);
    assert.ok(w.line.length > 40, `${k}: too thin to be an answer — "${w.line}"`);
  }
  assert.equal(Object.keys(WHERE_IT_LIVES).length, SESSION_KEYS.length, 'no orphan entries either');
});

test('a session that PRODUCES something names it and offers the way there', () => {
  for (const k of SESSION_KEYS) {
    if ((CHECKPOINTS as readonly string[]).includes(k)) continue;
    const w = whereItLives(k);
    assert.ok(w.href && w.cta, `${k}: produced an artifact, so there must be somewhere to open`);
    // A QUERY STRING IS ALLOWED — the point of this assertion is the member id, and it was written before the
    // Playbook had tabs. Links that name a tab now carry `?tab=`, so an exact-end anchor rejected the fix for
    // "the closing card didn't take me to the right tab". The member id is still required.
    assert.match(w.href('MID'), /^\/(playbook|dashboard)\/MID(\?[\w=&-]+)?$/, `${k}: the link must carry the member id`);
  }
});

test('a CHECKPOINT says so plainly instead of linking nowhere', () => {
  // The case a generic line cannot cover: she answered a scale, there is no artifact, and that is exactly when a
  // member concludes her answers went nowhere. A dead link would be worse than the silence it replaced.
  for (const k of CHECKPOINTS) {
    const w = whereItLives(k);
    assert.equal(w.href, undefined, `${k}: nothing to open`);
    assert.equal(w.cta, undefined, `${k}: and so no button pretending otherwise`);
    assert.match(w.line, /nothing to file/i, `${k}: it should say so out loud`);
    assert.match(w.line, /Grinta Index/, `${k}: and name where the answers actually went`);
  }
});

test('it says where the thing IS — it does not reassure her that it was saved', () => {
  // "Don't worry, it's saved" answers a doubt she has not voiced and plants it. Our own voice rule: say what the
  // thing IS. This is also the shape that produced "No passing score" at the checkpoints.
  for (const k of SESSION_KEYS) {
    const line = whereItLives(k).line;
    assert.doesNotMatch(line, /don'?t worry|rest assured|safely|no need to/i, `${k}: reassurance, not information`);
    assert.doesNotMatch(line, /\bsit with\b|\bit'?s yours to\b/i, `${k}: retired construction`);
  }
});

test('the artifact is named, not gestured at', () => {
  // "Your work is saved" is the version of this line that helps nobody. Each should name the actual thing.
  const NAMED: Record<string, RegExp> = {
    w1: /true lines/i,
    w2: /picture/i,
    w3: /False Start Protocol/i,
    b1: /why/i,
    b2: /development map/i,
    b3: /Lifestyle Pilot/i,
    c1: /Reclaim List/i,
    c2: /Bigger World Audit/i,
    c3: /Quality Days/i,
    // Each Reconnect Session names ITS OWN artifact now — the single line had to cover all three at once.
    r1: /ID Score/i,
    r2: /Doors/i,
    r3: /Legacy Letter/i,
    r4: /Reclaim List|Doors|ID Score/i,
  };
  for (const [k, re] of Object.entries(NAMED)) {
    assert.match(whereItLives(k as never).line, re, `${k}: name the thing she made`);
  }
});

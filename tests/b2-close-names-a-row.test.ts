// Q23 — WHAT THE B2 CLOSE NAMES, THE B2 GRID HAS A ROW FOR.
//
// The close names one strength ("… is a strength of yours") and one growth edge, then tells the member to notice
// "when a strong skill carries you, and when a weaker one trips you". Both of those need somewhere to go.
//
// The two selections are computed by DIFFERENT code on different sides of the app — skillHighlights() in the
// engine's close, and b2Rows()'s ranking in the practice grid — which is exactly the arrangement that drifts. The
// strength row was added in v3.4.51. This pins BOTH halves against arbitrary profiles rather than one fixture, so
// the day someone changes a selector, the other side speaks up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreSkills, skillHighlights, strongestSkill, growingEdges, skillLabel, SKILLS_ITEM_COUNT } from '../lib/rebuild/skills-instrument.ts';
import { buildSkillsMap } from '../lib/rebuild/skills-map.ts';

/** b2Rows' selection, mirrored from lib/practice/grid.ts — pick by thinnest, display in Greg's family order. */
function gridRowLabels(score: ReturnType<typeof scoreSkills>): string[] {
  const thinnest = new Set(growingEdges(score).map((s) => s.no));
  const edges = buildSkillsMap(score).families.flatMap((f) => f.rows).filter((r) => thinnest.has(r.no));
  if (!edges.length) return []; // degrades to the generic "Noticed a skill" row
  const top = strongestSkill(score);
  return [
    ...(edges.some((e) => e.no === top.no) ? [] : [skillLabel(top.no, top.skill)]),
    ...edges.map((e) => e.label),
  ];
}

// Deterministic pseudo-random so a failure is reproducible — no Math.random in a test that has to be re-run.
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000);
}

test('across 500 arbitrary profiles, the close never names a skill the grid has no row for', () => {
  const rand = lcg(20260827);
  let degraded = 0;
  for (let trial = 0; trial < 500; trial++) {
    const responses = Array.from({ length: SKILLS_ITEM_COUNT }, () => 1 + Math.floor(rand() * 4));
    const score = scoreSkills(responses);
    const { strongest, growthEdge } = skillHighlights(score);
    const labels = gridRowLabels(score);
    if (!labels.length) { degraded++; continue; } // a perfectly flat profile has no edges — generic row, by design

    assert.ok(
      labels.includes(growthEdge),
      `trial ${trial}: the close names growth edge "${growthEdge}" and the grid rows are [${labels.join(' | ')}]`,
    );
    assert.ok(
      labels.includes(strongest),
      `trial ${trial}: the close names strength "${strongest}" and the grid rows are [${labels.join(' | ')}]`,
    );
    assert.equal(labels[0], strongest, `trial ${trial}: the strength leads the grid, as the close speaks it`);
  }
  assert.ok(degraded < 500, 'the generator produced only flat profiles — the test proved nothing');
});

test('the flat profile degrades rather than lying — no edges, so no personalised rows', () => {
  const flat = scoreSkills(Array.from({ length: SKILLS_ITEM_COUNT }, () => 3));
  assert.deepEqual(gridRowLabels(flat), [], 'every skill steady → grid falls back to the generic row');
});

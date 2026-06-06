import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignVariant } from '../lib/assets/variant.ts';
import { assetStatus, availableAssets, recommendedNext, type GateContext } from '../lib/assets/gating.ts';
import { getAssetDefinition } from '../lib/assets/definitions.ts';
import type { DimensionScores } from '../lib/idq/scoring.ts';

test('variant assignment is deterministic per member+asset and roughly even', () => {
  assert.equal(assignVariant('m-1', 'R-4'), assignVariant('m-1', 'R-4')); // stable
  let a = 0;
  for (let i = 0; i < 1000; i++) if (assignVariant(`member-${i}`, 'R-4') === 'a') a++;
  assert.ok(a > 350 && a < 650, `distribution skewed: ${a}/1000 got 'a'`);
});

test('R-4 returns distinct A/B content; default protocol for others', () => {
  assert.equal(getAssetDefinition('R-4', 'a').variant, 'a');
  assert.equal(getAssetDefinition('R-4', 'b').variant, 'b');
  assert.notDeepEqual(getAssetDefinition('R-4', 'a').steps, getAssetDefinition('R-4', 'b').steps);
  assert.equal(getAssetDefinition('W-1').title, 'Disinformation Audit');
});

test('gating: prerequisites lock and unlock correctly', () => {
  const empty: GateContext = { completed: new Set() };
  assert.equal(assetStatus(empty, 'R-1'), 'available'); // no prereqs
  assert.equal(assetStatus(empty, 'R-4'), 'locked'); // needs R-1

  const afterIdq: GateContext = { completed: new Set(['R-1']) };
  assert.equal(assetStatus(afterIdq, 'R-4'), 'available');
  assert.equal(assetStatus(afterIdq, 'R-6'), 'locked');

  const gatewayDone: GateContext = { completed: new Set(['R-1', 'R-4', 'R-6']) };
  assert.deepEqual(availableAssets(gatewayDone).sort(), ['B-1', 'W-1']); // both tracks open in parallel
  assert.equal(assetStatus(gatewayDone, 'W-3'), 'locked'); // needs W-1
  assert.equal(assetStatus(gatewayDone, 'C-1'), 'locked'); // needs W-1 + B-1
});

test('recommendedNext is dosed by current focus (lowest dimension)', () => {
  const completed = new Set(['R-1', 'R-4', 'R-6']);
  const lowPhysical: DimensionScores = { physical: 8, self: 25, social: 25, outlook: 25 };
  assert.equal(recommendedNext({ completed, dimensions: lowPhysical }), 'B-1'); // Rebuild

  const lowSelf: DimensionScores = { physical: 25, self: 8, social: 25, outlook: 25 };
  assert.equal(recommendedNext({ completed, dimensions: lowSelf }), 'W-1'); // Rewire

  assert.equal(recommendedNext({ completed: new Set() }), 'R-1'); // start of the line
});

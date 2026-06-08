import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAssetDefinition } from '../lib/assets/definitions.ts';

test("Greg's Rebuild assets carry real content + a signed Science Check", () => {
  for (const code of ['B-1', 'B-3', 'B-5']) {
    const def = getAssetDefinition(code);
    assert.ok(!def.intro.includes('Draft content'), `${code} is no longer placeholder`);
    assert.ok(def.steps.length >= 4, `${code} has authored steps`);
    assert.ok(def.scienceCheck, `${code} has a Science Check`);
    assert.equal(def.scienceCheck!.attribution, 'Dr. Greg Welk');
    assert.ok(def.scienceCheck!.body.length > 80);
  }
});

test('B-2 (new self-management asset) is authored and in the program order', async () => {
  const def = getAssetDefinition('B-2');
  assert.equal(def.title, 'Appreciating Your Strengths and Weaknesses');
  assert.ok(!def.intro.includes('Draft content'));
  assert.ok(def.steps.length >= 4);
  const { ASSET_ORDER, GATES } = await import('../lib/assets/gating.ts');
  assert.ok(ASSET_ORDER.includes('B-2'));
  assert.deepEqual(GATES['B-2'], { requires: ['B-1'], group: 'Rebuild' });
});

test('an un-authored asset still falls back to the generic placeholder', () => {
  const def = getAssetDefinition('C-3');
  assert.ok(def.intro.includes('Draft content'));
  assert.equal(def.scienceCheck, undefined);
});

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

test('an un-authored asset still falls back to the generic placeholder', () => {
  const def = getAssetDefinition('C-3');
  assert.ok(def.intro.includes('Draft content'));
  assert.equal(def.scienceCheck, undefined);
});

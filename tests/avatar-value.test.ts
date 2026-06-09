import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAvatarValue } from '../lib/member/avatar.ts';

test('accepts a small image data URL and a served path', () => {
  assert.equal(isAvatarValue('data:image/jpeg;base64,' + 'A'.repeat(1000)), true);
  assert.equal(isAvatarValue('data:image/png;base64,' + 'A'.repeat(50)), true);
  assert.equal(isAvatarValue('/avatars/tom.png'), true);
});

test('rejects non-images, non-data junk, and oversized blobs', () => {
  assert.equal(isAvatarValue('https://evil.example/x.png'), false);
  assert.equal(isAvatarValue('javascript:alert(1)'), false);
  assert.equal(isAvatarValue('data:text/html;base64,AAAA'), false);
  assert.equal(isAvatarValue('data:image/jpeg;base64,' + 'A'.repeat(400_000)), false); // too big
});

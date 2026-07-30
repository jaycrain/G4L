import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAvatarValue } from '../lib/member/avatar.ts';

// SEC-17 — the avatar allowlist. `data:image/` alone admits data:image/svg+xml, and an SVG is a document that
// can carry <script>. Not live XSS inside an <img>, but avatars are exactly the value that later gets moved
// into a CSS background or an <object> — pin it to raster now.
test('SVG data URLs are refused — an avatar is a picture, not a document', () => {
  assert.equal(isAvatarValue('data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+'), false);
  assert.equal(isAvatarValue('data:image/svg+xml,<svg onload=alert(1)>'), false);
});

test('real browser-resized avatars still pass', () => {
  assert.equal(isAvatarValue('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='), true);
  assert.equal(isAvatarValue('data:image/jpeg;base64,/9j/4AAQSkZJRg=='), true);
  assert.equal(isAvatarValue('data:image/webp;base64,UklGRh4AAABXRUJQ'), true);
  assert.equal(isAvatarValue('/avatars/tom.png'), true);
});

test('served paths cannot traverse, and junk is refused', () => {
  assert.equal(isAvatarValue('/avatars/../../etc/passwd'), false);
  assert.equal(isAvatarValue('/avatars/a/../b.png'), false);
  assert.equal(isAvatarValue('javascript:alert(1)'), false);
  assert.equal(isAvatarValue('https://evil.example.com/x.png'), false);
  assert.equal(isAvatarValue('data:text/html;base64,PGgxPmhp'), false);
  assert.equal(isAvatarValue(''), false);
  assert.equal(isAvatarValue('data:image/png;base64,' + 'A'.repeat(400_000)), false, 'size cap holds');
});

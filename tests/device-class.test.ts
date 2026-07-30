import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyUserAgent } from '../lib/telemetry/device.ts';
test('device bucket', () => {
  const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
  const IPAD='Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
  const ANDROID='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36';
  const ATAB='Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
  const MAC='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
  assert.equal(classifyUserAgent(IPHONE),'phone');
  assert.equal(classifyUserAgent(IPAD),'tablet','iPad UA contains "Mobile" — must not read as phone');
  assert.equal(classifyUserAgent(ANDROID),'phone');
  assert.equal(classifyUserAgent(ATAB),'tablet','Android tablet omits "Mobile"');
  assert.equal(classifyUserAgent(MAC),'desktop');
  assert.equal(classifyUserAgent(null),null);
  assert.equal(classifyUserAgent(''),null);
});

// WHO CAN READ A MEMBER'S ONBOARDING CONVERSATION.
//
// The intake transcript is the hardest part of somebody's life, told to a product on the promise that it was safe
// to be honest. These pin the boundary.
//
// SPLIT FROM THE PURGE LIST 2026-08-24. It used to gate on `isPurgeable`, so understanding why the product
// declined a real prospect required first making his account destroyable. Different acts; different lists now.

import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { isTranscriptReadable, TRANSCRIPT_READABLE } from '../lib/admin/diagnostic.ts';
import { isPurgeable, PURGEABLE } from '../lib/demo/purge-member.ts';

test('a member on NEITHER list is unreachable — the guarantee that matters', () => {
  for (const stranger of ['someone@gmail.com', 'a.real.member@icloud.com', 'jay@adjacentlabmedia.com']) {
    assert.equal(isTranscriptReadable(stranger), false, `${stranger} must not be readable`);
  }
});

test('reading and destroying are now SEPARATE permissions', () => {
  // Tim is the case that forced the split: we need to understand what happened to him, and must never wipe him.
  assert.equal(isTranscriptReadable('tim@carlin.com'), true, 'readable — we are answering why he was declined');
  assert.equal(isPurgeable('tim@carlin.com'), false, 'and NOT destroyable — he is a prospect, not a fixture');
});

test('.test fixtures are both, because they are nobody', () => {
  assert.equal(isTranscriptReadable('walker@example.test'), true);
  assert.equal(isPurgeable('walker@example.test'), true);
});

test('every named entry carries a reason — a bare address is how a list rots', () => {
  const src = readFileSync('lib/admin/diagnostic.ts', 'utf8');
  const block = src.slice(src.indexOf('export const TRANSCRIPT_READABLE'), src.indexOf('] as const;', src.indexOf('export const TRANSCRIPT_READABLE')));
  for (const addr of TRANSCRIPT_READABLE) {
    const line = block.split('\n').find((l) => l.includes(addr)) ?? '';
    assert.match(line, /\/\/\s*\S+/, `${addr} has no reason beside it — say who they are and why`);
  }
  assert.ok(PURGEABLE.length >= 1, 'the purge list still exists and is still its own decision');
});

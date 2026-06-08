import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeNudges, topNudge, type NudgeSignals } from '../lib/agent/nudge.ts';

const base: NudgeSignals = {
  hasIdq: true,
  daysSinceLastIdq: 5,
  recentAssetName: null,
  daysSinceRecentAsset: null,
  daysSinceActivity: 2,
  direction: null,
  delta: null,
  nextAssetName: null,
};

const BANNED = [/\bjourney\b/i, /\bI hear you\b/i, /\bamazing\b/i];
const clean = (t: string) => BANNED.every((re) => !re.test(t));

test('no IDQ yet → the top nudge points to the IDQ', () => {
  const n = topNudge({ ...base, hasIdq: false });
  assert.equal(n.kind, 'idq_baseline');
});

test('IDQ overdue (>=60d) outranks a recent asset', () => {
  const n = topNudge({ ...base, daysSinceLastIdq: 65, recentAssetName: 'Fuel Plan', daysSinceRecentAsset: 1 });
  assert.equal(n.kind, 'idq_due');
});

test('a fresh asset completion is witnessed', () => {
  const n = topNudge({ ...base, recentAssetName: 'Window Exercise', daysSinceRecentAsset: 1 });
  assert.equal(n.kind, 'asset_reflect');
  assert.match(n.text, /Window Exercise/);
});

test('a long silence is caught gently', () => {
  const n = topNudge({ ...base, daysSinceActivity: 14 });
  assert.equal(n.kind, 'silence');
});

test('a downward score check-in outranks the next-asset prompt', () => {
  const n = topNudge({ ...base, direction: 'down', nextAssetName: 'Identity Excavation' });
  assert.equal(n.kind, 'down');
});

test('with nothing pressing, it offers the next asset; default is the floor', () => {
  assert.equal(topNudge({ ...base, nextAssetName: 'Identity Excavation' }).kind, 'next_asset');
  assert.equal(topNudge(base).kind, 'default');
});

test("today's GRINTA! bite surfaces — below pressing signals, above the next-asset prompt", () => {
  assert.equal(topNudge({ ...base, biteReadyTitle: 'What “Grinta” actually is' }).kind, 'bite_ready');
  assert.equal(
    topNudge({ ...base, biteReadyTitle: 'x', recentAssetName: 'Window Exercise', daysSinceRecentAsset: 1 }).kind,
    'asset_reflect',
  );
  assert.equal(topNudge({ ...base, biteReadyTitle: 'x', nextAssetName: 'Identity Excavation' }).kind, 'bite_ready');
});

test('all nudge copy respects the brand voice', () => {
  for (const sig of [
    { ...base, hasIdq: false },
    { ...base, recentAssetName: 'Fuel Plan', daysSinceRecentAsset: 0 },
    { ...base, daysSinceActivity: 20 },
    { ...base, direction: 'up' as const, delta: 5 },
  ]) {
    for (const nudge of computeNudges(sig)) assert.ok(clean(nudge.text), `clean: ${nudge.text}`);
  }
});

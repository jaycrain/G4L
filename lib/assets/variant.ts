// Deterministic A/B variant assignment for variant-capable assets (the Reconnect A/B test,
// Decision Log Jun 4). Same member + asset always resolves to the same variant, so the
// experience is stable and per-variant telemetry is clean. No storage needed.

import type { AssetVariant } from './types.ts';

export function assignVariant(memberId: string, assetCode: string): AssetVariant {
  // FNV-1a over memberId:assetCode → even split.
  let h = 2166136261;
  for (const ch of `${memberId}:${assetCode}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2 === 0 ? 'a' : 'b';
}

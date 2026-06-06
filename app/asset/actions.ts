'use server';

import { getDb } from '../../lib/db/index.ts';
import { completeAsset } from '../../lib/assets/engine.ts';
import type { Db } from '../../lib/db/schema.ts';
import type { AssetVariant } from '../../lib/assets/types.ts';

export async function completeAssetAction(input: {
  memberId: string;
  code: string;
  variant?: AssetVariant;
  version: string;
  outputs: Record<string, unknown>;
  reflection?: string;
}): Promise<{ ok: boolean; errors?: string[] }> {
  const db = (await getDb()) as unknown as Db;
  try {
    await completeAsset(db, { ...input });
    return { ok: true };
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : 'Could not save this asset.'] };
  }
}

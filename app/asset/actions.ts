'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getDb } from '../../lib/db/index.ts';
import { completeAsset } from '../../lib/assets/engine.ts';
import { maybeTriggerDraft } from '../../lib/founder/triggers.ts';
import { ASSET_NAMES } from '../../lib/assets/definitions.ts';
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
    // Founder Agent auto-trigger: draft a milestone note for Jay's review queue. Runs AFTER the
    // response so the member never waits on draft generation; it only ever drafts, never sends.
    after(async () => {
      await maybeTriggerDraft(db, input.memberId, {
        kind: 'milestone',
        assetCode: input.code,
        assetName: ASSET_NAMES[input.code] ?? input.code,
      });
      revalidatePath('/admin');
      revalidatePath(`/admin/member/${input.memberId}`);
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : 'Could not save this asset.'] };
  }
}

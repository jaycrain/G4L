'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '../../lib/db/index.ts';
import { completeAsset } from '../../lib/assets/engine.ts';
import { maybeTriggerDraft } from '../../lib/founder/triggers.ts';
import { ASSET_NAMES } from '../../lib/assets/definitions.ts';
import { authorizeMember } from '../authz.ts';
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
  if (!(await authorizeMember(input.memberId))) return { ok: false, errors: ['Not authorized.'] };
  const db = (await getDb()) as unknown as Db;
  try {
    await completeAsset(db, { ...input });
    // Founder Agent auto-trigger: draft a milestone note into Jay's review queue. Drafted inline
    // so it's reliably queued the moment the member finishes; only ever drafts, never sends, and
    // a draft failure can't fail the completion (maybeTriggerDraft is graceful).
    await maybeTriggerDraft(db, input.memberId, {
      kind: 'milestone',
      assetCode: input.code,
      assetName: ASSET_NAMES[input.code] ?? input.code,
    });
    revalidatePath('/admin');
    revalidatePath(`/admin/member/${input.memberId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : 'Could not save this asset.'] };
  }
}

import { getDb } from '../../../lib/db/index.ts';
import { getAssetDefinition } from '../../../lib/assets/definitions.ts';
import { assignVariant } from '../../../lib/assets/variant.ts';
import { startAsset } from '../../../lib/assets/engine.ts';
import type { Db } from '../../../lib/db/schema.ts';
import AssetForm from '../asset-form.tsx';

export default async function AssetPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ member?: string }>;
}) {
  const { code } = await params;
  const { member } = await searchParams;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!member || !UUID_RE.test(member)) {
    return <p className="error">No member in context. Start at the beginning.</p>;
  }

  const db = (await getDb()) as unknown as Db;
  const exists = (await db.query('select 1 from member_profile where member_id = $1', [member])).rows[0];
  if (!exists) return <p className="error">We couldn&apos;t find that member.</p>;

  const meta = (
    await db.query<{ supports_variants: boolean }>('select supports_variants from atlas_asset where code = $1', [code])
  ).rows[0];
  if (!meta) return <p className="error">Unknown asset.</p>;

  const variant = meta.supports_variants ? assignVariant(member, code) : undefined;
  const def = getAssetDefinition(code, variant);
  await startAsset(db, { memberId: member, code, variant }); // telemetry: started

  return <AssetForm memberId={member} def={def} variant={variant} />;
}

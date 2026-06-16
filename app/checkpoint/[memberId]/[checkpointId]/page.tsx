import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../../lib/db/index.ts';
import { authorizeMember } from '../../../authz.ts';
import { getAsset } from '../../../../lib/curriculum/registry.ts';
import { listFacets, hasGate } from '../../../../lib/curriculum/store.ts';
import { checkpointOpening } from '../../../../lib/agent/checkpoint-guide.ts';
import { getPlaybookSynthesis } from '../../../../lib/agent/playbook-synthesis.ts';
import { DOORS, isDoorSlug } from '../../../../lib/doors.ts';
import type { Db } from '../../../../lib/db/schema.ts';

const doorName = (slug: string): string => DOORS.find((d) => d.slug === slug)?.displayName ?? slug;
import CheckpointCeremony from './checkpoint-ceremony.tsx';

export const maxDuration = 30;

// The Reconnect Checkpoint — the one firm gate, as a center-stage ceremony.
export default async function CheckpointPage({ params }: { params: Promise<{ memberId: string; checkpointId: string }> }) {
  const { memberId, checkpointId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const asset = getAsset(checkpointId);
  if (!asset || asset.kind !== 'checkpoint') redirect(`/dashboard/${memberId}`);

  const db = (await getDb()) as unknown as Db;

  // Already crossed → no re-gating; send them back to the dashboard.
  if (await hasGate(db, memberId, `${asset.phase}_checkpoint_passed`)) redirect(`/dashboard/${memberId}`);

  const prof = (
    await db.query<{ display_name: string; agent_memory: string | null }>('select display_name, agent_memory from member_profile where member_id=$1', [memberId])
  ).rows[0];
  const doorRows = (await db.query<{ door_slug: string }>('select door_slug from member_door where member_id=$1 order by sort_order', [memberId])).rows;
  const doors = doorRows.map((r) => r.door_slug).filter(isDoorSlug).map((s) => doorName(s));
  const facets = (await listFacets(db, memberId)).map((f) => f.text);

  const opening = await checkpointOpening({
    displayName: prof?.display_name ?? 'there',
    facets,
    doors,
    memory: prof?.agent_memory ?? null,
    synthesis: await getPlaybookSynthesis(db, memberId),
  });

  return (
    <>
      <div className="crumb">
        <Link href={`/dashboard/${memberId}`} className="back-link">← Dashboard</Link>
        <span className="where">{asset.phase} · Checkpoint</span>
      </div>
      <CheckpointCeremony memberId={memberId} checkpointId={checkpointId} title={asset.title} opening={opening} facets={facets} />
    </>
  );
}

'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '../../../../lib/db/index.ts';
import { authorizeMember } from '../../../authz.ts';
import { getAsset, getBadge, listCurriculum, PHASE_ORDER } from '../../../../lib/curriculum/registry.ts';
import { setGate, earnBadge, listFacets } from '../../../../lib/curriculum/store.ts';
import { checkpointAffirmation, checkpointHold, type CheckpointCtx } from '../../../../lib/agent/checkpoint-guide.ts';
import { getPlaybookSynthesis, refreshPlaybookSynthesis } from '../../../../lib/agent/playbook-synthesis.ts';
import { getReclaimItems, markReclaimReclaimedByText } from '../../../../lib/beats/store.ts';
import { DOORS, isDoorSlug } from '../../../../lib/doors.ts';
import { logEvent } from '../../../../lib/telemetry/store.ts';
import type { Db } from '../../../../lib/db/schema.ts';

export type ReclaimDisposition = { text: string; disposition: 'reclaimed' | 'moving' | 'release' };

/** The Reclaim capstone's goal-reconciliation: walk the Reclaim List against where each item landed.
 * Reclaimed → mark it + drop the Goal Reclaimed badge. Moving / not-this-lap → carries to the next lap.
 * Feeds the badges + Playbook synthesis + the Loop. Run before the capstone declaration. */
export async function reconcileReclaim(
  memberId: string,
  dispositions: ReclaimDisposition[],
): Promise<{ ok: boolean; reclaimed: number; carried: number; badgeName: string | null }> {
  if (!(await authorizeMember(memberId))) return { ok: false, reclaimed: 0, carried: 0, badgeName: null };
  try {
    const db = (await getDb()) as unknown as Db;
    let reclaimed = 0;
    let carried = 0;
    for (const d of dispositions) {
      if (d.disposition === 'reclaimed') {
        const r = await markReclaimReclaimedByText(db, memberId, d.text);
        if (r.ok) reclaimed++;
      } else {
        carried++; // moving + not-this-lap both carry to the next lap (the Loop); nothing destroyed
      }
    }
    let badgeName: string | null = null;
    if (reclaimed > 0) {
      await earnBadge(db, memberId, 'goal-reclaimed');
      badgeName = getBadge('goal-reclaimed')?.name ?? null;
    }
    await refreshPlaybookSynthesis(db, memberId); // the reconciliation re-weaves the story
    revalidatePath(`/dashboard/${memberId}`);
    return { ok: true, reclaimed, carried, badgeName };
  } catch {
    return { ok: false, reclaimed: 0, carried: 0, badgeName: null };
  }
}

/** The Reclaim List for the capstone reconciliation UI (text + current state). */
export async function reclaimForReconcile(memberId: string): Promise<{ text: string; state: string }[]> {
  if (!(await authorizeMember(memberId))) return [];
  try {
    const db = (await getDb()) as unknown as Db;
    return (await getReclaimItems(db, memberId)).map((i) => ({ text: i.text, state: i.state }));
  } catch {
    return [];
  }
}

const doorName = (slug: string): string => DOORS.find((d) => d.slug === slug)?.displayName ?? slug;

async function buildCtx(db: Db, memberId: string, reflection?: string): Promise<CheckpointCtx> {
  const prof = (
    await db.query<{ display_name: string; agent_memory: string | null }>('select display_name, agent_memory from member_profile where member_id=$1', [memberId])
  ).rows[0];
  const doorRows = (await db.query<{ door_slug: string }>('select door_slug from member_door where member_id=$1 order by sort_order', [memberId])).rows;
  const doors = doorRows.map((r) => r.door_slug).filter(isDoorSlug).map((s) => doorName(s));
  const facets = (await listFacets(db, memberId)).map((f) => f.text);
  const synthesis = await getPlaybookSynthesis(db, memberId);
  return { displayName: prof?.display_name ?? 'there', facets, doors, memory: prof?.agent_memory ?? null, reflection, synthesis };
}

function firstSessionOfNextPhase(phase: string): { id: string; title: string } | null {
  const idx = PHASE_ORDER.indexOf(phase as (typeof PHASE_ORDER)[number]);
  const next = PHASE_ORDER[idx + 1];
  if (!next) return null;
  const s = listCurriculum()
    .filter((a) => a.phase === next && a.kind === 'session')
    .sort((x, y) => x.order - y.order)[0];
  return s ? { id: s.id, title: s.title } : null;
}

export type DeclareResult =
  | { ok: true; affirmation: string; badgeName: string | null; firstRewire: { id: string; title: string } | null }
  | { ok: false };

/** The pass: member-as-authority declares they've reconnected. Sets the gate + unlocks the next
 * phase, earns the milestone badge, and affirms from their own words. Reliability: writes, then reports. */
export async function declareReconnected(memberId: string, checkpointId: string, reflection: string): Promise<DeclareResult> {
  if (!(await authorizeMember(memberId))) return { ok: false };
  const asset = getAsset(checkpointId);
  if (!asset || asset.kind !== 'checkpoint') return { ok: false };
  try {
    const db = (await getDb()) as unknown as Db;
    const idx = PHASE_ORDER.indexOf(asset.phase);
    const next = PHASE_ORDER[idx + 1];
    await setGate(db, memberId, `${asset.phase}_checkpoint_passed`);
    if (next) await setGate(db, memberId, `${next}_unlocked`);
    await logEvent(db, memberId, 'checkpoint_cross', { surface: 'checkpoint', ref: checkpointId, meta: { phase: asset.phase } });
    let badgeName: string | null = null;
    if (asset.earns) {
      await earnBadge(db, memberId, asset.earns);
      badgeName = getBadge(asset.earns)?.name ?? null;
    }
    const firstRewire = firstSessionOfNextPhase(asset.phase);
    const ctx = await buildCtx(db, memberId, reflection);
    const affirmation = await checkpointAffirmation(ctx, firstRewire?.title ?? 'your next Session');
    revalidatePath(`/dashboard/${memberId}`); // surface the dropped badge + next phase immediately
    return { ok: true, affirmation, badgeName, firstRewire };
  } catch {
    return { ok: false };
  }
}

/** "Not yet" — the firm hold. Changes NO state; returns the warm, transparent hold. */
export async function holdNotYet(memberId: string, checkpointId: string, reflection: string): Promise<{ hold: string }> {
  if (!(await authorizeMember(memberId))) return { hold: '' };
  try {
    const db = (await getDb()) as unknown as Db;
    const ctx = await buildCtx(db, memberId, reflection);
    return { hold: await checkpointHold(ctx) };
  } catch {
    return { hold: "Not yet — and that's okay. Stay in Reconnect a little longer; I'm here." };
  }
}

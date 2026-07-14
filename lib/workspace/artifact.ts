// Redesign Layer 3 — the WORKSPACE artifact reader. The canvas shows "the work made visible": what the session is
// building, read back from committed state (never the chat client's private mid-turn state — we don't touch the arc
// engine). Polled by the client so it lands as the conversation commits. Reconnect gets a real assembling artifact
// (identity · Doors · Reclaim List); the other sessions get a graceful frame until their per-artifact readers land.

import type { Db } from '../db/schema.ts';
import type { SessionKey } from './session-key.ts';
import { sessionById } from './session-registry.ts';
import { getDashboard } from '../gateway/flow.ts';

export type ArtifactSlot = { label: string; value: string | null };
export type Artifact = { title: string; lede: string; slots: ArtifactSlot[]; foot: string };

const GENERIC_FOOT = 'You go one prompt at a time, at your own pace. Nothing here is scored — it lands in your Playbook.';

export async function readArtifact(db: Db, memberId: string, key: SessionKey): Promise<Artifact> {
  if (key === 'reconnect') return reconnectArtifact(db, memberId).catch(() => genericArtifact(key));
  return genericArtifact(key);
}

function genericArtifact(key: SessionKey): Artifact {
  const def = sessionById(key);
  return {
    title: def?.label ?? 'Your session',
    lede: 'This fills in your own words as you and the Companion talk — and it becomes yours to keep.',
    slots: [],
    foot: GENERIC_FOOT,
  };
}

async function reconnectArtifact(db: Db, memberId: string): Promise<Artifact> {
  const dash = await getDashboard(db, memberId);
  const doors = dash?.doors.map((d) => d.displayName) ?? [];
  const items = dash?.reclaimItems.map((i) => i.text) ?? [];
  return {
    title: 'Who you’re reclaiming',
    lede: 'This is what Reconnect brings into focus — in your words. It becomes the ground the whole program works from.',
    slots: [
      { label: 'The self you’re reclaiming', value: dash?.identityNoun ? `the ${dash.identityNoun}` : null },
      { label: `The Door${doors.length > 1 ? 's' : ''} you named`, value: doors.length ? doors.join(' · ') : null },
      { label: 'Your Reclaim List', value: items.length ? items.join('\n') : null },
    ],
    foot: GENERIC_FOOT,
  };
}

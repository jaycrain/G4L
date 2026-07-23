'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { syncNowAction } from './actions.ts';

// Member-triggered "Sync now" on the Movement page — a manual provider pull that bypasses the on-open throttle, so a
// just-finished ride (or one held up by Strava upload lag) can be fetched on demand. Best-effort + never-throws on the
// server; here we just reflect pending → result and refresh the RSC so new activities render.
export default function SyncNow({ memberId, syncedLabel }: { memberId: string; syncedLabel: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    if (pending) return;
    setPending(true);
    setResult(null);
    const r = await syncNowAction(memberId);
    setPending(false);
    if (!r.ok) {
      setResult(r.error ?? 'Could not sync.');
      return;
    }
    setResult(r.synced ? `Added ${r.synced} new.` : 'Up to date.');
    router.refresh(); // revalidatePath ran server-side; pull the fresh panel
  }

  return (
    <div className="mv-sync">
      <button type="button" className="mv-sync-btn" onClick={run} disabled={pending}>
        {pending ? 'Syncing…' : 'Sync now'}
      </button>
      <span className="mv-sync-note">{result ?? (syncedLabel ? `Last synced ${syncedLabel}` : 'Not synced yet')}</span>
    </div>
  );
}

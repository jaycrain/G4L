import { notFound } from 'next/navigation';
import { reclaimEnabled } from '../../../../lib/agent/reclaim.ts';
import ReclaimChat from '../../reclaim-chat.tsx';

// v2.5 Reclaim — C3 · Quality Days Practice (Step 1: define the Quality Day). Flag-gated (RECLAIM). A coaching
// conversation that defines the member's Quality-Day profile → opens the week of daily logging (/quality-day).
export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  if (!reclaimEnabled()) notFound();
  const { memberId } = await params;
  return (
    <main className="reconnect-page">
      <ReclaimChat memberId={memberId} session="c3" />
    </main>
  );
}

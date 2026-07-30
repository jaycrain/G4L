import { notFound } from 'next/navigation';
import { reclaimEnabled } from '../../../../lib/agent/reclaim.ts';
import ReclaimChat from '../../reclaim-chat.tsx';

// v2.5 Reclaim — C2 · The Bigger World Audit. Flag-gated (RECLAIM). An administered four-domain (Physical/Self/Social/
// Outlook) priority audit (20 ratings, 1–10) → the RC-1 Primary Priority + Momentum Lever summary (durably stored).
export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  if (!reclaimEnabled()) notFound();
  const { memberId } = await params;
  return (
    <main className="reconnect-page">
      <ReclaimChat memberId={memberId} session="c2" />
    </main>
  );
}

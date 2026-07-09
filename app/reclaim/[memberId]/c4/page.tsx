import { notFound } from 'next/navigation';
import { reclaimEnabled } from '../../../../lib/agent/reclaim.ts';
import ReclaimChat from '../../reclaim-chat.tsx';

// v2.5 Reclaim — C4 · The Reclaim Checkpoint + ceremony (the capstone, closes Cycle 1). Flag-gated (RECLAIM). The
// administered Challenge read (6 items) → the earned ceremony overlay (the chat fires it on stage 'ceremony'), which
// moves the Challenge component of Grinta, revisits the Legacy, and invites the Community Success Story → the Loop.
export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  if (!reclaimEnabled()) notFound();
  const { memberId } = await params;
  return (
    <main className="reconnect-page">
      <ReclaimChat memberId={memberId} session="checkpoint" />
    </main>
  );
}

import { notFound } from 'next/navigation';
import { rebuildEnabled } from '../../../../lib/agent/rebuild.ts';
import RebuildChat from '../../rebuild-chat.tsx';

// v2.4 Rebuild — B4 · The Rebuild Checkpoint + ceremony (the Phase-3 close). Flag-gated (REBUILD). The administered
// Control read (12 items → pairwise 12→6) → the earned ceremony overlay (the chat fires it on stage 'ceremony'),
// which moves the Control component of Grinta and lights Reclaim.
export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  if (!rebuildEnabled()) notFound();
  const { memberId } = await params;
  return (
    <main className="reconnect-page">
      <RebuildChat memberId={memberId} session="checkpoint" />
    </main>
  );
}

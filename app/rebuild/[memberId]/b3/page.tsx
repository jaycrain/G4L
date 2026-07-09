import { notFound } from 'next/navigation';
import { rebuildEnabled } from '../../../../lib/agent/rebuild.ts';
import RebuildChat from '../../rebuild-chat.tsx';

// v2.4 Rebuild — B3 · The Lifestyle Pilot (the Elevation asset, the marquee). Flag-gated (REBUILD). A LIVE coaching
// conversation (COACH mode) that lands one small activity change + one small diet change → a confirmed plan → the
// pilot logging week (Part B, on the practice-week scaffold).
export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  if (!rebuildEnabled()) notFound();
  const { memberId } = await params;
  return (
    <main className="reconnect-page">
      <RebuildChat memberId={memberId} session="b3" />
    </main>
  );
}

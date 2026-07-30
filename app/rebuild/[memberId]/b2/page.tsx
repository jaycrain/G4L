import { notFound } from 'next/navigation';
import { rebuildEnabled } from '../../../../lib/agent/rebuild.ts';
import RebuildChat from '../../rebuild-chat.tsx';

// v2.4 Rebuild — B2 · Appreciating Your Strengths and Weaknesses (the Structure asset). Flag-gated (REBUILD). The
// administered 24-item self-management assessment → a plain-language strengths/growth-edge reflection → the noticing
// week (Part B, on the practice-week scaffold).
export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  if (!rebuildEnabled()) notFound();
  const { memberId } = await params;
  return (
    <main className="reconnect-page">
      <RebuildChat memberId={memberId} session="b2" />
    </main>
  );
}

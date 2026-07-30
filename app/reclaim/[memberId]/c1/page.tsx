import { notFound } from 'next/navigation';
import { reclaimEnabled } from '../../../../lib/agent/reclaim.ts';
import ReclaimChat from '../../reclaim-chat.tsx';

// v2.5 Reclaim — C1 · Readiness Assessment (Step 1: the evidence self-check). Flag-gated (RECLAIM); the route doesn't
// exist in prod until the v2.5 flip. An administered, FORMATIVE evidence read → the reflective "are you in Reclaim"
// mirror. (Step 2, the Reclaim List refinement, lands in a follow-up slice.)
export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  if (!reclaimEnabled()) notFound();
  const { memberId } = await params;
  return (
    <main className="reconnect-page">
      <ReclaimChat memberId={memberId} session="c1" />
    </main>
  );
}

import { notFound } from 'next/navigation';
import { rewireEnabled } from '../../../../lib/agent/rewire.ts';
import RewireChat from '../../rewire-chat.tsx';

// v2.3 Rewire — the R4 Checkpoint + ceremony (the Phase-2 close). Flag-gated (REWIRE); the route doesn't exist in prod
// until the v2.3 flip. The administered Commitment read → the earned ceremony overlay (the chat fires it on 'ceremony').
export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  if (!rewireEnabled()) notFound();
  const { memberId } = await params;
  return (
    <main className="reconnect-page">
      <RewireChat memberId={memberId} session="checkpoint" />
    </main>
  );
}

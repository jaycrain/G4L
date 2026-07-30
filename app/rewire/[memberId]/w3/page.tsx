import { notFound } from 'next/navigation';
import { rewireEnabled } from '../../../../lib/agent/rewire.ts';
import RewireChat from '../../rewire-chat.tsx';

// v2.3 Rewire — the W3 (False Start Protocol) session surface. Flag-gated (REWIRE); the route doesn't exist in prod
// until the v2.3 flip. W3 pulls the member's W1 true lines + W2 image FORWARD (the start action reads them).
export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  if (!rewireEnabled()) notFound();
  const { memberId } = await params;
  return (
    <main className="reconnect-page">
      <RewireChat memberId={memberId} session="w3" />
    </main>
  );
}

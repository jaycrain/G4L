import { notFound } from 'next/navigation';
import { rewireEnabled } from '../../../../lib/agent/rewire.ts';
import RewireChat from '../../rewire-chat.tsx';

// v2.3 Rewire — the W1 (Disinformation Audit) session surface, at the route the forecast links to
// (`/rewire/{memberId}/w1`). The base `/rewire/[memberId]` also renders W1 (RewireChat defaults session='w1'),
// but the curriculum's RWR-W1 asset routes to `/rewire/{memberId}/w1` — which had no page, so it 404'd while
// w2/w3/checkpoint all resolved. This mirrors the w2/w3 sub-routes so W1 is reachable + consistent. Flag-gated.
export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  if (!rewireEnabled()) notFound();
  const { memberId } = await params;
  return (
    <main className="reconnect-page">
      <RewireChat memberId={memberId} session="w1" />
    </main>
  );
}

import { notFound } from 'next/navigation';
import { rewireEnabled } from '../../../lib/agent/rewire.ts';
import RewireChat from '../rewire-chat.tsx';

// v2.3 Rewire — the W1 (Disinformation Audit) session surface. Flag-gated: with REWIRE off (prod, until the v2.3
// flip) this route does not exist. Reached from the dashboard's "Begin Rewire" entry (or directly, for a felt-walk).
export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  if (!rewireEnabled()) notFound();
  const { memberId } = await params;
  return (
    <main className="reconnect-page">
      <RewireChat memberId={memberId} />
    </main>
  );
}

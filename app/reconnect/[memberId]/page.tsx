import { notFound } from 'next/navigation';
import { reconnectEnabled } from '../../../lib/agent/reconnect.ts';
import { mobileEnabled } from '../../../lib/dashboard/redesign.ts';
import ReconnectChat from '../reconnect-chat.tsx';

// v2.2 Reconnect — the session surface (SKELETON: callback §2a → Doors stub). Flag-gated: with RECONNECT off
// (prod, always, until the coupled v2.1+v2.2 flip) this route does not exist. Reached from the dashboard.
export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  if (!reconnectEnabled()) notFound();
  const { memberId } = await params;
  return (
    <main className="reconnect-page">
      <ReconnectChat memberId={memberId} mobile={mobileEnabled()} />
    </main>
  );
}

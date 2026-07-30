import { notFound, redirect } from 'next/navigation';
import { reconnectEnabled } from '../../../lib/agent/reconnect.ts';
import { mobileEnabled } from '../../../lib/dashboard/redesign.ts';
import ReconnectChat from '../reconnect-chat.tsx';
import { authorizeMember } from '../../authz.ts';

// v2.2 Reconnect — the session surface (SKELETON: callback §2a → Doors stub). Flag-gated: with RECONNECT off
// (prod, always, until the coupled v2.1+v2.2 flip) this route does not exist. Reached from the dashboard.
export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  if (!reconnectEnabled()) notFound();
  const { memberId } = await params;
  // SEC-11: guard the PAGE, not just the actions. The actions behind these surfaces are authorized, so this
  // was never a data leak — but an unauthenticated visitor got a rendered session shell that then errored,
  // instead of being sent to log in. Guarding here makes the boundary uniform, and means any future page that
  // does fetch server-side inherits it rather than having to remember.
  if (!(await authorizeMember(memberId))) redirect('/login');
  return (
    <main className="reconnect-page">
      <ReconnectChat memberId={memberId} mobile={mobileEnabled()} />
    </main>
  );
}

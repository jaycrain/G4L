import { notFound, redirect } from 'next/navigation';
import { rewireEnabled } from '../../../../lib/agent/rewire.ts';
import RewireChat from '../../rewire-chat.tsx';
import { authorizeMember } from '../../../authz.ts';

// v2.3 Rewire — the W3 (False Start Protocol) session surface. Flag-gated (REWIRE); the route doesn't exist in prod
// until the v2.3 flip. W3 pulls the member's W1 true lines + W2 image FORWARD (the start action reads them).
export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  if (!rewireEnabled()) notFound();
  const { memberId } = await params;
  // SEC-11: guard the PAGE, not just the actions. The actions behind these surfaces are authorized, so this
  // was never a data leak — but an unauthenticated visitor got a rendered session shell that then errored,
  // instead of being sent to log in. Guarding here makes the boundary uniform, and means any future page that
  // does fetch server-side inherits it rather than having to remember.
  if (!(await authorizeMember(memberId))) redirect('/login');
  return (
    <main className="reconnect-page">
      <RewireChat memberId={memberId} session="w3" />
    </main>
  );
}

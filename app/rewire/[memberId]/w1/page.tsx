import { notFound, redirect } from 'next/navigation';
import { rewireEnabled } from '../../../../lib/agent/rewire.ts';
import RewireChat from '../../rewire-chat.tsx';
import { authorizeMember } from '../../../authz.ts';

// v2.3 Rewire — the W1 (Disinformation Audit) session surface, at the route the forecast links to
// (`/rewire/{memberId}/w1`). The base `/rewire/[memberId]` also renders W1 (RewireChat defaults session='w1'),
// but the curriculum's RWR-W1 asset routes to `/rewire/{memberId}/w1` — which had no page, so it 404'd while
// w2/w3/checkpoint all resolved. This mirrors the w2/w3 sub-routes so W1 is reachable + consistent. Flag-gated.
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
      <RewireChat memberId={memberId} session="w1" />
    </main>
  );
}

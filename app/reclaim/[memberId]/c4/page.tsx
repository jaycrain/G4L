import { notFound, redirect } from 'next/navigation';
import { reclaimEnabled } from '../../../../lib/agent/reclaim.ts';
import ReclaimChat from '../../reclaim-chat.tsx';
import { authorizeMember } from '../../../authz.ts';

// v2.5 Reclaim — C4 · The Reclaim Checkpoint + ceremony (the capstone, closes Cycle 1). Flag-gated (RECLAIM). The
// administered Challenge read (6 items) → the earned ceremony overlay (the chat fires it on stage 'ceremony'), which
// moves the Challenge component of Grinta, revisits the Legacy, and invites the Community Success Story → the Loop.
export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  if (!reclaimEnabled()) notFound();
  const { memberId } = await params;
  // SEC-11: guard the PAGE, not just the actions. The actions behind these surfaces are authorized, so this
  // was never a data leak — but an unauthenticated visitor got a rendered session shell that then errored,
  // instead of being sent to log in. Guarding here makes the boundary uniform, and means any future page that
  // does fetch server-side inherits it rather than having to remember.
  if (!(await authorizeMember(memberId))) redirect('/login');
  return (
    <main className="reconnect-page">
      <ReclaimChat memberId={memberId} session="checkpoint" />
    </main>
  );
}

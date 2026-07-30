import { notFound, redirect } from 'next/navigation';
import { reclaimEnabled } from '../../../../lib/agent/reclaim.ts';
import ReclaimChat from '../../reclaim-chat.tsx';
import { authorizeMember } from '../../../authz.ts';

// v2.5 Reclaim — C1 · Readiness Assessment (Step 1: the evidence self-check). Flag-gated (RECLAIM); the route doesn't
// exist in prod until the v2.5 flip. An administered, FORMATIVE evidence read → the reflective "are you in Reclaim"
// mirror. (Step 2, the Reclaim List refinement, lands in a follow-up slice.)
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
      <ReclaimChat memberId={memberId} session="c1" />
    </main>
  );
}

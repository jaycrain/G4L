import { notFound, redirect } from 'next/navigation';
import { rebuildEnabled } from '../../../../lib/agent/rebuild.ts';
import RebuildChat from '../../rebuild-chat.tsx';
import { authorizeMember } from '../../../authz.ts';

// v2.4 Rebuild — B4 · The Rebuild Checkpoint + ceremony (the Phase-3 close). Flag-gated (REBUILD). The administered
// Control read (12 items → pairwise 12→6) → the earned ceremony overlay (the chat fires it on stage 'ceremony'),
// which moves the Control component of Grinta and lights Reclaim.
export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  if (!rebuildEnabled()) notFound();
  const { memberId } = await params;
  // SEC-11: guard the PAGE, not just the actions. The actions behind these surfaces are authorized, so this
  // was never a data leak — but an unauthenticated visitor got a rendered session shell that then errored,
  // instead of being sent to log in. Guarding here makes the boundary uniform, and means any future page that
  // does fetch server-side inherits it rather than having to remember.
  if (!(await authorizeMember(memberId))) redirect('/login');
  return (
    <main className="reconnect-page">
      <RebuildChat memberId={memberId} session="checkpoint" />
    </main>
  );
}

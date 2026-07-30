import { notFound, redirect } from 'next/navigation';
import { rebuildEnabled } from '../../../../lib/agent/rebuild.ts';
import RebuildChat from '../../rebuild-chat.tsx';
import { authorizeMember } from '../../../authz.ts';

// v2.4 Rebuild — B2 · Appreciating Your Strengths and Weaknesses (the Structure asset). Flag-gated (REBUILD). The
// administered 24-item self-management assessment → a plain-language strengths/growth-edge reflection → the noticing
// week (Part B, on the practice-week scaffold).
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
      <RebuildChat memberId={memberId} session="b2" />
    </main>
  );
}

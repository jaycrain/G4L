import { notFound, redirect } from 'next/navigation';
import { rebuildEnabled } from '../../../../lib/agent/rebuild.ts';
import RebuildChat from '../../rebuild-chat.tsx';
import { authorizeMember } from '../../../authz.ts';

// v2.4 Rebuild — B1 · What is Your Why? (the Foundation asset). Flag-gated (REBUILD); the route doesn't exist in prod
// until the v2.4 flip. An administered SDT read → a forward-looking reflection (the profile is stored, not shown).
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
      <RebuildChat memberId={memberId} session="b1" />
    </main>
  );
}

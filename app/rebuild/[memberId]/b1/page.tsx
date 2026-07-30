import { notFound } from 'next/navigation';
import { rebuildEnabled } from '../../../../lib/agent/rebuild.ts';
import RebuildChat from '../../rebuild-chat.tsx';

// v2.4 Rebuild — B1 · What is Your Why? (the Foundation asset). Flag-gated (REBUILD); the route doesn't exist in prod
// until the v2.4 flip. An administered SDT read → a forward-looking reflection (the profile is stored, not shown).
export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  if (!rebuildEnabled()) notFound();
  const { memberId } = await params;
  return (
    <main className="reconnect-page">
      <RebuildChat memberId={memberId} session="b1" />
    </main>
  );
}

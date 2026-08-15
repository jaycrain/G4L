import { getDb } from '../../lib/db/index.ts';
import TopbarView from './topbar-view.tsx';
import type { Db } from '../../lib/db/schema.ts';

// The self-fetching wrapper for surfaces that have a memberId and nothing else: pass ONLY memberId and it reads
// its own name/avatar, so any subpage is a one-line drop-in with no data wiring. The MARKUP lives in
// topbar-view.tsx — one definition, shared with the dashboard, which is what stopped the Account tour stop from
// going missing again. Pair with <RedesignChrome/> on a subpage so the global brand-bar hides.
export default async function RedesignTopbar({ memberId }: { memberId: string }) {
  const db = (await getDb()) as unknown as Db;
  const row = (
    await db
      .query<{ display_name: string | null; avatar_url: string | null }>(
        'select display_name, avatar_url from member_profile where member_id=$1',
        [memberId],
      )
      .catch(() => ({ rows: [] as { display_name: string | null; avatar_url: string | null }[] }))
  ).rows[0];

  return (
    <TopbarView displayName={row?.display_name ?? ''} avatarUrl={row?.avatar_url ?? null} />
  );
}

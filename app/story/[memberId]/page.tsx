import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { getDashboard } from '../../../lib/gateway/flow.ts';
import { authorizeMember } from '../../authz.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import type { Db } from '../../../lib/db/schema.ts';
import SubpageShell from '../../dashboard/subpage-shell.tsx';

// "Your full story" — the identity READ (who you are), the narrative that used to crowd the dashboard
// hero (Dashboard Reshuffle §2). Distinct from the Playbook's arc (where you've been → where you're
// going); they share the stored paragraph but are never two copies of one story.
export default async function StoryPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  const dash = await getDashboard(db, memberId);
  await logEvent(db, memberId, 'page_view', { surface: 'story' });

  return (
    <SubpageShell memberId={memberId}>
      <div className="hero"><h1>Your full story</h1></div>
      <div className="card sub-copy">
        {dash?.identityParagraph ? (
          (() => {
            const p = dash.identityParagraph;
            const lead = 'You are someone';
            // Keep the opening "You are someone" bold for effect; the rest reads as plain narrative.
            return p.startsWith(lead) ? (
              <p className="story-narrative"><strong>{lead}</strong>{p.slice(lead.length)}</p>
            ) : (
              <p className="story-narrative">{p}</p>
            );
          })()
        ) : (
          <p className="muted">Your story takes shape as you go — you&apos;ll name who you&apos;re reclaiming at Identity Excavation, and it lands here.</p>
        )}
      </div>
    </SubpageShell>
  );
}

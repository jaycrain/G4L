import Link from 'next/link';
import { redirect } from 'next/navigation';
import { authorizeMember } from '../../authz.ts';

// "More about your Journey" — the map explainer (copy v1.0).
export default async function JourneyMorePage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');

  return (
    <>
      <div className="crumb">
        <Link href={`/dashboard/${memberId}`} className="back-link">← Dashboard</Link>
      </div>
      <div className="hero"><h1>More about your Journey</h1></div>
      <div className="card sub-copy">
        <p>If the ID Score is the mirror, the Journey is the map — the whole arc of the comeback, and the dot that says you are here.</p>
        <p>The rings are the four movements — Reconnect, Rewire, Rebuild, Reclaim — nested from the outside in, closing toward the center, which is the reclaimed you. The lit ring is where you’re standing right now. Beneath them, a plain tally of your Reclaim List: what you’ve already won back, what’s moving, and what’s still out ahead.</p>
        <p>You travel outside-in. Reconnect is the foundation, so it’s the outer ring; Reclaim — carrying it all back into the world — is the bright center you’re working toward. As you finish a movement, the map fills; as you check things off your Reclaim List, “to go” becomes “moving” becomes “reclaimed.”</p>
        <p>It’s the “how far have I come, how far to go” view — equal parts orientation and fuel. Seeing the whole map is meant to do two things at once: reassure you that it’s finite, and remind you that it’s real.</p>
        <p>And when you reach the center, the map doesn’t end — it re-forms. That’s the Loop. That’s why it’s Grinta for Life.</p>
      </div>
    </>
  );
}

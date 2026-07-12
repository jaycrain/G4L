import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { getJourney } from '../../../lib/beats/store.ts';
import { authorizeMember } from '../../authz.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import type { Db } from '../../../lib/db/schema.ts';

// "More about your Journey" — the map explainer (copy v1.0) + the member's place + Reclaim tally.
export default async function JourneyMorePage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  await logEvent(db, memberId, 'page_view', { surface: 'journey' });
  const journey = await getJourney(db, memberId);
  const r = journey.reclaim;

  return (
    <>
      <div className="hero"><h1>More about your Journey</h1></div>
      <div className="card sub-copy">
        <p className="sub-personal">
          You’re in <strong>{journey.currentRLabel ?? 'the start'}</strong>
          {r.total > 0 && <> — {r.reclaimed} reclaimed, {r.moving} moving, {r.notYet} to go</>}.
        </p>
        <p>If the ID Score is the mirror, the Journey is the map — the whole arc of the comeback, and the dot that says you are here.</p>

        <h3>How to read it</h3>
        <p>The rings are the four Phases — Reconnect, Rewire, Rebuild, Reclaim — nested from the outside in. The lit ring is where you’re standing right now. At the very center is the reclaimed you — the person on the other side of the work. Beneath the rings, a plain tally of your Reclaim List: what you’ve already won back, what’s moving, and what’s still out ahead.</p>
        <p>The center is the reclaimed you — the person Reconnect helps you see. Reconnect (the outer ring) is where you first glimpse that person and find the spark; Rewire, Rebuild, and Reclaim are how you close the distance to them; Reclaim is living as them, out in the world. So you’re moving toward that person, not away from them.</p>

        <h3>How it fills</h3>
        <p>You travel outside-in, toward the center. As you finish a Phase, the map fills; as you check things off your Reclaim List, “to go” becomes “moving” becomes “reclaimed.” The map is always showing you two true things at once — how far you’ve come, and how far there is to go.</p>

        <h3>Where it sits among the rest</h3>
        <p>Each part of your dashboard answers a different question, and the Journey is the zoom-out that ties them together: the mirror (ID Score) — how reconnected you feel right now. The map (Journey) — where you are in the whole arc. The grit (Grinta) — what keeps you going through the work. The Reclaim List — the concrete things you’re coming back for, which is exactly what the Journey’s tally counts.</p>
        <p className="muted"><em>How to use it:</em> come here when you need perspective — when the day-to-day feels small, the map shows the loop is actually turning.</p>

        <h3>Orientation and fuel</h3>
        <p>It’s the “how far have I come, how far to go” view — equal parts orientation and fuel. Seeing the whole map is meant to do two things at once: reassure you that it’s finite, and remind you that it’s real.</p>
        <p>And when you reach the center, the map doesn’t end — it re-forms. That’s the Loop. That’s why it’s Grinta for Life.</p>
      </div>
    </>
  );
}

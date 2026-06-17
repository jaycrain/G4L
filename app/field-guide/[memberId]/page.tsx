import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { getFacets, getForecast } from '../../../lib/curriculum/view.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import type { Db } from '../../../lib/db/schema.ts';

const HERO_VERB: Record<string, string> = { reconnect: 'Reconnecting', rewire: 'Rewiring', rebuild: 'Rebuilding', reclaim: 'Reclaiming' };

// The Field Guide — in-product orientation (Build Spec v1.3 → v0.4). Now a sub-page (was a modal),
// reached from the header. NO auto-open — the Threshold owns first arrival. Member words only.
export default async function FieldGuidePage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  await logEvent(db, memberId, 'page_view', { surface: 'field_guide' });
  const [facets, forecast] = await Promise.all([getFacets(db, memberId), getForecast(db, memberId)]);
  const verb = HERO_VERB[forecast.phases.find((p) => p.status === "You're here")?.phase ?? 'reconnect'] ?? 'Reconnecting';
  const identityLine = facets.length ? `${verb} ${facets.join(' · ')}` : 'Reconnecting';

  return (
    <>
      <div className="crumb">
        <Link href={`/dashboard/${memberId}`} className="back-link">← Dashboard</Link>
      </div>
      <div className="hero"><h1>Field Guide</h1></div>

      <div className="card">
        <section>
          <h3>What this is</h3>
          <p>
            You’re here to close a distance — between who you are right now and who you still are underneath.
            We call that gap the Fade. This is how you close it, at your own pace, and keep it closed.
          </p>
        </section>

        <section>
          <h3>How the work moves — the 4Rs</h3>
          <p>
            The work runs through four movements, as a loop. You clip back into them again and again, because
            identity slips and life keeps moving. That’s why it’s Grinta for Life.
          </p>
          <ul className="fg-rs">
            <li><strong>Reconnect</strong> — See where you are. Remember who you were before life talked you out of it. Find the spark.</li>
            <li><strong>Rewire</strong> — Take apart the old stories your mind tells to keep you comfortable. Build new frames around your body, your food, and yourself.</li>
            <li><strong>Rebuild</strong> — The physical work: move, fuel, sleep. The numbers start to move here — and you begin it early, while you’re still rewiring.</li>
            <li><strong>Reclaim</strong> — Carry the recovered identity back out into the world: people, community, adventure.</li>
          </ul>
          <p>
            You start at Reconnect. Rewire and Rebuild run together from there. Reclaim is the state you’re
            working toward — and when you reach it, life shifts, your list re-forms, and you go again. You
            “clip in” to begin, and “clip back in” every time the Loop brings you around for another lap.
          </p>
        </section>

        <section>
          <h3>The shape of the work</h3>
          <p>The work comes in a few forms, and your companion is in all of them.</p>
          <ul className="fg-rs">
            <li><strong>Sessions</strong> — guided exercises the two of you move through together, one piece at a time. A form, a few questions, something to write. Your companion sets up each piece, asks the next thing, and helps you go deeper than you would on your own.</li>
            <li><strong>Clip-ins</strong> — some days are lighter: a single rep to keep your grit moving.</li>
            <li><strong>Things you track</strong> — a few numbers you just keep — your weight, your miles. Tell your companion; it remembers.</li>
            <li><strong>Checkpoints</strong> — at the end of each movement, a real conversation about what’s actually landed before you go on. Reconnect’s is the one that matters most: you have to find yourself before you can build on it, so we hold that line. Fronting it doesn’t last — you’d just sleepwalk.</li>
          </ul>
        </section>

        <section>
          <h3>You can see the whole thing</h3>
          <p>
            No mystery about what you’re walking into. Your dashboard lays out the whole program — all four
            movements, every Session, the Checkpoints — with where you are lit up and the rest waiting ahead.
            You came up on textbooks that showed every chapter; this is the same. Look as far down the road as
            you like.
          </p>
        </section>

        <section>
          <h3>Your G4L Playbook</h3>
          <p>
            As you go, your companion builds you a Playbook — the short, personal record of what’s actually
            working for you: the reframes that landed, the science that convinced you, and your own best lines.
            Pulled from your Sessions and Checkpoints, distilled by your companion, kept by you. It’s the thing
            you reach for when you need it — and it’s private to you. Find it up top, next to this guide.
          </p>
        </section>

        <section>
          <h3>Your Badges</h3>
          <p>
            Along the way you earn badges — one for every real thing you do. Not for showing up or logging in;
            for the plays that count: passing a stretch of grit, reclaiming something on your list, coming back
            after a slump, crossing a Checkpoint. They’re the same size on purpose — the point isn’t any single
            one, it’s how many you stack. Some you can see coming, greyed in until you earn them; some you won’t
            see until they land. Your first is already there: for finishing onboarding and getting here — which
            is harder than it sounds, because it meant facing yourself.
          </p>
        </section>

        <section>
          <h3>How to read your screen — top to bottom</h3>
          <p>Every panel is live, and all of it is yours.</p>
          <dl className="fg-panels">
            <dt>Up top (the header)</dt>
            <dd>your name, and in the corner: this Field Guide and your Playbook.</dd>
            <dt>{identityLine}</dt>
            <dd>every self you’re bringing back, together — your picture of who you’re becoming. We don’t pick which one matters.</dd>
            <dt>ID Score</dt>
            <dd>the mirror. How far you’ve drifted from yourself, 0–100; it moves slowly, on purpose (you retake the IDQ every 60 days). The four dimensions beneath read across then down — Physical, Self, Social, Outlook.</dd>
            <dt>Journey</dt>
            <dd>where you are on the path, and how many things you’ve still got to win back.</dd>
            <dt>Grinta Index</dt>
            <dd>your grit. Unlike the ID Score, this moves every time you show up. The mirror tells you where you are; the grit tells you how hard you’re fighting. Two reads, two jobs.</dd>
            <dt>Your Badges</dt>
            <dd>the ones you’ve earned and the ones still ahead, greyed in until you reach them.</dd>
            <dt>Reclaim List</dt>
            <dd>the concrete things you’re after. The whole point. Add or refine them anytime — just talk to your companion.</dd>
            <dt>Your Program</dt>
            <dd>the whole program, with your next Session lit and ready to open. The rest of the path waits below it, and the daily clip-ins and your numbers run along the bottom.</dd>
            <dt>Movement</dt>
            <dd>connect Strava and your rides, runs, and walks show up here, alongside the work.</dd>
            <dt>Your Doors</dt>
            <dd>how the Fade got in. Add or refine these too — just talk to your companion.</dd>
            <dt>Your G4L Companion</dt>
            <dd>always in the corner. Tap the bubble anytime.</dd>
          </dl>
        </section>
      </div>
    </>
  );
}

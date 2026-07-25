import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import type { Db } from '../../../lib/db/schema.ts';
import SubpageShell from '../../dashboard/subpage-shell.tsx';

// The Field Guide — in-product orientation. Copy is Field Guide v1.1 (mirrored to G4L_Field_Guide in
// Drive), refreshing v1.0 to the shipped product through v3.2: the Companion Triptych, Movement now
// LIVE (Strava connect + Companion-logged history — no longer "log it by hand"), and Commitments (the
// movement/eating accountability spine, set with the Companion). Piece labels are bare names to match
// the trimmed panel/subpage titles (no "Your Companion / Your Playbook"). Everything else from v1.0
// (the Fade framing, the four Phases, Grinta = grit across the Phases) held — it was still true.
// Reached from the header; NO auto-open (the Threshold owns first arrival). Tour is re-runnable here (?tour=1).
export default async function FieldGuidePage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  await logEvent(db, memberId, 'page_view', { surface: 'field_guide' });

  return (
    <SubpageShell memberId={memberId}>
      <div className="hero"><h1>Field Guide</h1></div>

      <div className="card">
        <section>
          <h3>What this is</h3>
          <p>Somewhere along the way, a gap opened — between who you are right now and who you still are underneath. We call that gap the Fade. It didn’t happen all at once. It happened through a hundred reasonable decisions, and most people are the last to notice it.</p>
          <p>Grinta for Life is where you close that gap and keep it closed. Not with a quick fix or a streak to chase — with a real practice that rebuilds the parts of you that faded, and the grit to hold the line when life pushes back.</p>
          <p>At the center of all of it is your Companion. It’s who you talk to — the primary way you use Grinta for Life — and it remembers everything: your onboarding, what’s on your dashboard, and every conversation you’ve had with it. Around the Companion sits a path you move through (the four Phases) and the proof that you’re actually changing (your scores, your Playbook, your Reclaim List). The Companion is how you reach all of it. You set the pace; it keeps the map.</p>
        </section>

        <section>
          <h3>How the work moves — the four Phases</h3>
          <p>The work runs through four Phases, as a loop. You clip back into them again and again, because identity slips and life keeps moving. That’s why it’s Grinta for Life.</p>
          <ul className="fg-rs">
            <li><strong>Reconnect</strong> — your starting point. See where you are, remember who you were before life talked you out of it, and find the spark worth chasing.</li>
            <li><strong>Rewire</strong> — the mind. Take apart the old stories your mind tells to keep you comfortable, and build new ones you can act on.</li>
            <li><strong>Rebuild</strong> — the body. Put it into the body: how you move, eat, sleep, and recover, built back one small decision at a time.</li>
            <li><strong>Reclaim</strong> — the life. Go after the things that make you feel like you again, on purpose, out in the world.</li>
          </ul>
          <p>Underneath all four Phases is Grinta — the grit you build by doing the work. Every Phase you close adds to it.</p>
        </section>

        <section>
          <h3>The pieces, and how to use each</h3>
          <p>Everything on your dashboard does one job. Here’s what each is for, and how to get the most from it.</p>
          <ul className="fg-pieces">
            <li><strong>Companion</strong> — this is the product, and the primary way you use everything here. It sits at the center of your dashboard. It remembers your whole onboarding, knows what’s on your dashboard, and carries every interaction you’ve had with it — so you never start over or re-explain yourself. It sees your Sessions, your scores, your Reclaim goals, your logs, and your Community activity, and brings the right one up at the right moment — a friend’s reply, a walk you logged, a Session you’re ready for. It talks like a person, not a form. <em>How to use it:</em> talk to it. Tap “Talk to me” to open it — think something through, set or refine a goal, log a call, or just say what’s going on. You start a Session from your dashboard; everything else on this page is something your Companion helps you see and do.</li>
            <li><strong>The Program &amp; Sessions</strong> — the path itself, laid out start to finish, so you always know what you’re walking into. Each step is a Session — a guided conversation, not a worksheet. <em>How to use it:</em> open the next lit Session when you have fifteen or twenty minutes. Do one at a time. Finishing one re-weaves your Playbook and moves you forward.</li>
            <li><strong>Checkpoints</strong> — the moment at the end of each Phase where you look back and we measure what you built. This is where your Grinta updates. <em>How to use it:</em> treat it as a mile-marker, not a test. Answer honestly — a slip you noticed and came back from still counts as building, and the number can dip as well as climb. A dip usually just means you’re seeing yourself more clearly than you could at the start.</li>
            <li><strong>Momentum</strong> — the calls you make, one at a time, and how they add up. Every day brings small calls; the good ones and the honest false starts build into a line you can watch move. <em>How to use it:</em> make a call, mark it, and see the momentum build. Keep what’s worth remembering — it goes to your Playbook.</li>
            <li><strong>Commitments</strong> — the specific changes you choose to hold yourself to — a way of moving, a way of eating — set with your Companion. This is the accountability, and it’s to your own goals, never an outside standard. <em>How to use it:</em> name one or two with your Companion, then tag your Momentum calls to them so the follow-through adds up where you can see it. Change one or set it aside anytime — they’re yours.</li>
            <li><strong>ID Score</strong> — the mirror — an honest read on how connected you are to yourself, across four parts of identity: Physical, Self, Social, and Outlook. It comes from the IDQ. <em>How to use it:</em> check it to see the shape of where you’re strong and where there’s room. It updates when you retake the IDQ on schedule — it’s a starting line, not a verdict.</li>
            <li><strong>Journey</strong> — the path — the whole loop of the four Phases and where you stand on it right now. <em>How to use it:</em> glance at it when you want perspective. It’s the zoom-out that shows the loop is actually turning.</li>
            <li><strong>Grinta Index</strong> — the grit. Grinta means grit: never give up. It’s the grit you build across the whole journey, one Phase at a time. You get your first Grinta reading right at the start, and it grows as you finish each Phase and see yourself more clearly. <em>How to use it:</em> don’t aim at the number — do the work, and it follows. It’s measured at each Phase’s Checkpoint, and it can dip as well as climb — a dip usually means you’re seeing yourself more honestly, which is the work.</li>
            <li><strong>Reclaim List</strong> — the concrete things you’re coming back for — your goals, in your words, with simple logging. <em>How to use it:</em> add or refine items just by talking to your Companion. Turn on a tracker to tie one to your Movement and watch it come back. These are what the work is aiming at.</li>
            <li><strong>Playbook</strong> — your kept record — the story you’re writing as you go, plus the best lines, reframes, and science that hold it up. It deepens every time you close a Session. <em>How to use it:</em> reach for it whenever you need a reminder of who you are and what works. Pin what matters, edit or remove what doesn’t. Over time it becomes the raw material for your Legacy Letter and Success Story.</li>
            <li><strong>Community</strong> — the others doing this work alongside you — a place to share the wins and the hard parts, and keep each other honest. <em>How to use it:</em> post a topic, cheer someone on, reply, or start a live room. Post under your name or your handle — your call, every time. Report or block anything that doesn’t belong.</li>
            <li><strong>Badges</strong> — the receipts — proof, in one place, of the real things you’ve actually done. <em>How to use it:</em> nothing to do but earn them. They mark the stretches of grit worth remembering.</li>
            <li><strong>Movement</strong> — everything you’re doing for your body, in one place. Connect Strava and your rides, runs, and workouts flow in on their own; or just tell your Companion about a walk and it lands here too — all of it read against who you’re reclaiming, never left as raw numbers. <em>How to use it:</em> connect a source in Account, or log an activity right on the page. More connections (Apple Health, Fitbit, Garmin) arrive with the app.</li>
            <li><strong>Field Guide</strong> — this page — the map of the whole platform. <em>How to use it:</em> come back anytime you’re not sure what something is or how to use it.</li>
          </ul>
        </section>

        <section>
          <h3>A simple rhythm</h3>
          <p>There’s no wrong way to do this, but if you want a default: do a Session when you’ve got the time, make your calls and mark them in Momentum against the commitments you set, log your Reclaim items and your Movement as life happens, drop into Community when you want company, and revisit your Playbook whenever you need to remember who you are. Small and steady wins this.</p>
        </section>

        <section>
          <p>
            <Link href={`/dashboard/${memberId}?tour=1`} className="see-more">Take the tour again →</Link>
          </p>
        </section>
      </div>
    </SubpageShell>
  );
}

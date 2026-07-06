import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import type { Db } from '../../../lib/db/schema.ts';

// The Field Guide — in-product orientation. Full copy refresh (handoff: Member-Facing Refresh
// 2026-06-24, task #4): Companion-as-the-product framing, the 4Rs with Reconnect as the north star,
// a what-it-is / how-to-use for every panel (incl. Community), and a simple rhythm. Member words only.
// Reached from the header; NO auto-open (the Threshold owns first arrival). Tour is re-runnable here.
export default async function FieldGuidePage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  await logEvent(db, memberId, 'page_view', { surface: 'field_guide' });

  return (
    <>
      <div className="crumb">
        <Link href={`/dashboard/${memberId}`} className="back-link">← Dashboard</Link>
      </div>
      <div className="hero"><h1>Field Guide</h1></div>

      <div className="card">
        <section>
          <h3>What this is</h3>
          <p>Somewhere along the way, a gap opened — between who you are right now and who you still are underneath. We call that gap the Fade. It didn’t happen all at once. It happened through a hundred reasonable decisions, and most people are the last to notice it.</p>
          <p>Grinta for Life is where you close that gap and keep it closed. Not with a quick fix or a streak to chase — with a real practice that rebuilds the parts of you that faded, and the grit to hold the line when life pushes back.</p>
          <p>At the center of all of it is your Companion. It’s who you talk to — the primary way you use Grinta for Life — and it remembers everything: your onboarding, what’s on your dashboard, and every conversation you’ve had with it. Around the Companion sits a path you move through (the 4Rs) and the proof that you’re actually changing (your scores, your Playbook, your Reclaim List). The Companion is how you reach all of it. You set the pace; it keeps the map.</p>
        </section>

        <section>
          <h3>How the work moves — the 4Rs</h3>
          <p>The work runs through four Phases, as a loop. You clip back into them again and again, because identity slips and life keeps moving. That’s why it’s Grinta for Life.</p>
          <ul className="fg-rs">
            <li><strong>Reconnect</strong> — your north star. See where you are, remember who you were before life talked you out of it, and find the spark worth chasing.</li>
            <li><strong>Rewire</strong> — the engine. Take apart the old stories your mind tells to keep you comfortable, and build new ones you can act on.</li>
            <li><strong>Rebuild</strong> — the movement. Put it into the body: how you move, eat, sleep, and recover, built back one small decision at a time.</li>
            <li><strong>Reclaim</strong> — the life. Go after the things that make you feel like you again, on purpose, out in the world.</li>
          </ul>
          <p>Underneath it all is Grinta — the grit you build to drive the work. Reconnect is the star you steer by; Grinta is the engine you keep developing; Rewire, Rebuild, and Reclaim are the gears that move you toward it.</p>
        </section>

        <section>
          <h3>The pieces, and how to use each</h3>
          <ul className="fg-pieces">
            <li><strong>Your Companion</strong> — this is the product, and the primary way you use everything here. It remembers your whole onboarding, knows what’s on your dashboard, and carries every interaction you’ve had with it — so you never start over or re-explain yourself. It sees your Sessions, your scores, your Reclaim goals, your logs, and your Community activity, and brings the right one up at the right moment — a friend’s reply, a weight you logged, a Session you’re ready for. It talks like a person, not a form. <em>How to use it:</em> talk to it. Tap “Talk to me” to start a Session, think something through, set or refine a goal, or just say what’s going on. Everything else on this page is something your Companion helps you see and do.</li>
            <li><strong>The Program &amp; Sessions</strong> — the path itself, laid out start to finish, so you always know what you’re walking into. Each step is a Session — a guided conversation, not a worksheet. <em>How to use it:</em> open the next lit Session when you have fifteen or twenty minutes. Do one at a time. Finishing one re-weaves your Playbook and moves you forward.</li>
            <li><strong>Checkpoints</strong> — the moment at the end of each R where you look back and we measure what you built. This is where your Grinta score updates. <em>How to use it:</em> treat it as a mile-marker, not a test. Answer honestly — a slip you noticed and came back from still counts as building.</li>
            <li><strong>Daily Beat</strong> — one thought to carry for the day, a small reframe or nudge tied to where you are. <em>How to use it:</em> read it once in the morning. If it lands, hit “Keep this” and it’s saved to your Playbook.</li>
            <li><strong>ID Score — the mirror</strong> — an honest read on how connected you are to yourself, across four parts of identity: Physical, Self, Social, and Outlook. It comes from the IDQ. <em>How to use it:</em> check it to see the shape of where you’re strong and where there’s room. It updates when you retake the IDQ on schedule — a starting line, not a verdict.</li>
            <li><strong>Journey — the path</strong> — the big picture of your reclamation: what you’ve reclaimed, what’s moving, and what’s still ahead. <em>How to use it:</em> glance at it when you want perspective. It’s the zoom-out that shows the loop is actually turning.</li>
            <li><strong>Grinta Index — the grit</strong> — your hardiness, the part that keeps you going when motivation fades. It’s built from three habits: Commitment (you have a reason and you show up), Control (you run your life, not the other way around), and Challenge (you move toward growth). <em>How to use it:</em> don’t aim at the number — do the work, and it follows. Your Checkpoints are where it’s measured.</li>
            <li><strong>Your Reclaim List</strong> — the concrete things you’re coming back for — your goals, in your words, with simple logging. <em>How to use it:</em> add or refine items just by talking to your Companion. Log progress when you have it. These are what the 4Rs are aiming at.</li>
            <li><strong>Your Playbook</strong> — your kept record — the story you’re writing as you go, plus the best lines, reframes, and science that hold it up. It deepens every time you close a Session. <em>How to use it:</em> reach for it whenever you need a reminder of who you are and what works. Pin what matters, edit or remove what doesn’t. Over time it becomes the raw material for your Legacy Letter and Success Story.</li>
            <li><strong>Community</strong> — the others doing this work alongside you — a place to share the wins and the hard parts, and keep each other honest. <em>How to use it:</em> post a topic, cheer someone on, reply, or start a live room. Post under your name or your handle — your call, every time. Report or block anything that doesn’t belong.</li>
            <li><strong>Badges</strong> — the receipts — proof, in one place, of the real things you’ve actually done. <em>How to use it:</em> nothing to do but earn them. They mark the stretches of grit worth remembering.</li>
            <li><strong>Movement</strong> — a place to connect your activity so the work in Rebuild and Reclaim shows up automatically. <em>How to use it:</em> connect it when it’s available — for now, log movement in your Reclaim List by hand.</li>
            <li><strong>Field Guide</strong> — this page — the map of the whole platform. <em>How to use it:</em> come back anytime you’re not sure what something is or how to use it.</li>
          </ul>
        </section>

        <section>
          <h3>A simple rhythm</h3>
          <p>There’s no wrong way to do this, but if you want a default: read your Daily Beat each morning, do a Session when you’ve got the time, log your Reclaim items as life happens, drop into Community when you want company, and revisit your Playbook whenever you need to remember who you are. Small and steady wins this.</p>
        </section>

        <section>
          <p>
            <Link href={`/dashboard/${memberId}?tour=1`} className="see-more">Take the tour again →</Link>
          </p>
        </section>
      </div>
    </>
  );
}

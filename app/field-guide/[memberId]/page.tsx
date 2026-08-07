import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import type { Db } from '../../../lib/db/schema.ts';
import SubpageShell from '../../dashboard/subpage-shell.tsx';

// The Field Guide — in-product orientation. Copy is Donna's 7/28 rev (Jay): tighter, reclaim-forward
// framing ("The G4L program explained" / "How G4L works" / "The elements of G4L"), the "How to use it:"
// labels dropped, and the elements list trimmed to what the triptych actually shows — Commitments,
// Journey (now merged into the hero ring), the Field Guide self-reference, and the "A simple rhythm"
// section were removed. Piece labels stay bare names to match the panel/subpage titles.
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
          <h3>The G4L program explained</h3>
          <p>Somewhere along the way, a distance grew between who you are right now and who you still are underneath. It’s a loss of identity that happens in midlife. The Fade that caused it didn’t happen all at once but through a hundred reasonable decisions you make in response to life events.</p>
          <p>Grinta for Life is where you reclaim your identity. It’s a practice that reconnects you to the parts of you that faded, and builds the grit to hold the line when life pushes back.</p>
          <p>At the center of all of it is your AI G4L Companion. It’s who you talk to — the primary way you use Grinta for Life — your onboarding, what’s on your dashboard, and it remembers every conversation you’ve had with it. The Companion guides you through the four Phases of the Program alongside proof that you’re actually changing (your scores, your Playbook, your Reclaim List). You set the pace; it keeps the map.</p>
        </section>

        <section>
          <h3>How G4L works</h3>
          <p>You’ll work through four Phases and can clip back into them again and again, because identity slips and life keeps moving. That’s why it’s Grinta for Life.</p>
          <ul className="fg-rs">
            <li><strong>Reconnect</strong> — your starting point. See where you are, remember who you were before life talked you out of it, and find the spark worth chasing.</li>
            <li><strong>Rewire</strong> — the mind. Take apart the old stories your mind tells to keep you comfortable, and build new ones you can act on.</li>
            <li><strong>Rebuild</strong> — the body. Put it into the body: how you move, eat, sleep, and recover, built back one small decision at a time.</li>
            <li><strong>Reclaim</strong> — the life. Go after the things that make you feel like you again, on purpose, out in the world.</li>
          </ul>
          <p>Underneath all four Phases is Grinta — the grit you build by doing the work. Every Phase you close adds to it.</p>
        </section>

        <section>
          <h3>The elements of G4L</h3>
          <p>Everything on your dashboard works toward helping you reclaim your identity to live longer, healthier, and happier. Here’s what each one does, and how to get the most from them.</p>
          <ul className="fg-pieces">
            <li><strong>Companion</strong> — the AI G4L Companion sits at the center of your dashboard. Conversations with it will guide you through the program. It will remember everything you ever tell it, will show you what’s next and, at any time, you can ask it a question. It sees everything and lets you know if there’s something for you to do. You start a Session at the top of your dashboard; everything else is something your Companion helps you see and do.</li>
            <li><strong>Program</strong> — the entire G4L at-a-glance, so you always know what’s next. Each step is a Session — a guided conversation, or an assessment.</li>
            <li><strong>Checkpoints</strong> — the moment at the end of each Phase where you look back and measure progress reflected in your Grinta Index.</li>
            <li><strong>Momentum</strong> — track the calls you make, one at a time, and see a rhythm in how they add up. Good calls, false starts, or the on-track days build into a line you can watch move.</li>
            <li><strong>ID Score</strong> — reflects answers to questions you answer across four parts of your identity: Physical, Self, Social, and Outlook. It measures the distance from where you are at that point in time to where you want to end up. It updates when you retake the IDQ.</li>
            <li><strong>Grinta Index</strong> — Grinta means grit. The Index measures the resilience and determination you demonstrate and build as you go through each Phase. You get your first reading right at the start, and it grows as you do the work to finish each Phase. It’s recalculated at each Checkpoint.</li>
            <li><strong>Reclaim List</strong> — goals you set and work toward as you work through the program. Add or refine items just by talking to your Companion. You can add a tracker to individual items to monitor progress.</li>
            <li><strong>Playbook</strong> — your Companion saves the story you’re writing as you go, plus the best lines, reframes, and science that hold it up. It deepens every time you close a Session. Reach for it whenever you need a reminder. Pin what matters, edit or remove what doesn’t.</li>
            <li><strong>Community</strong> — a place to connect with like-minded midlifers doing this work alongside you. Share the wins and the hard parts, and keep each other honest. Post a topic, cheer someone on, reply, or start a live room. Report or block anything that doesn’t belong.</li>
            <li><strong>Badges</strong> — no participation trophies here, this is earned acknowledgement of the hard work you’re doing.</li>
            {/* Only promise the Strava sync when it's actually switched on — the help copy must never contradict the
                live control (STRAVA_* is unset on prod today, so this read as a broken promise). (CAT-52) */}
            <li>
              <strong>Movement</strong> — everything you’re doing for your body, in one place. Log what you do and see it add up.
              {process.env.STRAVA_CLIENT_ID ? ' Connect Strava and your rides, runs, and workouts flow in on their own.' : ''}
            </li>
          </ul>
        </section>

        <section>
          <p>
            <Link href={`/dashboard/${memberId}?tour=1`} className="see-more">Take the tour →</Link>
          </p>
        </section>
      </div>
    </SubpageShell>
  );
}

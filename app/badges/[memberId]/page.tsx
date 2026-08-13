import PanelHeader from '../../components/panel-header.tsx';
import { PANEL_MESSAGING } from '../../../lib/content/panel-messaging.ts';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { getPassport, reconcileRedesignBadges, type PassportView } from '../../../lib/curriculum/view.ts';
import { badgePhase, type BadgePhase } from '../../../lib/curriculum/registry.ts';
import { redesignEnabled } from '../../../lib/dashboard/redesign.ts';
import RedesignChrome from '../../dashboard/redesign-chrome.tsx';
import RedesignTopbar from '../../dashboard/redesign-topbar.tsx';
import BadgeStamp from '../../dashboard/badge-stamp.tsx';
import type { Db } from '../../../lib/db/schema.ts';

// The Badges detail subpage ("See More →" from the dashboard shelf). Two renders:
//  • Redesign (REDESIGN staged): the honest forward-map in full — each milestone, what it marks, earned or ahead.
//  • Legacy (prod): the original passport explainer copy, untouched.

export default async function BadgesMorePage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  if (redesignEnabled()) await reconcileRedesignBadges(db, memberId).catch(() => {}); // agree with the dashboard shelf
  const passport = await getPassport(db, memberId);

  return redesignEnabled() ? redesignView(memberId, passport) : legacyView(passport);
}

// ---- Redesign: the milestone map, grouped by the 4Rs -----------------------------------------------------------

// Badge → phase grouping comes from the registry's badgePhase() (the same source that colors the stamps),
// so the two cross-cutting keeps ("kept a want", "closed the loop") group under Journey, not Reclaim.

// Member-facing meaning of each milestone — plain, normalizing, no pep. What it marks, honestly.
/** What an UNEARNED badge says. Only the phase milestones are spelled out: they sit visible for weeks
 *  before anyone earns them, so they are the ones a member reads while it is still untrue. Everything else
 *  falls back to a generated "Earned when you …" line. */
const BADGE_UNEARNED: Record<string, string> = {
  'reconnect-milestone': 'Earned when you cross the Reconnect checkpoint.',
  'rewire-milestone': 'Earned when you cross the Rewire checkpoint.',
  'rebuild-milestone': 'Earned when you cross the Rebuild checkpoint.',
  'reclaim-capstone': 'Earned when you close the cycle at the Reclaim checkpoint.',
};

const BADGE_MEANING: Record<string, string> = {
  'named-yourself': 'You identified the Doors you walked through, the life events that created the distance between who are you and who you want to be.',
  'starting-line': 'You measured the distance between who you were, who you are, and who you want to be.',
  'reconnect-milestone': 'You completed the first phase of the G4L program.',
  'turned-voice': 'You caught the lies you tell yourself — and practiced turning them into truths.',
  'built-picture': 'You built a picture of yourself that will inspire and motivate you.',
  'caught-real-time': 'You kept going. That’s the reflex starting to change.',
  'rewire-milestone': 'You completed the second phase of the G4L program.',
  'found-why': 'You explored your why underneath the movement.',
  'honest-read': 'You took a hard look at where your body actually is, good and bad.',
  'week-noticing': 'You lived a full week paying attention. Noticing is the rep that makes the rest possible.',
  'rebuild-milestone': 'You completed the third phase of the G4L program.',
  'goal-reclaimed': 'You took back something you’d named as lost.',
  'widened-world': 'You stepped outside of the narrow room the Fade had you living in.',
  'quality-days': 'You built days that feel like you.',
  'wrote-story': 'You completed the fourth phase of the G4L program.',
  'reclaim-capstone': 'You made it all of the way through a Grinta for Life cycle.',
};

const PHASES: { key: BadgePhase; label: string }[] = [
  { key: 'reconnect', label: 'Reconnect' },
  { key: 'rewire', label: 'Rewire' },
  { key: 'rebuild', label: 'Rebuild' },
  { key: 'reclaim', label: 'Reclaim' },
  { key: 'journey', label: 'Your Comeback' },
];

function redesignView(memberId: string, passport: PassportView) {
  const byPhase = PHASES.map((p) => ({
    ...p,
    badges: passport.badges.filter((b) => badgePhase(b) === p.key),
  })).filter((g) => g.badges.length > 0);

  return (
    <>
      <RedesignChrome />
      <RedesignTopbar memberId={memberId} />
      <div className="bd-wrap">
        <Link href={`/dashboard/${memberId}`} className="ws-back">← Dashboard</Link>
        <PanelHeader k="badges" />
        {/* The ladder's own intro rung, read from the one source rather than restated here. My first pass wrote a
            replacement line; the spec (Cowork §5) says use this one, and it is better — it names what earns a
            badge instead of asserting that something does. */}
        <p className="bd-lede">{PANEL_MESSAGING.badges.intro}</p>
        <div className="bd-count"><b>{passport.earned}</b> of {passport.total} earned</div>

        {byPhase.map((g) => (
          <section className="bd-phase" key={g.key}>
            <h2 className={`bd-phase-h ${g.key}`}>{g.label}</h2>
            <div className="bd-list">
              {g.badges.map((b) => (
                <div className={`bd-badge${b.earned ? ' earned' : ''}`} key={b.id}>
                  <BadgeStamp badge={b} />
                  <div className="bd-body">
                    <div className="bd-name">
                      {b.name}
                      {/* "Ahead" read as praise — as in "you're ahead" — rather than "this is still ahead of
                          you", which is what it meant. Greg read it as a status about himself and then found
                          it contradicted by the caption underneath. "Not yet" cannot be misread as approval. */}
                      {b.earned ? <span className="bd-tag earned">Earned</span> : <span className="bd-tag">Not yet</span>}
                    </div>
                    {/* THE TENSE HAS TO FOLLOW THE STATE. Every meaning below is written in the past — they
                        are what the badge says once you have it — so an unearned badge was announcing
                        "You completed the second phase" beside a greyed stamp reading "not yet". Unearned
                        badges say what would earn them. */}
                    <p className="bd-meaning">
                      {b.earned
                        ? (BADGE_MEANING[b.id] ?? b.earn_rule)
                        : (BADGE_UNEARNED[b.id] ?? `Earned when you ${b.earn_rule.replace(/^You /, '').replace(/\.$/, '')}.`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {passport.placeholders > 0 && (
          <p className="bd-more">
            + {passport.placeholders} more milestone{passport.placeholders > 1 ? 's' : ''} revealed when you reach{' '}
            {passport.placeholders > 1 ? 'them' : 'it'}.
          </p>
        )}
      </div>
    </>
  );
}

// ---- Legacy (prod): the original passport explainer copy, untouched -------------------------------------------

function legacyView(passport: PassportView) {
  return (
    <>
      <div className="hero"><h1>More about your Badges</h1></div>
      <div className="card sub-copy">
        <p className="sub-personal">You’ve earned <strong>{passport.earned} of {passport.total}</strong> so far.</p>
        <p>Your Badges are the receipts — proof, in one place, of the real things you’ve actually done. Think passport stamps, not trophies: every one is the same size, each with its own color and design, and the point was never any single one. The point is how many you stack.</p>
        <p>A grid that fills as you go. The ones you’ve earned are lit; the ones still ahead are greyed in, so you can see what’s possible. Color tells you the kind — Milestones, Hardiness (stretches of grit), Goals reclaimed, and Comebacks (a real return after a slump). Some you can see coming. Some you won’t see until they land — earned, not expected.</p>
        <p>You don’t get one for showing up or logging in. You get one for the plays that count — passing a stretch of grit, reclaiming something on your list, coming back after a miss, crossing a Checkpoint. They’re meant to be hard. The accumulation is the whole game: a passport that fills is a life being won back.</p>
        <p>So don’t measure yourself against the one you don’t have yet. Look at the density — a board crowding with color is the story, told in stamps.</p>
        <p>Your first was the hardest to see coming: getting through onboarding and into this room. That one took facing yourself. The rest, you’ll stack.</p>
        <div className="badge-legend">
          <span className="bl"><span className="bl-sw" style={{ background: '#374F63' }} />Milestones</span>
          <span className="bl"><span className="bl-sw" style={{ background: '#3B9495' }} />Hardiness</span>
          <span className="bl"><span className="bl-sw" style={{ background: '#919536' }} />Goals reclaimed</span>
          <span className="bl"><span className="bl-sw" style={{ background: '#EC6233' }} />Comebacks</span>
          <span className="bl"><span className="bl-sw bl-lock" />Still to earn</span>
        </div>
      </div>
    </>
  );
}

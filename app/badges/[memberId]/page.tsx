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
const BADGE_MEANING: Record<string, string> = {
  'named-yourself': 'You sat with the Doors — the life events that opened the distance — and named them out loud. That’s where the work starts.',
  'starting-line': 'You took the first ID read. Not a grade — a starting line, so you can see how far you’ve come from here.',
  'reconnect-milestone': 'You crossed the Threshold: you saw the Fade clearly and decided to do something about it.',
  'turned-voice': 'You caught the inner voice that narrates you short — and practiced turning it.',
  'built-picture': 'You built a fuller, truer picture of yourself than the one the Fade was running.',
  'caught-real-time': 'You caught a distortion as it happened, not hours later. That’s the reflex starting to change.',
  'rewire-milestone': 'You retrained the mind — the Rewire work moved the frame, and it held.',
  'found-why': 'You found the why underneath the movement — the reason that’s yours, not borrowed.',
  'honest-read': 'You took an honest read of where the body actually is — no flattering, no flinching.',
  'week-noticing': 'You lived a full week paying attention. Noticing is the rep that makes the rest possible.',
  'rebuild-milestone': 'You rebuilt the body — the numbers moved against your own baseline.',
  'goal-reclaimed': 'You took back something you’d named as lost — a want, returned to your life.',
  'widened-world': 'You widened the world — you looked past the narrow room the Fade had you living in.',
  'quality-days': 'You strung together days that felt like yours. Not perfect — quality, on your terms.',
  'wrote-story': 'You wrote your story in your own words — the Transition, told by you.',
  'reclaim-capstone': 'You closed the loop — a full cycle of the work. It fades again, and you clip back in. That’s the Loop.',
};

const PHASES: { key: BadgePhase; label: string }[] = [
  { key: 'reconnect', label: 'Reconnect' },
  { key: 'rewire', label: 'Rewire' },
  { key: 'rebuild', label: 'Rebuild' },
  { key: 'reclaim', label: 'Reclaim' },
  { key: 'journey', label: 'The Journey' },
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
        <div className="hero"><h1>Your Badges</h1></div>
        <p className="bd-lede">
          Earned for real accomplishments — never participation. Each badge marks something you actually did; the ones
          ahead stay greyed until you get there — an honest map of the road, never a scold.
        </p>
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
                      {b.earned ? <span className="bd-tag earned">Earned</span> : <span className="bd-tag">Ahead</span>}
                    </div>
                    <p className="bd-meaning">{BADGE_MEANING[b.id] ?? b.earn_rule}</p>
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

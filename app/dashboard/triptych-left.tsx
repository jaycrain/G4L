import Link from 'next/link';
import type { Db } from '../../lib/db/schema.ts';
import type { Dashboard } from '../../lib/gateway/flow.ts';
import { latestGrintaReading } from '../../lib/grinta/survey/store.ts';
import { getPassport } from '../../lib/curriculum/view.ts';
import IdqRadar from './idq-radar.tsx';
import BadgeStamp, { BadgeStampPlaceholder } from './badge-stamp.tsx';

// Triptych LEFT flank — "Where You Are" (reflect / the mirrors): ID Score · Grinta Index · Badges. Server component: the
// panels are moved from redesign-dashboard AS-IS (same .rcard/.rreg-*/.r-badges classes, same See-more foot links), just
// stacked in the 280px flank instead of the old 3-up register grid. Rendered on the server and passed into the client
// triptych shell as a node. (When the triptych flips and the old dashboard retires, these move to shared panels; until
// then the live dashboard keeps its own copy untouched.)

const R_STRANDS = [
  { key: 'reconnect', label: 'Reconnect' },
  { key: 'rewire', label: 'Rewire' },
  { key: 'rebuild', label: 'Rebuild' },
  { key: 'reclaim', label: 'Reclaim' },
] as const;
const R_RING_COLOR: Record<string, string> = { reconnect: '#374f63', rewire: '#3b9495', rebuild: '#919536', reclaim: '#ec6233' };
const ARROW: Record<string, string> = { up: '↑', down: '↓', flat: '→' };

export default async function TriptychLeft({ db, memberId, dash }: { db: Db; memberId: string; dash: Dashboard }) {
  const [grinta, passport, idqRows] = await Promise.all([
    latestGrintaReading(db, memberId),
    getPassport(db, memberId),
    // Last completed IDQ → the next one is due 60 days on (the frozen cadence). Drift-hardened: any hiccup hides the line.
    db
      .query<{ last: unknown }>('select max(taken_at) as last from idq_retake where member_id=$1 and cycle_indicator=1', [memberId])
      .catch(() => ({ rows: [] as { last: unknown }[] })),
  ]);
  const lastIdq = idqRows.rows[0]?.last ? new Date(idqRows.rows[0].last as string) : null;
  const nextIdqLabel = lastIdq
    ? new Date(lastIdq.getTime() + 60 * 86_400_000).getTime() <= Date.now()
      ? 'ready now'
      : new Date(lastIdq.getTime() + 60 * 86_400_000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div className="tri-stack">
      {/* Identity Reading (the ID Score, member-facing label) — the mirror */}
      <div className="rcard r-reg" data-tour="idscore">
        <div className="rreg-eyebrow">Identity Reading</div>
        <div className="rc-sub">How close you are to yourself.</div>
        {dash.score ? (
          <>
            <div className="rreg-big">
              {Math.round(dash.score.score)}
              {dash.score.direction && dash.score.direction !== 'flat' && (
                <span className={`rreg-dir dir-${dash.score.direction}`}>
                  {ARROW[dash.score.direction]}
                  {dash.score.delta !== null && Math.round(dash.score.delta) !== 0
                    ? ` ${dash.score.delta > 0 ? '+' : ''}${Math.round(dash.score.delta)}`
                    : ''}
                </span>
              )}
            </div>
            {dash.score.dimensions && (
              <div className="rreg-radar"><IdqRadar current={dash.score.dimensions} size={104} withLabels={false} /></div>
            )}
            {nextIdqLabel && <div className="rreg-nextidq">Your next IDQ is {nextIdqLabel}</div>}
          </>
        ) : (
          <p className="muted rreg-blank">Blank for now — it fills the moment you start Reconnect.</p>
        )}
        <Link href={`/score/${memberId}`} className="rreg-more">See more →</Link>
      </div>

      {/* Grinta Index — grit */}
      <div className="rcard r-reg">
        <div className="rreg-eyebrow">Grinta Index</div>
        <div className="rc-sub">Grit. Stronger each Phase.</div>
        {grinta ? (
          <>
            <div className="rreg-big">
              {grinta.composite}
              <span className="rreg-unit"> / 5</span>
              {grinta.changePct !== null && grinta.direction && grinta.direction !== 'flat' && (
                <span className={`rreg-dir dir-${grinta.direction}`}>
                  {ARROW[grinta.direction]}
                  {grinta.changePct !== 0 ? ` ${grinta.changePct > 0 ? '+' : ''}${grinta.changePct}%` : ''}
                </span>
              )}
            </div>
            <div className="rreg-strands">
              {R_STRANDS.map((r) => {
                const v = grinta.strands[r.key];
                return (
                  <div className="rreg-strand" key={r.key}>
                    <span><span className="rreg-dot" style={{ background: R_RING_COLOR[r.key] }} />{r.label}</span>
                    <span>{v != null ? v : '—'}</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="muted rreg-blank">Blank for now — your grit baseline lands when you finish the intro.</p>
        )}
        <Link href={`/grinta/${memberId}`} className="rreg-more">See more →</Link>
      </div>

      {/* Badges — the ceremonial shelf */}
      <div className="rcard r-badges">
        <div className="rb-head">
          <div className="rc-h">Your Badges</div>
          <span className="rb-count">{passport.earned} of {passport.total} earned</span>
        </div>
        <div className="rc-sub">Earned for real accomplishments — revealed when you get there.</div>
        <div className="rb-shelf">
          {passport.badges.map((b) => (
            <BadgeStamp key={b.id} badge={b} />
          ))}
          {Array.from({ length: passport.placeholders }).map((_, i) => (
            <BadgeStampPlaceholder key={`ph-${i}`} />
          ))}
        </div>
        <Link href={`/badges/${memberId}`} className="rreg-more">See more →</Link>
      </div>
    </div>
  );
}

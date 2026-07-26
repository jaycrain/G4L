import Link from 'next/link';
import type { Db } from '../../lib/db/schema.ts';
import type { Dashboard } from '../../lib/gateway/flow.ts';
import { latestGrintaReading } from '../../lib/grinta/survey/store.ts';
import { getPassport } from '../../lib/curriculum/view.ts';
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
// The four IDQ (PSSO) dimensions, each scored /30 — the numeric read behind the headline ID Score.
const IDQ_DIMS = [
  { key: 'physical', label: 'Physical' },
  { key: 'self', label: 'Self' },
  { key: 'social', label: 'Social' },
  { key: 'outlook', label: 'Outlook' },
] as const;

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
  // The four PSSO dimensions + their raw sum (/120) — the numeric breakdown behind the headline, so the member can see
  // the four don't add up to the big number: the sum scales to a 0–100 read.
  const idqDims = dash.score?.dimensions ?? null;
  const idqSum = idqDims ? idqDims.physical + idqDims.self + idqDims.social + idqDims.outlook : null;

  return (
    <div className="tri-stack">
      {/* ID Score — the mirror */}
      <div className="rcard r-reg" data-tour="idscore">
        <div className="rreg-eyebrow">ID Score</div>
        <div className="rc-sub">Your Identity Distance — the gap between you and your true self.</div>
        {dash.score ? (
          <>
            <div className="rreg-big">
              {Math.round(dash.score.score)}<span className="rreg-unit"> / 100</span>
              {dash.score.direction && dash.score.direction !== 'flat' && (
                <span className={`rreg-dir dir-${dash.score.direction}`}>
                  {ARROW[dash.score.direction]}
                  {dash.score.delta !== null && Math.round(dash.score.delta) !== 0
                    ? ` ${dash.score.delta > 0 ? '+' : ''}${Math.round(dash.score.delta)}`
                    : ''}
                </span>
              )}
            </div>
            {idqDims && idqSum !== null && (
              <>
                {/* The numeric read behind the headline — each dimension /30, then the raw sum /120, so the scaling is
                    honest: the four don't add up to the big number; the sum scales to a 0–100 read. */}
                <div className="rreg-strands">
                  {IDQ_DIMS.map((dim) => (
                    <div className="rreg-strand" key={dim.key}>
                      <span>{dim.label}</span>
                      <span className="rreg-dimv">{idqDims[dim.key]}<span className="rreg-dimmax">/30</span></span>
                    </div>
                  ))}
                  <div className="rreg-strand rreg-strand-total">
                    <span>Total</span>
                    <span className="rreg-dimv">{idqSum}<span className="rreg-dimmax">/120</span></span>
                  </div>
                </div>
                <p className="rreg-scalenote">Your ID Score scales that total — {idqSum} of 120 — to a 0–100 read.</p>
              </>
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
          <div className="rc-h">Badges</div>
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

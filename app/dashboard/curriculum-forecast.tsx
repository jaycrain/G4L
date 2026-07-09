import Link from 'next/link';
import type { Forecast } from '../../lib/curriculum/view.ts';

// Dashboard "Your Program" panel (Dashboard Reshuffle §4) — SLIM: current phase + a progress strip +
// the lit next Session, and a link to the full four-phase map at /program. The full map and the daily
// strip no longer render here (the map moved to /program; the daily chips graduate to Slice 2).
const R_COLOR: Record<string, string> = { reconnect: '#374f63', rewire: '#3b9495', rebuild: '#919536', reclaim: '#ec6233' };

export default function CurriculumForecast({ memberId, forecast }: { memberId: string; forecast: Forecast }) {
  const here = forecast.phases.find((p) => p.status === "You're here");
  const total = here?.items.length ?? 0;
  const done = here?.items.filter((it) => it.state === 'done').length ?? 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const cur = forecast.current;

  return (
    <div className="card curric curric-slim" data-tour="program">
      <h3>The Program</h3>
      <p className="card-subtitle">What&apos;s next in your work — and how far you&apos;ve come.</p>

      {here && (
        <div className="curric-progress">
          <div className="curric-progress-top">
            <span className="phn" style={{ color: R_COLOR[here.phase] }}>{here.label}</span>
            <span className="muted">{done} of {total} done</span>
          </div>
          <div className="pbar"><div className="pfill" style={{ width: `${pct}%`, background: R_COLOR[here.phase] }} /></div>
        </div>
      )}

      {cur ? (
        <div className="litrow" data-tour="next-step">
          <div className="littag">{cur.kind === 'checkpoint' ? '⚑ Checkpoint' : '▶ Next Session'}</div>
          <div className="littitle">{cur.title}</div>
          {cur.summary && <div className="lithook">{cur.summary}</div>}
          {!cur.openable ? (
            <span className="open open-soon">Coming soon</span>
          ) : cur.route ? (
            // v2.3 conversational Rewire — the asset carries its exact route.
            <Link className="open" href={cur.route.replace('{memberId}', memberId)} prefetch={false}>
              {cur.kind === 'checkpoint' ? 'Cross this Checkpoint →' : 'Open this Session →'}
            </Link>
          ) : cur.kind === 'checkpoint' ? (
            <Link className="open" href={`/checkpoint/${memberId}/${cur.id}`} prefetch={false}>Cross this Checkpoint →</Link>
          ) : (
            <Link className="open" href={`/session/${memberId}/${cur.id}`} prefetch={false}>Open this Session →</Link>
          )}
        </div>
      ) : (
        <p className="muted">You&apos;re all caught up on your path for now.</p>
      )}

      <Link href={`/program/${memberId}`} className="see-more" prefetch={false}>Full program →</Link>
    </div>
  );
}

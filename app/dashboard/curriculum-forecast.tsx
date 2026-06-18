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
    <div className="card curric curric-slim">
      <div className="curric-slim-head">
        <h3>Your Program</h3>
        <Link href={`/program/${memberId}`} className="see-more">Full program →</Link>
      </div>

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
        <div className="litrow">
          <div className="littag">{cur.kind === 'checkpoint' ? '⚑ Checkpoint' : '▶ Next Session'}</div>
          <div className="littitle">{cur.title}</div>
          {cur.summary && <div className="lithook">{cur.summary}</div>}
          {!cur.openable ? (
            <span className="open open-soon">Coming soon</span>
          ) : cur.kind === 'checkpoint' ? (
            <Link className="open" href={`/checkpoint/${memberId}/${cur.id}`}>Cross this Checkpoint →</Link>
          ) : (
            <Link className="open" href={`/session/${memberId}/${cur.id}`}>Open this Session →</Link>
          )}
        </div>
      ) : (
        <p className="muted">You&apos;re all caught up on your path for now.</p>
      )}
    </div>
  );
}

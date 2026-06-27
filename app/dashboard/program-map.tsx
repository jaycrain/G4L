import Link from 'next/link';
import type { ForecastPhase } from '../../lib/curriculum/view.ts';

// The full four-phase curriculum map — the whole Atlas like a textbook's chapters, the current Session
// lit with its Open-this-Session CTA, completed checked, the rest greyed ahead. Lives on the /program
// sub-page now (Dashboard Reshuffle §4); the dashboard panel shows only the lit next Session. The daily
// strip is intentionally NOT rendered here — it graduates to the daily layer in Slice 2.
const R_COLOR: Record<string, string> = { reconnect: '#374f63', rewire: '#3b9495', rebuild: '#919536', reclaim: '#ec6233' };

export default function ProgramMap({ memberId, phases }: { memberId: string; phases: ForecastPhase[] }) {
  return (
    <div className="cgrid">
      {phases.map((ph) => (
        <div className={`phase${ph.status === "You're here" ? ' is-here' : ''}`} key={ph.phase}>
          <div className="phh" style={{ borderLeftColor: R_COLOR[ph.phase] }}>
            <span className="phn" style={{ color: R_COLOR[ph.phase] }}>{ph.label}</span>
            <span className="phs">{ph.status}</span>
          </div>
          {ph.items.map((it) =>
            it.state === 'current' ? (
              <div className="litrow" key={it.id}>
                <div className="littag">{it.kind === 'checkpoint' ? '⚑ Checkpoint' : '▶ Next Session'}</div>
                <div className="littitle">{it.title}</div>
                {it.hook && <div className="lithook">{it.hook}</div>}
                {!it.openable ? (
                  <span className="open open-soon">Coming soon</span>
                ) : it.kind === 'checkpoint' ? (
                  <Link className="open" href={`/checkpoint/${memberId}/${it.id}`} prefetch={false}>Cross this Checkpoint →</Link>
                ) : (
                  <Link className="open" href={`/session/${memberId}/${it.id}`} prefetch={false}>Open this Session →</Link>
                )}
              </div>
            ) : (
              <div className={`crow2 ${it.state}`} key={it.id}>
                <span className="mk" aria-hidden="true">{it.state === 'done' ? '✓' : it.kind === 'checkpoint' ? '⚑' : '○'}</span>
                <span className="t2">{it.title}</span>
                {it.kind === 'checkpoint' && <span className="kt">Checkpoint</span>}
                {it.kind === 'measurement' && <span className="kt idq">IDQ</span>}
              </div>
            ),
          )}
        </div>
      ))}
    </div>
  );
}

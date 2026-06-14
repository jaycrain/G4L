import Link from 'next/link';
import type { Forecast } from '../../lib/curriculum/view.ts';

// Zone 3 — the curriculum forecast: the whole Atlas like a textbook's chapters, the current Session
// lit with its Open-this-Session CTA, completed checked, the rest greyed ahead. Same lit-path grammar
// as the badges and the Session steps. The daily layer runs across the foot.
const R_COLOR: Record<string, string> = { reconnect: '#374f63', rewire: '#3b9495', rebuild: '#919536', reclaim: '#ec6233' };

export default function CurriculumForecast({ memberId, forecast }: { memberId: string; forecast: Forecast }) {
  return (
    <div className="card curric">
      <h3>Your Program</h3>
      <p className="muted">Every chapter, start to finish — so you always know what you&apos;re walking into. Your next Session is lit.</p>

      <div className="cgrid">
        {forecast.phases.map((ph) => (
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
                    <Link className="open" href={`/checkpoint/${memberId}/${it.id}`}>Cross this Checkpoint →</Link>
                  ) : (
                    <Link className="open" href={`/session/${memberId}/${it.id}`}>Open this Session →</Link>
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

      <div className="across">
        <div className="acrlbl">Running across your whole path — every day</div>
        <div className="chips">
          {forecast.daily.map((d) => (
            <span className="chip" key={d.id}>{d.title}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

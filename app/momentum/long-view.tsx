import { bucketize, trendSummary, RANGES, type Range, type DayCount } from '../../lib/momentum/trend.ts';

// THE LONG VIEW — Momentum at four zooms, the thing a 7-day practice grid structurally cannot show.
//
// This is what earns Momentum its own surface rather than folding into "This week". The week is where you DO it;
// this is where you watch it add up across phases. It never resets.
//
// NO CLIENT STATE. The zoom lives in the URL (?range=), so the back button works, a link can point at a specific
// zoom, and the whole thing stays a server component — no hydration, nothing to go stale.
//
// COLOUR IS A GOVERNANCE DECISION HERE, not decoration. A false start is logged as HONEST (Greg's framing) — it is
// the member noticing, which is the skill the whole phase is teaching. Drawing it in Deep Red would code it as
// failure and quietly turn a mirror into a report card, so it is Navy: present, countable, not an alarm. Good
// calls are Olive. On-track days are Light grey — a steady day is a day, not an absence. (The member-facing
// label is "On Track"; the stored enum is still quiet_day, and the naming guard bans the old word on sight.)

export default function MomentumLongView({
  memberId,
  days,
  range,
}: {
  memberId: string;
  days: DayCount[];
  range: Range;
}) {
  const buckets = bucketize(days, range);
  const peak = Math.max(1, ...buckets.map((b) => b.good + b.missed + b.quiet));

  return (
    <section className="card mlv">
      <h3>The long view</h3>
      <p className="card-subtitle">
        Your calls, adding up. This one never resets — it runs alongside every Phase, so you can see the shape of it
        rather than just this week.
      </p>

      <nav className="mlv-zoom" aria-label="Time range">
        {RANGES.map((r) => (
          <a
            key={r.key}
            href={`/momentum/${memberId}?range=${r.key}`}
            className={`mlv-z${r.key === range ? ' on' : ''}`}
            aria-current={r.key === range ? 'page' : undefined}
          >
            {r.label}
          </a>
        ))}
      </nav>

      <p className="mlv-sum">{trendSummary(buckets, range)}</p>

      {buckets.length > 0 && (
        <>
          <div className="mlv-chart" role="img" aria-label={trendSummary(buckets, range)}>
            {buckets.map((b, i) => {
              const total = b.good + b.missed + b.quiet;
              return (
                <div key={i} className="mlv-col">
                  <div className="mlv-stack" style={{ height: `${Math.round((total / peak) * 100)}%` }}>
                    {b.quiet > 0 && <span className="mlv-b q" style={{ flexGrow: b.quiet }} />}
                    {b.missed > 0 && <span className="mlv-b m" style={{ flexGrow: b.missed }} />}
                    {b.good > 0 && <span className="mlv-b g" style={{ flexGrow: b.good }} />}
                  </div>
                  <span className="mlv-lab">{b.label}</span>
                </div>
              );
            })}
          </div>
          <div className="mlv-key">
            <span><i className="mlv-b g" /> Good calls</span>
            <span><i className="mlv-b m" /> False starts</span>
            <span><i className="mlv-b q" /> On track</span>
          </div>
        </>
      )}
    </section>
  );
}

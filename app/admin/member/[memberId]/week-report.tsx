import { shortDate } from '../../../../lib/time/member-clock.ts';
import type { MemberWeekReport } from '../../../../lib/report/member-week.ts';

// THE WEEK-BY-WEEK REPORT, in the Founder Console.
//
// Jay, 2026-08-15, relaying a charter member: "they wanted a report on how everything they entered in the
// Playbook was going. And a week to week comparison over time. And they want to know somebody IS watching. And
// that's me in the FC."
//
// Read-only, and computed — every number here comes from memberWeekReport. Nothing on this surface is phrased by
// a model, because this is where Jay decides whether to contact a real person and a plausible sentence is worse
// than no sentence.
//
// ── THE POSTURE, WHICH IS THE HARD PART ───────────────────────────────────────────────────────────────────
// This will be rendered to the MEMBER later ("see my reports"), so it is written now as if they were reading
// it. That rules out the shapes an operator dashboard reaches for by default:
//
//   · no adherence percentage, and no RAG colour. "2 / 5" is a fact; "40%, amber" is a verdict.
//   · no streaks. A streak makes the break the story.
//   · a quiet week reads as quiet, not as failure — the same reason a blank day on the week grid is just a day.
//
// Deltas are shown as direction and size (+2 / −1), never as "improvement". Whether a week with fewer marks is
// worse is not something a table gets to decide.

/** A change between adjacent weeks, rendered only when there IS a previous week to compare against. */
function Delta({ now, prev, unit = '' }: { now: number | null; prev: number | null | undefined; unit?: string }) {
  if (now == null || prev == null) return null;
  const d = Math.round((now - prev) * 10) / 10;
  if (d === 0) return <span className="wr-delta wr-flat">even</span>;
  return (
    <span className={`wr-delta ${d > 0 ? 'wr-up' : 'wr-down'}`}>
      {d > 0 ? '+' : '−'}
      {Math.abs(d)}
      {unit}
    </span>
  );
}

function weekLabel(w: MemberWeekReport['window']): string {
  return `${shortDate(w.start)} – ${shortDate(w.end)}`;
}

export default function WeekReport({ weeks }: { weeks: MemberWeekReport[] }) {
  if (!weeks.length) return null;

  return (
    <section className="wr">
      <h2 className="wr-h">Week by week</h2>
      <p className="wr-lede">
        Everything they entered, and what happened to it. Newest first. Counts only — no scores, no streaks.
      </p>

      {weeks.map((w, i) => {
        const prev = weeks[i + 1]; // the list is newest-first, so the PREVIOUS week is the next element
        const empty =
          !w.commitments.length &&
          !w.qualityDays.logged &&
          !w.moves.changes.length &&
          !w.sessionsClosed.length &&
          !w.readings.length;

        return (
          <div key={w.window.start} className="wr-week">
            <div className="wr-week-h">
              <span className="wr-range">{weekLabel(w.window)}</span>
              {i === 0 && <span className="wr-now">this week</span>}
            </div>

            {empty ? (
              // A WEEK WITH NOTHING IN IT SAYS SO PLAINLY. Not "0 of 5", not an empty grid implying failure —
              // people have weeks. The operator needs to know it was quiet, not be nudged to read it as a lapse.
              <p className="wr-quiet">Nothing logged this week.</p>
            ) : (
              <>
                {w.qualityDays.logged > 0 && (
                  <div className="wr-row">
                    <span className="wr-lab">Quality Days</span>
                    <span className="wr-val">
                      {w.qualityDays.average} / 10 <span className="wr-sub">across {w.qualityDays.logged} day{w.qualityDays.logged === 1 ? '' : 's'}</span>
                      <Delta now={w.qualityDays.average} prev={prev?.qualityDays.average} />
                    </span>
                    {/* The SERIES, not just the mean — a 4 then a 9 is a different week from two 6.5s. */}
                    <span className="wr-series">
                      {w.qualityDays.points.map((p) => (
                        <span key={p.on} className="wr-pt" title={`${p.on} · ${p.score}/10 · ${p.elements} element${p.elements === 1 ? '' : 's'}`}>
                          {p.score}
                        </span>
                      ))}
                    </span>
                  </div>
                )}

                {w.commitments.map((c) => {
                  const before = prev?.commitments.find((x) => x.kind === c.kind && x.slot === c.slot);
                  return (
                    <div key={`${c.kind}-${c.slot}`} className="wr-row">
                      <span className="wr-lab" title={c.label}>{c.label}</span>
                      <span className="wr-val">
                        {c.hit}{c.target != null ? ` of ${c.target}` : ''}
                        <Delta now={c.hit} prev={before?.hit} />
                      </span>
                      {/* Seven dots, in order. Which days is a different fact from how many. */}
                      <span className="wr-days">
                        {c.days.map((on, d) => (
                          <span key={d} className={`wr-day${on ? ' on' : ''}`} />
                        ))}
                      </span>
                    </div>
                  );
                })}

                {(w.moves.changes.length > 0 || w.moves.reruns > 0) && (
                  <div className="wr-row">
                    <span className="wr-lab">Moves</span>
                    <span className="wr-val">
                      {w.moves.kept} kept
                      {w.moves.reruns > 0 && <span className="wr-sub"> · run {w.moves.reruns}×</span>}
                    </span>
                    <span className="wr-changes">
                      {w.moves.changes.map((c, n) => (
                        <span key={n} className={`wr-chg wr-chg-${c.change}`} title={c.text ?? ''}>
                          {c.change}
                        </span>
                      ))}
                    </span>
                  </div>
                )}

                {w.sessionsClosed.length > 0 && (
                  <div className="wr-row">
                    <span className="wr-lab">Sessions closed</span>
                    <span className="wr-val">
                      {w.sessionsClosed.map((s) => (s.times > 1 ? `${s.ref} ×${s.times}` : s.ref)).join(', ')}
                    </span>
                  </div>
                )}

                {w.readings.length > 0 && (
                  <div className="wr-row">
                    <span className="wr-lab">Assessments</span>
                    <span className="wr-val">{w.readings.map((r) => r.kind).join(', ')}</span>
                  </div>
                )}
              </>
            )}

            {/* THE HONEST FOOTNOTE. Weeks before the audit trigger have no Move history because it was
                overwritten, not because the member did nothing. Rendering that silence as a quiet week would be
                exactly the confident-lie shape this project keeps paying for. */}
            {!w.moves.historyComplete && (
              <p className="wr-gap">Move history wasn’t being recorded yet this week — absence here isn’t evidence.</p>
            )}
          </div>
        );
      })}
    </section>
  );
}

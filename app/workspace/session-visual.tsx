import type { SessionVisual, PriorityBarRow } from '../../lib/agent/session-visual.ts';
import { PRIORITY_SEGMENT_LABEL } from '../../lib/agent/session-visual.ts';

// THE ONE PLACE A SESSION VISUAL IS DRAWN.
//
// The engine describes, the client renders — the same split as the 1–5 chips. A new visual adds a `kind` to the
// union and one branch here; it should never need a new plumbing path, a new store, or a new migration. That is
// the whole reason this is a mechanism rather than a chart (Jay, 2026-08-14).
//
// Server component on purpose: it takes data and returns markup, with no state and no interaction. A visual that
// ever needs to be clickable is a different thing and should say so in its own type.

/** Bars to scale, numbers always printed. See the note in lib/agent/session-visual.ts for why we do not rescale. */
function PriorityBars({ lead, rows }: { lead: string; rows: PriorityBarRow[] }) {
  return (
    <figure className="sv" aria-label="Your four life areas, by priority">
      {/* The read comes FIRST — a member should meet the sentence before the shapes, so the picture arrives already
          framed. It travels with the data (see the type) precisely so it cannot drift from what is drawn. */}
      <figcaption className="sv-lead">{lead}</figcaption>
      <div className="sv-bars">
        {rows.map((r) => {
          // Guard against a zero-length bar dividing by zero — a member can answer so that every gap is 0.
          const total = r.total > 0 ? r.total : 1;
          const pct = (n: number) => `${(n / total) * 100}%`;
          return (
            <div key={r.label} className="sv-row">
              <span className="sv-dom">{r.label}</span>
              <span className="sv-bar">
                <span className="sv-seg sv-status" style={{ width: pct(r.status) }} />
                <span className="sv-seg sv-ready" style={{ width: pct(r.readiness) }} />
                <span className="sv-seg sv-ripple" style={{ width: pct(r.ripple) }} />
              </span>
              {/* THE NUMBERS CARRY THE SMALL SEGMENTS. At real values a long bar is ~85% Distance and Ready can be
                  a four-percent sliver — and the sliver is often the whole point, because the shortest bar is
                  frequently the readiest. Printing all three is what makes that legible without faking the widths. */}
              <span className="sv-nums">
                {PRIORITY_SEGMENT_LABEL.status} {Math.round(r.status)} · {PRIORITY_SEGMENT_LABEL.readiness}{' '}
                {r.readiness} · {PRIORITY_SEGMENT_LABEL.ripple} {r.ripple}
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

export default function SessionVisualView({ visual }: { visual: SessionVisual }) {
  // Exhaustive by construction: adding a union member without a branch is a type error at the switch, not a blank
  // space in a member's Session.
  switch (visual.kind) {
    case 'priority-bars':
      return <PriorityBars lead={visual.lead} rows={visual.rows} />;
  }
}

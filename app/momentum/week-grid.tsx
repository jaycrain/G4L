'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { WeekGrid as Grid } from '../../lib/practice/grid.ts';
import Link from 'next/link';
import { isTappable, logSurfaceFor, dateForDay, canLogOn } from '../../lib/practice/mark.ts';
import { toggleMarkAction } from './actions.ts';

// THE WEEK GRID — Greg's tracker (2026-08-07): the member's committed goals as rows, seven day columns, ticked when
// done, with the number they aimed for beside them. "It would help to show progress during the week to maintain
// motivation."
//
// TWO DELIBERATE DIVERGENCES FROM HIS SPREADSHEET, both worth defending to him:
//
// 1 · NO RED, AND NO "MISSED" STATE. His sheet uses red for structure. Here an untouched day is simply blank — not
//     amber, not red, not a dash that reads as a reproach. The practice week is a productive default and never a
//     gate (Decision MM/R1), and the whole product posture is normalize-don't-grade: "the Fade is a hundred
//     reasonable decisions, not a failing." A grid that scolds is a grid people stop opening, and then we've lost
//     both the data and the member.
//
// 2 · NO TARGET LINE WHERE THE MEMBER NEVER SET ONE. C3's Quality-Day elements and W3's daily notice have no target,
//     so they show a plain count and no "/ 5". Rendering a denominator they never chose would invent a standard and
//     then quietly hold them to it.
//
// Today's column is outlined rather than filled, so "where am I" reads without a legend.

const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * Column letters for a window. A full week reads M T W T F S S; a partial first week that opened on a Thursday
 * reads T F S S and stops — it has four columns, not seven rotated round.
 *
 * Reads the window's own start date (already a member-local calendar date) rather than the started_at timestamp,
 * which is an instant and would shift the letters for anyone west of Greenwich.
 */
function dayLetters(window: { start: string; days: number }): string[] {
  const d = new Date(`${window.start}T00:00:00Z`);
  const startIdx = Number.isNaN(d.getTime()) ? 0 : (d.getUTCDay() + 6) % 7; // JS Sunday=0 → Monday=0
  return Array.from({ length: window.days }, (_, i) => DAY_INITIALS[(startIdx + i) % 7]!);
}

export default function WeekGridPanel({ memberId, grid }: { memberId: string; grid: Grid }) {
  // Optimistic marks: a tick must feel instant. Keyed slot → day-index set.
  const [local, setLocal] = useState<Record<string, boolean[]>>(() =>
    Object.fromEntries(grid.rows.map((r) => [r.slot, r.marks])),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  // THE TICK SAVED AND THEN LOOKED LIKE IT HADN'T. `local` is seeded by a useState INITIALISER, which runs once per
  // mount, and nothing refreshed the server data after a toggle. So: tap → row written → prop still stale → switch
  // tabs (the Playbook unmounts this panel) → come back → re-seeded from the stale prop → the tick is gone, while
  // the mark sits in the database (Jay, 2026-08-11: "while it registers a click, when you click on another tab and
  // come back, it's gone").
  //
  // That is a successful write rendering as a failure — worse than the reverse, because the member re-ticks a day
  // that was already recorded and learns the tool cannot be trusted. Refresh after a save so the server catches up,
  // and re-seed when the grid it returns actually differs.
  const serverMarks = JSON.stringify(grid.rows.map((r) => [r.slot, r.marks]));
  const lastServer = useRef(serverMarks);
  useEffect(() => {
    if (lastServer.current === serverMarks) return;
    lastServer.current = serverMarks;
    setLocal(Object.fromEntries(grid.rows.map((r) => [r.slot, r.marks])));
  }, [serverMarks, grid.rows]);
  const letters = dayLetters(grid.window);
  const today = grid.day - 1; // 0-based
  // W3 and C3 grids MIRROR a log the member wrote notes into; un-ticking would have to delete that. Read-only there
  // — and the UI must not offer a tap it can't honour, so it asks rather than assumes (see lib/practice/mark.ts).
  const tappable = isTappable(grid.kind);
  // ...and where it CAN'T honour a tap, it now says where the member should go. C3's daily log existed for weeks
  // with no link to it anywhere in the app, so this grid was the whole feature as far as a member could tell.
  // A mirror cell now navigates to the surface that owns the record instead of silently refusing (Jay, 2026-08-09).
  const logTo = tappable ? null : logSurfaceFor(grid.kind, memberId);
  // C3 ONLY, and deliberately unlike the other four grids (Jay, 2026-08-15).
  //
  // The other grids are element×day matrices where a cell IS the fact — tap it, it's true. C3's record is one row
  // PER DAY: a 1–10 score plus the set of elements that showed up. The grid rendered only the elements, as boxes
  // that looked exactly like the tappable ones next to them, so Jay logged a week believing he was scoring "bike
  // ride" individually. Five grids that look identical while one behaves completely differently is the trap.
  //
  // So for C3 the DAY is the unit: a score row across the top (the measure, previously invisible), element cells
  // rendered as dots rather than switches, and the whole column as the target. It looks different because it IS
  // different — consistency that misleads is worse than a considered departure.
  const dayLed = grid.kind === 'c3_quality' && !!logTo;
  const scores = grid.scores ?? null;
  // The member's today, derived from the window rather than the browser clock — the server already resolved their
  // zone to build this window, and asking the device again is how a date drifts by one between the two.
  const todayDate = dateForDay(grid.window, today);

  if (!grid.rows.length) return null; // W2 has nothing countable — no grid rather than an empty one

  // W3's trigger rows are MUTUALLY EXCLUSIVE within a day: Greg's field is `trigger_fired`, singular — "which named
  // trigger, or 'new'". So ticking a second one MOVES the record. The optimistic update has to move it too, or the
  // member sees two ticks for a moment and learns the grid is approximate. 'logged' is the day itself, not a trigger.
  const exclusiveRow = (slot: string) => grid.kind === 'w3_logging' && slot !== 'logged';

  const toggle = (slot: string, dayIdx: number) => {
    if (!tappable || dayIdx > today) return; // you can't tick a day that hasn't happened
    const before = local;
    const turningOn = !local[slot]![dayIdx];
    const next: Record<string, boolean[]> = { ...local, [slot]: local[slot]!.map((v, i) => (i === dayIdx ? !v : v)) };
    if (turningOn && exclusiveRow(slot)) {
      for (const r of grid.rows) {
        if (r.slot === slot || !exclusiveRow(r.slot)) continue;
        next[r.slot] = next[r.slot]!.map((v, i) => (i === dayIdx ? false : v));
      }
    }
    setError(null);
    setLocal(next);
    startTransition(async () => {
      const res = await toggleMarkAction(memberId, slot, dayIdx, grid.kind);
      if (!res.ok) {
        // SNAP BACK **AND SAY WHY**. Silently reverting is how a member concludes the tool is broken; the refusal
        // that matters here — "you wrote something into that day" — is information, not an error to hide.
        setLocal(before);
        setError(res.error ?? 'Could not save that — please try again.');
        return;
      }
      router.refresh(); // the saved mark becomes the SERVER's truth, so a remount re-seeds from it and not from stale props
    });
  };

  return (
    <div className={`wk-grid${pending ? ' wk-saving' : ''}`}>
      {/* THE FIRST FEW DAYS, KEPT ON SCREEN. A Session that closed midweek runs a short stub to the Sunday and
          then rolls into a full Monday–Sunday. Without this, a member who ticked four days Thu–Sun would open the
          grid on Monday to an empty one and reasonably conclude the app lost their week (Jay, 2026-08-12).
          Read-only: those days are done, and offering a tick would invite editing history. */}
      {grid.prior && (
        <div className="wk-prior">
          <span className="wk-prior-lab">First days</span>
          <table className="wk-table wk-table-mini">
            <tbody>
              {grid.prior.rows.map((r) => (
                <tr key={r.slot}>
                  <td className="wk-lab" title={r.label}>{r.label}</td>
                  {r.marks.map((on, i) => (
                    <td key={i}>
                      <span className={`wk-cell wk-readonly${on ? ' on' : ''}`} aria-label={`${r.label} — ${on ? 'logged' : 'not logged'}`}>
                        {on ? '✓' : ''}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="wk-head">
        <span className="wk-day">Day {grid.day} of {grid.window.days}</span>
        {/* The named action MOVED to the foot (Jay, 2026-08-14) — see the note down there. */}
      </div>
      <table className="wk-table">
        <thead>
          <tr>
            <th className="wk-lab" />
            {letters.map((l, i) => (
              <th key={i} className={i === today ? 'wk-today' : undefined} aria-label={i === today ? 'Today' : undefined}>{l}</th>
            ))}
            <th className="wk-aim">{grid.rows.some((r) => r.target) ? 'Aim' : ''}</th>
          </tr>
        </thead>
        <tbody>
          {/* THE SCORE ROW — the measure C3 exists to take, and it was not on this surface at all. A member could
              log all week and never see the number they gave a day; the elements read as the whole point. Placed
              FIRST, above a rule, because "how the day felt" is the record and the elements describe it. */}
          {dayLed && scores && (
            <tr className="wk-score-row">
              <td className="wk-lab">How the day felt</td>
              {scores.map((s, i) => {
                const on = dateForDay(grid.window, i);
                const openable = !grid.closed && i <= today && canLogOn(on, todayDate);
                const cell = s != null
                  ? <span className="wk-score">{s}</span>
                  : i > today
                    ? <span className="wk-score-none" aria-hidden="true">·</span>
                    : openable
                      ? <span className="wk-score-add">+</span>
                      : <span className="wk-score-none" aria-hidden="true">—</span>;
                return (
                  <td key={i} className={i === today ? 'wk-today-col' : undefined}>
                    {openable && logTo ? (
                      <Link
                        href={logSurfaceFor(grid.kind, memberId, on)!.href}
                        className="wk-score-link"
                        aria-label={s != null ? `Day ${i + 1} scored ${s} of 10. Open that day's log.` : `Day ${i + 1} not logged. Open that day's log.`}
                      >
                        {cell}
                      </Link>
                    ) : cell}
                  </td>
                );
              })}
              <td className="wk-aim" />
            </tr>
          )}
          {grid.rows.map((r) => {
            const marks = local[r.slot] ?? r.marks;
            const done = marks.filter(Boolean).length;
            return (
              <tr key={r.slot}>
                <td className="wk-lab" title={r.label}>{r.label}</td>
                {marks.map((on, i) => {
                  const cls = `wk-cell${on ? ' on' : ''}${i === today ? ' today' : ''}${i > today ? ' ahead' : ''}${tappable ? '' : ' wk-readonly'}`;
                  // A day that hasn't happened is never a target — not to tick, not to navigate to.
                  const ahead = i > today;
                  // C3: a READOUT, not a switch. A bordered box invites a tap and Jay took it — he logged a week
                  // believing each box scored its own element. A dot states what the day's record already says
                  // and offers nothing to press; the score row above owns the action.
                  if (dayLed) {
                    return (
                      <td key={i} className={i === today ? 'wk-today-col' : undefined}>
                        <span
                          className={`wk-dot${on ? ' on' : ''}${ahead ? ' ahead' : ''}`}
                          aria-label={`${r.label} — day ${i + 1}: ${ahead ? 'not yet' : on ? 'showed up' : 'not recorded'}`}
                        />
                      </td>
                    );
                  }
                  return (
                    <td key={i}>
                      {logTo && !ahead && !grid.closed ? (
                        <Link
                          href={logSurfaceFor(grid.kind, memberId, dateForDay(grid.window, i))!.href}
                          className={`${cls} wk-cell-link`}
                          aria-label={`${r.label} — day ${i + 1}${on ? ', logged' : ''}. Open your log.`}
                        >
                          {on ? '✓' : ''}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className={cls}
                          onClick={() => toggle(r.slot, i)}
                          disabled={!tappable || ahead}
                          aria-pressed={tappable ? on : undefined}
                          aria-label={`${r.label} — day ${i + 1}${on ? ', done' : ''}`}
                        >
                          {on ? '✓' : ''}
                        </button>
                      )}
                    </td>
                  );
                })}
                <td className="wk-aim">
                  {r.target ? <>{done}<span> / {r.target}</span></> : done ? <>{done}</> : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {error && <p className="wk-refusal">{error}</p>}
      <p className="wk-foot">
        {tappable
          ? 'Tap a day when you do one — or just tell me and I\u2019ll mark it.'
          : dayLed
            ? 'Tap a day to rate it and mark what showed up.'
          : logTo
            ? 'Tap any day to open your log — the grid mirrors what you write there.'
            : 'This mirrors what you\u2019ve told your Companion, so you can see the week at a glance.'}
      </p>
      {/* THE WAY BACK (Jay, 2026-08-14: "you can't get right back to the subpage easily"). These rows came FROM
          the Reclaim List, so the list is where a member goes to change what is being tracked — reword an item,
          track another, stop one. Only for this kind: every other week originates in a Session, and pointing
          those at the Reclaim List would be a link to somewhere they did not come from. Uses the house
          `.see-more` foot-link pattern rather than inventing a control. */}
      {/* THE NAMED ACTION, in the house position (Jay, 2026-08-14: "move Log today down to the lower left like
          where our standard nav links live"). It sat top-right beside "Day 4 of 6", which is a status area, not
          a place a member looks for something to DO. Tapping the grid is discoverable only if you try it — Jay
          did, most won't — so this link carries the affordance and belongs where every other foot link lives.
          Mutually exclusive with the Reclaim List link below: logTo only exists when the grid is NOT tappable,
          and reclaim_item is tappable, so these two never stack. */}
      {logTo && !grid.closed && (
        <Link className="see-more" href={logTo.href}>{logTo.label} →</Link>
      )}
      {grid.kind === 'reclaim_item' && (
        <Link className="see-more" href={`/reclaim-list/${memberId}`}>Your Reclaim List →</Link>
      )}
    </div>
  );
}

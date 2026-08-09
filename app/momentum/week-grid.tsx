'use client';

import { useState, useTransition } from 'react';
import type { WeekGrid as Grid } from '../../lib/practice/grid.ts';
import Link from 'next/link';
import { isTappable, logSurfaceFor } from '../../lib/practice/mark.ts';
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

/** Column letters starting from the day the week actually opened — a week that began on Thursday reads T F S S M T W. */
function dayLetters(startedAt: string): string[] {
  const d = new Date(startedAt);
  const startIdx = Number.isNaN(d.getTime()) ? 0 : (d.getUTCDay() + 6) % 7; // JS Sunday=0 → Monday=0
  return Array.from({ length: 7 }, (_, i) => DAY_INITIALS[(startIdx + i) % 7]!);
}

export default function WeekGridPanel({ memberId, grid }: { memberId: string; grid: Grid }) {
  // Optimistic marks: a tick must feel instant. Keyed slot → day-index set.
  const [local, setLocal] = useState<Record<string, boolean[]>>(() =>
    Object.fromEntries(grid.rows.map((r) => [r.slot, r.marks])),
  );
  const [pending, startTransition] = useTransition();
  const letters = dayLetters(grid.startedAt);
  const today = grid.day - 1; // 0-based
  // W3 and C3 grids MIRROR a log the member wrote notes into; un-ticking would have to delete that. Read-only there
  // — and the UI must not offer a tap it can't honour, so it asks rather than assumes (see lib/practice/mark.ts).
  const tappable = isTappable(grid.kind);
  // ...and where it CAN'T honour a tap, it now says where the member should go. C3's daily log existed for weeks
  // with no link to it anywhere in the app, so this grid was the whole feature as far as a member could tell.
  // A mirror cell now navigates to the surface that owns the record instead of silently refusing (Jay, 2026-08-09).
  const logTo = tappable ? null : logSurfaceFor(grid.kind, memberId);

  if (!grid.rows.length) return null; // W2 has nothing countable — no grid rather than an empty one

  const toggle = (slot: string, dayIdx: number) => {
    if (!tappable || dayIdx > today) return; // you can't tick a day that hasn't happened
    const next = { ...local, [slot]: local[slot]!.map((v, i) => (i === dayIdx ? !v : v)) };
    setLocal(next);
    startTransition(async () => {
      const res = await toggleMarkAction(memberId, slot, dayIdx);
      // Server disagreed (a stale tab, a lost row) → snap back rather than show a tick that didn't save.
      if (!res.ok) setLocal((cur) => ({ ...cur, [slot]: cur[slot]!.map((v, i) => (i === dayIdx ? !v : v)) }));
    });
  };

  return (
    <div className={`wk-grid${pending ? ' wk-saving' : ''}`}>
      <div className="wk-head">
        <span className="wk-day">Day {grid.day} of 7</span>
        {/* Tapping the grid is discoverable only if you try it — Jay did, most won't. The named action carries it. */}
        {logTo && !grid.closed && <Link href={logTo.href} className="wk-log">{logTo.label} →</Link>}
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
                  return (
                    <td key={i}>
                      {logTo && !ahead && !grid.closed ? (
                        <Link
                          href={logTo.href}
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
      <p className="wk-foot">
        {tappable
          ? 'Tap a day when you do one — or just tell me and I\u2019ll mark it.'
          : logTo
            ? 'Tap any day to open your log — the grid mirrors what you write there.'
            : 'This mirrors what you\u2019ve told your companion, so you can see the week at a glance.'}
      </p>
    </div>
  );
}

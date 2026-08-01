'use client';

import Link from 'next/link';
import type { Card } from '../../../lib/founder/cards.ts';

// A data card inside the Companion thread.
//
// It renders what the TOOL returned, not what the model said about it — see lib/founder/cards.ts. So the card
// is the thing to trust if the prose above it ever drifts.
//
// Rows link to the member where we have an id: a name you can't open is a dead end on a surface whose job is
// getting Jay to the person.

const TONE: Record<string, string> = {
  up: 'var(--teal)', down: 'var(--olive)', flat: 'var(--teal)', none: 'var(--light-grey)',
};

export default function DataCard({ card }: { card: Card }) {
  if (card.kind === 'table') {
    return (
      <div className="fc-dcard">
        <div className="fc-de">{card.eyebrow}</div>
        <table>
          <thead>
            <tr>{card.columns.map((c) => <th key={c.key} className={c.right ? 'r' : undefined}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {card.rows.map((row, i) => {
              const id = card.memberIds?.[i];
              return (
                <tr key={i}>
                  {card.columns.map((c, ci) => (
                    <td key={c.key} className={c.right ? 'r' : undefined}>
                      {ci === 0 && id
                        ? <Link href={`/admin/member/${id}`}>{String(row[c.key] ?? '')}</Link>
                        : String(row[c.key] ?? '')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // BARS. A member with no ID Score gets an empty track and "—", never a zero-height bar at zero: an absent
  // IDQ is not a low score, and drawing it as one would be the same false-zero this console keeps rooting out.
  const max = Math.max(100, ...card.bars.map((b) => b.value ?? 0));
  return (
    <div className="fc-dcard">
      <div className="fc-de">{card.eyebrow}</div>
      <div className="fc-bars">
        {card.bars.map((b) => (
          <div className="fc-bar" key={b.label} title={b.note}>
            <div className="fc-bar-v">{b.value ?? '—'}</div>
            <div className="fc-bar-track">
              <i style={{ height: `${b.value == null ? 0 : Math.max(3, (b.value / max) * 100)}%`, background: TONE[b.tone] }} />
            </div>
            <div className="fc-bar-l">{b.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

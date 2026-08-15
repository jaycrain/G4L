'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { logQualityDayAction } from './actions.ts';

// The daily Quality-Day check-in (Reclaim C3). A 1–10 score, the elements that showed up today (from the member's own
// profile), and two short reflections. Warm + non-judgmental — not a compliance scoreboard (the point is noticing).
/** Today's entry if one exists — the form EDITS it rather than starting blank. See the note on the page. */
export type QualityDayToday = { score: number; present: string[]; mostValuable?: string | null; mostMissing?: string | null } | null;

export default function QualityDayLog({
  memberId,
  elements,
  today = null,
}: {
  memberId: string;
  elements: string[];
  today?: QualityDayToday;
}) {
  // SEEDED FROM TODAY. The write replaces the day's record, so the form must arrive holding the whole record —
  // otherwise a second visit submits a partial one and erases the rest. Seeding is what makes replace correct,
  // and it is also what lets a member UNTICK something, which a server-side merge would have taken away.
  const [score, setScore] = useState<number | null>(today?.score ?? null);
  const [present, setPresent] = useState<Set<string>>(new Set(today?.present ?? []));
  const [valuable, setValuable] = useState(today?.mostValuable ?? '');
  const [missing, setMissing] = useState(today?.mostMissing ?? '');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function toggle(el: string) {
    setPresent((prev) => {
      const next = new Set(prev);
      next.has(el) ? next.delete(el) : next.add(el);
      return next;
    });
  }

  function submit() {
    if (score == null) return setError('Pick a score from 1 to 10.');
    setError(null);
    start(async () => {
      const r = await logQualityDayAction(memberId, score, [...present], valuable.trim() || undefined, missing.trim() || undefined);
      if (!r.ok) return setError(r.error ?? 'Could not log.');
      setDone(true);
      router.refresh();
    });
  }

  // "See you tomorrow" was true only while a day could be logged once. It is editable now, so the receipt says
  // what happened and leaves the door open.
  if (done) return <p className="momentum-log-done">Saved — that’s today. Come back and change it anytime.</p>;

  return (
    <div className="qd-log">
      <p className="card-subtitle">Overall, how much did today feel like a quality day?</p>
      <div className="qd-score">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" className={`qd-score-btn${score === n ? ' is-on' : ''}`} disabled={pending} onClick={() => setScore(n)}>
            {n}
          </button>
        ))}
      </div>
      {elements.length > 0 && (
        <div className="qd-elements">
          <span className="qd-elements-label">Which of these showed up today?</span>
          <div className="qd-elements-opts">
            {elements.map((el) => (
              <button key={el} type="button" className={`qd-el-btn${present.has(el) ? ' is-on' : ''}`} disabled={pending} onClick={() => toggle(el)}>
                {el}
              </button>
            ))}
          </div>
        </div>
      )}
      <textarea className="momentum-log-note" value={valuable} onChange={(e) => setValuable(e.target.value)} placeholder="What added the most value today? (optional)" rows={2} />
      <textarea className="momentum-log-note" value={missing} onChange={(e) => setMissing(e.target.value)} placeholder="What was most missing today? (optional)" rows={2} />
      <div className="momentum-log-options">
        <button type="button" className="momentum-log-btn" disabled={pending} onClick={submit}>
          Log today
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

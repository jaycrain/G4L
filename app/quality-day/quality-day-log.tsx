'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { logQualityDayAction } from './actions.ts';

// The daily Quality-Day check-in (Reclaim C3). A 1–10 score, the elements that showed up today (from the member's own
// profile), and two short reflections. Warm + non-judgmental — not a compliance scoreboard (the point is noticing).
/** Today's entry if one exists — the form EDITS it rather than starting blank. See the note on the page. */
export type QualityDayToday = { score: number; present: string[]; mostValuable?: string | null; mostMissing?: string | null } | null;

/** The weekday of a YYYY-MM-DD, from the string. Never `new Date(date)` — that is UTC midnight and names the
 *  wrong day west of Greenwich, the same trap the log's date column already fell into once. */
function dayWord(date: string | null): string {
  if (!date) return 'that day';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
}

export default function QualityDayLog({
  memberId,
  elements,
  today = null,
  logDate = null,
  isToday = true,
}: {
  memberId: string;
  elements: string[];
  today?: QualityDayToday;
  /** The day this form writes. Null only if the member's zone could not be read; the server then defaults to today. */
  logDate?: string | null;
  isToday?: boolean;
}) {
  // "today" / "Thursday" — every prompt and the button name the day, so a member back-filling cannot get halfway
  // through and lose track of which day they are rating.
  const when = isToday ? 'today' : dayWord(logDate);
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
      const r = await logQualityDayAction(memberId, score, [...present], valuable.trim() || undefined, missing.trim() || undefined, logDate ?? undefined);
      if (!r.ok) return setError(r.error ?? 'Could not log.');
      setDone(true);
      router.refresh();
    });
  }

  // "See you tomorrow" was true only while a day could be logged once. It is editable now, so the receipt says
  // what happened and leaves the door open.
  if (done) return <p className="momentum-log-done">Saved — that’s today. Come back and change it anytime.</p>;

  // NUMBERED, because this is two distinct acts and the page gave no sign of it (Jay, 2026-08-15). Everything sat
  // at one visual weight, so the score read as a warm-up and the elements read as the substance — which is how a
  // member ends up believing they are scoring each element rather than the day.
  //
  // Only the two REQUIRED acts are numbered. A "3" on the optional notes would make them feel compulsory, and the
  // whole posture here is that a member sets their own depth.
  //
  // Each step names its consequence on the grid. That single line is what ties the two surfaces together: the
  // score is the number the week shows, and an element is a dot. Nobody had to be told this before because
  // nobody could see the score at all.
  return (
    <div className="qd-log">
      <div className="qd-step">
        <span className="qd-step-n" aria-hidden="true">1</span>
        <p className="qd-step-q">How much did {when} feel like a quality day?</p>
      </div>
      <div className="qd-step-body">
        <div className="qd-score">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" className={`qd-score-btn${score === n ? ' on' : ''}`} aria-pressed={score === n} disabled={pending} onClick={() => setScore(n)}>
              {n}
            </button>
          ))}
        </div>
        <p className="qd-hint">This is the number your week grid shows.</p>
      </div>

      {elements.length > 0 && (
        <>
          <div className="qd-step">
            <span className="qd-step-n" aria-hidden="true">2</span>
            <p className="qd-step-q">Which of these showed up {when}?</p>
          </div>
          <div className="qd-step-body">
            <div className="qd-elements-opts">
              {elements.map((el) => (
                <button key={el} type="button" className={`qd-el-btn${present.has(el) ? ' on' : ''}`} aria-pressed={present.has(el)} disabled={pending} onClick={() => toggle(el)}>
                  {el}
                </button>
              ))}
            </div>
            <p className="qd-hint">Tap to add or remove. Each one becomes a dot on your grid.</p>
          </div>
        </>
      )}

      <div className="qd-optional">
        <p className="qd-optional-lab">Anything worth noting? <span>Optional.</span></p>
        <textarea className="momentum-log-note" value={valuable} onChange={(e) => setValuable(e.target.value)} placeholder={`What added the most value ${when}?`} rows={2} />
        <textarea className="momentum-log-note" value={missing} onChange={(e) => setMissing(e.target.value)} placeholder={`What was most missing ${when}?`} rows={2} />
      </div>
      {/* THE SUBMIT USES THE SUBMIT CLASS (Donna, 2026-08-21: "Log today renders in an undocumented dark
          navy/charcoal that matches none of the four button families").
          It was `.momentum-log-btn` — the Momentum OPTION PICKER, a navy-outlined segmented control where navy is
          right because choosing one fills it navy. Borrowed here for a submit, it made the only commit action on
          the surface look like an unchosen option, and made the same "Log today" render navy here and teal on the
          Playbook. `.momentum-log-commit` is the app's existing submit treatment, already used one file over. */}
      <div className="momentum-log-options">
        <button type="button" className="momentum-log-commit" disabled={pending} onClick={submit}>
          {isToday ? 'Log today' : `Log ${when}`}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

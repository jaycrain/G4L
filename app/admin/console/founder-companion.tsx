'use client';

import { useState, useEffect, useRef } from 'react';
import type { CohortView, AttentionRow } from '../../../lib/admin/console.ts';
import { askFounderCompanionAction } from './actions.ts';

type Turn = { role: 'jay' | 'companion'; text: string; looked?: string[] };

// ── THE THREAD SURVIVES A RELOAD ────────────────────────────────────────────────────────────────────────────
// The conversation was pure component state, so leaving the page and coming back — or a hard reload — wiped
// it. (The 30s auto-refresh does NOT: router.refresh() re-pulls server data and preserves client state, which
// is verified in the browser walk. The loss is navigation and reload.) Losing an exchange mid-thought on a
// surface whose whole value is "ask a follow-up" is the wrong kind of forgetting.
//
// SESSION STORAGE, NOT THE DATABASE — a deliberate privacy choice, and worth stating plainly because the
// obvious move was a `founder_message` table mirroring the Member Agent's `agent_message`.
//
// When Jay asks about ONE member, the reply can legitimately contain that member's own words — their gap,
// their Reclaim List. Persisting this thread server-side would therefore create a NEW durable copy of the
// most vulnerable text in the product, in a table nobody asked for, outside the governance that surrounds
// the original. "Minimum necessary data" (CLAUDE.md) says don't.
//
// sessionStorage fixes the actual complaint — reload and navigation — costs nothing, needs no migration, and
// dies with the tab. Durable, cross-device console history is a bigger feature with a real privacy price;
// that is Jay's call to make explicitly, not mine to make by accident.
const THREAD_KEY = 'g4l.founder.thread';

function loadThread(): Turn[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(THREAD_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return [];
    // Validate rather than trust: a stale or hand-edited value must not crash the console on load.
    return parsed.filter(
      (t): t is Turn =>
        !!t && typeof t === 'object' && typeof (t as Turn).text === 'string' &&
        ((t as Turn).role === 'jay' || (t as Turn).role === 'companion'),
    );
  } catch {
    return [];
  }
}

/**
 * What each tool is called, in words. Shown under an answer so Jay can see WHERE it looked — the difference
 * between "it says 2 are stalled" and "it says 2 are stalled and I can see it actually checked". It also
 * makes the privacy line visible in use: if an answer about the cohort ever shows "opened one member's
 * record", that is the thing to catch, and it is now catchable by eye.
 */
const LOOKED: Record<string, string> = {
  cohort_stats: 'the cohort numbers',
  find_members: 'who matches',
  member_detail: "one member's record",
  recent_activity: 'what moved',
  operations_status: 'your queues',
};

/** Saved starting points. These are the questions Jay actually opens with — not a feature tour. */
const PINS = [
  'Run my morning scan',
  "Who hasn't been back in 5 days?",
  'Who is closest to a Checkpoint?',
  'What moved overnight?',
];

export default function FounderCompanion({ cohort, attention }: { cohort: CohortView; attention: AttentionRow[] }) {
  // Starts EMPTY, then restores after mount. Reading sessionStorage during the initial render would make the
  // client markup disagree with the server's and trip a hydration error.
  const [thread, setThread] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const restored = useRef(false);

  useEffect(() => {
    const saved = loadThread();
    if (saved.length) setThread(saved);
    restored.current = true;
  }, []);

  useEffect(() => {
    // Don't write until the restore has run, or the first render's empty array would erase a saved thread.
    if (!restored.current) return;
    try { window.sessionStorage.setItem(THREAD_KEY, JSON.stringify(thread)); } catch { /* private mode / full */ }
  }, [thread]);

  function clearThread() {
    setThread([]);
    try { window.sessionStorage.removeItem(THREAD_KEY); } catch { /* nothing to do */ }
  }

  async function ask(qRaw: string) {
    const q = qRaw.trim();
    if (!q || pending) return;
    setInput('');
    // Snapshot the thread BEFORE appending this question — it's the history the model needs, and the new
    // question is passed separately. Reading `thread` after setThread would race React's batching.
    const history = thread.map((t) => ({ role: t.role, text: t.text }));
    setThread((t) => [...t, { role: 'jay', text: q }]);
    setPending(true);
    const r = await askFounderCompanionAction(q, cohort, attention, history).catch(() => null);
    setThread((t) => [
      ...t,
      {
        role: 'companion',
        text: r?.reply ?? 'I couldn’t reach that just now — try again in a moment.',
        looked: r?.looked ?? [],
      },
    ]);
    setPending(false);
  }

  // The opening line is COMPUTED, not asked for — the morning read is already done when he arrives.
  const needs = attention.filter((a) => a.count > 0);
  const opener =
    needs.length === 0
      ? `${cohort.members} member${cohort.members === 1 ? '' : 's'}, nothing needs you this morning. Ask me anything.`
      : `${cohort.members} member${cohort.members === 1 ? '' : 's'}. ${needs.length === 1 ? 'One thing needs' : `${needs.length} things need`} a look: ${needs.map((n) => n.label).join('; ')}.`;

  return (
    <div className="fc-hero">
      <div className="fc-hero-h">
        <div className="fc-hero-eye">The Founder Companion · read-only</div>
        <div className="fc-hero-title">Your morning read</div>
        <div className="fc-hero-sub">
          Ask anything about your members.
          {/* Clearing is a PRIVACY control as much as a tidiness one: a thread where Jay asked about one
              person holds that person's own words, and he should be able to put them down. It also closes
              the loop honestly — the thread is kept in this tab only, and this empties it for good. */}
          {thread.length > 0 && (
            <>
              {' · '}
              <button type="button" className="fc-clear" onClick={clearThread}>Clear this conversation</button>
            </>
          )}
        </div>
      </div>

      <div className="fc-thread">
        <div className="fc-b co">{opener}</div>
        {thread.map((t, i) => {
          const where = [...new Set(t.looked ?? [])].map((n) => LOOKED[n] ?? n);
          return (
            <div key={i}>
              <div className={`fc-b ${t.role === 'jay' ? 'me' : 'co'}`}>{t.text}</div>
              {where.length > 0 && <div className="fc-looked">Checked {where.join(', ')}</div>}
            </div>
          );
        })}
        {pending && <div className="fc-b co fc-thinking">Looking…</div>}
      </div>

      <div className="fc-pins">
        {PINS.map((p) => (
          <button key={p} type="button" className="fc-pin" onClick={() => ask(p)} disabled={pending}>{p}</button>
        ))}
      </div>

      <form
        className="fc-composer"
        onSubmit={(e) => { e.preventDefault(); void ask(input); }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your members…"
          aria-label="Ask the Founder Companion"
        />
        <button type="submit" className="fc-send" disabled={pending}>Send</button>
      </form>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import type { CohortView, AttentionRow } from '../../../lib/admin/console.ts';
import { askFounderCompanionAction, loadFounderThreadAction, clearFounderThreadAction } from './actions.ts';

type Turn = { role: 'jay' | 'companion'; text: string; looked?: string[] };

// ── THE THREAD SURVIVES A RELOAD ────────────────────────────────────────────────────────────────────────────
// The conversation was pure component state, so leaving the page and coming back — or a hard reload — wiped
// it. (The 30s auto-refresh does NOT: router.refresh() re-pulls server data and preserves client state, which
// is verified in the browser walk. The loss is navigation and reload.) Losing an exchange mid-thought on a
// surface whose whole value is "ask a follow-up" is the wrong kind of forgetting.
//
// DURABLE SINCE 0066, WITH TWO CONTROLS. This shipped as sessionStorage-only, deliberately: when Jay asks
// about ONE member the reply can contain that member's own words, so persisting the thread creates a SECOND
// copy of the most sensitive text in the product. I flagged it rather than deciding it, and Jay decided —
// he works from a bike ride and then a desk, and a thread that dies with the tab is no use to him.
//
// The two controls are part of the feature, not polish on it (lib/founder/thread.ts):
//   RETENTION — 30 days, pruned on write. Continuity is a days-to-weeks need; a permanent archive of
//   conversations about members is a different thing, and nobody asked for that one.
//   PURGE — "Clear this conversation" deletes the ROWS, not just the screen.
//
// sessionStorage stays as the instant paint and as the pre-migration fallback; the server is the source of
// truth once it has one.
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
    // DURABLE FIRST, tab-local as the fallback (Jay, 2026-08-01: he checks the console from a bike ride and
    // then a desk, and the thread used to die with the tab). sessionStorage stays as the instant paint and as
    // the degradation path before migration 0066 is applied — the server is the source of truth once it has one.
    let cancelled = false;
    const local = loadThread();
    if (local.length) setThread(local);
    void loadFounderThreadAction()
      .then((stored) => {
        if (cancelled || !stored.length) return;
        setThread((cur) => (stored.length >= cur.length ? stored : cur));
      })
      .catch(() => { /* stay on the local copy */ })
      .finally(() => { restored.current = true; });
    // Don't block the first paint on the round trip: if the server is slow or empty, the local copy stands.
    restored.current = true;
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // Don't write until the restore has run, or the first render's empty array would erase a saved thread.
    if (!restored.current) return;
    try { window.sessionStorage.setItem(THREAD_KEY, JSON.stringify(thread)); } catch { /* private mode / full */ }
  }, [thread]);

  function clearThread() {
    setThread([]);
    try { window.sessionStorage.removeItem(THREAD_KEY); } catch { /* nothing to do */ }
    // AND the server rows. Now that the thread is durable, "clear" has to mean deleted — not hidden. This is
    // the purge control the durable version was agreed WITH, since a thread about one member holds her words.
    void clearFounderThreadAction().catch(() => {});
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
              person holds that person's own words, and he should be able to put them down. Now that the
              thread is durable this deletes the stored rows too — "clear" has to mean gone, not hidden. */}
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

'use client';

import { useState, useEffect, useRef } from 'react';
import type { CohortView, AttentionRow } from '../../../lib/admin/console.ts';
import { askFounderCompanionAction, loadFounderThreadAction, clearFounderThreadAction } from './actions.ts';

import DataCard from './data-card.tsx';
import type { Card } from '../../../lib/founder/cards.ts';

type Turn = { role: 'jay' | 'companion'; text: string; looked?: string[]; cards?: Card[] };

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

/**
 * The Companion writes **bold**; the thread was printing the asterisks.
 *
 * A deliberately tiny renderer rather than a markdown library: the only thing the model actually emits here is
 * emphasis on a name or a value, and everything else it might emit — links, images, raw HTML — is something we
 * do NOT want executing on a surface that renders members' own words. Splitting on `**` and building real
 * React elements means there is no HTML-injection path at all.
 */
function withEmphasis(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  // split() with one capture group alternates plain, captured, plain, captured…
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p));
}

export default function FounderCompanion({
  cohort, attention, unseen = 0,
}: { cohort: CohortView; attention: AttentionRow[]; unseen?: number }) {
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
        cards: r?.cards ?? [],
      },
    ]);
    setPending(false);
  }

  // The opening line is COMPUTED, not asked for — the read is already done when he arrives.
  //
  // IT LEADS WITH THE DELTA, because the panel is now titled "Since you last checked in" and a title that
  // promises a change while the text underneath reports a snapshot is a small lie told on every load. It uses
  // the SAME unseen count as the Activity panel (one marker, one definition of "last looked"), so the two can
  // never disagree about what's new.
  const needs = attention.filter((a) => a.count > 0);
  const moved = unseen > 0
    ? `${unseen} thing${unseen === 1 ? '' : 's'} moved since you last looked.`
    : 'Nothing new since you last looked.';
  const opener = needs.length === 0
    ? `${moved} Nothing needs you.`
    : `${moved} ${needs.length === 1 ? 'One thing needs' : `${needs.length} things need`} a look: ${needs.map((n) => n.label).join('; ')}.`;

  return (
    <div className="fc-hero">
      <div className="fc-hero-h">
        <div className="fc-hero-heading">
          {/* "read-only" WAS TRUE AND ISN'T ANY MORE. The Companion has one write tool (draft_message), which
              puts a row in the review queue. A governance badge is the thing you'd point at to prove the
              guarantee, so it has to describe the guarantee that actually holds: it can draft, it cannot send.
              See lib/founder/companion-tools.ts — WRITE_TOOLS is enumerated there and asserted in tests. */}
          <div className="fc-hero-eye">The Founder Companion · nothing sends without you</div>
          <div className="fc-hero-title">Since you last checked in</div>
        </div>
        {/* Clearing is a PRIVACY control as much as a tidiness one: a thread where Jay asked about one
            person holds that person's own words, and he should be able to put them down. Now that the
            thread is durable this deletes the stored rows too — "clear" has to mean gone, not hidden. */}
        {/* On a phone the full label ate half the header row, squeezing the AI-disclosure badge beside it into
            three wrapped lines — so the visible text shortens to "Clear" below 700px. aria-label pins the
            ACCESSIBLE name either way: a control whose name changes with the viewport is one a screen reader
            (and the walk that clicks it by name) can find at one width and lose at another. */}
        {thread.length > 0 && (
          <button
            type="button"
            className="fc-clear fc-own"
            aria-label="Clear this conversation"
            onClick={clearThread}
          >
            Clear<span className="fc-clear-long"> this conversation</span>
          </button>
        )}
      </div>

      <div className="fc-thread">
        <div className="fc-b co">{opener}</div>
        {thread.map((t, i) => {
          const where = [...new Set(t.looked ?? [])].map((n) => LOOKED[n] ?? n);
          return (
            <div key={i}>
              <div className={`fc-b ${t.role === 'jay' ? 'me' : 'co'}`}>{withEmphasis(t.text)}</div>
              {/* The data UNDER the answer, built from the query rather than the retelling. */}
              {(t.cards ?? []).map((c, ci) => <DataCard key={ci} card={c} />)}
              {where.length > 0 && <div className="fc-looked">Checked {where.join(', ')}</div>}
            </div>
          );
        })}
        {pending && <div className="fc-b co fc-thinking">Looking…</div>}
      </div>

      {/* THE SUGGESTED-PROMPT ROW IS GONE (Jay, 2026-08-02: "don't need the suggested prompt system at all").
          It was four guesses at his morning routine plus a starring mechanism to correct the guesses — two
          rows of chrome, a persistence table and a second way to do the one thing the composer already does.
          The `founder_prompt` table is left in place rather than dropped in the same breath; it's dormant and
          costs nothing, and dropping a live table deserves its own migration. */}

      <form
        className="fc-composer"
        onSubmit={(e) => { e.preventDefault(); void ask(input); }}
      >
        {/* `fc-own` on both: this component sets its own colours, and the dark theme's blanket element rules
            must not repaint them. Without it the composer lost its teal border and Send lost its teal fill. */}
        <input
          className="fc-own"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your members…"
          aria-label="Ask the Founder Companion"
        />
        <button type="submit" className="fc-send fc-own" disabled={pending}>Send</button>
      </form>
    </div>
  );
}

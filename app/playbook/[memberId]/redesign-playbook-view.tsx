'use client';

import { useState } from 'react';
import type { PlaybookEntry } from '../../../lib/playbook/store.ts';
import type { Outcome } from '../../../lib/dashboard/outcomes.ts';
import OutcomeCards from './outcome-cards.tsx';
import { runnablePlay, playSituation } from '../../../lib/playbook/runnable.ts';
import {
  loadPlaybookAction,
  addOwnEntryAction,
  keepEntryAction,
  dismissEntryAction,
  pinEntryAction,
  editEntryAction,
  removeEntryAction,
  gatherFromHistoryAction,
} from './actions.ts';

// Redesign Playbook (Decision ZZ) — the same data + CRUD as the live PlaybookView, reorganized by what each line is FOR:
// five keeper-type chapters, a pinned "short version" front matter, one intake tray for the Companion's flags, and the
// journal as free-write intake. Flag-gated at the page → prod keeps the section-based view. Every action is reused
// unchanged; this is a presentation refactor over the same stateful data.

// THE TABS (2026-08-08, docs/playbook-shell-spec.md). Nine stacked sections became FIVE tabs, and the collapse
// came from one question: which Session is this built from? Three of the old chapters had no Session of their own —
// "Why it works" is the science that landed, so it belongs inside a Read next to the thing it explains; "Your
// tells" IS a read (a tell is literally what tells you which play to call); and "What lights you up" is part of
// who you are. No content was dropped; it stopped being nine top-level choices.
//
// "This week" (the live practice week) is the FIFTH tab and is deliberately absent until the practice weeks move
// off Momentum in one step — showing the same week in two places is worse than either arrangement.
type TabKey = 'plays' | 'reads' | 'who' | 'journal';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'plays', label: 'Plays' },
  { key: 'reads', label: 'Reads' },
  { key: 'who', label: 'Who you are' },
  { key: 'journal', label: 'Journal' },
];
/** Which tab a kept line belongs under. Chapters survive INSIDE tabs — this is the grouping above them. */
const TAB_FOR_CHAPTER: Record<ChapterKey, TabKey> = {
  plays: 'plays',
  tells: 'reads', // a tell tells you which play to call — that is a read, not a keepsake
  why: 'reads', // the science sits beside the thing it explains
  who: 'who',
  lights: 'who', // what still moves you is part of who you are
};

type ChapterKey = 'who' | 'lights' | 'tells' | 'plays' | 'why';
// Plays lead — they're the heart of an operating manual (Jay: the Playbook's real value is "how did I handle this
// before?"). The rest follow: who you are, what lights you up, your tells, why it works.
const CHAPTERS: { key: ChapterKey; title: string; sub: string; empty: string }[] = [
  { key: 'plays', title: 'Your plays', sub: 'A reference of what is truly working for you.', empty: 'Your reframes and comeback moves get kept here — your go-to plays.' },
  { key: 'who', title: 'Who you are', sub: 'A reminder of who you were, and who you hope to be again.', empty: 'The identities you reclaim land here as you name them.' },
  { key: 'lights', title: 'What lights you up', sub: 'Where you found excitement and motivation. What moves you gets kept here.', empty: 'What still moves you gets kept here — your spark, in your words.' },
  { key: 'tells', title: 'Your tells', sub: 'The patterns worth catching early.', empty: 'The signs you’re drifting land here, so you can catch them sooner.' },
  { key: 'why', title: 'Why it works', sub: 'The science that convinced you, in plain language.', empty: 'Facts that resonated with you get kept here.' },
];
const CHAPTER_LABEL: Record<ChapterKey, string> = { who: 'Who you are', lights: 'Lights you up', tells: 'Your tells', plays: 'Your plays', why: 'Why it works' };

// What a kept line IS → its chapter. Keeper-type is authoritative; section is the fallback for older entries with none.
function chapterKey(e: PlaybookEntry): ChapterKey | null {
  if (e.section === 'journal') return null; // journal is intake, not a chapter
  switch (e.keeperType) {
    case 'definition':
      return 'who';
    case 'lights_you_up':
      return 'lights';
    case 'tell':
      return 'tells';
    case 'principle':
    case 'recovery_move':
    case 'plan':
      return 'plays';
  }
  if (e.section === 'why_works') return 'why';
  if (e.section === 'what_works') return 'plays';
  return 'who';
}

export default function RedesignPlaybookView({
  memberId,
  initial,
  hasHistory,
  synthesis,
  rerunStats,
  outcomes = [],
}: {
  memberId: string;
  initial: PlaybookEntry[];
  hasHistory: boolean;
  synthesis?: string | null;
  rerunStats?: Record<string, { n: number; last: string }>;
  outcomes?: Outcome[];
}) {
  const [entries, setEntries] = useState<PlaybookEntry[]>(initial);
  // Tab state lives in the URL so the back button works and a member can be sent straight to a tab. Read once on
  // mount rather than via useSearchParams, which would force a Suspense boundary for no gain here.
  const [tab, setTab] = useState<TabKey>(() => {
    if (typeof window === 'undefined') return 'plays';
    const t = new URLSearchParams(window.location.search).get('tab');
    return TABS.some((x) => x.key === t) ? (t as TabKey) : 'plays';
  });
  const goTab = (k: TabKey) => {
    setTab(k);
    if (typeof window !== 'undefined') {
      const u = new URL(window.location.href);
      u.searchParams.set('tab', k);
      window.history.replaceState(null, '', u);
    }
  };
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');
  const [gathering, setGathering] = useState(false);
  const [gatherMsg, setGatherMsg] = useState<string | null>(null);

  async function refresh() {
    setEntries(await loadPlaybookAction(memberId));
  }
  async function run(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  async function gather() {
    if (gathering || busy) return;
    setGathering(true);
    setGatherMsg(null);
    try {
      const r = await gatherFromHistoryAction(memberId);
      await refresh();
      setGatherMsg(r.proposed > 0 ? `Gathered ${r.proposed} from your work — keep what rings true below.` : 'Nothing new to gather yet — keep working, and there’ll be more to pull from.');
    } finally {
      setGathering(false);
    }
  }
  async function saveEdit(id: string) {
    const body = draft.trim();
    if (!body) return;
    await run(() => editEntryAction(memberId, id, body));
    setEditingId(null);
    setDraft('');
  }
  async function addNote() {
    const body = note.trim();
    if (!body) return;
    await run(() => addOwnEntryAction(memberId, body));
    setNote('');
  }

  function entryCard(e: PlaybookEntry) {
    const editing = editingId === e.id;
    const tag = e.section === 'journal' ? null : e.source.kind === 'science' ? 'Science' : e.source.label ?? null;
    // A play we can re-run → hand it to the Companion (never resets gates; it walks the member back through it).
    const rerunnable = runnablePlay(e);
    const situation = playSituation(e); // the "when" this play is for (situation → move) — only set for plays
    const stats = rerunnable ? rerunStats?.[rerunnable.sessionId] : undefined; // how often they've come back to it
    return (
      <div key={e.id} className="pb-entry">
        {editing ? (
          <div className="pb-edit">
            <textarea value={draft} onChange={(ev) => setDraft(ev.target.value)} rows={3} autoFocus />
            <div className="pb-actions">
              <button type="button" className="pb-btn keep" disabled={busy || !draft.trim()} onClick={() => saveEdit(e.id)}>Save</button>
              <button type="button" className="pb-btn ghost" onClick={() => { setEditingId(null); setDraft(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {situation && <div className="pb-situation">{situation}</div>}
            <p className="pb-line">{e.pinned && <span className="pb-pin-dot" aria-label="pinned" title="Pinned">📌</span>}{e.body}</p>
            <div className="pb-meta">
              {e.section === 'journal' ? (
                <span className="pb-date">{new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              ) : (
                tag && <span className={`pb-chip${e.source.kind === 'science' ? ' sci' : ''}`}>{tag}</span>
              )}
              <span className="pb-tools">
                <button type="button" onClick={() => run(() => pinEntryAction(memberId, e.id, !e.pinned))} disabled={busy}>{e.pinned ? 'Unpin' : 'Pin'}</button>
                <button type="button" onClick={() => { setEditingId(e.id); setDraft(e.body); }} disabled={busy}>Edit</button>
                <button type="button" onClick={() => run(() => removeEntryAction(memberId, e.id))} disabled={busy}>Remove</button>
              </span>
            </div>
            {rerunnable && (
              <div className="pb-runrow">
                <a className="pb-run" href={`/dashboard/${memberId}?rerun=${rerunnable.sessionId}`}>Run it again with your Companion →</a>
                {stats && stats.n > 0 && (
                  <span className="pb-runstat">
                    You’ve come back to this {stats.n} time{stats.n === 1 ? '' : 's'}
                    {stats.last ? ` · last ${new Date(stats.last).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  function proposedCard(e: PlaybookEntry) {
    const ck = chapterKey(e);
    return (
      <div key={e.id} className="pb-proposed">
        <div className="pb-prop-head">Your companion flagged this{ck ? ` · files under ${CHAPTER_LABEL[ck]}` : ''} — keep it?</div>
        <p className="pb-line">{e.body}</p>
        <div className="pb-actions">
          <button type="button" className="pb-btn keep" disabled={busy} onClick={() => run(() => keepEntryAction(memberId, e.id))}>Keep it</button>
          <button type="button" className="pb-btn ghost" disabled={busy} onClick={() => run(() => dismissEntryAction(memberId, e.id))}>Not now</button>
        </div>
      </div>
    );
  }

  const kept = entries.filter((e) => e.state === 'kept');
  const proposed = entries.filter((e) => e.state === 'proposed');
  const pinned = kept.filter((e) => e.pinned).slice(0, 3);
  const journal = kept.filter((e) => e.section === 'journal');
  const chapters = CHAPTERS.map((c) => ({ ...c, items: kept.filter((e) => e.section !== 'journal' && chapterKey(e) === c.key) }));

  return (
    <>
      {/* Navy hero banner — same treatment every other subpage carries (Jay's walk: Playbook was missing it). */}
      <div className="hero"><h1>G4L Playbook</h1></div>
      <p className="pb-sub">Find inspiration, confidence, and strength based on the real work you’re doing — most of it in your own words. Your Companion keeps these here for you as you go through.</p>

      {gathering ? (
        <div className="pb-gather"><span className="typing">Gathering from your work…</span></div>
      ) : entries.length === 0 && hasHistory ? (
        <div className="pb-gather-cta">
          <p>You’ve already built real material. Let’s gather it into your Playbook.</p>
          <button type="button" className="pb-btn keep" onClick={gather}>Gather from your work →</button>
        </div>
      ) : null}
      {gatherMsg && <p className="pb-gather-msg">{gatherMsg}</p>}

      {/* THE THREE OUTCOMES — what the cycle is actually building, and what "built" means. Heads the page above
          everything else because it is the ORIENTATION: a member landing here should see the shape of the whole
          thing before the detail of what they've kept so far. */}
      <OutcomeCards outcomes={outcomes} />

      {/* FRONT MATTER — the short version: the pinned lines you reach for most. ABOVE the tabs on purpose; it is
          the one thing worth seeing whichever tab you land on. */}
      {pinned.length > 0 && (
        <section className="pb-frontmatter">
          <div className="pb-fm-title">The short version</div>
          <div className="pb-fm-items">
            {pinned.map((e) => {
              const ck = chapterKey(e);
              return (
                <div key={e.id} className="pb-fm-item">
                  {ck && <span className="pb-fm-tag">{CHAPTER_LABEL[ck]}</span>}
                  <span className="pb-fm-line">{e.body}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* INTAKE TRAY — also above the tabs, because it is an ACTION with a decision pending. Filed under a tab it
          would be missed by a member who never opens that tab, and the Companion's flags would rot unreviewed. */}
      {proposed.length > 0 && (
        <section className="pb-tray">
          <div className="pb-sec">To review</div>
          <div className="pb-sec-d">Your companion noticed these. Keep what rings true — it files itself under the right chapter.</div>
          {proposed.map(proposedCard)}
        </section>
      )}

      {/* THE TAB ROW — the Founder Console's one-row pattern (Jay: "a great way to fly through a variety of
          different content"). Scrolls horizontally on a phone, one tab at a time, which is how the FC row and the
          triptych fold already behave — so this needs no separate mobile design. */}
      <nav className="pb-tabs" aria-label="Playbook">
        {TABS.map((t) => {
          const n = t.key === 'journal' ? journal.length : chapters.filter((c) => TAB_FOR_CHAPTER[c.key] === t.key).reduce((a, c) => a + c.items.length, 0);
          return (
            <button
              key={t.key}
              type="button"
              className={`pb-tab${tab === t.key ? ' on' : ''}`}
              aria-pressed={tab === t.key}
              onClick={() => goTab(t.key)}
            >
              {t.label}
              {n > 0 && <span className="pb-tab-n">{n}</span>}
            </button>
          );
        })}
      </nav>

      {/* WHO YOU ARE opens with the synthesis — the arc the Companion re-weaves at every Session close. It used to
          sit above everything as "Your story so far", and "My Story" (the identity read) was a separate DASHBOARD
          page. Jay moved that here 2026-08-08. They are two stored narratives but one thing to a member: this is
          me, and this is where I have got to. Two tabs would have made them look like two stories. */}
      {tab === 'who' && synthesis && (
        <section className="pb-card pb-hero">
          <div className="pb-sec">Your story so far</div>
          <div className="pb-sec-d">A living read your companion re-weaves each time you close a Session.</div>
          <div className="pb-narr">
            {synthesis.split(/\n\n+/).map((p) => p.trim()).filter(Boolean).map((para, k) => (<p key={k}>{para}</p>))}
          </div>
        </section>
      )}

      {/* The chapters survive as SECTIONS inside their tab — the grouping changed, the content did not. */}
      {tab !== 'journal' &&
        chapters
          .filter((c) => TAB_FOR_CHAPTER[c.key] === tab)
          .map((c) => (
            <section key={c.key} className="pb-card pb-chapter">
              <div className="pb-sec">{c.title}</div>
              <div className="pb-sec-d">{c.sub}</div>
              {c.items.length > 0 ? c.items.map(entryCard) : <p className="pb-empty">{c.empty}</p>}
            </section>
          ))}

      {/* JOURNAL — a first-class reflective tool, not a footnote (Jay, twice). Thoughts + feelings in the member's
          own words, timestamped. Two respected jobs: feedstock (the Companion pulls keepers up into the plays) AND
          its own reward — the writing is the point whether or not anything gets promoted. */}
      {tab === 'journal' && (
        <section className="pb-card pb-journal">
          <div className="pb-sec">Your journal</div>
          <div className="pb-sec-d">Thoughts and feelings in your own words, timestamped to where you are. For a lot of people this is the most freeing thing here — a place to think on the page and understand yourself. Your companion reads it and pulls keepers up into your plays, but the writing itself is the point — it only replies if you ask.</div>
          {journal.map(entryCard)}
          <div className="pb-add">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Write your own entry…" disabled={busy} />
            <button type="button" className="pb-btn keep" disabled={busy || !note.trim()} onClick={addNote}>Add note</button>
          </div>
        </section>
      )}

      {entries.length > 0 && hasHistory && !gathering && (
        <p className="pb-gather-link"><button type="button" className="pb-linkbtn" onClick={gather}>Gather from recent work →</button></p>
      )}
      <p className="pb-foot">Your companion gathers these as you go and flags keepers — you decide what stays. Edit, pin, or remove anything. Over time this becomes the raw material for your Legacy Letter and Success Story.</p>
    </>
  );
}

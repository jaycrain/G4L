'use client';

import { useState } from 'react';
import type { PlaybookEntry } from '../../../lib/playbook/store.ts';
import type { Outcome } from '../../../lib/dashboard/outcomes.ts';
import type { Read } from '../../../lib/playbook/reads.ts';
import type { WeekGrid } from '../../../lib/practice/grid.ts';
import WeekGridPanel from '../../momentum/week-grid.tsx';
import OutcomeCards from './outcome-cards.tsx';
import { runnablePlay, playSituation } from '../../../lib/playbook/runnable.ts';
import {
  loadPlaybookAction,
  addOwnEntryAction,
  keepEntryAction,
  dismissEntryAction,
  pinEntryAction,
  editEntryAction,
  expandEntryAction,
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
type TabKey = 'thisweek' | 'plays' | 'reads' | 'who' | 'journal';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'thisweek', label: 'This week' },
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
  reads = [],
  grid = null,
}: {
  memberId: string;
  initial: PlaybookEntry[];
  hasHistory: boolean;
  synthesis?: string | null;
  rerunStats?: Record<string, { n: number; last: string }>;
  outcomes?: Outcome[];
  /** The member's assessment reads — what their own Sessions said, in plain language. */
  reads?: Read[];
  /** The LIVE practice week, if one is running. It moved here from Momentum in the same step that added this tab —
   *  the same week in two places is worse than either arrangement. */
  grid?: WeekGrid | null;
}) {
  const [entries, setEntries] = useState<PlaybookEntry[]>(initial);
  // Tab state lives in the URL so the back button works and a member can be sent straight to a tab. Read once on
  // mount rather than via useSearchParams, which would force a Suspense boundary for no gain here.
  // A running week LEADS. If they're mid-practice, that is what they came for; otherwise Plays, which is the
  // Playbook's heart. An explicit ?tab= always wins so a link can point anywhere.
  const [tab, setTab] = useState<TabKey>(() => {
    const fallback: TabKey = grid ? 'thisweek' : 'plays';
    if (typeof window === 'undefined') return fallback;
    const t = new URLSearchParams(window.location.search).get('tab');
    return TABS.some((x) => x.key === t) ? (t as TabKey) : fallback;
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
  const [expandingId, setExpandingId] = useState<string | null>(null);
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
  async function saveExpand(id: string) {
    const body = draft.trim();
    if (!body) return;
    await run(() => expandEntryAction(memberId, id, body));
    setExpandingId(null);
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

  // A LINE THEY SAID, waiting in the Journal. The header is the whole design: "You said this" — not "your
  // companion flagged this", which made the Companion the sender and turned the Journal into an inbox. Jay:
  // "all the mail is from YOU." Provenance (which Session, what day) is what makes it their record rather than
  // a notification. Three ways out, and every one of them empties the slot.
  function proposedCard(e: PlaybookEntry) {
    const ck = chapterKey(e);
    const from = e.source.label && e.source.kind !== 'own' ? e.source.label : null;
    const when = new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const writing = expandingId === e.id;
    return (
      <div key={e.id} className="pb-proposed">
        <div className="pb-prop-head">You said this{from ? ` — ${from}` : ''} · {when}</div>
        <p className="pb-line">{e.body}</p>
        {writing ? (
          <div className="pb-edit pb-expand">
            <textarea
              value={draft}
              onChange={(ev) => setDraft(ev.target.value)}
              rows={4}
              autoFocus
              placeholder="What does this bring up? Write as much or as little as you want…"
            />
            <div className="pb-actions">
              <button type="button" className="pb-btn keep" disabled={busy || !draft.trim()} onClick={() => saveExpand(e.id)}>Save to your Journal</button>
              <button type="button" className="pb-btn ghost" onClick={() => { setExpandingId(null); setDraft(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="pb-actions">
            {/* Keep still files it to its tab — the Journal is where you review, not where a keeper ends up. */}
            <button type="button" className="pb-btn keep" disabled={busy} onClick={() => run(() => keepEntryAction(memberId, e.id))}>
              Keep{ck ? ` in ${CHAPTER_LABEL[ck]}` : ''}
            </button>
            <button type="button" className="pb-btn" disabled={busy} onClick={() => { setExpandingId(e.id); setDraft(''); }}>Write about this →</button>
            <button type="button" className="pb-btn ghost" disabled={busy} onClick={() => run(() => dismissEntryAction(memberId, e.id))}>Delete</button>
          </div>
        )}
      </div>
    );
  }

  const kept = entries.filter((e) => e.state === 'kept');
  const proposed = entries.filter((e) => e.state === 'proposed');
  // Where the queue mostly wants to go, so the collapsed bar says something rather than just counting. Only named
  // when one chapter actually dominates — "mostly who you are" is useful; "mostly" across an even spread is noise.
  const proposedWhere = (() => {
    const tally = new Map<ChapterKey, number>();
    for (const e of proposed) {
      const ck = chapterKey(e);
      if (ck) tally.set(ck, (tally.get(ck) ?? 0) + 1);
    }
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    return top && top[1] > proposed.length / 2 ? CHAPTER_LABEL[top[0]] : null;
  })();
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

      {/* THE POINTER — what used to be the intake tray. The queue itself moved INTO the Journal (Jay,
          2026-08-08), because a flagged keeper is a thing the member SAID and the Journal is the timestamped
          record of things they said; we had one substance in two places. What stays here is a pointer, because
          a queue filed inside a tab goes unseen for weeks — that risk is exactly why the tray sat on top, and it
          did not go away, it just stopped being worth two screens of page. */}
      {proposed.length > 0 && tab !== 'journal' && (
        <button type="button" className="pb-waiting" onClick={() => goTab('journal')}>
          <span className="pb-waiting-n">{proposed.length}</span>
          {proposed.length === 1 ? 'thing you said is waiting in your Journal' : 'things you said are waiting in your Journal'}
          <span aria-hidden="true"> →</span>
        </button>
      )}

      {/* THE TAB ROW — the Founder Console's one-row pattern (Jay: "a great way to fly through a variety of
          different content"). Scrolls horizontally on a phone, one tab at a time, which is how the FC row and the
          triptych fold already behave — so this needs no separate mobile design. */}
      <nav className="pb-tabs" aria-label="Playbook">
        {TABS.map((t) => {
          const n = t.key === 'journal' ? journal.length + proposed.length : chapters.filter((c) => TAB_FOR_CHAPTER[c.key] === t.key).reduce((a, c) => a + c.items.length, 0);
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

      {/* THIS WEEK — the play on the field. Greg's tracker, moved off Momentum so the live week lives in the
          instrument you plan from rather than in a separate tool. Momentum keeps its cross-cycle job (Jay + Greg
          both landed there independently: it is the LONG view, the tracker you RE-TURN to after Cycle 1).
          The grid component is reused unchanged — this is a relocation, not a rewrite. */}
      {tab === 'thisweek' && (
        <section className="pb-card pb-thisweek">
          {grid ? (
            <>
              <div className="pb-sec">This week</div>
              <div className="pb-sec-d">
                Day {grid.day} of 7. A blank day is a day — this is for noticing what helps, never a score.
              </div>
              <WeekGridPanel memberId={memberId} grid={grid} />
            </>
          ) : (
            <>
              <div className="pb-sec">This week</div>
              <p className="pb-empty">
                No week running right now. A Session starts one when you’re ready to practise something for
                real — that’s when this fills in.
              </p>
            </>
          )}
        </section>
      )}

      {/* YOUR READS — the assessment outputs, which until now only the Companion could see. This is what makes
          Reads a tab rather than a leftover: it holds what the member's own Sessions said about them, in the same
          plain language the Companion uses, with no number anywhere. Renders ABOVE the kept tells because a tell
          is something they noticed; a read is something they answered. */}
      {tab === 'reads' && reads.length > 0 && (
        <section className="pb-card pb-reads">
          <div className="pb-sec">Your reads</div>
          <div className="pb-sec-d">What your own answers said, laid out. Never a score — you told us this.</div>
          {reads.map((r) => (
            <div key={r.label} className="pb-read">
              <div className="pb-read-h">
                A read — {r.label} <span className="pb-read-from">· {r.from}</span>
              </div>
              {r.lines.map((l, i) => (
                <p key={i} className="pb-read-line">{l}</p>
              ))}
            </div>
          ))}
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
          {/* THE QUEUE, in the room it belongs to. Above the member's own entries because it is the only part
              of this page with a decision attached; everything below is already settled. */}
          {proposed.length > 0 && (
            <div className="pb-jq">
              <div className="pb-jq-h">Waiting on you</div>
              <div className="pb-jq-d">Things you said in a Session, kept exactly as you said them. Keep one, write into it, or let it go.</div>
              {proposed.map(proposedCard)}
            </div>
          )}
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

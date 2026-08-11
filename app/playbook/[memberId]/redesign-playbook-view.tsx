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

// THE TABS. Nine stacked sections became five (2026-08-08, docs/playbook-shell-spec.md) by asking of each one:
// which Session is this built from? Three old chapters had no Session of their own, so they moved inside others.
// No content was dropped; it stopped being nine top-level choices.
//
// FIVE THEN BECAME FOUR (2026-08-10, the Playbook-as-endpoint reframe).
//
// "Plays" → "WHAT WORKED", past tense on purpose: the member's own verdict, already earned, not a menu we handed
// them.
//
// "Who you are" → "WHAT YOU'VE LEARNED", and this rename is load-bearing rather than cosmetic. The tab now holds
// the instrument READS (B1's motivation, B2's skills, C2's world) beside the identity keepers. A read is
// probabilistic by rule — Greg's science-check language — and an identity is never named without the member's
// confirmation. A tab called "Who you are" turns a reading into a verdict about the self, which is the thing
// governance forbids. "What you've learned" holds both honestly: what an instrument suggested, and what they
// decided about themselves, without either claiming to BE them.
//
// Momentum deliberately did NOT become a tab. It is a record of what happened; the Playbook is what you run.
// It stays on the dashboard — a daily act belongs zero-click from home — with its subpage for the long view.
type TabKey = 'thisweek' | 'worked' | 'learned' | 'journal';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'thisweek', label: 'This week' },
  { key: 'worked', label: 'What worked' },
  { key: 'learned', label: "What you've learned" },
  { key: 'journal', label: 'Journal' },
];
/** Which tab a kept line belongs under. Chapters survive INSIDE tabs — this is the grouping above them. */
const TAB_FOR_CHAPTER: Record<ChapterKey, TabKey> = {
  plays: 'worked',
  tells: 'learned', // a tell is something you noticed about yourself — that is a learning
  why: 'learned', // the science sits beside what it explains
  who: 'learned',
  lights: 'learned', // what still moves you is something you learned about yourself
};

const REVIEW_PHASE_LABEL: Record<string, string> = { reconnect: 'Reconnect', rewire: 'Rewire', rebuild: 'Rebuild', reclaim: 'Reclaim' };

type ChapterKey = 'who' | 'lights' | 'tells' | 'plays' | 'why';
// Plays lead — they're the heart of an operating manual (Jay: the Playbook's real value is "how did I handle this
// before?"). The rest follow: who you are, what lights you up, your tells, why it works.
const CHAPTERS: { key: ChapterKey; title: string; sub: string; empty: string }[] = [
  // The "tell your Companion" line is a PROMISE, and it only went in once retire_play existed — a page that
  // offers a capability the Companion does not have is worse than a page that offers nothing.
  { key: 'plays', title: 'Your plays', sub: 'The moves you tried and kept because they worked — run them again. When one stops working, tell your Companion and it comes off the list.', empty: 'Finish a practice week and what worked lands here — your go-to plays, in your words.' },
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
  identityParagraph,
  rerunStats,
  outcomes = [],
  reads = [],
  grid = null,
  reviewable = [],
}: {
  memberId: string;
  initial: PlaybookEntry[];
  hasHistory: boolean;
  synthesis?: string | null;
  /** MY STORY — the identity read, written once. Moved here from the dashboard header (Jay, 2026-08-08): it is
   *  the description of whose Playbook this is, and it belongs beside the story-so-far rather than next to a
   *  greeting. Two stored narratives, one thing to a member. */
  identityParagraph?: string | null;
  rerunStats?: Record<string, { n: number; last: string }>;
  outcomes?: Outcome[];
  /** The member's assessment reads — what their own Sessions said, in plain language. */
  reads?: Read[];
  /** The LIVE practice week, if one is running. It moved here from Momentum in the same step that added this tab —
   *  the same week in two places is worse than either arrangement. */
  grid?: WeekGrid | null;
  /** Sessions they've finished, revisitable read-only. Moved off the Program page — that page describes the
   *  CURRENT cycle, so a Cycle-1 list goes stale there the moment Cycle 2 opens. */
  reviewable?: { key: string; label: string; phase: string }[];
}) {
  const [entries, setEntries] = useState<PlaybookEntry[]>(initial);
  // Tab state lives in the URL so the back button works and a member can be sent straight to a tab. Read once on
  // mount rather than via useSearchParams, which would force a Suspense boundary for no gain here.
  // A running week LEADS. If they're mid-practice, that is what they came for; otherwise Plays, which is the
  // Playbook's heart. An explicit ?tab= always wins so a link can point anywhere.
  const [tab, setTab] = useState<TabKey>(() => {
    const fallback: TabKey = grid ? 'thisweek' : 'worked';
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
      {/* THE PROMISE, moved to the top of the page (2026-08-10 reframe) and matched to the pact said at welcome.
          It has one job: say what this page IS in a sentence, so the tabs below read as parts of one thing. */}
      <p className="pb-sub">Where your Comeback gets kept, so you can use it again and again — the moves that worked for you, and the person you’re reclaiming, in one place. It grows every week, and it’s yours.</p>

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

      {/* NO POINTER ABOVE THE TABS. There was one, and Jay killed it in a sentence: "do we still need the tray if
          the number is on the tab?" No — the Journal tab carries the count, which was my own argument for putting
          a count there. A strip saying the same thing three inches above it is the same information twice in one
          eyeline. The DASHBOARD cue stays: that is a different page, and it has no tabs. */}

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
              {/* SHOW THE ZERO (Jay, 2026-08-10). It used to be suppressed, which read as "this tab is nothing";
                  a visible 0 reads as "this fills up" — the tab is a forecast of where the work lands, not a
                  container that happens to be empty. "This week" is exempt: it holds a live grid rather than a
                  countable pile, and a 0 there would be wrong rather than early. */}
              {t.key !== 'thisweek' && <span className="pb-tab-n">{n}</span>}
            </button>
          );
        })}
      </nav>

      {/* WHO YOU ARE opens with the synthesis — the arc the Companion re-weaves at every Session close. It used to
          sit above everything as "Your story so far", and "My Story" (the identity read) was a separate DASHBOARD
          page. Jay moved that here 2026-08-08. They are two stored narratives but one thing to a member: this is
          me, and this is where I have got to. Two tabs would have made them look like two stories. */}
      {/* MY STORY leads "Who you are" — it is who they ARE (written once, at the start). The synthesis below is
          where they've GOT to (re-woven at every Session close). In that order on purpose: the fixed thing first,
          then the moving one. */}
      {tab === 'learned' && identityParagraph && (
        <section className="pb-card pb-hero">
          <div className="pb-sec">My Story</div>
          <div className="pb-sec-d">Who you are, in the words you landed on.</div>
          <div className="pb-narr">
            {identityParagraph.split(/\n\n+/).map((p) => p.trim()).filter(Boolean).map((para, k) => (<p key={k}>{para}</p>))}
          </div>
        </section>
      )}

      {tab === 'learned' && synthesis && (
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
          {grid && grid.rows.length > 0 ? (
            <>
              <div className="pb-sec">This week</div>
              <div className="pb-sec-d">
                Day {grid.day} of 7. A blank day is a day — this is for noticing what helps, never a score.
              </div>
              <WeekGridPanel memberId={memberId} grid={grid} />
            </>
          ) : grid ? (
            /* A WEEK IS RUNNING BUT HAS NOTHING TO SHOW. Not hypothetical — Jay's own Quality Days week rendered
               as a header over an empty box, because c3Rows returns [] until the Session has stored the profile
               that defines the rows (same for W3 before triggers are named, and w2_image always). Saying so is
               better than a blank: the member can see the week is live and that the rows come from the Session. */
            <>
              <div className="pb-sec">This week</div>
              <div className="pb-sec-d">Day {grid.day} of 7 — your week is running.</div>
              <p className="pb-empty">
                Nothing to mark here yet. The rows come from the Session that opened this week — once it’s set up
                what you’re tracking, they show up here.
              </p>
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
      {tab === 'learned' && reads.length > 0 && (
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

      {/* REVISIT A SESSION — at the foot of PLAYS, because it is the same intent one level up: not "run this
          line again" but "go back through the whole Session that produced it".
          The two affordances are deliberately worded apart. A play says "Run it again with your Companion →" —
          a live re-run. This says "read the final state you kept" — nothing changes. Same neighbourhood, different
          verbs, and if they ever merge it should be into one control with two modes rather than two links that
          look alike. */}
      {tab === 'worked' && reviewable.length > 0 && (
        <section className="pb-card pb-revisit">
          <div className="pb-sec">Revisit a Session</div>
          <div className="pb-sec-d">Any Session you’ve finished — the final state you kept, read-only. Nothing changes.</div>
          <ul className="revisit-list">
            {reviewable.map((s2) => (
              <li key={s2.key}>
                <a href={`/workspace/${memberId}/${s2.key}?review=1`} className="revisit-link">
                  <span className="revisit-name">{s2.label}</span>
                  <span className="revisit-phase">{REVIEW_PHASE_LABEL[s2.phase] ?? s2.phase}</span>
                  <span className="revisit-arrow" aria-hidden="true">→</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

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

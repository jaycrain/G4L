'use client';

import { useState } from 'react';
import type { PlaybookEntry, PlaybookSection } from '../../../lib/playbook/store.ts';
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

type SectionMeta = { key: PlaybookSection; title: string; sub: string; empty: string };

// Your own words lead (the truest, most personal material — from Excavation onward); then the
// synthesized cheat sheet (what works / why), then the member's own journal.
const SECTIONS: SectionMeta[] = [
  {
    key: 'own_words',
    title: 'In your own words',
    sub: 'Things you said that are worth keeping.',
    empty:
      'Lines you say that are worth holding onto land here — your companion keeps the ones that matter, and you decide what stays.',
  },
  {
    key: 'what_works',
    title: 'What works for you',
    sub: 'The reframes and tactics that stuck — in your words.',
    empty:
      'Here’s how this fills: as reframes and tactics start working for you, your companion offers them here — keep the ones that ring true. They become your go-to plays.',
  },
  {
    key: 'why_works',
    title: 'Why it works',
    sub: 'The science that convinced you — the bits that motivate, not the whole textbook.',
    empty:
      'This fills as the science starts to land for you — the few facts that actually convince you get kept here, in plain language.',
  },
  {
    key: 'journal',
    title: 'Your own entries',
    sub: 'Your space to write—a little or a lot, anytime.',
    empty:
      'Write your own entry anytime. This is your space — your companion reads it to understand you better, and only responds if you ask.',
  },
];

export default function PlaybookView({
  memberId,
  initial,
  hasHistory,
  synthesis,
}: {
  memberId: string;
  initial: PlaybookEntry[];
  hasHistory: boolean;
  synthesis?: string | null;
}) {
  const [entries, setEntries] = useState<PlaybookEntry[]>(initial);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');
  const [gathering, setGathering] = useState(false);
  const [gatherMsg, setGatherMsg] = useState<string | null>(null);

  async function gather() {
    if (gathering || busy) return;
    setGathering(true);
    setGatherMsg(null);
    try {
      const r = await gatherFromHistoryAction(memberId);
      await refresh();
      setGatherMsg(
        r.proposed > 0
          ? `Gathered ${r.proposed} from your work — review them below and keep what rings true.`
          : 'Nothing new to gather yet — keep working your Beats and there’ll be more to pull from.',
      );
    } finally {
      setGathering(false);
    }
  }

  async function refresh() {
    setEntries(await loadPlaybookAction(memberId));
  }
  // Run a mutation, then re-pull the authoritative list (simple + correct).
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

  const inSection = (s: PlaybookSection) => entries.filter((e) => e.section === s);

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
    return (
      <div key={e.id} className="pb-entry">
        {editing ? (
          <div className="pb-edit">
            <textarea value={draft} onChange={(ev) => setDraft(ev.target.value)} rows={3} autoFocus />
            <div className="pb-actions">
              <button type="button" className="pb-btn keep" disabled={busy || !draft.trim()} onClick={() => saveEdit(e.id)}>
                Save
              </button>
              <button type="button" className="pb-btn ghost" onClick={() => { setEditingId(null); setDraft(''); }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="pb-line">{e.body}</p>
            <div className="pb-meta">
              {e.section === 'journal' ? (
                <span className="pb-date">{new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              ) : (
                (e.source.label || e.source.kind === 'science') && (
                  <span className={`pb-chip${e.source.kind === 'science' ? ' sci' : ''}`}>
                    {/* science chips read just "Science" — never a Greg attribution */}
                    {e.source.kind === 'science' && (!e.source.label || /greg/i.test(e.source.label)) ? 'Science' : e.source.label}
                  </span>
                )
              )}
              <span className="pb-tools">
                <button type="button" onClick={() => run(() => pinEntryAction(memberId, e.id, !e.pinned))} disabled={busy}>
                  {e.pinned ? 'Unpin' : 'Pin'}
                </button>
                <button type="button" onClick={() => { setEditingId(e.id); setDraft(e.body); }} disabled={busy}>
                  Edit
                </button>
                <button type="button" onClick={() => run(() => removeEntryAction(memberId, e.id))} disabled={busy}>
                  Remove
                </button>
              </span>
            </div>
          </>
        )}
      </div>
    );
  }

  function proposedCard(e: PlaybookEntry) {
    return (
      <div key={e.id} className="pb-proposed">
        <div className="pb-prop-head">Your companion noticed this — keep it?</div>
        <p className="pb-line">{e.body}</p>
        <div className="pb-actions">
          <button type="button" className="pb-btn keep" disabled={busy} onClick={() => run(() => keepEntryAction(memberId, e.id))}>
            Keep it
          </button>
          <button type="button" className="pb-btn ghost" disabled={busy} onClick={() => run(() => dismissEntryAction(memberId, e.id))}>
            Not now
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 className="pb-page-title">Your G4L Playbook</h1>
      <p className="pb-sub">The story you’re telling about yourself — and the plays that back it up</p>
      <p className="pb-intro">
        Your companion keeps two things here: the story you’re writing as you go, and the handful of reframes, science,
        and your own best lines that hold it up. Re-woven every time you close a Session. Reach for it whenever you need it.
      </p>

      {gathering ? (
        <div className="pb-gather"><span className="typing">Gathering from your work…</span></div>
      ) : entries.length === 0 && hasHistory ? (
        <div className="pb-gather-cta">
          <p>You’ve already built real material. Let’s gather it into your Playbook.</p>
          <button type="button" className="pb-btn keep" onClick={gather}>Gather from your work →</button>
        </div>
      ) : null}
      {gatherMsg && <p className="pb-gather-msg">{gatherMsg}</p>}

      {/* HERO — the synthesis narrative leads; captures support it below. */}
      {synthesis && (
        <section className="pb-card pb-hero">
          <div className="pb-sec">Your story so far</div>
          <div className="pb-sec-d">A living read your companion re-weaves each time you close a Session.</div>
          <div className="pb-narr">
            {synthesis.split(/\n\n+/).map((p) => p.trim()).filter(Boolean).map((para, k) => (
              <p key={k}>{para}</p>
            ))}
          </div>
          <div className="pb-rewoven">Re-woven each time you close a Session — it deepens with every one you complete.</div>
        </section>
      )}

      {synthesis && <p className="pb-drawnfrom">What it’s drawn from</p>}

      {SECTIONS.map((meta) => {
        const all = inSection(meta.key);
        const kept = all.filter((e) => e.state === 'kept');
        const proposed = all.filter((e) => e.state === 'proposed');
        const isJournal = meta.key === 'journal';
        return (
          <section key={meta.key} className="pb-card">
            <div className="pb-sec">{meta.title}</div>
            <div className="pb-sec-d">{meta.sub}</div>

            {kept.map(entryCard)}
            {!isJournal && proposed.map(proposedCard)}

            {kept.length === 0 && proposed.length === 0 && <p className="pb-empty">{meta.empty}</p>}

            {isJournal && (
              <div className="pb-add">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Write your own entry…"
                  disabled={busy}
                />
                <button type="button" className="pb-btn keep" disabled={busy || !note.trim()} onClick={addNote}>
                  Add note
                </button>
              </div>
            )}
          </section>
        );
      })}

      {entries.length > 0 && hasHistory && !gathering && (
        <p className="pb-gather-link">
          <button type="button" className="pb-linkbtn" onClick={gather}>Gather from recent work →</button>
        </p>
      )}

      <p className="pb-foot">
        Your companion gathers these as you go and flags keepers — you decide what stays. Edit, pin, or remove anything.
        Over time this becomes the raw material for your Legacy Letter and Success Story.
      </p>
    </>
  );
}

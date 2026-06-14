'use client';

import { useState } from 'react';
import Link from 'next/link';
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
    sub: 'Your space to write — anytime.',
    empty:
      'Write your own entry anytime. This is your space — your companion reads it to understand you better, and only responds if you ask.',
  },
];

export default function PlaybookView({
  memberId,
  initial,
  hasHistory,
}: {
  memberId: string;
  initial: PlaybookEntry[];
  hasHistory: boolean;
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
              {e.source.label && <span className={`pb-chip${e.source.kind === 'science' ? ' sci' : ''}`}>{e.source.label}</span>}
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
      <Link href={`/dashboard/${memberId}`} className="pb-back">← Dashboard</Link>
      <h1 className="pb-page-title">Your G4L Playbook</h1>
      <p className="pb-sub">The plays that are working for you</p>
      <p className="pb-intro">
        The handful of things actually working for you — the reframes that landed, the science that convinced you, and
        your own best lines. Gathered by your companion, kept by you. Reach for it whenever you need it.
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

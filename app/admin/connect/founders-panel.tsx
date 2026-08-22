'use client';

import { useState } from 'react';
import { postAsFoundersAction, seedSessionTopicsAction } from '../connect-actions.ts';

// THE SURFACE THAT WAS MISSING. postAsFoundersAction shipped 2026-08-21 and seedSessionTopicsAction on 08-22, and
// nothing in app/ called either one — there was no /admin/connect route at all, so both were also revalidating a
// page that did not exist. An action with no caller is the same shape as the Session topics themselves: content
// and a link, and nothing that writes the row.
//
// Two controls, because they are two different acts. Seeding is idempotent and mechanical. Posting is speech in
// the Founders' name, and it gets a form the operator has to fill in deliberately.

export default function FoundersPanel() {
  const [busy, setBusy] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [postMsg, setPostMsg] = useState<string | null>(null);

  const seed = async () => {
    setBusy(true);
    setSeedMsg(null);
    const res = await seedSessionTopicsAction();
    // The action reports WHICH thing is missing (the Founders account is created by hand), so surface its words
    // rather than a generic failure — "something went wrong" would send an operator looking in the wrong place.
    setSeedMsg(res.ok ? (res.summary ?? 'Done.') : (res.error ?? 'Failed.'));
    setBusy(false);
  };

  const post = async () => {
    setBusy(true);
    setPostMsg(null);
    const res = await postAsFoundersAction({ title, body });
    if (res.ok) {
      setTitle('');
      setBody('');
      setPostMsg('Posted as The Founders.');
    } else {
      setPostMsg(res.error ?? 'Failed.');
    }
    setBusy(false);
  };

  return (
    <>
      <div className="card">
        <h3>The four Session topics</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Creates the Founders-authored thread each Session&rsquo;s nudge points at. Safe to run twice — it
          refreshes the wording rather than posting duplicates.
        </p>
        <button type="button" className="btn-pill" onClick={seed} disabled={busy}>
          {busy ? 'Working…' : 'Create or refresh the topics'}
        </button>
        {seedMsg && <p className="muted" role="status" style={{ marginBottom: 0 }}>{seedMsg}</p>}
      </div>

      <div className="card">
        <h3>Post as The Founders</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Goes into the Community signed &ldquo;The Founders&rdquo;. The author is resolved on the server and can
          never be passed in — reaching this form is not the same as being able to speak as someone.
        </p>
        <label htmlFor="fp-title">Title</label>
        <input id="fp-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
        <label htmlFor="fp-body">Body</label>
        <textarea id="fp-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} disabled={busy} />
        <button
          type="button"
          className="btn-pill"
          onClick={post}
          disabled={busy || !title.trim() || !body.trim()}
          style={{ marginTop: '0.6rem' }}
        >
          {busy ? 'Working…' : 'Post it'}
        </button>
        {postMsg && <p className="muted" role="status" style={{ marginBottom: 0 }}>{postMsg}</p>}
      </div>
    </>
  );
}

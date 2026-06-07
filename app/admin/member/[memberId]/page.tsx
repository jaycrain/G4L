import Link from 'next/link';
import { getDb } from '../../../../lib/db/index.ts';
import { getDashboard } from '../../../../lib/gateway/flow.ts';
import { listForMember } from '../../../../lib/founder/store.ts';
import { MOMENTS, type OperatingMoment } from '../../../../lib/founder/draft.ts';
import type { Db } from '../../../../lib/db/schema.ts';
import { generateDraftAction } from '../../actions.ts';
import DraftReview from '../../draft-review.tsx';

export default async function AdminMember({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const db = (await getDb()) as unknown as Db;
  const dash = await getDashboard(db, memberId);
  if (!dash) return <p className="error">Member not found. <Link href="/admin">Back</Link></p>;

  const drafts = await listForMember(db, memberId);

  return (
    <>
      <p><Link href="/admin">← Admin</Link></p>
      <h1>{dash.displayName}</h1>

      <div className="card">
        <p>
          {dash.identityNoun && <>Reclaiming <strong>THE {dash.identityNoun}</strong> · </>}
          {dash.door && <>Door: <strong>{dash.door.displayName}</strong> · </>}
          {dash.score
            ? <>ID Score: <strong>{dash.score.score}</strong>{dash.score.direction ? ` (${dash.score.direction})` : ''}</>
            : 'No IDQ yet'}
          {dash.currentFocus && <> · Focus: {dash.currentFocus.label}</>}
        </p>
        {dash.identityParagraph && <p className="muted">{dash.identityParagraph}</p>}
      </div>

      <div className="card">
        <h3>Generate a message (your voice)</h3>
        <p className="muted">Pick a moment — the Founder Agent drafts it from this member&apos;s context, for your review.</p>
        <div className="moment-buttons">
          {(Object.keys(MOMENTS) as OperatingMoment[]).map((m) => (
            <form key={m} action={generateDraftAction.bind(null, memberId, m)}>
              <button type="submit">{MOMENTS[m].label}</button>
            </form>
          ))}
        </div>
      </div>

      <h3>Drafts &amp; sent ({drafts.length})</h3>
      {drafts.length === 0 && <p className="muted">Nothing yet.</p>}
      {drafts.map((d) =>
        d.approval_status === 'pending' ? (
          <DraftReview
            key={d.id}
            id={d.id}
            memberId={memberId}
            subject={d.draft_subject}
            body={d.jay_edits ?? d.draft_body}
            moment={d.operating_moment}
          />
        ) : (
          <div key={d.id} className="card draft-card">
            <div className="draft-head">
              <span className="draft-moment">{d.operating_moment.replace(/_/g, ' ')}</span>
              <span className={`pill ${d.approval_status}`}>{d.approval_status === 'approved' ? 'sent' : 'rejected'}</span>
            </div>
            <p className="draft-subject"><strong>Subject:</strong> {d.draft_subject}</p>
            <pre className="draft-sent-body">{d.jay_edits ?? d.draft_body}</pre>
          </div>
        ),
      )}
    </>
  );
}

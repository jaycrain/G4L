'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { approveSendAction, rejectAction } from './actions.ts';

export default function DraftReview({
  id,
  memberId,
  subject,
  body,
  moment,
}: {
  id: string;
  memberId: string;
  subject: string;
  body: string;
  moment: string;
}) {
  const router = useRouter();
  const [edited, setEdited] = useState(body);
  const [pending, setPending] = useState(false);

  async function approve() {
    setPending(true);
    await approveSendAction(id, memberId, edited);
    router.refresh();
  }
  async function reject() {
    setPending(true);
    await rejectAction(id, memberId);
    router.refresh();
  }

  return (
    <div className="card draft-card">
      <div className="draft-head">
        <span className="draft-moment">{moment.replace(/_/g, ' ')}</span>
        <span className="pill pending">pending review</span>
      </div>
      <p className="draft-subject"><strong>Subject:</strong> {subject}</p>
      <textarea className="draft-body" value={edited} onChange={(e) => setEdited(e.target.value)} rows={10} />
      <div className="draft-actions">
        <button type="button" onClick={approve} disabled={pending}>
          {pending ? 'Sending…' : 'Approve & send'}
        </button>
        <button type="button" className="btn-secondary" onClick={reject} disabled={pending}>
          Reject
        </button>
      </div>
      <p className="muted draft-note">You are the send gate — nothing goes out until you approve. (Send is simulated in this preview; no email is actually delivered yet.)</p>
    </div>
  );
}

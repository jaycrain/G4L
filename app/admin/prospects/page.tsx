import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import {
  listProspects,
  summarizeProspects,
  dropOffLabel,
  STALLED_AFTER_HOURS,
  PROSPECT_WINDOW_DAYS,
} from '../../../lib/admin/prospects.ts';
import { isAdmin } from '../../authz.ts';
import ConsoleSubpage from '../console/subpage.tsx';
import ProspectsPanel from '../prospects-panel.tsx';
import type { Db } from '../../../lib/db/schema.ts';

// THE PROSPECTS SUBPAGE — where the people who did not finish finally have an address.
//
// The panel itself shipped 2026-08-15 and rendered to nobody for nine days: it lived below the console's early
// return on `app/admin/page.tsx`, so anyone with the console flag on — which is everyone — got a page that had
// already returned. A real prospect sat in the table the whole time. It gets its own route now for the same
// reason Attention has one: a list you work down is a place you go, not a card you scroll past.
//
// SAME LINE AS EVERY OTHER OPERATOR SURFACE, held harder. These are not members. They have no account, some of
// them chose to walk away, and one of them we turned away. Shape is ambient; the words are behind a reveal that
// writes to the access log BEFORE it reads, and fails the read if the write fails.

export default async function ProspectsPage() {
  if (!(await isAdmin())) redirect('/admin/login');
  const db = (await getDb()) as unknown as Db;
  const rows = await listProspects(db);
  const s = summarizeProspects(rows);

  const prospects = rows.map((p) => ({
    email: p.email,
    name: p.name,
    turns: p.turns,
    hoursAgo: p.hoursAgo,
    identityNoun: p.identityNoun,
    status: p.status,
    dropOff: dropOffLabel(p),
  }));

  return (
    <ConsoleSubpage title="Started, not finished" here="/admin/prospects">
      <div className="card">
        <h3>At the door ({s.total})</h3>
        <p className="muted fca-def">
          People who began the conversation and have no account yet. Not members — they never finished, and
          they never agreed to be read. Ordered by what needs doing: anyone in distress first, then the ones
          who did the whole conversation and stopped one tap short.
        </p>
        <ProspectsPanel prospects={prospects} />
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3>How to read this</h3>
        <ul className="fca-def muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li><strong>Needs a human</strong> — distress detected mid-conversation. This one has a clock on it.</li>
          <li><strong>Finished, not signed up</strong> — the costliest drop-off there is. They did all of it and
            did not tap &ldquo;This is me.&rdquo; That is a bug or a moment of doubt, and both are worth today.</li>
          <li><strong>Turned away</strong> — the scope gate released them. Usually correct. Not always: on
            2026-08-14 it released someone on eleven words, and the gate has since been fixed.</li>
          <li><strong>In the conversation</strong> — typing right now. Nothing to do.</li>
          <li><strong>Went quiet</strong> — nothing for {STALLED_AFTER_HOURS}+ hours. Onboarding is one sitting,
            so a gap this long means something interrupted them.</li>
        </ul>
      </div>

      <p className="fc-elsewhere">
        Rows disappear after {PROSPECT_WINDOW_DAYS} days, because the conversation behind them is deleted then
        too — the surface must never outlive the data it describes. Reaching out goes through the{' '}
        <Link href="/admin/review">review queue</Link>; nothing sends without you.
      </p>
    </ConsoleSubpage>
  );
}

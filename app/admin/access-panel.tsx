// WHO HAS OPENED THIS RECORD — the answer to the question a member is entitled to ask.
//
// This panel is the point of the access log. A log nobody can read is a table, not an accountability mechanism,
// and building the write half without the read half is the shape that has cost us before (two functions that
// both existed, both tested, never wired to each other).
//
// It shows the CURRENT operator their own access at the top, deliberately. Seeing "you, just now" every time you
// open somebody's story is a small, constant reminder that opening it is recorded — which is most of the
// deterrent value. Hiding your own entries would make the log feel like something that watches other people.

import { accessesForMember, type AccessEntry } from '../../lib/admin/access-log.ts';
import type { Db } from '../../lib/db/schema.ts';

const SURFACE_LABEL: Record<string, string> = {
  admin_member_page: 'opened their console record',
  diagnostic_api: 'pulled their full state via the diagnostic API',
  founder_companion: 'asked the Companion about them',
};

function when(at: Date, now: number): string {
  const mins = Math.round((now - at.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default async function AccessPanel({ db, memberId }: { db: Db; memberId: string }) {
  let entries: AccessEntry[] = [];
  let failed = false;
  try {
    entries = await accessesForMember(db, memberId, 25);
  } catch (e) {
    // Say so rather than rendering an empty list. An empty audit panel that actually means "the query failed"
    // is the confident-lie shape: it reads as "nobody has looked at this member", which is the single most
    // misleading thing this panel could claim.
    failed = true;
    console.error('access panel could not read the log:', (e as Error).message);
  }
  const now = Date.now();

  return (
    <div className="card">
      <h3>Who has opened this record</h3>
      {failed ? (
        <p className="error">Could not read the access log — this list is unavailable, not empty.</p>
      ) : entries.length === 0 ? (
        <p className="muted">No recorded opens yet. Logging began when migration 0073 was applied.</p>
      ) : (
        <ul className="plain">
          {entries.map((e, i) => (
            <li key={`${e.at.toISOString()}-${i}`}>
              <strong>{e.operatorLabel}</strong> {SURFACE_LABEL[e.surface] ?? e.surface}
              {e.note ? <span className="muted"> — {e.note}</span> : null}
              <span className="muted"> · {when(e.at, now)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="muted">
        Opening one member&rsquo;s record is recorded. Roster and cohort views are not — this is the list of times
        someone looked at <em>this</em> person.
      </p>
    </div>
  );
}

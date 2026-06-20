import { getDb } from '../../lib/db/index.ts';
import { isDemoEmail } from '../../lib/admin/roster.ts';
import type { Db } from '../../lib/db/schema.ts';
import { assertDevOnly } from './guard.ts';
import { viewAsAction, seedDemoAction } from './actions.ts';

export const metadata = { title: 'Dev — View as member' };

// LOCAL-ONLY developer page (see ./guard.ts). Lets you preview the app as a seeded demo member so a
// change can be eyeballed before it goes live — no real account, no UUIDs, no token juggling.
export default async function DevPage() {
  assertDevOnly();
  const db = (await getDb()) as unknown as Db;
  const { rows } = await db.query<{ member_id: string; display_name: string; email: string }>(
    'select member_id, display_name, email from member_profile order by display_name',
  );
  const demos = rows.filter((r) => isDemoEmail(r.email));

  return (
    <>
      <div
        style={{
          background: '#BB2127',
          color: '#fff',
          padding: '0.5rem 0.85rem',
          borderRadius: 6,
          fontWeight: 600,
          marginBottom: '1.25rem',
        }}
      >
        DEV — local fake data only. This page does not exist on the live site.
      </div>

      <h1>View as a demo member</h1>
      <p className="muted">
        Pick a seeded demo member to preview the app exactly as they see it. You&apos;ll be logged in as
        them and dropped on their dashboard. Throwaway test data — never a real account.
      </p>

      {demos.length === 0 ? (
        <div className="card">
          <p>No demo members in the local database yet.</p>
          <form action={seedDemoAction}>
            <button type="submit" className="btn">Seed demo data</button>
          </form>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.75rem' }}>
          {demos.map((m) => (
            <li key={m.member_id}>
              <form action={viewAsAction.bind(null, m.member_id)}>
                <button type="submit" className="btn" style={{ width: '100%', textAlign: 'left' }}>
                  View as {m.display_name} <span className="muted">— {m.email}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

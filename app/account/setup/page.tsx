import { getDb } from '../../../lib/db/index.ts';
import type { Db } from '../../../lib/db/schema.ts';
import SetupForm from './setup-form.tsx';

export const metadata = { title: 'Save your account — Grinta for Life' };

export default async function AccountSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const { member } = await searchParams;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!member || !UUID_RE.test(member)) {
    return <p className="error">No account in context. Start at the beginning.</p>;
  }
  const db = (await getDb()) as unknown as Db;
  const m = (await db.query<{ email: string }>('select email from member_profile where member_id = $1', [member])).rows[0];
  if (!m) return <p className="error">We couldn&apos;t find that account.</p>;

  return (
    <>
      <h1>Save your account</h1>
      <p className="muted">
        Set a password so you can close this and come back to your dashboard anytime — on any device.
      </p>
      <SetupForm memberId={member} email={m.email} />
    </>
  );
}

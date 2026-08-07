import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { isAdmin } from '../../authz.ts';
import { listOperators } from '../../../lib/auth/operator.ts';
import { accessesByOperator } from '../../../lib/admin/access-log.ts';
import ConsoleSubpage from '../console/subpage.tsx';
import OperatorsClient from './operators-client.tsx';
import type { Db } from '../../../lib/db/schema.ts';

export const metadata = { title: 'Operators — Grinta for Life' };

export default async function OperatorsPage() {
  if (!(await isAdmin())) redirect('/admin/login');
  const db = (await getDb()) as unknown as Db;
  const raw = await listOperators(db);
  // The offboarding question: what did this person actually open? Counted per operator so the page can answer it
  // without a second click — the moment you most want this number is the moment someone is leaving.
  const recent = await Promise.all(
    raw.map(async (o) => {
      try {
        return (await accessesByOperator(db, o.id, 200)).length;
      } catch {
        return null; // null renders as "unavailable", never as zero — a failed count must not read as "opened nothing"
      }
    }),
  );
  const operators = raw.map((o, i) => ({
    id: o.id,
    name: o.name,
    email: o.email,
    // Serialised for the client boundary — a Date would need a custom serializer and buys nothing here.
    disabledAt: o.disabledAt ? o.disabledAt.toISOString() : null,
    opens: recent[i] ?? null,
  }));
  return (
    <ConsoleSubpage title="Operators" here="/admin/operators">
      <OperatorsClient operators={operators} />
    </ConsoleSubpage>
  );
}

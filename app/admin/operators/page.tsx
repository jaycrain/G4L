import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { isAdmin } from '../../authz.ts';
import { listOperators } from '../../../lib/auth/operator.ts';
import ConsoleSubpage from '../console/subpage.tsx';
import OperatorsClient from './operators-client.tsx';
import type { Db } from '../../../lib/db/schema.ts';

export const metadata = { title: 'Operators — Grinta for Life' };

export default async function OperatorsPage() {
  if (!(await isAdmin())) redirect('/admin/login');
  const db = (await getDb()) as unknown as Db;
  const operators = (await listOperators(db)).map((o) => ({
    id: o.id,
    name: o.name,
    email: o.email,
    // Serialised for the client boundary — a Date would need a custom serializer and buys nothing here.
    disabledAt: o.disabledAt ? o.disabledAt.toISOString() : null,
  }));
  return (
    <ConsoleSubpage title="Operators" here="/admin/operators">
      <OperatorsClient operators={operators} />
    </ConsoleSubpage>
  );
}

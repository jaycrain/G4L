import { redirect } from 'next/navigation';
import { isAdmin } from '../../authz.ts';
import ConsoleSubpage from '../console/subpage.tsx';
import FoundersPanel from './founders-panel.tsx';

// /admin/connect — the route two server actions have been revalidating since 2026-08-21 without it existing.
//
// postAsFoundersAction and seedSessionTopicsAction both call revalidatePath('/admin/connect') and neither had a
// caller anywhere in app/. That is how the Session topics ended up shipped-but-inert twice: the pieces were real,
// nothing joined them, and the tests covered the pieces.

export default async function AdminConnectPage() {
  if (!(await isAdmin())) redirect('/admin/login');
  return (
    <ConsoleSubpage title="Community — the Founders' voice" here="/admin/connect">
      <FoundersPanel />
    </ConsoleSubpage>
  );
}

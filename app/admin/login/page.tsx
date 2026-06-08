import { redirect } from 'next/navigation';
import { isAdmin } from '../../authz.ts';
import AdminLoginForm from './admin-login-form.tsx';

export const metadata = { title: 'Admin — Grinta for Life' };

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect('/admin');
  return (
    <>
      <h1>Operator console</h1>
      <p className="muted">Enter the admin password to continue.</p>
      <AdminLoginForm />
    </>
  );
}

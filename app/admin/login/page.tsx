import { redirect } from 'next/navigation';
import { isAdmin } from '../../authz.ts';
import AdminLoginForm from './admin-login-form.tsx';

export const metadata = { title: 'Admin — Grinta for Life' };

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect('/admin');
  return (
    <>
      <h1>Operator console</h1>
      <p className="muted">Sign in with your own email and password. Leave the email blank to use the shared password.</p>
      <AdminLoginForm />
      {/* NO SELF-SERVICE RESET HERE, and that is the decision rather than an omission (2026-08-07).
          Members get a reset link (/login/forgot) because a member credential opens one member's own account.
          An operator credential opens EVERY member's identity story, gap and transcripts — so a reset link
          sitting in an inbox becomes an attack surface on the highest-value credential in the product. With a
          team this size, re-issuing by hand costs a minute and removes that surface entirely.
          The line exists so a stuck operator knows the path instead of assuming the login is broken. */}
      <p className="muted">
        Forgotten it? Operator passwords are re-issued by hand — this login opens every member&rsquo;s record. Ask Jay.
      </p>
    </>
  );
}

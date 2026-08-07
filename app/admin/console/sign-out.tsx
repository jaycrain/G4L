'use client';

// SIGNING OUT OF THE CONSOLE — which, until 2026-08-07, was not possible.
//
// `adminLogout()` had existed in app/authz.ts since the console shipped and had NEVER been called from anywhere.
// The gap only showed up when operators arrived and the obvious next instruction became "now sign out and sign
// back in as yourself" — there was no way to do it short of clearing cookies by hand. The session also renews
// itself on every console visit (AdminAutoRefresh → renewAdminSession), so it effectively never lapsed either.
//
// It matters more now than it did: with named operators, staying signed in as the shared "root" password means
// every member record you open is attributed to nobody. Being able to leave is what makes the audit trail worth
// having.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminSignOutAction } from './sign-out-action.ts';

export default function SignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      className="fch-signout"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await adminSignOutAction();
        router.push('/admin/login');
        router.refresh();
      }}
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}

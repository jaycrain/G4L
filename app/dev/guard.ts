import { notFound } from 'next/navigation';

// The /dev preview tools are LOCAL-ONLY. They hand out a logged-in session for a demo member with
// no password, so they must never exist where real member data could live. Two independent gates:
//   1. not a production build, AND
//   2. no DATABASE_URL — i.e. running against the local pglite dev DB, never hosted Postgres.
// On Vercel both fail, so every /dev route 404s. Call this first in every page and action here.
export function assertDevOnly(): void {
  if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL) notFound();
}

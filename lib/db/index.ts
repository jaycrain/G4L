// Single database entry point. Picks the adapter by environment:
//   - DATABASE_URL set   -> hosted Postgres (Supabase), for production / Vercel
//   - otherwise          -> local pglite, for development
// Singleton across Next.js hot reloads / serverless invocations via globalThis.

import type { Db } from './schema.ts';

declare global {
  // eslint-disable-next-line no-var
  var __g4l_db__: Promise<Db> | undefined;
}

async function init(): Promise<Db> {
  if (process.env.DATABASE_URL) {
    const { getPostgresDb } = await import('./postgres.ts');
    return getPostgresDb(); // schema applied out-of-band via `npm run db:migrate`
  }
  const { getPgliteDb } = await import('./pglite.ts');
  return getPgliteDb();
}

export function getDb(): Promise<Db> {
  // A REJECTED init must not be cached. `??=` memoizes the promise whatever it settles to, so one transient
  // failure poisoned the process for its entire life — every later getDb() replayed the original error and the
  // only cure was a restart. Found 2026-08-08: a stray script opened a second PGlite on the same data directory,
  // the abort lasted a moment, and every page stayed broken afterwards, which reads as "my last change broke the
  // app" and sends you debugging the wrong thing. Dev is where it is most visible; the serverless case is worse
  // and quieter, because a cold start that hits a blip would serve errors until that instance is recycled.
  globalThis.__g4l_db__ ??= init().catch((e) => {
    globalThis.__g4l_db__ = undefined; // let the next caller try again
    throw e;
  });
  return globalThis.__g4l_db__;
}

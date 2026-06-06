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
  globalThis.__g4l_db__ ??= init();
  return globalThis.__g4l_db__;
}

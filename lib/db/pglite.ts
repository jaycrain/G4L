// Local development database — a persisted, in-process Postgres (pglite). No Docker, no
// hosted account needed. This is the LOCAL data layer; production swaps this module for the
// hosted Supabase Postgres (same SQL, same Db interface). Server-only.
//
// Singleton across Next.js hot reloads via globalThis so we keep one connection on the
// persisted data dir (.pglite/, gitignored).

import { PGlite } from '@electric-sql/pglite';
import { ensureSchema, type Db } from './schema.ts';

const DATA_DIR = '.pglite';

declare global {
  // eslint-disable-next-line no-var
  var __g4l_db__: Promise<PGlite> | undefined;
}

async function init(): Promise<PGlite> {
  const db = new PGlite(DATA_DIR);
  await db.waitReady;
  await ensureSchema(db as unknown as Db);
  return db;
}

export function getDb(): Promise<PGlite> {
  if (!globalThis.__g4l_db__) globalThis.__g4l_db__ = init();
  return globalThis.__g4l_db__;
}

// Local development database — a persisted, in-process Postgres (pglite). No Docker, no
// hosted account. Used when DATABASE_URL is NOT set. Production uses the Postgres adapter
// (lib/db/postgres.ts) against hosted Supabase. Both expose the same Db interface.

import { PGlite } from '@electric-sql/pglite';
import { ensureSchema, type Db } from './schema.ts';

const DATA_DIR = '.pglite';

/** Create the local pglite Db and ensure the schema is applied (runtime migrations are fine
 *  locally; in production migrations are applied out-of-band via `npm run db:migrate`). */
export async function getPgliteDb(): Promise<Db> {
  const db = new PGlite(DATA_DIR);
  await db.waitReady;
  const handle = db as unknown as Db;
  await ensureSchema(handle);
  return handle;
}

// Local development database — a persisted, in-process Postgres (pglite). No Docker, no
// hosted account. Used when DATABASE_URL is NOT set. Production uses the Postgres adapter
// (lib/db/postgres.ts) against hosted Supabase. Both expose the same Db interface.

import { PGlite } from '@electric-sql/pglite';
import { ensureSchema, type Db } from './schema.ts';

const DATA_DIR = '.pglite';

/** Create the local pglite Db and ensure the schema is applied (runtime migrations are fine
 *  locally; in production migrations are applied out-of-band via `npm run db:migrate`). */
export async function getPgliteDb(): Promise<Db> {
  const raw = new PGlite(DATA_DIR);
  await raw.waitReady;
  // PGlite's native query/exec already match the Db shape; add withActor so local dev attributes the
  // audit actor too (parity with prod). PGlite supports transactions via .transaction(cb).
  const handle: Db = {
    query: (text, params) => (raw as any).query(text, params),
    exec: (text) => (raw as any).exec(text),
    withActor: async <T>(actor: string, fn: (tx: Db) => Promise<T>) =>
      (raw as any).transaction(async (tx: any) => {
        await tx.query(`select set_config('g4l.actor', $1, true)`, [actor]);
        const txDb: Db = { query: (text, params) => tx.query(text, params), exec: (text) => tx.exec(text) };
        return fn(txDb);
      }),
  };
  await ensureSchema(handle);
  return handle;
}

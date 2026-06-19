// Production database adapter — hosted Postgres (Supabase) via postgres.js, behind the same
// Db interface as local pglite. Used when DATABASE_URL is set (e.g. on Vercel).
//
// Use the Supabase *pooler* connection string (Supavisor, transaction mode) for serverless;
// `prepare: false` is required because transaction-mode pooling doesn't support prepared
// statements. Migrations are applied out-of-band (npm run db:migrate), not at runtime.

import postgres from 'postgres';
import type { Db } from './schema.ts';

let client: ReturnType<typeof postgres> | undefined;

function getClient() {
  if (!client) {
    client = postgres(process.env.DATABASE_URL!, { prepare: false, ssl: 'require' });
  }
  return client;
}

export function getPostgresDb(): Db {
  const sql = getClient();
  return {
    query: async <T = Record<string, unknown>>(text: string, params: unknown[] = []) => {
      const rows = await sql.unsafe(text, params as any[]);
      return { rows: rows as unknown as T[] };
    },
    exec: async (text: string) => {
      await sql.unsafe(text);
    },
    // Run fn in one transaction, tagging the audit actor first (set_config(..., true) = txn-local,
    // so it can't leak across pooled connections). The actor is passed as a bound param, never
    // interpolated.
    withActor: async <T>(actor: string, fn: (tx: Db) => Promise<T>) =>
      sql.begin(async (tx) => {
        await tx.unsafe(`select set_config('g4l.actor', $1, true)`, [actor]);
        const txDb: Db = {
          query: async <U = Record<string, unknown>>(text: string, params: unknown[] = []) => {
            const rows = await tx.unsafe(text, params as any[]);
            return { rows: rows as unknown as U[] };
          },
          exec: async (text: string) => {
            await tx.unsafe(text);
          },
        };
        return fn(txDb);
      }) as Promise<T>,
  };
}

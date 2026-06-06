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
  };
}

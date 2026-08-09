// Generate the migration-drift diagnostic SQL — "which repo migrations are NOT applied on this database?"
//
// Paste the output into the Supabase SQL Editor (prod migrations are applied by hand; see
// docs/runbooks/rls-and-migration-drift.md). It is read-only. An empty result means prod is current.
//
// THE LIST LIVES IN lib/db/schema.ts, NOT HERE. This file used to keep its own hand-maintained copy of the same
// sentinels, and on 2026-08-08 that copy was found to stop at 0055 while the repo had shipped through 0074 —
// nineteen migrations with no check. It still emitted valid SQL and still reported "no drift", which is the
// worst kind of broken for a diagnostic guarding whether member tables have their RLS. Two lists meant one of
// them could rot unnoticed; now there is one, and adding a migration to schema.ts is the only step.
//
// Run: node --experimental-strip-types scripts/db/gen-migration-drift.mjs
import { MIGRATIONS } from '../../lib/db/schema.ts';

const Q = "'";

/** A migration's number, from its filename: migrations/0068_drop_session_token.sql → "0068". */
const numberOf = (file) => file.split('/').pop().slice(0, 4);

/** Sentinel → a boolean SQL expression that is TRUE when the migration has been applied. */
const expr = (s) =>
  typeof s === 'string'
    ? `to_regclass(${Q}public.${s}${Q}) is not null`
    : s.table
      ? `exists(select 1 from information_schema.columns where table_schema=${Q}public${Q} and table_name=${Q}${s.table}${Q} and column_name=${Q}${s.column}${Q})`
      // A raw-SQL sentinel is already a full `select <expr> as e` (the shape applySchema runs), so unwrap it to
      // the bare expression. This is how an INVERTED check survives: 0068 DROPS a column, so "applied" means the
      // column is GONE. Reading it as {table,column} would invert the answer and report a correctly-migrated
      // database as permanently behind.
      : `(${s.sql.replace(/^\s*select\s+/i, '').replace(/\s+as\s+e\s*$/i, '')})`;

const rows = MIGRATIONS
  .map(({ file, sentinel }) => `  select ${Q}${numberOf(file)}${Q} as migration, coalesce(${expr(sentinel)}, false) as applied`)
  .join('\n  union all\n');

export const sql = `-- Migration drift: which repo migrations are applied on this database?
-- 'applied=false' rows are MISSING from this DB (run them, in order).
select migration, applied
from (
${rows}
) t
where applied = false   -- show ONLY the gaps; delete this line to see all ${MIGRATIONS.length}
order by migration;`;

// Print only when RUN, not when IMPORTED — the coverage test imports this module, and dumping 74 lines of SQL
// into the test output buries the assertions.
const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) console.log(sql);

export { MIGRATIONS };

// Set the phase flags BEFORE anything imports the curriculum registry — the mirror of ./no-phase-flags.ts.
//
// Same mechanic, opposite direction: registry.ts reads REWIRE / REBUILD / RECLAIM at module scope, so a test
// that needs the STAGED program (the one prod actually runs) has to set them in an imported module, not in the
// test body — ESM hoists imports, so any assignment written in the file body happens too late.
//
// Why this is worth having: the id namespaces differ between the two programs. Unflagged, Rewire's assets are
// RWR-DIS / RWR-NUM / RWR-FOO; staged, they're RWR-W1 / RWR-W2 / RWR-W3 — and the close sites write the STAGED
// ids. A test written against the unflagged registry therefore looks up a session id that program has never
// heard of, gets null, and passes without asserting anything. That is exactly how the first version of
// last-accomplishment.test.ts "passed", and it briefly convinced me I'd found a live id-mismatch bug in prod.
//
// Not named *.test.ts on purpose, so the `tests/*.test.ts` glob doesn't try to run it.

process.env.REWIRE = 'staged';
process.env.REBUILD = 'staged';
process.env.RECLAIM = 'staged';

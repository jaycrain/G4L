// Clear the phase flags BEFORE anything imports the curriculum registry.
//
// registry.ts reads REWIRE / REBUILD / RECLAIM at module scope, so whichever value is in the environment when
// it first loads decides which program the whole test file sees. Sourcing .env.local before `npm test` — an
// easy thing to do, and I did it three times — silently switched it to the STAGED program and turned five
// unrelated tests red.
//
// THIS HAS TO BE ITS OWN MODULE. `delete process.env.REWIRE` written at the top of the test file does NOT
// work: ESM hoists imports, so the registry is fully evaluated before any statement in the file body runs.
// An imported module's side effects, however, run in import order — so this must be the FIRST import in any
// file that expects the unflagged program.
//
// Not named *.test.ts on purpose, so the `tests/*.test.ts` glob doesn't try to run it.

delete process.env.REWIRE;
delete process.env.REBUILD;
delete process.env.RECLAIM;

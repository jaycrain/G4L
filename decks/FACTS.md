# Where every number on the deck comes from

The Platform & Program Overview goes to the internal team and onward to people who fund and join. Jay's
instruction was that it be **accurate and real**. So no figure is typed into a slide: `measure.js` computes them
from the repository into `facts.json`, and `build_tech_overview.js` reads that. Re-run `node decks/measure.js`
and the deck's numbers move with the product.

Two figures are **floors, not estimates**, and the slides say so out loud.

| On the slide | Value at v3.5.62 | How it is derived |
|---|---|---|
| hours of build time | **493** | Commit timestamps clustered into working sessions (a >90 min gap ends one), each credited its span + 20 min. |
| commits | 1,713 | `git rev-list --count HEAD` |
| days with work committed | 82 | distinct `%ad` dates in the log |
| calendar weeks | 12 | first commit (2026-06-05) → today |
| releases in the last two weeks | 126 | commits since 14 days ago whose message starts `v3.` — v3.4.6 → v3.5.62 |
| Sessions | 16 | distinct keys in `lib/workspace/session-key.ts` (W4 is keyed `rewire-checkpoint`) |
| member-facing surfaces | 56 | `app/**/page.tsx`, excluding `app/dev/*`, admin and founder |
| Doors | 12 | `slug:` entries in `lib/doors.ts` |
| gated assets | 13 | asset codes in `lib/assets/definitions.ts` |
| automated checks | 2,496 | the pass count from `npm test` |
| test files | 359 | `tests/*.test.ts*` |
| migrations | 92 | `*.sql` files under the migrations path |
| lines of application code | 70,857 | `lib` + `app`, `.ts`/`.tsx`, excluding tests |
| stack versions | — | read from `package.json`, not remembered |

## Why the hours figure is a floor

The clustering can only see time **between commits inside a session**. It cannot see planning before a session's
first commit, reading Greg's documents, a design decision made away from the keyboard, or any day that ended
without a commit. It also credits only 20 minutes after a session's last commit. Every one of those omissions
pushes the number down, none pushes it up. **493 is the smallest defensible number, not the likeliest one** —
which is the right direction for a figure that may end up in front of a donor.

The same discipline applies to the turn counts on the diagram: they come from an offline walk with a maximally
cooperative member, so a real member goes longer. They are a floor on Session length, not an estimate of it.

## What is deliberately NOT claimed

- No completion, retention or outcome numbers. Nobody has finished the program yet; the first Charter walks are
  happening now. A deck that implied otherwise would be the one thing we cannot take back.
- No accuracy or quality claim for the Companion's conversation. What is claimed is what is *enforced* — crisis
  routing, disclosure, never inventing a Door, never dropping a want — and each of those is a rule in code with a
  test behind it, not a hope about model behaviour.

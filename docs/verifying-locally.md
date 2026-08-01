# Seeing what you're building

The recurring failure on this project has not been writing the wrong code. It has been **shipping code I
couldn't look at**, and making Jay the test suite. This is the setup that removes that, what it covers, and —
honestly — what it still doesn't.

---

## The one-time setup

```bash
npm run dev:bootstrap      # seeds demo members AND gives one a password
```

That is `db:seed-demo` + `db:set-demo-password` in one step. It needs `SMOKE_EMAIL` / `SMOKE_PASSWORD` in
`.env.local` (a `.test` account — the script hard-refuses anything else).

**Stop the dev server first.** The local database is pglite persisted to `.pglite`, and it is single-writer:
the dev server holds it, so a seed run while it's up will fail or conflict.

**Why this was the blocker.** The scripts already existed — but the local DB had demo members with *no
password*, so nothing could log in as a member locally. Every member-facing check therefore had to go
`push → wait for deploy → verify on prod`, which is slow enough that the temptation is to skip it and let
Jay find the problem. One missing password was the whole difference.

## The walks

```bash
npm run walk:focus                    # every field a member touches, focus ring + colour
npm run walk:console                  # every Founder Console surface + every link out of it
npm run walk:companion                # the Founder Companion: real model, real tools, privacy boundary
npm run smoke -- <url>                # the post-deploy member smoke test
```

Each takes an optional base URL and defaults to `http://localhost:3100`. All of them work against **prod**
too — pass `https://g4l-ten.vercel.app` — which is how member surfaces are confirmed after a deploy.

## What these actually catch

Things invisible to the offline suite *and* to a screenshot:

- A focus ring that doesn't exist (`outline: none` with nothing put back).
- A panel rendering empty because a read threw and the catch swallowed it.
- A page that 200s while its own content is missing.
- A link out of the console that goes nowhere.
- The Companion volunteering a member's private words in a cohort answer.

## What they still DON'T cover — say so rather than implying coverage

- **The prod Founder Console.** It's admin-gated and I don't have (and shouldn't have) the prod admin
  password: `ADMIN_PASSWORD` makes `authorizeMember` true for *every* member (SEC-02). So the console is
  verified locally and on Preview, never on prod. **Jay's walk is still the only proof there.**
- **Mobile Safari.** Chromium only. The iOS-specific traps (the ≥16px input rule, fixed overlays) need a
  real phone.
- **Anything requiring a member's actual conversation.** The Companion walks use seeded state; a real
  member's thread is theirs.

## Two traps that have cost real time

1. **A service worker serves stale CSS in dev.** A measured style can be from a build you replaced. Check
   `navigator.serviceWorker.controller` before trusting any local CSS reading; unregister it and clear the
   `g4l-v3` cache if it's set. This has now caught me twice.
2. **A skip is not a pass.** Four times in two days a harness reported success while quietly *not looking* —
   wrong route, wrong wait, checking a signed-out field while signed in. Every walk here now FAILS when an
   element it expects is absent, and any legitimate absence has to be declared `optional` and is printed.
   A harness that passes by not looking is worse than no harness, because it launders a guess into a green tick.

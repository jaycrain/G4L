// WHAT VERSION IS THIS, AND WHICH BUILD?
//
// Added 2026-08-13 for Charter: members are about to start reporting things, and "it looked wrong on my screen"
// is unactionable without knowing what was on their screen. We ship several times a day, so this has to answer
// both questions — which RELEASE (what the product is called) and which BUILD (the exact code that rendered).
//
// APP_VERSION IS THE ONE PLACE. Before this the version existed only in CLAUDE.md prose, a git tag, and whatever
// was typed into `node scripts/build-release-bundle.mjs <version>` by hand. package.json still says 0.0.1 and
// nothing reads it — deliberately left alone rather than adding a second copy to keep in sync.
//
// BUMP THIS AT EVERY PHASE FLIP (.N) or readiness pass (.N.x), in the same commit that flips it. A version string
// that lags the deploy is worse than no version string: it tells a member — and the founder debugging their
// report — something confidently false.
export const APP_VERSION = 'v3.5.72';

/**
 * The exact build. Vercel sets VERCEL_GIT_COMMIT_SHA on every deploy; locally there is none, so it reads "dev".
 *
 * This is the half that actually identifies what someone was looking at. The version alone spans dozens of
 * deploys, which is precisely the window where "we already fixed that" and "no you didn't" both look true.
 */
export function buildRef(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return sha ? sha.slice(0, 7) : 'dev';
}

/** "v3.4 · 0c872f0" — what the footer shows and what a member can read back to us. */
export function versionLabel(): string {
  return `${APP_VERSION} · ${buildRef()}`;
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentMemberId } from './auth.ts';
import { isAdmin } from './authz.ts';
import { onboardingWelcomeEnabled } from '../lib/dashboard/redesign.ts';

export default async function Home() {
  const id = await currentMemberId();
  if (id) redirect(`/dashboard/${id}`);

  // AN OPERATOR IS NOT A COLD VISITOR. Jay opened the app from his phone's home screen, had an ADMIN session
  // but no member session, and got the marketing welcome — "Welcome midlifer, your comeback begins today" —
  // which is exactly the wrong thing to show the person running the program (Jay, 2026-08-01).
  //
  // Checked AFTER the member session on purpose: he wears both hats, and when he's signed in as a member the
  // member dashboard is still the right home. This only catches the case he actually hit.
  if (await isAdmin()) redirect('/admin');
  // ENTRY NARROWING (Jay, 2026-07-29): "/" IS the new-member front door. It used to render its own landing page whose
  // copy ("You're still in there… the hundred reasonable trade-offs…") then repeated almost verbatim in the welcome
  // hero one click later — a double intro. Send a fresh visitor straight to the welcome so there's ONE opening.
  // Returning members go to /login, linked from both the welcome hero and the sign-up gate.
  // If the welcome is flag-off, fall through to the original landing so this is never a dead end.
  if (onboardingWelcomeEnabled()) redirect('/onboarding');

  return (
    <>
      {/* Begin — Onboarding Copy v2 (Jay's voice pass): the opener paints the whole arc (lost identity → the
          doors → what to reclaim → the build). Number-free, de-gendered. */}
      <h1>You’re still in there.</h1>
      <div className="onboard-intro">
        <p>
          The person you were before life got loud — before the job, the obligations, the hundred reasonable
          trade-offs that added up to someone you don’t quite recognize. That person didn’t disappear. They got
          crowded out.
        </p>
        <p>
          Grinta for Life is how you find your way back. Together we’ll name who you’ve drifted from, look at how it
          happened — everyone walks through a Door or two into the Fade — and get clear on who you want to reclaim.
          Then we build the way back.
        </p>
        {/* The endpoint, HINTED but not named (2026-08-10 reframe). "Playbook" is held for the welcome pact, where
            there is room to say what it is — naming it here spends the word before it means anything. All this
            line does is promise the work leaves something behind, which is what makes the arc read as one thing
            rather than a program you attend. */}
        <p>
          It starts with a real conversation. Just you and a companion built for this one thing, and nothing else.
          What you build from there is yours to keep.
        </p>
      </div>
      <p>
        <Link className="btn" href="/onboarding">
          Begin
        </Link>
      </p>
      <p className="muted">
        Already started? <Link href="/login">Log in</Link>.
      </p>
    </>
  );
}

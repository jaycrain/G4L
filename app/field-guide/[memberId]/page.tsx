import { redirect } from 'next/navigation';
import { authorizeMember } from '../../authz.ts';

// The Field Guide is RETIRED (Jay, 2026-08-08): "it's been rendered unnecessary by expanded panels and
// subpages." It was a separate page that operationally defined every panel and term — valuable in early
// versions, when the panels themselves said almost nothing. They say it now, so a second copy of the same
// explanation is a maintenance liability that drifts out of sync with the surface it describes.
//
// Its content did not vanish, it moved to where the thing being explained actually lives:
//   · "The elements of G4L"  → the "More about …" block on each subpage (/score, /grinta, /badges already
//                              had one; /momentum, /movement, /reclaim-list and the Community gained one).
//   · "How G4L works"        → already duplicated by the canon phase summaries on the Program page
//                              (lib/content/summaries.ts), so it retires rather than moves.
//   · "The G4L program explained" → onboarding owns first contact; the Companion answers it thereafter.
//   · "Take the tour →"      → /account, its only remaining re-run entry point.
//
// The route survives as a redirect rather than a 404 because members may hold a bookmark or a history entry.
// Keep it. Deleting the directory is a worse experience for no gain.
//
// It still authorizes first. A redirect leaks no data, but the id in the URL is caller-supplied either way, and
// a [memberId] route that takes it on trust is the shape we don't allow anywhere else (tests/authz-coverage).
export default async function RetiredFieldGuidePage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  redirect(`/dashboard/${memberId}`);
}

import { redirect } from 'next/navigation';
import { isAdmin } from '../../authz.ts';
import ConsoleSubpage from '../console/subpage.tsx';
import FreshPanel from './fresh-panel.tsx';

// /admin/fresh — the one place in the product that can produce someone who just arrived.
//
// Every account we own is saturated, so the surfaces that exist ONLY for a new member — the Threshold
// ceremony, the Opening Tour, the empty ID Score, the empty Grinta reading, every panel's zero state — are
// invisible to us in the place they matter, which is production. On 2026-08-13 that hid a timezone detector
// that had never run once, and shipped two tour stops and two empty states nobody had ever seen.
//
// Deliberately not in the nav: it is a workshop tool, not part of running the program.

export default async function FreshMemberPage() {
  if (!(await isAdmin())) redirect('/admin/login');
  return (
    <ConsoleSubpage title="A brand-new member" here="/admin/fresh" showTitle>
      <div className="card">
        <h3>What this makes</h3>
        <p>
          Someone who has just finished onboarding and done nothing since: an identity, a Door and a Reclaim
          List, and after that — nothing. No ID Score, no Grinta reading, no badges, no Moves, no weeks.
        </p>
        <p>
          Which means the Threshold ceremony and the Opening Tour both still fire for them, and every panel
          shows the state a real new member sees on their first day. Neither can be watched twice on one
          account, so seeing them again means making a new member.
        </p>
        <FreshPanel />
      </div>
    </ConsoleSubpage>
  );
}

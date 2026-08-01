import Link from 'next/link';
import AdminAutoRefresh from '../auto-refresh.tsx';

// THE CHROME EVERY CONSOLE SUBPAGE WEARS.
//
// Jay: "Subpages will be huge for the FC and most likely sub, sub pages." So the depth has to feel like ONE
// surface rather than a scattering of admin URLs — which means every level answers the same two questions
// without being asked: where am I, and how do I get back?
//
// It borrows the member app's pattern rather than inventing one: a crumb up to the parent, a plain title, and
// a peer nav so the sibling sections are one click away instead of one back-and-click. A subpage that can
// only be reached from the console is a subpage Jay will forget exists.

export type Crumb = { label: string; href: string };

/** The console's peer sections. One list, so a new subpage appears in every subpage's nav at once. */
export const CONSOLE_NAV: Crumb[] = [
  { label: 'Members', href: '/admin/members' },
  { label: 'Attention', href: '/admin/attention' },
  { label: 'Activity', href: '/admin/activity' },
  { label: 'Review queue', href: '/admin/review' },
  { label: 'Moderation', href: '/admin/moderation' },
  { label: 'AI surfaces', href: '/admin/health' },
  { label: 'Feedback', href: '/admin/feedback' },
];

export default function ConsoleSubpage({
  title, lede, here, crumbs = [], children,
}: {
  title: string;
  /** One plain line saying what this page is FOR. If it needs more than a line, the page is doing too much. */
  lede?: string;
  /** The href of the current page, so it renders as position rather than as a link to itself. */
  here: string;
  /** Extra crumbs BETWEEN the console and this page — this is what makes sub-sub-pages work. */
  crumbs?: Crumb[];
  children: React.ReactNode;
}) {
  return (
    <div className="fcs">
      <nav className="fcs-crumbs" aria-label="Breadcrumb">
        <Link href="/admin">Founder Console</Link>
        {crumbs.map((c) => (
          <span key={c.href}>
            <span className="fcs-sep" aria-hidden="true">›</span>
            <Link href={c.href}>{c.label}</Link>
          </span>
        ))}
        <span className="fcs-sep" aria-hidden="true">›</span>
        <span className="fcs-now">{title}</span>
      </nav>

      <div className="fcs-head">
        <div className="fcs-title-row">
          <h1>{title}</h1>
          {/* Live here too. A queue you sit and watch — Attention, Review, Moderation — is exactly where a
              stale page misleads most, and it keeps the admin session sliding on whichever page he's parked on. */}
          <AdminAutoRefresh />
        </div>
        {lede && <p className="fcs-lede">{lede}</p>}
      </div>

      <nav className="fcs-nav" aria-label="Console sections">
        {CONSOLE_NAV.map((n) =>
          n.href === here
            ? <span className="fcs-tab on" key={n.href}>{n.label}</span>
            : <Link className="fcs-tab" key={n.href} href={n.href}>{n.label}</Link>,
        )}
      </nav>

      {children}
    </div>
  );
}

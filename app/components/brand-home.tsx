'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// THE LOGO GOES WHERE YOU ACTUALLY LIVE.
//
// It was hard-wired to '/' for everyone, so tapping the wordmark inside the Founder Console threw Jay out into
// the MEMBER app (Jay, 2026-08-01: "The G4L logos when tapped take me to the Member app, should be the FC
// Dashboard"). The logo is the universal home button on every surface — that is exactly why it has to mean
// "home from HERE", not one fixed place.
//
// Operator surfaces (/admin/*) go to the console. Everything else keeps the member behaviour: '/' redirects an
// authed member to their own dashboard.
//
// This also quietly fixes "there's no nav back to the Dashboard" from the console's subpages. They carry a
// crumb, but a crumb is a small target and the logo is the thing people reach for without thinking.

export default function BrandHome({ children, ...rest }: { children: React.ReactNode } & Omit<React.ComponentProps<typeof Link>, 'href' | 'children'>) {
  const pathname = usePathname() ?? '';
  const home = pathname.startsWith('/admin') ? '/admin' : '/';
  return <Link href={home} {...rest}>{children}</Link>;
}

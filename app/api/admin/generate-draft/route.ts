import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getDb } from '../../../../lib/db/index.ts';
import type { Db } from '../../../../lib/db/schema.ts';
import { searchMembers } from '../../../../lib/admin/diagnostic.ts';
import { buildFounderContext } from '../../../../lib/founder/context.ts';
import { generateDraft, MOMENTS, type OperatingMoment } from '../../../../lib/founder/draft.ts';
import { createDraft } from '../../../../lib/founder/store.ts';

// Operator tooling: generate ONE Founder Agent draft on demand into the review queue (the same thing the
// admin member page's "Generate one" button does), callable headlessly for QA. GOVERNANCE: this only ever
// DRAFTS — there is no send here; the human approve/send gate in the console is untouched (CLAUDE.md hard rule).
// Auth: the operator DIAGNOSTIC_READ_TOKEN bearer, and DEFAULT OFF (404 when unset) — same posture as the
// read diagnostic. Reusing that token means it now also authorizes draft creation (draft-only, never send);
// rotate it if that broader power isn't wanted, or split it into its own token later.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function tokenOk(req: Request, secret: string): boolean {
  const got = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const a = Buffer.from(got, 'utf8');
  const b = Buffer.from(secret, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.DIAGNOSTIC_READ_TOKEN;
  if (!secret) return new NextResponse('Not found', { status: 404 });
  if (!tokenOk(req, secret)) return new NextResponse('Unauthorized', { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();
  const moment = (url.searchParams.get('moment')?.trim() || 'post_idq_welcome') as OperatingMoment;
  if (!q) return NextResponse.json({ error: 'pass ?q=<name | email | member_id>' }, { status: 400 });
  if (!(moment in MOMENTS)) return NextResponse.json({ error: `unknown moment; one of ${Object.keys(MOMENTS).join(', ')}` }, { status: 400 });

  const db = (await getDb()) as unknown as Db;
  const matches = await searchMembers(db, q);
  if (matches.length === 0) return NextResponse.json({ query: q, error: 'no member matched' }, { status: 404 });
  const member = matches[0]!;

  const ctx = await buildFounderContext(db, member.memberId);
  if (!ctx) return NextResponse.json({ error: 'could not build founder context for that member' }, { status: 422 });
  const draft = await generateDraft(moment, ctx);
  const id = await createDraft(db, { memberId: member.memberId, moment, draft, inputSnapshot: ctx });

  // Draft-only: it lands in the review queue for the operator to edit/approve/reject. Never sent here.
  return NextResponse.json({ ok: true, draftId: id, member: member.displayName, moment, subject: draft.subject, bodyPreview: draft.body.slice(0, 240) });
}

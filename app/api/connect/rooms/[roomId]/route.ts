// Live-room messages. GET polls for messages since a cursor; POST sends one (crisis-routed +
// rate-limited in postRoomMessage). Auth via the session — a member only acts as themselves.
// Phase 2a uses polling; 2b will add a Supabase Realtime subscription alongside this.
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '../../../../../lib/db/index.ts';
import { currentMemberId } from '../../../../auth.ts';
import { getRoomMessages, postRoomMessage } from '../../../../../lib/connect/rooms.ts';
import type { Db } from '../../../../../lib/db/schema.ts';

export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const memberId = await currentMemberId();
  if (!memberId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { roomId } = await params;
  const after = req.nextUrl.searchParams.get('after');
  const db = (await getDb()) as unknown as Db;
  const messages = await getRoomMessages(db, roomId, memberId, after);
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const memberId = await currentMemberId();
  if (!memberId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { roomId } = await params;
  const payload = (await req.json().catch(() => ({}))) as { body?: string; showName?: boolean };
  const db = (await getDb()) as unknown as Db;
  const res = await postRoomMessage(db, memberId, roomId, String(payload.body ?? ''), Boolean(payload.showName));
  return NextResponse.json(res);
}

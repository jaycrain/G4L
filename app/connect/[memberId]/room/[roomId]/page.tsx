import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../../../lib/db/index.ts';
import { authorizeMember } from '../../../../authz.ts';
import { logEvent } from '../../../../../lib/telemetry/store.ts';
import { getRoom, getRoomMessages } from '../../../../../lib/connect/rooms.ts';
import { getConnectProfile } from '../../../../../lib/connect/store.ts';
import { CRISIS_RESPONSE_US } from '../../../../../lib/agent/governance.ts';
import RoomChat from './room-chat.tsx';
import { closeRoomAction } from '../../../actions.ts';
import type { Db } from '../../../../../lib/db/schema.ts';

export const metadata = { title: 'Live room — Connect' };

export default async function RoomPage({ params }: { params: Promise<{ memberId: string; roomId: string }> }) {
  const { memberId, roomId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  const room = await getRoom(db, roomId);
  if (!room) redirect(`/connect/${memberId}`);
  const [initial, profile, nameRow] = await Promise.all([
    getRoomMessages(db, roomId, memberId),
    getConnectProfile(db, memberId),
    db.query<{ display_name: string }>('select display_name from member_profile where member_id = $1', [memberId]),
  ]);
  await logEvent(db, memberId, 'page_view', { surface: 'connect_room' });

  return (
    <>
      <div className="crumb">
        <Link href={`/connect/${memberId}`} className="back-link">← G4L Community</Link>
      </div>
      <div className="hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ margin: 0 }}>{room.title}</h1>
          {room.createdBy === memberId && room.status === 'open' && (
            <form action={closeRoomAction.bind(null, roomId)}>
              <button type="submit" className="connect-cta" style={{ whiteSpace: 'nowrap' }}>Close room →</button>
            </form>
          )}
        </div>
        <p className="heromore">
          Live{room.status === 'closed' ? ' (closed)' : ''} — say what's true, keep each other honest. Messages here are
          kept and can be reported, the same as everywhere on Connect.
        </p>
      </div>
      <RoomChat
        roomId={roomId}
        initial={initial}
        revealDefault={profile?.revealDefault ?? false}
        myName={nameRow.rows[0]?.display_name ?? 'my real name'}
        handle={profile?.handle ?? null}
        crisisText={CRISIS_RESPONSE_US}
      />
    </>
  );
}

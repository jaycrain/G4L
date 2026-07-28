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
import RedesignChrome from '../../../../dashboard/redesign-chrome.tsx';
import RedesignTopbar from '../../../../dashboard/redesign-topbar.tsx';
import type { Db } from '../../../../../lib/db/schema.ts';

export const metadata = { title: 'Live room — G4L Community' };

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
      <RedesignChrome />
      <RedesignTopbar memberId={memberId} />
      <div className="subpage-wrap">
      {/* Crumb row (outside the navy hero) carries both page-level controls: the one back-nav, and — for the owner of
          an open room — the Close-room action, right-aligned, no arrow (Jay 7/28). */}
      <div className="crumb" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <Link href={`/connect/${memberId}`} className="back-link">← G4L Community</Link>
        {room.createdBy === memberId && room.status === 'open' && (
          <form action={closeRoomAction.bind(null, roomId)}>
            <button type="submit" className="connect-cta" style={{ whiteSpace: 'nowrap' }}>Close room</button>
          </form>
        )}
      </div>
      <div className="hero">
        <h1 style={{ margin: 0 }}>{room.title}</h1>
        <p className="heromore">
          {room.status === 'closed' ? 'This room is closed. ' : ''}Be honest and supportive. Commiserate kindly.
        </p>
      </div>
      <RoomChat
        roomId={roomId}
        memberId={memberId}
        initial={initial}
        revealDefault={profile?.revealDefault ?? false}
        myName={nameRow.rows[0]?.display_name ?? 'my real name'}
        handle={profile?.handle ?? null}
        crisisText={CRISIS_RESPONSE_US}
      />
      </div>
    </>
  );
}

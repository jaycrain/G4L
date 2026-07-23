'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startRebuildAction, rebuildTurnAction, rebuildCeremonyDataAction, loadRebuildSessionAction, type RebuildSession } from './actions.ts';
import RebuildCeremony from './rebuild-ceremony.tsx';
import ScaleChips from '../components/scale-chips.tsx';
import { useChatAutoscroll } from '../components/use-chat-autoscroll.ts';
import { notifyArtifactCommitted, notifySessionComplete } from '../components/artifact-refresh.ts';
import type { RebuildCeremonyData } from '../../lib/ceremony/rebuild-ceremony-beats.ts';
import type { ConvMessage, ConvState, ScaleExpectation } from '../../lib/agent/onboarding.ts';
import { BEAT_SEP } from '../../lib/agent/onboarding.ts';

// A turn may hand over more than one beat (a frame + the next item), joined by BEAT_SEP — render each as its OWN
// bubble. Reuses the onboarding/reconnect chat classes so it looks native.
const agentBubbles = (text: string): ConvMessage[] =>
  text.split(BEAT_SEP).map((t) => t.trim()).filter(Boolean).map((t) => ({ role: 'agent' as const, text: t }));

// W-21 — the conversational hand-home on completion (no more dead-end). B3 · the Lifestyle Pilot routes into the pilot
// WEEK (name it, send home to where the pilot's active + calls log); B1/B2 hand back to the companion-home generically.
// Copy: Cowork Copy Pack v0.2.
const REBUILD_HAND_HOME = "Head back whenever you’re ready — I’m right here if you want to keep going.";
const REBUILD_B3_HAND_HOME = "Your plan’s set. This week we live it — I’ll check in as you go.";

// v2.4 Rebuild chat — B1 (What is Your Why?). Mirrors the Rewire/Reconnect chat, minus the ceremony: B1 is an
// administered instrument that closes on a forward-looking reflection (no reveal overlay). State is held client-side.
export default function RebuildChat({ memberId, session = 'b1' }: { memberId: string; session?: RebuildSession }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [state, setState] = useState<ConvState | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [expects, setExpects] = useState<ScaleExpectation | null>(null); // W-24: administered turn → render the scale chips
  const [ceremony, setCeremony] = useState<RebuildCeremonyData | null>(null); // B4: set when the checkpoint reaches 'ceremony'
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const chatRef = useChatAutoscroll([messages.length, pending, expects, done]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      setPending(true);
      // Resume an in-flight session first (a refresh mid-session no longer restarts it); start fresh only if none saved.
      const resumed = await loadRebuildSessionAction(memberId, session);
      if (resumed.ok && resumed.session && resumed.session.messages.length > 0) {
        setMessages(resumed.session.messages);
        setState(resumed.session.state);
        setExpects(resumed.session.expects ?? null);
        setPending(false);
        return;
      }
      const r = await startRebuildAction(memberId, session);
      setPending(false);
      if (!r.ok || !r.reply || !r.state) return setError(r.error ?? 'Could not start Rebuild.');
      setMessages(agentBubbles(r.reply));
      setState(r.state);
      setExpects(r.expects ?? null);
    })();
  }, [memberId, session]);

  async function submit(text: string) {
    if (!text || !state || pending || done) return;
    const history = messages;
    setMessages((m) => [...m, { role: 'member', text }]);
    setInput('');
    // Leave the chips mounted while the turn is in flight: ScaleChips fills the picked chip teal and locks the row
    // (disabled={pending}) — the member sees their answer register. The reply swaps in the next item's scale (or null).
    setPending(true);
    const r = await rebuildTurnAction(memberId, state, history, text, session);
    setPending(false);
    if (!r.ok || !r.reply || !r.state) {
      setExpects(null); // unlock — an error shouldn't leave a dead, locked scale row
      return setError(r.error ?? 'Something went wrong.');
    }
    setState(r.state);
    setExpects(r.expects ?? null);
    notifyArtifactCommitted(); // push the workspace canvas to re-read now
    if (r.state.stage === 'complete') {
      // W-21 — hand the member home in the companion's voice, then show the CTA (B3 → the pilot week; else → home).
      const handHome = session === 'b3' ? REBUILD_B3_HAND_HOME : REBUILD_HAND_HOME;
      const badgeBeat = r.earnedBadge ? [{ role: 'agent' as const, text: `That’s a badge earned: “${r.earnedBadge.name}.” It’s in your collection now.` }] : [];
      setMessages((m) => [...m, ...agentBubbles(r.reply!), ...badgeBeat, { role: 'agent', text: handHome }]);
      setDone(true); // an administered/coach session done — its artifact is stored
      notifySessionComplete(); // → the workspace shows the "here's what you built" card before the hand-home
    } else {
      setMessages((m) => [...m, ...agentBubbles(r.reply!)]);
    }
    // B4 — the checkpoint reached the ceremony: load the reveal data and fire the full-screen overlay.
    if (r.state.stage === 'ceremony') {
      const c = await rebuildCeremonyDataAction(memberId);
      if (c.ok && c.data) setCeremony(c.data);
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    void submit(input.trim());
  }

  // B4 — once the checkpoint reaches the ceremony, the overlay takes over the whole surface.
  if (ceremony) return <RebuildCeremony memberId={memberId} data={ceremony} />;

  return (
    <div className="reconnect-chat">
      <div className="chat" ref={chatRef}>
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.text}
          </div>
        ))}
        {pending && <div className="typing">Thinking…</div>}
        {/* chips scroll WITH the thread (Jay's walk: not pinned) — they answer the question above, autosend. */}
        {!done && expects && <ScaleChips expects={expects} disabled={pending || !state} onPick={(n) => void submit(String(n))} />}
      </div>
      {error && <p className="error">{error}</p>}
      {!done && (
        <>
          {/* The text box is hidden on an administered turn (the chips render inline in the thread above); it returns
              on conversational turns. */}
          {!expects && (
            <form className="chat-input" onSubmit={send}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void submit(input.trim());
                  }
                }}
                placeholder="Type your reply here…"
                rows={2}
                disabled={pending || !state}
              />
              <button type="submit" disabled={pending || !state || !input.trim()}>
                Send
              </button>
            </form>
          )}
        </>
      )}
      {/* W-21 — the hand-home CTA: B3 routes into the pilot week (active on the dashboard); B1/B2 hand back home. */}
      {done && (
        <div className="chat-continue">
          <button type="button" onClick={() => { router.refresh(); router.push(`/dashboard/${memberId}`); }}>
            {session === 'b3' ? 'Start the week →' : 'Continue →'}
          </button>
        </div>
      )}
    </div>
  );
}

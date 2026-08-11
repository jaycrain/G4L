'use client';

import { useEffect, useRef, useState } from 'react';
import RichText from '../rich-text.tsx';
import { startReconnectAction, reconnectTurnAction, reconnectCeremonyDataAction, loadReconnectSessionAction } from './actions.ts';
import ScaleChips from '../components/scale-chips.tsx';
import { useChatAutoscroll } from '../components/use-chat-autoscroll.ts';
import { notifyArtifactCommitted } from '../components/artifact-refresh.ts';
import type { ConvMessage, ConvState, Expectation } from '../../lib/agent/onboarding.ts';
import { BEAT_SEP } from '../../lib/agent/reconnect.ts';
import { DOORS } from '../../lib/doors.ts';

// A turn may hand over more than one beat (score-read close + drift ask), joined by BEAT_SEP — render each as its
// OWN bubble, one job each, never a single crammed bubble.
const agentBubbles = (text: string): ConvMessage[] =>
  text.split(BEAT_SEP).map((t) => t.trim()).filter(Boolean).map((t) => ({ role: 'agent' as const, text: t }));
import ReconnectCeremony from './reconnect-ceremony.tsx';
import type { ReconnectCeremonyData } from '../../lib/ceremony/reconnect-ceremony-beats.ts';

const doorName = (slug?: string) => DOORS.find((d) => d.slug === slug)?.displayName ?? null;

// v2.2 Reconnect SKELETON chat — minimal on purpose. Shows the callback (§2a) and lets the member reply once to
// reach the Doors stub. State is held client-side for the walk (the session store + live model turn arrive with
// §2b). Reuses the onboarding chat's classes so it looks native.
export default function ReconnectChat({
  memberId,
  mobile = false,
  onStage,
}: {
  memberId: string;
  mobile?: boolean;
  /** REPORT-ONLY. Fires when the arc's beat changes, so the workspace header can show the Science Check for where
   *  the member actually IS (Greg wrote three for this one session). Deliberately a pure notification — it reads
   *  state and changes nothing about the turn, because this is the live capture loop and it does not get logic
   *  added to it for a header's benefit. */
  onStage?: (stage: string | null) => void;
}) {
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [state, setState] = useState<ConvState | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [expects, setExpects] = useState<Expectation | null>(null); // W-24: administered turn (IDQ / §2e grit) → render the scale chips
  const [error, setError] = useState<string | null>(null);
  const [ceremony, setCeremony] = useState<ReconnectCeremonyData | null>(null); // §2f: set when the arc reaches 'ceremony'
  // Tell the shell which beat we're on. Report-only; see the prop's note.
  useEffect(() => { onStage?.(state?.stage ?? null); }, [state?.stage, onStage]);
  const started = useRef(false);
  const chatRef = useChatAutoscroll([messages.length, pending, expects]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      setPending(true);
      // W-15 — resume an in-flight session first (a refresh/crash mid-excavation no longer loses the work); only start
      // fresh when there's nothing saved.
      const resumed = await loadReconnectSessionAction(memberId);
      if (resumed.ok && resumed.session && resumed.session.messages.length > 0) {
        setMessages(resumed.session.messages);
        setState(resumed.session.state);
        setExpects(resumed.session.expects ?? null);
        setPending(false);
        return;
      }
      const r = await startReconnectAction(memberId);
      setPending(false);
      if (!r.ok || !r.reply || !r.state) return setError(r.error ?? 'Could not start Reconnect.');
      setMessages(agentBubbles(r.reply));
      setState(r.state);
      setExpects(r.expects ?? null);
    })();
  }, [memberId]);

  async function submit(text: string) {
    if (!text || !state || pending) return;
    const history = messages;
    setMessages((m) => [...m, { role: 'member', text }]);
    setInput('');
    setPending(true);
    const r = await reconnectTurnAction(memberId, state, history, text);
    setPending(false);
    if (!r.ok || !r.reply || !r.state) {
      setExpects(null);
      return setError(r.error ?? 'Something went wrong.');
    }
    setMessages((m) => [...m, ...agentBubbles(r.reply!)]);
    setState(r.state);
    setExpects(r.expects ?? null);
    notifyArtifactCommitted(); // push the workspace canvas to re-read now (identity/doors/list land on the left)
    // §2f — the arc reached the Ceremony: load the reveal data and fire the full-screen overlay.
    if (r.state.stage === 'ceremony') {
      const c = await reconnectCeremonyDataAction(memberId);
      if (c.ok && c.data) setCeremony(c.data);
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    void submit(input.trim());
  }

  // Show ALL the Doors the member named — not just the primary (they rarely came through one, Jay + Greg).
  const doorList = (state?.collected.doors ?? []).map((s) => doorName(s)).filter(Boolean) as string[];
  const lastReseen = state?.reseeingTells?.[state.reseeingTells.length - 1];

  // §2f — once the arc reaches the Ceremony, the overlay takes over the whole surface.
  if (ceremony) return <ReconnectCeremony memberId={memberId} data={ceremony} mobile={mobile} />;

  return (
    <div className="reconnect-chat">
      {doorList.length > 0 && (
        <div className="reconnect-doorbar" style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--navy, #374F63)' }}>
          Your Door{doorList.length > 1 ? 's' : ''}: <strong>{doorList.join(' · ')}</strong>
          {/* A revision is one of two different things, and this chip said only one of them. A CORRECT carries a
              from→to pair ("that was really a different Door"). An ADD carries only a `to` — nothing was replaced,
              the Session simply surfaced one more. The chip assumed a `from` always existed, so on an add it
              rendered "✓ re-seen from" and then stopped, because doorName(undefined) is null (Jay, 2026-08-11:
              "What does 're-seen from' mean?" — on his walk it meant nothing; it was a sentence cut in half).
              Each case now says its own true thing, and names the Door so the chip stands alone. */}
          {lastReseen &&
            (doorName(lastReseen.fromSlug) ? (
              <span style={{ color: 'var(--teal, #3B9495)', marginLeft: '0.5rem' }}>
                ✓ re-seen from {doorName(lastReseen.fromSlug)}
              </span>
            ) : (
              <span style={{ color: 'var(--teal, #3B9495)', marginLeft: '0.5rem' }}>
                ✓ {doorName(lastReseen.toSlug)} surfaced here
              </span>
            ))}
        </div>
      )}
      <div className="chat" ref={chatRef}>
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.role === 'agent' ? <RichText text={m.text} /> : m.text}
          </div>
        ))}
        {pending && <div className="typing">Thinking…</div>}
        {/* W-32 chips scroll WITH the thread (Jay's walk: not pinned to the bottom) — they answer the question above, autosend. */}
        {expects?.kind === 'scale' && <ScaleChips expects={expects} disabled={pending || !state} onPick={(n) => void submit(String(n))} />}
      </div>
      {error && <p className="error">{error}</p>}
      {/* The text box is hidden on an administered turn (the chips above ARE the input); it returns on conversational turns. */}
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
    </div>
  );
}

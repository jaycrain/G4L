'use client';

// A tiny client-side signal so a session's chat client can tell the workspace canvas "a turn just committed — re-read
// the artifact now." Decoupled on purpose: the chat clients are shared with standalone pages where there's no canvas
// listening, so a fire-and-forget window event is cheaper than threading a callback prop through every client.
export const ARTIFACT_REFRESH_EVENT = 'g4l:artifact-refresh';

export function notifyArtifactCommitted() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ARTIFACT_REFRESH_EVENT));
}

// Fired when a session's conversation reaches its close (stage === 'complete') — the workspace shows the "here's what
// you built" summary card before the hand-home. Fire-and-forget like the refresh event; standalone pages ignore it.
export const SESSION_COMPLETE_EVENT = 'g4l:session-complete';

export function notifySessionComplete() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_COMPLETE_EVENT));
}

'use client';

// A tiny client-side signal so a session's chat client can tell the workspace canvas "a turn just committed — re-read
// the artifact now." Decoupled on purpose: the chat clients are shared with standalone pages where there's no canvas
// listening, so a fire-and-forget window event is cheaper than threading a callback prop through every client.
export const ARTIFACT_REFRESH_EVENT = 'g4l:artifact-refresh';

export function notifyArtifactCommitted() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ARTIFACT_REFRESH_EVENT));
}

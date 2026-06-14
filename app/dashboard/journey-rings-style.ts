// Pure ring-styling for the Journey rings (kept framework-free so it's unit-testable). A FINISHED R
// stays darkened (full opacity), reinforcing completion; the current R is darkened and a touch thicker
// (you're here); an R still ahead sits dimmed.

export type RingState = 'done' | 'current' | 'ahead';

export function ringStyle(state: RingState): { opacity: number; strokeWidth: number } {
  if (state === 'current') return { opacity: 1, strokeWidth: 8 };
  if (state === 'done') return { opacity: 1, strokeWidth: 6 };
  return { opacity: 0.25, strokeWidth: 6 };
}

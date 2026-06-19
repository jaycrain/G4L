'use client';

// The companion context lives in its OWN module — so leaf client components (the hero, the top-bar
// control) import the hook from here, never from the dock component module. Importing a hook out of a
// component file creates a client↔client module cycle that webpack resolves to undefined at runtime
// ("Cannot read properties of undefined (reading 'call')"). A neutral context module avoids it.
import { createContext, useContext } from 'react';

export type CompanionApi = { open: () => void; showBadge: boolean };
export const CompanionCtx = createContext<CompanionApi | null>(null);

/** Openers (the hero CTA, the top-bar Companion control, a panel's "talk to me about this") use this. */
export function useCompanion() {
  return useContext(CompanionCtx);
}

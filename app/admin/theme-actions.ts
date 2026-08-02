'use server';

import { revalidatePath } from 'next/cache';
import { isAdmin } from '../authz.ts';
import { getDb } from '../../lib/db/index.ts';
import { setConsoleTheme, type ConsoleTheme } from '../../lib/founder/state.ts';

/** Flip the console's ground. Revalidates the whole /admin tree so every subpage follows in one go. */
export async function setConsoleThemeAction(theme: ConsoleTheme): Promise<void> {
  if (!(await isAdmin())) return;
  await setConsoleTheme(await getDb(), theme === 'light' ? 'light' : 'dark');
  revalidatePath('/admin', 'layout');
}

'use server';

import { adminLogin } from '../../authz.ts';

export async function adminLoginAction(password: string): Promise<{ ok: boolean }> {
  return { ok: await adminLogin(password) };
}

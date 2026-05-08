'use server';

import { redirect } from 'next/navigation';
import { setAdminCookie } from '@/lib/admin-auth';

export async function submitAdminSecret(formData: FormData) {
  const value = formData.get('secret');
  if (typeof value !== 'string') return { ok: false as const, error: 'Missing secret' };
  const ok = await setAdminCookie(value);
  if (!ok) return { ok: false as const, error: 'Wrong secret' };
  redirect('/upload');
}

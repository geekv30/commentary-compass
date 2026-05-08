import 'server-only';
import { cookies } from 'next/headers';

const ADMIN_COOKIE = 'cc_admin';

export async function isAdmin(): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === secret;
}

export async function setAdminCookie(value: string): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || value !== secret) return false;
  const jar = await cookies();
  jar.set({
    name: ADMIN_COOKIE,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return true;
}

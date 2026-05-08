import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let serviceClient: SupabaseClient | null = null;

export function getSupabaseService(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (server-side)'
    );
  }
  serviceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}

export const PANELS_BUCKET = 'panels';

export async function uploadPanelImage(
  path: string,
  bytes: Buffer,
  mimeType: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = getSupabaseService();
  const { error } = await sb.storage
    .from(PANELS_BUCKET)
    .upload(path, bytes, {
      contentType: mimeType,
      upsert: false,
    });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

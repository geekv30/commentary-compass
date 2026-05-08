import 'server-only';
import { parse as parseHtml } from 'node-html-parser';
import { z } from 'zod';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const ALLOWED_IMAGE_HOSTS = ['pbs.twimg.com', 'abs.twimg.com'];

export type FetchError =
  | { kind: 'invalid_post_url'; message: string }
  | { kind: 'host_blocked'; message: string }
  | { kind: 'og_image_missing'; message: string }
  | { kind: 'invalid_image_host'; message: string }
  | { kind: 'image_404'; message: string }
  | { kind: 'timeout'; message: string }
  | { kind: 'unknown'; message: string };

export type FetchSuccess = {
  ok: true;
  bytes: Buffer;
  mimeType: string;
  imageUrl: string;
};

export type FetchResult = FetchSuccess | { ok: false; error: FetchError };

const PostUrlSchema = z
  .string()
  .url()
  .refine(
    (u) => /^https:\/\/(?:www\.|mobile\.)?(?:twitter|x)\.com\//.test(u),
    { message: 'Must be a twitter.com or x.com URL' }
  );

const ImageUrlSchema = z
  .string()
  .url()
  .refine(
    (u) => {
      try {
        const host = new URL(u).hostname;
        return ALLOWED_IMAGE_HOSTS.some(
          (allowed) => host === allowed || host.endsWith('.' + allowed)
        );
      } catch {
        return false;
      }
    },
    { message: 'Image must be hosted on twimg' }
  );

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function withRetries<T>(
  attempt: () => Promise<T>,
  attempts = 3
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await attempt();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        const delayMs = 300 * Math.pow(3, i);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
}

function extractOgImage(html: string): string | null {
  const root = parseHtml(html);
  const meta = root.querySelector('meta[property="og:image"]');
  const value = meta?.getAttribute('content');
  return value && value.length > 0 ? value : null;
}

function mimeFromContentType(ct: string | null): string {
  if (!ct) return 'image/jpeg';
  return ct.split(';')[0].trim() || 'image/jpeg';
}

export async function fetchPanelFromUrl(rawUrl: string): Promise<FetchResult> {
  const parsedUrl = PostUrlSchema.safeParse(rawUrl);
  if (!parsedUrl.success) {
    return {
      ok: false,
      error: { kind: 'invalid_post_url', message: parsedUrl.error.message },
    };
  }

  let html: string;
  try {
    html = await withRetries(async () => {
      const res = await fetchWithTimeout(
        parsedUrl.data,
        {
          headers: {
            'user-agent': BROWSER_UA,
            accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'accept-language': 'en-US,en;q=0.9',
          },
          redirect: 'follow',
        },
        8000
      );
      if (res.status === 401 || res.status === 403) {
        throw new Error(`host_blocked:${res.status}`);
      }
      if (!res.ok) throw new Error(`fetch_failed:${res.status}`);
      return await res.text();
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith('host_blocked')) {
      return {
        ok: false,
        error: { kind: 'host_blocked', message: msg },
      };
    }
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        ok: false,
        error: { kind: 'timeout', message: 'HTML fetch timed out' },
      };
    }
    return { ok: false, error: { kind: 'unknown', message: msg } };
  }

  const ogImage = extractOgImage(html);
  if (!ogImage) {
    return {
      ok: false,
      error: {
        kind: 'og_image_missing',
        message: 'No og:image meta tag in the post',
      },
    };
  }

  const validatedImage = ImageUrlSchema.safeParse(ogImage);
  if (!validatedImage.success) {
    return {
      ok: false,
      error: {
        kind: 'invalid_image_host',
        message: `Image not on a known X host: ${ogImage}`,
      },
    };
  }

  let imageBytes: Buffer;
  let mimeType: string;
  try {
    const result = await withRetries(async () => {
      const res = await fetchWithTimeout(
        validatedImage.data,
        {
          headers: { 'user-agent': BROWSER_UA },
          redirect: 'follow',
        },
        8000
      );
      if (res.status === 404) throw new Error('image_404');
      if (!res.ok) throw new Error(`image_fetch_failed:${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const ct = mimeFromContentType(res.headers.get('content-type'));
      return { buf, ct };
    });
    imageBytes = result.buf;
    mimeType = result.ct;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'image_404') {
      return {
        ok: false,
        error: { kind: 'image_404', message: 'Image returned 404' },
      };
    }
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        ok: false,
        error: { kind: 'timeout', message: 'Image fetch timed out' },
      };
    }
    return { ok: false, error: { kind: 'unknown', message: msg } };
  }

  return {
    ok: true,
    bytes: imageBytes,
    mimeType,
    imageUrl: validatedImage.data,
  };
}

export function fetchErrorMessage(error: FetchError): string {
  switch (error.kind) {
    case 'invalid_post_url':
      return 'That URL doesn\'t look like an X post — paste a twitter.com or x.com link.';
    case 'host_blocked':
      return 'X blocked our fetch. Please save the image and upload it instead.';
    case 'og_image_missing':
      return 'Couldn\'t find an image in that post. It may have been deleted.';
    case 'invalid_image_host':
      return 'The post\'s image isn\'t hosted on X — please upload it manually.';
    case 'image_404':
      return 'The image is no longer available. Please upload it manually.';
    case 'timeout':
      return 'The fetch took too long. Please try again or upload the image directly.';
    case 'unknown':
      return 'Something went wrong fetching from X. Please upload the image instead.';
  }
}

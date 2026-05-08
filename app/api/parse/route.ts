import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ulid } from 'ulid';
import { eq, and } from 'drizzle-orm';
import { db, match, panelAnnouncement, panelEntry } from '@/db';
import { parsePanel } from '@/lib/parse';
import {
  fetchPanelFromUrl,
  fetchErrorMessage,
  type FetchError,
} from '@/lib/fetchPanelFromUrl';
import { uploadPanelImage } from '@/lib/supabase';
import { isAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

const InputSchema = z.union([
  z.object({ kind: z.literal('file'), file: z.instanceof(File) }),
  z.object({ kind: z.literal('url'), url: z.string().min(1) }),
]);

type ApiResult =
  | { ok: true; matchId: string; panelsStored: number }
  | { ok: false; error: string; fallbackToFile?: boolean };

export async function POST(request: Request): Promise<NextResponse<ApiResult>> {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, error: 'Not authorized' },
      { status: 401 }
    );
  }

  const form = await request.formData();
  const file = form.get('image');
  const url = form.get('source_url');

  let parsedInput;
  if (file instanceof File && file.size > 0) {
    parsedInput = InputSchema.parse({ kind: 'file', file });
  } else if (typeof url === 'string' && url.trim().length > 0) {
    parsedInput = InputSchema.parse({ kind: 'url', url: url.trim() });
  } else {
    return NextResponse.json(
      { ok: false, error: 'Provide either an image or a source URL' },
      { status: 400 }
    );
  }

  let bytes: Buffer;
  let mimeType: string;
  let sourceUrl: string | null = null;
  let source: 'manual-upload' | 'manual-url-paste';

  if (parsedInput.kind === 'file') {
    const ab = await parsedInput.file.arrayBuffer();
    bytes = Buffer.from(ab);
    mimeType = parsedInput.file.type || 'image/jpeg';
    source = 'manual-upload';
  } else {
    const fetched = await fetchPanelFromUrl(parsedInput.url);
    if (!fetched.ok) {
      const fetchErr: FetchError = fetched.error;
      return NextResponse.json(
        {
          ok: false,
          error: fetchErrorMessage(fetchErr),
          fallbackToFile:
            fetchErr.kind !== 'invalid_post_url' &&
            fetchErr.kind !== 'invalid_image_host',
        },
        { status: 400 }
      );
    }
    bytes = fetched.bytes;
    mimeType = fetched.mimeType;
    sourceUrl = parsedInput.url;
    source = 'manual-url-paste';
  }

  const result = await parsePanel(bytes, mimeType);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 422 }
    );
  }

  const status = result.data.confidence >= 0.85 ? 'confirmed' : 'unverified';

  const today = new Date().toISOString().slice(0, 10);
  const homeTeam = result.data.match.home_team ?? 'Unknown';
  const awayTeam = result.data.match.away_team ?? 'Unknown';

  let matchId: string;
  const existingMatch = await db
    .select({ id: match.id })
    .from(match)
    .where(
      and(
        eq(match.date, today),
        eq(match.homeTeam, homeTeam),
        eq(match.awayTeam, awayTeam)
      )
    )
    .limit(1);

  if (existingMatch.length > 0) {
    matchId = existingMatch[0].id;
  } else {
    matchId = ulid();
    await db.insert(match).values({
      id: matchId,
      date: today,
      homeTeam,
      awayTeam,
    });
  }

  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const blobPath = `${today}/${matchId}/${ulid()}.${ext}`;
  const upload = await uploadPanelImage(blobPath, bytes, mimeType);
  if (!upload.ok) {
    return NextResponse.json(
      { ok: false, error: `Storage upload failed: ${upload.error}` },
      { status: 500 }
    );
  }

  let panelsStored = 0;
  for (const panel of result.data.panels) {
    const announcementId = ulid();
    await db
      .insert(panelAnnouncement)
      .values({
        id: announcementId,
        matchId,
        feedId: panel.feed,
        source,
        sourceUrl,
        rawBlobPath: blobPath,
        confidence: result.data.confidence,
        status,
        rawParseJson: result.data,
      })
      .onConflictDoUpdate({
        target: [panelAnnouncement.matchId, panelAnnouncement.feedId],
        set: {
          source,
          sourceUrl,
          rawBlobPath: blobPath,
          confidence: result.data.confidence,
          status,
          rawParseJson: result.data,
          parsedAt: new Date(),
        },
      });

    const finalRow = await db
      .select({ id: panelAnnouncement.id })
      .from(panelAnnouncement)
      .where(
        and(
          eq(panelAnnouncement.matchId, matchId),
          eq(panelAnnouncement.feedId, panel.feed)
        )
      )
      .limit(1);
    const finalId = finalRow[0]?.id ?? announcementId;

    await db
      .delete(panelEntry)
      .where(eq(panelEntry.panelAnnouncementId, finalId));

    if (panel.commentators.length > 0) {
      await db.insert(panelEntry).values(
        panel.commentators.map((name, idx) => ({
          id: ulid(),
          panelAnnouncementId: finalId,
          position: idx,
          nameAsShown: name,
        }))
      );
    }
    panelsStored += 1;
  }

  return NextResponse.json({ ok: true, matchId, panelsStored });
}

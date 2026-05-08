// Smoke test: feed a local panel image to Gemini and print the result.
// Inlined parser (avoids 'server-only' import which throws outside Next.js).
// Run: yarn tsx scratch/test-parse.ts public/test-panels/panel-01.jpg
import { config } from 'dotenv';
config({ path: '.env.local' });

import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import { isFavorite } from '../lib/favorites';

const FEED_IDS = ['english', 'star-sports-hindi', 'jiohotstar-hindi-championswaali'] as const;

const PanelParseSchema = z.object({
  match: z.object({
    home_team: z.string().nullable(),
    away_team: z.string().nullable(),
    date_hint: z.string().nullable(),
  }),
  panels: z.array(z.object({
    feed: z.enum(FEED_IDS),
    commentators: z.array(z.string().min(1)),
  })).min(1),
  confidence: z.number().min(0).max(1),
});

const SYSTEM_INSTRUCTION = `You read IPL 2026 commentary panel announcement graphics from broadcasters (JioHotstar, Star Sports). Identify which audio feed each commentator is on. The three feeds are:
- "english"
- "star-sports-hindi"
- "jiohotstar-hindi-championswaali"

Rules:
- Group commentators by feed exactly as the graphic shows them.
- If a name is unclear, OMIT it. Never guess.
- If the feed identity is ambiguous, lower the confidence score.
- Return JSON matching the provided schema.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: ['match', 'panels', 'confidence'],
  properties: {
    match: {
      type: Type.OBJECT,
      required: ['home_team', 'away_team', 'date_hint'],
      properties: {
        home_team: { type: Type.STRING, nullable: true },
        away_team: { type: Type.STRING, nullable: true },
        date_hint: { type: Type.STRING, nullable: true },
      },
    },
    panels: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['feed', 'commentators'],
        properties: {
          feed: { type: Type.STRING, enum: [...FEED_IDS] },
          commentators: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    },
    confidence: { type: Type.NUMBER },
  },
};

async function parsePanel(bytes: Buffer, mime: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: mime, data: bytes.toString('base64') } },
        { text: 'Parse this commentary panel announcement.' },
      ],
    }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
    },
  });
  const text = response.text;
  if (!text) return { ok: false as const, error: 'empty response' };
  let json: unknown;
  try { json = JSON.parse(text); } catch { return { ok: false as const, error: 'invalid JSON', raw: text }; }
  const parsed = PanelParseSchema.safeParse(json);
  if (!parsed.success) return { ok: false as const, error: parsed.error.message, raw: json };
  return { ok: true as const, data: parsed.data };
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: tsx scratch/test-parse.ts <image path>');
    process.exit(1);
  }
  const bytes = readFileSync(path);
  const ext = extname(path).slice(1).toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  console.log(`→ Parsing ${path} (${(bytes.byteLength / 1024).toFixed(0)} KB, ${mime})…`);
  const start = Date.now();
  const result = await parsePanel(bytes, mime);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nElapsed: ${elapsed}s`);
  console.log(JSON.stringify(result, null, 2));
  if (result.ok) {
    const allHits: string[] = [];
    for (const panel of result.data.panels) {
      const hits = panel.commentators.filter(isFavorite);
      if (hits.length > 0) allHits.push(`${panel.feed}: ${hits.join(', ')}`);
    }
    console.log(`\n--- Favorite hits ---`);
    console.log(allHits.length === 0 ? '  (none on this panel)' : allHits.join('\n'));
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

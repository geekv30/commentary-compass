import 'server-only';
import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';

export const FEED_IDS = [
  'english',
  'star-sports-hindi',
  'jiohotstar-hindi-championswaali',
] as const;

export const PanelParseSchema = z.object({
  match: z.object({
    home_team: z.string().nullable(),
    away_team: z.string().nullable(),
    date_hint: z.string().nullable(),
  }),
  panels: z
    .array(
      z.object({
        feed: z.enum(FEED_IDS),
        commentators: z.array(z.string().min(1)),
      })
    )
    .min(1),
  confidence: z.number().min(0).max(1),
});

export type PanelParse = z.infer<typeof PanelParseSchema>;

export type ParseResult =
  | { ok: true; data: PanelParse }
  | { ok: false; error: string };

const SYSTEM_INSTRUCTION = `You read IPL 2026 commentary panel announcement graphics from broadcasters (JioHotstar, Star Sports). Identify which audio feed each commentator is on. The three feeds are:
- "english" (English commentary, Star Sports / JioHotstar English)
- "star-sports-hindi" (Star Sports' traditional Hindi commentary feed)
- "jiohotstar-hindi-championswaali" (JioHotstar's Hindi "Championswaali" feed featuring IPL champions)

Rules:
- Group commentators by feed exactly as the graphic shows them.
- If a name is unclear or partially obscured, OMIT it. Never guess.
- If the feed identity is ambiguous, lower the confidence score.
- Extract team names ONLY if they appear clearly on the graphic; otherwise null.
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
          feed: {
            type: Type.STRING,
            enum: [...FEED_IDS],
          },
          commentators: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      },
    },
    confidence: { type: Type.NUMBER },
  },
};

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required');
  client = new GoogleGenAI({ apiKey });
  return client;
}

export async function parsePanel(
  imageBytes: Buffer,
  mimeType: string
): Promise<ParseResult> {
  const ai = getClient();
  const base64 = imageBytes.toString('base64');

  let raw: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: 'Parse this commentary panel announcement.' },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0,
      },
    });
    raw = response.text;
  } catch (err) {
    return {
      ok: false,
      error: `Gemini call failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!raw) return { ok: false, error: 'Gemini returned an empty response' };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Gemini response was not valid JSON' };
  }

  const parsed = PanelParseSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Gemini response did not match schema: ${parsed.error.message}`,
    };
  }

  return { ok: true, data: parsed.data };
}

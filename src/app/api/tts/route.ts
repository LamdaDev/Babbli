import { synthesize } from "@/lib/server/audio";
import { errorResponse } from "@/lib/server/http";
import { VOICE_DEFS } from "@/lib/server/voices";

/** ElevenCreative TTS with character timestamps — repeat/slow replays, hint audio, native references. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: string; voiceKey?: string; speed?: number } | null;
  const text = body?.text?.trim();
  if (!text || text.length > 600) return Response.json({ error: "text required (≤600 chars)" }, { status: 400 });
  if (!body?.voiceKey || !VOICE_DEFS[body.voiceKey]) return Response.json({ error: "unknown voiceKey" }, { status: 400 });
  try {
    return Response.json(await synthesize({ text, voiceKey: body.voiceKey, speed: body.speed }));
  } catch (e) {
    return errorResponse(e);
  }
}

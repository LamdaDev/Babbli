import { isStaticLine } from "@/lib/engine/staticLines";
import { getScenario } from "@/lib/scenarios";
import { synthesize } from "@/lib/server/audio";
import { errorResponse } from "@/lib/server/http";
import { liveSession } from "@/lib/server/sessions";
import { VOICE_DEFS } from "@/lib/server/voices";

/**
 * Only lines Babbli itself voices, at the speed it voices them: a scene's fixed lines (model phrases,
 * vocabulary, background voices, coach previews), or an NPC's own line in its voice while its scene
 * is being played (Text Mode voicing, replays).
 */
async function isBabbliLine(text: string, voiceKey: string, speed: number, sessionId: unknown) {
  if (isStaticLine(voiceKey, text, speed)) return true;
  if (speed !== 1) return false;
  const session = await liveSession(sessionId);
  return !!session && getScenario(session.scenarioId)?.npc.voiceKey === voiceKey;
}

/** ElevenCreative TTS with character timestamps — repeat/slow replays, hint audio, native references. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: string; voiceKey?: string; speed?: number; sessionId?: string } | null;
  const text = body?.text?.trim();
  if (!text || text.length > 600) return Response.json({ error: "text required (≤600 chars)" }, { status: 400 });
  if (!body?.voiceKey || !VOICE_DEFS[body.voiceKey]) return Response.json({ error: "unknown voiceKey" }, { status: 400 });
  try {
    const speed = typeof body.speed === "number" ? body.speed : 1;
    if (!(await isBabbliLine(text, body.voiceKey, speed, body.sessionId))) {
      console.warn(`[babbli] TTS refused: "${text.slice(0, 80)}" (${body.voiceKey})`);
      return Response.json({ error: "Babbli only voices its own lines" }, { status: 403 });
    }
    return Response.json(await synthesize({ text, voiceKey: body.voiceKey, speed }));
  } catch (e) {
    return errorResponse(e);
  }
}

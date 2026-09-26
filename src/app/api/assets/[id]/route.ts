import { promises as fs } from "node:fs";
import { AUDIO_ASSETS, ensureAsset } from "@/lib/server/audio";
import { audioResponse, errorResponse } from "@/lib/server/http";

/** Ambient loops, SFX and music generated once with ElevenLabs Sound Effects / Eleven Music, then served from disk. */
export async function GET(_req: Request, ctx: RouteContext<"/api/assets/[id]">) {
  const { id } = await ctx.params;
  if (!AUDIO_ASSETS[id]) return new Response("Not found", { status: 404 });
  try {
    const file = await ensureAsset(id);
    return audioResponse(await fs.readFile(file), "audio/mpeg", false);
  } catch (e) {
    return errorResponse(e);
  }
}

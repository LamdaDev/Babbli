import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "@/lib/server/env";
import { audioResponse } from "@/lib/server/http";
import { VOICE_DEFS } from "@/lib/server/voices";

/** The Voice Design preview clip saved when a character voice was generated. */
export async function GET(_req: Request, ctx: RouteContext<"/api/voices/[key]/preview">) {
  const { key } = await ctx.params;
  if (!VOICE_DEFS[key]) return new Response("Not found", { status: 404 });
  try {
    const file = path.join(env.dataDir, "cache", `voice-preview-${key}.mp3`);
    return audioResponse(await fs.readFile(file), "audio/mpeg", false);
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

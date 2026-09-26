import { promises as fs } from "node:fs";
import { ttsAudioPath } from "@/lib/server/audio";
import { audioResponse } from "@/lib/server/http";

export async function GET(_req: Request, ctx: RouteContext<"/api/audio/tts/[key]">) {
  const { key } = await ctx.params;
  if (!/^[a-f0-9]{16}$/.test(key)) return new Response("Not found", { status: 404 });
  try {
    return audioResponse(await fs.readFile(ttsAudioPath(key)));
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

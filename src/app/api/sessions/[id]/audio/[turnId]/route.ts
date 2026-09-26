import { audioResponse, errorResponse } from "@/lib/server/http";
import { loadTurnAudio, saveTurnAudio, validId } from "@/lib/server/sessions";

/** Raw learner audio for one turn (captured with MediaRecorder in the browser). */
export async function PUT(request: Request, ctx: RouteContext<"/api/sessions/[id]/audio/[turnId]">) {
  const { id, turnId } = await ctx.params;
  if (!validId(id) || !validId(turnId)) return Response.json({ error: "Invalid id" }, { status: 400 });
  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length === 0 || bytes.length > 15 * 1024 * 1024) {
    return Response.json({ error: "Bad audio size" }, { status: 400 });
  }
  try {
    await saveTurnAudio(id, turnId, bytes, request.headers.get("content-type") ?? "audio/webm");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function GET(_req: Request, ctx: RouteContext<"/api/sessions/[id]/audio/[turnId]">) {
  const { id, turnId } = await ctx.params;
  if (!validId(id) || !validId(turnId)) return new Response("Not found", { status: 404 });
  const audio = await loadTurnAudio(id, turnId);
  if (!audio) return new Response("Not found", { status: 404 });
  return audioResponse(audio.bytes, audio.mime, false);
}

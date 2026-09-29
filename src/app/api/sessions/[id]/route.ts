import { errorResponse } from "@/lib/server/http";
import { loadSession, saveSession, validId } from "@/lib/server/sessions";
import type { SessionRecord } from "@/lib/session/types";

export async function GET(_req: Request, ctx: RouteContext<"/api/sessions/[id]">) {
  const { id } = await ctx.params;
  if (!validId(id)) return Response.json({ error: "Invalid id" }, { status: 400 });
  const record = await loadSession(id);
  if (!record) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(record);
}

/** Persist scenario state, turns, events and assistance for a session (called after every turn). */
export async function PUT(request: Request, ctx: RouteContext<"/api/sessions/[id]">) {
  const { id } = await ctx.params;
  if (!validId(id)) return Response.json({ error: "Invalid id" }, { status: 400 });
  const record = (await request.json().catch(() => null)) as SessionRecord | null;
  if (!record || record.id !== id || !Array.isArray(record.turns)) {
    return Response.json({ error: "Invalid session payload" }, { status: 400 });
  }
  try {
    const existing = await loadSession(id);
    // Keep analysis fetched server-side if the client's copy doesn't have it yet, and when the
    // session was first seen (server clock: see liveSession).
    await saveSession({ ...record, analysis: record.analysis ?? existing?.analysis, firstSavedAt: existing?.firstSavedAt ?? Date.now() });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

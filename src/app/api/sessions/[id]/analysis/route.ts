import { xiJson } from "@/lib/server/elevenlabs";
import { errorResponse } from "@/lib/server/http";
import { loadSession, saveSession, validId } from "@/lib/server/sessions";
import type { AgentAnalysis } from "@/lib/session/types";

interface ConversationResponse {
  status: string;
  analysis?: {
    call_successful?: string;
    transcript_summary?: string;
    call_summary_title?: string | null;
    evaluation_criteria_results?: Record<
      string,
      { criteria_id: string; result: string; rationale: string; score?: number | null; max_score?: number | null }
    >;
    data_collection_results?: Record<string, { data_collection_id: string; value: unknown; rationale: string }>;
  };
}

/** ElevenAgents post-call analysis (evaluation criteria + data collection) for the session's conversation. */
export async function GET(_req: Request, ctx: RouteContext<"/api/sessions/[id]/analysis">) {
  const { id } = await ctx.params;
  if (!validId(id)) return Response.json({ error: "Invalid id" }, { status: 400 });
  const session = await loadSession(id);
  if (!session) return Response.json({ error: "Not found" }, { status: 404 });
  if (session.analysis?.status === "done") return Response.json(session.analysis);
  if (!session.conversationId) return Response.json({ status: "unavailable", criteria: [], data: {} });
  try {
    const conv = await xiJson<ConversationResponse>(
      `/v1/convai/conversations/${encodeURIComponent(session.conversationId)}`,
    );
    const a = conv.analysis;
    const analysis: AgentAnalysis = {
      status: a && conv.status === "done" ? "done" : conv.status,
      callSuccessful: a?.call_successful,
      summary: a?.transcript_summary,
      title: a?.call_summary_title ?? undefined,
      criteria: Object.entries(a?.evaluation_criteria_results ?? {}).map(([key, c]) => ({
        id: c.criteria_id ?? key,
        result: c.result,
        rationale: c.rationale,
        score: c.score ?? null,
        maxScore: c.max_score ?? null,
      })),
      data: Object.fromEntries(
        Object.entries(a?.data_collection_results ?? {}).map(([key, d]) => [
          d.data_collection_id ?? key,
          { value: d.value, rationale: d.rationale },
        ]),
      ),
      fetchedAt: new Date().toISOString(),
    };
    if (analysis.status === "done") await saveSession({ ...session, analysis });
    return Response.json(analysis);
  } catch (e) {
    return errorResponse(e);
  }
}

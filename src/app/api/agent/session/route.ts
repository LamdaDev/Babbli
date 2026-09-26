import type { NextRequest } from "next/server";
import { toolName } from "@/lib/engine/agentConfig";
import { getScenario } from "@/lib/scenarios";
import { ensureAgent, getSignedUrl } from "@/lib/server/agents";
import { errorResponse } from "@/lib/server/http";

/** Provisions (once) the scenario's ElevenAgents NPC and returns a signed URL for a private session. */
export async function GET(request: NextRequest) {
  const scenario = getScenario(request.nextUrl.searchParams.get("scenario") ?? "");
  if (!scenario) return Response.json({ error: "Unknown scenario" }, { status: 404 });
  try {
    const agent = await ensureAgent(scenario);
    const signedUrl = await getSignedUrl(agent.agentId);
    return Response.json({
      signedUrl,
      agentId: agent.agentId,
      toolName: toolName(scenario),
      llm: agent.llm,
      ttsModel: agent.ttsModel,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

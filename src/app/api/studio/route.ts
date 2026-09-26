import { SCENARIOS, getScenario } from "@/lib/scenarios";
import { agentName, ensureAgent } from "@/lib/server/agents";
import { AUDIO_ASSETS, assetExists, ensureAsset } from "@/lib/server/audio";
import { xiJson } from "@/lib/server/elevenlabs";
import { env } from "@/lib/server/env";
import { errorResponse } from "@/lib/server/http";
import { readRegistry } from "@/lib/server/registry";
import { VOICE_DEFS, ensureVoice } from "@/lib/server/voices";

async function status() {
  const reg = await readRegistry();
  let subscription: { tier: string; used: number; limit: number } | null = null;
  if (env.apiKey) {
    try {
      const s = await xiJson<{ tier: string; character_count: number; character_limit: number }>(
        "/v1/user/subscription",
      );
      subscription = { tier: s.tier, used: s.character_count, limit: s.character_limit };
    } catch {
      /* optional */
    }
  }
  return {
    hasKey: !!env.apiKey,
    config: {
      agentLlm: env.agentLlm,
      analysisLlm: env.analysisLlm,
      agentTtsModel: env.agentTtsModel,
      ttsModel: env.ttsModel,
      sttModel: env.sttModel,
    },
    subscription,
    voices: Object.entries(VOICE_DEFS).map(([key, def]) => ({
      key,
      name: def.name,
      role: def.role,
      language: def.language,
      description: def.description,
      voiceId: reg.voices[key]?.voiceId ?? null,
      designed: reg.voices[key]?.designed ?? false,
      error: reg.voices[key]?.error ?? null,
    })),
    agents: SCENARIOS.map((s) => ({
      scenarioId: s.id,
      title: s.title,
      name: agentName(s),
      agentId: reg.agents[s.id]?.agentId ?? null,
      toolId: reg.tools[s.id]?.toolId ?? null,
      llm: reg.agents[s.id]?.llm ?? null,
      ttsModel: reg.agents[s.id]?.ttsModel ?? null,
      degraded: reg.agents[s.id]?.degraded ?? null,
      updatedAt: reg.agents[s.id]?.updatedAt ?? null,
    })),
    assets: await Promise.all(
      Object.entries(AUDIO_ASSETS).map(async ([id, def]) => ({
        id,
        label: def.label,
        kind: def.kind,
        prompt: def.prompt,
        ready: await assetExists(id),
      })),
    ),
  };
}

export async function GET() {
  try {
    return Response.json(await status());
  } catch (e) {
    return errorResponse(e);
  }
}

/** Provision one resource: { kind: "voice" | "agent" | "asset", id, force? } */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { kind?: string; id?: string; force?: boolean };
  try {
    const scenario = body.id ? getScenario(body.id) : undefined;
    if (body.kind === "voice" && body.id && VOICE_DEFS[body.id]) await ensureVoice(body.id, { force: body.force });
    else if (body.kind === "agent" && scenario) await ensureAgent(scenario, { force: body.force });
    else if (body.kind === "asset" && body.id && AUDIO_ASSETS[body.id]) await ensureAsset(body.id, { force: body.force });
    else return Response.json({ error: "Unknown resource" }, { status: 400 });
    return Response.json(await status());
  } catch (e) {
    return errorResponse(e);
  }
}

import { buildAnalysisConfig, buildNpcPrompt, buildToolConfig, toolName } from "@/lib/engine/agentConfig";
import { seededRandom } from "@/lib/engine/engine";
import type { ScenarioDef } from "@/lib/scenarios/types";
import { env } from "./env";
import { ElevenLabsError, xiJson } from "./elevenlabs";
import { hashOf, once, readRegistry, updateRegistry, type Registry } from "./registry";
import { ensureVoice } from "./voices";

/* ---------------- client tool ---------------- */

export async function ensureTool(scenario: ScenarioDef): Promise<string> {
  const config = buildToolConfig(scenario);
  const hash = hashOf(config);
  const reg = await readRegistry();
  const known = reg.tools[scenario.id] as Registry["tools"][string] | undefined;
  if (known?.hash === hash) return known.toolId;

  return once(`tool:${scenario.id}`, async () => {
    let toolId: string | undefined = known?.toolId;
    if (!toolId) {
      try {
        const list = await xiJson<{ tools: { id: string; tool_config: { name: string } }[] }>("/v1/convai/tools", {
          query: { search: config.name, page_size: 50 },
        });
        toolId = list.tools.find((t) => t.tool_config?.name === config.name)?.id;
      } catch {
        /* best-effort lookup */
      }
    }
    if (toolId) {
      try {
        await xiJson(`/v1/convai/tools/${toolId}`, { method: "PATCH", json: { tool_config: config } });
      } catch (e) {
        if (e instanceof ElevenLabsError && e.status === 404) toolId = undefined;
        else throw e;
      }
    }
    if (!toolId) {
      const created = await xiJson<{ id: string }>("/v1/convai/tools", { method: "POST", json: { tool_config: config } });
      toolId = created.id;
    }
    const id = toolId;
    await updateRegistry((r) => {
      r.tools[scenario.id] = { toolId: id, hash, updatedAt: new Date().toISOString() };
    });
    return id;
  });
}

/* ---------------- agent ---------------- */

export function agentName(scenario: ScenarioDef) {
  return `Babbli · ${scenario.title} (${scenario.languageEnglish})`;
}

const CLIENT_EVENTS = [
  "conversation_initiation_metadata",
  "asr_initiation_metadata",
  "ping",
  "audio",
  "interruption",
  "user_transcript",
  "tentative_user_transcript",
  "agent_response",
  "agent_response_correction",
  "client_tool_call",
  "agent_tool_response",
  "vad_score",
];

const AUDIO_TAGS = [
  { tag: "cheerful", description: "greeting or good news" },
  { tag: "warm", description: "thanking or reassuring" },
  { tag: "apologetic", description: "something is unavailable or went wrong" },
  { tag: "surprised", description: "unexpected reply" },
  { tag: "confused", description: "you didn't understand" },
  { tag: "laughs", description: "light humour" },
];

interface BodyOptions {
  voiceId: string;
  toolId: string;
  llm: string;
  ttsModel: string;
}

function buildAgentBody(scenario: ScenarioDef, o: BodyOptions) {
  const variant = scenario.makeVariant("intermediate", seededRandom(1));
  const analysis = buildAnalysisConfig(scenario);
  const expressive = o.ttsModel.startsWith("eleven_v3");
  const platform: Record<string, unknown> = {
    overrides: {
      conversation_config_override: {
        agent: { first_message: true, language: true, prompt: { prompt: true } },
        tts: { speed: true, voice_id: true, stability: true },
        asr: { keywords: true },
      },
    },
  };
  platform.evaluation = analysis.evaluation;
  platform.data_collection = analysis.data_collection;
  platform.summary_language = "en";
  // Only some LLMs are allowed for post-call analysis; leave ElevenLabs' default unless configured.
  if (env.analysisLlm) platform.analysis_llm = env.analysisLlm;
  return {
    name: agentName(scenario),
    tags: ["babbli", `babbli-${scenario.id}`],
    conversation_config: {
      agent: {
        first_message: scenario.greetings.intermediate[0].text,
        language: scenario.language,
        disable_first_message_interruptions: true,
        prompt: {
          prompt: buildNpcPrompt({ scenario, difficulty: "intermediate", variant }),
          llm: o.llm,
          temperature: 0.7,
          tool_ids: [o.toolId],
          ignore_default_personality: true,
        },
      },
      tts: {
        model_id: o.ttsModel,
        voice_id: o.voiceId,
        stability: 0.45,
        similarity_boost: 0.8,
        speed: 1,
        ...(expressive ? { expressive_mode: true, suggested_audio_tags: AUDIO_TAGS } : {}),
      },
      asr: { quality: "high", user_input_audio_format: "pcm_16000", keywords: scenario.asrKeywords },
      turn: { turn_timeout: 30, turn_eagerness: "patient", mode: "turn" },
      conversation: { max_duration_seconds: 1200, client_events: CLIENT_EVENTS },
    },
    platform_settings: platform,
  };
}

type AgentBody = ReturnType<typeof buildAgentBody>;

const FALLBACK_LLM = "gemini-2.5-flash";
const FALLBACK_TTS = "eleven_flash_v2_5";

/**
 * Repair only what ElevenLabs rejected (e.g. an LLM not allowed for analysis),
 * based on the `loc` of each 422 validation error. Returns a label describing
 * the fix, or null when the error isn't something we know how to fix.
 */
function repairBody(body: AgentBody, error: ElevenLabsError): string | null {
  let details: { loc?: (string | number)[]; msg?: string }[] = [];
  try {
    const parsed = JSON.parse(error.body) as { detail?: unknown };
    if (Array.isArray(parsed.detail)) details = parsed.detail as typeof details;
    else if (parsed.detail) details = [{ msg: JSON.stringify(parsed.detail) }];
  } catch {
    details = [{ msg: error.body }];
  }
  const platform = body.platform_settings as Record<string, unknown>;
  const tts = body.conversation_config.tts as Record<string, unknown>;
  const fixes: string[] = [];
  for (const d of details) {
    const loc = (d.loc ?? []).map(String);
    const where = `${loc.join(".")} ${d.msg ?? ""}`.toLowerCase();
    if (where.includes("analysis_llm") && platform.analysis_llm) {
      delete platform.analysis_llm;
      fixes.push("default analysis LLM");
    } else if (where.includes("summary_language") && platform.summary_language) {
      delete platform.summary_language;
      fixes.push("no summary language");
    } else if (where.includes("evaluation") && platform.evaluation) {
      const ev = platform.evaluation as { criteria: Record<string, unknown>[] };
      platform.evaluation = {
        criteria: ev.criteria.map(({ id, name, conversation_goal_prompt }) => ({ id, name, type: "prompt", conversation_goal_prompt })),
      };
      fixes.push("binary evaluation criteria");
    } else if (where.includes("data_collection") && platform.data_collection) {
      delete platform.data_collection;
      fixes.push("no data collection");
    } else if ((where.includes("expressive_mode") || where.includes("suggested_audio_tags")) && "expressive_mode" in tts) {
      delete tts.expressive_mode;
      delete tts.suggested_audio_tags;
      fixes.push("no audio tags");
    } else if ((where.includes("tts") || where.includes("model_id")) && tts.model_id !== FALLBACK_TTS) {
      tts.model_id = FALLBACK_TTS;
      delete tts.expressive_mode;
      delete tts.suggested_audio_tags;
      fixes.push(`TTS ${FALLBACK_TTS}`);
    } else if (where.includes("llm") && body.conversation_config.agent.prompt.llm !== FALLBACK_LLM) {
      body.conversation_config.agent.prompt.llm = FALLBACK_LLM;
      fixes.push(`LLM ${FALLBACK_LLM}`);
    }
  }
  return fixes.length ? fixes.join(", ") : null;
}

async function findAgentByName(name: string): Promise<string | undefined> {
  try {
    const page = await xiJson<{ agents: { agent_id: string; name: string }[] }>("/v1/convai/agents", {
      query: { search: name, page_size: 30 },
    });
    return page.agents.find((a) => a.name === name)?.agent_id;
  } catch {
    return undefined;
  }
}

export async function ensureAgent(scenario: ScenarioDef, opts: { force?: boolean } = {}) {
  const voiceId = await ensureVoice(scenario.npc.voiceKey);
  const toolId = await ensureTool(scenario);
  const intended = buildAgentBody(scenario, { voiceId, toolId, llm: env.agentLlm, ttsModel: env.agentTtsModel });
  const hash = hashOf(intended);
  const reg = await readRegistry();
  const known = reg.agents[scenario.id] as Registry["agents"][string] | undefined;
  if (known && known.hash === hash && !opts.force) return known;

  return once(`agent:${scenario.id}`, async () => {
    let agentId: string | undefined = known?.agentId ?? (await findAgentByName(agentName(scenario)));
    const body = structuredClone(intended);
    const fixes: string[] = [];
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        if (agentId) {
          try {
            await xiJson(`/v1/convai/agents/${agentId}`, { method: "PATCH", json: body });
          } catch (e) {
            if (e instanceof ElevenLabsError && e.status === 404) agentId = undefined;
            else throw e;
          }
        }
        if (!agentId) {
          const created = await xiJson<{ agent_id: string }>("/v1/convai/agents/create", { method: "POST", json: body });
          agentId = created.agent_id;
        }
        const record = {
          agentId,
          hash,
          voiceId,
          toolId,
          llm: body.conversation_config.agent.prompt.llm,
          ttsModel: body.conversation_config.tts.model_id,
          degraded: fixes.length ? fixes.join("; ") : undefined,
          updatedAt: new Date().toISOString(),
        };
        if (record.degraded) console.warn(`[babbli] agent ${scenario.id}: adjusted for your account → ${record.degraded}`);
        await updateRegistry((r) => {
          r.agents[scenario.id] = record;
        });
        return record;
      } catch (e) {
        const fix = e instanceof ElevenLabsError && [400, 422].includes(e.status) ? repairBody(body, e) : null;
        if (!fix) throw e;
        fixes.push(fix);
      }
    }
    throw new Error(`Could not provision agent ${scenario.id} after several adjustments: ${fixes.join("; ")}`);
  });
}

export async function getSignedUrl(agentId: string) {
  const res = await xiJson<{ signed_url: string }>("/v1/convai/conversation/get-signed-url", {
    query: { agent_id: agentId },
  });
  return res.signed_url;
}

export { toolName };

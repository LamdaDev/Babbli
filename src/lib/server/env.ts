import path from "node:path";

export const env = {
  apiKey: process.env.ELEVENLABS_API_KEY ?? "",
  /** LLM powering the NPC inside ElevenAgents (low latency matters for voice). */
  agentLlm: process.env.BABBLI_AGENT_LLM ?? "claude-haiku-4-5",
  /** LLM for ElevenAgents post-call analysis — empty = ElevenLabs default (only some models are allowed). */
  analysisLlm: process.env.BABBLI_ANALYSIS_LLM ?? "",
  /** Agent voice model — v3 conversational is the most expressive. */
  agentTtsModel: process.env.BABBLI_AGENT_TTS_MODEL ?? "eleven_v3_conversational",
  /** Model for ElevenCreative TTS (repeat/slow replays, hints, native references). */
  ttsModel: process.env.BABBLI_TTS_MODEL ?? "eleven_multilingual_v2",
  sttModel: process.env.BABBLI_STT_MODEL ?? "scribe_v2",
  dataDir: process.env.BABBLI_DATA_DIR ?? path.join(process.cwd(), ".babbli"),
};

export function requireApiKey() {
  if (!env.apiKey) {
    throw new MissingKeyError();
  }
  return env.apiKey;
}

export class MissingKeyError extends Error {
  constructor() {
    super("ELEVENLABS_API_KEY is not set. Add it to .env.local (see .env.example).");
  }
}

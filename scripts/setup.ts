/**
 * One-shot ElevenLabs provisioning for Babbli:
 *   npm run setup
 * Designs every character voice (Voice Design), creates/updates the client tool
 * and NPC agent for each scene (ElevenAgents), generates the ambience, SFX
 * and menu music (Sound Effects + Eleven Music), and voices every fixed line
 * once (Text to Speech). Safe to re-run — everything is cached in
 * .babbli/registry.json, .babbli/assets/ and .babbli/cache/tts/.
 */
import { createInitialState, getStage, normalizeReport, resolveTurn, seededRandom } from "@/lib/engine/engine";
import { COACH_SAMPLES, coachVoiceKey } from "@/lib/profile/profile";
import { SCENARIOS } from "@/lib/scenarios";
import type { Difficulty, ScenarioDef, SceneEventId } from "@/lib/scenarios/types";
import { ensureAgent } from "@/lib/server/agents";
import { AUDIO_ASSETS, assetExists, ensureAsset, synthesize } from "@/lib/server/audio";
import { env } from "@/lib/server/env";
import { readRegistry } from "@/lib/server/registry";
import { VOICE_DEFS, ensureVoice } from "@/lib/server/voices";

type Clip = { text: string; voiceKey: string; speed: number };

/**
 * Every fixed line the app voices with TTS, with exactly the parameters it asks for at runtime (the
 * TTS cache is keyed by text, voice and speed): the model phrase behind every intention card (audio
 * hint and native reference on the results page), the vocabulary list, the background voices and the
 * coach voice preview. The phrases are found by walking each scene the way the simulator does.
 */
function staticClips(scenario: ScenarioDef, coaches: string[]): Clip[] {
  const phrases = new Set<string>();
  const clips: Clip[] = [];
  // Background voices, at the speed GameController.playDeferredEvents plays them.
  const background: Partial<Record<SceneEventId, number>> = { order_placed: 1.05, time_skip: 1 };
  for (const difficulty of ["beginner", "intermediate", "immersion"] as Difficulty[]) {
    for (let seed = 1; seed <= 90; seed++) {
      const rand = seededRandom(seed * 97);
      const variant = scenario.makeVariant(difficulty, seededRandom(seed));
      let state = createInitialState(scenario);
      for (let turn = 0; !state.finished && turn < 60; turn++) {
        const bank = getStage(scenario, state.stageId).cards({ state, variant, difficulty });
        for (const c of bank) phrases.add(c.hints.full);
        const card = bank[Math.floor(rand() * bank.length)];
        const report = normalizeReport(scenario, { intent: card.id, heard: card.hints.full, answered_question: true, language: "target", ...(card.expect ?? {}) });
        const { outcome, state: next } = resolveTurn(scenario, state, report, variant, difficulty, card);
        for (const e of outcome.events ?? []) {
          const speed = background[e];
          const line = speed ? scenario.eventLines[e]?.(next) : undefined;
          if (speed && line) clips.push({ text: line.text, voiceKey: scenario.backgroundVoices[line.voice].voiceKey, speed });
        }
        state = next;
      }
    }
  }
  for (const coach of coaches) {
    for (const p of phrases) clips.push({ text: p, voiceKey: coach, speed: 1 });
    for (const v of scenario.vocabulary) clips.push({ text: v.term.split(" / ")[0], voiceKey: coach, speed: 0.95 });
    clips.push({ text: COACH_SAMPLES[scenario.language], voiceKey: coach, speed: 1 });
  }
  return [...new Map(clips.map((c) => [JSON.stringify(c), c])).values()];
}

/** Voice clips a few at a time; cached ones return straight away. */
async function voiceAll(clips: Clip[], concurrency = 4) {
  const queue = [...clips];
  const errors: string[] = [];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (queue.length) {
        const clip = queue.shift()!;
        await synthesize(clip).catch((e) => errors.push(`${clip.text}: ${e instanceof Error ? e.message : e}`));
      }
    }),
  );
  if (errors.length) throw new Error(`${errors.length} of ${clips.length} failed, e.g. ${errors[0]}`);
}

async function step<T>(label: string, fn: () => Promise<T>) {
  const t0 = Date.now();
  process.stdout.write(`  ${label} … `);
  try {
    const r = await fn();
    console.log(`ok (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    return r;
  } catch (e) {
    console.log(`FAILED\n    ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

async function main() {
  if (!env.apiKey) {
    console.error("ELEVENLABS_API_KEY is not set. Copy .env.example to .env.local and add your key.");
    process.exit(1);
  }
  console.log("\n🎙  Voice Design — character voices");
  for (const [key, def] of Object.entries(VOICE_DEFS)) {
    // force: retry any voice that previously fell back to a premade voice
    await step(def.name, () => ensureVoice(key, { force: true }));
  }

  console.log("\n🤖  ElevenAgents — NPC agents + scenario tools");
  for (const s of SCENARIOS) {
    const rec = await step(s.title, () => ensureAgent(s, { force: process.argv.includes("--force") }));
    if (rec) console.log(`    agent ${rec.agentId} · llm ${rec.llm} · tts ${rec.ttsModel}${rec.degraded ? ` · fallback ${rec.degraded}` : ""}`);
  }

  console.log("\n🔊  Sound Effects & Music — immersion layer");
  for (const [id, def] of Object.entries(AUDIO_ASSETS)) {
    if (await assetExists(id)) {
      console.log(`  ${def.label} … cached`);
      continue;
    }
    await step(def.label, () => ensureAsset(id));
  }

  console.log("\n🗣  Text to Speech — model phrases, vocabulary and background voices (voiced once, cached for good)");
  const reg = await readRegistry();
  for (const s of SCENARIOS) {
    // The alternate coach voice only once it's designed: a fallback voice would cache the wrong audio.
    const alternate = coachVoiceKey(s.language, "alternate");
    const coaches = [coachVoiceKey(s.language, "standard")];
    if (reg.voices[alternate]?.designed || process.env[`BABBLI_VOICE_${alternate.toUpperCase()}`]) coaches.push(alternate);
    const clips = staticClips(s, coaches);
    await step(`${s.title}: ${clips.length} clips, ${coaches.length} coach voice${coaches.length > 1 ? "s" : ""}`, () => voiceAll(clips));
  }
  console.log("\n✅  Done. Start the app with `npm run dev` and open http://localhost:3000\n");
}

void main();

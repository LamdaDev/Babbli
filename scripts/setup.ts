/**
 * One-shot ElevenLabs provisioning for Babbli:
 *   npm run setup
 * Designs every character voice (Voice Design), creates/updates the client tool
 * and NPC agent for each scene (ElevenAgents), generates the ambience, SFX
 * and menu music (Sound Effects + Eleven Music), and voices every fixed line
 * once (Text to Speech). Safe to re-run — everything is cached in
 * .babbli/registry.json, .babbli/assets/ and .babbli/cache/tts/.
 */
import { staticLines, type StaticLine } from "@/lib/engine/staticLines";
import { coachVoiceKey } from "@/lib/profile/profile";
import { SCENARIOS } from "@/lib/scenarios";
import { ensureAgent } from "@/lib/server/agents";
import { AUDIO_ASSETS, assetExists, ensureAsset, synthesize } from "@/lib/server/audio";
import { env } from "@/lib/server/env";
import { readRegistry } from "@/lib/server/registry";
import { VOICE_DEFS, ensureVoice } from "@/lib/server/voices";

/** Voice clips a few at a time; cached ones return straight away. */
async function voiceAll(clips: StaticLine[], concurrency = 4) {
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
    const clips = staticLines(s, coaches);
    await step(`${s.title}: ${clips.length} clips, ${coaches.length} coach voice${coaches.length > 1 ? "s" : ""}`, () => voiceAll(clips));
  }
  console.log("\n✅  Done. Start the app with `npm run dev` and open http://localhost:3000\n");
}

void main();

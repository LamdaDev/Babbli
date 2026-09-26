/**
 * One-shot ElevenLabs provisioning for Babbli:
 *   npm run setup
 * Designs every character voice (Voice Design), creates/updates the client tool
 * and NPC agent for each scene (ElevenAgents), and generates the ambience, SFX
 * and menu music (Sound Effects + Eleven Music). Safe to re-run — everything is
 * cached in .babbli/registry.json and .babbli/assets/.
 */
import { SCENARIOS } from "@/lib/scenarios";
import { ensureAgent } from "@/lib/server/agents";
import { AUDIO_ASSETS, assetExists, ensureAsset } from "@/lib/server/audio";
import { env } from "@/lib/server/env";
import { VOICE_DEFS, ensureVoice } from "@/lib/server/voices";

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
  console.log("\n✅  Done. Start the app with `npm run dev` and open http://localhost:3000\n");
}

void main();

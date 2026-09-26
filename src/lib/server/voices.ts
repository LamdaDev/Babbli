import { promises as fs } from "node:fs";
import path from "node:path";
import { env, requireApiKey } from "./env";
import { ElevenLabsError, xiJson } from "./elevenlabs";
import { once, readRegistry, updateRegistry } from "./registry";

/**
 * Every character voice is designed from a text prompt with ElevenLabs Voice
 * Design (ElevenCreative) — native speakers of each language rather than
 * English stock voices. Premade multilingual voices are only a fallback.
 */
export interface VoiceDef {
  name: string;
  language: "ja" | "fr" | "es";
  role: string;
  description: string;
  sample: string;
  fallback: string;
}

export const VOICE_DEFS: Record<string, VoiceDef> = {
  hiroshi: {
    name: "Babbli · Hiroshi (ramen waiter)",
    language: "ja",
    role: "NPC · Tokyo ramen shop",
    description:
      "A friendly, energetic Japanese man in his mid-40s, the waiter of a small Tokyo ramen shop. Warm, lively, slightly husky voice, native Japanese with a standard Tokyo accent, cheerful service-industry energy.",
    sample:
      "いらっしゃいませ！麺屋ほしへようこそ。今日は寒いですね。醤油ラーメンがおすすめですよ。麺のかたさはどうしますか？普通、かため、やわらかめ、どれでもできますよ。お水はセルフサービスです。何かあったら、いつでも声をかけてくださいね。ごゆっくりどうぞ！",
    fallback: "JBFqnCBsd6RMkjVDRZzb",
  },
  kenji: {
    name: "Babbli · Kenji (ramen chef)",
    language: "ja",
    role: "Background · kitchen callouts",
    description:
      "A gruff, loud Japanese ramen chef in his 50s shouting orders across a busy kitchen. Deep, raspy, energetic, native Japanese.",
    sample:
      "はいよっ！醤油一丁！味噌二丁、かためで！餃子焼けたぞ、持ってってくれ！お客さん、熱いから気をつけてな！今日のスープは最高の出来だぞ。どんどん注文してくれよ！麺は今日も手打ちだ、うまいぞ！ありがとうございましたー！またどうぞー！",
    fallback: "nPczCjzI2devNBz1zQrb",
  },
  camille: {
    name: "Babbli · Camille (Paris server)",
    language: "fr",
    role: "NPC · Parisian café",
    description:
      "A young Parisian woman in her late 20s, a café server. Bright, brisk and friendly with a dry wit; natural native Parisian French accent, medium pace.",
    sample:
      "Bonjour ! Installez-vous où vous voulez, je suis à vous tout de suite. Alors, qu'est-ce que je vous sers ce matin ? Un café crème, un croissant ? Sur place ou à emporter ? Très bien, je vous apporte ça.",
    fallback: "EXAVITQu4vr4xnSDxMaL",
  },
  julien: {
    name: "Babbli · Julien (barista)",
    language: "fr",
    role: "Background · barista callouts",
    description:
      "A Parisian man in his 30s, a barista calling out orders across a busy café; casual, upbeat, native French.",
    sample:
      "Un crème pour la quatre ! Deux expressos au comptoir ! Attention, c'est chaud ! Allez, on accélère, il y a du monde ce matin. Et un chocolat chaud pour la terrasse, s'il vous plaît !",
    fallback: "onwK4e9ZLuTAKqWW03F9",
  },
  lucia: {
    name: "Babbli · Lucía (Sevilla receptionist)",
    language: "es",
    role: "NPC · Sevilla hotel",
    description:
      "A professional, warm Spanish woman in her mid-30s, a hotel receptionist in Sevilla. Clear native Castilian Spanish with a soft Andalusian warmth, polite and composed.",
    sample:
      "¡Buenas tardes! Bienvenido al Hotel Azahar. ¿A nombre de quién está la reserva? Perfecto, un momento, por favor. Aquí tiene su llave: habitación trescientos cinco. ¡Que disfrute de su estancia en Sevilla!",
    fallback: "Xb7hH8MSUJpSbSDYk0k2",
  },
  mateo: {
    name: "Babbli · Mateo (bellhop)",
    language: "es",
    role: "Background · bellhop",
    description: "A cheerful young Spanish man in his early 20s, a hotel bellhop in Sevilla; energetic, friendly, native Spanish.",
    sample:
      "¡Buenas! Yo le subo las maletas, no se preocupe. El ascensor está a la derecha. Si necesita cualquier cosa, estoy aquí en la entrada. ¡Bienvenido a Sevilla, que lo pase genial!",
    fallback: "TX3LPaxmHKxFdv7VOQHJ",
  },
  coach_ja: {
    name: "Babbli · Coach (Japanese)",
    language: "ja",
    role: "Hints & native reference audio",
    description:
      "A calm, clear native Japanese woman in her 30s with a standard Tokyo accent, speaking slowly and precisely like a language teacher recording reference audio.",
    sample:
      "こんにちは。これから、よく使う表現をゆっくり、はっきりと読みます。よく聞いて、まねして言ってみてください。醤油ラーメンを一つお願いします。お会計お願いします。ごちそうさまでした。一緒に、ゆっくり練習しましょう。",
    fallback: "XrExE9yKIg1WjnnlVkGX",
  },
  coach_fr: {
    name: "Babbli · Coach (French)",
    language: "fr",
    role: "Hints & native reference audio",
    description:
      "A calm, clear native French man in his 30s with a standard Parisian accent, speaking slowly and precisely like a language teacher recording reference audio.",
    sample:
      "Bonjour. Je vais lire des expressions utiles, lentement et clairement. Écoutez bien, puis répétez après moi. Je voudrais un café crème, s'il vous plaît. L'addition, s'il vous plaît.",
    fallback: "cjVigY5qzO86Huf0OWal",
  },
  coach_es: {
    name: "Babbli · Coach (Spanish)",
    language: "es",
    role: "Hints & native reference audio",
    description:
      "A calm, clear native Spanish woman from Madrid in her 30s, speaking slowly and precisely like a language teacher recording reference audio.",
    sample:
      "Hola. Voy a leer algunas expresiones útiles, despacio y con claridad. Escuche con atención y repita después de mí. Tengo una reserva a nombre de Alex Morgan. Muchas gracias.",
    fallback: "FGY2WhTYpPnrIDTdsKH5",
  },
};

export function coachVoiceKey(language: string) {
  return `coach_${language}`;
}

interface DesignResponse {
  previews: { audio_base_64: string; generated_voice_id: string; media_type: string }[];
}

async function designVoice(key: string, def: VoiceDef): Promise<string> {
  let lastError: unknown;
  for (const model_id of ["eleven_ttv_v3", "eleven_multilingual_ttv_v2"]) {
    try {
      const design = await xiJson<DesignResponse>("/v1/text-to-voice/design", {
        method: "POST",
        json: { voice_description: def.description, model_id, text: def.sample, guidance_scale: 5 },
      });
      const preview = design.previews[0];
      if (!preview) throw new Error("Voice design returned no previews");
      await fs.mkdir(path.join(env.dataDir, "cache"), { recursive: true });
      await fs.writeFile(path.join(env.dataDir, "cache", `voice-preview-${key}.mp3`), Buffer.from(preview.audio_base_64, "base64"));
      const created = await xiJson<{ voice_id: string }>("/v1/text-to-voice", {
        method: "POST",
        json: {
          voice_name: def.name,
          voice_description: def.description,
          generated_voice_id: preview.generated_voice_id,
          labels: { app: "babbli", language: def.language },
        },
      });
      return created.voice_id;
    } catch (e) {
      lastError = e;
      if (!(e instanceof ElevenLabsError) || e.status >= 500 || e.status === 401) break;
    }
  }
  throw lastError;
}

export async function ensureVoice(key: string, opts: { force?: boolean } = {}): Promise<string> {
  const def = VOICE_DEFS[key];
  if (!def) throw new Error(`Unknown voice ${key}`);
  const override = process.env[`BABBLI_VOICE_${key.toUpperCase()}`];
  if (override) return override;

  // Never record a fallback just because the key is missing — that would stick after the key is added.
  requireApiKey();
  const reg = await readRegistry();
  const known = reg.voices[key] as (typeof reg.voices)[string] | undefined;
  if (known?.designed) return known.voiceId;
  // A previous design attempt failed: keep using the fallback, but retry when forced or after a while.
  const retryDue = !!known && Date.now() - Date.parse(known.updatedAt) > 30 * 60_000;
  if (known && !opts.force && !retryDue) return known.voiceId;

  return once(`voice:${key}`, async () => {
    // Re-use a previously designed voice with the same name (e.g. registry was wiped).
    try {
      const found = await xiJson<{ voices: { voice_id: string; name: string }[] }>("/v2/voices", {
        query: { search: def.name, page_size: 20 },
      });
      const match = found.voices.find((v) => v.name === def.name);
      if (match) {
        await updateRegistry((r) => {
          r.voices[key] = { voiceId: match.voice_id, name: def.name, designed: true, updatedAt: new Date().toISOString() };
        });
        return match.voice_id;
      }
    } catch {
      /* search is best-effort */
    }
    try {
      const voiceId = await designVoice(key, def);
      await updateRegistry((r) => {
        r.voices[key] = { voiceId, name: def.name, designed: true, updatedAt: new Date().toISOString() };
      });
      return voiceId;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn(`[babbli] voice design failed for ${key}, using premade fallback: ${message}`);
      await updateRegistry((r) => {
        r.voices[key] = { voiceId: def.fallback, name: def.name, designed: false, error: message.slice(0, 300), updatedAt: new Date().toISOString() };
      });
      return def.fallback;
    }
  });
}

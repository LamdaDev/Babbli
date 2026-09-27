import { requireApiKey } from "./env";
import { ElevenLabsError, xiJson } from "./elevenlabs";
import { once, readRegistry, updateRegistry } from "./registry";

/**
 * Every character voice is designed from a text prompt with ElevenLabs Voice
 * Design (ElevenCreative) — native speakers of each language rather than
 * English stock voices. Premade multilingual voices are only a fallback.
 */
export interface VoiceDef {
  name: string;
  language: "en" | "ja" | "fr" | "es";
  role: string;
  description: string;
  sample: string;
  fallback: string;
}

export const VOICE_DEFS: Record<string, VoiceDef> = {
  jordan: {
    name: "Babbli · Jordan (store associate)",
    language: "en",
    role: "NPC · New York department store",
    description:
      "A friendly, upbeat American man in his late 20s, a sales associate at a New York department store. Warm, natural and conversational with a clear General American accent and lively, helpful retail energy.",
    sample:
      "Hi there! Welcome to Whitmore's. Can I help you find anything today? Oh, a scarf for your sister, how nice! We've got some really soft merino wool ones right over here. Let me grab a few colors for you.",
    fallback: "TX3LPaxmHKxFdv7VOQHJ",
  },
  announcer: {
    name: "Babbli · Store PA announcer",
    language: "en",
    role: "Background · store announcements",
    description:
      "A smooth, polished American woman making a department store PA announcement: warm, calm and professional, clear enunciation, slightly formal.",
    sample:
      "Attention Whitmore's shoppers: our fall sale continues on the third floor, with up to forty percent off outerwear. Gift wrapping is complimentary at every register. Thank you for shopping with us!",
    fallback: "EXAVITQu4vr4xnSDxMaL",
  },
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
  coach_en: {
    name: "Babbli · Coach (English)",
    language: "en",
    role: "Hints & native reference audio",
    description:
      "A calm, clear native American English woman in her 30s with a neutral General American accent, speaking slowly and precisely like a language teacher recording reference audio.",
    sample:
      "Hello. I'm going to read some useful phrases slowly and clearly. Listen carefully, then repeat after me. I'm looking for a scarf. Could you check if you have any in the back? I'll take it, thanks.",
    fallback: "21m00Tcm4TlvDq8ikWAM",
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
  // Alternate coaches, picked in the Traveler Profile. Only playback uses them: the standard coach
  // stays the native timing reference for scores. Designed the first time someone chooses one.
  coach_en_alt: {
    name: "Babbli · Coach 2 (English)",
    language: "en",
    role: "Hints & native reference audio (alternate)",
    description:
      "A warm, clear native American English man in his 30s with a neutral General American accent, speaking slowly and precisely like a friendly language teacher recording reference audio.",
    sample:
      "Hi there. Let's practice some useful phrases together, nice and slowly. Listen first, then say it with me. Do you have this scarf in navy? I'll take it, thank you so much.",
    fallback: "nPczCjzI2devNBz1zQrb",
  },
  coach_ja_alt: {
    name: "Babbli · Coach 2 (Japanese)",
    language: "ja",
    role: "Hints & native reference audio (alternate)",
    description:
      "A warm, clear native Japanese man in his 30s with a standard Tokyo accent, speaking slowly and precisely like a friendly language teacher recording reference audio.",
    sample:
      "こんにちは。一緒に、よく使う表現をゆっくり練習しましょう。まず聞いて、それからまねして言ってみてください。醤油ラーメンを一つお願いします。お水をください。ごちそうさまでした。",
    fallback: "JBFqnCBsd6RMkjVDRZzb",
  },
  coach_fr_alt: {
    name: "Babbli · Coach 2 (French)",
    language: "fr",
    role: "Hints & native reference audio (alternate)",
    description:
      "A bright, clear native French woman in her 30s with a standard Parisian accent, speaking slowly and precisely like a friendly language teacher recording reference audio.",
    sample:
      "Bonjour ! On va pratiquer ensemble quelques expressions utiles, doucement. Écoutez d'abord, puis répétez avec moi. Un café crème, s'il vous plaît. Je peux avoir l'addition ?",
    fallback: "EXAVITQu4vr4xnSDxMaL",
  },
  coach_es_alt: {
    name: "Babbli · Coach 2 (Spanish)",
    language: "es",
    role: "Hints & native reference audio (alternate)",
    description:
      "A warm, clear native Spanish man from Madrid in his 30s, speaking slowly and precisely like a friendly language teacher recording reference audio.",
    sample:
      "Hola. Vamos a practicar juntos algunas expresiones útiles, despacio. Primero escuche y luego repita conmigo. Tengo una reserva a nombre de Morgan. ¿A qué hora es el desayuno?",
    fallback: "TX3LPaxmHKxFdv7VOQHJ",
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

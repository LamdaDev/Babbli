import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "./env";
import { ElevenLabsError, xi, xiBytes, xiJson } from "./elevenlabs";
import { hashOf, once } from "./registry";
import { stripAudioTags } from "@/lib/evaluation/text";
import { VOICE_DEFS, ensureVoice } from "./voices";

const FALLBACK_TTS_MODEL = "eleven_multilingual_v2";

/* ---------------- ElevenCreative assets: Sound Effects + Music ---------------- */

export interface AssetDef {
  kind: "sfx" | "music";
  label: string;
  prompt: string;
  duration?: number;
  loop?: boolean;
  influence?: number;
  lengthMs?: number;
}

export const AUDIO_ASSETS: Record<string, AssetDef> = {
  "store-ambience": {
    kind: "sfx",
    label: "Department store ambience (loop)",
    loop: true,
    duration: 30,
    influence: 0.4,
    prompt:
      "Ambience inside a large, bright department store on a Saturday afternoon: soft murmur of American shoppers, a distant escalator hum, hangers sliding on racks, an occasional far-off register beep, spacious reverberant room tone. No music.",
  },
  "store-doors": { kind: "sfx", label: "Automatic doors", duration: 3, prompt: "Automatic sliding glass doors opening with a soft whoosh into a spacious, bustling store" },
  "store-pa-chime": { kind: "sfx", label: "PA chime", duration: 2.5, prompt: "Classic department store PA announcement chime, three soft ascending bell tones" },
  "store-paper": { kind: "sfx", label: "Tissue paper", duration: 2, prompt: "Tissue paper rustling as a folded scarf is lifted out of a box onto a glass counter" },
  "store-wrap": { kind: "sfx", label: "Gift wrapping", duration: 4, prompt: "Gift wrapping: crisp paper folding, tape pulled from a dispenser, a ribbon tied" },
  "store-beep": { kind: "sfx", label: "Card terminal", duration: 2, prompt: "Card payment terminal beep with an approved tone, then a receipt printing" },
  "ramen-ambience": {
    kind: "sfx",
    label: "Ramen shop ambience (loop)",
    loop: true,
    duration: 30,
    influence: 0.4,
    prompt:
      "Ambience inside a small cozy Tokyo ramen shop at night: soft murmur of Japanese customers talking, ceramic bowls and chopsticks clinking, broth simmering, occasional kitchen sizzle, warm room tone. No music.",
  },
  "ramen-door": { kind: "sfx", label: "Sliding door + bell", duration: 3, prompt: "Wooden sliding shop door opening with a small tinkling bell, then soft restaurant murmur" },
  "ramen-bowl": { kind: "sfx", label: "Bowl on counter", duration: 2, prompt: "Heavy ceramic ramen bowl set down on a wooden counter, gentle clink" },
  "ramen-slurp": { kind: "sfx", label: "Happy slurping", duration: 4, prompt: "Person happily slurping ramen noodles, then a satisfied sigh" },
  register: { kind: "sfx", label: "Cash register", duration: 2.5, prompt: "Cash register drawer opening, coins clinking, a receipt printing" },
  "cafe-ambience": {
    kind: "sfx",
    label: "Parisian café ambience (loop)",
    loop: true,
    duration: 30,
    influence: 0.4,
    prompt:
      "Ambience of a busy Parisian café in the morning: French conversations murmuring, cups and saucers clinking, an espresso machine hissing now and then, distant street traffic and a scooter passing outside. No music.",
  },
  "cafe-bell": { kind: "sfx", label: "Café door bell", duration: 2.5, prompt: "Small brass bell above a café door ringing as the door opens" },
  "cafe-espresso": { kind: "sfx", label: "Espresso machine", duration: 5, prompt: "Espresso machine grinding beans and pulling a shot, steam wand hissing briefly" },
  "cafe-cup": { kind: "sfx", label: "Cup on saucer", duration: 1.5, prompt: "Porcelain coffee cup placed on a saucer on a marble table" },
  "hotel-ambience": {
    kind: "sfx",
    label: "Hotel lobby ambience (loop)",
    loop: true,
    duration: 30,
    influence: 0.4,
    prompt:
      "Ambience of an elegant boutique hotel lobby in Spain: soft distant Spanish voices, footsteps on a marble floor, a suitcase rolling by, a small courtyard fountain trickling. No music.",
  },
  "hotel-door": { kind: "sfx", label: "Lobby door", duration: 3, prompt: "Heavy glass hotel entrance door opening, a moment of street noise, then a quiet lobby" },
  "hotel-elevator": { kind: "sfx", label: "Elevator ding", duration: 3, prompt: "Elevator arrival ding followed by doors sliding open" },
  "hotel-typing": { kind: "sfx", label: "Reception typing", duration: 3, prompt: "Quick typing on a computer keyboard at a reception desk" },
  "hotel-bell": { kind: "sfx", label: "Service bell", duration: 1.5, prompt: "Hotel reception service bell, one clear ding" },
  "boba-ambience": {
    kind: "sfx",
    label: "Boba shop ambience (loop)",
    loop: true,
    duration: 30,
    influence: 0.4,
    prompt:
      "Ambience inside a busy, modern bubble tea shop in Shanghai on a sunny weekend afternoon: a soft murmur of Mandarin-speaking customers, ice rattling in cocktail shakers behind the counter, the occasional thunk and short hiss of a cup-sealing machine, plastic cups stacking, a brief blender whir in the back, a bright electronic order-ready chime now and then, clean bright room tone. No music.",
  },
  "boba-door": { kind: "sfx", label: "Door chime", duration: 2.5, prompt: "Glass shop door opening with a bright two-tone electronic entry chime, then a lively tea shop murmur" },
  "boba-shaker": {
    kind: "sfx",
    label: "Cocktail shaker",
    duration: 4,
    prompt: "Vigorously shaking a stainless steel cocktail shaker full of ice and tea, fast rhythmic rattling, then pouring into a plastic cup",
  },
  "boba-sealer": {
    kind: "sfx",
    label: "Cup sealer",
    duration: 3,
    prompt: "Automatic bubble tea cup sealing machine: a plastic cup slides in, the heated press thunks down with a short hiss as the film seals, then a mechanical click as the tray slides out",
  },
  "boba-pay": {
    kind: "sfx",
    label: "QR payment beep",
    duration: 2,
    prompt: "Short bright electronic beep of a QR code payment scanner at a shop counter, a soft confirmation tone, then a small receipt printer printing a ticket",
  },
  "boba-straw": { kind: "sfx", label: "Straw pop", duration: 1.5, prompt: "A thick bubble tea straw stabbed through a sealed plastic film lid with a satisfying pop" },
  "ui-success": { kind: "sfx", label: "Success chime", duration: 1.5, prompt: "Gentle warm two-note marimba chime, cozy video game success sound" },
  "ui-hint": { kind: "sfx", label: "Hint sparkle", duration: 1.2, prompt: "Soft magical sparkle shimmer, subtle cozy game hint sound" },
  "ui-complete": { kind: "sfx", label: "Scene complete jingle", duration: 4, prompt: "Short joyful cozy video game level-complete jingle with marimba and soft bells" },
  "menu-music": {
    kind: "music",
    label: "Main menu theme (Eleven Music)",
    lengthMs: 60000,
    prompt:
      "Cozy lo-fi travel game main menu theme: warm acoustic guitar, soft Rhodes piano, gentle brushed drums, hopeful and relaxing, instrumental, seamless and loopable.",
  },
};

const assetDir = () => path.join(env.dataDir, "assets");
export const assetPath = (id: string) => path.join(assetDir(), `${id}.mp3`);

export async function assetExists(id: string) {
  try {
    await fs.access(assetPath(id));
    return true;
  } catch {
    return false;
  }
}

async function generateSfx(def: AssetDef): Promise<Buffer> {
  const body: Record<string, unknown> = {
    text: def.prompt,
    duration_seconds: def.duration,
    prompt_influence: def.influence ?? 0.35,
    model_id: "eleven_text_to_sound_v2",
  };
  if (def.loop) body.loop = true;
  try {
    return await xiBytes("/v1/sound-generation", { method: "POST", json: body, query: { output_format: "mp3_44100_128" } });
  } catch (e) {
    if (e instanceof ElevenLabsError && e.status === 422 && def.loop) {
      delete body.loop;
      return xiBytes("/v1/sound-generation", { method: "POST", json: body, query: { output_format: "mp3_44100_128" } });
    }
    throw e;
  }
}

async function generateMusic(def: AssetDef): Promise<Buffer> {
  return xiBytes("/v1/music", {
    method: "POST",
    json: { prompt: def.prompt, music_length_ms: def.lengthMs ?? 45000, model_id: "music_v1", force_instrumental: true },
    query: { output_format: "mp3_44100_128" },
  });
}

export async function ensureAsset(id: string, opts: { force?: boolean } = {}): Promise<string> {
  const def = AUDIO_ASSETS[id];
  if (!def) throw new Error(`Unknown audio asset ${id}`);
  if (!opts.force && (await assetExists(id))) return assetPath(id);
  return once(`asset:${id}`, async () => {
    const bytes = def.kind === "music" ? await generateMusic(def) : await generateSfx(def);
    await fs.mkdir(assetDir(), { recursive: true });
    await fs.writeFile(assetPath(id), bytes);
    return assetPath(id);
  });
}

/* ---------------- TTS with timestamps (cached) ---------------- */

export interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface TtsResult {
  key: string;
  url: string;
  alignment: Alignment | null;
  duration: number;
}

const ttsDir = () => path.join(env.dataDir, "cache", "tts");
export const ttsAudioPath = (key: string) => path.join(ttsDir(), `${key}.mp3`);

type TtsResponse = { audio_base64: string; alignment?: Alignment; normalized_alignment?: Alignment };

export async function synthesize(opts: {
  text: string;
  voiceKey: string;
  speed?: number;
  style?: number;
}): Promise<TtsResult> {
  const voiceId = await ensureVoice(opts.voiceKey);
  // Always pin the language: on short phrases ("Bonjour madame !") the model otherwise
  // guesses, and can read French with an English accent.
  const language = VOICE_DEFS[opts.voiceKey]?.language;
  const speed = Math.min(1.2, Math.max(0.7, opts.speed ?? 1));
  const params = { text: opts.text, voiceId, speed, model: env.ttsModel, language, style: opts.style ?? 0.2 };
  const key = hashOf(params);
  const metaPath = path.join(ttsDir(), `${key}.json`);
  try {
    const meta = JSON.parse(await fs.readFile(metaPath, "utf8")) as TtsResult;
    return meta;
  } catch {
    /* not cached */
  }
  return once(`tts:${key}`, async () => {
    const request = (model: string) =>
      xiJson<TtsResponse>(`/v1/text-to-speech/${voiceId}/with-timestamps`, {
        method: "POST",
        query: { output_format: "mp3_44100_128" },
        json: {
          // eleven_v3 performs audio tags ([cheerful]…); other models would read them out loud.
          text: model.startsWith("eleven_v3") ? opts.text : stripAudioTags(opts.text),
          model_id: model,
          ...(language ? { language_code: language } : {}),
          voice_settings: { stability: 0.5, similarity_boost: 0.8, style: params.style, use_speaker_boost: true, speed },
        },
      });
    let res: TtsResponse;
    try {
      res = await request(env.ttsModel);
    } catch (e) {
      // Accounts without v3 access: same voice + language on the multilingual model.
      if (!(e instanceof ElevenLabsError) || e.status >= 500 || env.ttsModel === FALLBACK_TTS_MODEL) throw e;
      res = await request(FALLBACK_TTS_MODEL);
    }
    const alignment = res.alignment ?? res.normalized_alignment ?? null;
    const duration = alignment?.character_end_times_seconds.at(-1) ?? 0;
    const result: TtsResult = { key, url: `/api/audio/tts/${key}`, alignment, duration };
    await fs.mkdir(ttsDir(), { recursive: true });
    await fs.writeFile(ttsAudioPath(key), Buffer.from(res.audio_base64, "base64"));
    await fs.writeFile(metaPath, JSON.stringify(result));
    return result;
  });
}

/* ---------------- Scribe speech-to-text ---------------- */

export interface SttWord {
  text: string;
  start: number;
  end: number;
  type: "word" | "spacing" | "audio_event";
  logprob?: number;
  speaker_id?: string;
}

export interface SttResult {
  text: string;
  language_code: string;
  language_probability: number;
  words: SttWord[];
  audio_duration_secs?: number;
  model: string;
}

/**
 * Time limit for each Scribe try. A reply is transcribed in a second or two, but now and then a
 * request stalls for minutes (seen: 170 s, then a 502), with someone waiting on it (push-to-talk,
 * the results page). A stalled try is sent again, and the retry is usually quick.
 */
const STT_TRY_MS = [10_000, 15_000, 25_000];

/** Worth sending again: a stall, a dropped connection, or ElevenLabs overloaded. */
function stalled(e: unknown) {
  if (e instanceof ElevenLabsError) return e.status === 429 || e.status >= 500;
  return e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError" || e instanceof TypeError);
}

export async function transcribe(file: Blob, language: string, keyterms: string[] = []): Promise<SttResult> {
  const attempt = async (model: string, withKeyterms: boolean, timeoutMs: number) => {
    const form = new FormData();
    form.set("model_id", model);
    form.set("file", file, "turn.webm");
    form.set("language_code", language);
    form.set("timestamps_granularity", "word");
    form.set("tag_audio_events", "true");
    // Separate speakers so background chatter can be dropped from the learner's transcript.
    form.set("diarize", "true");
    if (withKeyterms) for (const k of keyterms.slice(0, 50)) form.append("keyterms", k);
    const res = await xi("/v1/speech-to-text", { method: "POST", body: form, signal: AbortSignal.timeout(timeoutMs) });
    const json = (await res.json()) as Omit<SttResult, "model">;
    return { ...json, model };
  };
  let model = env.sttModel;
  let withKeyterms = keyterms.length > 0;
  let fellBack = false;
  for (let i = 0; ; i++) {
    try {
      return await attempt(model, withKeyterms, STT_TRY_MS[Math.min(i, STT_TRY_MS.length - 1)]);
    } catch (e) {
      // The request itself was refused (e.g. keyterms on a model without them): the other model, once.
      if (!fellBack && e instanceof ElevenLabsError && (e.status === 400 || e.status === 422)) {
        fellBack = true;
        model = model === "scribe_v1" ? "scribe_v2" : "scribe_v1";
        withKeyterms = false;
        continue;
      }
      if (!stalled(e) || i >= STT_TRY_MS.length - 1) throw e;
      console.warn(`[babbli] Scribe try ${i + 1} ${e instanceof Error ? e.name : "failed"}; trying again`);
    }
  }
}

import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "./env";
import { ElevenLabsError, xi, xiBytes, xiJson } from "./elevenlabs";
import { hashOf, once } from "./registry";
import { ensureVoice } from "./voices";

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

export async function synthesize(opts: {
  text: string;
  voiceKey: string;
  speed?: number;
  language?: string;
  style?: number;
}): Promise<TtsResult> {
  const voiceId = await ensureVoice(opts.voiceKey);
  const speed = Math.min(1.2, Math.max(0.7, opts.speed ?? 1));
  const params = { text: opts.text, voiceId, speed, model: env.ttsModel, style: opts.style ?? 0.2 };
  const key = hashOf(params);
  const metaPath = path.join(ttsDir(), `${key}.json`);
  try {
    const meta = JSON.parse(await fs.readFile(metaPath, "utf8")) as TtsResult;
    return meta;
  } catch {
    /* not cached */
  }
  return once(`tts:${key}`, async () => {
    const res = await xiJson<{ audio_base64: string; alignment?: Alignment; normalized_alignment?: Alignment }>(
      `/v1/text-to-speech/${voiceId}/with-timestamps`,
      {
        method: "POST",
        query: { output_format: "mp3_44100_128" },
        json: {
          text: opts.text,
          model_id: env.ttsModel,
          voice_settings: { stability: 0.5, similarity_boost: 0.8, style: params.style, use_speaker_boost: true, speed },
        },
      },
    );
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

export async function transcribe(file: Blob, language: string, keyterms: string[] = []): Promise<SttResult> {
  const attempt = async (model: string, withKeyterms: boolean) => {
    const form = new FormData();
    form.set("model_id", model);
    form.set("file", file, "turn.webm");
    form.set("language_code", language);
    form.set("timestamps_granularity", "word");
    form.set("tag_audio_events", "true");
    // Separate speakers so background chatter can be dropped from the learner's transcript.
    form.set("diarize", "true");
    if (withKeyterms) for (const k of keyterms.slice(0, 50)) form.append("keyterms", k);
    const res = await xi("/v1/speech-to-text", { method: "POST", body: form });
    const json = (await res.json()) as Omit<SttResult, "model">;
    return { ...json, model };
  };
  try {
    return await attempt(env.sttModel, keyterms.length > 0);
  } catch (e) {
    if (e instanceof ElevenLabsError && (e.status === 400 || e.status === 422)) {
      return attempt(env.sttModel === "scribe_v1" ? "scribe_v2" : "scribe_v1", false);
    }
    throw e;
  }
}

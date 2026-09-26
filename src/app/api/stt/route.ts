import { cleanTranscript } from "@/lib/evaluation/text";
import { transcribe, type SttWord } from "@/lib/server/audio";
import { errorResponse } from "@/lib/server/http";
import type { SpeechCapture } from "@/lib/session/types";

/**
 * Keep the learner's words only. The learner is the dominant voice at the mic;
 * another diarized speaker who is clearly minor (background chatter) is dropped.
 * If speakers are balanced we keep everyone rather than risk cutting the learner.
 */
function learnerWords(words: SttWord[]) {
  const spoken = words.filter((w) => w.type === "word");
  const talk = new Map<string, number>();
  for (const w of spoken) {
    const id = w.speaker_id ?? "main";
    talk.set(id, (talk.get(id) ?? 0) + Math.max(0.05, w.end - w.start));
  }
  if (talk.size <= 1) return spoken;
  const [main, mainTime] = [...talk.entries()].sort((a, b) => b[1] - a[1])[0];
  const others = [...talk.entries()].filter(([id]) => id !== main);
  const clearlyMinor = others.every(([, t]) => t < mainTime * 0.4);
  return clearlyMinor ? spoken.filter((w) => (w.speaker_id ?? "main") === main) : spoken;
}

/** ElevenLabs Scribe: learner transcript + word timings + per-word confidence. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const language = String(form?.get("language") ?? "");
  if (!(file instanceof Blob) || file.size < 200) return Response.json({ error: "audio file required" }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return Response.json({ error: "audio too large" }, { status: 413 });
  let keyterms: string[] = [];
  try {
    keyterms = JSON.parse(String(form?.get("keyterms") ?? "[]"));
  } catch {
    /* ignore */
  }
  try {
    const r = await transcribe(file, language, keyterms);
    const kept = learnerWords(r.words);
    const joined = kept.map((w) => w.text).join(language === "ja" ? "" : " ");
    const capture: SpeechCapture = {
      // Spoken words only: no "(coughs)"-style event tags, no other speakers.
      transcript: cleanTranscript(joined),
      languageCode: r.language_code,
      languageProbability: r.language_probability,
      words: kept
        .filter((w) => cleanTranscript(w.text))
        .map((w) => ({
          text: w.text,
          start: w.start,
          end: w.end,
          confidence: typeof w.logprob === "number" ? Math.exp(w.logprob) : null,
        })),
      events: r.words.filter((w) => w.type === "audio_event").map((w) => w.text),
      audioDuration: r.audio_duration_secs ?? r.words.at(-1)?.end ?? 0,
      model: r.model,
    };
    return Response.json(capture);
  } catch (e) {
    return errorResponse(e);
  }
}

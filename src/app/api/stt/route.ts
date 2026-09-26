import { transcribe } from "@/lib/server/audio";
import { errorResponse } from "@/lib/server/http";
import type { SpeechCapture } from "@/lib/session/types";

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
    const capture: SpeechCapture = {
      transcript: r.text?.trim() ?? "",
      languageCode: r.language_code,
      languageProbability: r.language_probability,
      words: r.words
        .filter((w) => w.type === "word")
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

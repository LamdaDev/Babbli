import { cleanTranscript } from "@/lib/evaluation/text";
import { getScenario } from "@/lib/scenarios";
import { transcribe, type SttWord } from "@/lib/server/audio";
import { errorResponse } from "@/lib/server/http";
import { liveSession, loadSession, loadTurnAudio, validId } from "@/lib/server/sessions";
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

type Job = { file: Blob; language: string; keyterms: string[] } | { error: string; status: number };

/**
 * What to transcribe, and only for Babbli: a push-to-talk reply sent with its recording while its
 * scene is being played, or (results page) a stored recording from a session that has no Scribe
 * analysis yet (Live mode leaves that to the results page).
 */
async function jobFor(form: FormData | null): Promise<Job> {
  const sessionId = form?.get("sessionId");
  const turnId = form?.get("turnId");
  if (typeof turnId === "string") {
    const session = typeof sessionId === "string" && validId(sessionId) ? await loadSession(sessionId) : null;
    const turn = session?.turns.find((t) => t.id === turnId);
    if (!session || !turn || turn.inputMethod !== "voice" || !turn.audio?.uploaded || turn.stt) return { error: "Nothing to transcribe", status: 404 };
    const audio = await loadTurnAudio(session.id, turn.id);
    if (!audio) return { error: "Recording not found", status: 404 };
    const scenario = getScenario(session.scenarioId);
    // Same keyterms the scene used for this reply.
    const keyterms = Array.from(new Set([...(turn.expected?.keywords ?? []), ...(scenario?.asrKeywords ?? [])])).slice(0, 40);
    return { file: new Blob([new Uint8Array(audio.bytes)], { type: audio.mime }), language: session.language, keyterms };
  }
  const session = await liveSession(sessionId);
  if (!session) return { error: "Babbli only transcribes replies from a scene being played", status: 403 };
  const file = form?.get("file");
  if (!(file instanceof Blob) || file.size < 200) return { error: "audio file required", status: 400 };
  if (file.size > 15 * 1024 * 1024) return { error: "audio too large", status: 413 };
  let keyterms: string[] = [];
  try {
    keyterms = JSON.parse(String(form?.get("keyterms") ?? "[]"));
  } catch {
    /* ignore */
  }
  return { file, language: session.language, keyterms };
}

/** ElevenLabs Scribe: learner transcript + word timings + per-word confidence. */
export async function POST(request: Request) {
  const job = await jobFor(await request.formData().catch(() => null));
  if ("error" in job) return Response.json({ error: job.error }, { status: job.status });
  const { file, language, keyterms } = job;
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

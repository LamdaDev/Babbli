import type { LanguageCode } from "@/lib/scenarios/types";
import type { LearnerTurn, WordTiming } from "@/lib/session/types";
import { SPEECH_HEURISTICS } from "./sources";
import { NATIVE_RATE, containsTerm, detectFillers, languageMatches, normalize, similarity, syllableCount, unspaced } from "./text";

export interface ReferenceTiming {
  duration: number;
  /** Syllables (Japanese: characters) in the model phrase. */
  units: number;
  /** Native rate in the same units per second. */
  rate: number;
  segments: { start: number; end: number; text: string }[];
}

export interface TurnSpeechMetrics {
  hasSpeech: boolean;
  transcript: string;
  /** Seconds from the mic opening to the first word. */
  latency: number | null;
  /** First to last recognised word, in seconds — the speech sample (pauses inside included). */
  speakingTime: number;
  /** Syllables (Japanese: characters), filler words excluded. */
  units: number;
  /** units per second over the speaking time (pauses included). */
  rate: number | null;
  /** learner rate ÷ native rate */
  rateRatio: number | null;
  /** Long pauses (≥ 0.45 s) — used by the Fluency score heuristic. */
  pauses: number;
  longestPause: number;
  /** Every silence between words of ≥ 0.25 s, in seconds. */
  silentPauses: number[];
  fillers: number;
  /** Which filler each detected hesitation was ("um", "euh", "えっと"…). */
  fillerLabels: string[];
  /** Mean Scribe word confidence (recognition clarity — not a phoneme-level score). */
  clarity: number | null;
  lowConfidenceWords: string[];
  confidentWords: string[];
  similarity: number | null;
  languageMatch: boolean | null;
  keywordHits: string[];
  segments: { start: number; end: number; text: string; confidence: number | null }[];
  fluency: number | null;
}

const { pauseSeconds: PAUSE, longPauseSeconds: LONG_PAUSE } = SPEECH_HEURISTICS;

/** Group aligned characters (TTS) into speech segments split at silences. */
export function referenceTiming(
  alignment: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] } | null,
  text: string,
  lang: LanguageCode,
): ReferenceTiming | null {
  if (!alignment || alignment.characters.length === 0) return null;
  const { characters: chars, character_start_times_seconds: starts, character_end_times_seconds: ends } = alignment;
  const segments: ReferenceTiming["segments"] = [];
  let cur: { start: number; end: number; text: string } | null = null;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const isBreak = unspaced(lang) ? /[\s、。！？!?,.，]/.test(ch) : /\s/.test(ch);
    if (isBreak) {
      if (cur) segments.push(cur);
      cur = null;
      continue;
    }
    if (cur && starts[i] - cur.end > 0.12) {
      segments.push(cur);
      cur = null;
    }
    if (!cur) cur = { start: starts[i], end: ends[i], text: ch };
    else {
      cur.end = ends[i];
      cur.text += ch;
    }
  }
  if (cur) segments.push(cur);
  if (!segments.length) return null;
  const first = segments[0].start;
  const last = segments[segments.length - 1].end;
  const duration = Math.max(0.1, last - first);
  const units = syllableCount(text, lang);
  return {
    duration,
    units,
    rate: units / duration,
    segments: segments.map((s) => ({ ...s, start: s.start - first, end: s.end - first })),
  };
}

export function analyzeTurn(turn: LearnerTurn, lang: LanguageCode, reference?: ReferenceTiming | null): TurnSpeechMetrics {
  const stt = turn.stt;
  const words: WordTiming[] = stt?.words ?? [];
  const transcript = stt?.transcript || turn.transcriptAgent || "";
  const keywordHits = (turn.expected?.keywords ?? []).filter((k) => transcript && containsTerm(transcript, k, lang));
  const sim = turn.expected && transcript ? similarity(transcript, turn.expected.reference, lang) : null;

  if (!words.length) {
    return {
      hasSpeech: false,
      transcript,
      latency: null,
      speakingTime: 0,
      units: syllableCount(transcript, lang),
      rate: null,
      rateRatio: null,
      pauses: 0,
      longestPause: 0,
      silentPauses: [],
      fillers: 0,
      fillerLabels: [],
      clarity: null,
      lowConfidenceWords: [],
      confidentWords: [],
      similarity: sim,
      languageMatch: null,
      keywordHits,
      segments: [],
      fluency: null,
    };
  }

  const first = words[0].start;
  const last = words[words.length - 1].end;
  const speakingTime = Math.max(0.1, last - first);
  let pauses = 0;
  let longestPause = 0;
  const silentPauses: number[] = [];
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap >= PAUSE) silentPauses.push(gap);
    if (gap >= LONG_PAUSE) pauses++;
    longestPause = Math.max(longestPause, gap);
  }
  const fillerHits = detectFillers(words, lang);
  const fillerIdx = new Set(fillerHits.flatMap((h) => h.indices));
  const fillers = fillerHits.length;
  const spoken = words.filter((_, i) => !fillerIdx.has(i));
  const scored = spoken.filter((w) => w.confidence !== null && normalize(w.text, lang) !== "");
  const clarity = scored.length ? scored.reduce((s, w) => s + (w.confidence ?? 0), 0) / scored.length : null;
  // Speech rate (Kormos & Dénes, 2004 — see sources.ts): syllables over the whole sample, pauses included.
  const units = syllableCount(spoken.map((w) => w.text).join(unspaced(lang) ? "" : " "), lang);
  const rate = units / speakingTime;
  const nativeRate = reference?.rate ?? NATIVE_RATE[lang] ?? 3.3;
  const rateRatio = rate / nativeRate;

  const pace = Math.min(1, rateRatio / 0.7);
  const pauseScore = Math.max(0, 1 - pauses * 0.18 - Math.max(0, longestPause - 0.8) * 0.25);
  const latencyScore = Math.max(0, 1 - Math.max(0, first - 2) / 6);
  const fillerScore = Math.max(0, 1 - fillers * 0.2);
  const fluency = Math.round(100 * (0.35 * pace + 0.35 * pauseScore + 0.15 * latencyScore + 0.15 * fillerScore));

  return {
    hasSpeech: true,
    transcript,
    latency: first,
    speakingTime,
    units,
    rate,
    rateRatio,
    pauses,
    longestPause: silentPauses.length ? longestPause : 0,
    silentPauses,
    fillers,
    fillerLabels: fillerHits.map((h) => h.label),
    clarity,
    lowConfidenceWords: scored.filter((w) => (w.confidence ?? 1) < 0.55).map((w) => w.text),
    confidentWords: scored.filter((w) => (w.confidence ?? 0) >= 0.9).map((w) => w.text),
    similarity: sim,
    languageMatch: languageMatches(stt?.languageCode, lang),
    keywordHits,
    segments: words.map((w) => ({ start: w.start - first, end: w.end - first, text: w.text, confidence: w.confidence })),
    fluency,
  };
}

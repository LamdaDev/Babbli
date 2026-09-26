import { getStage, isOffLanguage } from "@/lib/engine/engine";
import type { ResponseMode, ScenarioDef, VocabItem } from "@/lib/scenarios/types";
import { responseModeOf, type AgentAnalysis, type LearnerTurn, type SessionRecord } from "@/lib/session/types";
import { analyzeTurn, type ReferenceTiming, type TurnSpeechMetrics } from "./speech";
import { SPEECH_HEURISTICS } from "./sources";
import { containsTerm, rateUnit } from "./text";

/**
 * Mode-aware evaluation. One pipeline: shared inputs are computed once per session, each metric is
 * defined once (METRICS), and the session's response mode picks which metrics are valid (METRIC_SETS).
 * Speech measurements only exist when there's real audio — in Text Mode they're reported as not
 * applicable and never enter any score, instead of counting as zero.
 */

export type MetricId = "comprehension" | "clarity" | "fluency" | "accuracy" | "vocabulary" | "independence" | "task";

export interface Score {
  value: number | null;
  headline: string;
  detail: string[];
}

export interface MetricResult extends Score {
  id: MetricId;
  label: string;
  /** "How this is calculated", for this session's response mode. */
  method: string;
}

/** The metrics shown for each way of responding, in display order. */
export const METRIC_SETS: Record<ResponseMode, MetricId[]> = {
  voice: ["comprehension", "clarity", "fluency", "vocabulary", "independence"],
  text: ["comprehension", "accuracy", "vocabulary", "independence", "task"],
};

/** Measurements that need the learner's audio. */
export const SPEECH_METRICS: MetricId[] = ["clarity", "fluency"];

/**
 * Voice Mode speech statistics, pooled over the session's spoken replies. Only speech rate is an
 * established measure (see FLUENCY_SOURCE); the rest is descriptive feedback.
 */
export interface SpeechStats {
  /** "syllables", or "characters" for Japanese. */
  unit: string;
  speakingSec: number;
  fillerCount: number;
  fillersPerMin: number | null;
  /** Most-used first. */
  fillers: { label: string; count: number }[];
  /** Silences between words of ≥ 0.25 s. */
  pauseCount: number;
  pausesPerMin: number | null;
  avgPause: number | null;
  longestPause: number | null;
  /** Pauses over 0.45 s — the ones the Fluency score counts. */
  longPauses: number;
  /** Speech rate in `unit` per minute (Kormos & Dénes, 2004). */
  speechRate: number | null;
  /** The same measure on the native model phrases (ElevenLabs TTS), when available. */
  nativeRate: number | null;
  avgLatency: number | null;
  /** Per reply, for the charts (turn = reply number). */
  latencies: { turn: number; value: number }[];
  pauses: { turn: number; value: number }[];
}

export interface SessionReport {
  mode: ResponseMode;
  /** Voice Mode only (null in Text Mode — nothing spoken to measure). */
  speech: SpeechStats | null;
  completion: { objectiveComplete: boolean; finished: boolean; stagesDone: number; stagesTotal: number; durationSec: number };
  /** The valid metrics for this session's mode, in display order. */
  scores: MetricResult[];
  /** Metrics that don't apply to this mode (e.g. speech metrics in Text Mode) — excluded from everything. */
  notApplicable: { id: MetricId; label: string }[];
  /** Per-turn analytics (speech timings only exist for voice turns). */
  metrics: Record<string, TurnSpeechMetrics>;
  handledWell: string[];
  struggledWith: string[];
  nextTime: string[];
  vocabulary: (VocabItem & { used: boolean })[];
  counts: {
    turns: number;
    missed: number;
    recoveries: number;
    clarificationRequests: number;
    repeats: number;
    slows: number;
    translations: number;
    hints: Record<number, number>;
    fullReveals: number;
    typed: number;
    english: number;
  };
}

const HINT_COST: Record<number, number> = { 1: 2, 2: 4, 3: 6, 4: 10, 5: 12 };
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const pct = (n: number) => `${Math.round(n * 100)}%`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* ------------------------------------------------------------------ */
/* shared inputs — computed once, used by every metric                  */
/* ------------------------------------------------------------------ */

interface EvalContext {
  session: SessionRecord;
  scenario: ScenarioDef;
  mode: ResponseMode;
  /** Voice Mode: speech analytics are valid. */
  speech: boolean;
  lang: ScenarioDef["language"];
  npc: string;
  turns: LearnerTurn[];
  metrics: Record<string, TurnSpeechMetrics>;
  /** Replies the engine judged (clarification requests aren't judged). */
  judged: LearnerTurn[];
  missed: number;
  learnerClarify: number;
  /** Voice turns with word timings (always empty in Text Mode). */
  voiced: LearnerTurn[];
  hints: Record<number, number>;
  fullReveals: number;
  repeats: number;
  slows: number;
  translations: number;
  /** Voice Mode: replies typed instead of spoken (older sessions). Never counted in Text Mode. */
  typed: number;
  /** Replies outside the target language (for the English scene: any other language). */
  offLanguage: number;
  learnerErrors: string[] | null;
  references: Record<string, ReferenceTiming | null>;
}

function evalContext(
  session: SessionRecord,
  scenario: ScenarioDef,
  references: Record<string, ReferenceTiming | null>,
  analysis?: AgentAnalysis | null,
): EvalContext {
  const mode = responseModeOf(session);
  const speech = mode === "voice";
  const lang = scenario.language;
  const turns = session.turns.filter((t) => t.outcome || t.transcriptAgent);
  const metrics: Record<string, TurnSpeechMetrics> = {};
  for (const t of turns) {
    // Text Mode never has audio; don't let stray timing data in.
    const turn = speech ? t : { ...t, stt: undefined };
    metrics[t.id] = analyzeTurn(turn, lang, t.expected ? references[t.expected.reference] : null);
  }
  const judged = turns.filter((t) => t.outcome && t.outcome.kind !== "learner_clarify");
  const hints: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  // session.assistance is the global tally; each turn also keeps its own per-turn copy.
  for (const h of session.assistance.hints) hints[h] = (hints[h] ?? 0) + 1;
  const errors = analysis?.data?.learner_errors?.value;
  return {
    session,
    scenario,
    mode,
    speech,
    lang,
    npc: scenario.npc.name,
    turns,
    metrics,
    judged,
    missed: judged.filter((t) => t.outcome!.kind === "clarify").length,
    learnerClarify: turns.filter((t) => t.outcome?.kind === "learner_clarify").length,
    voiced: speech ? turns.filter((t) => metrics[t.id].hasSpeech) : [],
    hints,
    fullReveals: (hints[4] ?? 0) + (hints[5] ?? 0),
    repeats: session.assistance.repeats,
    slows: session.assistance.slows,
    translations: session.assistance.translations,
    typed: speech ? session.turns.filter((t) => t.inputMethod === "text").length : 0,
    offLanguage: turns.filter((t) => t.report && isOffLanguage(scenario, t.report.language)).length,
    learnerErrors:
      typeof errors === "string"
        ? errors
            .split("||")
            .map((s) => s.trim())
            .filter(Boolean)
        : null,
    references,
  };
}

/* ------------------------------------------------------------------ */
/* metric definitions                                                  */
/* ------------------------------------------------------------------ */

interface MetricDef {
  label: string;
  compute: (c: EvalContext) => Score;
  method: (c: EvalContext) => string;
}

const reply = (c: EvalContext) => (c.speech ? "spoken reply" : "written reply");

const METRICS: Record<MetricId, MetricDef> = {
  comprehension: {
    label: "Comprehension",
    compute: (c) => {
      let sum = 0;
      for (const t of c.judged) {
        const o = t.outcome!;
        if (o.kind === "clarify") sum += 0;
        else if (!o.success) sum += 0.25; // e.g. confirmed a wrong order: understood the question, missed the detail
        else sum += o.answeredQuestion ? 1 : 0.75;
      }
      const n = c.judged.length;
      return {
        value: n ? Math.round((sum / n) * 100) : null,
        headline: n ? `${n - c.missed} of ${n} replies moved the conversation forward` : "No evaluated replies",
        detail: [
          `${plural(c.missed, "missed or off-target reply", "missed or off-target replies")}`,
          `${plural(c.session.state.recoveries, "successful recovery", "successful recoveries")} after a miss`,
          `${plural(c.learnerClarify, "clarification request")} made in ${c.scenario.languageEnglish}`,
        ],
      };
    },
    method: (c) =>
      `Each ${reply(c)} is judged by whether it answered what ${c.npc} asked and moved the scene on: 100% if it did, 75% for a relevant reply that didn't answer the question, 25% if it was understood but missed the detail needed, 0% if ${c.npc} couldn't understand it. Asking for clarification isn't counted against you. The score is the average over your replies.`,
  },

  clarity: {
    label: "Speaking clarity",
    compute: (c) => {
      const clarities = c.voiced.map((t) => c.metrics[t.id].clarity).filter((x): x is number => x !== null);
      const mean = clarities.length ? avg(clarities) : null;
      const words = c.voiced.flatMap((t) => t.stt?.words ?? []).filter((w) => w.confidence !== null);
      const confident = words.filter((w) => (w.confidence ?? 0) >= 0.7).length;
      return {
        value: mean === null ? null : Math.round(clamp(((mean - 0.35) / 0.6) * 100)),
        headline: mean === null ? "No voice recordings to analyse" : `${pct(words.length ? confident / words.length : 0)} of your words were recognised with high confidence`,
        detail: [],
      };
    },
    method: () =>
      "The average ElevenLabs Scribe recognition confidence across your words (filler words excluded), rescaled so 35% confidence scores 0 and 95% scores 100. It shows how easily speech recognition understood you — it is not a phoneme-level pronunciation score.",
  },

  fluency: {
    label: "Fluency",
    compute: (c) => {
      const fl = c.voiced.map((t) => c.metrics[t.id].fluency).filter((f): f is number => f !== null);
      if (!fl.length) return { value: null, headline: "No voice recordings to analyse", detail: [] };
      const latency = avg(c.voiced.map((t) => c.metrics[t.id].latency ?? 0));
      const ratio = avg(c.voiced.map((t) => c.metrics[t.id].rateRatio ?? 0));
      const longPauses = c.voiced.reduce((s, t) => s + c.metrics[t.id].pauses, 0);
      const fillers = c.voiced.reduce((s, t) => s + c.metrics[t.id].fillers, 0);
      return {
        value: Math.round(avg(fl)),
        headline: `You spoke at about ${pct(ratio)} of native speed`,
        detail: [
          fillers || longPauses
            ? `${plural(fillers, "filler")} and ${plural(longPauses, "long pause")} (over ${SPEECH_HEURISTICS.longPauseSeconds} s) affected your fluency`
            : "No fillers or long pauses held you back",
          `Average ${latency.toFixed(1)}s before you started speaking`,
        ],
      };
    },
    method: () =>
      `Speaking rate uses an established second-language fluency measure: syllables ÷ total speaking time, pauses included, × 60 (Kormos & Dénes, 2004). The 0–100 Fluency score itself is a Babbli heuristic, not a standardized test: per spoken reply, your rate compared with a native speaker saying the model phrase (35%), long pauses over ${SPEECH_HEURISTICS.longPauseSeconds} s (35%), how long you took to start (15%) and filler words (15%), averaged over your replies. Timings come from ElevenLabs Scribe; the native rate from ElevenLabs TTS.`,
  },

  accuracy: {
    label: "Language accuracy",
    compute: (c) => {
      const rated = c.judged.filter((t) => t.report);
      if (!rated.length) return { value: null, headline: "Not enough replies to judge", detail: [] };
      // Written in the target language: a reply mixing languages counts half.
      const inTarget = rated.filter((t) => !isOffLanguage(c.scenario, t.report!.language) && t.report!.language !== "mixed").length;
      const mixed = rated.filter((t) => t.report!.language === "mixed").length;
      const targetRate = (inTarget + 0.5 * mixed) / rated.length;
      // Understood as intended: the NPC recognised the card's intention (or a free reply worked in the scene).
      const asIntended = rated.filter((t) =>
        t.expected ? t.outcome!.intentMatched === true : t.outcome!.kind !== "clarify" && t.outcome!.success,
      ).length;
      const intentRate = asIntended / rated.length;
      const notes = c.learnerErrors?.length ?? null;
      return {
        value: Math.round(100 * (0.5 * targetRate + 0.5 * intentRate)),
        headline: `${asIntended} of ${rated.length} replies said what you meant`,
        detail: [
          `${inTarget} of ${rated.length} replies written fully in ${c.scenario.languageEnglish}${mixed ? ` · ${mixed} mixed with another language` : ""}`,
          notes === null ? "" : notes ? `${plural(notes, "wording or grammar note")} in ${c.npc}'s review below` : `No wording or grammar corrections in ${c.npc}'s review`,
        ].filter(Boolean),
      };
    },
    method: (c) =>
      `50% — replies written in ${c.scenario.languageEnglish} (a reply mixing languages counts half); 50% — replies understood the way you meant them (the ElevenAgents NPC recognised the intention on the card you picked, or your own reply worked in the scene). Grammar and wording corrections from ${c.npc}'s post-call review are listed in the review below; they don't change this number.`,
  },

  vocabulary: {
    label: "Vocabulary",
    compute: (c) => {
      const withExpected = c.turns.filter((t) => t.expected && c.metrics[t.id].transcript);
      const hits = withExpected.filter((t) => c.metrics[t.id].keywordHits.length > 0).length;
      const polite = c.turns.filter((t) => t.report?.politeness === "polite").length;
      const politeRated = c.turns.filter((t) => t.report?.politeness).length;
      const keywordRate = withExpected.length ? hits / withExpected.length : null;
      const politeRate = politeRated ? polite / politeRated : null;
      const list = vocabList(c);
      return {
        value: keywordRate === null ? null : Math.round(clamp(100 * (0.7 * keywordRate + 0.3 * (politeRate ?? keywordRate)))),
        headline: keywordRate === null ? "Not enough replies to judge" : `Used the key words in ${hits} of ${withExpected.length} replies`,
        detail: [
          `${list.filter((v) => v.used).length} of ${list.length} scene expressions appeared in your ${c.speech ? "speech" : "replies"}`,
          politeRate === null ? "" : `${pct(politeRate)} of replies used an appropriately polite register`,
        ].filter(Boolean),
      };
    },
    method: (c) =>
      `70% — replies that used at least one key word for what you set out to say; 30% — replies in an appropriately polite register, as judged by the ElevenAgents NPC. Key words are matched in ${c.speech ? "the ElevenLabs Scribe transcript of what you said" : "what you wrote"}.`,
  },

  independence: {
    label: "Independence",
    compute: (c) => {
      const hintPenalty = Object.entries(c.hints).reduce((s, [lvl, n]) => s + HINT_COST[+lvl] * n, 0);
      const penalty = hintPenalty + (c.translations + c.repeats + c.slows) * 3 + c.typed * 6 + c.offLanguage * 5;
      const totalHints = Object.values(c.hints).reduce((a, b) => a + b, 0);
      return {
        value: c.turns.length ? Math.round(clamp(100 - penalty)) : null,
        headline: penalty === 0 ? "You didn't use any assistance — fully independent!" : `Assistance cost you ${Math.round(Math.min(100, penalty))} points`,
        detail: [
          `Hints: ${totalHints} (${plural(c.fullReveals, "full-answer reveal")})`,
          `Translations: ${c.translations} · Repeats: ${c.repeats} · Slow replays: ${c.slows}`,
          c.typed ? `Typed instead of speaking: ${c.typed}` : "",
          c.offLanguage ? `Replies outside ${c.scenario.languageEnglish}: ${c.offLanguage}` : "",
        ].filter(Boolean),
      };
    },
    method: (c) =>
      `Starts at 100 and subtracts for help used: hints cost 2 / 4 / 6 / 10 / 12 points by level, each repeat, slow replay or translation costs 3, and each reply outside ${c.scenario.languageEnglish} costs 5${c.speech ? "; in Voice Mode each reply typed instead of spoken costs 6" : ". Typing is how Text Mode works, so it's never counted as help"}.`,
  },

  task: {
    label: "Task performance",
    compute: (c) => {
      const { stagesDone, stagesTotal, objectiveComplete } = completionOf(c);
      const completion = objectiveComplete ? 1 : stagesTotal ? stagesDone / stagesTotal : 0;
      const n = c.judged.length;
      const recovered = Math.min(c.session.state.recoveries, c.missed);
      const efficiency = n ? clamp((n - c.missed + 0.5 * recovered) / n, 0, 1) : 0;
      return {
        value: n || objectiveComplete ? Math.round(100 * (0.7 * completion + 0.3 * efficiency)) : null,
        headline: objectiveComplete ? "Objective completed" : `Reached step ${stagesDone} of ${stagesTotal}`,
        detail: [
          `${plural(c.missed, "misunderstanding")} · ${recovered} recovered`,
          `${plural(c.turns.length, "reply", "replies")} to get there`,
        ],
      };
    },
    method: () =>
      "70% — how much of the scene you completed (100% once the objective is done, otherwise the share of steps reached); 30% — replies that worked without a misunderstanding, where recovering after a miss earns half of it back.",
  },
};

function vocabList(c: EvalContext) {
  const all = c.turns.map((t) => c.metrics[t.id].transcript).join(" ");
  const visited = new Set(c.session.state.visited);
  return c.scenario.vocabulary
    .filter((v) => !v.stages || v.stages.some((s) => visited.has(s)))
    .map((v) => ({ ...v, used: v.term.split(/\s*\/\s*/).some((part) => containsTerm(all, part, c.lang)) }));
}

/** Voice Mode speech statistics, pooled over every spoken reply (null when nothing was spoken). */
function speechStatsOf(c: EvalContext): SpeechStats | null {
  if (!c.speech || !c.voiced.length) return null;
  const m = c.voiced.map((t) => ({ turn: t.index + 1, m: c.metrics[t.id], ref: t.expected ? c.references[t.expected.reference] : null }));
  const speakingSec = m.reduce((s, x) => s + x.m.speakingTime, 0);
  const minutes = speakingSec / 60;
  const perMin = (n: number) => (minutes > 0 ? n / minutes : null);
  const counts = new Map<string, number>();
  for (const x of m) for (const label of x.m.fillerLabels) counts.set(label, (counts.get(label) ?? 0) + 1);
  const pauses = m.flatMap((x) => x.m.silentPauses.map((value) => ({ turn: x.turn, value })));
  const latencies = m.filter((x) => x.m.latency !== null).map((x) => ({ turn: x.turn, value: x.m.latency! }));
  // The native rate, measured the same way on the model phrases the learner attempted.
  const refs = m.map((x) => x.ref).filter((r): r is ReferenceTiming => !!r);
  const refSec = refs.reduce((s, r) => s + r.duration, 0);
  const fillerCount = [...counts.values()].reduce((a, b) => a + b, 0);
  return {
    unit: rateUnit(c.lang),
    speakingSec,
    fillerCount,
    fillersPerMin: perMin(fillerCount),
    fillers: [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    pauseCount: pauses.length,
    pausesPerMin: perMin(pauses.length),
    avgPause: pauses.length ? avg(pauses.map((p) => p.value)) : null,
    longestPause: pauses.length ? Math.max(...pauses.map((p) => p.value)) : null,
    longPauses: m.reduce((s, x) => s + x.m.pauses, 0),
    speechRate: minutes > 0 ? m.reduce((s, x) => s + x.m.units, 0) / minutes : null,
    nativeRate: refSec > 0 ? (refs.reduce((s, r) => s + r.units, 0) / refSec) * 60 : null,
    avgLatency: latencies.length ? avg(latencies.map((l) => l.value)) : null,
    latencies,
    pauses,
  };
}

function completionOf(c: EvalContext): SessionReport["completion"] {
  const stages = new Set(c.scenario.stages.map((s) => s.group));
  const done = new Set(c.session.state.completedStages.map((id) => getStage(c.scenario, id).group));
  return {
    objectiveComplete: c.session.state.objectiveComplete,
    finished: c.session.state.finished,
    stagesDone: done.size,
    stagesTotal: stages.size,
    durationSec: Math.round(((c.session.endedAt ?? Date.now()) - c.session.startedAt) / 1000),
  };
}

/* ------------------------------------------------------------------ */
/* the report                                                          */
/* ------------------------------------------------------------------ */

export function buildReport(
  session: SessionRecord,
  scenario: ScenarioDef,
  references: Record<string, ReferenceTiming | null> = {},
  analysis?: AgentAnalysis | null,
): SessionReport {
  const c = evalContext(session, scenario, references, analysis ?? session.analysis);
  const scores: MetricResult[] = METRIC_SETS[c.mode].map((id) => ({ id, label: METRICS[id].label, ...METRICS[id].compute(c), method: METRICS[id].method(c) }));
  const value = (id: MetricId) => scores.find((s) => s.id === id)?.value ?? null;
  const notApplicable = c.speech ? [] : SPEECH_METRICS.map((id) => ({ id, label: METRICS[id].label }));

  /* ---------- what went well / struggles / next time ---------- */
  const handledWell: string[] = [];
  const struggledWith: string[] = [];
  const nextTime: string[] = [];
  const flags = session.state.flags;
  const unaided = c.turns.filter((t) => t.outcome?.success && t.hints.length === 0 && t.repeats === 0 && t.slows === 0).length;
  if (unaided) handledWell.push(`${plural(unaided, "reply", "replies")} landed with no help at all.`);
  if (flags.corrected) handledWell.push("You noticed the NPC repeated your order wrong — and corrected it.");
  if (flags.soldOutHit || flags.croissantOut || flags.cardRefused || flags.terminalRefused) handledWell.push("You adapted when something wasn't available.");
  if (session.state.recoveries) handledWell.push(`You recovered ${session.state.recoveries}× after being misunderstood.`);
  if (c.learnerClarify) handledWell.push(`You asked for clarification in ${scenario.languageEnglish} instead of switching languages.`);

  for (const t of c.turns) {
    if (t.outcome?.note && !t.outcome.success) struggledWith.push(t.outcome.note);
  }
  if (flags.wrongOrder) nextTime.push("When an order is read back, listen for the dish name before saying はい.");

  // Speech feedback only when there was speech to measure.
  if (c.speech) {
    const clearWords = Array.from(new Set(c.voiced.flatMap((t) => c.metrics[t.id].confidentWords))).slice(0, 5);
    if (clearWords.length) handledWell.push(`Very clearly recognised: ${clearWords.join(" · ")}`);
    if ((value("fluency") ?? 0) >= 75) handledWell.push("Your pace was close to natural conversation speed.");
    const unclear = Array.from(new Set(c.voiced.flatMap((t) => c.metrics[t.id].lowConfidenceWords))).slice(0, 6);
    if (unclear.length) struggledWith.push(`Hard to recognise: ${unclear.join(" · ")} — practise these with the native reference.`);
    const latency = avg(c.voiced.map((t) => c.metrics[t.id].latency ?? 0));
    if (latency > 3.5) struggledWith.push(`Long pauses before speaking (≈${latency.toFixed(1)}s on average).`);
  }
  if (c.fullReveals) struggledWith.push(`Needed the full answer ${c.fullReveals}× — try stopping at the sentence-starter hint next time.`);
  if (c.offLanguage) struggledWith.push(`Switched out of ${scenario.languageEnglish} ${c.offLanguage}×.`);

  const missedStages = Array.from(new Set(c.judged.filter((t) => t.outcome!.kind === "clarify").map((t) => t.stageId)));
  for (const stageId of missedStages.slice(0, 3)) {
    const t = c.turns.find((x) => x.stageId === stageId && x.expected);
    const stage = getStage(scenario, stageId);
    if (t?.expected) nextTime.push(`${stage.group}: practise ${c.speech ? "saying" : "writing"} “${t.expected.reference}” (${t.expected.referenceMeaning})`);
  }
  if (!session.state.objectiveComplete) nextTime.push("Finish the scene next time — the objective wasn't completed.");
  if (c.speech && (value("fluency") ?? 100) < 60) nextTime.push("Shadow the native reference: play it, then say it right after, matching the rhythm.");
  if (!c.speech && (value("accuracy") ?? 100) < 60)
    nextTime.push(`Before sending, check your reply is all in ${scenario.languageEnglish} and says what the card asks for.`);
  if ((value("independence") ?? 100) < 60) nextTime.push("Try the same scene again using at most the first two hint levels.");
  if (session.difficulty !== "immersion" && (value("comprehension") ?? 0) >= 85 && (value("independence") ?? 0) >= 80)
    nextTime.push("You're ready for the next difficulty level.");

  return {
    mode: c.mode,
    speech: speechStatsOf(c),
    completion: completionOf(c),
    scores,
    notApplicable,
    metrics: c.metrics,
    handledWell,
    struggledWith,
    nextTime,
    vocabulary: vocabList(c),
    counts: {
      turns: c.turns.length,
      missed: c.missed,
      recoveries: session.state.recoveries,
      clarificationRequests: c.learnerClarify + c.repeats + c.slows,
      repeats: c.repeats,
      slows: c.slows,
      translations: c.translations,
      hints: c.hints,
      fullReveals: c.fullReveals,
      typed: c.typed,
      english: c.offLanguage,
    },
  };
}

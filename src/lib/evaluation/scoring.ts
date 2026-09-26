import { getStage } from "@/lib/engine/engine";
import type { ScenarioDef, VocabItem } from "@/lib/scenarios/types";
import type { SessionRecord } from "@/lib/session/types";
import { analyzeTurn, type ReferenceTiming, type TurnSpeechMetrics } from "./speech";
import { containsTerm } from "./text";

export interface Score {
  value: number | null;
  headline: string;
  detail: string[];
}

export interface SessionReport {
  completion: { objectiveComplete: boolean; finished: boolean; stagesDone: number; stagesTotal: number; durationSec: number };
  scores: {
    comprehension: Score;
    clarity: Score;
    fluency: Score;
    vocabulary: Score;
    independence: Score;
  };
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

export function buildReport(
  session: SessionRecord,
  scenario: ScenarioDef,
  references: Record<string, ReferenceTiming | null> = {},
): SessionReport {
  const lang = scenario.language;
  const turns = session.turns.filter((t) => t.outcome || t.transcriptAgent);
  const metrics: Record<string, TurnSpeechMetrics> = {};
  for (const t of turns) metrics[t.id] = analyzeTurn(t, lang, t.expected ? references[t.expected.reference] : null);

  /* ---------- comprehension (separate from pronunciation) ---------- */
  const judged = turns.filter((t) => t.outcome && t.outcome.kind !== "learner_clarify");
  let compSum = 0;
  for (const t of judged) {
    const o = t.outcome!;
    if (o.kind === "clarify") compSum += 0;
    else if (!o.success) compSum += 0.25; // e.g. confirmed a wrong order: understood the question, missed the detail
    else compSum += o.answeredQuestion ? 1 : 0.75;
  }
  const missed = judged.filter((t) => t.outcome!.kind === "clarify").length;
  const learnerClarify = turns.filter((t) => t.outcome?.kind === "learner_clarify").length;
  const comprehension: Score = {
    value: judged.length ? Math.round((compSum / judged.length) * 100) : null,
    headline: judged.length ? `${judged.length - missed} of ${judged.length} replies moved the conversation forward` : "No evaluated replies",
    detail: [
      `${missed} missed or off-target ${missed === 1 ? "reply" : "replies"}`,
      `${session.state.recoveries} successful ${session.state.recoveries === 1 ? "recovery" : "recoveries"} after a miss`,
      `${learnerClarify} clarification ${learnerClarify === 1 ? "request" : "requests"} made in ${scenario.languageEnglish}`,
    ],
  };

  /* ---------- speaking clarity (recognition confidence) ---------- */
  const voiced = turns.filter((t) => metrics[t.id].hasSpeech);
  const clarities = voiced.map((t) => metrics[t.id].clarity).filter((c): c is number => c !== null);
  const meanClarity = clarities.length ? clarities.reduce((a, b) => a + b, 0) / clarities.length : null;
  const allWords = voiced.flatMap((t) => t.stt?.words ?? []).filter((w) => w.confidence !== null);
  const confident = allWords.filter((w) => (w.confidence ?? 0) >= 0.7).length;
  const clarity: Score = {
    value: meanClarity === null ? null : Math.round(clamp(((meanClarity - 0.35) / 0.6) * 100)),
    headline:
      meanClarity === null
        ? "No voice recordings to analyse"
        : `${pct(allWords.length ? confident / allWords.length : 0)} of your words were recognised with high confidence`,
    detail: [
      "Measured with ElevenLabs Scribe word confidence — how easily speech recognition understood you.",
      "This is recognition clarity, not a phoneme-level pronunciation score.",
    ],
  };

  /* ---------- fluency ---------- */
  const fl = voiced.map((t) => metrics[t.id].fluency).filter((f): f is number => f !== null);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const avgLatency = avg(voiced.map((t) => metrics[t.id].latency ?? 0));
  const avgRatio = avg(voiced.map((t) => metrics[t.id].rateRatio ?? 0));
  const totalPauses = voiced.reduce((s, t) => s + metrics[t.id].pauses, 0);
  const totalFillers = voiced.reduce((s, t) => s + metrics[t.id].fillers, 0);
  const fluency: Score = {
    value: fl.length ? Math.round(avg(fl)) : null,
    headline: fl.length ? `You spoke at about ${pct(avgRatio)} of native speed` : "No voice recordings to analyse",
    detail: fl.length
      ? [
          `Average ${avgLatency.toFixed(1)}s before you started speaking`,
          `${totalPauses} mid-sentence ${totalPauses === 1 ? "pause" : "pauses"} longer than 0.45s`,
          `${totalFillers} filler ${totalFillers === 1 ? "word" : "words"} (${lang === "ja" ? "えーと, あの" : lang === "fr" ? "euh, ben" : "eh, este"}…)`,
        ]
      : [],
  };

  /* ---------- vocabulary ---------- */
  const withExpected = turns.filter((t) => t.expected && metrics[t.id].transcript);
  const hitTurns = withExpected.filter((t) => metrics[t.id].keywordHits.length > 0).length;
  const polite = turns.filter((t) => t.report?.politeness === "polite").length;
  const politeRated = turns.filter((t) => t.report?.politeness).length;
  const keywordRate = withExpected.length ? hitTurns / withExpected.length : null;
  const politeRate = politeRated ? polite / politeRated : null;
  const allTranscripts = turns.map((t) => metrics[t.id].transcript).join(" ");
  const visited = new Set(session.state.visited);
  const vocabList = scenario.vocabulary
    .filter((v) => !v.stages || v.stages.some((s) => visited.has(s)))
    .map((v) => ({ ...v, used: v.term.split(/\s*\/\s*/).some((part) => containsTerm(allTranscripts, part, lang)) }));
  const usedCount = vocabList.filter((v) => v.used).length;
  const vocabulary: Score = {
    value:
      keywordRate === null
        ? null
        : Math.round(clamp(100 * (0.7 * keywordRate + 0.3 * (politeRate ?? keywordRate)))),
    headline:
      keywordRate === null ? "Not enough replies to judge" : `Used the key words in ${hitTurns} of ${withExpected.length} replies`,
    detail: [
      `${usedCount} of ${vocabList.length} scene expressions appeared in your speech`,
      politeRate === null ? "" : `${pct(politeRate)} of replies used an appropriately polite register`,
    ].filter(Boolean),
  };

  /* ---------- independence ---------- */
  const hints: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  // session.assistance is the global tally; each turn also keeps its own per-turn copy.
  for (const h of session.assistance.hints) hints[h] = (hints[h] ?? 0) + 1;
  const repeats = session.assistance.repeats;
  const slows = session.assistance.slows;
  const translations = session.assistance.translations;
  const typed = session.turns.filter((t) => t.inputMethod === "text").length;
  const english = turns.filter((t) => t.report?.language === "english").length;
  const fullReveals = (hints[4] ?? 0) + (hints[5] ?? 0);
  const penalty =
    Object.entries(hints).reduce((s, [lvl, n]) => s + HINT_COST[+lvl] * n, 0) +
    translations * 3 +
    repeats * 3 +
    slows * 3 +
    typed * 6 +
    english * 5;
  const independence: Score = {
    value: turns.length ? Math.round(clamp(100 - penalty)) : null,
    headline:
      penalty === 0 ? "You didn't use any assistance — fully independent!" : `Assistance cost you ${Math.round(Math.min(100, penalty))} points`,
    detail: [
      `Hints: ${Object.values(hints).reduce((a, b) => a + b, 0)} (${fullReveals} full-answer ${fullReveals === 1 ? "reveal" : "reveals"})`,
      `Translations: ${translations} · Repeats: ${repeats} · Slow replays: ${slows}`,
      typed ? `Typed instead of speaking: ${typed}` : "",
      english ? `Replies in English: ${english}` : "",
    ].filter(Boolean),
  };

  /* ---------- what went well / struggles / next time ---------- */
  const handledWell: string[] = [];
  const struggledWith: string[] = [];
  const nextTime: string[] = [];
  const flags = session.state.flags;
  const unaided = turns.filter((t) => t.outcome?.success && t.hints.length === 0 && t.repeats === 0 && t.slows === 0).length;
  if (unaided) handledWell.push(`${unaided} ${unaided === 1 ? "reply" : "replies"} landed with no help at all.`);
  if (flags.corrected) handledWell.push("You noticed the NPC repeated your order wrong — and corrected it.");
  if (flags.soldOutHit || flags.croissantOut || flags.cardRefused || flags.terminalRefused)
    handledWell.push("You adapted when something wasn't available.");
  if (session.state.recoveries) handledWell.push(`You recovered ${session.state.recoveries}× after being misunderstood.`);
  if (learnerClarify) handledWell.push(`You asked for clarification in ${scenario.languageEnglish} instead of switching languages.`);
  const clearWords = Array.from(new Set(voiced.flatMap((t) => metrics[t.id].confidentWords))).slice(0, 5);
  if (clearWords.length) handledWell.push(`Very clearly recognised: ${clearWords.join(" · ")}`);
  if ((fluency.value ?? 0) >= 75) handledWell.push("Your pace was close to natural conversation speed.");

  for (const t of turns) {
    if (t.outcome?.note && !t.outcome.success) struggledWith.push(t.outcome.note);
  }
  if (flags.wrongOrder) nextTime.push("When an order is read back, listen for the dish name before saying はい.");
  const unclear = Array.from(new Set(voiced.flatMap((t) => metrics[t.id].lowConfidenceWords))).slice(0, 6);
  if (unclear.length) struggledWith.push(`Hard to recognise: ${unclear.join(" · ")} — practise these with the native reference.`);
  if (avgLatency > 3.5) struggledWith.push(`Long pauses before speaking (≈${avgLatency.toFixed(1)}s on average).`);
  if (fullReveals) struggledWith.push(`Needed the full answer ${fullReveals}× — try stopping at the sentence-starter hint next time.`);
  if (english) struggledWith.push(`Switched to English ${english}×.`);

  const missedStages = Array.from(new Set(judged.filter((t) => t.outcome!.kind === "clarify").map((t) => t.stageId)));
  for (const stageId of missedStages.slice(0, 3)) {
    const t = turns.find((x) => x.stageId === stageId && x.expected);
    const stage = getStage(scenario, stageId);
    if (t?.expected) nextTime.push(`${stage.group}: practise saying “${t.expected.reference}” (${t.expected.referenceMeaning})`);
  }
  if (!session.state.objectiveComplete) nextTime.push("Finish the scene next time — the objective wasn't completed.");
  if ((fluency.value ?? 100) < 60) nextTime.push("Shadow the native reference: play it, then say it right after, matching the rhythm.");
  if ((independence.value ?? 100) < 60) nextTime.push("Try the same scene again using at most the first two hint levels.");
  if (session.difficulty !== "immersion" && (comprehension.value ?? 0) >= 85 && (independence.value ?? 0) >= 80)
    nextTime.push("You're ready for the next difficulty level.");

  const stages = new Set(scenario.stages.map((s) => s.group));
  const doneGroups = new Set(session.state.completedStages.map((id) => getStage(scenario, id).group));
  return {
    completion: {
      objectiveComplete: session.state.objectiveComplete,
      finished: session.state.finished,
      stagesDone: doneGroups.size,
      stagesTotal: stages.size,
      durationSec: Math.round(((session.endedAt ?? Date.now()) - session.startedAt) / 1000),
    },
    scores: { comprehension, clarity, fluency, vocabulary, independence },
    metrics,
    handledWell,
    struggledWith,
    nextTime,
    vocabulary: vocabList,
    counts: {
      turns: turns.length,
      missed,
      recoveries: session.state.recoveries,
      clarificationRequests: learnerClarify + repeats + slows,
      repeats,
      slows,
      translations,
      hints,
      fullReveals,
      typed,
      english,
    },
  };
}

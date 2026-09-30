import { COACH_SAMPLES, coachVoiceKey } from "@/lib/profile/profile";
import { SCENARIOS } from "@/lib/scenarios";
import type { Difficulty, ScenarioDef, SceneEventId } from "@/lib/scenarios/types";
import { createInitialState, getStage, normalizeReport, resolveTurn, seededRandom } from "./engine";

export type StaticLine = { text: string; voiceKey: string; speed: number };

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "immersion"];
/** Background voices, at the speed GameController.playDeferredEvents plays them. */
const BACKGROUND: Partial<Record<SceneEventId, number>> = { order_placed: 1.05, time_skip: 1 };

/**
 * Every fixed line the app voices with TTS, with exactly the parameters it asks for at runtime (the
 * TTS cache is keyed by text, voice and speed): the model phrase behind every intention card (audio
 * hint and native reference on the results page), the vocabulary list, the background voices and the
 * coach voice preview. The phrases are found by walking each scene the way the simulator does,
 * including replies that aren't understood.
 */
export function staticLines(scenario: ScenarioDef, coaches: string[]): StaticLine[] {
  const phrases = new Set<string>();
  const lines: StaticLine[] = [];
  for (const difficulty of DIFFICULTIES) {
    for (let seed = 1; seed <= 90; seed++) {
      const rand = seededRandom(seed * 97);
      const variant = scenario.makeVariant(difficulty, seededRandom(seed));
      let state = createInitialState(scenario);
      for (let turn = 0; !state.finished && turn < 60; turn++) {
        const bank = getStage(scenario, state.stageId).cards({ state, variant, difficulty });
        for (const c of bank) phrases.add(c.hints.full);
        const card = bank[Math.floor(rand() * bank.length)];
        const params =
          rand() < 0.15
            ? { intent: "unintelligible", heard: "…", answered_question: false, language: "target" }
            : { intent: card.id, heard: card.hints.full, answered_question: true, language: "target", ...(card.expect ?? {}) };
        const { outcome, state: next } = resolveTurn(scenario, state, normalizeReport(scenario, params), variant, difficulty, card);
        for (const e of outcome.events ?? []) {
          const speed = BACKGROUND[e];
          const line = speed ? scenario.eventLines[e]?.(next) : undefined;
          if (speed && line) lines.push({ text: line.text, voiceKey: scenario.backgroundVoices[line.voice].voiceKey, speed });
        }
        state = next;
      }
    }
  }
  for (const coach of coaches) {
    for (const p of phrases) lines.push({ text: p, voiceKey: coach, speed: 1 });
    for (const v of scenario.vocabulary) lines.push({ text: v.term.split(" / ")[0], voiceKey: coach, speed: 0.95 });
    lines.push({ text: COACH_SAMPLES[scenario.language], voiceKey: coach, speed: 1 });
  }
  return [...new Map(lines.map((l) => [JSON.stringify(l), l])).values()];
}

let allowed: Map<string, Set<string>> | null = null;

/** Whether a fixed line of any scene is voiced exactly like this (voice, speed), with either coach voice. */
export function isStaticLine(voiceKey: string, text: string, speed: number) {
  if (!allowed) {
    allowed = new Map();
    for (const s of SCENARIOS) {
      for (const l of staticLines(s, [coachVoiceKey(s.language, "standard"), coachVoiceKey(s.language, "alternate")])) {
        const key = `${l.voiceKey}|${l.speed}`;
        if (!allowed.has(key)) allowed.set(key, new Set());
        allowed.get(key)!.add(l.text.trim());
      }
    }
  }
  return !!allowed.get(`${voiceKey}|${speed}`)?.has(text);
}

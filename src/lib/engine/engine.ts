import { containsTerm } from "@/lib/evaluation/text";
import {
  GENERIC_INTENTS,
  type Difficulty,
  type IntentCard,
  type Outcome,
  type ResolveContext,
  type ScenarioDef,
  type ScenarioState,
  type StageDef,
  type TurnReport,
  type Variant,
} from "@/lib/scenarios/types";

/**
 * The scenario state machine. The LLM (ElevenAgents NPC) only proposes an
 * interpretation of what the learner said (a TurnReport via a client tool);
 * this module decides what is true, whether the scenario advances, and what
 * the NPC must do next.
 */

export function createInitialState(scenario: ScenarioDef): ScenarioState {
  return {
    stageId: scenario.initialStage,
    slots: {},
    flags: {},
    visited: [scenario.initialStage],
    completedStages: [],
    attemptsInStage: 0,
    misses: 0,
    recoveries: 0,
    learnerClarifications: 0,
    objectiveComplete: false,
    finished: false,
    turnCount: 0,
    usedCards: [],
  };
}

export function getStage(scenario: ScenarioDef, stageId: string): StageDef {
  const stage = scenario.stages.find((s) => s.id === stageId);
  if (!stage) throw new Error(`Unknown stage ${stageId} in ${scenario.id}`);
  return stage;
}

export function allIntentIds(scenario: ScenarioDef): string[] {
  return Array.from(new Set([...Object.keys(scenario.intents), ...Object.keys(GENERIC_INTENTS)]));
}

export const cardKey = (card: IntentCard) => card.key ?? card.id;

/** Two cards ask the same thing (only the wording differs): same intent, same expected slots. */
function sameQuestion(a: IntentCard, b: IntentCard) {
  return a.id === b.id && JSON.stringify(a.expect ?? {}) === JSON.stringify(b.expect ?? {});
}

function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The three cards offered this turn. With `randomizeCards`, they're drawn from the stage's bank:
 * - at least one `core` card, so there's always a way forward;
 * - questions already answered in this stage aren't offered again;
 * - no two rewordings of the same question side by side (unless nothing else is left);
 * - a new draw only after something actually happened (a misunderstanding keeps the same cards,
 *   so the learner can retry), and a different draw every attempt (session `seed`).
 */
export function currentCards(
  scenario: ScenarioDef,
  state: ScenarioState,
  variant: Variant,
  difficulty: Difficulty,
  seed = 0,
): IntentCard[] {
  const bank = getStage(scenario, state.stageId).cards({ state, variant, difficulty });
  if (!scenario.randomizeCards) return bank.slice(0, 3);
  const used = new Set(state.usedCards ?? []);
  const fresh = bank.filter((c) => !used.has(cardKey(c)));
  const pool = fresh.length ? fresh : bank;
  const drawIndex = state.turnCount - state.misses - state.learnerClarifications;
  const rand = seededRandom(hashString(`${seed}|${state.stageId}|${drawIndex}`));
  const order = shuffle(pool, rand);
  const picked: IntentCard[] = [];
  const core = order.find((c) => c.core);
  if (core) picked.push(core);
  for (const c of order) {
    if (picked.length < 3 && !picked.includes(c) && !picked.some((p) => sameQuestion(p, c))) picked.push(c);
  }
  for (const c of order) if (picked.length < 3 && !picked.includes(c)) picked.push(c);
  return shuffle(picked, rand);
}

/** Before a card is picked, hints default to one that moves the scene forward. */
export function defaultHintCard(cards: IntentCard[]): IntentCard | null {
  return cards.find((c) => c.core) ?? cards[0] ?? null;
}

/** Ordered progress groups with completion status for the HUD. */
export function progressGroups(scenario: ScenarioDef, state: ScenarioState) {
  const groups: { label: string; stageIds: string[] }[] = [];
  for (const stage of scenario.stages) {
    const g = groups.find((x) => x.label === stage.group);
    if (g) g.stageIds.push(stage.id);
    else groups.push({ label: stage.group, stageIds: [stage.id] });
  }
  const currentGroup = getStage(scenario, state.stageId).group;
  const currentIndex = groups.findIndex((g) => g.label === currentGroup);
  return groups.map((g, i) => ({
    label: g.label,
    status: state.finished || i < currentIndex ? "done" : i === currentIndex ? "active" : "todo",
  })) as { label: string; status: "done" | "active" | "todo" }[];
}

const NONE_VALUES = new Set(["", "none", "null", "n/a", "unknown", "undefined"]);

export function normalizeReport(scenario: ScenarioDef, params: Record<string, unknown>): TurnReport {
  const intents = new Set(allIntentIds(scenario));
  let intent = String(params.intent ?? "").trim().toLowerCase();
  if (!intents.has(intent)) intent = intent ? "off_topic" : "unintelligible";
  let language = String(params.language ?? "target").toLowerCase();
  // In an English scene, "english" *is* the target language.
  if (scenario.language === "en" && language === "english") language = "target";
  const answered = params.answered_question;
  const report: TurnReport = {
    ...params,
    intent,
    answered_question: answered === true || answered === "true",
    language: (["target", "english", "mixed", "other"].includes(language) ? language : "target") as TurnReport["language"],
    heard: String(params.heard ?? ""),
    politeness: ["polite", "casual", "rude"].includes(String(params.politeness))
      ? (params.politeness as TurnReport["politeness"])
      : undefined,
  };
  for (const [name, spec] of Object.entries(scenario.slots)) {
    const raw = params[name];
    const value = raw == null ? "" : String(raw).trim();
    const lower = value.toLowerCase();
    if (NONE_VALUES.has(lower)) report[name] = "";
    else if (spec.values) report[name] = spec.values.includes(lower) ? lower : "";
    else report[name] = value;
  }
  return report;
}

const LEARNER_CLARIFY = new Set(["ask_repeat", "ask_slower", "ask_meaning"]);

/** The learner left the target language (English counts only when English isn't the target). */
export function isOffLanguage(scenario: ScenarioDef, language: TurnReport["language"]) {
  return language === "other" || (scenario.language !== "en" && language === "english");
}

function clarifyDirective(
  scenario: ScenarioDef,
  stage: StageDef,
  attempt: number,
  difficulty: Difficulty,
  reason: "unclear" | "off_language" | "off_topic",
): string {
  const lang = scenario.languageEnglish;
  const opener =
    reason === "off_language"
      ? scenario.language === "en"
        ? "The customer spoke a language other than English. Stay in character: say kindly that you only speak English, and encourage them to try in English."
        : `The customer spoke English. Stay in character: say (in ${lang}) that you don't really speak English, and encourage them to try in ${lang}.`
      : reason === "off_topic"
        ? `The customer's reply does not fit what you asked. React with brief, natural confusion.`
        : `You did not understand the customer. React naturally, like a real ${scenario.npc.role.toLowerCase()} who didn't catch it.`;
  if (difficulty === "immersion") {
    return `${opener} Then ask again: ${stage.npcGoal} Keep native speed and natural phrasing; do NOT simplify unless they explicitly ask you to repeat or slow down. Never give them the answer.`;
  }
  if (attempt <= 1) {
    return `${opener} Then ask again with different wording: ${stage.npcGoal} Never give them the answer.`;
  }
  if (attempt === 2 || difficulty === "intermediate") {
    return `${opener} Rephrase more simply and a little more slowly: ${stage.npcGoal} You may offer 2–3 short options for them to choose from, but never say their full sentence for them.`;
  }
  return `${opener} Be patient and kind. Offer two or three one-word options in ${lang} (for example pointing at the menu) so they can just pick one. ${stage.npcGoal} Still never say their full sentence for them.`;
}

function genericOutcome(
  scenario: ScenarioDef,
  stage: StageDef,
  ctx: ResolveContext,
): Outcome {
  const { report, state, difficulty } = ctx;
  const lang = scenario.languageEnglish;
  const stay = { nextStageId: stage.id };

  if (LEARNER_CLARIFY.has(report.intent)) {
    const what =
      report.intent === "ask_meaning"
        ? scenario.language === "en"
          ? "The customer asked what a word means. Explain it very simply with easier words or a quick example, then repeat your question."
          : `The customer asked what a word means. Explain it very simply in ${lang} (no English, use an easier synonym or a gesture-like description), then repeat your question.`
        : report.intent === "ask_slower"
          ? `The customer asked you to speak more slowly. Say your last question again, clearly and slowly, in simpler words.`
          : `The customer asked you to repeat. Say your last question again${difficulty === "immersion" ? " (same natural speed)" : " a little more slowly"}.`;
    return {
      kind: "learner_clarify",
      success: true,
      answeredQuestion: false,
      ...stay,
      directive: `${what} Current step: ${stage.npcGoal} Never give them the answer.`,
      meaning: `(Repeats) ${stage.meaning}`,
      reaction: "neutral",
      note: "You asked for clarification in the target language: a real-world skill.",
    };
  }

  if (isOffLanguage(scenario, report.language)) {
    return {
      kind: "clarify",
      success: false,
      answeredQuestion: false,
      ...stay,
      directive: clarifyDirective(scenario, stage, state.attemptsInStage + 1, difficulty, "off_language"),
      meaning: `${scenario.language === "en" ? "Sorry, I only speak English…" : "Sorry, I don't speak much English…"} ${stage.meaning}`,
      reaction: "confused",
      note: `You switched out of ${lang}. Try to stay in ${lang}.`,
    };
  }

  if (report.intent === "greet") {
    return {
      kind: "info",
      success: true,
      answeredQuestion: report.answered_question,
      ...stay,
      directive: `Return the greeting briefly and warmly, then continue: ${stage.npcGoal}`,
      meaning: `Hello! ${stage.meaning}`,
      reaction: "positive",
    };
  }
  if (report.intent === "thanks") {
    return {
      kind: "info",
      success: true,
      answeredQuestion: report.answered_question,
      ...stay,
      directive: `Say "you're welcome" briefly in ${lang}, then continue: ${stage.npcGoal}`,
      meaning: `You're welcome. ${stage.meaning}`,
      reaction: "positive",
    };
  }
  // Understood perfectly — they're just leaving too early. Not a "didn't understand".
  if (report.intent === "goodbye") {
    return {
      kind: "info",
      success: false,
      answeredQuestion: false,
      ...stay,
      directive: `Look surprised: the customer seems to be leaving before finishing. Ask if they are leaving already, then gently continue: ${stage.npcGoal}`,
      meaning: `Oh, are you leaving already? ${stage.meaning}`,
      reaction: "confused",
      note: "You said goodbye before finishing the task.",
    };
  }

  // A bare yes/no the stage can't use (often an answer to a question the NPC phrased its own way):
  // understood, not a mistake — acknowledge and ask for what's actually needed.
  if (report.intent === "yes" || report.intent === "no") {
    return {
      kind: "info",
      success: true,
      answeredQuestion: true,
      ...stay,
      directive: `The customer answered "${report.intent}". Acknowledge it in a few words, without treating it as agreeing to anything this result doesn't confirm, then ask for what you need now: ${stage.npcGoal}`,
      meaning: stage.meaning,
      reaction: "neutral",
    };
  }

  // Understood, but it doesn't settle this step (a question or remark for another moment).
  // Never tell the NPC it "didn't understand" here: it did, and saying so makes it contradict itself.
  if (report.intent !== "off_topic" && report.intent !== "unintelligible") {
    return {
      kind: "info",
      success: false,
      answeredQuestion: report.answered_question,
      ...stay,
      directive: `You understood the customer, but what they said doesn't settle this step yet. Reply to it briefly and naturally, without agreeing to anything, offering anything new, or moving on to a later step, then bring them back to what you need: ${stage.npcGoal}`,
      meaning: stage.meaning,
      reaction: "neutral",
      note: `That didn't answer what ${scenario.npc.name} needed at that moment.`,
    };
  }

  const reason = report.intent === "off_topic" ? "off_topic" : "unclear";
  return {
    kind: "clarify",
    success: false,
    answeredQuestion: report.intent === "off_topic" ? false : report.answered_question,
    ...stay,
    directive: clarifyDirective(scenario, stage, state.attemptsInStage + 1, difficulty, reason),
    meaning: `Sorry? ${stage.meaning}`,
    reaction: "confused",
    note: reason === "off_topic" ? "Your reply didn't answer the question." : "The NPC couldn't understand this reply.",
  };
}

/** The card the learner picked for this turn (what they set out to say). */
export interface ChosenCard {
  id: string;
  expect?: Record<string, string>;
  keywords?: string[];
}

/**
 * Did the learner's words actually carry the chosen card's meaning? Its expected slots were all
 * heard (e.g. color=navy), or — for cards without slots — one of its key expressions was said.
 */
function cardEvidence(scenario: ScenarioDef, card: ChosenCard, report: TurnReport) {
  const expect = Object.entries(card.expect ?? {});
  if (expect.length) return expect.every(([k, v]) => report[k] === v);
  return (card.keywords ?? []).some((k) => containsTerm(report.heard, k, scenario.language));
}

/**
 * Resolves one learner turn. The agent's intent label is a best guess (several labels can fit
 * the same words), so if the stage can't use it, the engine tries — in order — the stage's
 * aliases for that label, then the intent of the card the learner picked (only if their words
 * carried the card's meaning). Only then does it fall back to generic handling.
 */
export function resolveTurn(
  scenario: ScenarioDef,
  state: ScenarioState,
  report: TurnReport,
  variant: Variant,
  difficulty: Difficulty,
  card?: ChosenCard | null,
): { outcome: Outcome; state: ScenarioState; intent: string } {
  const stage = getStage(scenario, state.stageId);
  const contextFor = (r: TurnReport): ResolveContext => ({
    report: r,
    state,
    variant,
    difficulty,
    slot: (name) => {
      const v = r[name];
      return typeof v === "string" ? v : "";
    },
  });

  let effective = report;
  let outcome: Outcome | null = null;
  // Leaving the target language never advances the scene (mixed-language replies are fine).
  if (!LEARNER_CLARIFY.has(report.intent) && !isOffLanguage(scenario, report.language)) {
    outcome = stage.resolve(contextFor(report));
    if ((!outcome || outcome.kind === "clarify") && report.intent !== "unintelligible") {
      const byCard = card && card.id !== report.intent && cardEvidence(scenario, card, report) ? card.id : undefined;
      // An alias only fills a gap; the picked card can also overturn a "that's unclear" reading.
      const candidates = outcome ? [byCard] : [stage.aliases?.[report.intent], byCard];
      for (const intent of candidates) {
        if (!intent) continue;
        const retry = { ...report, intent };
        const alt = stage.resolve(contextFor(retry));
        if (alt && alt.kind !== "clarify") {
          outcome = alt;
          effective = retry;
          break;
        }
        if (alt && !outcome) {
          outcome = alt;
          effective = retry;
        }
      }
    }
  }
  const ctx = contextFor(effective);
  if (!outcome) outcome = genericOutcome(scenario, stage, ctx);

  const next: ScenarioState = {
    ...state,
    slots: { ...state.slots, ...(outcome.setSlots ?? {}) },
    flags: { ...state.flags, ...(outcome.setFlags ?? {}) },
    visited: [...state.visited],
    completedStages: [...state.completedStages],
    turnCount: state.turnCount + 1,
    objectiveComplete: state.objectiveComplete || !!outcome.objectiveComplete,
    finished: state.finished || !!outcome.finished || outcome.kind === "complete",
  };

  if (outcome.kind === "learner_clarify") next.learnerClarifications += 1;
  if (outcome.kind === "clarify") {
    next.misses += 1;
    next.attemptsInStage += 1;
  } else if (outcome.success) {
    if (state.attemptsInStage > 0) next.recoveries += 1;
    next.attemptsInStage = outcome.kind === "learner_clarify" ? state.attemptsInStage : 0;
  }

  // A question that got its answer (or a request that hit a snag, like "pay by phone" when the
  // reader is down) isn't offered again in this stage — the conversation has moved past it.
  if (outcome.nextStageId === state.stageId && outcome.success && (outcome.kind === "info" || outcome.kind === "branch")) {
    const answered = stage
      .cards({ state, variant, difficulty })
      .filter((c) => c.id === effective.intent && Object.entries(c.expect ?? {}).every(([k, v]) => ctx.slot(k) === v))
      .map(cardKey);
    next.usedCards = Array.from(new Set([...(state.usedCards ?? []), ...answered]));
  }

  if (outcome.nextStageId !== state.stageId) {
    if (!next.completedStages.includes(state.stageId)) next.completedStages.push(state.stageId);
    next.visited.push(outcome.nextStageId);
    next.stageId = outcome.nextStageId;
    next.attemptsInStage = 0;
    next.usedCards = [];
  }
  if (next.finished && !next.completedStages.includes(next.stageId)) {
    next.completedStages.push(next.stageId);
  }
  return { outcome, state: next, intent: effective.intent };
}

export function describeSlots(scenario: ScenarioDef, slots: Record<string, string>) {
  const entries = Object.entries(slots).filter(([k, v]) => v && scenario.slots[k]);
  return entries.length ? entries.map(([k, v]) => `${k}=${v}`).join(", ") : "nothing yet";
}

/** The string returned to the ElevenLabs agent as the client-tool result. */
export function formatDirective(
  scenario: ScenarioDef,
  outcome: Outcome,
  state: ScenarioState,
  difficulty: Difficulty,
): string {
  const stage = getStage(scenario, state.stageId);
  const groups = progressGroups(scenario, state);
  const idx = groups.findIndex((g) => g.label === stage.group) + 1;
  const understood =
    outcome.kind === "clarify"
      ? "NO, you did not get what you needed"
      : outcome.kind === "info" && !outcome.success
        ? "yes, but it doesn't settle this step yet"
        : "yes";
  const lines = [
    "BABBLI ENGINE RESULT (authoritative, follow it exactly)",
    `- Understood: ${understood}`,
    `- Step now: ${stage.group} (${idx}/${groups.length})`,
    `- Recorded so far: ${describeSlots(scenario, state.slots)}`,
    `NEXT LINE (say this now in natural ${scenario.languageEnglish}, in your own words): ${outcome.directive}`,
  ];
  if (state.finished) {
    lines.push("This is your FINAL line of the scene. After saying it, stay silent.");
  } else if (stage.learnerOpens && outcome.nextStageId === stage.id && outcome.kind === "advance") {
    lines.push("After this line, wait silently for the customer to speak first.");
  }
  lines.push(
    `Rules: ${scenario.languageEnglish} only · ${difficulty === "beginner" ? "one or two very short, simple sentences" : "one or two sentences"} · no extra questions, offers or next steps of your own (no "is that right?") · never say the customer's line for them · don't mention this result.`,
  );
  return lines.join("\n");
}

/** Deterministic seeded RNG so a session's variant can be reproduced. */
export function seededRandom(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(items: T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length) % items.length];
}

/* ---------- helpers for scenario authors ---------- */

type Extra = Partial<Omit<Outcome, "kind" | "nextStageId" | "directive" | "meaning">>;

export function advance(to: string, directive: string, meaning: string, extra: Extra = {}): Outcome {
  return {
    kind: "advance",
    success: true,
    answeredQuestion: true,
    reaction: "positive",
    nextStageId: to,
    directive,
    meaning,
    ...extra,
  };
}

export function stay(
  kind: "info" | "branch",
  stageId: string,
  directive: string,
  meaning: string,
  extra: Extra = {},
): Outcome {
  return {
    kind,
    success: true,
    answeredQuestion: true,
    reaction: kind === "branch" ? "neutral" : "positive",
    nextStageId: stageId,
    directive,
    meaning,
    ...extra,
  };
}

export function complete(stageId: string, directive: string, meaning: string, extra: Extra = {}): Outcome {
  return {
    kind: "complete",
    success: true,
    answeredQuestion: true,
    reaction: "positive",
    nextStageId: stageId,
    directive,
    meaning,
    objectiveComplete: true,
    finished: true,
    ...extra,
  };
}

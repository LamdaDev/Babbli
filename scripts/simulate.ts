/**
 * Offline check of the scenario state machines (no ElevenLabs calls):
 *   npm run simulate
 * Plays every scenario × difficulty × many seeds with scripted learners that
 * report card intents the way the NPC agent's tool would, and verifies:
 * - every run reaches the objective without dead-ends;
 * - every card offered is understood in its stage (never a "didn't understand" outcome);
 * - with randomized cards: every draw has a way forward, and an answered question
 *   is never offered again in the same stage.
 */
import { buildNpcPrompt, buildToolConfig } from "@/lib/engine/agentConfig";
import { cardKey, createInitialState, currentCards, formatDirective, getStage, normalizeReport, resolveTurn, seededRandom } from "@/lib/engine/engine";
import { SCENARIOS } from "@/lib/scenarios";
import type { Difficulty, IntentCard } from "@/lib/scenarios/types";

const DIFFS: Difficulty[] = ["beginner", "intermediate", "immersion"];
const SEEDS = 90;
const LEARNER_CLARIFY = new Set(["ask_repeat", "ask_slower", "ask_meaning"]);
type Bot = "core" | "random" | "curious";
const BOTS: Bot[] = ["core", "random", "curious"];

let failures = 0;
const reported = new Set<string>();
const fail = (msg: string) => {
  failures++;
  if (!reported.has(msg)) console.error(`✗ ${msg}`);
  reported.add(msg);
};
const stats: Record<string, { runs: number; turns: number; branches: number; clarifies: number }> = {};
/** Distinct cards / three-card draws seen per scenario stage (randomized scenarios). */
const variety: Record<string, { cards: Set<string>; draws: Set<string> }> = {};

/** Picks the card a scripted learner would choose. */
function choose(bot: Bot, cards: IntentCard[], rand: () => number): IntentCard {
  if (bot === "core") return cards.find((c) => c.core) ?? cards[0];
  if (bot === "curious") {
    // Asks every side question it's offered before moving on.
    const side = cards.filter((c) => !c.core && !LEARNER_CLARIFY.has(c.id));
    if (side.length) return side[Math.floor(rand() * side.length)];
    return cards.find((c) => c.core) ?? cards[0];
  }
  return cards[Math.floor(rand() * cards.length)];
}

for (const scenario of SCENARIOS) {
  const tool = buildToolConfig(scenario);
  const intents = (tool.parameters.properties.intent as { enum: string[] }).enum;
  const sceneIntents = Object.keys(scenario.intents);

  // Only a genuinely unclear, off-topic or wrong-language reply may count as "not understood" —
  // any other label (even one that doesn't fit the step) gets an honest in-character reply.
  for (const stage of scenario.stages) {
    for (const intent of intents) {
      if (intent === "unintelligible" || intent === "off_topic") continue;
      const state = { ...createInitialState(scenario), stageId: stage.id };
      const variant = scenario.makeVariant("intermediate", seededRandom(3));
      const report = normalizeReport(scenario, { intent, heard: "", answered_question: true, language: "target" });
      const own = stage.resolve({ report, state, variant, difficulty: "intermediate", slot: () => "" });
      const { outcome } = resolveTurn(scenario, state, report, variant, "intermediate");
      if (outcome.kind === "clarify" && own?.kind !== "clarify") fail(`${scenario.id}/${stage.id}: intent "${intent}" falls through to "not understood"`);
    }
  }
  for (const difficulty of DIFFS) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const bot = BOTS[seed % BOTS.length];
      const rand = seededRandom(seed * 97);
      const variant = scenario.makeVariant(difficulty, seededRandom(seed));
      const drawSeed = seed * 7919;
      let state = createInitialState(scenario);
      const key = `${scenario.id}/${difficulty}`;
      stats[key] ??= { runs: 0, turns: 0, branches: 0, clarifies: 0 };
      let turns = 0;
      while (!state.finished && turns < 60) {
        turns++;
        const stage = getStage(scenario, state.stageId);
        const bank = stage.cards({ state, variant, difficulty });
        const bankKeys = bank.map(cardKey);
        if (new Set(bankKeys).size !== bankKeys.length) fail(`${scenario.id}/${stage.id}: duplicate card keys ${bankKeys.join(", ")}`);
        const cards = currentCards(scenario, state, variant, difficulty, drawSeed);
        for (const c of cards) if (!intents.includes(c.id)) fail(`${scenario.id}/${stage.id}: card intent "${c.id}" missing from tool enum`);
        if (scenario.randomizeCards) {
          const v = (variety[`${scenario.id}/${stage.id}`] ??= { cards: new Set(), draws: new Set() });
          cards.forEach((c) => v.cards.add(cardKey(c)));
          v.draws.add(cards.map(cardKey).sort().join("+"));
          if (bank.some((c) => c.core && !(state.usedCards ?? []).includes(cardKey(c))) && !cards.some((c) => c.core))
            fail(`${scenario.id}/${stage.id}: a draw with no card that moves the scene forward (${cards.map(cardKey).join(", ")})`);
          const reoffered = cards.filter((c) => (state.usedCards ?? []).includes(cardKey(c)));
          if (reoffered.length && bank.some((c) => !(state.usedCards ?? []).includes(cardKey(c))))
            fail(`${scenario.id}/${stage.id}: already-answered question offered again (${reoffered.map(cardKey).join(", ")})`);
        }
        const fumble = bot === "random" && rand() < 0.15;
        const card = choose(bot, cards, rand);
        // The agent's label is a best guess: often it picks a neighbouring intent or a bare yes
        // for words that clearly carry the card's meaning (e.g. "take_it" + color=navy).
        const r = rand();
        const label = r < 0.25 ? sceneIntents[Math.floor(rand() * sceneIntents.length)] : r < 0.35 ? "yes" : card.id;
        const params: Record<string, unknown> = fumble
          ? { intent: rand() < 0.5 ? "unintelligible" : "off_topic", heard: "…", answered_question: false, language: "target" }
          : { intent: label, heard: card.hints.full, answered_question: true, language: "target", ...(card.expect ?? {}) };
        const report = normalizeReport(scenario, params);
        const { outcome, state: next } = resolveTurn(scenario, state, report, variant, difficulty, card);
        if (!fumble && outcome.kind === "clarify")
          fail(`${scenario.id}/${stage.id}: card "${cardKey(card)}" said correctly but labeled "${label}" → treated as not understood`);
        const directive = formatDirective(scenario, outcome, next, difficulty);
        if (!directive.includes("NEXT LINE")) throw new Error("bad directive");
        if (outcome.kind === "branch") stats[key].branches++;
        if (outcome.kind === "clarify") stats[key].clarifies++;
        state = next;
      }
      stats[key].runs++;
      stats[key].turns += turns;
      if (!state.finished || !state.objectiveComplete) {
        fail(`${key} seed ${seed} (${bot} learner) stuck at "${state.stageId}" after ${turns} turns`);
      }
    }
  }
  const prompt = buildNpcPrompt({ scenario, difficulty: "intermediate", variant: scenario.makeVariant("intermediate", seededRandom(1)) });
  if (prompt.length > 12000) fail(`${scenario.id}: prompt unexpectedly long (${prompt.length})`);
}

console.table(
  Object.fromEntries(
    Object.entries(stats).map(([k, s]) => [
      k,
      { runs: s.runs, "avg turns": +(s.turns / s.runs).toFixed(1), "branches/run": +(s.branches / s.runs).toFixed(2), "clarify/run": +(s.clarifies / s.runs).toFixed(2) },
    ]),
  ),
);
if (Object.keys(variety).length) {
  console.log("\nRandomized cards: distinct cards and distinct three-card draws seen per stage");
  console.table(Object.fromEntries(Object.entries(variety).map(([k, v]) => [k, { cards: v.cards.size, draws: v.draws.size }])));
}
if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\n✓ All scenario runs reached their objective, and every card offered was understood.");

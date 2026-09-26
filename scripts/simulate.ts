/**
 * Offline check of the scenario state machines (no ElevenLabs calls):
 *   npm run simulate
 * Plays every scenario × difficulty × many seeds with a scripted learner that
 * reports card intents the way the NPC agent's tool would, and verifies every
 * run reaches the objective without dead-ends.
 */
import { buildNpcPrompt, buildToolConfig } from "@/lib/engine/agentConfig";
import { createInitialState, currentCards, formatDirective, normalizeReport, resolveTurn, seededRandom } from "@/lib/engine/engine";
import { SCENARIOS } from "@/lib/scenarios";
import type { Difficulty } from "@/lib/scenarios/types";

const DIFFS: Difficulty[] = ["beginner", "intermediate", "immersion"];
let failures = 0;
const stats: Record<string, { runs: number; turns: number; branches: number; clarifies: number }> = {};

for (const scenario of SCENARIOS) {
  const tool = buildToolConfig(scenario);
  const intents = (tool.parameters.properties.intent as { enum: string[] }).enum;
  for (const card of scenario.stages.flatMap((s) => s.cards({ state: createInitialState(scenario), variant: scenario.makeVariant("immersion", seededRandom(1)), difficulty: "immersion" }))) {
    if (!intents.includes(card.id)) {
      console.error(`✗ ${scenario.id}: card intent "${card.id}" missing from tool enum`);
      failures++;
    }
  }
  for (const difficulty of DIFFS) {
    for (let seed = 1; seed <= 60; seed++) {
      const rand = seededRandom(seed * 97);
      const variant = scenario.makeVariant(difficulty, seededRandom(seed));
      let state = createInitialState(scenario);
      const key = `${scenario.id}/${difficulty}`;
      stats[key] ??= { runs: 0, turns: 0, branches: 0, clarifies: 0 };
      // Half the runs always take the first card; the rest pick randomly and sometimes fumble.
      const randomBot = seed % 2 === 0;
      let turns = 0;
      while (!state.finished && turns < 60) {
        turns++;
        const cards = currentCards(scenario, state, variant, difficulty);
        const fumble = randomBot && rand() < 0.15;
        const card = randomBot ? cards[Math.floor(rand() * cards.length)] : cards[0];
        const params: Record<string, unknown> = fumble
          ? { intent: rand() < 0.5 ? "unintelligible" : "off_topic", heard: "…", answered_question: false, language: "target" }
          : { intent: card.id, heard: card.hints.full, answered_question: true, language: "target", ...(card.expect ?? {}) };
        const report = normalizeReport(scenario, params);
        const { outcome, state: next } = resolveTurn(scenario, state, report, variant, difficulty);
        const directive = formatDirective(scenario, outcome, next, difficulty);
        if (!directive.includes("NEXT LINE")) throw new Error("bad directive");
        if (outcome.kind === "branch") stats[key].branches++;
        if (outcome.kind === "clarify") stats[key].clarifies++;
        state = next;
      }
      stats[key].runs++;
      stats[key].turns += turns;
      if (!state.finished || !state.objectiveComplete) {
        failures++;
        console.error(`✗ ${key} seed ${seed} (${randomBot ? "random" : "first-card"}) stuck at "${state.stageId}" after ${turns} turns`, variant);
      }
    }
  }
  const prompt = buildNpcPrompt({ scenario, difficulty: "intermediate", variant: scenario.makeVariant("intermediate", seededRandom(1)) });
  if (prompt.length > 12000) {
    console.error(`✗ ${scenario.id}: prompt unexpectedly long (${prompt.length})`);
    failures++;
  }
}

console.table(
  Object.fromEntries(
    Object.entries(stats).map(([k, s]) => [
      k,
      { runs: s.runs, "avg turns": +(s.turns / s.runs).toFixed(1), "branches/run": +(s.branches / s.runs).toFixed(2), "clarify/run": +(s.clarifies / s.runs).toFixed(2) },
    ]),
  ),
);
if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\n✓ All scenario runs reached their objective.");

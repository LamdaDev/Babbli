import { allIntentIds, describeSlots, getStage } from "@/lib/engine/engine";
import { GENERIC_INTENTS, type Difficulty, type ScenarioDef, type ScenarioState, type Variant } from "@/lib/scenarios/types";

/** Client tool the NPC agent calls after every learner utterance. */
export function toolName(scenario: ScenarioDef) {
  return `babbli_report_turn_${scenario.id}`;
}

export function buildToolConfig(scenario: ScenarioDef) {
  const intents = allIntentIds(scenario);
  const intentGuide = intents
    .map((id) => `${id} = ${scenario.intents[id] ?? GENERIC_INTENTS[id]}`)
    .join("; ");
  const properties: Record<string, Record<string, unknown>> = {
    heard: {
      type: "string",
      description: `The customer's words exactly as you heard them, in the original language.`,
    },
    intent: {
      type: "string",
      enum: intents,
      description: `What the customer is trying to do with this utterance, given what you just said. Anything connected to this scene (questions, small talk, changing their mind, asking for something else) gets the closest intent. Use off_topic only for things unrelated to the scene, and unintelligible only if you couldn't make out the words. A bare yes/no answer is "yes"/"no". Be honest: the learner is being evaluated. ${intentGuide}`,
    },
    answered_question: {
      type: "boolean",
      description: "true only if the utterance actually responds to what you last said or asked.",
    },
    language: {
      type: "string",
      enum: ["target", "english", "mixed", "other"],
      description:
        scenario.language === "en"
          ? "Language the customer used. target = English; mixed = mostly English with a few words from another language; other = a different language."
          : `Language the customer used. target = ${scenario.languageEnglish}; mixed = mostly ${scenario.languageEnglish} with some English words.`,
    },
    politeness: {
      type: "string",
      enum: ["polite", "casual", "rude"],
      description: "Register of the customer's utterance.",
    },
  };
  for (const [name, spec] of Object.entries(scenario.slots)) {
    properties[name] = spec.values
      ? { type: "string", enum: [...spec.values, "none"], description: `${spec.description}. Use "none" if not mentioned.` }
      : { type: "string", description: `${spec.description}. Use "none" if not mentioned.` };
  }
  return {
    type: "client",
    name: toolName(scenario),
    description:
      "Report your interpretation of what the customer just said. You MUST call this after EVERY customer utterance, before you speak. The result tells you what happens next and what to say. Fill the slots with what THIS utterance says or agrees to (if you offered navy and they said \"yes, that one\", that's color=navy), and don't repeat values from earlier turns.",
    parameters: {
      type: "object",
      required: ["heard", "intent", "answered_question", "language"],
      properties,
    },
    expects_response: true,
    response_timeout_secs: 20,
    pre_tool_speech: "off",
    execution_mode: "immediate",
  };
}

/**
 * Sent as a silent contextual update when the NPC answered without calling the report tool:
 * the engine never saw that turn, so the NPC must not build on what it just improvised.
 */
export function buildResyncNote(scenario: ScenarioDef, state: ScenarioState) {
  const stage = getStage(scenario, state.stageId);
  return [
    "BABBLI ENGINE NOTE (not from the customer, don't reply to this)",
    `You answered the customer's last message without calling the \`${toolName(scenario)}\` tool, so the engine never saw it and nothing in that reply happened in the scene.`,
    `The scene is still at: ${stage.group}. ${stage.npcGoal}`,
    `Recorded so far: ${describeSlots(scenario, state.slots)}`,
    "Don't build on your last reply. When the customer speaks again, call the tool FIRST, even for one-word answers, then say only what its NEXT LINE tells you.",
  ].join("\n");
}

const NUDGE: Record<string, string> = { en: "Everything okay over there?", ja: "お決まりですか？", fr: "Alors ?", es: "¿Sí?", zh: "您好，想好了吗？", ko: "손님, 천천히 하셔도 돼요~" };

function languageRule(scenario: ScenarioDef) {
  if (scenario.language === "en")
    return "Speak ONLY natural American English. If the customer uses another language, stay in English and kindly ask them to try in English. Never translate for them.";
  if (scenario.language === "zh")
    return "Speak ONLY Mandarin Chinese (standard mainland Putonghua), written in Simplified Chinese characters. Never English, never pinyin, never Traditional characters, and never translate for them. The customer may type pinyin instead of characters in Text Mode: treat it as Mandarin.";
  if (scenario.language === "ko")
    return 'Speak ONLY Korean (standard Seoul Korean), written in Hangul. Never English, never romanization, never Hanja, and never translate for them. Write numbers as Hangul words, never digits: prices in Sino-Korean (구천이백 원), counts in native Korean (두 개), phone numbers digit by digit with 공 for zero, and 1+1 as 원 플러스 원. The customer may type romanized Korean (e.g. "igeo gyesanhae juseyo") in Text Mode: treat it as Korean.';
  const lang = scenario.languageEnglish;
  return `Speak ONLY ${lang}. Never English, not even if the customer speaks English. Never translate for them.`;
}

function styleFor(difficulty: Difficulty, scenario: ScenarioDef) {
  const role = scenario.npc.role.toLowerCase();
  if (difficulty === "beginner")
    return `The learner is a BEGINNER. Speak slowly and clearly using standard polite forms and very common words. Short sentences (about 12 words max). Be warm, patient and encouraging.`;
  if (difficulty === "intermediate")
    return `The learner is INTERMEDIATE. Use natural speed and the natural phrasing a real ${role} uses (including set service expressions). Where natural, add a small, relevant follow-up question, as a real ${role} would.`;
  return `IMMERSION mode. Speak exactly like a real, busy native ${role}: native speed, colloquial phrasing, contractions and set expressions. Do NOT simplify on your own; only repeat or slow down if the customer explicitly asks. When you don't understand, react the way a native would (a quick "…?" / "sorry?"), not with a simplified explanation.`;
}

export function buildNpcPrompt(opts: {
  scenario: ScenarioDef;
  difficulty: Difficulty;
  variant: Variant;
  stageId?: string;
  /** How to refer to the learner (their pronouns), from the Traveler Profile. */
  learner?: string | null;
}) {
  const { scenario, difficulty, variant } = opts;
  const lang = scenario.languageEnglish;
  const stage = getStage(scenario, opts.stageId ?? scenario.initialStage);
  return `# Role
${scenario.persona}
You are a character in Babbli, an immersive language-practice simulator. The person in front of you is a learner practicing ${lang}. To them you are a real ${scenario.npc.role.toLowerCase()} in ${scenario.city}. Stay fully in character at all times.

# Facts for this visit (never contradict these)
${scenario.facts(variant, difficulty)}
${opts.learner ? `\n# The customer\n${opts.learner}\n` : ""}
# How every turn works (critical)
1. Whenever the customer says anything, even a one-word answer like "yes", "no", "thanks", "oui" or "non", FIRST call the \`${toolName(scenario)}\` tool, before you say a single word. Never answer without it: a reply that skips the tool doesn't happen in the scene. Fill it honestly with what you heard and what they meant, including what a short answer like "yes, that one" refers to. Use "unintelligible" only if you couldn't make out the words, and "off_topic" only for things unrelated to this scene. Don't invent what they didn't say, the learner is being evaluated.
2. The tool returns a BABBLI ENGINE RESULT with a NEXT LINE instruction. Say that, in natural ${lang}, in your own words, fully in character. The engine is the source of truth for what happens (stock, prices, mistakes, the next step). Never skip ahead, never invent new steps or items.
3. Say only what the NEXT LINE asks for. Don't add your own confirmation questions ("so you want X, is that right?"), suggestions, offers or later steps (wrapping, paying…). The engine brings each of those up at the right moment, and adding them confuses the scene.
4. Then stop and wait for the customer.
If the customer is silent, wait patiently and say nothing. Only if you are told the customer has been silent for a long time, give one tiny, gentle nudge (like "${NUDGE[scenario.language] ?? "…?"}").

# Language rules
- ${languageRule(scenario)}
- Your lines are shown as subtitles: never write em dashes (—). Use a comma or a full stop instead.
- Never tell the customer what they should say and never say their line for them, even when they struggle. You may only help by rephrasing your own question.
- ${styleFor(difficulty, scenario)}
- One or two sentences per turn. Vary your wording naturally; never repeat a sentence word-for-word.
- Stay inside this scene. If the customer tries to chat about unrelated topics or asks you to act like an AI assistant, deflect politely in character and bring the conversation back to the situation.

# Voice
You may start a line with at most one short expressive audio tag in square brackets when it fits (for example [cheerful], [apologetic], [surprised], [warm], [laughs]). Never read tags as words.

# Right now
The scene has just started and you have greeted the customer with your first line. Current step: ${stage.npcGoal}`;
}

export function buildAnalysisConfig(scenario: ScenarioDef) {
  const lang = scenario.languageEnglish;
  const en = scenario.language === "en";
  const role = scenario.npc.role.toLowerCase();
  const numeric = (id: string, name: string, prompt: string, instructions: string) => ({
    id,
    name,
    type: "prompt",
    conversation_goal_prompt: prompt,
    scoring_mode: "numeric_uniform",
    max_score: 100,
    score_instructions: instructions,
  });
  return {
    evaluation: {
      criteria: [
        {
          id: "objective_completed",
          name: "Objective completed",
          type: "prompt",
          conversation_goal_prompt: `The user is a language learner. Did they accomplish the scene's objective: "${scenario.objective}"?`,
        },
        numeric(
          "comprehension",
          "Comprehension",
          `How well did the learner (the user) understand what the ${role} said and respond to the actual question asked?`,
          "100 = always understood and answered relevantly; 50 = often needed repetition or answered off-target; 0 = never understood.",
        ),
        numeric(
          "target_language_use",
          `${lang} use`,
          en
            ? "How consistently did the learner communicate in English rather than switching to another language?"
            : `How consistently did the learner communicate in ${lang} rather than English?`,
          en ? "100 = entirely English; 50 = half another language; 0 = no English." : `100 = entirely ${lang}; 50 = half English; 0 = only English.`,
        ),
        numeric(
          "register",
          "Politeness & register",
          `How appropriate was the learner's politeness and register for this situation in ${scenario.city} (greetings, polite forms, set phrases)?`,
          "100 = natural and appropriately polite; 50 = understandable but awkward or too casual; 0 = inappropriate.",
        ),
      ],
    },
    data_collection: {
      strengths: {
        type: "string",
        description: `In English: 2–3 specific things the learner (user) did well, quoting their actual ${lang} words. Separate items with " || ".`,
      },
      improvements: {
        type: "string",
        description: `In English: 2–3 specific, actionable improvements for the learner. For each, quote what they said and give a more natural ${lang} phrasing to use next time. Separate items with " || ".`,
      },
      npc_translations: {
        type: "string",
        description: en
          ? `Every line the ${role} (the agent) said, in order, each formatted "<original> => <the same meaning in very simple English>", separated by " || ".`
          : `Every line the ${role} (the agent) said, in order, each formatted "<original ${lang}> => <natural English translation>", separated by " || ".`,
      },
      key_expressions: {
        type: "string",
        description: en
          ? `4–8 useful English expressions or idioms that came up in this conversation, each formatted "<expression> => <what it means, in simple English>", separated by " || ".`
          : `4–8 useful ${lang} expressions that came up in this conversation, each formatted "<expression> => <English meaning>", separated by " || ".`,
      },
      learner_errors: {
        type: "string",
        description: `Mistakes the learner made (grammar, vocabulary, politeness), each formatted "<what they said> => <better version> (<short reason>)", separated by " || ". Empty string if none.`,
      },
    },
  };
}

/**
 * Scenario definitions are pure data + small deterministic resolver functions.
 * The ElevenLabs agent (the NPC) generates the actual wording; these definitions
 * decide what is true in the world and when the scenario advances.
 */

export type LanguageCode = "en" | "ja" | "fr" | "es";
export type Difficulty = "beginner" | "intermediate" | "immersion";
/** live = ElevenAgents listens to the mic directly; ptt = record → Scribe → text to agent. */
export type InputMode = "live" | "ptt";

export type NpcPose = "idle" | "speaking" | "listening" | "thinking";
export type NpcExpression = "neutral" | "positive" | "confused";
/** The five visual states from the UI spec (derived from pose + expression). */
export type NpcVisual = "idle" | "speaking" | "listening" | "thinking" | "confused" | "positive";

export interface VocabItem {
  term: string;
  reading?: string;
  meaning: string;
}

export interface HintSet {
  /** Level 1: what to communicate, in English, without target-language wording. */
  intent: string;
  /** Level 2: key words / expressions. */
  vocab: VocabItem[];
  /** Level 3: the beginning of a possible response. */
  starter: string;
  /** Level 4: one complete valid response (also used as the native reference phrase). */
  full: string;
  fullReading?: string;
  fullMeaning: string;
}

export interface IntentCard {
  /** Intent id — must be one of the scenario's intents (the agent reports these). */
  id: string;
  /** Unique key when several cards share an intent id (e.g. two different dishes). */
  key?: string;
  /** Slot values this card implies — used to check the learner said what they meant. */
  expect?: Record<string, string>;
  icon: string;
  /** English description of WHAT the learner wants to communicate. Never target language. */
  label: string;
  hints: HintSet;
  /** Target-language words that show the learner used the right vocabulary. */
  keywords: string[];
}

export interface SlotSpec {
  description: string;
  /** Allowed values (enum) — "none" is added automatically. Omit for free text. */
  values?: string[];
}

export interface TurnReport {
  intent: string;
  answered_question: boolean;
  language: "target" | "english" | "mixed" | "other";
  heard: string;
  politeness?: "polite" | "casual" | "rude";
  [slot: string]: unknown;
}

export type OutcomeKind =
  | "advance" // moved the scenario forward
  | "branch" // valid move that triggered a branch (sold out, cash only, …)
  | "info" // valid move, NPC answers, stage unchanged
  | "learner_clarify" // learner asked for repetition / slower / meaning
  | "clarify" // NPC did not understand / reply did not fit
  | "complete"; // objective finished, scene ends after NPC's line

export type SceneEventId =
  | "order_placed"
  | "time_skip"
  | "served"
  | "bill_shown"
  | "payment_done"
  | "key_handed"
  | "passport_given"
  | "issue_found"
  | "issue_resolved"
  | "item_shown"
  | "gift_wrapped";

export interface Outcome {
  kind: OutcomeKind;
  /** Learner communicated what the situation needed. */
  success: boolean;
  /** The utterance responded to what the NPC had just said/asked. */
  answeredQuestion: boolean;
  nextStageId: string;
  /** English instruction for the NPC's next line — returned to the agent. */
  directive: string;
  /** Learner-facing English gist of the NPC's next line (beginner translation). */
  meaning: string;
  reaction: NpcExpression;
  events?: SceneEventId[];
  /** Short learner-facing note (shown in the dashboard). */
  note?: string;
  setSlots?: Record<string, string>;
  setFlags?: Record<string, boolean>;
  objectiveComplete?: boolean;
  finished?: boolean;
}

export interface ScenarioState {
  stageId: string;
  slots: Record<string, string>;
  flags: Record<string, boolean>;
  visited: string[];
  completedStages: string[];
  attemptsInStage: number;
  misses: number;
  recoveries: number;
  learnerClarifications: number;
  objectiveComplete: boolean;
  finished: boolean;
  turnCount: number;
}

export type Variant = Record<string, string | boolean | number>;

export interface ResolveContext {
  report: TurnReport;
  state: ScenarioState;
  variant: Variant;
  difficulty: Difficulty;
  /** Slot value from the report (normalised, "" when missing/none). */
  slot: (name: string) => string;
}

export interface StageDef {
  id: string;
  /** Progress group label shown in the HUD (several stages may share a group). */
  group: string;
  /** English: what the NPC is doing in this stage (used in prompts/directives). */
  npcGoal: string;
  /** English gist of what the NPC says when entering this stage. */
  meaning: string;
  /** Learner-facing explanation of what is being asked (Hint 1 before choosing a card). */
  situation: string;
  cards: (ctx: { state: ScenarioState; variant: Variant; difficulty: Difficulty }) => IntentCard[];
  /** Other intents that are valid here (not shown as cards). */
  extraIntents?: string[];
  resolve: (ctx: ResolveContext) => Outcome | null;
  /** Narration shown when the learner must speak first (no NPC line precedes the stage). */
  learnerOpens?: string;
}

export interface CharacterLook {
  skin: string;
  skinShade: string;
  hair: string;
  hairStyle: "short" | "bob" | "bun" | "curly";
  outfit: string;
  outfitShade: string;
  apron?: string;
  accent: string;
  accessory: "headband" | "scarf" | "badge" | "lanyard";
  eyes: string;
}

export interface NpcDef {
  name: string;
  role: string;
  voiceKey: string;
  look: CharacterLook;
  /** Optional illustrated sprites (PNG/WebP with transparency) — overrides the vector character. */
  sprites?: Partial<Record<NpcVisual, string>>;
}

export interface GreetingLine {
  text: string;
  meaning: string;
}

export interface ScenarioDef {
  id: string;
  language: LanguageCode;
  languageName: string;
  /** English name of language for prompts. */
  languageEnglish: string;
  flag: string;
  city: string;
  locationLabel: string;
  title: string;
  venueName: string;
  objective: string;
  demoRole: "hero" | "generalization";
  blurb: string;
  npc: NpcDef;
  /** Secondary voices heard in the scene (chef, barista, bellhop). */
  backgroundVoices: Record<string, { voiceKey: string; name: string }>;
  art: "store" | "ramen" | "cafe" | "hotel";
  /** Optional illustrated background image — overrides the vector scene. */
  backgroundImage?: string;
  ambienceAsset: string;
  sfx: Record<string, string>;
  briefing: { title: string; lines: string[] };
  stages: StageDef[];
  initialStage: string;
  /** Intent descriptions (all intents the agent may report). */
  intents: Record<string, string>;
  slots: Record<string, SlotSpec>;
  requiredSlots: string[];
  greetings: Record<Difficulty, GreetingLine[]>;
  makeVariant: (difficulty: Difficulty, rand: () => number) => Variant;
  /** Facts the NPC knows for this run (menu, stock, prices, booking…). English. */
  facts: (variant: Variant, difficulty: Difficulty) => string;
  /** Persona & world description for the NPC prompt. English. */
  persona: string;
  asrKeywords: string[];
  /** Vocabulary the dashboard lists as "encountered" (filtered by visited stages). */
  vocabulary: (VocabItem & { stages?: string[] })[];
  /** What a background voice shouts on scene events. */
  eventLines: Partial<Record<SceneEventId, (state: ScenarioState) => { voice: string; text: string; meaning: string }>>;
  timeSkipText: string;
  successTitle: string;
}

export const DIFFICULTIES: { id: Difficulty; label: string; tagline: string; details: string[] }[] = [
  {
    id: "beginner",
    label: "Beginner",
    tagline: "Take it slow",
    details: [
      "Slower NPC speech & simple vocabulary",
      "Target-language subtitles + optional English",
      "Full five-step hint ladder",
    ],
  },
  {
    id: "intermediate",
    label: "Intermediate",
    tagline: "Natural pace",
    details: [
      "Natural speed & phrasing",
      "Target-language subtitles",
      "Unexpected follow-up questions",
    ],
  },
  {
    id: "immersion",
    label: "Immersion",
    tagline: "Just like being there",
    details: [
      "Native speed & colloquial speech",
      "No subtitles by default",
      "Louder ambience & interruptions",
      "You ask for clarification yourself",
    ],
  },
];

export const GENERIC_INTENTS: Record<string, string> = {
  ask_repeat: "Customer asks you to repeat what you said",
  ask_slower: "Customer asks you to speak more slowly",
  ask_meaning: "Customer asks what a word or phrase means",
  greet: "Customer greets you (hello / good evening)",
  thanks: "Customer thanks you",
  goodbye: "Customer says goodbye",
  off_topic: "Utterance is understandable but unrelated to the current situation",
  unintelligible: "You could not understand the customer at all",
};

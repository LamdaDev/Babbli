/**
 * Scenario definitions are pure data + small deterministic resolver functions.
 * The ElevenLabs agent (the NPC) generates the actual wording; these definitions
 * decide what is true in the world and when the scenario advances.
 */

export type LanguageCode = "en" | "ja" | "fr" | "es" | "zh";
export type Difficulty = "beginner" | "intermediate" | "immersion";
/** Voice Mode delivery: live = ElevenAgents listens to the mic directly; ptt = record → Scribe → text to agent. */
export type InputMode = "live" | "ptt";
/**
 * How the learner responds, chosen before the scene. It decides the UI (microphone vs text composer)
 * and which measurements are valid (speech metrics only exist for voice) — never the scenario logic.
 */
export type ResponseMode = "voice" | "text";

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
  /** Moves the scene forward. Every draw of cards includes at least one (see `randomizeCards`). */
  core?: boolean;
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
  /** Cards (by key) whose question was already dealt with in the current stage — not offered again. */
  usedCards?: string[];
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
  /** The stage's card bank (with `randomizeCards`, three are drawn from it each turn). */
  cards: (ctx: { state: ScenarioState; variant: Variant; difficulty: Difficulty }) => IntentCard[];
  /** Other intents that are valid here (not shown as cards). */
  extraIntents?: string[];
  /**
   * Other labels the agent may give a reply that means the same thing in this stage
   * (e.g. "yes" → "gift_wrap" when asked about gift wrapping, "take_it" → "describe_item"
   * when they're naming a color). Tried only when `resolve` doesn't handle the reported intent.
   */
  aliases?: Record<string, string>;
  resolve: (ctx: ResolveContext) => Outcome | null;
  /** Narration shown when the learner must speak first (no NPC line precedes the stage). */
  learnerOpens?: string;
}

export type HairStyle = "short" | "buzz" | "middle" | "bob" | "long" | "bun" | "curly" | "ponytail";

export interface CharacterLook {
  skin: string;
  skinShade: string;
  hair: string;
  hairStyle: HairStyle;
  outfit: string;
  outfitShade: string;
  apron?: string;
  accent: string;
  accessory: "headband" | "scarf" | "badge" | "lanyard" | "headset";
  eyes: string;
  /** Narrower shoulders, waist and neck (and everything worn on them). Default: regular. */
  build?: "regular" | "slender";
  /** Light makeup, off by default: lashes at the outer corners, lip and cheek colors. */
  makeup?: { lashes?: boolean; lips?: string; blush?: string };
  /** Headset look: the shop monogram printed on the apron, and the name badge text (default: the NPC's name). */
  apronMark?: string;
  badgeText?: string;
}

export interface NpcDef {
  name: string;
  role: string;
  voiceKey: string;
  look: CharacterLook;
  /** Optional illustrated sprites (PNG/WebP with transparency) — overrides the vector character. */
  sprites?: Partial<Record<NpcVisual, string>>;
}

/**
 * How characters address the learner (from their profile pronouns): feminine for she/her, masculine
 * for he/him, neutral for they/them or custom pronouns. Unset pronouns keep the default text, and so
 * does any form a line doesn't define.
 */
export type AddressForm = "feminine" | "masculine" | "neutral";
/**
 * Variants of a line for languages where addressing someone is gendered (e.g. bienvenido/bienvenida,
 * or Mandarin shop-talk: 帅哥 / 美女 for a young man / woman, where the neutral default is 您).
 */
export type AddressForms = Partial<Record<AddressForm, string>>;

export function inAddressForm(text: string, forms: AddressForms | undefined, form: AddressForm | null): string {
  if (form === "feminine") return forms?.feminine ?? text;
  if (form === "masculine") return forms?.masculine ?? text;
  if (form === "neutral") return forms?.neutral ?? text;
  return text;
}

export interface GreetingLine {
  text: string;
  meaning: string;
  forms?: AddressForms;
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
  /** Short objective for the in-scene HUD (fits on one line). */
  goal: string;
  demoRole: "hero" | "generalization";
  /** The newest destination: shown with a "New" chip on the home screen. */
  isNew?: boolean;
  blurb: string;
  npc: NpcDef;
  /** Secondary voices heard in the scene (chef, barista, bellhop). */
  backgroundVoices: Record<string, { voiceKey: string; name: string }>;
  art: "store" | "ramen" | "cafe" | "hotel" | "boba";
  /** Optional illustrated background image — overrides the vector scene. */
  backgroundImage?: string;
  ambienceAsset: string;
  sfx: Record<string, string>;
  briefing: { title: string; lines: string[] };
  /**
   * Draw three cards per turn from each stage's bank (always keeping one `core` card that moves
   * the scene forward, and never re-offering a question already answered in the stage).
   * Without it, a stage shows its first three cards in order.
   */
  randomizeCards?: boolean;
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
  successTitleForms?: AddressForms;
}

/** `summary`: what to expect, in five words max (shown on the home screen). */
export const DIFFICULTIES: { id: Difficulty; label: string; summary: string }[] = [
  { id: "beginner", label: "Beginner", summary: "Subtitles and full hints" },
  { id: "intermediate", label: "Intermediate", summary: "Natural pace, surprise questions" },
  { id: "immersion", label: "Immersion", summary: "Native speed, no subtitles or hints" },
];

export const GENERIC_INTENTS: Record<string, string> = {
  ask_repeat: "Customer asks you to repeat what you said",
  ask_slower: "Customer asks you to speak more slowly",
  ask_meaning: "Customer asks what a word or phrase means",
  greet: "Customer greets you or makes small talk (hello / how are you / how's your day / busy today?)",
  thanks: "Customer thanks you",
  goodbye: "Customer says goodbye",
  yes: "Customer just says yes / agrees to what you asked or offered (fill the slots with what they're agreeing to)",
  no: "Customer just says no / turns down what you asked or offered",
  off_topic: "Utterance has nothing to do with this scene (unrelated topics, talking to you as an AI)",
  unintelligible: "You could not make out what the customer said at all",
};

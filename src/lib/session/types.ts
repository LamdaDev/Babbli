import type {
  Difficulty,
  InputMode,
  ResponseMode,
  LanguageCode,
  OutcomeKind,
  ScenarioState,
  TurnReport,
  Variant,
} from "@/lib/scenarios/types";

export interface WordTiming {
  text: string;
  start: number;
  end: number;
  /** exp(logprob) from Scribe — recognition confidence, NOT a phoneme score. */
  confidence: number | null;
}

export interface SpeechCapture {
  transcript: string;
  languageCode: string;
  languageProbability: number;
  words: WordTiming[];
  events: string[];
  audioDuration: number;
  model: string;
}

export interface ExpectedIntent {
  intent: string;
  key: string;
  label: string;
  reference: string;
  referenceReading?: string;
  referenceMeaning: string;
  expect?: Record<string, string>;
  keywords: string[];
}

export interface LearnerTurn {
  id: string;
  index: number;
  stageId: string;
  stageGroup: string;
  /** The NPC line the learner is answering. */
  npcPrompt: string;
  npcPromptMeaning: string;
  expected?: ExpectedIntent;
  startedAt: number;
  endedAt?: number;
  inputMethod: "voice" | "text";
  inputMode: InputMode;
  audio?: { mimeType: string; durationMs: number; uploaded: boolean };
  /** What the ElevenAgents NPC heard (live ASR) or the text sent to it. */
  transcriptAgent?: string;
  /** ElevenLabs Scribe transcript with word timings, for evaluation. */
  stt?: SpeechCapture;
  report?: TurnReport;
  outcome?: {
    kind: OutcomeKind;
    success: boolean;
    answeredQuestion: boolean;
    intentMatched: boolean | null;
    /** The intent the engine resolved the reply to (the agent's label can differ — see resolveTurn). */
    intent?: string;
    note?: string;
    nextStageId: string;
  };
  hints: number[];
  repeats: number;
  slows: number;
  translations: number;
}

export interface NpcLine {
  id: string;
  text: string;
  meaning: string;
  stageId: string;
  at: number;
  source: "agent" | "background";
  speaker: string;
}

export interface SessionEvent {
  t: number;
  type: string;
  data?: Record<string, unknown>;
}

export interface AgentAnalysis {
  status: string;
  callSuccessful?: string;
  summary?: string;
  title?: string;
  criteria: {
    id: string;
    name?: string;
    result: string;
    rationale: string;
    score?: number | null;
    maxScore?: number | null;
  }[];
  data: Record<string, { value: unknown; rationale: string }>;
  fetchedAt: string;
}

export interface SessionRecord {
  id: string;
  version: 1;
  scenarioId: string;
  language: LanguageCode;
  difficulty: Difficulty;
  /** Voice or Text Mode (sessions saved before modes existed were voice). Use `responseModeOf`. */
  responseMode?: ResponseMode;
  /** Voice Mode delivery (live / push-to-talk). */
  inputMode: InputMode;
  seed: number;
  startedAt: number;
  endedAt?: number;
  status: "active" | "completed" | "abandoned";
  conversationId?: string;
  agentId?: string;
  variant: Variant;
  state: ScenarioState;
  npcLines: NpcLine[];
  turns: LearnerTurn[];
  events: SessionEvent[];
  assistance: {
    hints: number[];
    translations: number;
    repeats: number;
    slows: number;
    subtitleToggles: number;
    typedTurns: number;
  };
  analysis?: AgentAnalysis;
}

export interface SessionSummary {
  id: string;
  scenarioId: string;
  difficulty: Difficulty;
  responseMode: ResponseMode;
  startedAt: number;
  status: SessionRecord["status"];
  objectiveComplete: boolean;
  turns: number;
}

export function responseModeOf(session: Pick<SessionRecord, "responseMode">): ResponseMode {
  return session.responseMode ?? "voice";
}

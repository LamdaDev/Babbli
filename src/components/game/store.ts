"use client";

import { createStore } from "zustand/vanilla";
import type { IntentCard, NpcExpression, SceneEventId } from "@/lib/scenarios/types";

export type Phase =
  | "briefing"
  | "connecting"
  | "npc"
  | "choose"
  | "speak"
  | "processing"
  | "transition"
  | "ending"
  | "done"
  | "error";

export interface Subtitle {
  id: string;
  text: string;
  meaning: string;
  speaker: string;
  /** Character timings for karaoke highlighting on ElevenLabs TTS replays. */
  karaoke?: { chars: string[]; starts: number[]; t0: number };
}

export interface GameUI {
  phase: Phase;
  error: string | null;
  busyLabel: string | null;
  toast: { id: number; text: string; tone: "info" | "warn" | "good" } | null;

  npcSpeaking: boolean;
  voiceOwner: "npc" | "coach" | null;
  expression: NpcExpression;
  subtitle: Subtitle | null;
  showSubtitles: boolean;
  showTranslation: boolean;
  translationAllowed: boolean;

  stageId: string;
  cards: IntentCard[];
  selectedCard: IntentCard | null;
  progress: { label: string; status: "done" | "active" | "todo" }[];
  narration: string | null;

  hintLevel: number;
  hintOpen: boolean;
  hintBusy: boolean;

  micMuted: boolean;
  recording: boolean;
  micAvailable: boolean;
  inputMode: "live" | "ptt";

  world: SceneEventId[];
  timeSkipped: boolean;
  slots: Record<string, string>;
  flags: Record<string, boolean>;
  transitionText: string | null;
  completion: { objectiveComplete: boolean } | null;
  sessionId: string;
  /** The page was opened without a prior click, so one tap is needed before audio + mic. */
  needsTap: boolean;
}

export type GameStore = ReturnType<typeof createGameStore>;

export function createGameStore(initial: GameUI) {
  return createStore<GameUI>(() => initial);
}

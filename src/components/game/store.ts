"use client";

import { createStore } from "zustand/vanilla";
import type { BadgeId } from "@/lib/profile/badges";
import type { IntentCard, NpcExpression, ResponseMode, SceneEventId } from "@/lib/scenarios/types";

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
  /** Optional way out of the error (e.g. "Switch to Text Mode"). */
  errorAction: { label: string; href: string } | null;
  busyLabel: string | null;
  toast: { id: number; text: string; tone: "info" | "warn" | "good" } | null;

  npcSpeaking: boolean;
  voiceOwner: "npc" | "coach" | null;
  expression: NpcExpression;
  subtitle: Subtitle | null;
  /** What the mic is registering while the learner speaks (live), then the final transcript. */
  userCaption: { text: string; final: boolean } | null;
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
  /** The "Need help?" stack in the bottom-right corner is expanded. */
  helpOpen: boolean;
  hintBusy: boolean;

  micMuted: boolean;
  recording: boolean;
  /** Per-turn speaking time limit (drives the countdown ring on the mic). */
  turnTimer: { startedAt: number; ms: number; total: number } | null;
  micAvailable: boolean;
  inputMode: "live" | "ptt";
  /** Voice or Text Mode, fixed for the session (chosen before the scene). */
  responseMode: ResponseMode;

  world: SceneEventId[];
  timeSkipped: boolean;
  slots: Record<string, string>;
  flags: Record<string, boolean>;
  transitionText: string | null;
  /** badges: passport pins this scene unlocked (cosmetic). */
  completion: { objectiveComplete: boolean; badges?: BadgeId[] } | null;
  sessionId: string;
  /** The page was opened without a prior click, so one tap is needed before audio + mic. */
  needsTap: boolean;
}

export type GameStore = ReturnType<typeof createGameStore>;

export function createGameStore(initial: GameUI) {
  return createStore<GameUI>(() => initial);
}

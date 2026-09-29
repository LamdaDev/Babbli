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
  /** busy: the conversation couldn't start (e.g. traffic); lost: it dropped mid-scene; mic: no microphone; setup: no API key. */
  errorKind: "busy" | "lost" | "mic" | "setup" | null;
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
  /** badges: passport pins this scene unlocked (cosmetic). saveFailed: the final save didn't go through. */
  completion: { objectiveComplete: boolean; badges?: BadgeId[]; saveFailed?: boolean } | null;
  /** Entering the scene: how far the connection has got (0 to 1), shown on the curtain. */
  loadProgress: number | null;
  /** Ending the scene: what's being saved and how far along (0 to 1), shown on the completion card. */
  saveProgress: { label: string; value: number } | null;
  /** "Still there?": nobody has done anything for a while; the scene ends by itself at endsAt. */
  idle: { endsAt: number } | null;
  /** Why the scene ended by itself (nobody there, or the tab left in the background). */
  endReason: "idle" | "hidden" | null;
  sessionId: string;
  /** The page was opened without a prior click, so one tap is needed before audio + mic. */
  needsTap: boolean;
}

export type GameStore = ReturnType<typeof createGameStore>;

export function createGameStore(initial: GameUI) {
  return createStore<GameUI>(() => initial);
}

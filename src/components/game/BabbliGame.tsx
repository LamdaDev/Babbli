"use client";

import { ConversationProvider, useConversationControls } from "@elevenlabs/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "zustand";
import { getScenario } from "@/lib/scenarios";
import type { Difficulty, InputMode, ResponseMode } from "@/lib/scenarios/types";
import { ChoicePanel } from "./ChoicePanel";
import { GameController } from "./controller";
import { ExitConfirmation } from "./ExitConfirmation";
import { GameContext, useController, useGame } from "./GameContext";
import { HintPanel } from "./HintPanel";
import { NPCSubtitle } from "./NPCSubtitle";
import { CompletionOverlay, EntryCurtain, ErrorOverlay, InAppGate, StillThere, TapToEnter, Toast, TransitionOverlay } from "./Overlays";
import { ScenarioHUD } from "./ScenarioHUD";
import { SceneRenderer } from "./SceneRenderer";
import { SpeakingInterface } from "./SpeakingInterface";
import { UtilityControls } from "./UtilityControls";

/** Hands the ElevenAgents SDK controls to the game controller. */
function ConversationBridge() {
  const controls = useConversationControls();
  const controller = useController();
  useEffect(() => controller.attach(controls), [controller, controls]);
  return null;
}

function useKeyboard(disabled: boolean) {
  const c = useController();
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const s = c.store.getState();
      if (["1", "2", "3"].includes(e.key) && s.phase === "choose" && !s.npcSpeaking) {
        const card = s.cards[Number(e.key) - 1];
        if (card) c.chooseCard(card);
      } else if (e.code === "Space") {
        if (s.phase === "speak") {
          e.preventDefault();
          void c.finishSpeaking();
        } else if (s.phase === "choose" && !s.npcSpeaking && (s.micAvailable || s.responseMode === "text")) {
          e.preventDefault();
          c.speakFreely();
        }
      } else if (e.key === "h" || e.key === "H") c.toggleHints();
      else if (e.key === "r" || e.key === "R") void c.replay(false);
      else if (e.key === "s" || e.key === "S") void c.replay(true);
      else if (e.key === "c" || e.key === "C") c.toggleSubtitles();
      else if (e.key === "t" || e.key === "T") c.toggleTranslation();
      else if (e.key === "Escape") c.closeHints();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [c, disabled]);
}

function GameScreen() {
  const controller = useController();
  const router = useRouter();
  const phase = useGame((s) => s.phase);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const exitOpen = confirmingLeave && phase !== "ending" && phase !== "done";
  // Game shortcuts are off while the exit dialog is open.
  useKeyboard(exitOpen);
  // Enter the scene right away (deferred a tick so a StrictMode remount doesn't start it twice).
  useEffect(() => {
    const t = setTimeout(() => controller.autoEnter(), 0);
    return () => clearTimeout(t);
  }, [controller]);
  const leave = () => {
    if (phase === "briefing") {
      router.push("/");
      return;
    }
    if (phase === "ending" || phase === "done" || exitOpen) return;
    controller.holdTurnTimer();
    setConfirmingLeave(true);
  };
  const cancelLeave = useCallback(() => {
    setConfirmingLeave(false);
    controller.resumeTurnTimer();
  }, [controller]);
  const confirmLeave = () => {
    setConfirmingLeave(false);
    void controller.finish("abandoned");
  };
  return (
    <main className="relative h-dvh w-full select-none overflow-hidden bg-night">
      <SceneRenderer blurred={phase === "briefing" || phase === "error"} />
      {phase !== "briefing" && <ScenarioHUD onLeave={leave} />}
      <NPCSubtitle />
      <ChoicePanel />
      <SpeakingInterface />
      <HintPanel />
      <UtilityControls />
      <EntryCurtain />
      <TransitionOverlay />
      <TapToEnter />
      <InAppGate />
      <StillThere />
      <CompletionOverlay />
      <ErrorOverlay />
      <Toast />
      <ExitConfirmation open={exitOpen} onCancel={cancelLeave} onConfirm={confirmLeave} />
      {phase === "briefing" && (
        <button onClick={leave} className="absolute left-4 top-4 z-50 rounded-full bg-night/70 px-3 py-1.5 text-xs font-bold text-cream backdrop-blur">
          ← Back
        </button>
      )}
    </main>
  );
}

function GameWithConversation({ controller }: { controller: GameController }) {
  const micMuted = useStore(controller.store, (s) => s.micMuted);
  // Text Mode has no microphone: a text-only conversation throws on setMicMuted, so leave mute uncontrolled.
  return (
    <GameContext.Provider value={controller}>
      <ConversationProvider isMuted={controller.responseMode === "text" ? undefined : micMuted}>
        <ConversationBridge />
        <GameScreen />
      </ConversationProvider>
    </GameContext.Provider>
  );
}

export default function BabbliGame({
  scenarioId,
  difficulty,
  responseMode,
  inputMode,
}: {
  scenarioId: string;
  difficulty: Difficulty;
  responseMode: ResponseMode;
  inputMode: InputMode;
}) {
  // Constructing a controller has no side effects; everything starts in controller.enter().
  const [controller] = useState(() => new GameController(getScenario(scenarioId)!, difficulty, inputMode, responseMode));
  useEffect(() => {
    controller.activate();
    // Dev-only handle for inspecting/driving game state from the browser console.
    if (process.env.NODE_ENV === "development") (window as unknown as { __babbli?: GameController }).__babbli = controller;
    return () => controller.dispose();
  }, [controller]);
  return <GameWithConversation controller={controller} />;
}

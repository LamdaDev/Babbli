"use client";

import dynamic from "next/dynamic";
import type { Difficulty, InputMode } from "@/lib/scenarios/types";

// The game touches Web Audio, MediaRecorder and the ElevenAgents websocket — client only.
const BabbliGame = dynamic(() => import("@/components/game/BabbliGame"), {
  ssr: false,
  loading: () => <main className="h-dvh w-full bg-night" />,
});

export function GameClient(props: { scenarioId: string; difficulty: Difficulty; inputMode: InputMode }) {
  return <BabbliGame key={`${props.scenarioId}-${props.difficulty}-${props.inputMode}`} {...props} />;
}

"use client";

import { useCallback } from "react";
import { Character } from "@/components/art/Character";
import { SCENE_ART } from "@/components/art/scenes";
import { SharedDefs } from "@/components/art/shared";
import type { SceneArtProps } from "@/components/art/types";
import type { NpcExpression, NpcPose, NpcVisual } from "@/lib/scenarios/types";
import { useController, useGame } from "./GameContext";
import type { GameUI } from "./store";

export function npcPoseFor(ui: Pick<GameUI, "npcSpeaking" | "voiceOwner" | "phase" | "expression">): {
  pose: NpcPose;
  expression: NpcExpression;
  visual: NpcVisual;
} {
  if (ui.npcSpeaking && ui.voiceOwner !== "coach") {
    return { pose: "speaking", expression: ui.expression, visual: "speaking" };
  }
  if (ui.phase === "speak") return { pose: "listening", expression: "neutral", visual: "listening" };
  if (ui.phase === "processing" && ui.expression === "neutral") return { pose: "thinking", expression: "neutral", visual: "thinking" };
  const visual: NpcVisual = ui.expression === "confused" ? "confused" : ui.expression === "positive" ? "positive" : "idle";
  return { pose: "idle", expression: ui.expression, visual };
}

/** Full-screen first-person scene: back layer → NPC → counter/foreground layer. */
export function SceneRenderer({ blurred = false }: { blurred?: boolean }) {
  const controller = useController();
  const scenario = controller.scenario;
  const art = SCENE_ART[scenario.art];
  const world = useGame((s) => s.world);
  const stageId = useGame((s) => s.stageId);
  const timeSkipped = useGame((s) => s.timeSkipped);
  const slots = useGame((s) => s.slots);
  const flags = useGame((s) => s.flags);
  const npcSpeaking = useGame((s) => s.npcSpeaking);
  const voiceOwner = useGame((s) => s.voiceOwner);
  const phase = useGame((s) => s.phase);
  const expression = useGame((s) => s.expression);
  const { pose, expression: expr, visual } = npcPoseFor({ npcSpeaking, voiceOwner, phase, expression });

  const getLevel = useCallback(() => controller.npcLevel(), [controller]);
  const getMic = useCallback(() => controller.micLevel(), [controller]);

  const props: SceneArtProps = { variant: controller.session.variant, world, stageId, timeSkipped, slots, flags };
  const sprite = scenario.npc.sprites?.[visual] ?? scenario.npc.sprites?.idle;

  return (
    <div className={`absolute inset-0 overflow-hidden transition-[filter] duration-700 ${blurred ? "blur-[3px] brightness-75" : ""}`}>
      {scenario.backgroundImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={scenario.backgroundImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <svg
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={`${scenario.title}: ${scenario.npc.name}, the ${scenario.npc.role.toLowerCase()}, is ${visual}`}
      >
        <SharedDefs />
        {!scenario.backgroundImage && <art.Back {...props} />}
        <g transform={`translate(${art.npc.x} ${art.npc.y}) scale(${art.npc.scale})`}>
          {sprite ? (
            <image href={sprite} x={0} y={0} width={420} height={560} preserveAspectRatio="xMidYMax meet" />
          ) : (
            <Character look={scenario.npc.look} pose={pose} expression={expr} name={scenario.npc.name} getLevel={getLevel} listeningLevel={getMic} />
          )}
        </g>
        <art.Front {...props} />
      </svg>
    </div>
  );
}

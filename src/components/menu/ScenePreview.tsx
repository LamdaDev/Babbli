"use client";

import { Character } from "@/components/art/Character";
import { SCENE_ART } from "@/components/art/scenes";
import { SharedDefs } from "@/components/art/shared";
import { seededRandom } from "@/lib/engine/engine";
import type { ScenarioDef } from "@/lib/scenarios/types";

const zero = () => 0;

/** A static render of a scenario's scene (used for postcards and backdrops). */
export function ScenePreview({ scenario, className = "" }: { scenario: ScenarioDef; className?: string }) {
  const art = SCENE_ART[scenario.art];
  const props = {
    variant: scenario.makeVariant("beginner", seededRandom(3)),
    world: [],
    stageId: scenario.initialStage,
    timeSkipped: false,
    slots: {},
    flags: {},
  };
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <SharedDefs />
      <art.Back {...props} />
      <g transform={`translate(${art.npc.x} ${art.npc.y}) scale(${art.npc.scale})`}>
        <Character look={scenario.npc.look} pose="idle" expression="positive" name={scenario.npc.name} getLevel={zero} />
      </g>
      <art.Front {...props} />
    </svg>
  );
}

import type { SceneEventId, Variant } from "@/lib/scenarios/types";

export interface SceneArtProps {
  variant: Variant;
  world: SceneEventId[];
  stageId: string;
  timeSkipped: boolean;
  slots: Record<string, string>;
  flags: Record<string, boolean>;
}

export const VIEW_W = 1600;
export const VIEW_H = 900;

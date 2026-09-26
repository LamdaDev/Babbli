import type { ComponentType } from "react";
import type { ScenarioDef } from "@/lib/scenarios/types";
import type { SceneArtProps } from "../types";
import { CAFE_NPC, CafeBack, CafeFront } from "./CafeScene";
import { HOTEL_NPC, HotelBack, HotelFront } from "./HotelScene";
import { RAMEN_NPC, RamenBack, RamenFront } from "./RamenScene";

export interface SceneArt {
  Back: ComponentType<SceneArtProps>;
  Front: ComponentType<SceneArtProps>;
  npc: { x: number; y: number; scale: number };
}

export const SCENE_ART: Record<ScenarioDef["art"], SceneArt> = {
  ramen: { Back: RamenBack, Front: RamenFront, npc: RAMEN_NPC },
  cafe: { Back: CafeBack, Front: CafeFront, npc: CAFE_NPC },
  hotel: { Back: HotelBack, Front: HotelFront, npc: HOTEL_NPC },
};

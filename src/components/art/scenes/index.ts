import { memo, type ComponentType } from "react";
import type { ScenarioDef } from "@/lib/scenarios/types";
import type { SceneArtProps } from "../types";
import { BOBA_NPC, BobaBack, BobaFront } from "./BobaScene";
import { CAFE_NPC, CafeBack, CafeFront } from "./CafeScene";
import { HOTEL_NPC, HotelBack, HotelFront } from "./HotelScene";
import { MIDNIGHT_NPC, MidnightBack, MidnightFront } from "./MidnightScene";
import { RAMEN_NPC, RamenBack, RamenFront } from "./RamenScene";
import { STORE_NPC, StoreBack, StoreFront } from "./StoreScene";

export interface SceneArt {
  Back: ComponentType<SceneArtProps>;
  Front: ComponentType<SceneArtProps>;
  npc: { x: number; y: number; scale: number };
}

// Memoized: the NPC changes pose many times a turn, but the scene art only redraws when the world does.
export const SCENE_ART: Record<ScenarioDef["art"], SceneArt> = {
  store: { Back: memo(StoreBack), Front: memo(StoreFront), npc: STORE_NPC },
  ramen: { Back: memo(RamenBack), Front: memo(RamenFront), npc: RAMEN_NPC },
  cafe: { Back: memo(CafeBack), Front: memo(CafeFront), npc: CAFE_NPC },
  hotel: { Back: memo(HotelBack), Front: memo(HotelFront), npc: HOTEL_NPC },
  boba: { Back: memo(BobaBack), Front: memo(BobaFront), npc: BOBA_NPC },
  midnight: { Back: memo(MidnightBack), Front: memo(MidnightFront), npc: MIDNIGHT_NPC },
};

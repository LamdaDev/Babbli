import type { Difficulty, LanguageCode, ResponseMode } from "@/lib/scenarios/types";

/**
 * Passport pins: purely cosmetic rewards for scenes finished on this device. They are derived from
 * a local list of finished scenes and never feed into scoring.
 */

export type BadgeId = "first_stamp" | "store_pin" | "ramen_pin" | "cafe_pin" | "hotel_pin" | "no_help" | "globetrotter" | "deep_end";
export type PinGlyph = "plane" | "bag" | "ramen" | "cup" | "key" | "star" | "globe" | "wave";

export interface BadgeDef {
  id: BadgeId;
  name: string;
  /** How to earn it (shown while locked). */
  how: string;
  glyph: PinGlyph;
  bg: string;
  fg: string;
}

export const BADGES: BadgeDef[] = [
  { id: "first_stamp", name: "First Stamp", how: "Complete any scene", glyph: "plane", bg: "#13233f", fg: "#f2b84b" },
  { id: "store_pin", name: "Fifth Avenue Shopper", how: "Complete the New York department store", glyph: "bag", bg: "#1f5f5b", fg: "#fbf8f2" },
  { id: "ramen_pin", name: "Ramen Regular", how: "Complete the Tokyo ramen shop", glyph: "ramen", bg: "#c0392b", fg: "#fbf8f2" },
  { id: "cafe_pin", name: "Café Regular", how: "Complete the Paris café", glyph: "cup", bg: "#6b4a33", fg: "#fbf1dc" },
  { id: "hotel_pin", name: "Sevilla Key", how: "Complete the Sevilla hotel check-in", glyph: "key", bg: "#f2b84b", fg: "#13233f" },
  { id: "no_help", name: "No Help Needed", how: "Complete a scene without opening a hint", glyph: "star", bg: "#1b57cb", fg: "#ffe08a" },
  { id: "globetrotter", name: "Globetrotter", how: "Complete scenes in two different languages", glyph: "globe", bg: "#17a898", fg: "#ffffff" },
  { id: "deep_end", name: "Deep End", how: "Complete a scene on Immersion", glyph: "wave", bg: "#0e357e", fg: "#9fd3e0" },
];

export const badgeDef = (id: BadgeId) => BADGES.find((b) => b.id === id)!;

/** One finished scene, as remembered on this device. */
export interface SceneStamp {
  sessionId: string;
  scenarioId: string;
  language: LanguageCode;
  difficulty: Difficulty;
  responseMode: ResponseMode;
  completed: boolean;
  /** Hint levels opened during the scene. */
  hints: number;
  /** Replies so far (stamps saved before this was recorded don't have it). */
  replies?: number;
  at: number;
}

const SCENE_PINS: Record<string, BadgeId> = { store: "store_pin", ramen: "ramen_pin", cafe: "cafe_pin", hotel: "hotel_pin" };

export function earnedBadges(stamps: SceneStamp[]): Set<BadgeId> {
  const done = stamps.filter((s) => s.completed);
  const earned = new Set<BadgeId>();
  if (done.length) earned.add("first_stamp");
  for (const s of done) {
    const pin = SCENE_PINS[s.scenarioId];
    if (pin) earned.add(pin);
    if (s.hints === 0) earned.add("no_help");
    if (s.difficulty === "immersion") earned.add("deep_end");
  }
  if (new Set(done.map((s) => s.language)).size >= 2) earned.add("globetrotter");
  return earned;
}

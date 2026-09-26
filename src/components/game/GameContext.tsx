"use client";

import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { GameController } from "./controller";
import type { GameUI } from "./store";

export const GameContext = createContext<GameController | null>(null);

export function useController() {
  const c = useContext(GameContext);
  if (!c) throw new Error("useController must be used inside <GameContext.Provider>");
  return c;
}

export function useGame<T>(selector: (s: GameUI) => T): T {
  return useStore(useController().store, selector);
}

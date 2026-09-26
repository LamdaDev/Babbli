"use client";

import { Flag } from "@/components/ui/Flag";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { DIFFICULTIES } from "@/lib/scenarios/types";
import { useController, useGame } from "./GameContext";

/** Small, game-like objective & progress readout (top-left) + notes/exit (top-right). */
export function ScenarioHUD({ onLeave }: { onLeave: () => void }) {
  const { scenario, difficulty } = useController();
  const progress = useGame((s) => s.progress);
  const inputMode = useGame((s) => s.inputMode);
  const [notesOpen, setNotesOpen] = useState(false);
  const diff = DIFFICULTIES.find((d) => d.id === difficulty)!;

  return (
    <>
      <div className="pointer-events-none absolute left-3 top-3 z-20 max-w-[min(92vw,420px)] sm:left-5 sm:top-5">
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-night/70 px-4 py-3 text-cream shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.18em] text-gold">
            <Flag code={scenario.language} />
            {scenario.locationLabel}
          </div>
          <div className="mt-1 font-display text-lg leading-tight">{scenario.title}</div>
          <div className="mt-1 text-[13px] leading-snug text-cream/80">
            <span className="font-bold text-cream">Objective · </span>
            {scenario.objective}
          </div>
          <ol className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
            {progress.map((p, i) => (
              <li key={p.label} className="flex items-center gap-1.5">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full border-2 transition-colors ${
                    p.status === "done"
                      ? "border-teal bg-teal"
                      : p.status === "active"
                        ? "border-gold bg-gold/40 shadow-[0_0_10px_rgba(242,184,75,0.8)]"
                        : "border-cream/40"
                  }`}
                />
                <span className={p.status === "todo" ? "text-cream/50" : p.status === "active" ? "font-bold text-gold" : "text-cream/90"}>
                  {p.label}
                </span>
                {i < progress.length - 1 && <span className="text-cream/30">—</span>}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-2 sm:right-5 sm:top-5">
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-night/70 px-3 py-1.5 text-xs font-bold text-cream/90 backdrop-blur sm:inline">
            {diff.label} · {inputMode === "live" ? "🎙 Live" : "✋ Push-to-talk"}
          </span>
          <button
            onClick={() => setNotesOpen((o) => !o)}
            className="rounded-full bg-paper/90 px-3 py-1.5 text-xs font-extrabold text-ink shadow-lg hover:bg-paper"
            aria-expanded={notesOpen}
          >
            📋 {scenario.briefing.title}
          </button>
          <button
            onClick={onLeave}
            className="rounded-full bg-night/70 px-3 py-1.5 text-xs font-bold text-cream/90 backdrop-blur hover:bg-night"
            aria-label="Leave scene"
          >
            ✕ Leave
          </button>
        </div>
        <AnimatePresence>
          {notesOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, rotate: 0 }}
              animate={{ opacity: 1, y: 0, rotate: 1.5 }}
              exit={{ opacity: 0, y: -8 }}
              className="paper-grain w-64 rounded-lg bg-paper p-4 text-sm text-ink shadow-2xl"
            >
              <div className="mb-2 font-display text-base">{scenario.briefing.title}</div>
              <ul className="space-y-1.5">
                {scenario.briefing.lines.map((l) => (
                  <li key={l} className="flex gap-2">
                    <span>•</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

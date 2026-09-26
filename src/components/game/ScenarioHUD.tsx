"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Flag } from "@/components/ui/Flag";
import { DIFFICULTIES } from "@/lib/scenarios/types";
import { useController, useGame } from "./GameContext";

/** Round icon button whose label slides out on hover / keyboard focus. */
function IconButton({
  icon,
  label,
  onClick,
  tone,
  expanded,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  tone: "paper" | "night";
  expanded?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      title={label}
      className={`group flex h-8 items-center rounded-full px-2 text-xs font-extrabold shadow-lg backdrop-blur transition-colors ${
        tone === "paper" ? "bg-paper/90 text-ink hover:bg-paper" : "bg-night/70 text-cream/90 hover:bg-night"
      }`}
    >
      <span className="grid h-4 w-4 place-items-center text-sm leading-none">{icon}</span>
      <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:ml-1.5 group-hover:max-w-28 group-hover:opacity-100 group-focus-visible:ml-1.5 group-focus-visible:max-w-28 group-focus-visible:opacity-100">
        {label}
      </span>
    </button>
  );
}

/** Compact objective & progress readout (top-left) + notes/exit (top-right). */
export function ScenarioHUD({ onLeave }: { onLeave: () => void }) {
  const { scenario, difficulty } = useController();
  const progress = useGame((s) => s.progress);
  const inputMode = useGame((s) => s.inputMode);
  const [notesOpen, setNotesOpen] = useState(false);
  const diff = DIFFICULTIES.find((d) => d.id === difficulty)!;

  return (
    <>
      <div className="pointer-events-none absolute left-3 top-3 z-20 max-w-[calc(100vw-9rem)] sm:left-4 sm:top-4">
        <div className="pointer-events-auto w-max max-w-full rounded-xl border border-white/10 bg-night/70 px-3 py-2 text-cream shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-1.5 truncate text-[9px] font-bold tracking-[0.16em] text-gold">
            <Flag code={scenario.language} className="h-[9px] w-[14px]" />
            <span className="truncate">{scenario.locationLabel}</span>
          </div>
          <div className="truncate text-[11.5px] leading-snug text-cream/85">
            <span className="font-display text-[13px] text-cream">{scenario.title}</span>
            <span className="text-cream/40"> · </span>
            {scenario.goal}
          </div>
          <ol className="mt-1 flex items-center gap-1 overflow-hidden whitespace-nowrap text-[10px]" aria-label="Progress">
            {progress.map((p, i) => (
              <li key={p.label} className="flex items-center gap-1">
                <span
                  className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full border transition-colors ${
                    p.status === "done"
                      ? "border-teal bg-teal"
                      : p.status === "active"
                        ? "border-gold bg-gold shadow-[0_0_6px_rgba(242,184,75,0.9)]"
                        : "border-cream/40"
                  }`}
                />
                <span className={p.status === "todo" ? "text-cream/45" : p.status === "active" ? "font-bold text-gold" : "text-cream/85"}>
                  {p.label}
                </span>
                {i < progress.length - 1 && <span className="mx-0.5 inline-block h-px w-2 bg-cream/25" aria-hidden />}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-2 sm:right-4 sm:top-4">
        <div className="flex items-center gap-1.5">
          <span className="hidden rounded-full bg-night/70 px-3 py-1.5 text-xs font-bold text-cream/90 backdrop-blur sm:inline">
            {diff.label} · {inputMode === "live" ? "🎙 Live" : "✋ Push-to-talk"}
          </span>
          <IconButton icon="📋" label={scenario.briefing.title} tone="paper" onClick={() => setNotesOpen((o) => !o)} expanded={notesOpen} />
          <IconButton icon="✕" label="Leave" tone="night" onClick={onLeave} />
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

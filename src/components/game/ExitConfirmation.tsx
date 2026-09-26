"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { useController, useGame } from "./GameContext";

/** In-game "leave the scene?" dialog (replaces the browser's confirm()). */
export function ExitConfirmation({ open, onCancel, onConfirm }: { open: boolean; onCancel: () => void; onConfirm: () => void }) {
  const { scenario } = useController();
  const progress = useGame((s) => s.progress);
  const keepRef = useRef<HTMLButtonElement>(null);
  const done = progress.filter((p) => p.status === "done").length;

  useEffect(() => {
    if (!open) return;
    keepRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onCancel}
          className="absolute inset-0 z-[60] flex items-center justify-center bg-night/60 p-4 backdrop-blur-sm"
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="exit-title"
            aria-describedby="exit-desc"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.92, y: 16, rotate: -1.5 }}
            animate={{ scale: 1, y: 0, rotate: -0.6 }}
            exit={{ scale: 0.95, y: 10, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="paper-grain w-full max-w-sm rounded-3xl bg-paper p-6 text-ink shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
          >
            <div className="text-4xl" aria-hidden>
              🚪
            </div>
            <h2 id="exit-title" className="mt-2 font-display text-2xl">
              Leave the scene?
            </h2>
            <p id="exit-desc" className="mt-1 text-sm leading-relaxed text-ink-soft">
              {scenario.npc.name} will miss you! Your progress so far will be saved and scored.
            </p>

            <div className="mt-4 rounded-2xl bg-ink/5 px-4 py-3">
              <div className="text-xs font-bold text-ink-soft">
                You&apos;ve completed {done} of {progress.length} steps
              </div>
              <div className="mt-2 flex gap-1.5" aria-hidden>
                {progress.map((p) => (
                  <span
                    key={p.label}
                    title={p.label}
                    className={`h-1.5 flex-1 rounded-full ${p.status === "done" ? "bg-teal" : p.status === "active" ? "bg-gold" : "bg-ink/15"}`}
                  />
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                ref={keepRef}
                onClick={onCancel}
                className="rounded-2xl bg-brand py-3 font-display text-lg text-white outline-none ring-brand/40 transition-colors hover:bg-brand-dark focus-visible:ring-4"
              >
                Keep playing
              </button>
              <button
                onClick={onConfirm}
                className="rounded-2xl border-2 border-coral/50 py-3 font-display text-lg text-coral outline-none ring-coral/40 transition-colors hover:bg-coral hover:text-white focus-visible:ring-4"
              >
                Leave scene
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

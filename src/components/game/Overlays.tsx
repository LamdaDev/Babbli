"use client";

import { Flag } from "@/components/ui/Flag";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useController, useGame } from "./GameContext";

/**
 * Scenes start by themselves. Only when the page was opened without any prior
 * click (e.g. a refresh) do browsers require one gesture before audio + mic.
 */
export function TapToEnter() {
  const controller = useController();
  const needsTap = useGame((s) => s.needsTap);
  const phase = useGame((s) => s.phase);
  const { scenario } = controller;
  return (
    <AnimatePresence>
      {needsTap && phase === "briefing" && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => void controller.enter()}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-night/45 text-cream"
        >
          <Flag code={scenario.language} className="h-8 w-12" />
          <span className="font-display text-3xl">{scenario.title}</span>
          <span className="rounded-full bg-tangerine px-6 py-3 font-display text-xl text-white shadow-xl">Tap to step inside →</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export function EntryCurtain() {
  const phase = useGame((s) => s.phase);
  const busyLabel = useGame((s) => s.busyLabel);
  const connecting = phase === "connecting";
  return (
    <>
      <AnimatePresence>
        {(phase === "briefing" || connecting) && (
          <>
            <motion.div
              key="l"
              initial={false}
              animate={{ x: connecting ? "-100%" : "0%" }}
              exit={{ x: "-100%" }}
              transition={{ duration: 1.3, ease: [0.7, 0, 0.3, 1], delay: connecting ? 0.2 : 0 }}
              className="pointer-events-none absolute inset-y-0 left-0 z-40 w-1/2 bg-[#1f3a6b]"
              style={{ opacity: phase === "briefing" ? 0 : 1 }}
            />
            <motion.div
              key="r"
              initial={false}
              animate={{ x: connecting ? "100%" : "0%" }}
              exit={{ x: "100%" }}
              transition={{ duration: 1.3, ease: [0.7, 0, 0.3, 1], delay: connecting ? 0.2 : 0 }}
              className="pointer-events-none absolute inset-y-0 right-0 z-40 w-1/2 bg-[#1f3a6b]"
              style={{ opacity: phase === "briefing" ? 0 : 1 }}
            />
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {connecting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute left-1/2 top-[40%] z-40 -translate-x-1/2 rounded-full bg-night/75 px-5 py-2 text-sm font-bold text-cream backdrop-blur"
          >
            <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-cream border-t-transparent align-[-1px]" />
            {busyLabel ?? "Stepping inside…"}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function TransitionOverlay() {
  const text = useGame((s) => s.transitionText);
  return (
    <AnimatePresence>
      {text && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 1 } }}
          transition={{ duration: 0.9 }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-night/90 p-8"
        >
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: { delay: 0.5 } }}
            className="max-w-xl text-center font-display text-2xl leading-snug text-cream sm:text-3xl"
          >
            {text}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function CompletionOverlay() {
  const controller = useController();
  const phase = useGame((s) => s.phase);
  const completion = useGame((s) => s.completion);
  const busyLabel = useGame((s) => s.busyLabel);
  const sessionId = useGame((s) => s.sessionId);
  const { scenario } = controller;
  return (
    <AnimatePresence>
      {(phase === "ending" || phase === "done") && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 flex items-center justify-center bg-night/60 p-4 backdrop-blur-sm">
          {phase === "ending" ? (
            <div className="rounded-full bg-night/80 px-5 py-2 text-sm font-bold text-cream">{busyLabel ?? "Wrapping up…"}</div>
          ) : (
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 140, damping: 14 }}
              className="paper-grain w-full max-w-md rounded-3xl bg-paper p-7 text-center text-ink shadow-2xl"
            >
              <div className="text-5xl">{completion?.objectiveComplete ? "🎉" : "🚪"}</div>
              {completion?.objectiveComplete ? (
                <>
                  <div className="mt-3 font-jp text-3xl font-black" lang={scenario.language}>
                    {scenario.successTitle}
                  </div>
                  <div className="mt-1 font-display text-lg text-teal">Objective complete</div>
                </>
              ) : (
                <div className="mt-3 font-display text-2xl">Scene ended</div>
              )}
              <p className="mt-2 text-sm text-ink-soft">Your recordings, transcripts and hints are saved. See how you did — comprehension, speaking, fluency, vocabulary and independence.</p>
              <div className="mt-5 flex flex-col gap-2">
                <Link href={`/session/${sessionId}`} className="rounded-2xl bg-ink px-5 py-3 font-display text-lg text-cream">
                  See your feedback →
                </Link>
                <div className="flex gap-2">
                  <button onClick={() => window.location.reload()} className="flex-1 rounded-2xl border-2 border-ink/15 py-2 text-sm font-bold">
                    Play again
                  </button>
                  <Link href="/" className="flex-1 rounded-2xl border-2 border-ink/15 py-2 text-sm font-bold">
                    Home
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ErrorOverlay() {
  const phase = useGame((s) => s.phase);
  const error = useGame((s) => s.error);
  const missingKey = error?.includes("ELEVENLABS_API_KEY");
  if (phase !== "error") return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-night/80 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-paper p-7 text-ink shadow-2xl">
        <div className="text-4xl">😵‍💫</div>
        <div className="mt-2 font-display text-2xl">Couldn&apos;t start the scene</div>
        <p className="mt-2 break-words rounded-xl bg-ink/5 p-3 font-mono text-xs text-ink-soft">{error}</p>
        {missingKey && (
          <p className="mt-3 text-sm">
            Add <code className="rounded bg-ink/10 px-1">ELEVENLABS_API_KEY=…</code> to <code className="rounded bg-ink/10 px-1">.env.local</code> and restart the dev server.
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <button onClick={() => window.location.reload()} className="flex-1 rounded-2xl bg-ink py-2.5 font-bold text-cream">
            Try again
          </button>
          <Link href="/studio" className="flex-1 rounded-2xl border-2 border-ink/15 py-2.5 text-center font-bold">
            Open Studio
          </Link>
        </div>
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useGame((s) => s.toast);
  const [hiddenId, setHiddenId] = useState<number | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setHiddenId(toast.id), 3800);
    return () => clearTimeout(t);
  }, [toast]);
  const visible = toast && toast.id !== hiddenId ? toast : null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-24 z-50 flex justify-center px-4 sm:top-6">
      <AnimatePresence>
        {visible && (
          <motion.div
            key={visible.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`rounded-full px-4 py-2 text-sm font-bold shadow-xl ${
              visible.tone === "warn" ? "bg-gold text-ink" : visible.tone === "good" ? "bg-teal text-white" : "bg-night/85 text-cream"
            }`}
          >
            {visible.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
